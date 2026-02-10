import type { CompanySettings } from '@cherry-studio/enterprise-shared'
import { eq } from 'drizzle-orm'

import { config } from '../config'
import { AppError, NotFoundError } from '../middleware/errorHandler'
import { auditLogs, companies, db, departments, roles, users } from '../models'
import { createLogger } from '../utils/logger'

const logger = createLogger('FeishuAutoRegister')

export interface FeishuAutoRegisterParams {
  feishuUserId: string
  feishuOpenId: string
  name: string
  avatarUrl?: string
  email?: string
  mobile?: string
}

/**
 * 飞书自动注册用户
 *
 * 1. 通过 config.feishu.appId 反查企业
 * 2. 检查企业 settings 中 feishuAutoRegister.enabled
 * 3. 检查企业用户上限
 * 4. 邮箱冲突处理：自动绑定飞书 ID 到已有账号
 * 5. 邮箱缺失处理：构造占位邮箱
 * 6. 创建用户
 * 7. 记录审计日志
 */
export async function autoRegisterFeishuUser(params: FeishuAutoRegisterParams) {
  const { feishuUserId, feishuOpenId, name, avatarUrl, email, mobile } = params

  // 1. 通过 feishuAppId 反查企业，找不到则回退到 yadea 企业
  let company = await db.query.companies.findFirst({
    where: eq(companies.feishuAppId, config.feishu.appId)
  })

  if (!company) {
    logger.warn({ feishuAppId: config.feishu.appId }, 'No company found by feishuAppId, falling back to yadea')
    company = await db.query.companies.findFirst({
      where: eq(companies.name, 'yadea')
    })
  }

  if (!company) {
    logger.warn({ feishuAppId: config.feishu.appId }, 'No company found (neither by feishuAppId nor yadea fallback)')
    throw new NotFoundError('User not registered. Please contact administrator.')
  }

  const settings = company.settings as CompanySettings

  // 2. 检查自动注册是否启用
  if (!settings.feishuAutoRegister?.enabled) {
    logger.info({ companyId: company.id }, 'Feishu auto-register is not enabled for this company')
    throw new NotFoundError('User not registered. Please contact administrator.')
  }

  const autoRegisterConfig = settings.feishuAutoRegister

  // 3. 检查企业用户上限
  if (settings.maxUsers) {
    const existingUsers = await db.query.users.findMany({
      where: eq(users.companyId, company.id)
    })

    if (existingUsers.length >= settings.maxUsers) {
      logger.warn(
        { companyId: company.id, currentUsers: existingUsers.length, maxUsers: settings.maxUsers },
        'Company user limit reached'
      )
      throw new AppError('QUOTA_5003', 'Company user limit reached. Please contact administrator.', 403)
    }
  }

  // 4. 验证默认部门和角色存在
  const defaultDepartment = await db.query.departments.findFirst({
    where: eq(departments.id, autoRegisterConfig.defaultDepartmentId)
  })

  if (!defaultDepartment) {
    logger.error(
      { departmentId: autoRegisterConfig.defaultDepartmentId, companyId: company.id },
      'Default department not found for auto-register'
    )
    throw new AppError('SYS_9001', 'Auto-register configuration error: default department not found', 500)
  }

  const defaultRole = await db.query.roles.findFirst({
    where: eq(roles.id, autoRegisterConfig.defaultRoleId)
  })

  if (!defaultRole) {
    logger.error(
      { roleId: autoRegisterConfig.defaultRoleId, companyId: company.id },
      'Default role not found for auto-register'
    )
    throw new AppError('SYS_9001', 'Auto-register configuration error: default role not found', 500)
  }

  // 5. 邮箱冲突处理
  const userEmail = email || `feishu_${feishuUserId}@auto.generated`

  if (email) {
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
      with: { role: true, department: true }
    })

    if (existingUser) {
      // 邮箱已存在 → 自动绑定飞书 ID
      logger.info(
        { userId: existingUser.id, feishuUserId, email },
        'Binding feishu account to existing user by email match'
      )

      await db
        .update(users)
        .set({
          feishuUserId,
          feishuOpenId,
          ...(mobile ? { mobile } : {}),
          ...(name ? { name } : {}),
          ...(avatarUrl ? { avatar: avatarUrl } : {}),
          lastLoginAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(users.id, existingUser.id))

      // 记录审计日志
      await db.insert(auditLogs).values({
        companyId: company.id,
        userId: existingUser.id,
        action: 'update',
        resource: 'user',
        resourceId: existingUser.id,
        details: { type: 'feishu_auto_bind', feishuUserId, feishuOpenId },
        status: 'success'
      })

      // 重新查询获取最新数据（含 role 和 department 关联）
      const updatedUser = await db.query.users.findFirst({
        where: eq(users.id, existingUser.id),
        with: { role: true, department: true }
      })

      return updatedUser!
    }
  }

  // 6. 创建新用户
  const [newUser] = await db
    .insert(users)
    .values({
      companyId: company.id,
      departmentId: autoRegisterConfig.defaultDepartmentId,
      roleId: autoRegisterConfig.defaultRoleId,
      feishuUserId,
      feishuOpenId,
      email: userEmail,
      name,
      avatar: avatarUrl,
      mobile,
      status: autoRegisterConfig.defaultStatus || 'active',
      lastLoginAt: new Date()
    })
    .returning()

  logger.info({ userId: newUser.id, feishuUserId, companyId: company.id }, 'Auto-registered new feishu user')

  // 7. 记录审计日志
  await db.insert(auditLogs).values({
    companyId: company.id,
    userId: newUser.id,
    action: 'create',
    resource: 'user',
    resourceId: newUser.id,
    details: { type: 'feishu_auto_register', feishuUserId, feishuOpenId, email: userEmail },
    status: 'success'
  })

  // 返回含 role 和 department 关联的完整用户
  const createdUser = await db.query.users.findFirst({
    where: eq(users.id, newUser.id),
    with: { role: true, department: true }
  })

  return createdUser!
}
