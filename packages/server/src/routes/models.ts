import {
  batchCreateModelsSchema,
  buildChatCompletionsUrl,
  chatRequestSchema,
  createModelSchema,
  createSuccessResponse,
  fetchRemoteModelsSchema,
  getProviderDefaultEndpoint,
  paginationParamsSchema,
  setPricingSchema,
  updateModelSchema
} from '@cherry-studio/enterprise-shared'
import { ERROR_CODES } from '@cherry-studio/enterprise-shared'
import { and, desc, eq, gt, isNull, lte, or, sql } from 'drizzle-orm'
import { Router } from 'express'

import { modelCostTotal, modelTokensTotal } from '../metrics'
import { authenticate, requirePermission } from '../middleware/auth'
import { AppError, AuthorizationError, NotFoundError, QuotaExceededError } from '../middleware/errorHandler'
import { chatLimiter } from '../middleware/rate-limit.middleware'
import { validate } from '../middleware/validate'
import { db, modelPermissions, modelPricing, models, usageLogs, users } from '../models'
import { cryptoService } from '../services/crypto.service'
import { fetchRemoteModels } from '../services/model-fetch.service'
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
 * 远程获取供应商模型列表
 * POST /models/fetch-remote
 *
 * 通过供应商的 OpenAI 兼容接口获取模型列表，自动检测能力。
 * 仅管理员可调用（requirePermission('system', 'settings')）。
 */
router.post(
  '/fetch-remote',
  requirePermission('system', 'settings'),
  validate(fetchRemoteModelsSchema),
  async (req, res, next) => {
    try {
      const { providerId, apiKey, apiEndpoint } = req.body

      // 查询当前企业已添加的模型名称集合
      const existingModels = await db.query.models.findMany({
        where: and(eq(models.companyId, req.user!.companyId), eq(models.providerId, providerId)),
        columns: { name: true }
      })
      const existingModelNames = new Set(existingModels.map((m) => m.name))

      const result = await fetchRemoteModels({ providerId, apiKey, apiEndpoint }, existingModelNames)

      logger.info({ providerId, total: result.total, userId: req.user!.sub }, 'Remote models fetched via API')

      res.json(createSuccessResponse(result))
    } catch (err) {
      next(err)
    }
  }
)

/**
 * 批量创建模型
 * POST /models/batch
 *
 * 将远程获取到的模型批量添加到系统中。
 * 仅管理员可调用（requirePermission('system', 'settings')）。
 * 已存在的模型会被跳过。
 */
router.post(
  '/batch',
  requirePermission('system', 'settings'),
  validate(batchCreateModelsSchema),
  async (req, res, next) => {
    try {
      const { providerId, apiKey, apiEndpoint, config: batchConfig, models: modelItems } = req.body

      // 加密 API Key
      const encryptedApiKey = encryptApiKey(apiKey)

      // 查询当前企业该供应商下已存在的模型
      const existingModels = await db.query.models.findMany({
        where: and(eq(models.companyId, req.user!.companyId), eq(models.providerId, providerId)),
        columns: { name: true }
      })
      const existingModelNames = new Set(existingModels.map((m) => m.name))

      const created: string[] = []
      const skipped: string[] = []
      const errors: Array<{ name: string; error: string }> = []

      for (const item of modelItems) {
        // 跳过已存在的模型
        if (existingModelNames.has(item.name)) {
          skipped.push(item.name)
          continue
        }

        try {
          const [newModel] = await db
            .insert(models)
            .values({
              companyId: req.user!.companyId,
              providerId,
              name: item.name,
              displayName: item.displayName,
              apiKey: encryptedApiKey,
              apiEndpoint: apiEndpoint || undefined,
              config: {
                capabilities: item.capabilities || [],
                ...(batchConfig?.providerDisplayName ? { providerDisplayName: batchConfig.providerDisplayName } : {})
              },
              quota: {}
            })
            .returning()

          created.push(newModel.id)
          existingModelNames.add(item.name)
        } catch (insertError) {
          const errorMessage = insertError instanceof Error ? insertError.message : 'Unknown error'
          errors.push({ name: item.name, error: errorMessage })
          logger.error({ providerId, modelName: item.name, error: insertError }, 'Failed to create model in batch')
        }
      }

      logger.info(
        {
          providerId,
          createdCount: created.length,
          skippedCount: skipped.length,
          errorCount: errors.length,
          userId: req.user!.sub
        },
        'Batch model creation completed'
      )

      res.status(201).json(
        createSuccessResponse({
          created: created.length,
          skipped: skipped.length,
          errors,
          createdIds: created
        })
      )
    } catch (err) {
      next(err)
    }
  }
)

