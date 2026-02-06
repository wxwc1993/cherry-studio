import {
  createDepartmentSchema,
  createSuccessResponse,
  generateDepartmentPath,
  updateDepartmentSchema} from '@cherry-studio/enterprise-shared'
import { and, eq, sql } from 'drizzle-orm'
import { Router } from 'express'

import { authenticate, requirePermission } from '../middleware/auth'
import { ConflictError,NotFoundError } from '../middleware/errorHandler'
import { validate } from '../middleware/validate'
import { db, departments, users } from '../models'
import { createLogger } from '../utils/logger'

const router = Router()
const logger = createLogger('DepartmentRoutes')

router.use(authenticate)

/**
 * 获取部门树形结构
 * GET /departments/tree
 */
router.get('/tree', requirePermission('users', 'read'), async (req, res, next) => {
  try {
    const allDepartments = await db.query.departments.findMany({
      where: eq(departments.companyId, req.user!.companyId),
      orderBy: departments.order
    })

    // 构建树形结构
    const buildTree = (parentId: string | null): any[] => {
      return allDepartments
        .filter((d) => d.parentId === parentId)
        .map((d) => ({
          id: d.id,
          name: d.name,
          order: d.order,
          children: buildTree(d.id)
        }))
    }

    const tree = buildTree(null)

    res.json(createSuccessResponse(tree))
  } catch (err) {
    next(err)
  }
})

/**
 * 获取部门列表
 * GET /departments
 */
router.get('/', requirePermission('users', 'read'), async (req, res, next) => {
  try {
    const departmentList = await db.query.departments.findMany({
      where: eq(departments.companyId, req.user!.companyId),
      orderBy: departments.order
    })

    res.json(
      createSuccessResponse(
        departmentList.map((d) => ({
          id: d.id,
          name: d.name,
          parentId: d.parentId,
          path: d.path,
          order: d.order,
          createdAt: d.createdAt
        }))
      )
    )
  } catch (err) {
    next(err)
  }
})

/**
 * 获取单个部门
 * GET /departments/:id
 */
router.get('/:id', requirePermission('users', 'read'), async (req, res, next) => {
  try {
    const department = await db.query.departments.findFirst({
      where: and(eq(departments.id, req.params.id), eq(departments.companyId, req.user!.companyId))
    })

    if (!department) {
      throw new NotFoundError('Department')
    }

    // 获取部门用户数
    const [userCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.departmentId, department.id))

    res.json(
      createSuccessResponse({
        id: department.id,
        name: department.name,
        parentId: department.parentId,
        path: department.path,
        order: department.order,
        userCount: Number(userCount.count),
        createdAt: department.createdAt,
        updatedAt: department.updatedAt
      })
    )
  } catch (err) {
    next(err)
  }
})

/**
 * 获取部门下的用户
 * GET /departments/:id/users
 */
router.get('/:id/users', requirePermission('users', 'read'), async (req, res, next) => {
  try {
    const department = await db.query.departments.findFirst({
      where: and(eq(departments.id, req.params.id), eq(departments.companyId, req.user!.companyId))
    })

    if (!department) {
      throw new NotFoundError('Department')
    }

    const userList = await db.query.users.findMany({
      where: eq(users.departmentId, department.id),
      with: { role: true }
    })

    res.json(
      createSuccessResponse(
        userList.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          avatar: u.avatar,
          role: { id: u.role.id, name: u.role.name },
          status: u.status
        }))
      )
    )
  } catch (err) {
    next(err)
  }
})

/**
 * 创建部门
 * POST /departments
 */
router.post('/', requirePermission('users', 'admin'), validate(createDepartmentSchema), async (req, res, next) => {
  try {
    const data = req.body
    let parentPath = '/'

    if (data.parentId) {
      const parent = await db.query.departments.findFirst({
        where: and(eq(departments.id, data.parentId), eq(departments.companyId, req.user!.companyId))
      })

      if (!parent) {
        throw new NotFoundError('Parent department')
      }
      parentPath = parent.path
    }

    // 生成临时 ID 用于路径
    const tempId = crypto.randomUUID()
    const path = generateDepartmentPath(parentPath, tempId)

    const [newDepartment] = await db
      .insert(departments)
      .values({
        id: tempId,
        companyId: req.user!.companyId,
        parentId: data.parentId || null,
        name: data.name,
        path,
        order: data.order
      })
      .returning()

    logger.info({ departmentId: newDepartment.id, createdBy: req.user!.sub }, 'Department created')

    res.status(201).json(
      createSuccessResponse({
        id: newDepartment.id,
        name: newDepartment.name,
        parentId: newDepartment.parentId,
        path: newDepartment.path,
        order: newDepartment.order,
        createdAt: newDepartment.createdAt
      })
    )
  } catch (err) {
    next(err)
  }
})

/**
 * 更新部门
 * PATCH /departments/:id
 */
router.patch('/:id', requirePermission('users', 'admin'), validate(updateDepartmentSchema), async (req, res, next) => {
  try {
    const data = req.body

    const existing = await db.query.departments.findFirst({
      where: and(eq(departments.id, req.params.id), eq(departments.companyId, req.user!.companyId))
    })

    if (!existing) {
      throw new NotFoundError('Department')
    }

    // 如果更改父部门，需要更新路径
    let path = existing.path
    if (data.parentId !== undefined && data.parentId !== existing.parentId) {
      if (data.parentId === req.params.id) {
        throw new ConflictError('Department cannot be its own parent')
      }

      let parentPath = '/'
      if (data.parentId) {
        const parent = await db.query.departments.findFirst({
          where: and(eq(departments.id, data.parentId), eq(departments.companyId, req.user!.companyId))
        })

        if (!parent) {
          throw new NotFoundError('Parent department')
        }

        // 检查是否会形成循环
        if (parent.path.startsWith(existing.path)) {
          throw new ConflictError('Cannot move department to its descendant')
        }

        parentPath = parent.path
      }

      path = generateDepartmentPath(parentPath, existing.id)
    }

    const [updated] = await db
      .update(departments)
      .set({
        name: data.name ?? existing.name,
        parentId: data.parentId ?? existing.parentId,
        path,
        order: data.order ?? existing.order,
        updatedAt: new Date()
      })
      .where(eq(departments.id, req.params.id))
      .returning()

    logger.info({ departmentId: updated.id, updatedBy: req.user!.sub }, 'Department updated')

    res.json(createSuccessResponse(updated))
  } catch (err) {
    next(err)
  }
})

/**
 * 删除部门
 * DELETE /departments/:id
 */
router.delete('/:id', requirePermission('users', 'admin'), async (req, res, next) => {
  try {
    const existing = await db.query.departments.findFirst({
      where: and(eq(departments.id, req.params.id), eq(departments.companyId, req.user!.companyId))
    })

    if (!existing) {
      throw new NotFoundError('Department')
    }

    // 检查是否有子部门
    const childDepartments = await db.query.departments.findFirst({
      where: eq(departments.parentId, req.params.id)
    })

    if (childDepartments) {
      throw new ConflictError('Cannot delete department with child departments')
    }

    // 检查是否有用户
    const [userCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.departmentId, req.params.id))

    if (Number(userCount.count) > 0) {
      throw new ConflictError('Cannot delete department with users')
    }

    await db.delete(departments).where(eq(departments.id, req.params.id))

    logger.info({ departmentId: req.params.id, deletedBy: req.user!.sub }, 'Department deleted')

    res.json(createSuccessResponse({ message: 'Department deleted successfully' }))
  } catch (err) {
    next(err)
  }
})

export default router
