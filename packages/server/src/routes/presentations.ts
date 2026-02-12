import type {
  CreatePageInput,
  DescriptionContentInput,
  OutlineContentInput,
  PresentationConfigInput,
  UpdatePageInput
} from '@cherry-studio/enterprise-shared'
import {
  adminPresentationQuerySchema,
  createPageSchema,
  createPagination,
  createPresentationSchema,
  createSuccessResponse,
  createTemplateSchema,
  editImageSchema,
  exportPresentationSchema,
  generateDescriptionsSchema,
  generateImagesSchema,
  generateOutlineSchema,
  generateSingleImageSchema,
  materialIdParamSchema,
  presentationIdParamSchema,
  presentationPageIdParamSchema,
  presentationQuerySchema,
  refineDescriptionsSchema,
  refineOutlineSchema,
  reorderPagesSchema,
  taskIdParamSchema,
  templateIdParamSchema,
  updatePageSchema,
  updatePresentationSchema,
  updatePresentationSettingsSchema
} from '@cherry-studio/enterprise-shared'
import { asc, eq } from 'drizzle-orm'
import { Router } from 'express'
import multer from 'multer'
import * as z from 'zod'

import { authenticate, requirePermission } from '../middleware/auth'
import { NotFoundError, ValidationError } from '../middleware/errorHandler'
import { uploadLimiter } from '../middleware/rate-limit.middleware'
import { validate, validateMultiple } from '../middleware/validate'
import { auditLogs, db, presentationPages, presentationTemplates } from '../models'
import { presentationService } from '../services/presentation.service'
import { presentationFileService } from '../services/presentation-file.service'
import { presentationTaskService } from '../services/presentation-task.service'
import { createLogger } from '../utils/logger'

const router = Router()
const logger = createLogger('PresentationRoutes')

// ============ Multer 文件上传配置 ============

const MATERIAL_MAX_SIZE = 20 * 1024 * 1024 // 20MB
const REFERENCE_MAX_SIZE = 50 * 1024 * 1024 // 50MB
const TEMPLATE_MAX_SIZE = 100 * 1024 * 1024 // 100MB

const MATERIAL_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'])
const REFERENCE_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.txt', '.md', '.pptx', '.ppt'])
const TEMPLATE_EXTENSIONS = new Set(['.pptx'])

function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.')
  return lastDot === -1 ? '' : fileName.slice(lastDot).toLowerCase()
}

function createUpload(maxSize: number, allowedExtensions: Set<string>) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxSize },
    fileFilter: (_req, file, cb) => {
      const ext = getFileExtension(file.originalname)
      if (!allowedExtensions.has(ext)) {
        cb(new ValidationError(`Unsupported file type: ${ext}`))
        return
      }
      cb(null, true)
    }
  })
}

const materialUpload = createUpload(MATERIAL_MAX_SIZE, MATERIAL_EXTENSIONS)
const referenceUpload = createUpload(REFERENCE_MAX_SIZE, REFERENCE_EXTENSIONS)
const templateUpload = createUpload(TEMPLATE_MAX_SIZE, TEMPLATE_EXTENSIONS)

// ============ 复合 Param Schema（enterprise-shared 中不含的复合参数） ============

const referenceFileActionParamSchema = z.object({
  id: z.string().uuid(),
  referenceFileId: z.string().uuid()
})

const imageVersionParamSchema = z.object({
  id: z.string().uuid(),
  pageId: z.string().uuid(),
  versionId: z.string().uuid()
})

// ============ 认证 ============

router.use(authenticate)

// ============ 辅助函数 ============

/**
 * 写入审计日志（异步，不阻塞主流程）
 */
function writeAuditLog(params: {
  companyId: string
  userId: string
  action: string
  resourceId?: string
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  status?: 'success' | 'failed'
  errorMessage?: string
}): void {
  const { companyId, userId, action, resourceId, details, ipAddress, userAgent, status, errorMessage } = params
  db.insert(auditLogs)
    .values({
      companyId,
      userId,
      action,
      resource: 'presentation',
      resourceId,
      details: details ?? {},
      ipAddress,
      userAgent,
      status: status ?? 'success',
      errorMessage
    })
    .catch((err) => {
      logger.error({ err, action, resourceId }, 'Failed to write audit log')
    })
}

/**
 * 载入演示文稿并验证归属，同时返回 presConfig 供任务提交使用
 */
