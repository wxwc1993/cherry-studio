import {
  courseQuerySchema,
  createBannerSchema,
  createCourseCategorySchema,
  createCourseSchema,
  createDocumentCategorySchema,
  createDocumentSchema,
  createHotItemSchema,
  createPagination,
  createSuccessResponse,
  documentQuerySchema,
  hotItemsRefreshQuerySchema,
  lcIdParamSchema,
  lcPaginationSchema,
  updateBannerSchema,
  updateCourseCategorySchema,
  updateCourseSchema,
  updateDocumentCategorySchema,
  updateDocumentSchema,
  updateHotItemSchema
} from '@cherry-studio/enterprise-shared'
import { and, asc, count, desc, eq, inArray, isNull, not, sql } from 'drizzle-orm'
import { Router } from 'express'

import { authenticate, requirePermission } from '../middleware/auth'
import { apiLimiter, strictLimiter } from '../middleware/rate-limit.middleware'
import { validate } from '../middleware/validate'
import { db, lcBanners, lcCourseCategories, lcCourses, lcDocumentCategories, lcDocuments, lcHotItems } from '../models'
import { createLogger } from '../utils/logger'

const router = Router()
const logger = createLogger('LearningCenterRoutes')

router.use(authenticate)

// ============ 客户端聚合 API（仅需 authenticate） ============

// GET /client — 一次性返回所有学习中心数据
router.get('/client', apiLimiter, async (req, res, next) => {
  try {
    const companyId = req.user!.companyId

    // H3: 合并 viewStats 为单条 SQL（课程 + 文档浏览量）
    const [banners, courseCategories, documentCategories, hotItems, courseCount, documentCount, viewStats] =
      await Promise.all([
        db
          .select()
          .from(lcBanners)
          .where(and(eq(lcBanners.companyId, companyId), eq(lcBanners.isEnabled, true)))
          .orderBy(asc(lcBanners.order), desc(lcBanners.createdAt)),

        db.query.lcCourseCategories.findMany({
          where: and(eq(lcCourseCategories.companyId, companyId), eq(lcCourseCategories.isEnabled, true)),
          orderBy: [asc(lcCourseCategories.order), desc(lcCourseCategories.createdAt)],
          with: {
            courses: {
              where: eq(lcCourses.isEnabled, true),
              orderBy: [asc(lcCourses.order), desc(lcCourses.createdAt)],
              limit: 50
            }
          }
        }),

        db.query.lcDocumentCategories.findMany({
          where: and(eq(lcDocumentCategories.companyId, companyId), eq(lcDocumentCategories.isEnabled, true)),
          orderBy: [asc(lcDocumentCategories.order), desc(lcDocumentCategories.createdAt)],
          with: {
            documents: {
              where: eq(lcDocuments.isEnabled, true),
              orderBy: [asc(lcDocuments.order), desc(lcDocuments.createdAt)],
              limit: 50
            }
          }
        }),

        db
          .select()
          .from(lcHotItems)
          .where(and(eq(lcHotItems.companyId, companyId), eq(lcHotItems.isEnabled, true)))
          .orderBy(asc(lcHotItems.order), desc(lcHotItems.createdAt))
          .limit(10),

        db
          .select({ value: count() })
          .from(lcCourses)
          .where(and(eq(lcCourses.companyId, companyId), eq(lcCourses.isEnabled, true))),

        db
          .select({ value: count() })
          .from(lcDocuments)
          .where(and(eq(lcDocuments.companyId, companyId), eq(lcDocuments.isEnabled, true))),

        // H3: 合并为单条 SQL，同时获取课程和文档浏览总量
        db.execute<{ course_views: string; doc_views: string }>(sql`
          SELECT
            COALESCE((SELECT SUM(view_count) FROM lc_courses WHERE company_id = ${companyId} AND is_enabled = true), 0) AS course_views,
            COALESCE((SELECT SUM(view_count) FROM lc_documents WHERE company_id = ${companyId} AND is_enabled = true), 0) AS doc_views
        `)
      ])

    const stats = viewStats.rows?.[0]
    const totalViews = Number(stats?.course_views ?? 0) + Number(stats?.doc_views ?? 0)

    res.json(
      createSuccessResponse({
        banners: banners ?? [],
        courseCategories: courseCategories ?? [],
        documentCategories: documentCategories ?? [],
        hotItems: hotItems ?? [],
        stats: {
          totalCourses: courseCount[0]?.value ?? 0,
          totalDocuments: documentCount[0]?.value ?? 0,
          totalViews
        }
      })
    )
  } catch (err) {
    next(err)
  }
})

