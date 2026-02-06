import { createSuccessResponse, usageQuerySchema } from '@cherry-studio/enterprise-shared'
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { Router } from 'express'

import { authenticate, requirePermission } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { conversations, db, models, usageLogs, users } from '../models'
import { createLogger } from '../utils/logger'

const router = Router()
const _logger = createLogger('StatisticsRoutes')

router.use(authenticate)
router.use(requirePermission('statistics', 'read'))

/**
 * 获取总览统计
 * GET /statistics/overview
 */
router.get('/overview', async (req, res, next) => {
  try {
    const companyId = req.user!.companyId

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

    const [totalUsers, activeUsers, totalModels, totalConversations, todayUsage, monthUsage, totalUsage] =
      await Promise.all([
        // 总用户数
        db
          .select({ count: sql<number>`count(*)` })
          .from(users)
          .where(eq(users.companyId, companyId)),

        // 本月活跃用户数
        db
          .select({ count: sql<number>`count(distinct user_id)` })
          .from(usageLogs)
          .where(and(eq(usageLogs.companyId, companyId), gte(usageLogs.createdAt, monthStart))),

        // 模型数
        db
          .select({ count: sql<number>`count(*)` })
          .from(models)
          .where(eq(models.companyId, companyId)),

        // 对话数
        db
          .select({ count: sql<number>`count(*)` })
          .from(conversations)
          .innerJoin(users, eq(conversations.userId, users.id))
          .where(eq(users.companyId, companyId)),

        // 今日用量
        db
          .select({
            requests: sql<number>`count(*)`,
            tokens: sql<number>`sum(total_tokens)`,
            cost: sql<number>`sum(cost)`
          })
          .from(usageLogs)
          .where(and(eq(usageLogs.companyId, companyId), gte(usageLogs.createdAt, today))),

        // 本月用量
        db
          .select({
            requests: sql<number>`count(*)`,
            tokens: sql<number>`sum(total_tokens)`,
            cost: sql<number>`sum(cost)`
          })
          .from(usageLogs)
          .where(and(eq(usageLogs.companyId, companyId), gte(usageLogs.createdAt, monthStart))),

        // 总用量
        db
          .select({
            requests: sql<number>`count(*)`,
            tokens: sql<number>`sum(total_tokens)`,
            cost: sql<number>`sum(cost)`
          })
          .from(usageLogs)
          .where(eq(usageLogs.companyId, companyId))
      ])

    res.json(
      createSuccessResponse({
        users: {
          total: Number(totalUsers[0].count),
          active: Number(activeUsers[0].count)
        },
        models: Number(totalModels[0].count),
        conversations: Number(totalConversations[0].count),
        usage: {
          today: {
            requests: Number(todayUsage[0].requests || 0),
            tokens: Number(todayUsage[0].tokens || 0),
            cost: Number(todayUsage[0].cost || 0)
          },
          month: {
            requests: Number(monthUsage[0].requests || 0),
            tokens: Number(monthUsage[0].tokens || 0),
            cost: Number(monthUsage[0].cost || 0)
          },
          total: {
            requests: Number(totalUsage[0].requests || 0),
            tokens: Number(totalUsage[0].tokens || 0),
            cost: Number(totalUsage[0].cost || 0)
          }
        }
      })
    )
  } catch (err) {
    next(err)
  }
})

/**
 * 获取用量趋势
 * GET /statistics/usage
 */
router.get('/usage', validate(usageQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { startDate, endDate, groupBy, userId, modelId } = req.query as any
    const companyId = req.user!.companyId

    let groupByClause: string

    switch (groupBy) {
      case 'week':
        groupByClause = `date_trunc('week', created_at)`
        break
      case 'month':
        groupByClause = `date_trunc('month', created_at)`
        break
      case 'day':
      default:
        groupByClause = `date_trunc('day', created_at)`
    }

    const conditions = [
      eq(usageLogs.companyId, companyId),
      gte(usageLogs.createdAt, new Date(startDate)),
      lte(usageLogs.createdAt, new Date(endDate))
    ]

    if (userId) conditions.push(eq(usageLogs.userId, userId))
    if (modelId) conditions.push(eq(usageLogs.modelId, modelId))

    const result = await db
      .select({
        date: sql<string>`${sql.raw(groupByClause)}::date`,
        requests: sql<number>`count(*)`,
        tokens: sql<number>`sum(total_tokens)`,
        cost: sql<number>`sum(cost)`,
        avgLatency: sql<number>`avg(duration)`
      })
      .from(usageLogs)
      .where(and(...conditions))
      .groupBy(sql`${sql.raw(groupByClause)}`)
      .orderBy(sql`${sql.raw(groupByClause)}`)

    res.json(
      createSuccessResponse(
        result.map((r) => ({
          date: r.date,
          requests: Number(r.requests),
          tokens: Number(r.tokens || 0),
          cost: Number(r.cost || 0),
          avgLatency: Math.round(Number(r.avgLatency || 0))
        }))
      )
    )
  } catch (err) {
    next(err)
  }
})