async function loadPresentationWithConfig(
  presentationId: string,
  companyId: string
): Promise<{ config: PresentationConfigInput }> {
  const pres = await presentationService.getPresentationById(presentationId, companyId)
  if (!pres) {
    throw new NotFoundError('Presentation not found')
  }
  return { config: (pres.config ?? {}) as PresentationConfigInput }
}

// ╔════════════════════════════════════════════════════════════════════╗
// ║  静态路由（必须定义在 /:id 参数路由之前，防止 Express 误匹配）   ║
// ╚════════════════════════════════════════════════════════════════════╝

// ============ 企业设置 ============

/** GET /settings — 获取演示文稿企业设置 */
router.get('/settings', requirePermission('presentations', 'admin'), async (req, res, next) => {
  try {
    const { companyId } = req.user!
    const settings = await presentationService.getSettings(companyId)
    res.json(createSuccessResponse(settings))
  } catch (err) {
    next(err)
  }
})

/** PATCH /settings — 更新演示文稿企业设置 */
router.patch(
  '/settings',
  requirePermission('presentations', 'admin'),
  validate(updatePresentationSettingsSchema),
  async (req, res, next) => {
    try {
      const { companyId } = req.user!
      const updated = await presentationService.updateSettings(companyId, req.body)
      res.json(createSuccessResponse(updated))
    } catch (err) {
      next(err)
    }
  }
)

// ============ 模板管理 ============

/** GET /templates — 获取模板列表 */
router.get('/templates', requirePermission('presentations', 'read'), async (req, res, next) => {
  try {
    const { companyId } = req.user!

    const templates = await db.query.presentationTemplates.findMany({
      where: eq(presentationTemplates.companyId, companyId),
      orderBy: asc(presentationTemplates.name)
    })

    res.json(createSuccessResponse(templates))
  } catch (err) {
    next(err)
  }
})

/** POST /templates — 上传模板 */
router.post(
  '/templates',
  requirePermission('presentations', 'admin'),
  uploadLimiter,
  templateUpload.single('file'),
  async (req, res, next) => {
    try {
      const { companyId, sub: userId } = req.user!
      const file = req.file

      if (!file) {
        throw new ValidationError('No file uploaded')
      }

      // 从 multipart form-data 中解析模板元数据
      const parsed = createTemplateSchema.parse({
        name: req.body.name,
        description: req.body.description,
        isPublic: req.body.isPublic === 'true'
      })

      const record = await presentationFileService.uploadTemplate({
        companyId,
        uploaderId: userId,
        name: parsed.name,
        description: parsed.description,
        isPublic: parsed.isPublic,
        buffer: file.buffer,
        fileName: file.originalname
      })

      logger.info({ templateId: record.id, companyId }, 'Template uploaded via API')
      res.status(201).json(createSuccessResponse(record))
    } catch (err) {
      next(err)
    }
  }
)

/** DELETE /templates/:id — 删除模板 */
router.delete(
  '/templates/:id',
  requirePermission('presentations', 'admin'),
  validate(templateIdParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const { companyId, sub: userId } = req.user!
      await presentationFileService.deleteTemplate(req.params.id, companyId)
      writeAuditLog({
        companyId,
        userId,
        action: 'delete_template',
        resourceId: req.params.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      })
      res.json(createSuccessResponse({ deleted: true }))
    } catch (err) {
      next(err)
    }
  }
)

// ============ Admin 查询 ============

/** GET /admin/list — Admin 获取所有演示文稿 */
router.get(
  '/admin/list',
  requirePermission('presentations', 'admin'),
  validate(adminPresentationQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const { companyId } = req.user!
      const result = await presentationService.adminListPresentations(companyId, req.query as any)
      const pagination = createPagination(result.total, { page: result.page, pageSize: result.pageSize })
      res.json(createSuccessResponse(result.list, pagination))
    } catch (err) {
      next(err)
    }
  }
)

/** GET /admin/stats — Admin 获取统计数据 */
router.get('/admin/stats', requirePermission('presentations', 'admin'), async (req, res, next) => {
  try {
    const { companyId } = req.user!
    const stats = await presentationService.getStats(companyId)
    res.json(createSuccessResponse(stats))
  } catch (err) {
    next(err)
  }
})

// ============ 独立任务查询（/tasks/:taskId） ============

