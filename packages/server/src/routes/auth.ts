import { devLoginSchema, feishuLoginSchema, refreshTokenSchema } from '@cherry-studio/enterprise-shared'
import { createSuccessResponse, ERROR_CODES } from '@cherry-studio/enterprise-shared'
import { and, eq } from 'drizzle-orm'
import { Router } from 'express'

import { config } from '../config'
import { authenticate, generateTokens, verifyRefreshToken } from '../middleware/auth'
import { AppError, AuthenticationError, NotFoundError } from '../middleware/errorHandler'
import { loginLimiter } from '../middleware/rate-limit.middleware'
import { validate } from '../middleware/validate'
import { companies, db, departments, refreshTokens, roles, users } from '../models'
import { autoRegisterFeishuUser } from '../services/feishu-auto-register.service'
import { createLogger } from '../utils/logger'

const router = Router()
const logger = createLogger('AuthRoutes')

// ---------------------------------------------------------------------------
// 飞书 OAuth 登录会话存储（sessionId → 登录结果）
// 条目 5 分钟后自动过期
// ---------------------------------------------------------------------------
interface FeishuLoginSession {
  status: 'pending' | 'success' | 'error'
  data?: Record<string, unknown>
  error?: string
  createdAt: number
}

const feishuSessions = new Map<string, FeishuLoginSession>()
const MAX_FEISHU_SESSIONS = 10000
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// 清理过期 session（每分钟执行一次）
const sessionCleanupTimer = setInterval(() => {
  const now = Date.now()
  for (const [id, session] of feishuSessions) {
    if (now - session.createdAt > 5 * 60 * 1000) {
      feishuSessions.delete(id)
    }
  }
}, 60 * 1000)

// 允许优雅关闭时清理 timer
sessionCleanupTimer.unref()

// ---------------------------------------------------------------------------
// 公共逻辑：飞书 code → token → 用户信息 → JWT
// ---------------------------------------------------------------------------
async function processFeishuCode(code: string) {
  // 获取飞书 app_access_token
  const tokenResponse = await fetch('https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: config.feishu.appId,
      app_secret: config.feishu.appSecret
    })
  })

  const tokenData = (await tokenResponse.json()) as { code: number; app_access_token?: string; msg?: string }
  if (tokenData.code !== 0) {
    throw new AppError(ERROR_CODES.AUTH_FEISHU_FAILED, `Failed to get app access token: ${tokenData.msg}`, 400)
  }

  // 使用 code 获取用户 access_token
  const userTokenResponse = await fetch('https://open.feishu.cn/open-apis/authen/v1/oidc/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenData.app_access_token}`
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code
    })
  })

  const userTokenData = (await userTokenResponse.json()) as {
    code: number
    data?: { access_token: string; open_id: string; user_id: string }
    msg?: string
  }
  if (userTokenData.code !== 0) {
    throw new AppError(ERROR_CODES.AUTH_FEISHU_FAILED, `Failed to get user token: ${userTokenData.msg}`, 400)
  }

  // 获取用户信息
  const userInfoResponse = await fetch('https://open.feishu.cn/open-apis/authen/v1/user_info', {
    headers: {
      Authorization: `Bearer ${userTokenData.data!.access_token}`
    }
  })

  const userInfo = (await userInfoResponse.json()) as {
    code: number
    data?: { name: string; avatar_url?: string; email?: string; mobile?: string }
    msg?: string
  }
  if (userInfo.code !== 0) {
    throw new AppError(ERROR_CODES.AUTH_FEISHU_FAILED, `Failed to get user info: ${userInfo.msg}`, 400)
  }

  // 查找用户
  const feishuUserId = userTokenData.data!.user_id
  let user = await db.query.users.findFirst({
    where: eq(users.feishuUserId, feishuUserId),
    with: { role: true, department: true }
  })

  if (!user) {
    // 尝试自动注册（如果企业启用了飞书自动注册）
    user = await autoRegisterFeishuUser({
      feishuUserId,
      feishuOpenId: userTokenData.data!.open_id,
      name: userInfo.data!.name,
      avatarUrl: userInfo.data?.avatar_url,
      email: userInfo.data?.email,
      mobile: userInfo.data?.mobile
    })
  } else {
    // 已有用户：同步飞书最新信息
    const syncData: Record<string, unknown> = { lastLoginAt: new Date(), updatedAt: new Date() }
    if (userInfo.data?.name) syncData.name = userInfo.data.name
    if (userInfo.data?.avatar_url) syncData.avatar = userInfo.data.avatar_url
    if (userInfo.data?.mobile) syncData.mobile = userInfo.data.mobile
    if (!user.feishuOpenId && userTokenData.data!.open_id) {
      syncData.feishuOpenId = userTokenData.data!.open_id
    }
    await db.update(users).set(syncData).where(eq(users.id, user.id))
  }

  // 生成 tokens
  const roleData = await db.query.roles.findFirst({
    where: eq(roles.id, user.roleId)
  })

  const tokens = await generateTokens({
    sub: user.id,
    companyId: user.companyId,
    departmentId: user.departmentId,
    roleId: user.roleId,
    permissions: (roleData?.permissions as any) || {}
  })

  // 保存 refresh token
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  await db.insert(refreshTokens).values({
    userId: user.id,
    token: tokens.refreshToken,
    expiresAt
  })

  logger.info({ userId: user.id }, 'User logged in via Feishu')

  return {
    ...tokens,
    expiresIn: 3600,
    tokenType: 'Bearer',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      status: user.status,
      role: {
        id: user.role.id,
        name: user.role.name,
        permissions: user.role.permissions
      },
      department: {
        id: user.department.id,
        name: user.department.name
      }
    }
  }
}

