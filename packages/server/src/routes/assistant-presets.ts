import {
  assistantPresetQuerySchema,
  assistantPresetTagQuerySchema,
  createAssistantPresetSchema,
  createAssistantPresetTagSchema,
  createSuccessResponse,
  ERROR_CODES,
  generatePromptSchema,
  seedAssistantPresetsSchema,
  updateAssistantPresetSchema,
  updateAssistantPresetTagSchema
} from '@cherry-studio/enterprise-shared'
import { and, eq, gte, ilike, or, sql } from 'drizzle-orm'
import { Router } from 'express'
import { readFile } from 'fs/promises'
import { resolve } from 'path'

import { authenticate, requirePermission } from '../middleware/auth'
import { AppError, ConflictError, NotFoundError } from '../middleware/errorHandler'
import { validate } from '../middleware/validate'
import { assistantPresets, assistantPresetTagRelations_table, assistantPresetTags, db, usageLogs } from '../models'
import { createLogger } from '../utils/logger'

const router = Router()
const logger = createLogger('AssistantPresetRoutes')

router.use(authenticate)

// ============ 标签管理 API ============

/**
 * 获取标签列表
 * GET /assistant-presets/tags
 */
router.get(
  '/tags',
  requirePermission('assistantPresets', 'read'),
  validate(assistantPresetTagQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const { locale } = req.query as { locale?: string }
      const companyId = req.user!.companyId

      const conditions = [eq(assistantPresetTags.companyId, companyId)]
      if (locale) {
        conditions.push(eq(assistantPresetTags.locale, locale))
      }

      const tags = await db.query.assistantPresetTags.findMany({
        where: and(...conditions),
        orderBy: assistantPresetTags.order,
        with: {
          presetRelations: true
        }
      })

      const tagsWithCount = tags.map((tag) => ({
        id: tag.id,
        companyId: tag.companyId,
        name: tag.name,
        locale: tag.locale,
        order: tag.order,
        presetCount: tag.presetRelations.length,
        createdAt: tag.createdAt,
        updatedAt: tag.updatedAt
      }))

      res.json(createSuccessResponse(tagsWithCount))
    } catch (err) {
      next(err)
    }
  }
)

/**
 * 创建标签
 * POST /assistant-presets/tags
 */
router.post(
  '/tags',
  requirePermission('assistantPresets', 'write'),
  validate(createAssistantPresetTagSchema),
  async (req, res, next) => {
    try {
      const { name, locale, order } = req.body
      const companyId = req.user!.companyId

      // 检查同公司同语言下是否已存在同名标签
      const existing = await db.query.assistantPresetTags.findFirst({
        where: and(
          eq(assistantPresetTags.companyId, companyId),
          eq(assistantPresetTags.name, name),
          eq(assistantPresetTags.locale, locale)
        )
      })

      if (existing) {
        throw new ConflictError(`Tag "${name}" already exists for locale "${locale}"`)
      }

      const [newTag] = await db
        .insert(assistantPresetTags)
        .values({
          companyId,
          name,
          locale,
          order: order ?? 0
        })
        .returning()

      logger.info({ tagId: newTag.id, createdBy: req.user!.sub }, 'Assistant preset tag created')

      res.status(201).json(createSuccessResponse(newTag))
    } catch (err) {
      next(err)
    }
  }
)

/**
 * 更新标签
 * PATCH /assistant-presets/tags/:id
 */
