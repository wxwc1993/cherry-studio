import { createSuccessResponse, usageQuerySchema } from '@cherry-studio/enterprise-shared'
import { and, desc, eq, gte, isNotNull, lte, sql } from 'drizzle-orm'
import { Router } from 'express'

import { authenticate, requirePermission } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { assistantPresets, db, departments, models, usageLogs, users } from '../models'
import { createLogger } from '../utils/logger'

const router = Router()
const logger = createLogger('StatisticsRoutes')

/**
 * 将日期转换为 UTC 当天 00:00:00.000
 * 使用 UTC 方法避免服务器本地时区偏移导致查询范围错误
 */
function toStartOfDayUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0))
}

/**
 * 将日期转换为 UTC 当天 23:59:59.999
 * 使用 UTC 方法避免服务器本地时区偏移导致查询范围错误
 */
function toEndOfDayUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999))
}

/**
 * 统一费用聚合表达式（CNY）
 * USD 按固定汇率 $1 = ¥7 转换
 */
const costCnySql = sql<number>`sum(CASE WHEN ${usageLogs.currency} = 'USD' THEN ${usageLogs.cost} * 7 ELSE ${usageLogs.cost} END)`
const conversationCountSql = sql<number>`count(distinct ${usageLogs.conversationId})`.mapWith(Number)

router.use(authenticate)
router.use(requirePermission('statistics', 'read'))

/**
 * 获取总览统计
 * GET /statistics/overview
 */
