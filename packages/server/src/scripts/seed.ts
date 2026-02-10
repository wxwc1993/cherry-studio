/**
 * 种子数据脚本
 *
 * 插入企业、默认部门、角色（Super Admin + Member），
 * 并启用飞书自动注册功能。
 *
 * 幂等设计：先查询是否已存在，存在则跳过。
 *
 * 用法：pnpm db:seed
 */

import type { CompanySettings, RolePermissions } from '@cherry-studio/enterprise-shared'
import { eq } from 'drizzle-orm'

import { config } from '../config'
import { db } from '../models/db'
import { companies, departments, roles } from '../models/schema'
import { createLogger } from '../utils/logger'

const logger = createLogger('Seed')

const COMPANY_NAME = 'yadea'

const SUPER_ADMIN_PERMISSIONS: RolePermissions = {
  models: ['read', 'use'],
  knowledgeBases: ['read', 'write', 'admin'],
  users: ['read', 'write', 'admin'],
  statistics: ['read', 'export'],
  system: ['backup', 'restore', 'settings'],
  assistantPresets: ['read', 'write', 'admin']
}

const MEMBER_PERMISSIONS: RolePermissions = {
  models: ['read', 'use'],
  knowledgeBases: ['read'],
  users: ['read'],
  statistics: ['read'],
  system: [],
  assistantPresets: ['read']
}

async function seed(): Promise<void> {
  const feishuAppId = config.feishu.appId
  const feishuAppSecret = config.feishu.appSecret

  if (!feishuAppId) {
    throw new Error('FEISHU_APP_ID 环境变量未配置，无法创建种子数据')
  }

  logger.info('开始插入种子数据...')

  // ──────────────────────────────────────────────
  // 步骤 1：创建企业（幂等：按 feishu_app_id 查重）
  // ──────────────────────────────────────────────
  const existingCompanies = await db.select().from(companies).where(eq(companies.feishuAppId, feishuAppId))

  let companyId: string

  if (existingCompanies.length > 0) {
    companyId = existingCompanies[0].id
    logger.info({ companyId }, '企业已存在，跳过创建')
  } else {
    const [inserted] = await db
      .insert(companies)
      .values({
        name: COMPANY_NAME,
        feishuAppId,
        feishuAppSecret: feishuAppSecret || null,
        settings: {}
      })
      .returning({ id: companies.id })

    companyId = inserted.id
    logger.info({ companyId }, '企业创建成功')
  }

  // ──────────────────────────────────────────────
  // 步骤 2：创建默认部门（幂等：按 companyId + path 查重）
  // ──────────────────────────────────────────────
  const existingDepts = await db.select().from(departments).where(eq(departments.companyId, companyId))

  let departmentId: string

  const defaultDept = existingDepts.find((d) => d.path === '/default')

  if (defaultDept) {
    departmentId = defaultDept.id
    logger.info({ departmentId }, '默认部门已存在，跳过创建')
  } else {
    const [inserted] = await db
      .insert(departments)
      .values({
        companyId,
        name: '默认部门',
        path: '/default',
        order: 0
      })
      .returning({ id: departments.id })

    departmentId = inserted.id
    logger.info({ departmentId }, '默认部门创建成功')
  }

  // ──────────────────────────────────────────────
  // 步骤 3：创建角色（幂等：按 companyId + name 查重）
  // ──────────────────────────────────────────────
  const existingRoles = await db.select().from(roles).where(eq(roles.companyId, companyId))

  // 3a) Super Admin
  const existingSuperAdmin = existingRoles.find((r) => r.name === 'Super Admin')
  let superAdminId: string

  if (existingSuperAdmin) {
    superAdminId = existingSuperAdmin.id
    logger.info({ superAdminId }, 'Super Admin 角色已存在，跳过创建')
  } else {
    const [inserted] = await db
      .insert(roles)
      .values({
        companyId,
        name: 'Super Admin',
        description: '超级管理员，拥有全部权限',
        permissions: SUPER_ADMIN_PERMISSIONS,
        isSystem: true
      })
      .returning({ id: roles.id })

    superAdminId = inserted.id
    logger.info({ superAdminId }, 'Super Admin 角色创建成功')
  }

  // 3b) Member
  const existingMember = existingRoles.find((r) => r.name === 'Member')
  let memberRoleId: string

  if (existingMember) {
    memberRoleId = existingMember.id
    logger.info({ memberRoleId }, 'Member 角色已存在，跳过创建')
  } else {
    const [inserted] = await db
      .insert(roles)
      .values({
        companyId,
        name: 'Member',
        description: '普通成员，飞书自动注册的默认角色',
        permissions: MEMBER_PERMISSIONS,
        isSystem: false
      })
      .returning({ id: roles.id })

    memberRoleId = inserted.id
    logger.info({ memberRoleId }, 'Member 角色创建成功')
  }

  // ──────────────────────────────────────────────
  // 步骤 4：更新企业 settings，启用飞书自动注册
  // ──────────────────────────────────────────────
  const companySettings: CompanySettings = {
    maxUsers: 500,
    maxStorage: 10737418240, // 10GB
    enableKnowledgeBase: true,
    enableModelProxy: true,
    feishuAutoRegister: {
      enabled: true,
      defaultDepartmentId: departmentId,
      defaultRoleId: memberRoleId,
      defaultStatus: 'active'
    }
  }

  await db
    .update(companies)
    .set({ settings: companySettings, updatedAt: new Date() })
    .where(eq(companies.id, companyId))

  logger.info({ companyId, settings: companySettings }, '企业 settings 更新成功，飞书自动注册已启用')

  logger.info('种子数据插入完成！')
  logger.info(
    {
      companyId,
      departmentId,
      superAdminId,
      memberRoleId,
      feishuAppId
    },
    '数据摘要'
  )
}

seed()
  .then(() => {
    process.exit(0)
  })
  .catch((error: unknown) => {
    logger.error({ error }, '种子数据插入失败')
    process.exit(1)
  })