// GET /client/hot-items — 换一批热搜
router.get('/client/hot-items', apiLimiter, validate(hotItemsRefreshQuerySchema, 'query'), async (req, res, next) => {
  try {
    const companyId = req.user!.companyId
    const excludeIds: string[] = (req.query.exclude as string[]) ?? []

    const conditions = [eq(lcHotItems.companyId, companyId), eq(lcHotItems.isEnabled, true)]
    if (excludeIds.length > 0) {
      conditions.push(not(inArray(lcHotItems.id, excludeIds)))
    }

    const items = await db
      .select()
      .from(lcHotItems)
      .where(and(...conditions))
      .orderBy(sql`random()`)
      .limit(10)

    res.json(createSuccessResponse(items))
  } catch (err) {
    next(err)
  }
})

// M2: 原子 viewCount 自增 — 课程
router.post('/courses/:id/view', validate(lcIdParamSchema, 'params'), async (req, res, next) => {
  try {
    const companyId = req.user!.companyId
    const [updated] = await db
      .update(lcCourses)
      .set({ viewCount: sql`${lcCourses.viewCount} + 1` })
      .where(and(eq(lcCourses.id, req.params.id), eq(lcCourses.companyId, companyId)))
      .returning({ viewCount: lcCourses.viewCount })

    if (!updated) {
      return res.status(404).json({ success: false, error: { code: 'RES_3001', message: 'Course not found' } })
    }
    res.json(createSuccessResponse({ viewCount: updated.viewCount }))
  } catch (err) {
    next(err)
  }
})

// M2: 原子 viewCount 自增 — 文档
router.post('/documents/:id/view', validate(lcIdParamSchema, 'params'), async (req, res, next) => {
  try {
    const companyId = req.user!.companyId
    const [updated] = await db
      .update(lcDocuments)
      .set({ viewCount: sql`${lcDocuments.viewCount} + 1` })
      .where(and(eq(lcDocuments.id, req.params.id), eq(lcDocuments.companyId, companyId)))
      .returning({ viewCount: lcDocuments.viewCount })

    if (!updated) {
      return res.status(404).json({ success: false, error: { code: 'RES_3001', message: 'Document not found' } })
    }
    res.json(createSuccessResponse({ viewCount: updated.viewCount }))
  } catch (err) {
    next(err)
  }
})

// ============ Banner CRUD（需 admin 权限） ============

router.get(
  '/banners',
  requirePermission('learningCenter', 'read'),
  validate(lcPaginationSchema, 'query'),
  async (req, res, next) => {
    try {
      const companyId = req.user!.companyId
      const { page, pageSize } = req.query as any

      const [items, total] = await Promise.all([
        db
          .select()
          .from(lcBanners)
          .where(eq(lcBanners.companyId, companyId))
          .orderBy(asc(lcBanners.order), desc(lcBanners.createdAt))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db.select({ value: count() }).from(lcBanners).where(eq(lcBanners.companyId, companyId))
      ])

      res.json(createSuccessResponse(items, createPagination(total[0]?.value ?? 0, { page, pageSize })))
    } catch (err) {
      next(err)
    }
  }
)