/** GET /tasks/:taskId — 获取单个任务详情 */
router.get(
  '/tasks/:taskId',
  requirePermission('presentations', 'read'),
  validate(taskIdParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const { companyId } = req.user!
      const task = await presentationTaskService.getTask(req.params.taskId, companyId)
      if (!task) {
        throw new NotFoundError('Task not found')
      }
      res.json(createSuccessResponse(task))
    } catch (err) {
      next(err)
    }
  }
)

/** DELETE /tasks/:taskId — 取消任务 */
router.delete(
  '/tasks/:taskId',
  requirePermission('presentations', 'write'),
  validate(taskIdParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const { companyId } = req.user!
      const cancelled = await presentationTaskService.cancelTask(req.params.taskId, companyId)
      if (!cancelled) {
        throw new NotFoundError('Task not found or already completed')
      }
      res.json(createSuccessResponse({ cancelled: true }))
    } catch (err) {
      next(err)
    }
  }
)

// ============ 素材管理 ============

/** POST /materials — 上传素材 */
router.post(
  '/materials',
  requirePermission('presentations', 'write'),
  uploadLimiter,
  materialUpload.single('file'),
  async (req, res, next) => {
    try {
      const { companyId, sub: userId } = req.user!
      const file = req.file

      if (!file) {
        throw new ValidationError('No file uploaded')
      }

      const rawPresentationId = req.body.presentationId as string | undefined
      const presentationId = rawPresentationId
        ? z.string().uuid('Invalid presentationId format').parse(rawPresentationId)
        : undefined

      // 如果提供了 presentationId，验证其归属当前公司
      if (presentationId) {
        const pres = await presentationService.getPresentationById(presentationId, companyId)
        if (!pres) {
          throw new ValidationError('Presentation not found or does not belong to this company')
        }
      }

      const record = await presentationFileService.uploadMaterial({
        companyId,
        userId,
        presentationId,
        fileName: file.originalname,
        buffer: file.buffer,
        mimeType: file.mimetype
      })

      logger.info({ materialId: record.id, companyId }, 'Material uploaded via API')
      res.status(201).json(createSuccessResponse(record))
    } catch (err) {
      next(err)
    }
  }
)

/** DELETE /materials/:id — 删除素材 */
router.delete(
  '/materials/:id',
  requirePermission('presentations', 'write'),
  validate(materialIdParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const { companyId } = req.user!
      await presentationFileService.deleteMaterial(req.params.id, companyId)
      res.json(createSuccessResponse({ deleted: true }))
    } catch (err) {
      next(err)
    }
  }
)

// ╔════════════════════════════════════════════════════════════════════╗
// ║  参数化路由（/:id 及其嵌套路由）                                  ║
// ╚════════════════════════════════════════════════════════════════════╝

// ============ 演示文稿 CRUD ============

/** POST / — 创建演示文稿 */
router.post(
  '/',
  requirePermission('presentations', 'write'),
  validate(createPresentationSchema),
  async (req, res, next) => {
    try {
      const { companyId, sub: userId } = req.user!
      const record = await presentationService.createPresentation(companyId, userId, req.body)
      writeAuditLog({
        companyId,
        userId,
        action: 'create',
        resourceId: record.id,
        details: { title: req.body.title, creationType: req.body.creationType },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      })
      res.status(201).json(createSuccessResponse(record))
    } catch (err) {
      next(err)
    }
  }
)

/** GET / — 列表（用户维度，分页/搜索/排序） */
router.get(
  '/',
  requirePermission('presentations', 'read'),
  validate(presentationQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const { companyId, sub: userId } = req.user!
      const result = await presentationService.listPresentations(companyId, userId, req.query as any)
      const pagination = createPagination(result.total, { page: result.page, pageSize: result.pageSize })
      res.json(createSuccessResponse(result.list, pagination))
    } catch (err) {
      next(err)
    }
  }
)

/** GET /:id — 获取详情（含所有页面） */
router.get(
  '/:id',
  requirePermission('presentations', 'read'),
  validate(presentationIdParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const { companyId } = req.user!
      const record = await presentationService.getPresentationById(req.params.id, companyId)
      if (!record) {
        throw new NotFoundError('Presentation not found')
      }
      res.json(createSuccessResponse(record))
    } catch (err) {
      next(err)
    }
  }
)