/**
 * 飞书 OAuth 登录
 * POST /auth/feishu/login
 */
router.post('/feishu/login', loginLimiter, validate(feishuLoginSchema), async (req, res, next) => {
  try {
    const { code } = req.body
    const result = await processFeishuCode(code)
    res.json(createSuccessResponse(result))
  } catch (err) {
    next(err)
  }
})

/**
 * 飞书 OAuth 回调 (浏览器重定向，用于 Electron 客户端)
 * GET /auth/feishu/callback?code=xxx&state=sessionId
 */
router.get('/feishu/callback', loginLimiter, async (req, res) => {
  const { code, state: sessionId } = req.query

  if (!code || typeof code !== 'string' || !sessionId || typeof sessionId !== 'string') {
    res.status(400).send(buildCallbackHtml(false, 'Missing code or state parameter'))
    return
  }

  // 验证 sessionId 格式（UUID v4）
  if (!UUID_V4_RE.test(sessionId)) {
    res.status(400).send(buildCallbackHtml(false, 'Invalid state parameter'))
    return
  }

  // 防止 Map 无限增长
  if (feishuSessions.size >= MAX_FEISHU_SESSIONS) {
    logger.warn({ size: feishuSessions.size }, 'Feishu session store is full, rejecting new callback')
    res.status(503).send(buildCallbackHtml(false, 'Server busy, please try again later'))
    return
  }

  try {
    const result = await processFeishuCode(code)

    feishuSessions.set(sessionId, {
      status: 'success',
      data: result as unknown as Record<string, unknown>,
      createdAt: Date.now()
    })

    res.send(buildCallbackHtml(true))
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    logger.error({ err, sessionId }, 'Feishu callback failed')

    feishuSessions.set(sessionId, {
      status: 'error',
      error: errorMessage,
      createdAt: Date.now()
    })

    res.send(buildCallbackHtml(false, errorMessage))
  }
})

/**
 * 轮询飞书登录结果
 * GET /auth/feishu/poll?session_id=xxx
 */
router.get('/feishu/poll', loginLimiter, (req, res) => {
  const { session_id } = req.query

  if (!session_id || typeof session_id !== 'string') {
    res.status(400).json({ success: false, error: 'Missing session_id' })
    return
  }

  // 验证 session_id 格式（UUID v4）
  if (!UUID_V4_RE.test(session_id)) {
    res.status(400).json({ success: false, error: 'Invalid session_id' })
    return
  }

  const session = feishuSessions.get(session_id)

  if (!session || session.status === 'pending') {
    res.json(createSuccessResponse({ status: 'pending' }))
    return
  }

  if (session.status === 'success') {
    feishuSessions.delete(session_id)
    res.json(createSuccessResponse({ status: 'success', ...session.data }))
    return
  }

  // status === 'error'
  feishuSessions.delete(session_id)
  res.status(400).json({ success: false, error: session.error })
})

