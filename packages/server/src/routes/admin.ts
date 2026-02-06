import {
  auditLogQuerySchema,
  BACKUP_CONFIG,
  companySettingsSchema,
  createBackupSchema,
  createSuccessResponse,
  restoreBackupSchema
} from '@cherry-studio/enterprise-shared'
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { Router } from 'express'
import Redis from 'ioredis'

import { authenticate, requirePermission } from '../middleware/auth'
import { NotFoundError } from '../middleware/errorHandler'
import { validate } from '../middleware/validate'
import { auditLogs, backups, companies, db } from '../models'
import { backupService } from '../services/backup.service'
import { getStorageService } from '../services/storage'
import { createLogger } from '../utils/logger'

const router = Router()
const logger = createLogger('AdminRoutes')

router.use(authenticate)

/**
 * 健康检查
 * GET /admin/health
 */
router.get('/health', async (_req, res, _next) => {
  const services: Record<string, 'ok' | 'error'> = {
    database: 'error',
    redis: 'error',
    storage: 'error',
    pgvector: 'error'
  }

  try {
    // 检查数据库连接
    await db.execute('SELECT 1')
    services.database = 'ok'

    // 检查 pgvector 扩展
    try {
      await db.execute("SELECT '[1,2,3]'::vector")
      services.pgvector = 'ok'
    } catch {
      services.pgvector = 'error'
    }

    // 检查 Redis 连接
    try {
      const redisUrl = process.env.REDIS_URL
      if (redisUrl) {
        const redis = new Redis(redisUrl)
        const pong = await redis.ping()
        if (pong === 'PONG') {
          services.redis = 'ok'
        }
        await redis.quit()
      } else {
        services.redis = 'error'
      }
    } catch {
      services.redis = 'error'
    }

    // 检查存储服务连接
    try {
      const storage = getStorageService()
      const healthy = await storage.healthCheck()
      services.storage = healthy ? 'ok' : 'error'
    } catch {
      services.storage = 'error'
    }

    const allHealthy = Object.values(services).every((s) => s === 'ok')

    res.status(allHealthy ? 200 : 503).json(
      createSuccessResponse({
        status: allHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        services
      })
    )
  } catch (err) {
    res.status(503).json(
      createSuccessResponse({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        services,
        error: err instanceof Error ? err.message : 'Unknown error'
      })
    )
  }
})

/**
 * 获取备份列表
 * GET /admin/backups
 */
router.get('/backups', requirePermission('system', 'backup'), async (req, res, next) => {
  try {
    const backupList = await db.query.backups.findMany({
      where: eq(backups.companyId, req.user!.companyId),
      orderBy: desc(backups.createdAt),
      limit: 50
    })

    res.json(
      createSuccessResponse(
        backupList.map((b) => ({
          id: b.id,
          type: b.type,
          status: b.status,
          fileSize: b.fileSize,
          startedAt: b.startedAt,
          completedAt: b.completedAt,
          errorMessage: b.errorMessage
        }))
      )
    )
  } catch (err) {
    next(err)
  }
})

/**
 * 创建备份
 * POST /admin/backup
 */
router.post('/backup', requirePermission('system', 'backup'), validate(createBackupSchema), async (req, res, next) => {
  try {
    const data = req.body

    logger.info({ type: data.type, createdBy: req.user!.sub }, 'Backup initiated')

    // 使用备份服务创建备份（异步执行）
    const backupPromise = backupService.createBackup(req.user!.companyId, {
      type: data.type,
      includeConversations: data.includeConversations ?? true,
      includeKnowledgeBases: data.includeKnowledgeBases ?? true
    })

    // 不等待备份完成，立即返回
    backupPromise.catch((err) => {
      logger.error({ err }, 'Async backup failed')
    })

    res.status(202).json(
      createSuccessResponse({
        message: 'Backup initiated',
        type: data.type
      })
    )
  } catch (err) {
    next(err)
  }
})

/**
 * 恢复备份
 * POST /admin/restore
 */
router.post(
  '/restore',
  requirePermission('system', 'restore'),
  validate(restoreBackupSchema),
  async (req, res, next) => {
    try {
      const { backupId, restoreConversations, restoreKnowledgeBases } = req.body

      logger.info({ backupId, restoredBy: req.user!.sub }, 'Restore initiated')

      // 使用备份服务恢复备份（异步执行）
      const restorePromise = backupService.restore(req.user!.companyId, {
        backupId,
        restoreConversations: restoreConversations ?? true,
        restoreKnowledgeBases: restoreKnowledgeBases ?? true
      })

      // 不等待恢复完成，立即返回
      restorePromise.catch((err) => {
        logger.error({ backupId, err }, 'Async restore failed')
      })

      res.status(202).json(
        createSuccessResponse({
          message: 'Restore initiated',
          backupId
        })
      )
    } catch (err) {
      next(err)
    }
  }
)

/**
 * 获取企业设置
 * GET /admin/settings
 */
router.get('/settings', requirePermission('system', 'settings'), async (req, res, next) => {
  try {
    const company = await db.query.companies.findFirst({
      where: eq(companies.id, req.user!.companyId)
    })

    if (!company) {
      throw new NotFoundError('Company')
    }

    res.json(
      createSuccessResponse({
        id: company.id,
        name: company.name,
        settings: company.settings,
        createdAt: company.createdAt
      })
    )
  } catch (err) {
    next(err)
  }
})

/**
 * 更新企业设置
 * PATCH /admin/settings
 */