/** PATCH /:id — 更新演示文稿 */
router.patch(
  '/:id',
  requirePermission('presentations', 'write'),
  validateMultiple({ params: presentationIdParamSchema, body: updatePresentationSchema }),
  async (req, res, next) => {
    try {
      const { companyId, sub: userId } = req.user!
      const updated = await presentationService.updatePresentation(req.params.id, companyId, userId, req.body)
      if (!updated) {
        throw new NotFoundError('Presentation not found')
      }
      res.json(createSuccessResponse(updated))
    } catch (err) {
      next(err)
    }
  }
)

/** DELETE /:id — 删除演示文稿 */
router.delete(
  '/:id',
  requirePermission('presentations', 'write'),
  validate(presentationIdParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const { companyId, sub: userId } = req.user!
      const deleted = await presentationService.deletePresentation(req.params.id, companyId, userId)
      if (!deleted) {
        throw new NotFoundError('Presentation not found')
      }
      writeAuditLog({
        companyId,
        userId,
        action: 'delete',
        resourceId: req.params.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      })
      res.json(createSuccessResponse({ deleted: true }))
    } catch (err) {
      next(err)
    }
  }
)

// ============ 页面管理 ============

/** GET /:id/pages — 获取所有页面 */
router.get(
  '/:id/pages',
  requirePermission('presentations', 'read'),
  validate(presentationIdParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const { companyId } = req.user!
      const pages = await presentationService.getPages(req.params.id, companyId)
      if (!pages) {
        throw new NotFoundError('Presentation not found')
      }
      res.json(createSuccessResponse(pages))
    } catch (err) {
      next(err)
    }
  }
)

/** POST /:id/pages — 创建页面 */
router.post(
  '/:id/pages',
  requirePermission('presentations', 'write'),
  validateMultiple({ params: presentationIdParamSchema, body: createPageSchema }),
  async (req, res, next) => {
    try {
      const { companyId } = req.user!
      const page = await presentationService.createPage(req.params.id, companyId, req.body as CreatePageInput)
      if (!page) {
        throw new NotFoundError('Presentation not found')
      }
      res.status(201).json(createSuccessResponse(page))
    } catch (err) {
      next(err)
    }
  }
)

/** PATCH /:id/pages/:pageId — 更新页面 */
router.patch(
  '/:id/pages/:pageId',
  requirePermission('presentations', 'write'),
  validateMultiple({ params: presentationPageIdParamSchema, body: updatePageSchema }),
  async (req, res, next) => {
    try {
      const { companyId } = req.user!
      const updated = await presentationService.updatePage(
        req.params.pageId,
        req.params.id,
        companyId,
        req.body as UpdatePageInput
      )
      if (!updated) {
        throw new NotFoundError('Page not found')
      }
      res.json(createSuccessResponse(updated))
    } catch (err) {
      next(err)
    }
  }
)

/** DELETE /:id/pages/:pageId — 删除页面 */
router.delete(
  '/:id/pages/:pageId',
  requirePermission('presentations', 'write'),
  validate(presentationPageIdParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const { companyId } = req.user!
      const deleted = await presentationService.deletePage(req.params.pageId, req.params.id, companyId)
      if (!deleted) {
        throw new NotFoundError('Page not found')
      }
      res.json(createSuccessResponse({ deleted: true }))
    } catch (err) {
      next(err)
    }
  }
)

/** PUT /:id/pages/reorder — 重排页面顺序 */
router.put(
  '/:id/pages/reorder',
  requirePermission('presentations', 'write'),
  validateMultiple({ params: presentationIdParamSchema, body: reorderPagesSchema }),
  async (req, res, next) => {
    try {
      const { companyId } = req.user!
      const reordered = await presentationService.reorderPages(req.params.id, companyId, req.body)
      if (!reordered) {
        throw new NotFoundError('Presentation not found')
      }
      res.json(createSuccessResponse({ reordered: true }))
    } catch (err) {
      next(err)
    }
  }
)

// ============ AI 生成（异步任务） ============