/**
 * HTML 实体转义，防止 XSS
 */
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * 构建飞书回调结果 HTML 页面
 */
function buildCallbackHtml(success: boolean, errorMessage?: string): string {
  const title = success ? '登录成功' : '登录失败'
  const safeError = escapeHtml(errorMessage ?? '未知错误')
  const message = success
    ? '请返回 Cherry Studio 应用，窗口将自动完成登录。'
    : `登录失败：${safeError}，请关闭此页面后重试。`
  const color = success ? '#52c41a' : '#ff4d4f'

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>${title}</title>
<style>
  body{display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f5f5f5}
  .card{background:#fff;border-radius:12px;padding:48px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.1);max-width:400px}
  h1{color:${color};margin-bottom:12px}
  p{color:#666;line-height:1.6}
</style>
</head>
<body><div class="card"><h1>${title}</h1><p>${message}</p></div></body>
</html>`
}

/**
 * 开发者登录 (仅开发环境)
 * POST /auth/dev/login
 */
router.post('/dev/login', loginLimiter, validate(devLoginSchema), async (req, res, next) => {
  try {
    // 1. 检查开发者登录是否启用
    if (!config.devLogin.enabled) {
      throw new AppError(ERROR_CODES.AUTH_UNAUTHORIZED, 'Dev login is not enabled', 403)
    }

    const { username, password } = req.body

    // 2. 验证凭证
    if (username !== config.devLogin.username || password !== config.devLogin.password) {
      throw new AuthenticationError('Invalid dev credentials')
    }

    // 3. 查找或创建开发者用户
    let user = await db.query.users.findFirst({
      where: eq(users.email, 'dev@localhost'),
      with: { role: true, department: true }
    })

    if (!user) {
      // 需要创建开发者用户及其依赖

      // 3a. 优先复用已有企业（取最早创建的），无则创建 yadea
      let company = await db.query.companies.findFirst({
        orderBy: (companies, { asc }) => [asc(companies.createdAt)]
      })
      if (company) {
        logger.info({ companyId: company.id, companyName: company.name }, 'Dev login: reusing existing company')
      } else {
        logger.info('Dev login: no company found, creating yadea')
        const [newCompany] = await db
          .insert(companies)
          .values({
            name: 'yadea',
            settings: {}
          })
          .returning()
        company = newCompany
        logger.info({ companyId: company.id }, 'Dev login: yadea company created')
      }

      // 3b. 查找或创建部门
      let department = await db.query.departments.findFirst({
        where: eq(departments.companyId, company.id)
      })
      if (!department) {
        logger.info({ companyId: company.id }, 'Dev login: creating default department')
        const [newDept] = await db
          .insert(departments)
          .values({
            companyId: company.id,
            name: 'Development',
            path: '/dev'
          })
          .returning()
        department = newDept
        logger.info({ departmentId: department.id }, 'Dev login: default department created')
      }

      // 3c. 查找或创建超级管理员角色
      let role = await db.query.roles.findFirst({
        where: and(eq(roles.companyId, company.id), eq(roles.name, 'Super Admin'))
      })
      if (!role) {
        logger.info({ companyId: company.id }, 'Dev login: creating Super Admin role')
        const [newRole] = await db
          .insert(roles)
          .values({
            companyId: company.id,
            name: 'Super Admin',
            permissions: {
              models: ['read', 'use'],
              knowledgeBases: ['read', 'write', 'admin'],
              users: ['read', 'write', 'admin'],
              statistics: ['read', 'export'],
              system: ['backup', 'restore', 'settings']
            },
            isSystem: true
          })
          .returning()
        role = newRole
        logger.info({ roleId: role.id }, 'Dev login: Super Admin role created')
      }

      // 3d. 创建开发者用户
      const [newUser] = await db
        .insert(users)
        .values({
          companyId: company.id,
          departmentId: department.id,
          roleId: role.id,
          email: 'dev@localhost',
          name: 'Developer',
          status: 'active'
        })
        .returning()

      user = await db.query.users.findFirst({
        where: eq(users.id, newUser.id),
        with: { role: true, department: true }
      })
    }

    // 4. 更新最后登录时间
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user!.id))

    // 5. 生成 tokens
    const tokens = await generateTokens({
      sub: user!.id,
      companyId: user!.companyId,
      departmentId: user!.departmentId,
      roleId: user!.roleId,
      permissions: (user!.role.permissions as any) || {}
    })

    // 6. 保存 refresh token
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    await db.insert(refreshTokens).values({
      userId: user!.id,
      token: tokens.refreshToken,
      expiresAt
    })

    logger.info({ userId: user!.id }, 'User logged in via dev login')

    // 7. 返回响应 (与 /auth/me 格式一致)
    res.json(
      createSuccessResponse({
        ...tokens,
        expiresIn: 3600,
        tokenType: 'Bearer',
        user: {
          id: user!.id,
          name: user!.name,
          email: user!.email,
          avatar: user!.avatar,
          status: user!.status,
          role: {
            id: user!.role.id,
            name: user!.role.name,
            permissions: user!.role.permissions
          },
          department: {
            id: user!.department.id,
            name: user!.department.name
          }
        }
      })
    )
  } catch (err) {
    next(err)
  }
})

/**
 * 刷新 Token
 * POST /auth/refresh
 */
router.post('/refresh', validate(refreshTokenSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body

    // 验证 refresh token
    const userId = await verifyRefreshToken(refreshToken)

    // 检查 token 是否在数据库中
    const storedToken = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.token, refreshToken)
    })

    if (!storedToken) {
      throw new AuthenticationError('Invalid refresh token')
    }

    // 删除旧的 refresh token
    await db.delete(refreshTokens).where(eq(refreshTokens.token, refreshToken))

    // 获取用户和角色信息
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      with: { role: true }
    })

    if (!user) {
      throw new NotFoundError('User')
    }

    // 生成新 tokens
    const tokens = await generateTokens({
      sub: user.id,
      companyId: user.companyId,
      departmentId: user.departmentId,
      roleId: user.roleId,
      permissions: (user.role.permissions as any) || {}
    })

    // 保存新的 refresh token
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    try {
      await db.insert(refreshTokens).values({
        userId: user.id,
        token: tokens.refreshToken,
        expiresAt
      })
    } catch (insertError: any) {
      // 处理重复键冲突 - PostgreSQL 错误码 23505
      if (insertError.code === '23505') {
        logger.warn({ userId: user.id }, 'Duplicate refresh token detected, regenerating')
        // 重新生成 token 并重试
        const newTokens = await generateTokens({
          sub: user.id,
          companyId: user.companyId,
          departmentId: user.departmentId,
          roleId: user.roleId,
          permissions: (user.role.permissions as any) || {}
        })
        const newExpiresAt = new Date()
        newExpiresAt.setDate(newExpiresAt.getDate() + 7)
        await db.insert(refreshTokens).values({
          userId: user.id,
          token: newTokens.refreshToken,
          expiresAt: newExpiresAt
        })
        return res.json(
          createSuccessResponse({
            ...newTokens,
            expiresIn: 3600,
            tokenType: 'Bearer'
          })
        )
      }
      throw insertError
    }

    res.json(
      createSuccessResponse({
        ...tokens,
        expiresIn: 3600,
        tokenType: 'Bearer'
      })
    )
  } catch (err) {
    next(err)
  }
})

/**
 * 登出
 * POST /auth/logout
 */
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    // 删除用户的所有 refresh tokens
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, req.user!.sub))

    logger.info({ userId: req.user!.sub }, 'User logged out')

    res.json(createSuccessResponse({ message: 'Logged out successfully' }))
  } catch (err) {
    next(err)
  }
})

/**
 * 获取当前用户信息
 * GET /auth/me
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.user!.sub),
      with: {
        role: true,
        department: true
      }
    })

    if (!user) {
      throw new NotFoundError('User')
    }

    res.json(
      createSuccessResponse({
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        status: user.status,
        role: {
          id: user.role.id,
          name: user.role.name,
          permissions: user.role.permissions
        },
        department: {
          id: user.department.id,
          name: user.department.name
        },
        lastLoginAt: user.lastLoginAt
      })
    )
  } catch (err) {
    next(err)
  }
})

export default router