router.patch(
  '/tags/:id',
  requirePermission('assistantPresets', 'write'),
  validate(updateAssistantPresetTagSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params
      const companyId = req.user!.companyId

      const existing = await db.query.assistantPresetTags.findFirst({
        where: and(eq(assistantPresetTags.id, id), eq(assistantPresetTags.companyId, companyId))
      })

      if (!existing) {
        throw new NotFoundError('Tag')
      }

      // 如果更新了名称，检查是否与同语言下其他标签冲突
      const updateData = req.body
      if (updateData.name) {
        const targetLocale = updateData.locale ?? existing.locale
        const conflict = await db.query.assistantPresetTags.findFirst({
          where: and(
            eq(assistantPresetTags.companyId, companyId),
            eq(assistantPresetTags.name, updateData.name),
            eq(assistantPresetTags.locale, targetLocale),
            sql`${assistantPresetTags.id} != ${id}`
          )
        })

        if (conflict) {
          throw new ConflictError(`Tag "${updateData.name}" already exists for locale "${targetLocale}"`)
        }
      }

      const [updated] = await db
        .update(assistantPresetTags)
        .set({
          ...updateData,
          updatedAt: new Date()
        })
        .where(eq(assistantPresetTags.id, id))
        .returning()

      logger.info({ tagId: id, updatedBy: req.user!.sub }, 'Assistant preset tag updated')

      res.json(createSuccessResponse(updated))
    } catch (err) {
      next(err)
    }
  }
)

/**
 * 删除标签
 * DELETE /assistant-presets/tags/:id
 */
router.delete('/tags/:id', requirePermission('assistantPresets', 'admin'), async (req, res, next) => {
  try {
    const { id } = req.params
    const companyId = req.user!.companyId

    const existing = await db.query.assistantPresetTags.findFirst({
      where: and(eq(assistantPresetTags.id, id), eq(assistantPresetTags.companyId, companyId))
    })

    if (!existing) {
      throw new NotFoundError('Tag')
    }

    // 级联删除会自动处理关联表记录
    await db.delete(assistantPresetTags).where(eq(assistantPresetTags.id, id))

    logger.info({ tagId: id, deletedBy: req.user!.sub }, 'Assistant preset tag deleted')

    res.json(createSuccessResponse({ message: 'Tag deleted successfully' }))
  } catch (err) {
    next(err)
  }
})

// ============ 客户端专用 API（静态路径，必须在 /:id 之前） ============

/**
 * 客户端获取所有启用的预设（含标签）
 * GET /assistant-presets/client
 * 企业用户即可访问（无需额外权限检查，authenticate 已保证）
 */
router.get('/client', async (req, res, next) => {
  try {
    const companyId = req.user!.companyId
    const locale = req.query.locale as string | undefined

    const tagConditions = [eq(assistantPresetTags.companyId, companyId)]
    if (locale) {
      tagConditions.push(eq(assistantPresetTags.locale, locale))
    }

    const presetConditions = [eq(assistantPresets.companyId, companyId), eq(assistantPresets.isEnabled, true)]
    if (locale) {
      presetConditions.push(eq(assistantPresets.locale, locale))
    }

    // 计算热度的时间范围
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [tags, presets, usageCounts30d, usageCounts7d] = await Promise.all([
      db.query.assistantPresetTags.findMany({
        where: and(...tagConditions),
        orderBy: assistantPresetTags.order
      }),
      db.query.assistantPresets.findMany({
        where: and(...presetConditions),
        orderBy: [assistantPresets.order, assistantPresets.name],
        with: {
          tagRelations: {
            with: {
              tag: true
            }
          }
        }
      }),
      // 最近 30 天使用次数
      db
        .select({
          presetId: usageLogs.assistantPresetId,
          count: sql<number>`count(*)`
        })
        .from(usageLogs)
        .where(
          and(
            eq(usageLogs.companyId, companyId),
            gte(usageLogs.createdAt, thirtyDaysAgo),
            sql`${usageLogs.assistantPresetId} IS NOT NULL`
          )
        )
        .groupBy(usageLogs.assistantPresetId),
      // 最近 7 天使用次数（用于加权）
      db
        .select({
          presetId: usageLogs.assistantPresetId,
          count: sql<number>`count(*)`
        })
        .from(usageLogs)
        .where(
          and(
            eq(usageLogs.companyId, companyId),
            gte(usageLogs.createdAt, sevenDaysAgo),
            sql`${usageLogs.assistantPresetId} IS NOT NULL`
          )
        )
        .groupBy(usageLogs.assistantPresetId)
    ])

    // 构建使用次数映射
    const usage30dMap = new Map(usageCounts30d.map((u) => [u.presetId, Number(u.count)]))
    const usage7dMap = new Map(usageCounts7d.map((u) => [u.presetId, Number(u.count)]))

    const presetsWithTags = presets.map((preset) => {
      const count30d = usage30dMap.get(preset.id) || 0
      const count7d = usage7dMap.get(preset.id) || 0
      // 热度算法：30天基础分 + 7天近期加权（近期权重 2x）
      const hotScore = count30d + count7d * 2

      return {
        id: preset.id,
        companyId: preset.companyId,
        name: preset.name,
        emoji: preset.emoji,
        description: preset.description,
        prompt: preset.prompt,
        locale: preset.locale,
        isEnabled: preset.isEnabled,
        order: preset.order,
        tags: preset.tagRelations.map((r) => r.tag),
        usageCount: count30d,
        hotScore,
        createdAt: preset.createdAt,
        updatedAt: preset.updatedAt
      }
    })

    res.json(
      createSuccessResponse({
        tags,
        presets: presetsWithTags
      })
    )
  } catch (err) {
    next(err)
  }
})