/**
 * 按模型统计
 * GET /statistics/models
 */
router.get('/models', validate(usageQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query as any
    const companyId = req.user!.companyId

    const result = await db
      .select({
        modelId: usageLogs.modelId,
        modelName: models.displayName,
        requests: sql<number>`count(*)`,
        tokens: sql<number>`sum(${usageLogs.totalTokens})`,
        cost: sql<number>`sum(${usageLogs.cost})`,
        avgLatency: sql<number>`avg(${usageLogs.duration})`
      })
      .from(usageLogs)
      .innerJoin(models, eq(usageLogs.modelId, models.id))
      .where(
        and(
          eq(usageLogs.companyId, companyId),
          gte(usageLogs.createdAt, new Date(startDate)),
          lte(usageLogs.createdAt, new Date(endDate))
        )
      )
      .groupBy(usageLogs.modelId, models.displayName)
      .orderBy(desc(sql`count(*)`))

    res.json(
      createSuccessResponse(
        result.map((r) => ({
          modelId: r.modelId,
          modelName: r.modelName,
          requests: Number(r.requests),
          tokens: Number(r.tokens || 0),
          cost: Number(r.cost || 0),
          avgLatency: Math.round(Number(r.avgLatency || 0))
        }))
      )
    )
  } catch (err) {
    next(err)
  }
})

/**
 * 按用户统计
 * GET /statistics/users
 */
router.get('/users', validate(usageQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query as any
    const companyId = req.user!.companyId

    const result = await db
      .select({
        userId: usageLogs.userId,
        userName: users.name,
        requests: sql<number>`count(*)`,
        tokens: sql<number>`sum(${usageLogs.totalTokens})`,
        cost: sql<number>`sum(${usageLogs.cost})`
      })
      .from(usageLogs)
      .innerJoin(users, eq(usageLogs.userId, users.id))
      .where(
        and(
          eq(usageLogs.companyId, companyId),
          gte(usageLogs.createdAt, new Date(startDate)),
          lte(usageLogs.createdAt, new Date(endDate))
        )
      )
      .groupBy(usageLogs.userId, users.name)
      .orderBy(desc(sql`sum(${usageLogs.totalTokens})`))
      .limit(50)

    res.json(
      createSuccessResponse(
        result.map((r) => ({
          userId: r.userId,
          userName: r.userName,
          requests: Number(r.requests),
          tokens: Number(r.tokens || 0),
          cost: Number(r.cost || 0)
        }))
      )
    )
  } catch (err) {
    next(err)
  }
})

/**
 * 导出统计数据
 * GET /statistics/export
 */
router.get(
  '/export',
  requirePermission('statistics', 'export'),
  validate(usageQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const { startDate, endDate } = req.query as any
      const companyId = req.user!.companyId

      const result = await db
        .select({
          date: usageLogs.createdAt,
          userName: users.name,
          userEmail: users.email,
          modelName: models.displayName,
          inputTokens: usageLogs.inputTokens,
          outputTokens: usageLogs.outputTokens,
          totalTokens: usageLogs.totalTokens,
          cost: usageLogs.cost,
          duration: usageLogs.duration
        })
        .from(usageLogs)
        .innerJoin(users, eq(usageLogs.userId, users.id))
        .innerJoin(models, eq(usageLogs.modelId, models.id))
        .where(
          and(
            eq(usageLogs.companyId, companyId),
            gte(usageLogs.createdAt, new Date(startDate)),
            lte(usageLogs.createdAt, new Date(endDate))
          )
        )
        .orderBy(usageLogs.createdAt)

      // 生成 CSV
      const headers = [
        'Date',
        'User',
        'Email',
        'Model',
        'Input Tokens',
        'Output Tokens',
        'Total Tokens',
        'Cost',
        'Duration (ms)'
      ]
      const rows = result.map((r) => [
        r.date.toISOString(),
        r.userName,
        r.userEmail,
        r.modelName,
        r.inputTokens,
        r.outputTokens,
        r.totalTokens,
        r.cost.toFixed(6),
        r.duration
      ])

      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')

      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename=usage_${startDate}_${endDate}.csv`)
      res.send(csv)
    } catch (err) {
      next(err)
    }
  }
)

export default router