router.get('/overview', async (req, res, next) => {
  try {
    const companyId = req.user!.companyId

    const now = new Date()
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))

    const [totalUsers, activeUsers, totalModels, todayUsage, monthUsage, totalUsage] = await Promise.all([
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

      // 今日用量
      db
        .select({
          messages: sql<number>`count(*)`.mapWith(Number),
          conversations: conversationCountSql,
          tokens: sql<number>`sum(total_tokens)`,
          cost: costCnySql
        })
        .from(usageLogs)
        .where(and(eq(usageLogs.companyId, companyId), gte(usageLogs.createdAt, today))),

      // 本月用量
      db
        .select({
          messages: sql<number>`count(*)`.mapWith(Number),
          conversations: conversationCountSql,
          tokens: sql<number>`sum(total_tokens)`,
          cost: costCnySql
        })
        .from(usageLogs)
        .where(and(eq(usageLogs.companyId, companyId), gte(usageLogs.createdAt, monthStart))),

      // 总用量
      db
        .select({
          messages: sql<number>`count(*)`.mapWith(Number),
          conversations: conversationCountSql,
          tokens: sql<number>`sum(total_tokens)`,
          cost: costCnySql
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
        usage: {
          today: {
            messages: Number(todayUsage[0].messages || 0),
            conversations: Number(todayUsage[0].conversations || 0),
            tokens: Number(todayUsage[0].tokens || 0),
            cost: Number(todayUsage[0].cost || 0)
          },
          month: {
            messages: Number(monthUsage[0].messages || 0),
            conversations: Number(monthUsage[0].conversations || 0),
            tokens: Number(monthUsage[0].tokens || 0),
            cost: Number(monthUsage[0].cost || 0)
          },
          total: {
            messages: Number(totalUsage[0].messages || 0),
            conversations: Number(totalUsage[0].conversations || 0),
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
    const { startDate, endDate, groupBy, userId, modelId, departmentId, assistantPresetId } = req.query as any
    const companyId = req.user!.companyId

    logger.info({ query: req.query, companyId }, 'Statistics /usage request')

    let groupByClause: string

    switch (groupBy) {
      case 'week':
        groupByClause = `date_trunc('week', ${usageLogs.createdAt.name})`
        break
      case 'month':
        groupByClause = `date_trunc('month', ${usageLogs.createdAt.name})`
        break
      case 'day':
      default:
        groupByClause = `date_trunc('day', ${usageLogs.createdAt.name})`
    }

    const conditions: any[] = [
      eq(usageLogs.companyId, companyId),
      gte(usageLogs.createdAt, toStartOfDayUTC(new Date(startDate))),
      lte(usageLogs.createdAt, toEndOfDayUTC(new Date(endDate)))
    ]

    if (userId) conditions.push(eq(usageLogs.userId, userId))
    if (modelId) conditions.push(eq(usageLogs.modelId, modelId))
    if (assistantPresetId) conditions.push(eq(usageLogs.assistantPresetId, assistantPresetId))

    // 部门筛选需要 JOIN users + departments
    const needsDeptJoin = Boolean(departmentId)

    let query = db
      .select({
        date: sql<string>`${sql.raw(groupByClause)}::date`,
        messages: sql<number>`count(*)`.mapWith(Number),
        conversations: conversationCountSql,
        tokens: sql<number>`sum(${usageLogs.totalTokens})`,
        cost: costCnySql,
        avgLatency: sql<number>`avg(${usageLogs.duration})`
      })
      .from(usageLogs)

    if (needsDeptJoin) {
      query = query
        .leftJoin(users, eq(usageLogs.userId, users.id))
        .leftJoin(departments, eq(users.departmentId, departments.id)) as any

      // 通过 path LIKE 实现子部门递归包含
      const [dept] = await db
        .select({ path: departments.path })
        .from(departments)
        .where(eq(departments.id, departmentId))
      if (dept) {
        conditions.push(sql`${departments.path} LIKE ${dept.path + '%'}`)
      }
    }

    const result = await (query as any)
      .where(and(...conditions))
      .groupBy(sql`${sql.raw(groupByClause)}`)
      .orderBy(sql`${sql.raw(groupByClause)}`)

    logger.info({ resultCount: result.length, firstRow: result[0] }, 'Statistics /usage result')

    res.json(
      createSuccessResponse(
        result.map((r: any) => ({
          date: r.date,
          messages: Number(r.messages),
          conversations: Number(r.conversations || 0),
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
    const { startDate, endDate, departmentId } = req.query as any
    const companyId = req.user!.companyId

    logger.info({ query: req.query, companyId }, 'Statistics /models request')

    const conditions: any[] = [
      eq(usageLogs.companyId, companyId),
      gte(usageLogs.createdAt, toStartOfDayUTC(new Date(startDate))),
      lte(usageLogs.createdAt, toEndOfDayUTC(new Date(endDate)))
    ]

    let query = db
      .select({
        modelId: usageLogs.modelId,
        modelName: sql<string>`COALESCE(${models.displayName}, '已删除模型')`,
        messages: sql<number>`count(*)`.mapWith(Number),
        conversations: conversationCountSql,
        tokens: sql<number>`sum(${usageLogs.totalTokens})`,
        cost: costCnySql,
        avgLatency: sql<number>`avg(${usageLogs.duration})`
      })
      .from(usageLogs)
      .leftJoin(models, eq(usageLogs.modelId, models.id))

    if (departmentId) {
      query = query
        .leftJoin(users, eq(usageLogs.userId, users.id))
        .leftJoin(departments, eq(users.departmentId, departments.id)) as any

      const [dept] = await db
        .select({ path: departments.path })
        .from(departments)
        .where(eq(departments.id, departmentId))
      if (dept) {
        conditions.push(sql`${departments.path} LIKE ${dept.path + '%'}`)
      }
    }

    const result = await (query as any)
      .where(and(...conditions))
      .groupBy(usageLogs.modelId, models.displayName)
      .orderBy(desc(sql`count(*)`))

    logger.info({ resultCount: result.length, firstRow: result[0] }, 'Statistics /models result')

    res.json(
      createSuccessResponse(
        result.map((r: any) => ({
          modelId: r.modelId,
          modelName: r.modelName ?? '已删除模型',
          messages: Number(r.messages),
          conversations: Number(r.conversations || 0),
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
    const { startDate, endDate, departmentId } = req.query as any
    const companyId = req.user!.companyId

    logger.info({ query: req.query, companyId }, 'Statistics /users request')

    const conditions: any[] = [
      eq(usageLogs.companyId, companyId),
      gte(usageLogs.createdAt, toStartOfDayUTC(new Date(startDate))),
      lte(usageLogs.createdAt, toEndOfDayUTC(new Date(endDate)))
    ]

    if (departmentId) {
      const [dept] = await db
        .select({ path: departments.path })
        .from(departments)
        .where(eq(departments.id, departmentId))
      if (dept) {
        conditions.push(sql`${departments.path} LIKE ${dept.path + '%'}`)
      }
    }

    const result = await db
      .select({
        userId: usageLogs.userId,
        userName: users.name,
        departmentName: departments.name,
        messages: sql<number>`count(*)`.mapWith(Number),
        conversations: conversationCountSql,
        tokens: sql<number>`sum(${usageLogs.totalTokens})`,
        cost: costCnySql
      })
      .from(usageLogs)
      .leftJoin(users, eq(usageLogs.userId, users.id))
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(and(...conditions))
      .groupBy(usageLogs.userId, users.name, departments.name)
      .orderBy(desc(sql`sum(${usageLogs.totalTokens})`))
      .limit(50)

    logger.info({ resultCount: result.length, firstRow: result[0] }, 'Statistics /users result')

    res.json(
      createSuccessResponse(
        result.map((r) => ({
          userId: r.userId,
          userName: r.userName ?? '未知用户',
          department: r.departmentName ?? '未分配部门',
          messages: Number(r.messages),
          conversations: Number(r.conversations || 0),
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
      const { startDate, endDate, departmentId } = req.query as any
      const companyId = req.user!.companyId

      const conditions: any[] = [
        eq(usageLogs.companyId, companyId),
        gte(usageLogs.createdAt, toStartOfDayUTC(new Date(startDate))),
        lte(usageLogs.createdAt, toEndOfDayUTC(new Date(endDate)))
      ]

      if (departmentId) {
        const [dept] = await db
          .select({ path: departments.path })
          .from(departments)
          .where(eq(departments.id, departmentId))
        if (dept) {
          conditions.push(sql`${departments.path} LIKE ${dept.path + '%'}`)
        }
      }

      const result = await db
        .select({
          date: usageLogs.createdAt,
          userName: users.name,
          userEmail: users.email,
          departmentName: departments.name,
          modelName: models.displayName,
          inputTokens: usageLogs.inputTokens,
          outputTokens: usageLogs.outputTokens,
          totalTokens: usageLogs.totalTokens,
          cost: sql<number>`CASE WHEN ${usageLogs.currency} = 'USD' THEN ${usageLogs.cost} * 7 ELSE ${usageLogs.cost} END`,
          duration: usageLogs.duration,
          conversationId: usageLogs.conversationId
        })
        .from(usageLogs)
        .leftJoin(users, eq(usageLogs.userId, users.id))
        .leftJoin(departments, eq(users.departmentId, departments.id))
        .leftJoin(models, eq(usageLogs.modelId, models.id))
        .where(and(...conditions))
        .orderBy(usageLogs.createdAt)

      // 生成 CSV
      const headers = [
        'Date',
        'User',
        'Email',
        'Department',
        'Model',
        'Input Tokens',
        'Output Tokens',
        'Total Tokens',
        'Cost',
        'Duration (ms)',
        'Conversation ID'
      ]
      const rows = result.map((r) => [
        r.date.toISOString(),
        r.userName ?? '',
        r.userEmail ?? '',
        r.departmentName ?? '',
        r.modelName ?? '',
        r.inputTokens,
        r.outputTokens,
        r.totalTokens,
        r.cost.toFixed(6),
        r.duration,
        r.conversationId ?? ''
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

/**
 * 按部门统计
 * GET /statistics/departments
 */
router.get('/departments', validate(usageQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { startDate, endDate, departmentId: filterDeptId } = req.query as any
    const companyId = req.user!.companyId

    logger.info({ query: req.query, companyId }, 'Statistics /departments request')

    const conditions: any[] = [
      eq(usageLogs.companyId, companyId),
      gte(usageLogs.createdAt, toStartOfDayUTC(new Date(startDate))),
      lte(usageLogs.createdAt, toEndOfDayUTC(new Date(endDate)))
    ]

    // 如果指定了部门，递归包含子部门
    if (filterDeptId) {
      const [dept] = await db
        .select({ path: departments.path })
        .from(departments)
        .where(eq(departments.id, filterDeptId))
      if (dept) {
        conditions.push(sql`${departments.path} LIKE ${dept.path + '%'}`)
      }
    }

    conditions.push(isNotNull(departments.id))

    const result = await db
      .select({
        departmentId: departments.id,
        departmentName: departments.name,
        path: departments.path,
        parentId: departments.parentId,
        messages: sql<number>`count(*)`.mapWith(Number),
        conversations: conversationCountSql,
        tokens: sql<number>`sum(${usageLogs.totalTokens})`,
        cost: costCnySql,
        userCount: sql<number>`count(distinct ${usageLogs.userId})`
      })
      .from(usageLogs)
      .leftJoin(users, eq(usageLogs.userId, users.id))
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(and(...conditions))
      .groupBy(departments.id, departments.name, departments.path, departments.parentId)
      .orderBy(desc(sql`count(*)`))

    logger.info({ resultCount: result.length, firstRow: result[0] }, 'Statistics /departments result')

    res.json(
      createSuccessResponse(
        result.map((r) => ({
          departmentId: r.departmentId,
          departmentName: r.departmentName,
          path: r.path,
          parentId: r.parentId,
          messages: Number(r.messages),
          conversations: Number(r.conversations || 0),
          tokens: Number(r.tokens || 0),
          cost: Number(r.cost || 0),
          userCount: Number(r.userCount)
        }))
      )
    )
  } catch (err) {
    next(err)
  }
})

/**
 * 助手预设使用统计
 * GET /statistics/assistant-presets
 */
router.get('/assistant-presets', validate(usageQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { startDate, endDate, departmentId } = req.query as any
    const companyId = req.user!.companyId

    logger.info({ query: req.query, companyId }, 'Statistics /assistant-presets request')

    const conditions: any[] = [
      eq(usageLogs.companyId, companyId),
      gte(usageLogs.createdAt, toStartOfDayUTC(new Date(startDate))),
      lte(usageLogs.createdAt, toEndOfDayUTC(new Date(endDate))),
      isNotNull(usageLogs.assistantPresetId)
    ]

    let query = db
      .select({
        presetId: usageLogs.assistantPresetId,
        presetName: assistantPresets.name,
        emoji: assistantPresets.emoji,
        messages: sql<number>`count(*)`.mapWith(Number),
        conversations: conversationCountSql,
        tokens: sql<number>`sum(${usageLogs.totalTokens})`,
        cost: costCnySql,
        uniqueUsers: sql<number>`count(distinct ${usageLogs.userId})`
      })
      .from(usageLogs)
      .leftJoin(assistantPresets, eq(usageLogs.assistantPresetId, assistantPresets.id))

    if (departmentId) {
      query = query
        .leftJoin(users, eq(usageLogs.userId, users.id))
        .leftJoin(departments, eq(users.departmentId, departments.id)) as any

      const [dept] = await db
        .select({ path: departments.path })
        .from(departments)
        .where(eq(departments.id, departmentId))
      if (dept) {
        conditions.push(sql`${departments.path} LIKE ${dept.path + '%'}`)
      }
    }

    const result = await (query as any)
      .where(and(...conditions))
      .groupBy(usageLogs.assistantPresetId, assistantPresets.name, assistantPresets.emoji)
      .orderBy(desc(sql`count(*)`))
      .limit(50)

    logger.info({ resultCount: result.length, firstRow: result[0] }, 'Statistics /assistant-presets result')

    res.json(
      createSuccessResponse(
        result.map((r: any) => ({
          presetId: r.presetId,
          presetName: r.presetName ?? '已删除预设',
          emoji: r.emoji,
          messages: Number(r.messages),
          conversations: Number(r.conversations || 0),
          tokens: Number(r.tokens || 0),
          cost: Number(r.cost || 0),
          uniqueUsers: Number(r.uniqueUsers)
        }))
      )
    )
  } catch (err) {
    next(err)
  }
})

export default router
