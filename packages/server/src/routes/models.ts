import {
  chatRequestSchema,
  createModelSchema,
  createSuccessResponse,
  paginationParamsSchema,
  updateModelSchema} from '@cherry-studio/enterprise-shared'
import { ERROR_CODES } from '@cherry-studio/enterprise-shared'
import { and, eq, sql } from 'drizzle-orm'
import { Router } from 'express'

import { modelCostTotal,modelTokensTotal } from '../metrics'
import { authenticate, requirePermission } from '../middleware/auth'
import { AppError,AuthorizationError, NotFoundError, QuotaExceededError } from '../middleware/errorHandler'
import { chatLimiter } from '../middleware/rate-limit.middleware'
import { validate } from '../middleware/validate'
import { db,modelPermissions, models, usageLogs } from '../models'
import { cryptoService } from '../services/crypto.service'
import { quotaAlertService } from '../services/quota-alert.service'
import { createLogger } from '../utils/logger'

const router = Router()
const logger = createLogger('ModelRoutes')

/**
 * 解密模型 API Key
 * 用于调用模型 API 时获取明文 API Key
 */
function decryptApiKey(encryptedKey: string): string {
  try {
    return cryptoService.decrypt(encryptedKey)
  } catch (error) {
    logger.error({ error }, 'Failed to decrypt API key')
    throw new AppError(ERROR_CODES.INTERNAL_ERROR, 'Failed to decrypt API key', 500)
  }
}

/**
 * 加密模型 API Key
 * 用于存储时加密 API Key
 */
function encryptApiKey(plainKey: string): string {
  try {
    return cryptoService.encrypt(plainKey)
  } catch (error) {
    logger.error({ error }, 'Failed to encrypt API key')
    throw new AppError(ERROR_CODES.INTERNAL_ERROR, 'Failed to encrypt API key', 500)
  }
}

router.use(authenticate)

/**
 * 检查用户对模型的访问权限
 */
async function checkModelAccess(
  modelId: string,
  userId: string,
  departmentId: string,
  roleId: string
): Promise<boolean> {
  // 查找权限规则
  const permissions = await db.query.modelPermissions.findMany({
    where: eq(modelPermissions.modelId, modelId)
  })

  // 如果没有权限规则，默认允许
  if (permissions.length === 0) {
    return true
  }

  // 检查是否有明确允许的规则
  for (const perm of permissions) {
    if (perm.allowed) {
      if (perm.targetType === 'user' && perm.targetId === userId) return true
      if (perm.targetType === 'department' && perm.targetId === departmentId) return true
      if (perm.targetType === 'role' && perm.targetId === roleId) return true
    }
  }

  return false
}

/**
 * 检查用量配额
 */
async function checkQuota(modelId: string, userId: string, companyId: string): Promise<void> {
  const model = await db.query.models.findFirst({
    where: eq(models.id, modelId)
  })

  if (!model || !model.quota) return

  const quota = model.quota as { dailyLimit?: number; monthlyLimit?: number; perUserLimit?: number }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

  // 检查每日配额
  if (quota.dailyLimit) {
    const [dailyUsage] = await db
      .select({ total: sql<number>`sum(total_tokens)` })
      .from(usageLogs)
      .where(and(eq(usageLogs.modelId, modelId), eq(usageLogs.companyId, companyId), sql`created_at >= ${today}`))

    if (Number(dailyUsage.total || 0) >= quota.dailyLimit) {
      throw new QuotaExceededError('daily')
    }
  }

  // 检查每月配额
  if (quota.monthlyLimit) {
    const [monthlyUsage] = await db
      .select({ total: sql<number>`sum(total_tokens)` })
      .from(usageLogs)
      .where(and(eq(usageLogs.modelId, modelId), eq(usageLogs.companyId, companyId), sql`created_at >= ${monthStart}`))

    if (Number(monthlyUsage.total || 0) >= quota.monthlyLimit) {
      throw new QuotaExceededError('monthly')
    }
  }

  // 检查用户配额
  if (quota.perUserLimit) {
    const [userUsage] = await db
      .select({ total: sql<number>`sum(total_tokens)` })
      .from(usageLogs)
      .where(and(eq(usageLogs.modelId, modelId), eq(usageLogs.userId, userId), sql`created_at >= ${monthStart}`))

    if (Number(userUsage.total || 0) >= quota.perUserLimit) {
      throw new QuotaExceededError('user')
    }
  }
}