/** POST /:id/generate-outline — 生成大纲 */
router.post(
  '/:id/generate-outline',
  requirePermission('presentations', 'write'),
  validateMultiple({ params: presentationIdParamSchema, body: generateOutlineSchema }),
  async (req, res, next) => {
    try {
      const { companyId, sub: userId } = req.user!
      const { config: presConfig } = await loadPresentationWithConfig(req.params.id, companyId)

      const taskId = await presentationTaskService.submitGenerateOutline(
        companyId,
        req.params.id,
        userId,
        { ...presConfig, ...req.body.config },
        req.body
      )

      writeAuditLog({
        companyId,
        userId,
        action: 'generate_outline',
        resourceId: req.params.id,
        details: { taskId },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      })
      logger.info({ presentationId: req.params.id, taskId }, 'Generate outline task submitted')
      res.status(202).json(createSuccessResponse({ taskId }))
    } catch (err) {
      next(err)
    }
  }
)

/** POST /:id/refine-outline — 优化大纲 */
router.post(
  '/:id/refine-outline',
  requirePermission('presentations', 'write'),
  validateMultiple({ params: presentationIdParamSchema, body: refineOutlineSchema }),
  async (req, res, next) => {
    try {
      const { companyId, sub: userId } = req.user!
      const { config: presConfig } = await loadPresentationWithConfig(req.params.id, companyId)

      // 获取当前页面大纲作为 currentPages 传入
      const existingPages = await presentationService.getPages(req.params.id, companyId)
      const currentPages: OutlineContentInput[] = (existingPages ?? []).map(
        (p) => p.outlineContent as OutlineContentInput
      )

      const taskId = await presentationTaskService.submitRefineOutline(
        companyId,
        req.params.id,
        userId,
        presConfig,
        req.body,
        currentPages
      )

      logger.info({ presentationId: req.params.id, taskId }, 'Refine outline task submitted')
      res.status(202).json(createSuccessResponse({ taskId }))
    } catch (err) {
      next(err)
    }
  }
)

/** POST /:id/generate-descriptions — 生成描述 */
router.post(
  '/:id/generate-descriptions',
  requirePermission('presentations', 'write'),
  validateMultiple({ params: presentationIdParamSchema, body: generateDescriptionsSchema }),
  async (req, res, next) => {
    try {
      const { companyId, sub: userId } = req.user!
      const { config: presConfig } = await loadPresentationWithConfig(req.params.id, companyId)

      const existingPages = await presentationService.getPages(req.params.id, companyId)
      if (!existingPages || existingPages.length === 0) {
        throw new ValidationError('No pages exist for this presentation. Generate outline first.')
      }

      const pages = existingPages.map((p) => ({
        pageId: p.id,
        outlineContent: p.outlineContent as OutlineContentInput
      }))

      const taskId = await presentationTaskService.submitGenerateDescriptions(
        companyId,
        req.params.id,
        userId,
        { ...presConfig, ...req.body.config },
        pages
      )

      logger.info({ presentationId: req.params.id, taskId }, 'Generate descriptions task submitted')
      res.status(202).json(createSuccessResponse({ taskId }))
    } catch (err) {
      next(err)
    }
  }
)

/** POST /:id/refine-descriptions — 优化描述 */
router.post(
  '/:id/refine-descriptions',
  requirePermission('presentations', 'write'),
  validateMultiple({ params: presentationIdParamSchema, body: refineDescriptionsSchema }),
  async (req, res, next) => {
    try {
      const { companyId, sub: userId } = req.user!
      const { config: presConfig } = await loadPresentationWithConfig(req.params.id, companyId)

      const existingPages = await presentationService.getPages(req.params.id, companyId)
      if (!existingPages || existingPages.length === 0) {
        throw new ValidationError('No pages exist for this presentation')
      }

      // 如果指定了 pageIds 则只处理指定页面
      const targetPageIds = req.body.pageIds as string[] | undefined
      const filteredPages = targetPageIds ? existingPages.filter((p) => targetPageIds.includes(p.id)) : existingPages

      const pages = filteredPages.map((p) => ({
        pageId: p.id,
        outlineContent: p.outlineContent as OutlineContentInput,
        descriptionContent: p.descriptionContent as DescriptionContentInput
      }))

      const taskId = await presentationTaskService.submitRefineDescriptions(
        companyId,
        req.params.id,
        userId,
        presConfig,
        req.body,
        pages
      )

      logger.info({ presentationId: req.params.id, taskId }, 'Refine descriptions task submitted')
      res.status(202).json(createSuccessResponse({ taskId }))
    } catch (err) {
      next(err)
    }
  }
)