// ============ 批量导入 API（静态路径，必须在 /:id 之前） ============

interface AgentJsonItem {
  id: string
  name: string
  description?: string
  emoji?: string
  group: string[]
  prompt: string
}

/**
 * 批量导入初始数据（从 JSON 文件）
 * POST /assistant-presets/seed
 */
router.post(
  '/seed',
  requirePermission('assistantPresets', 'admin'),
  validate(seedAssistantPresetsSchema),
  async (req, res, next) => {
    try {
      const { overwrite } = req.body
      const companyId = req.user!.companyId

      // 读取 JSON 数据文件
      const zhFilePath = resolve(process.cwd(), 'resources/data/agents-zh.json')
      const enFilePath = resolve(process.cwd(), 'resources/data/agents-en.json')

      let zhAgents: AgentJsonItem[] = []
      let enAgents: AgentJsonItem[] = []

      try {
        const zhData = await readFile(zhFilePath, 'utf-8')
        zhAgents = JSON.parse(zhData) as AgentJsonItem[]
      } catch (err) {
        logger.warn({ err }, 'Failed to read agents-zh.json')
      }

      try {
        const enData = await readFile(enFilePath, 'utf-8')
        enAgents = JSON.parse(enData) as AgentJsonItem[]
      } catch (err) {
        logger.warn({ err }, 'Failed to read agents-en.json')
      }

      if (zhAgents.length === 0 && enAgents.length === 0) {
        throw new AppError(ERROR_CODES.INTERNAL_ERROR, 'No agent data files found', 500)
      }

      // 如果 overwrite 模式，先删除已有数据
      if (overwrite) {
        await db.delete(assistantPresets).where(eq(assistantPresets.companyId, companyId))
        await db.delete(assistantPresetTags).where(eq(assistantPresetTags.companyId, companyId))
      }

      let totalTags = 0
      let totalPresets = 0

      // 处理中文数据
      const zhResult = await seedAgentsForLocale(companyId, zhAgents, 'zh-CN')
      totalTags += zhResult.tagCount
      totalPresets += zhResult.presetCount

      // 处理英文数据
      const enResult = await seedAgentsForLocale(companyId, enAgents, 'en-US')
      totalTags += enResult.tagCount
      totalPresets += enResult.presetCount

      logger.info({ companyId, totalTags, totalPresets, seededBy: req.user!.sub }, 'Assistant presets seeded')

      res.json(
        createSuccessResponse({
          message: 'Seed completed successfully',
          totalTags,
          totalPresets
        })
      )
    } catch (err) {
      next(err)
    }
  }
)

// ============ AI 提示词生成 API（静态路径，必须在 /:id 之前） ============

