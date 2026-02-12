import type {
  AdminPresentationQueryInput,
  CreatePageInput,
  CreatePresentationInput,
  PresentationQueryInput,
  ReorderPagesInput,
  UpdatePageInput,
  UpdatePresentationInput,
  UpdatePresentationSettingsInput
} from '@cherry-studio/enterprise-shared'
import { and, asc, count, desc, eq, gte, ilike, lte, sql } from 'drizzle-orm'

/**
 * 转义 SQL LIKE 通配符，防止用户输入 % 或 _ 导致模式注入
 */
function escapeLikePattern(input: string): string {
  return input.replace(/%/g, '\\%').replace(/_/g, '\\_')
}

import {
  db,
  presentationImageVersions,
  presentationPages,
  presentations,
  presentationSettings,
  presentationTasks
} from '../models'
import { createLogger } from '../utils/logger'
import { presentationFileService } from './presentation-file.service'

const logger = createLogger('PresentationService')

// ============ 演示文稿 CRUD ============

/**
 * 创建演示文稿
 */
async function createPresentation(companyId: string, userId: string, input: CreatePresentationInput) {
  const [record] = await db
    .insert(presentations)
    .values({
      companyId,
      userId,
      title: input.title,
      creationType: input.creationType,
      config: input.config ?? {},
      sourceContent: input.sourceContent ?? null
    })
    .returning()

  logger.info({ presentationId: record.id, companyId, userId }, 'Presentation created')

  return record
}

/**
 * 获取演示文稿列表（用户维度，带分页/搜索/排序）
 */
async function listPresentations(companyId: string, userId: string, query: PresentationQueryInput) {
  const { page, pageSize, status, search, sortBy, sortOrder } = query
  const offset = (page - 1) * pageSize

  const conditions = [eq(presentations.companyId, companyId), eq(presentations.userId, userId)]

  if (status) {
    conditions.push(eq(presentations.status, status))
  }
  if (search) {
    conditions.push(ilike(presentations.title, `%${escapeLikePattern(search)}%`))
  }

  const orderColumn =
    sortBy === 'title'
      ? presentations.title
      : sortBy === 'createdAt'
        ? presentations.createdAt
        : presentations.updatedAt
  const orderDirection = sortOrder === 'asc' ? asc(orderColumn) : desc(orderColumn)

  const [items, totalResult] = await Promise.all([
    db.query.presentations.findMany({
      where: and(...conditions),
      orderBy: orderDirection,
      limit: pageSize,
      offset,
      with: {
        pages: {
          columns: { generatedImageKey: true },
          orderBy: asc(presentationPages.orderIndex),
          limit: 1
        }
      }
    }),
    db
      .select({ total: count() })
      .from(presentations)
      .where(and(...conditions))
  ])

  const total = totalResult[0]?.total ?? 0

  const list = items.map((item) => ({
    ...item,
    previewImageKey: item.pages[0]?.generatedImageKey ?? null,
    pages: undefined
  }))

  return { list, total, page, pageSize }
}

/**
 * 获取演示文稿详情（包含所有页面）
 */
async function getPresentationById(presentationId: string, companyId: string) {
  const record = await db.query.presentations.findFirst({
    where: and(eq(presentations.id, presentationId), eq(presentations.companyId, companyId)),
    with: {
      pages: {
        orderBy: asc(presentationPages.orderIndex),
        with: {
          imageVersions: {
            where: eq(presentationImageVersions.isCurrent, true),
            limit: 1
          }
        }
      }
    }
  })

  return record ?? null
}

/**
 * 更新演示文稿
 */
async function updatePresentation(
  presentationId: string,
  companyId: string,
  userId: string,
  input: UpdatePresentationInput
) {
  const existing = await db.query.presentations.findFirst({
    where: and(
      eq(presentations.id, presentationId),
      eq(presentations.companyId, companyId),
      eq(presentations.userId, userId)
    )
  })

  if (!existing) {
    return null
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() }

  if (input.title !== undefined) {
    updateData.title = input.title
  }
  if (input.sourceContent !== undefined) {
    updateData.sourceContent = input.sourceContent
  }
  if (input.config !== undefined) {
    updateData.config = { ...(existing.config as Record<string, unknown>), ...input.config }
  }

  const [updated] = await db
    .update(presentations)
    .set(updateData)
    .where(eq(presentations.id, presentationId))
    .returning()

  logger.info({ presentationId, companyId }, 'Presentation updated')

  return updated
}