router.post(
  '/banners',
  requirePermission('learningCenter', 'write'),
  strictLimiter,
  validate(createBannerSchema, 'body'),
  async (req, res, next) => {
    try {
      const companyId = req.user!.companyId
      const [banner] = await db
        .insert(lcBanners)
        .values({ ...req.body, companyId })
        .returning()
      res.status(201).json(createSuccessResponse(banner))
    } catch (err) {
      next(err)
    }
  }
)

router.patch(
  '/banners/:id',
  requirePermission('learningCenter', 'write'),
  strictLimiter,
  validate(lcIdParamSchema, 'params'),
  validate(updateBannerSchema, 'body'),
  async (req, res, next) => {
    try {
      const companyId = req.user!.companyId
      const [updated] = await db
        .update(lcBanners)
        .set({ ...req.body, updatedAt: new Date() })
        .where(and(eq(lcBanners.id, req.params.id), eq(lcBanners.companyId, companyId)))
        .returning()
      if (!updated) {
        return res.status(404).json({ success: false, error: { code: 'RES_3001', message: 'Banner not found' } })
      }
      res.json(createSuccessResponse(updated))
    } catch (err) {
      next(err)
    }
  }
)

router.delete(
  '/banners/:id',
  requirePermission('learningCenter', 'admin'),
  strictLimiter,
  validate(lcIdParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const companyId = req.user!.companyId
      const [deleted] = await db
        .delete(lcBanners)
        .where(and(eq(lcBanners.id, req.params.id), eq(lcBanners.companyId, companyId)))
        .returning()
      if (!deleted) {
        return res.status(404).json({ success: false, error: { code: 'RES_3001', message: 'Banner not found' } })
      }
      res.json(createSuccessResponse({ id: deleted.id }))
    } catch (err) {
      next(err)
    }
  }
)

// ============ 课程分类 CRUD ============

router.get('/course-categories', requirePermission('learningCenter', 'read'), async (req, res, next) => {
  try {
    const companyId = req.user!.companyId
    const items = await db
      .select()
      .from(lcCourseCategories)
      .where(eq(lcCourseCategories.companyId, companyId))
      .orderBy(asc(lcCourseCategories.order), desc(lcCourseCategories.createdAt))
    res.json(createSuccessResponse(items))
  } catch (err) {
    next(err)
  }
})

router.post(
  '/course-categories',
  requirePermission('learningCenter', 'write'),
  strictLimiter,
  validate(createCourseCategorySchema, 'body'),
  async (req, res, next) => {
    try {
      const companyId = req.user!.companyId
      const [category] = await db
        .insert(lcCourseCategories)
        .values({ ...req.body, companyId })
        .returning()
      res.status(201).json(createSuccessResponse(category))
    } catch (err) {
      next(err)
    }
  }
)

router.patch(
  '/course-categories/:id',
  requirePermission('learningCenter', 'write'),
  strictLimiter,
  validate(lcIdParamSchema, 'params'),
  validate(updateCourseCategorySchema, 'body'),
  async (req, res, next) => {
    try {
      const companyId = req.user!.companyId
      const [updated] = await db
        .update(lcCourseCategories)
        .set({ ...req.body, updatedAt: new Date() })
        .where(and(eq(lcCourseCategories.id, req.params.id), eq(lcCourseCategories.companyId, companyId)))
        .returning()
      if (!updated) {
        return res
          .status(404)
          .json({ success: false, error: { code: 'RES_3001', message: 'Course category not found' } })
      }
      res.json(createSuccessResponse(updated))
    } catch (err) {
      next(err)
    }
  }
)