/**
 * AI 生成提示词
 * POST /assistant-presets/generate-prompt
 */
router.post(
  '/generate-prompt',
  requirePermission('assistantPresets', 'write'),
  validate(generatePromptSchema),
  async (req, res, next) => {
    try {
      const { content } = req.body

      // TODO: 集成实际的 AI 模型调用
      // 目前返回一个模板化的提示词
      const generatedPrompt = generateTemplatePrompt(content)

      res.json(createSuccessResponse({ prompt: generatedPrompt }))
    } catch (err) {
      next(err)
    }
  }
)

// ============ 预设管理 API ============

/**
 * 获取预设列表（管理端分页）
 * GET /assistant-presets
 */
router.get(
  '/',
  requirePermission('assistantPresets', 'read'),
  validate(assistantPresetQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const { page, pageSize, locale, tagId, search, isEnabled } = req.query as {
        page: number
        pageSize: number
        locale?: string
        tagId?: string
        search?: string
        isEnabled?: string
      }
      const companyId = req.user!.companyId

      // 构建查询条件
      const conditions = [eq(assistantPresets.companyId, companyId)]

      if (locale) {
        conditions.push(eq(assistantPresets.locale, locale))
      }

      if (isEnabled !== undefined) {
        conditions.push(eq(assistantPresets.isEnabled, isEnabled === 'true'))
      }

      if (search) {
        conditions.push(
          or(ilike(assistantPresets.name, `%${search}%`), ilike(assistantPresets.description, `%${search}%`))!
        )
      }

      // 如果按标签过滤，先查出该标签关联的预设 ID
      let presetIdFilter: string[] | undefined
      if (tagId) {
        const tagRelations = await db.query.assistantPresetTagRelations_table.findMany({
          where: eq(assistantPresetTagRelations_table.tagId, tagId)
        })
        presetIdFilter = tagRelations.map((r) => r.presetId)

        if (presetIdFilter.length === 0) {
          res.json(
            createSuccessResponse([], {
              page,
              pageSize,
              total: 0,
              totalPages: 0
            })
          )
          return
        }
      }

      // 构建最终条件（含标签过滤）
      const finalConditions = presetIdFilter
        ? [
            ...conditions,
            sql`${assistantPresets.id} IN (${sql.join(
              presetIdFilter.map((id) => sql`${id}`),
              sql`, `
            )})`
          ]
        : conditions

      // 获取总数
      const [{ count: total }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(assistantPresets)
        .where(and(...finalConditions))

      const totalPages = Math.ceil(Number(total) / pageSize)
      const offset = (page - 1) * pageSize

      // 获取分页数据
      const presets = await db.query.assistantPresets.findMany({
        where: and(...finalConditions),
        orderBy: [assistantPresets.order, assistantPresets.createdAt],
        limit: pageSize,
        offset,
        with: {
          tagRelations: {
            with: {
              tag: true
            }
          }
        }
      })

      const presetsWithTags = presets.map((preset) => ({
        id: preset.id,
        companyId: preset.companyId,
        name: preset.name,
        emoji: preset.emoji,
        description: preset.description,
        prompt: preset.prompt,
        locale: preset.locale,
        isEnabled: preset.isEnabled,
        order: preset.order,
        tags: preset.tagRelations.map((r) => r.tag),
        createdAt: preset.createdAt,
        updatedAt: preset.updatedAt
      }))

      res.json(
        createSuccessResponse(presetsWithTags, {
          page,
          pageSize,
          total: Number(total),
          totalPages
        })
      )
    } catch (err) {
      next(err)
    }
  }
)

/**
 * 获取单个预设详情
 * GET /assistant-presets/:id
 */