router.patch(
  '/settings',
  requirePermission('system', 'settings'),
  validate(companySettingsSchema),
  async (req, res, next) => {
    try {
      const data = req.body

      const [updated] = await db
        .update(companies)
        .set({
          settings: data,
          updatedAt: new Date()
        })
        .where(eq(companies.id, req.user!.companyId))
        .returning()

      logger.info({ companyId: updated.id, updatedBy: req.user!.sub }, 'Company settings updated')

      res.json(
        createSuccessResponse({
          id: updated.id,
          settings: updated.settings
        })
      )
    } catch (err) {
      next(err)
    }
  }
)

/**
 * 清理过期备份
 * POST /admin/cleanup-backups
 */
router.post('/cleanup-backups', requirePermission('system', 'backup'), async (req, res, next) => {
  try {
    const deletedCount = await backupService.cleanupExpiredBackups(
      req.user!.companyId,
      BACKUP_CONFIG.DAILY_RETENTION_DAYS
    )

    logger.info({ count: deletedCount, cleanedBy: req.user!.sub }, 'Expired backups cleaned')

    res.json(
      createSuccessResponse({
        message: `Cleaned ${deletedCount} expired backups`
      })
    )
  } catch (err) {
    next(err)
  }
})

/**
 * 获取备份下载链接
 * GET /admin/backups/:id/download
 */
router.get('/backups/:id/download', requirePermission('system', 'backup'), async (req, res, next) => {
  try {
    const downloadUrl = await backupService.getDownloadUrl(req.params.id, req.user!.companyId)

    res.json(
      createSuccessResponse({
        downloadUrl,
        expiresIn: 3600
      })
    )
  } catch (err) {
    next(err)
  }
})

/**
 * 删除备份
 * DELETE /admin/backups/:id
 */
router.delete('/backups/:id', requirePermission('system', 'backup'), async (req, res, next) => {
  try {
    await backupService.deleteBackup(req.params.id, req.user!.companyId)

    logger.info({ backupId: req.params.id, deletedBy: req.user!.sub }, 'Backup deleted')

    res.json(
      createSuccessResponse({
        message: 'Backup deleted successfully'
      })
    )
  } catch (err) {
    next(err)
  }
})

// ============ 审计日志 ============

/**
 * 获取审计日志列表
 * GET /admin/audit-logs
 *
 * Query params:
 * - page: 页码 (default: 1)
 * - limit: 每页数量 (default: 50, max: 100)
 * - userId: 按用户筛选
 * - action: 按操作筛选 (login, logout, create, update, delete)
 * - resource: 按资源筛选 (user, model, knowledge_base, etc.)
 * - startDate: 开始时间 (ISO 8601)
 * - endDate: 结束时间 (ISO 8601)
 */
router.get(
  '/audit-logs',
  requirePermission('system', 'audit'),
  validate(auditLogQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1)
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50))
      const offset = (page - 1) * limit

      const { userId, action, resource, startDate, endDate } = req.query

      // 构建查询条件
      const conditions = [eq(auditLogs.companyId, req.user!.companyId)]

      if (userId && typeof userId === 'string') {
        conditions.push(eq(auditLogs.userId, userId))
      }
      if (action && typeof action === 'string') {
        conditions.push(eq(auditLogs.action, action))
      }
      if (resource && typeof resource === 'string') {
        conditions.push(eq(auditLogs.resource, resource))
      }
      if (startDate && typeof startDate === 'string') {
        conditions.push(gte(auditLogs.createdAt, new Date(startDate)))
      }
      if (endDate && typeof endDate === 'string') {
        conditions.push(lte(auditLogs.createdAt, new Date(endDate)))
      }

      // 执行查询
      const logs = await db.query.auditLogs.findMany({
        where: and(...conditions),
        orderBy: desc(auditLogs.createdAt),
        limit,
        offset,
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      })

      // 获取总数
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(auditLogs)
        .where(and(...conditions))

      const total = countResult?.count || 0

      res.json(
        createSuccessResponse({
          data: logs.map((log) => ({
            id: log.id,
            userId: log.userId,
            userName: log.user?.name,
            userEmail: log.user?.email,
            action: log.action,
            resource: log.resource,
            resourceId: log.resourceId,
            details: log.details,
            ipAddress: log.ipAddress,
            userAgent: log.userAgent,
            status: log.status,
            errorMessage: log.errorMessage,
            createdAt: log.createdAt
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        })
      )
    } catch (err) {
      next(err)
    }
  }
)

/**
 * 获取审计日志统计
 * GET /admin/audit-logs/stats
 */
router.get('/audit-logs/stats', requirePermission('system', 'audit'), async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query

    const conditions = [eq(auditLogs.companyId, req.user!.companyId)]

    if (startDate && typeof startDate === 'string') {
      conditions.push(gte(auditLogs.createdAt, new Date(startDate)))
    }
    if (endDate && typeof endDate === 'string') {
      conditions.push(lte(auditLogs.createdAt, new Date(endDate)))
    }

    // 按操作类型统计
    const actionStats = await db
      .select({
        action: auditLogs.action,
        count: sql<number>`count(*)::int`
      })
      .from(auditLogs)
      .where(and(...conditions))
      .groupBy(auditLogs.action)

    // 按资源类型统计
    const resourceStats = await db
      .select({
        resource: auditLogs.resource,
        count: sql<number>`count(*)::int`
      })
      .from(auditLogs)
      .where(and(...conditions))
      .groupBy(auditLogs.resource)

    // 按状态统计
    const statusStats = await db
      .select({
        status: auditLogs.status,
        count: sql<number>`count(*)::int`
      })
      .from(auditLogs)
      .where(and(...conditions))
      .groupBy(auditLogs.status)

    res.json(
      createSuccessResponse({
        byAction: actionStats,
        byResource: resourceStats,
        byStatus: statusStats
      })
    )
  } catch (err) {
    next(err)
  }
})

export default router