/**
 * 获取可用模型列表
 * GET /models
 */
router.get('/', validate(paginationParamsSchema, 'query'), async (req, res, next) => {
  try {
    const params = req.query as any

    const modelList = await db.query.models.findMany({
      where: and(eq(models.companyId, req.user!.companyId), eq(models.isEnabled, true)),
      orderBy: models.displayName
    })

    // 过滤用户有权限访问的模型
    const accessibleModels = []
    for (const model of modelList) {
      const hasAccess = await checkModelAccess(model.id, req.user!.sub, req.user!.departmentId, req.user!.roleId)
      if (hasAccess) {
        const config = model.config as { capabilities?: string[]; maxTokens?: number } | null
        accessibleModels.push({
          id: model.id,
          providerId: model.providerId,
          provider: model.providerId, // 兼容客户端期望的字段
          name: model.name,
          displayName: model.displayName,
          description: model.description,
          capabilities: config?.capabilities || [],
          group: model.providerId, // 用于客户端分组显示
          maxTokens: config?.maxTokens,
          enabled: model.isEnabled
        })
      }
    }

    res.json(createSuccessResponse(accessibleModels))
  } catch (err) {
    next(err)
  }
})

/**
 * 获取单个模型（管理员）
 * GET /models/:id
 */
router.get('/:id', requirePermission('models', 'read'), async (req, res, next) => {
  try {
    const model = await db.query.models.findFirst({
      where: and(eq(models.id, req.params.id), eq(models.companyId, req.user!.companyId))
    })

    if (!model) {
      throw new NotFoundError('Model')
    }

    res.json(
      createSuccessResponse({
        id: model.id,
        providerId: model.providerId,
        name: model.name,
        displayName: model.displayName,
        description: model.description,
        apiEndpoint: model.apiEndpoint,
        isEnabled: model.isEnabled,
        config: model.config,
        quota: model.quota,
        createdAt: model.createdAt
      })
    )
  } catch (err) {
    next(err)
  }
})

/**
 * 对话接口（模型代理）
 * POST /models/:id/chat
 */