router.get('/:id', requirePermission('assistantPresets', 'read'), async (req, res, next) => {
  try {
    const { id } = req.params
    const companyId = req.user!.companyId

    const preset = await db.query.assistantPresets.findFirst({
      where: and(eq(assistantPresets.id, id), eq(assistantPresets.companyId, companyId)),
      with: {
        tagRelations: {
          with: {
            tag: true
          }
        }
      }
    })

    if (!preset) {
      throw new NotFoundError('Preset')
    }

    res.json(
      createSuccessResponse({
        ...preset,
        tags: preset.tagRelations.map((r) => r.tag)
      })
    )
  } catch (err) {
    next(err)
  }
})

/**
 * 创建预设
 * POST /assistant-presets
 */
router.post(
  '/',
  requirePermission('assistantPresets', 'write'),
  validate(createAssistantPresetSchema),
  async (req, res, next) => {
    try {
      const { tagIds, ...presetData } = req.body
      const companyId = req.user!.companyId

      const [newPreset] = await db
        .insert(assistantPresets)
        .values({
          companyId,
          name: presetData.name,
          emoji: presetData.emoji,
          description: presetData.description,
          prompt: presetData.prompt,
          locale: presetData.locale,
          isEnabled: presetData.isEnabled ?? true,
          order: presetData.order ?? 0
        })
        .returning()

      // 建立标签关联
      if (tagIds && tagIds.length > 0) {
        await db.insert(assistantPresetTagRelations_table).values(
          tagIds.map((tagId: string) => ({
            presetId: newPreset.id,
            tagId
          }))
        )
      }

      logger.info({ presetId: newPreset.id, createdBy: req.user!.sub }, 'Assistant preset created')

      // 重新查询包含标签信息
      const result = await db.query.assistantPresets.findFirst({
        where: eq(assistantPresets.id, newPreset.id),
        with: {
          tagRelations: {
            with: {
              tag: true
            }
          }
        }
      })

      res.status(201).json(
        createSuccessResponse({
          ...result,
          tags: result?.tagRelations.map((r) => r.tag) ?? []
        })
      )
    } catch (err) {
      next(err)
    }
  }
)

/**
 * 更新预设
 * PATCH /assistant-presets/:id
 */
router.patch(
  '/:id',
  requirePermission('assistantPresets', 'write'),
  validate(updateAssistantPresetSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params
      const companyId = req.user!.companyId
      const { tagIds, ...updateData } = req.body

      const existing = await db.query.assistantPresets.findFirst({
        where: and(eq(assistantPresets.id, id), eq(assistantPresets.companyId, companyId))
      })

      if (!existing) {
        throw new NotFoundError('Preset')
      }

      // 更新预设基本信息
      await db
        .update(assistantPresets)
        .set({
          ...updateData,
          updatedAt: new Date()
        })
        .where(eq(assistantPresets.id, id))

      // 如果提供了标签列表，重建关联
      if (tagIds !== undefined) {
        await db.delete(assistantPresetTagRelations_table).where(eq(assistantPresetTagRelations_table.presetId, id))

        if (tagIds.length > 0) {
          await db.insert(assistantPresetTagRelations_table).values(
            tagIds.map((tagId: string) => ({
              presetId: id,
              tagId
            }))
          )
        }
      }

      logger.info({ presetId: id, updatedBy: req.user!.sub }, 'Assistant preset updated')

      // 重新查询包含标签信息
      const result = await db.query.assistantPresets.findFirst({
        where: eq(assistantPresets.id, id),
        with: {
          tagRelations: {
            with: {
              tag: true
            }
          }
        }
      })

      res.json(
        createSuccessResponse({
          ...result,
          tags: result?.tagRelations.map((r) => r.tag) ?? []
        })
      )
    } catch (err) {
      next(err)
    }
  }
)

/**
 * 删除预设
 * DELETE /assistant-presets/:id
 */
router.delete('/:id', requirePermission('assistantPresets', 'admin'), async (req, res, next) => {
  try {
    const { id } = req.params
    const companyId = req.user!.companyId

    const existing = await db.query.assistantPresets.findFirst({
      where: and(eq(assistantPresets.id, id), eq(assistantPresets.companyId, companyId))
    })

    if (!existing) {
      throw new NotFoundError('Preset')
    }

    // 级联删除会自动处理关联表记录
    await db.delete(assistantPresets).where(eq(assistantPresets.id, id))

    logger.info({ presetId: id, deletedBy: req.user!.sub }, 'Assistant preset deleted')

    res.json(createSuccessResponse({ message: 'Preset deleted successfully' }))
  } catch (err) {
    next(err)
  }
})