/** POST /:id/generate-images — 批量生成图像 */
router.post(
  '/:id/generate-images',
  requirePermission('presentations', 'write'),
  validateMultiple({ params: presentationIdParamSchema, body: generateImagesSchema }),
  async (req, res, next) => {
    try {
      const { companyId, sub: userId } = req.user!
      const { config: presConfig } = await loadPresentationWithConfig(req.params.id, companyId)

      const existingPages = await presentationService.getPages(req.params.id, companyId)
      if (!existingPages || existingPages.length === 0) {
        throw new ValidationError('No pages exist for this presentation')
      }

      const targetPageIds = req.body.pageIds as string[] | undefined
      const filteredPages = targetPageIds ? existingPages.filter((p) => targetPageIds.includes(p.id)) : existingPages

      const pages = filteredPages.map((p) => ({
        pageId: p.id,
        descriptionContent: p.descriptionContent as DescriptionContentInput
      }))

      const taskId = await presentationTaskService.submitGenerateImages(
        companyId,
        req.params.id,
        userId,
        { ...presConfig, ...req.body.config },
        pages
      )

      writeAuditLog({
        companyId,
        userId,
        action: 'generate_images',
        resourceId: req.params.id,
        details: { taskId, pageCount: pages.length },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      })
      logger.info({ presentationId: req.params.id, taskId }, 'Generate images task submitted')
      res.status(202).json(createSuccessResponse({ taskId }))
    } catch (err) {
      next(err)
    }
  }
)

/** POST /:id/pages/:pageId/generate-image — 单页图像生成 */
router.post(
  '/:id/pages/:pageId/generate-image',
  requirePermission('presentations', 'write'),
  validateMultiple({ params: presentationPageIdParamSchema, body: generateSingleImageSchema }),
  async (req, res, next) => {
    try {
      const { companyId, sub: userId } = req.user!
      const { config: presConfig } = await loadPresentationWithConfig(req.params.id, companyId)

      // 获取该页面的描述内容
      const page = await db.query.presentationPages.findFirst({
        where: eq(presentationPages.id, req.params.pageId)
      })
      if (!page || page.presentationId !== req.params.id) {
        throw new NotFoundError('Page not found')
      }

      const taskId = await presentationTaskService.submitGenerateSingleImage(
        companyId,
        req.params.id,
        userId,
        { ...presConfig, ...req.body.config },
        req.params.pageId,
        page.descriptionContent as DescriptionContentInput,
        req.body.prompt
      )

      logger.info(
        { presentationId: req.params.id, pageId: req.params.pageId, taskId },
        'Generate single image task submitted'
      )
      res.status(202).json(createSuccessResponse({ taskId }))
    } catch (err) {
      next(err)
    }
  }
)

/** POST /:id/pages/:pageId/edit-image — 编辑图像 */
router.post(
  '/:id/pages/:pageId/edit-image',
  requirePermission('presentations', 'write'),
  validateMultiple({ params: presentationPageIdParamSchema, body: editImageSchema }),
  async (req, res, next) => {
    try {
      const { companyId, sub: userId } = req.user!
      const { config: presConfig } = await loadPresentationWithConfig(req.params.id, companyId)

      const page = await db.query.presentationPages.findFirst({
        where: eq(presentationPages.id, req.params.pageId)
      })
      if (!page || page.presentationId !== req.params.id) {
        throw new NotFoundError('Page not found')
      }
      if (!page.generatedImageKey) {
        throw new ValidationError('Page has no generated image to edit')
      }

      const taskId = await presentationTaskService.submitEditImage(
        companyId,
        req.params.id,
        userId,
        presConfig,
        req.params.pageId,
        req.body,
        page.generatedImageKey
      )

      logger.info({ presentationId: req.params.id, pageId: req.params.pageId, taskId }, 'Edit image task submitted')
      res.status(202).json(createSuccessResponse({ taskId }))
    } catch (err) {
      next(err)
    }
  }
)

// ============ 导出 ============