/**
 * 删除演示文稿（含关联文件清理）
 */
async function deletePresentation(presentationId: string, companyId: string, userId: string) {
  const existing = await db.query.presentations.findFirst({
    where: and(
      eq(presentations.id, presentationId),
      eq(presentations.companyId, companyId),
      eq(presentations.userId, userId)
    )
  })

  if (!existing) {
    return false
  }

  // 清理 OSS 存储文件（images + exports）
  try {
    await presentationFileService.deleteFilesByPrefix(companyId, presentationId)
  } catch (err) {
    logger.warn({ presentationId, err }, 'Failed to cleanup storage files during deletion')
  }

  // 级联删除（pages, tasks, materials, referenceFiles 都设置了 onDelete: cascade）
  await db.delete(presentations).where(eq(presentations.id, presentationId))

  logger.info({ presentationId, companyId, userId }, 'Presentation deleted')

  return true
}

/**
 * 更新演示文稿状态
 */
async function updatePresentationStatus(presentationId: string, companyId: string, status: string) {
  const [updated] = await db
    .update(presentations)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(presentations.id, presentationId), eq(presentations.companyId, companyId)))
    .returning()

  if (updated) {
    logger.info({ presentationId, status }, 'Presentation status updated')
  }

  return updated ?? null
}

// ============ 页面管理 ============

/**
 * 获取演示文稿的所有页面
 */
async function getPages(presentationId: string, companyId: string) {
  // 先验证演示文稿存在且属于该公司
  const pres = await db.query.presentations.findFirst({
    where: and(eq(presentations.id, presentationId), eq(presentations.companyId, companyId)),
    columns: { id: true }
  })

  if (!pres) {
    return null
  }

  return db.query.presentationPages.findMany({
    where: eq(presentationPages.presentationId, presentationId),
    orderBy: asc(presentationPages.orderIndex),
    with: {
      imageVersions: {
        where: eq(presentationImageVersions.isCurrent, true),
        limit: 1
      }
    }
  })
}

/**
 * 创建页面
 */
async function createPage(presentationId: string, companyId: string, input: CreatePageInput) {
  const pres = await db.query.presentations.findFirst({
    where: and(eq(presentations.id, presentationId), eq(presentations.companyId, companyId)),
    columns: { id: true, pageCount: true }
  })

  if (!pres) {
    return null
  }

  const [page] = await db
    .insert(presentationPages)
    .values({
      presentationId,
      orderIndex: input.orderIndex,
      outlineContent: input.outlineContent,
      descriptionContent: input.descriptionContent ?? null
    })
    .returning()

  // 更新页面计数
  await db
    .update(presentations)
    .set({
      pageCount: sql`${presentations.pageCount} + 1`,
      updatedAt: new Date()
    })
    .where(eq(presentations.id, presentationId))

  logger.info({ pageId: page.id, presentationId }, 'Page created')

  return page
}

/**
 * 更新页面
 */
async function updatePage(pageId: string, presentationId: string, companyId: string, input: UpdatePageInput) {
  // 验证归属关系
  const pres = await db.query.presentations.findFirst({
    where: and(eq(presentations.id, presentationId), eq(presentations.companyId, companyId)),
    columns: { id: true }
  })

  if (!pres) {
    return null
  }

  const existing = await db.query.presentationPages.findFirst({
    where: and(eq(presentationPages.id, pageId), eq(presentationPages.presentationId, presentationId))
  })

  if (!existing) {
    return null
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() }

  if (input.orderIndex !== undefined) {
    updateData.orderIndex = input.orderIndex
  }
  if (input.outlineContent !== undefined) {
    updateData.outlineContent = input.outlineContent
  }
  if (input.descriptionContent !== undefined) {
    updateData.descriptionContent = input.descriptionContent
  }

  const [updated] = await db
    .update(presentationPages)
    .set(updateData)
    .where(eq(presentationPages.id, pageId))
    .returning()

  // 更新父演示文稿的 updatedAt
  await db.update(presentations).set({ updatedAt: new Date() }).where(eq(presentations.id, presentationId))

  logger.info({ pageId, presentationId }, 'Page updated')

  return updated
}