// ============ 辅助函数 ============

/**
 * 为指定语言导入预设数据
 */
async function seedAgentsForLocale(
  companyId: string,
  agents: AgentJsonItem[],
  locale: string
): Promise<{ tagCount: number; presetCount: number }> {
  if (agents.length === 0) {
    return { tagCount: 0, presetCount: 0 }
  }

  // 1. 收集所有标签（去重）
  const allGroups = new Set<string>()
  for (const agent of agents) {
    if (agent.group) {
      for (const g of agent.group) {
        allGroups.add(g)
      }
    }
  }

  // 2. 创建标签（跳过已存在的）
  const tagMap = new Map<string, string>() // name -> id
  let tagCount = 0

  const existingTags = await db.query.assistantPresetTags.findMany({
    where: and(eq(assistantPresetTags.companyId, companyId), eq(assistantPresetTags.locale, locale))
  })

  for (const tag of existingTags) {
    tagMap.set(tag.name, tag.id)
  }

  let orderIndex = existingTags.length
  for (const groupName of allGroups) {
    if (!tagMap.has(groupName)) {
      const [newTag] = await db
        .insert(assistantPresetTags)
        .values({
          companyId,
          name: groupName,
          locale,
          order: orderIndex++
        })
        .returning()
      tagMap.set(groupName, newTag.id)
      tagCount++
    }
  }

  // 3. 创建预设并关联标签
  let presetCount = 0
  for (const agent of agents) {
    // 检查是否已存在（按名称+语言+公司判断）
    const existingPreset = await db.query.assistantPresets.findFirst({
      where: and(
        eq(assistantPresets.companyId, companyId),
        eq(assistantPresets.name, agent.name),
        eq(assistantPresets.locale, locale)
      )
    })

    if (existingPreset) {
      continue // 跳过已存在的预设
    }

    const [newPreset] = await db
      .insert(assistantPresets)
      .values({
        companyId,
        name: agent.name,
        emoji: agent.emoji?.trim() || undefined,
        description: agent.description,
        prompt: agent.prompt,
        locale,
        isEnabled: true,
        order: presetCount
      })
      .returning()

    // 建立标签关联
    if (agent.group && agent.group.length > 0) {
      const tagRelationValues = agent.group
        .map((groupName) => {
          const tagId = tagMap.get(groupName)
          if (!tagId) return undefined
          return { presetId: newPreset.id, tagId }
        })
        .filter((v): v is { presetId: string; tagId: string } => v !== undefined)

      if (tagRelationValues.length > 0) {
        await db.insert(assistantPresetTagRelations_table).values(tagRelationValues)
      }
    }

    presetCount++
  }

  return { tagCount, presetCount }
}

/**
 * 生成模板化提示词（AI 集成前的临时实现）
 */
function generateTemplatePrompt(content: string): string {
  return `你是一个专业的${content}助手。请遵循以下原则：

## 角色定义
你是一位经验丰富的${content}专家，具备深厚的专业知识和实践经验。

## 核心能力
- 深入理解${content}相关的概念和最佳实践
- 能够提供清晰、准确、有建设性的建议
- 善于分析问题并给出系统性的解决方案

## 回答要求
1. **专业性**：基于专业知识提供准确的信息
2. **结构化**：使用清晰的结构组织回答内容
3. **实用性**：提供可直接应用的建议和方案
4. **简洁性**：避免冗长，直击要点

## 注意事项
- 如果用户的问题超出你的专业范围，请诚实告知
- 在提供建议时，考虑不同情况和场景
- 鼓励用户提出后续问题以深入探讨`
}

export default router