router.delete(
  '/course-categories/:id',
  requirePermission('learningCenter', 'admin'),
  strictLimiter,
  validate(lcIdParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const companyId = req.user!.companyId
      const courseCountResult = await db
        .select({ value: count() })
        .from(lcCourses)
        .where(and(eq(lcCourses.categoryId, req.params.id), eq(lcCourses.companyId, companyId)))
      const [deleted] = await db
        .delete(lcCourseCategories)
        .where(and(eq(lcCourseCategories.id, req.params.id), eq(lcCourseCategories.companyId, companyId)))
        .returning()
      if (!deleted) {
        return res
          .status(404)
          .json({ success: false, error: { code: 'RES_3001', message: 'Course category not found' } })
      }
      res.json(createSuccessResponse({ id: deleted.id, affectedCourses: courseCountResult[0]?.value ?? 0 }))
    } catch (err) {
      next(err)
    }
  }
)

// ============ 课程 CRUD ============

router.get(
  '/courses',
  requirePermission('learningCenter', 'read'),
  validate(courseQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const companyId = req.user!.companyId
      const { page, pageSize, categoryId, uncategorized } = req.query as any
      const conditions = [eq(lcCourses.companyId, companyId)]
      if (categoryId) {
        conditions.push(eq(lcCourses.categoryId, categoryId))
      }
      if (uncategorized) {
        conditions.push(isNull(lcCourses.categoryId))
      }

      const [items, total] = await Promise.all([
        db
          .select()
          .from(lcCourses)
          .where(and(...conditions))
          .orderBy(asc(lcCourses.order), desc(lcCourses.createdAt))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db
          .select({ value: count() })
          .from(lcCourses)
          .where(and(...conditions))
      ])

      res.json(createSuccessResponse(items, createPagination(total[0]?.value ?? 0, { page, pageSize })))
    } catch (err) {
      next(err)
    }
  }
)

router.post(
  '/courses',
  requirePermission('learningCenter', 'write'),
  strictLimiter,
  validate(createCourseSchema, 'body'),
  async (req, res, next) => {
    try {
      const companyId = req.user!.companyId
      const [course] = await db
        .insert(lcCourses)
        .values({ ...req.body, companyId })
        .returning()
      res.status(201).json(createSuccessResponse(course))
    } catch (err) {
      next(err)
    }
  }
)

router.patch(
  '/courses/:id',
  requirePermission('learningCenter', 'write'),
  strictLimiter,
  validate(lcIdParamSchema, 'params'),
  validate(updateCourseSchema, 'body'),
  async (req, res, next) => {
    try {
      const companyId = req.user!.companyId
      const [updated] = await db
        .update(lcCourses)
        .set({ ...req.body, updatedAt: new Date() })
        .where(and(eq(lcCourses.id, req.params.id), eq(lcCourses.companyId, companyId)))
        .returning()
      if (!updated) {
        return res.status(404).json({ success: false, error: { code: 'RES_3001', message: 'Course not found' } })
      }
      res.json(createSuccessResponse(updated))
    } catch (err) {
      next(err)
    }
  }
)

router.delete(
  '/courses/:id',
  requirePermission('learningCenter', 'admin'),
  strictLimiter,
  validate(lcIdParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const companyId = req.user!.companyId
      const [deleted] = await db
        .delete(lcCourses)
        .where(and(eq(lcCourses.id, req.params.id), eq(lcCourses.companyId, companyId)))
        .returning()
      if (!deleted) {
        return res.status(404).json({ success: false, error: { code: 'RES_3001', message: 'Course not found' } })
      }
      res.json(createSuccessResponse({ id: deleted.id }))
    } catch (err) {
      next(err)
    }
  }
)

// ============ 文档分类 CRUD ============

router.get('/document-categories', requirePermission('learningCenter', 'read'), async (req, res, next) => {
  try {
    const companyId = req.user!.companyId
    const items = await db
      .select()
      .from(lcDocumentCategories)
      .where(eq(lcDocumentCategories.companyId, companyId))
      .orderBy(asc(lcDocumentCategories.order), desc(lcDocumentCategories.createdAt))
    res.json(createSuccessResponse(items))
  } catch (err) {
    next(err)
  }
})

