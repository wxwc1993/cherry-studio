import { createSuccessResponse, type DefaultModelsConfig } from '@cherry-studio/enterprise-shared'
import { and, eq } from 'drizzle-orm'
import { Router } from 'express'

import { authenticate } from '../middleware/auth'
import { companies, db, models } from '../models'
import { createLogger } from '../utils/logger'

const router = Router()
const logger = createLogger('ClientSettingsRoutes')

/**
 * 查询模型详情，返回客户端所需的模型信息
 * 如果模型不存在或已禁用则返回 null
 */
async function resolveModelRef(companyId: string, modelId: string) {
  try {
    const model = await db.query.models.findFirst({
      where: and(eq(models.id, modelId), eq(models.companyId, companyId), eq(models.isEnabled, true))
    })

    if (!model) {
      return null
    }

    const config = (model.config ?? {}) as Record<string, unknown>
    const capabilities = (config.capabilities as string[] | undefined) ?? []

    return {
      id: model.id,
      name: model.name,
      provider: model.providerId,
      providerId: model.providerId,
      displayName: model.displayName,
      description: model.description ?? undefined,
      capabilities,
      enabled: model.isEnabled
    }
  } catch (error) {
    logger.error({ modelId, error }, 'Failed to resolve model ref')
    return null
  }
}

/**
 * 获取客户端设置（普通用户可访问）
 * GET /settings/client
 *
 * 仅返回 defaultModels 配置，不暴露其他 admin settings
 */
router.get('/client', authenticate, async (req, res, next) => {
  try {
    const company = await db.query.companies.findFirst({
      where: eq(companies.id, req.user!.companyId)
    })

    if (!company) {
      res.json(
        createSuccessResponse({
          defaultModels: {
            defaultAssistantModel: null,
            quickModel: null,
            translateModel: null
          }
        })
      )
      return
    }

    const settings = (company.settings ?? {}) as Record<string, unknown>
    const defaultModels = (settings.defaultModels ?? {}) as DefaultModelsConfig

    const [defaultAssistantModel, quickModel, translateModel] = await Promise.all([
      defaultModels.defaultAssistantModel
        ? resolveModelRef(req.user!.companyId, defaultModels.defaultAssistantModel.modelId)
        : Promise.resolve(null),
      defaultModels.quickModel
        ? resolveModelRef(req.user!.companyId, defaultModels.quickModel.modelId)
        : Promise.resolve(null),
      defaultModels.translateModel
        ? resolveModelRef(req.user!.companyId, defaultModels.translateModel.modelId)
        : Promise.resolve(null)
    ])

    res.json(
      createSuccessResponse({
        defaultModels: {
          defaultAssistantModel,
          quickModel,
          translateModel
        }
      })
    )
  } catch (err) {
    next(err)
  }
})

export default router
