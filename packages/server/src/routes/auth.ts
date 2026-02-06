import { devLoginSchema,feishuLoginSchema, refreshTokenSchema } from '@cherry-studio/enterprise-shared'
import { createSuccessResponse, ERROR_CODES } from '@cherry-studio/enterprise-shared'
import { and,eq } from 'drizzle-orm'
import { Router } from 'express'

import { config } from '../config'
import { authenticate, generateTokens, verifyRefreshToken } from '../middleware/auth'
import { AppError, AuthenticationError, NotFoundError } from '../middleware/errorHandler'
import { loginLimiter } from '../middleware/rate-limit.middleware'
import { validate } from '../middleware/validate'
import { companies, db, departments,refreshTokens, roles, users } from '../models'
import { createLogger } from '../utils/logger'

const router = Router()
const logger = createLogger('AuthRoutes')

/**
 * 飞书 OAuth 登录
 * POST /auth/feishu/login
 */
router.post('/feishu/login', loginLimiter, validate(feishuLoginSchema), async (req, res, next) => {
  try {
    const { code } = req.body

    // 获取飞书 access_token
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

    // 查找或创建用户
    const feishuUserId = userTokenData.data!.user_id
    const user = await db.query.users.findFirst({
      where: eq(users.feishuUserId, feishuUserId),
      with: { role: true, department: true }
    })

    if (!user) {
      // 新用户，需要管理员预先创建账号或自动创建
      throw new NotFoundError('User not registered. Please contact administrator.')
    }

    // 更新最后登录时间
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id))

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

    res.json(
      createSuccessResponse({
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
      })
    )
  } catch (err) {
    next(err)
  }
})

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

      // 3a. 查找或创建公司
      let company = await db.query.companies.findFirst({
        where: eq(companies.name, 'Development Company')
      })
      if (!company) {
        const [newCompany] = await db
          .insert(companies)
          .values({
            name: 'Development Company',
            settings: {}
          })
          .returning()
        company = newCompany
      }

      // 3b. 查找或创建部门
      let department = await db.query.departments.findFirst({
        where: eq(departments.companyId, company.id)
      })
      if (!department) {
        const [newDept] = await db
          .insert(departments)
          .values({
            companyId: company.id,
            name: 'Development',
            path: '/dev'
          })
          .returning()
        department = newDept
      }

      // 3c. 查找或创建超级管理员角色
      let role = await db.query.roles.findFirst({
        where: and(eq(roles.companyId, company.id), eq(roles.name, 'Super Admin'))
      })
      if (!role) {
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