router.post(
  '/document-categories',
  requirePermission('learningCenter', 'write'),
  strictLimiter,
  validate(createDocumentCategorySchema, 'body'),
  async (req, res, next) => {
    try {
      const companyId = req.user!.companyId
      const [category] = await db
        .insert(lcDocumentCategories)
        .values({ ...req.body, companyId })
        .returning()
      res.status(201).json(createSuccessResponse(category))
    } catch (err) {
      next(err)
    }
  }
)

router.patch(
  '/document-categories/:id',
  requirePermission('learningCenter', 'write'),
  strictLimiter,
  validate(lcIdParamSchema, 'params'),
  validate(updateDocumentCategorySchema, 'body'),
  async (req, res, next) => {
    try {
      const companyId = req.user!.companyId
      const [updated] = await db
        .update(lcDocumentCategories)
        .set({ ...req.body, updatedAt: new Date() })
        .where(and(eq(lcDocumentCategories.id, req.params.id), eq(lcDocumentCategories.companyId, companyId)))
        .returning()
      if (!updated) {
        return res
          .status(404)
          .json({ success: false, error: { code: 'RES_3001', message: 'Document category not found' } })
      }
      res.json(createSuccessResponse(updated))
    } catch (err) {
      next(err)
    }
  }
)

router.delete(
  '/document-categories/:id',
  requirePermission('learningCenter', 'admin'),
  strictLimiter,
  validate(lcIdParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const companyId = req.user!.companyId
      const docCountResult = await db
        .select({ value: count() })
        .from(lcDocuments)
        .where(and(eq(lcDocuments.categoryId, req.params.id), eq(lcDocuments.companyId, companyId)))
      const [deleted] = await db
        .delete(lcDocumentCategories)
        .where(and(eq(lcDocumentCategories.id, req.params.id), eq(lcDocumentCategories.companyId, companyId)))
        .returning()
      if (!deleted) {
        return res
          .status(404)
          .json({ success: false, error: { code: 'RES_3001', message: 'Document category not found' } })
      }
      res.json(createSuccessResponse({ id: deleted.id, affectedDocuments: docCountResult[0]?.value ?? 0 }))
    } catch (err) {
      next(err)
    }
  }
)

// ============ 文档 CRUD ============

router.get(
  '/documents',
  requirePermission('learningCenter', 'read'),
  validate(documentQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const companyId = req.user!.companyId
      const { page, pageSize, categoryId, uncategorized } = req.query as any
      const conditions = [eq(lcDocuments.companyId, companyId)]
      if (categoryId) {
        conditions.push(eq(lcDocuments.categoryId, categoryId))
      }
      if (uncategorized) {
        conditions.push(isNull(lcDocuments.categoryId))
      }

      const [items, total] = await Promise.all([
        db
          .select()
          .from(lcDocuments)
          .where(and(...conditions))
          .orderBy(asc(lcDocuments.order), desc(lcDocuments.createdAt))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db
          .select({ value: count() })
          .from(lcDocuments)
          .where(and(...conditions))
      ])

      res.json(createSuccessResponse(items, createPagination(total[0]?.value ?? 0, { page, pageSize })))
    } catch (err) {
      next(err)
    }
  }
)

router.post(
  '/documents',
  requirePermission('learningCenter', 'write'),
  strictLimiter,
  validate(createDocumentSchema, 'body'),
  async (req, res, next) => {
    try {
      const companyId = req.user!.companyId
      const [document] = await db
        .insert(lcDocuments)
        .values({ ...req.body, companyId })
        .returning()
      res.status(201).json(createSuccessResponse(document))
    } catch (err) {
      next(err)
    }
  }
)