/**
 * 删除页面
 */
async function deletePage(pageId: string, presentationId: string, companyId: string) {
  const pres = await db.query.presentations.findFirst({
    where: and(eq(presentations.id, presentationId), eq(presentations.companyId, companyId)),
    columns: { id: true }
  })

  if (!pres) {
    return false
  }

  const existing = await db.query.presentationPages.findFirst({
    where: and(eq(presentationPages.id, pageId), eq(presentationPages.presentationId, presentationId))
  })

  if (!existing) {
    return false
  }

  // 删除关联的 AI 生成图像
  if (existing.generatedImageKey) {
    try {
      await presentationFileService.deleteGeneratedImage(existing.generatedImageKey)
    } catch (err) {
      logger.warn({ pageId, err }, 'Failed to delete page generated image')
    }
  }

  await db.delete(presentationPages).where(eq(presentationPages.id, pageId))

  // 更新页面计数
  await db
    .update(presentations)
    .set({
      pageCount: sql`GREATEST(${presentations.pageCount} - 1, 0)`,
      updatedAt: new Date()
    })
    .where(eq(presentations.id, presentationId))

  logger.info({ pageId, presentationId }, 'Page deleted')

  return true
}

/**
 * 重排页面顺序
 */
async function reorderPages(presentationId: string, companyId: string, input: ReorderPagesInput) {
  const pres = await db.query.presentations.findFirst({
    where: and(eq(presentations.id, presentationId), eq(presentations.companyId, companyId)),
    columns: { id: true }
  })

  if (!pres) {
    return false
  }

  // 批量更新 orderIndex
  const updates = input.pageIds.map((pageId, index) =>
    db
      .update(presentationPages)
      .set({ orderIndex: index, updatedAt: new Date() })
      .where(and(eq(presentationPages.id, pageId), eq(presentationPages.presentationId, presentationId)))
  )

  await Promise.all(updates)

  await db.update(presentations).set({ updatedAt: new Date() }).where(eq(presentations.id, presentationId))

  logger.info({ presentationId, pageCount: input.pageIds.length }, 'Pages reordered')

  return true
}

/**
 * 批量写入页面（AI 生成大纲/描述后使用）
 */
async function batchUpsertPages(presentationId: string, companyId: string, pages: CreatePageInput[]) {
  const pres = await db.query.presentations.findFirst({
    where: and(eq(presentations.id, presentationId), eq(presentations.companyId, companyId)),
    columns: { id: true }
  })

  if (!pres) {
    return null
  }

  // 先删除旧页面
  await db.delete(presentationPages).where(eq(presentationPages.presentationId, presentationId))

  if (pages.length === 0) {
    await db
      .update(presentations)
      .set({ pageCount: 0, updatedAt: new Date() })
      .where(eq(presentations.id, presentationId))

    return []
  }

  const values = pages.map((page, index) => ({
    presentationId,
    orderIndex: page.orderIndex ?? index,
    outlineContent: page.outlineContent,
    descriptionContent: page.descriptionContent ?? null
  }))

  const inserted = await db.insert(presentationPages).values(values).returning()

  await db
    .update(presentations)
    .set({ pageCount: inserted.length, updatedAt: new Date() })
    .where(eq(presentations.id, presentationId))

  logger.info({ presentationId, pageCount: inserted.length }, 'Pages batch upserted')

  return inserted
}

// ============ 企业设置 ============

/**
 * 获取企业演示文稿设置
 */
async function getSettings(companyId: string) {
  const record = await db.query.presentationSettings.findFirst({
    where: eq(presentationSettings.companyId, companyId)
  })

  // 不存在则返回默认值
  if (!record) {
    return {
      companyId,
      defaultTextModelId: null,
      defaultImageModelId: null,
      config: {}
    }
  }

  return record
}

