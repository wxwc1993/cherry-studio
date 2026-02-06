import { createRoleSchema, createSuccessResponse,updateRoleSchema } from '@cherry-studio/enterprise-shared'
import { desc,eq } from 'drizzle-orm'
import { Router } from 'express'

import { authenticate, requirePermission } from '../middleware/auth'
import { AuthorizationError,NotFoundError } from '../middleware/errorHandler'
import { validate } from '../middleware/validate'
import { db } from '../models/db'
import { roles } from '../models/schema'

const router = Router()

// 所有路由都需要认证
router.use(authenticate)

// 获取角色列表
router.get('/', requirePermission('users', 'read'), async (req, res, next) => {
  try {
    const result = await db.select().from(roles).orderBy(desc(roles.createdAt))

    res.json(
      createSuccessResponse(
        result.map((role) => ({
          id: role.id,
          name: role.name,
          description: role.description,
          permissions: role.permissions,
          isSystem: role.isSystem,
          createdAt: role.createdAt.toISOString()
        }))
      )
    )
  } catch (error) {
    next(error)
  }
})

// 获取单个角色
router.get('/:id', requirePermission('users', 'read'), async (req, res, next) => {
  try {
    const { id } = req.params

    const [role] = await db.select().from(roles).where(eq(roles.id, id))

    if (!role) {
      throw new NotFoundError('角色不存在')
    }

    res.json(
      createSuccessResponse({
        id: role.id,
        name: role.name,
        description: role.description,
        permissions: role.permissions,
        isSystem: role.isSystem,
        createdAt: role.createdAt.toISOString(),
        updatedAt: role.updatedAt.toISOString()
      })
    )
  } catch (error) {
    next(error)
  }
})

// 创建角色
router.post('/', requirePermission('users', 'admin'), validate(createRoleSchema), async (req, res, next) => {
  try {
    const { name, description, permissions } = req.body

    const [newRole] = await db
      .insert(roles)
      .values({
        companyId: req.user!.companyId,
        name,
        description,
        permissions: permissions || {},
        isSystem: false
      })
      .returning()

    res.status(201).json(
      createSuccessResponse({
        id: newRole.id,
        name: newRole.name,
        description: newRole.description,
        permissions: newRole.permissions,
        isSystem: newRole.isSystem,
        createdAt: newRole.createdAt.toISOString()
      })
    )
  } catch (error) {
    next(error)
  }
})

// 更新角色
router.patch('/:id', requirePermission('users', 'admin'), validate(updateRoleSchema), async (req, res, next) => {
  try {
    const { id } = req.params
    const { name, description, permissions } = req.body

    // 检查角色是否存在
    const [existingRole] = await db.select().from(roles).where(eq(roles.id, id))

    if (!existingRole) {
      throw new NotFoundError('角色不存在')
    }

    // 系统角色不允许修改
    if (existingRole.isSystem) {
      throw new AuthorizationError('系统角色不允许修改')
    }

    const updateData: Partial<typeof roles.$inferInsert> = {
      updatedAt: new Date()
    }

    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (permissions !== undefined) updateData.permissions = permissions

    const [updatedRole] = await db.update(roles).set(updateData).where(eq(roles.id, id)).returning()

    res.json(
      createSuccessResponse({
        id: updatedRole.id,
        name: updatedRole.name,
        description: updatedRole.description,
        permissions: updatedRole.permissions,
        isSystem: updatedRole.isSystem,
        updatedAt: updatedRole.updatedAt.toISOString()
      })
    )
  } catch (error) {
    next(error)
  }
})

// 删除角色
router.delete('/:id', requirePermission('users', 'admin'), async (req, res, next) => {
  try {
    const { id } = req.params

    // 检查角色是否存在
    const [existingRole] = await db.select().from(roles).where(eq(roles.id, id))

    if (!existingRole) {
      throw new NotFoundError('角色不存在')
    }

    // 系统角色不允许删除
    if (existingRole.isSystem) {
      throw new AuthorizationError('系统角色不允许删除')
    }

    await db.delete(roles).where(eq(roles.id, id))

    res.json(createSuccessResponse({ deleted: true }))
  } catch (error) {
    next(error)
  }
})

export default router