router.patch(
  '/documents/:id',
  requirePermission('learningCenter', 'write'),
  strictLimiter,
  validate(lcIdParamSchema, 'params'),
  validate(updateDocumentSchema, 'body'),
  async (req, res, next) => {
    try {
      const companyId = req.user!.companyId
      const [updated] = await db
        .update(lcDocuments)
        .set({ ...req.body, updatedAt: new Date() })
        .where(and(eq(lcDocuments.id, req.params.id), eq(lcDocuments.companyId, companyId)))
        .returning()
      if (!updated) {
        return res.status(404).json({ success: false, error: { code: 'RES_3001', message: 'Document not found' } })
      }
      res.json(createSuccessResponse(updated))
    } catch (err) {
      next(err)
    }
  }
)

router.delete(
  '/documents/:id',
  requirePermission('learningCenter', 'admin'),
  strictLimiter,
  validate(lcIdParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const companyId = req.user!.companyId
      const [deleted] = await db
        .delete(lcDocuments)
        .where(and(eq(lcDocuments.id, req.params.id), eq(lcDocuments.companyId, companyId)))
        .returning()
      if (!deleted) {
        return res.status(404).json({ success: false, error: { code: 'RES_3001', message: 'Document not found' } })
      }
      res.json(createSuccessResponse({ id: deleted.id }))
    } catch (err) {
      next(err)
    }
  }
)

// ============ 热搜要闻 CRUD ============

router.get(
  '/hot-items',
  requirePermission('learningCenter', 'read'),
  validate(lcPaginationSchema, 'query'),
  async (req, res, next) => {
    try {
      const companyId = req.user!.companyId
      const { page, pageSize } = req.query as any

      const [items, total] = await Promise.all([
        db
          .select()
          .from(lcHotItems)
          .where(eq(lcHotItems.companyId, companyId))
          .orderBy(asc(lcHotItems.order), desc(lcHotItems.createdAt))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db.select({ value: count() }).from(lcHotItems).where(eq(lcHotItems.companyId, companyId))
      ])

      res.json(createSuccessResponse(items, createPagination(total[0]?.value ?? 0, { page, pageSize })))
    } catch (err) {
      next(err)
    }
  }
)

router.post(
  '/hot-items',
  requirePermission('learningCenter', 'write'),
  strictLimiter,
  validate(createHotItemSchema, 'body'),
  async (req, res, next) => {
    try {
      const companyId = req.user!.companyId
      const [item] = await db
        .insert(lcHotItems)
        .values({ ...req.body, companyId })
        .returning()
      res.status(201).json(createSuccessResponse(item))
    } catch (err) {
      next(err)
    }
  }
)

router.patch(
  '/hot-items/:id',
  requirePermission('learningCenter', 'write'),
  strictLimiter,
  validate(lcIdParamSchema, 'params'),
  validate(updateHotItemSchema, 'body'),
  async (req, res, next) => {
    try {
      const companyId = req.user!.companyId
      const [updated] = await db
        .update(lcHotItems)
        .set({ ...req.body, updatedAt: new Date() })
        .where(and(eq(lcHotItems.id, req.params.id), eq(lcHotItems.companyId, companyId)))
        .returning()
      if (!updated) {
        return res.status(404).json({ success: false, error: { code: 'RES_3001', message: 'Hot item not found' } })
      }
      res.json(createSuccessResponse(updated))
    } catch (err) {
      next(err)
    }
  }
)

router.delete(
  '/hot-items/:id',
  requirePermission('learningCenter', 'admin'),
  strictLimiter,
  validate(lcIdParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const companyId = req.user!.companyId
      const [deleted] = await db
        .delete(lcHotItems)
        .where(and(eq(lcHotItems.id, req.params.id), eq(lcHotItems.companyId, companyId)))
        .returning()
      if (!deleted) {
        return res.status(404).json({ success: false, error: { code: 'RES_3001', message: 'Hot item not found' } })
      }
      res.json(createSuccessResponse({ id: deleted.id }))
    } catch (err) {
      next(err)
    }
  }
)

export default router