/**
 * 更新企业演示文稿设置（upsert）
 */
async function updateSettings(companyId: string, input: UpdatePresentationSettingsInput) {
  const existing = await db.query.presentationSettings.findFirst({
    where: eq(presentationSettings.companyId, companyId)
  })

  if (existing) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() }

    if (input.defaultTextModelId !== undefined) {
      updateData.defaultTextModelId = input.defaultTextModelId
    }
    if (input.defaultImageModelId !== undefined) {
      updateData.defaultImageModelId = input.defaultImageModelId
    }
    if (input.config !== undefined) {
      updateData.config = { ...(existing.config as Record<string, unknown>), ...input.config }
    }

    const [updated] = await db
      .update(presentationSettings)
      .set(updateData)
      .where(eq(presentationSettings.companyId, companyId))
      .returning()

    logger.info({ companyId }, 'Presentation settings updated')

    return updated
  }

  // 新建
  const [created] = await db
    .insert(presentationSettings)
    .values({
      companyId,
      defaultTextModelId: input.defaultTextModelId ?? null,
      defaultImageModelId: input.defaultImageModelId ?? null,
      config: input.config ?? {}
    })
    .returning()

  logger.info({ companyId }, 'Presentation settings created')

  return created
}

// ============ Admin 查询 ============

/**
 * Admin 获取所有演示文稿列表（跨用户）
 */
async function adminListPresentations(companyId: string, query: AdminPresentationQueryInput) {
  const { page, pageSize, userId, status, search, startDate, endDate, sortBy, sortOrder } = query
  const offset = (page - 1) * pageSize

  const conditions = [eq(presentations.companyId, companyId)]

  if (userId) {
    conditions.push(eq(presentations.userId, userId))
  }
  if (status) {
    conditions.push(eq(presentations.status, status))
  }
  if (search) {
    conditions.push(ilike(presentations.title, `%${escapeLikePattern(search)}%`))
  }
  if (startDate) {
    conditions.push(gte(presentations.createdAt, startDate))
  }
  if (endDate) {
    conditions.push(lte(presentations.createdAt, endDate))
  }

  const orderColumn =
    sortBy === 'title'
      ? presentations.title
      : sortBy === 'createdAt'
        ? presentations.createdAt
        : presentations.updatedAt
  const orderDirection = sortOrder === 'asc' ? asc(orderColumn) : desc(orderColumn)

  const [items, totalResult] = await Promise.all([
    db.query.presentations.findMany({
      where: and(...conditions),
      orderBy: orderDirection,
      limit: pageSize,
      offset,
      with: {
        user: { columns: { id: true, name: true } }
      }
    }),
    db
      .select({ total: count() })
      .from(presentations)
      .where(and(...conditions))
  ])

  const total = totalResult[0]?.total ?? 0

  return { list: items, total, page, pageSize }
}

/**
 * Admin 获取演示文稿统计
 */
async function getStats(companyId: string) {
  const [totalResult, exportResult, aiCallResult, activeUserResult] = await Promise.all([
    db.select({ total: count() }).from(presentations).where(eq(presentations.companyId, companyId)),
    db
      .select({ total: count() })
      .from(presentationTasks)
      .where(
        and(
          sql`${presentationTasks.presentationId} IN (
            SELECT id FROM presentations WHERE company_id = ${companyId}
          )`,
          sql`${presentationTasks.taskType} IN ('export_pptx', 'export_pdf', 'export_editable_pptx')`,
          eq(presentationTasks.status, 'completed')
        )
      ),
    db
      .select({ total: count() })
      .from(presentationTasks)
      .where(
        and(
          sql`${presentationTasks.presentationId} IN (
            SELECT id FROM presentations WHERE company_id = ${companyId}
          )`,
          eq(presentationTasks.status, 'completed')
        )
      ),
    db
      .select({ total: sql<number>`COUNT(DISTINCT ${presentations.userId})` })
      .from(presentations)
      .where(eq(presentations.companyId, companyId))
  ])

  return {
    totalPresentations: totalResult[0]?.total ?? 0,
    totalExports: exportResult[0]?.total ?? 0,
    totalAiCalls: aiCallResult[0]?.total ?? 0,
    activeUsers: Number(activeUserResult[0]?.total ?? 0)
  }
}