/** POST /:id/export — 导出演示文稿 */
router.post(
  '/:id/export',
  requirePermission('presentations', 'export'),
  validateMultiple({ params: presentationIdParamSchema, body: exportPresentationSchema }),
  async (req, res, next) => {
    try {
      const { companyId, sub: userId } = req.user!
      const { config: presConfig } = await loadPresentationWithConfig(req.params.id, companyId)
      const { format } = req.body

      const submitMap = {
        pptx: () => presentationTaskService.submitExportPptx(companyId, req.params.id, userId, presConfig, req.body),
        pdf: () => presentationTaskService.submitExportPdf(companyId, req.params.id, userId, presConfig, req.body),
        editable_pptx: () =>
          presentationTaskService.submitExportEditablePptx(companyId, req.params.id, userId, presConfig, req.body)
      } as const

      const taskId = await submitMap[format as keyof typeof submitMap]()

      writeAuditLog({
        companyId,
        userId,
        action: 'export',
        resourceId: req.params.id,
        details: { format, taskId },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      })
      logger.info({ presentationId: req.params.id, format, taskId }, 'Export task submitted')
      res.status(202).json(createSuccessResponse({ taskId }))
    } catch (err) {
      next(err)
    }
  }
)

// ============ 演示文稿级别任务查询 ============

/** GET /:id/tasks — 获取演示文稿的所有任务 */
router.get(
  '/:id/tasks',
  requirePermission('presentations', 'read'),
  validate(presentationIdParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const { companyId } = req.user!
      const tasks = await presentationTaskService.getTasksByPresentation(req.params.id, companyId)
      res.json(createSuccessResponse(tasks))
    } catch (err) {
      next(err)
    }
  }
)

// ============ 参考文件管理 ============

/** POST /:id/reference-files — 上传参考文件 */
router.post(
  '/:id/reference-files',
  requirePermission('presentations', 'write'),
  uploadLimiter,
  validate(presentationIdParamSchema, 'params'),
  referenceUpload.single('file'),
  async (req, res, next) => {
    try {
      const { companyId, sub: userId } = req.user!
      const file = req.file

      if (!file) {
        throw new ValidationError('No file uploaded')
      }

      // 验证演示文稿存在
      await loadPresentationWithConfig(req.params.id, companyId)

      const record = await presentationFileService.uploadReferenceFile({
        companyId,
        userId,
        presentationId: req.params.id,
        fileName: file.originalname,
        buffer: file.buffer,
        fileSize: file.size
      })

      logger.info({ referenceFileId: record.id, presentationId: req.params.id }, 'Reference file uploaded via API')
      res.status(201).json(createSuccessResponse(record))
    } catch (err) {
      next(err)
    }
  }
)

/** POST /:id/reference-files/:referenceFileId/parse — 触发参考文件解析 */
router.post(
  '/:id/reference-files/:referenceFileId/parse',
  requirePermission('presentations', 'write'),
  validate(referenceFileActionParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const { companyId, sub: userId } = req.user!
      const { config: presConfig } = await loadPresentationWithConfig(req.params.id, companyId)

      const fileBuffer = await presentationFileService.downloadReferenceFile(req.params.referenceFileId, companyId)

      const taskId = await presentationTaskService.submitParseReferenceFile(
        companyId,
        req.params.id,
        userId,
        presConfig,
        fileBuffer,
        req.params.referenceFileId
      )

      logger.info(
        { presentationId: req.params.id, referenceFileId: req.params.referenceFileId, taskId },
        'Parse reference file task submitted'
      )
      res.status(202).json(createSuccessResponse({ taskId }))
    } catch (err) {
      next(err)
    }
  }
)

// ============ 图像版本管理 ============

/** GET /:id/pages/:pageId/versions — 获取页面所有图像版本 */
router.get(
  '/:id/pages/:pageId/versions',
  requirePermission('presentations', 'read'),
  validate(presentationPageIdParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const { companyId } = req.user!

      // 验证演示文稿归属
      await loadPresentationWithConfig(req.params.id, companyId)

      const versions = await presentationService.getImageVersions(req.params.id, req.params.pageId)
      if (!versions) {
        throw new NotFoundError('Page not found in this presentation')
      }
      res.json(createSuccessResponse(versions))
    } catch (err) {
      next(err)
    }
  }
)

/** PUT /:id/pages/:pageId/versions/:versionId — 切换当前图像版本 */
router.put(
  '/:id/pages/:pageId/versions/:versionId',
  requirePermission('presentations', 'write'),
  validate(imageVersionParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const { companyId } = req.user!

      // 验证演示文稿归属
      await loadPresentationWithConfig(req.params.id, companyId)

      const switched = await presentationService.switchImageVersion(
        req.params.id,
        req.params.pageId,
        req.params.versionId
      )
      if (!switched) {
        throw new NotFoundError('Image version not found')
      }
      res.json(createSuccessResponse(switched))
    } catch (err) {
      next(err)
    }
  }
)

export default router