/**
 * 获取可用模型列表
 * GET /models
 */
router.get('/', validate(paginationParamsSchema, 'query'), async (req, res, next) => {
  try {
    // 检查是否为 admin 请求完整数据
    const includeAll = req.query.includeAll === 'true'
    const isAdmin =
      includeAll && Array.isArray(req.user!.permissions.system) && req.user!.permissions.system.includes('settings')

    const whereCondition = isAdmin
      ? eq(models.companyId, req.user!.companyId)
      : and(eq(models.companyId, req.user!.companyId), eq(models.isEnabled, true))

    const modelList = await db.query.models.findMany({
      where: whereCondition,
      orderBy: models.displayName
    })

    // 过滤用户有权限访问的模型
    const companyId = req.user!.companyId
    const accessibleModels = []
    for (const model of modelList) {
      const hasAccess = await checkModelAccess(model.id, req.user!.sub, req.user!.departmentId, req.user!.roleId)
      if (hasAccess) {
        const config = model.config as {
          capabilities?: string[]
          maxTokens?: number
          providerDisplayName?: string
        } | null
        const quota = model.quota as { dailyLimit?: number; monthlyLimit?: number; perUserLimit?: number } | null

        // 查询当前生效定价（走内存缓存），查询失败时不影响模型列表返回
        let pricingResponse:
          | { input_per_million_tokens: number; output_per_million_tokens: number; currencySymbol: string }
          | undefined
        try {
          const pricing = await getEffectivePricing(companyId, model.id)
          pricingResponse = pricing
            ? {
                input_per_million_tokens: pricing.inputPerMillionTokens,
                output_per_million_tokens: pricing.outputPerMillionTokens,
                currencySymbol: pricing.currency === 'USD' ? '$' : '¥'
              }
            : undefined
        } catch (err) {
          logger.error({ err, modelId: model.id }, 'Failed to fetch pricing for model')
        }

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
          enabled: model.isEnabled,
          config: config || {},
          quotaLimit: {
            daily: quota?.dailyLimit,
            monthly: quota?.monthlyLimit,
            perUser: quota?.perUserLimit
          },
          pricing: pricingResponse
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
    const { messages: chatMessages, conversationId, assistantPresetId, stream, config: chatConfig } = req.body
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

    const chatUrl = buildChatCompletionsUrl(apiEndpoint)
    const response = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const error = await response.text()
      logger.error({ modelId, chatUrl, status: response.status, error }, 'Model API error')
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
      let _fullContent = ''

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
                  _fullContent += data.choices[0].delta.content
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
      await recordUsage(req.user!, model, inputTokens, outputTokens, duration, conversationId, assistantPresetId)
    } else {
      // 非流式响应
      const data = (await response.json()) as any

      const duration = Date.now() - startTime
      const inputTokens = data.usage?.prompt_tokens || 0
      const outputTokens = data.usage?.completion_tokens || 0

      await recordUsage(req.user!, model, inputTokens, outputTokens, duration, conversationId, assistantPresetId)

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

    const costCnySql = sql<number>`sum(CASE WHEN ${usageLogs.currency} = 'USD' THEN ${usageLogs.cost} * 7 ELSE ${usageLogs.cost} END)`

    const [dailyStats, monthlyStats, totalStats] = await Promise.all([
      db
        .select({
          messages: sql<number>`count(*)`.mapWith(Number),
          conversations: sql<number>`count(distinct ${usageLogs.conversationId})`.mapWith(Number),
          tokens: sql<number>`sum(total_tokens)`,
          cost: costCnySql
        })
        .from(usageLogs)
        .where(and(eq(usageLogs.modelId, modelId), sql`created_at >= ${today}`)),

      db
        .select({
          messages: sql<number>`count(*)`.mapWith(Number),
          conversations: sql<number>`count(distinct ${usageLogs.conversationId})`.mapWith(Number),
          tokens: sql<number>`sum(total_tokens)`,
          cost: costCnySql
        })
        .from(usageLogs)
        .where(and(eq(usageLogs.modelId, modelId), sql`created_at >= ${monthStart}`)),

      db
        .select({
          messages: sql<number>`count(*)`.mapWith(Number),
          conversations: sql<number>`count(distinct ${usageLogs.conversationId})`.mapWith(Number),
          tokens: sql<number>`sum(total_tokens)`,
          cost: costCnySql
        })
        .from(usageLogs)
        .where(eq(usageLogs.modelId, modelId))
    ])

    res.json(
      createSuccessResponse({
        daily: {
          messages: Number(dailyStats[0].messages || 0),
          conversations: Number(dailyStats[0].conversations || 0),
          tokens: Number(dailyStats[0].tokens || 0),
          cost: Number(dailyStats[0].cost || 0)
        },
        monthly: {
          messages: Number(monthlyStats[0].messages || 0),
          conversations: Number(monthlyStats[0].conversations || 0),
          tokens: Number(monthlyStats[0].tokens || 0),
          cost: Number(monthlyStats[0].cost || 0)
        },
        total: {
          messages: Number(totalStats[0].messages || 0),
          conversations: Number(totalStats[0].conversations || 0),
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

    // 显式映射：只更新请求中实际提供的字段（与 POST 路由风格一致）
    const updateData: Record<string, unknown> = { updatedAt: new Date() }

    if (data.providerId !== undefined) updateData.providerId = data.providerId
    if (data.name !== undefined) updateData.name = data.name
    if (data.displayName !== undefined) updateData.displayName = data.displayName
    if (data.description !== undefined) updateData.description = data.description
    if (data.apiKey !== undefined) updateData.apiKey = encryptApiKey(data.apiKey)
    if (data.apiEndpoint !== undefined) updateData.apiEndpoint = data.apiEndpoint
    if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled
    if (data.config !== undefined) updateData.config = data.config
    if (data.quota !== undefined) updateData.quota = data.quota

    const [updated] = await db.update(models).set(updateData).where(eq(models.id, req.params.id)).returning()

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

/**
 * 设置模型定价
 * PUT /models/:id/pricing
 *
 * 插入新定价记录，同时关闭旧定价记录的 effectiveTo
 */
router.put(
  '/:id/pricing',
  requirePermission('system', 'settings'),
  validate(setPricingSchema),
  async (req, res, next) => {
    try {
      const modelId = req.params.id
      const companyId = req.user!.companyId
      const { inputPerMillionTokens, outputPerMillionTokens, currency, note } = req.body

      // 验证模型存在且属于当前企业
      const model = await db.query.models.findFirst({
        where: and(eq(models.id, modelId), eq(models.companyId, companyId))
      })

      if (!model) {
        throw new NotFoundError('Model')
      }

      const now = new Date()

      // 事务：关闭旧记录 + 插入新记录
      const [newPricing] = await db.transaction(async (tx) => {
        // 关闭当前生效的定价记录
        await tx
          .update(modelPricing)
          .set({ effectiveTo: now })
          .where(
            and(
              eq(modelPricing.companyId, companyId),
              eq(modelPricing.modelId, modelId),
              isNull(modelPricing.effectiveTo)
            )
          )

        // 插入新定价记录
        return tx
          .insert(modelPricing)
          .values({
            companyId,
            modelId,
            inputPerMillionTokens,
            outputPerMillionTokens,
            currency: currency || 'CNY',
            effectiveFrom: now,
            createdBy: req.user!.sub,
            note
          })
          .returning()
      })

      // 清除定价缓存
      invalidatePricingCache(companyId, modelId)

      logger.info({ modelId, pricingId: newPricing.id, updatedBy: req.user!.sub }, 'Model pricing updated')

      res.json(
        createSuccessResponse({
          id: newPricing.id,
          modelId: newPricing.modelId,
          inputPerMillionTokens: newPricing.inputPerMillionTokens,
          outputPerMillionTokens: newPricing.outputPerMillionTokens,
          currency: newPricing.currency,
          effectiveFrom: newPricing.effectiveFrom,
          note: newPricing.note
        })
      )
    } catch (err) {
      next(err)
    }
  }
)

/**
 * 获取模型定价历史
 * GET /models/:id/pricing/history
 */
router.get('/:id/pricing/history', requirePermission('models', 'read'), async (req, res, next) => {
  try {
    const modelId = req.params.id
    const companyId = req.user!.companyId

    // 验证模型存在且属于当前企业
    const model = await db.query.models.findFirst({
      where: and(eq(models.id, modelId), eq(models.companyId, companyId))
    })

    if (!model) {
      throw new NotFoundError('Model')
    }

    const history = await db
      .select({
        id: modelPricing.id,
        inputPerMillionTokens: modelPricing.inputPerMillionTokens,
        outputPerMillionTokens: modelPricing.outputPerMillionTokens,
        currency: modelPricing.currency,
        effectiveFrom: modelPricing.effectiveFrom,
        effectiveTo: modelPricing.effectiveTo,
        createdBy: modelPricing.createdBy,
        createdByName: users.name,
        createdAt: modelPricing.createdAt,
        note: modelPricing.note
      })
      .from(modelPricing)
      .leftJoin(users, eq(modelPricing.createdBy, users.id))
      .where(and(eq(modelPricing.companyId, companyId), eq(modelPricing.modelId, modelId)))
      .orderBy(desc(modelPricing.effectiveFrom))

    res.json(createSuccessResponse(history))
  } catch (err) {
    next(err)
  }
})

// 辅助函数

/**
 * 获取供应商默认端点
 * 使用 enterprise-shared 中的 PROVIDER_DEFAULT_ENDPOINTS 映射表
 */
function getDefaultEndpoint(providerId: string): string {
  return getProviderDefaultEndpoint(providerId)
}

// ============ 定价缓存 ============

interface CachedPricing {
  inputPerMillionTokens: number
  outputPerMillionTokens: number
  currency: string
  expiresAt: number
}

const PRICING_CACHE_TTL_MS = 5 * 60 * 1000 // 5 分钟
const pricingCache = new Map<string, CachedPricing>()

function buildPricingCacheKey(companyId: string, modelId: string): string {
  return `${companyId}:${modelId}`
}

export function invalidatePricingCache(companyId: string, modelId: string): void {
  pricingCache.delete(buildPricingCacheKey(companyId, modelId))
}

async function getEffectivePricing(
  companyId: string,
  modelId: string
): Promise<{ inputPerMillionTokens: number; outputPerMillionTokens: number; currency: string } | null> {
  const cacheKey = buildPricingCacheKey(companyId, modelId)
  const cached = pricingCache.get(cacheKey)

  if (cached && cached.expiresAt > Date.now()) {
    return {
      inputPerMillionTokens: cached.inputPerMillionTokens,
      outputPerMillionTokens: cached.outputPerMillionTokens,
      currency: cached.currency
    }
  }

  const now = new Date()
  const rows = await db
    .select()
    .from(modelPricing)
    .where(
      and(
        eq(modelPricing.companyId, companyId),
        eq(modelPricing.modelId, modelId),
        lte(modelPricing.effectiveFrom, now),
        or(isNull(modelPricing.effectiveTo), gt(modelPricing.effectiveTo, now))
      )
    )
    .orderBy(desc(modelPricing.effectiveFrom))
    .limit(1)

  const pricing = rows[0]
  if (!pricing) {
    return null
  }

  pricingCache.set(cacheKey, {
    inputPerMillionTokens: pricing.inputPerMillionTokens,
    outputPerMillionTokens: pricing.outputPerMillionTokens,
    currency: pricing.currency,
    expiresAt: Date.now() + PRICING_CACHE_TTL_MS
  })

  return {
    inputPerMillionTokens: pricing.inputPerMillionTokens,
    outputPerMillionTokens: pricing.outputPerMillionTokens,
    currency: pricing.currency
  }
}

// ============ 用量记录 ============

async function recordUsage(
  user: any,
  model: any,
  inputTokens: number,
  outputTokens: number,
  duration: number,
  conversationId?: string,
  assistantPresetId?: string
): Promise<void> {
  try {
    // 从定价表查询当前生效定价
    const pricing = await getEffectivePricing(user.companyId, model.id)

    // 计算费用：有定价则按定价计算，无定价记为 0
    const cost = pricing
      ? (inputTokens * pricing.inputPerMillionTokens + outputTokens * pricing.outputPerMillionTokens) / 1_000_000
      : 0

    const currency = pricing?.currency ?? 'CNY'

    await db.insert(usageLogs).values({
      companyId: user.companyId,
      userId: user.sub,
      modelId: model.id,
      conversationId,
      assistantPresetId,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      cost,
      currency,
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