// ============ 图像版本管理 ============

/**
 * 为页面添加图像版本
 */
async function addImageVersion(pageId: string, imageKey: string, prompt?: string) {
  // 取消当前版本标记
  await db
    .update(presentationImageVersions)
    .set({ isCurrent: false, updatedAt: new Date() })
    .where(and(eq(presentationImageVersions.pageId, pageId), eq(presentationImageVersions.isCurrent, true)))

  // 获取下一个版本号
  const [maxVersion] = await db
    .select({ max: sql<number>`COALESCE(MAX(${presentationImageVersions.versionNumber}), 0)` })
    .from(presentationImageVersions)
    .where(eq(presentationImageVersions.pageId, pageId))

  const nextVersion = (maxVersion?.max ?? 0) + 1

  const [version] = await db
    .insert(presentationImageVersions)
    .values({
      pageId,
      imageKey,
      versionNumber: nextVersion,
      isCurrent: true,
      prompt: prompt ?? null
    })
    .returning()

  // 更新页面的 generatedImageKey
  await db
    .update(presentationPages)
    .set({ generatedImageKey: imageKey, updatedAt: new Date() })
    .where(eq(presentationPages.id, pageId))

  logger.info({ pageId, versionNumber: nextVersion }, 'Image version added')

  return version
}

/**
 * 获取页面的所有图像版本
 * @param presentationId 用于验证 pageId 归属
 */
async function getImageVersions(presentationId: string, pageId: string) {
  // 先验证 pageId 属于该演示文稿
  const page = await db.query.presentationPages.findFirst({
    where: and(eq(presentationPages.id, pageId), eq(presentationPages.presentationId, presentationId)),
    columns: { id: true }
  })

  if (!page) {
    return null
  }

  return db.query.presentationImageVersions.findMany({
    where: eq(presentationImageVersions.pageId, pageId),
    orderBy: desc(presentationImageVersions.versionNumber)
  })
}

/**
 * 切换当前图像版本
 * @param presentationId 用于验证 pageId 归属
 */
async function switchImageVersion(presentationId: string, pageId: string, versionId: string) {
  // 先验证 pageId 属于该演示文稿
  const page = await db.query.presentationPages.findFirst({
    where: and(eq(presentationPages.id, pageId), eq(presentationPages.presentationId, presentationId)),
    columns: { id: true }
  })

  if (!page) {
    return null
  }

  const version = await db.query.presentationImageVersions.findFirst({
    where: and(eq(presentationImageVersions.id, versionId), eq(presentationImageVersions.pageId, pageId))
  })

  if (!version) {
    return null
  }

  // 取消所有当前标记
  await db
    .update(presentationImageVersions)
    .set({ isCurrent: false, updatedAt: new Date() })
    .where(eq(presentationImageVersions.pageId, pageId))

  // 设置新的当前版本
  const [updated] = await db
    .update(presentationImageVersions)
    .set({ isCurrent: true, updatedAt: new Date() })
    .where(eq(presentationImageVersions.id, versionId))
    .returning()

  // 同步更新页面的 generatedImageKey
  await db
    .update(presentationPages)
    .set({ generatedImageKey: version.imageKey, updatedAt: new Date() })
    .where(eq(presentationPages.id, pageId))

  logger.info({ pageId, versionId }, 'Image version switched')

  return updated
}

// ============ 导出服务对象 ============

export const presentationService = {
  // 演示文稿 CRUD
  createPresentation,
  listPresentations,
  getPresentationById,
  updatePresentation,
  deletePresentation,
  updatePresentationStatus,

  // 页面管理
  getPages,
  createPage,
  updatePage,
  deletePage,
  reorderPages,
  batchUpsertPages,

  // 企业设置
  getSettings,
  updateSettings,

  // Admin
  adminListPresentations,
  getStats,

  // 图像版本
  addImageVersion,
  getImageVersions,
  switchImageVersion
}