router.post('/:id/chat', chatLimiter, validate(chatRequestSchema), async (req, res, next) => {
  try {
    const { messages: chatMessages, conversationId, stream, knowledgeBaseIds, config: chatConfig } = req.body
    const modelId = req.params.id

    // 检查模型存在且启用
    const model = await db.query.models.findFirst({
      where: and(eq(models.id, modelId), eq(models.companyId, req.user!.companyId), eq(models.isEnabled, true))
    })

    if (!model) {
      throw new NotFoundError('Model')
    }

    // 检查权限
    const hasAccess = await checkModelAccess(modelId, req.user!.sub, req.user!.departmentId, req.user!.roleId)
    if (!hasAccess) {
      throw new AuthorizationError('No access to this model')
    }

    // 检查配额
    await checkQuota(modelId, req.user!.sub, req.user!.companyId)

    const startTime = Date.now()

    // TODO: 实现知识库检索增强
    // if (knowledgeBaseIds?.length > 0) { ... }

    // 调用模型 API
    // 这里使用通用的 OpenAI 兼容格式
    const apiEndpoint = model.apiEndpoint || getDefaultEndpoint(model.providerId)

    const requestBody = {
      model: model.name,
      messages: chatMessages,
      stream,
      ...(chatConfig || model.config)
    }

    // 解密 API Key
    const apiKey = decryptApiKey(model.apiKey)

    const response = await fetch(`${apiEndpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const error = await response.text()
      logger.error({ modelId, error }, 'Model API error')
      throw new AppError(ERROR_CODES.MODEL_API_ERROR, `Model API error: ${error}`, response.status)
    }

    // 处理流式响应
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()

      let inputTokens = 0
      let outputTokens = 0
      let fullContent = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          res.write(chunk)

          // 尝试从 chunk 中提取 token 统计
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ') && !line.includes('[DONE]')) {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.usage) {
                  inputTokens = data.usage.prompt_tokens || 0
                  outputTokens = data.usage.completion_tokens || 0
                }
                if (data.choices?.[0]?.delta?.content) {
                  fullContent += data.choices[0].delta.content
                }
              } catch {
                // 忽略解析错误
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

      res.end()

      // 记录用量
      const duration = Date.now() - startTime
      await recordUsage(req.user!, model, inputTokens, outputTokens, duration, conversationId)
    } else {
      // 非流式响应
      const data = (await response.json()) as any

      const duration = Date.now() - startTime
      const inputTokens = data.usage?.prompt_tokens || 0
      const outputTokens = data.usage?.completion_tokens || 0

      await recordUsage(req.user!, model, inputTokens, outputTokens, duration, conversationId)

      res.json(createSuccessResponse(data))
    }
  } catch (err) {
    next(err)
  }
})

/**
 * 获取模型用量统计
 * GET /models/:id/usage
 */
router.get('/:id/usage', requirePermission('statistics', 'read'), async (req, res, next) => {
  try {
    const modelId = req.params.id

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

    const [dailyStats, monthlyStats, totalStats] = await Promise.all([
      db
        .select({
          requests: sql<number>`count(*)`,
          tokens: sql<number>`sum(total_tokens)`,
          cost: sql<number>`sum(cost)`
        })
        .from(usageLogs)
        .where(and(eq(usageLogs.modelId, modelId), sql`created_at >= ${today}`)),

      db
        .select({
          requests: sql<number>`count(*)`,
          tokens: sql<number>`sum(total_tokens)`,
          cost: sql<number>`sum(cost)`
        })
        .from(usageLogs)
        .where(and(eq(usageLogs.modelId, modelId), sql`created_at >= ${monthStart}`)),

      db
        .select({
          requests: sql<number>`count(*)`,
          tokens: sql<number>`sum(total_tokens)`,
          cost: sql<number>`sum(cost)`
        })
        .from(usageLogs)
        .where(eq(usageLogs.modelId, modelId))
    ])

    res.json(
      createSuccessResponse({
        daily: {
          requests: Number(dailyStats[0].requests || 0),
          tokens: Number(dailyStats[0].tokens || 0),
          cost: Number(dailyStats[0].cost || 0)
        },
        monthly: {
          requests: Number(monthlyStats[0].requests || 0),
          tokens: Number(monthlyStats[0].tokens || 0),
          cost: Number(monthlyStats[0].cost || 0)
        },
        total: {
          requests: Number(totalStats[0].requests || 0),
          tokens: Number(totalStats[0].tokens || 0),
          cost: Number(totalStats[0].cost || 0)
        }
      })
    )
  } catch (err) {
    next(err)
  }
})

/**
 * 创建模型（管理员）
 * POST /models
 */
router.post('/', requirePermission('system', 'settings'), validate(createModelSchema), async (req, res, next) => {
  try {
    const data = req.body

    // 加密 API Key
    const encryptedApiKey = encryptApiKey(data.apiKey)

    const [newModel] = await db
      .insert(models)
      .values({
        companyId: req.user!.companyId,
        providerId: data.providerId,
        name: data.name,
        displayName: data.displayName,
        description: data.description,
        apiKey: encryptedApiKey,
        apiEndpoint: data.apiEndpoint,
        config: data.config || {},
        quota: data.quota || {}
      })
      .returning()

    logger.info({ modelId: newModel.id, createdBy: req.user!.sub }, 'Model created')

    res.status(201).json(
      createSuccessResponse({
        id: newModel.id,
        name: newModel.name,
        displayName: newModel.displayName,
        providerId: newModel.providerId,
        createdAt: newModel.createdAt
      })
    )
  } catch (err) {
    next(err)
  }
})

/**
 * 更新模型（管理员）
 * PATCH /models/:id
 */
router.patch('/:id', requirePermission('system', 'settings'), validate(updateModelSchema), async (req, res, next) => {
  try {
    const data = req.body

    const existing = await db.query.models.findFirst({
      where: and(eq(models.id, req.params.id), eq(models.companyId, req.user!.companyId))
    })

    if (!existing) {
      throw new NotFoundError('Model')
    }

    // 如果更新了 API Key，需要加密
    const updateData = { ...data }
    if (updateData.apiKey) {
      updateData.apiKey = encryptApiKey(updateData.apiKey)
    }

    const [updated] = await db
      .update(models)
      .set({
        ...updateData,
        updatedAt: new Date()
      })
      .where(eq(models.id, req.params.id))
      .returning()

    logger.info({ modelId: updated.id, updatedBy: req.user!.sub }, 'Model updated')

    res.json(createSuccessResponse(updated))
  } catch (err) {
    next(err)
  }
})

/**
 * 删除模型（管理员）
 * DELETE /models/:id
 */
router.delete('/:id', requirePermission('system', 'settings'), async (req, res, next) => {
  try {
    const existing = await db.query.models.findFirst({
      where: and(eq(models.id, req.params.id), eq(models.companyId, req.user!.companyId))
    })

    if (!existing) {
      throw new NotFoundError('Model')
    }

    await db.delete(models).where(eq(models.id, req.params.id))

    logger.info({ modelId: req.params.id, deletedBy: req.user!.sub }, 'Model deleted')

    res.json(createSuccessResponse({ message: 'Model deleted successfully' }))
  } catch (err) {
    next(err)
  }
})

// 辅助函数

function getDefaultEndpoint(providerId: string): string {
  const endpoints: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    azure: '', // 需要配置
    google: 'https://generativelanguage.googleapis.com/v1beta'
  }
  return endpoints[providerId] || ''
}

async function recordUsage(
  user: any,
  model: any,
  inputTokens: number,
  outputTokens: number,
  duration: number,
  conversationId?: string
): Promise<void> {
  try {
    // 计算费用（简化版，实际应该根据模型定价）
    const cost = (inputTokens * 0.001 + outputTokens * 0.002) / 1000

    await db.insert(usageLogs).values({
      companyId: user.companyId,
      userId: user.sub,
      modelId: model.id,
      conversationId,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      cost,
      duration
    })

    // 更新 Prometheus 指标
    modelTokensTotal.inc({ model: model.name, type: 'input' }, inputTokens)
    modelTokensTotal.inc({ model: model.name, type: 'output' }, outputTokens)
    modelCostTotal.inc({ model: model.name }, cost)

    // 检查配额并发送预警
    const quota = model.quota as { perUserLimit?: number } | null
    if (quota?.perUserLimit) {
      const monthStart = new Date()
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)

      const [userUsage] = await db
        .select({ total: sql<number>`sum(total_tokens)` })
        .from(usageLogs)
        .where(and(eq(usageLogs.modelId, model.id), eq(usageLogs.userId, user.sub), sql`created_at >= ${monthStart}`))

      const usedTokens = Number(userUsage?.total || 0)
      const usedPercent = quotaAlertService.calculateUsedPercent(usedTokens, quota.perUserLimit)

      // 异步发送预警（不阻塞响应）
      quotaAlertService.checkAndNotify(user.sub, user.name || 'Unknown', usedPercent).catch((err) => {
        logger.error({ err }, 'Failed to send quota alert')
      })
    }
  } catch (err) {
    logger.error({ err }, 'Failed to record usage')
  }
}

export default router
