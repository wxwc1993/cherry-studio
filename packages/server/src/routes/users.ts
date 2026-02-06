import {
  calculateOffset,
  createPagination,
  createSuccessResponse,
  createUserSchema,
  paginationParamsSchema,
  updateUserSchema
} from '@cherry-studio/enterprise-shared'
import { and, desc, eq, sql } from 'drizzle-orm'
import { Router } from 'express'

import { authenticate, requirePermission } from '../middleware/auth'
import { ConflictError, NotFoundError } from '../middleware/errorHandler'
import { validate } from '../middleware/validate'
import { db, departments, roles, users } from '../models'
import { createLogger } from '../utils/logger'

const router = Router()
const logger = createLogger('UserRoutes')

// 所有路由需要认证
router.use(authenticate)

/**
 * 获取用户列表
 * GET /users
 */
router.get(
  '/',
  requirePermission('users', 'read'),
  validate(paginationParamsSchema, 'query'),
  async (req, res, next) => {
    try {
      const params = req.query as any
      const offset = calculateOffset(params)

      const [userList, countResult] = await Promise.all([
        db.query.users.findMany({
          where: eq(users.companyId, req.user!.companyId),
          with: {
            department: true,
            role: true
          },
          limit: params.pageSize,
          offset,
          orderBy: desc(users.createdAt)
        }),
        db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.companyId, req.user!.companyId))
      ])

      const total = Number(countResult[0].count)

      res.json(
        createSuccessResponse(
          userList.map((user) => ({
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
            status: user.status,
            department: { id: user.department.id, name: user.department.name },
            role: { id: user.role.id, name: user.role.name },
            lastLoginAt: user.lastLoginAt,
            createdAt: user.createdAt
          })),
          createPagination(total, params)
        )
      )
    } catch (err) {
      next(err)
    }
  }
)

/**
 * 获取用户选项列表（用于下拉选择器）
 * GET /users/options
 */
router.get('/options', requirePermission('users', 'read'), async (req, res, next) => {
  try {
    const userList = await db.query.users.findMany({
      where: eq(users.companyId, req.user!.companyId),
      orderBy: users.name
    })

    res.json(
      createSuccessResponse(
        userList.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email
        }))
      )
    )
  } catch (err) {
    next(err)
  }
})

/**
 * 获取单个用户
 * GET /users/:id
 */
router.get('/:id', requirePermission('users', 'read'), async (req, res, next) => {
  try {
    const user = await db.query.users.findFirst({
      where: and(eq(users.id, req.params.id), eq(users.companyId, req.user!.companyId)),
      with: {
        department: true,
        role: true
      }
    })

    if (!user) {
      throw new NotFoundError('User')
    }

    res.json(
      createSuccessResponse({
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        status: user.status,
        feishuUserId: user.feishuUserId,
        department: { id: user.department.id, name: user.department.name },
        role: { id: user.role.id, name: user.role.name },
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      })
    )
  } catch (err) {
    next(err)
  }
})

/**
 * 创建用户
 * POST /users
 */
router.post('/', requirePermission('users', 'write'), validate(createUserSchema), async (req, res, next) => {
  try {
    const data = req.body

    // 检查邮箱是否已存在
    const existingUser = await db.query.users.findFirst({
      where: and(eq(users.email, data.email), eq(users.companyId, req.user!.companyId))
    })

    if (existingUser) {
      throw new ConflictError('Email already exists')
    }

    // 验证部门存在
    const department = await db.query.departments.findFirst({
      where: and(eq(departments.id, data.departmentId), eq(departments.companyId, req.user!.companyId))
    })

    if (!department) {
      throw new NotFoundError('Department')
    }

    // 验证角色存在
    const role = await db.query.roles.findFirst({
      where: and(eq(roles.id, data.roleId), eq(roles.companyId, req.user!.companyId))
    })

    if (!role) {
      throw new NotFoundError('Role')
    }

    const [newUser] = await db
      .insert(users)
      .values({
        companyId: req.user!.companyId,
        departmentId: data.departmentId,
        roleId: data.roleId,
        email: data.email,
        name: data.name,
        feishuUserId: data.feishuUserId
      })
      .returning()

    logger.info({ userId: newUser.id, createdBy: req.user!.sub }, 'User created')

    res.status(201).json(
      createSuccessResponse({
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        departmentId: newUser.departmentId,
        roleId: newUser.roleId,
        status: newUser.status,
        createdAt: newUser.createdAt
      })
    )
  } catch (err) {
    next(err)
  }
})

/**
 * 更新用户
 * PATCH /users/:id
 */
router.patch('/:id', requirePermission('users', 'write'), validate(updateUserSchema), async (req, res, next) => {
  try {
    const data = req.body

    // 检查用户存在
    const existingUser = await db.query.users.findFirst({
      where: and(eq(users.id, req.params.id), eq(users.companyId, req.user!.companyId))
    })

    if (!existingUser) {
      throw new NotFoundError('User')
    }

    // 如果更新邮箱，检查是否重复
    if (data.email && data.email !== existingUser.email) {
      const emailExists = await db.query.users.findFirst({
        where: and(eq(users.email, data.email), eq(users.companyId, req.user!.companyId))
      })

      if (emailExists) {
        throw new ConflictError('Email already exists')
      }
    }

    // 如果更新部门，验证部门存在
    if (data.departmentId && data.departmentId !== existingUser.departmentId) {
      const department = await db.query.departments.findFirst({
        where: and(eq(departments.id, data.departmentId), eq(departments.companyId, req.user!.companyId))
      })

      if (!department) {
        throw new NotFoundError('Department')
      }
    }

    // 如果更新角色，验证角色存在
    if (data.roleId && data.roleId !== existingUser.roleId) {
      const role = await db.query.roles.findFirst({
        where: and(eq(roles.id, data.roleId), eq(roles.companyId, req.user!.companyId))
      })

      if (!role) {
        throw new NotFoundError('Role')
      }
    }

    const [updatedUser] = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(users.id, req.params.id))
      .returning()

    logger.info({ userId: updatedUser.id, updatedBy: req.user!.sub }, 'User updated')

    res.json(
      createSuccessResponse({
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        status: updatedUser.status,
        updatedAt: updatedUser.updatedAt
      })
    )
  } catch (err) {
    next(err)
  }
})

/**
 * 删除用户
 * DELETE /users/:id
 */
router.delete('/:id', requirePermission('users', 'admin'), async (req, res, next) => {
  try {
    // 不能删除自己
    if (req.params.id === req.user!.sub) {
      throw new ConflictError('Cannot delete yourself')
    }

    const existingUser = await db.query.users.findFirst({
      where: and(eq(users.id, req.params.id), eq(users.companyId, req.user!.companyId))
    })

    if (!existingUser) {
      throw new NotFoundError('User')
    }

    await db.delete(users).where(eq(users.id, req.params.id))

    logger.info({ userId: req.params.id, deletedBy: req.user!.sub }, 'User deleted')

    res.json(createSuccessResponse({ message: 'User deleted successfully' }))
  } catch (err) {
    next(err)
  }
})

export default router
