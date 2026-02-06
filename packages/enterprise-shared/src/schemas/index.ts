import * as z from 'zod'

// ============ 基础 Schema ============

export const paginationParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
})

// ============ 认证 Schema ============

export const feishuLoginSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().optional()
})

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
})

export const devLoginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required')
})

// ============ 用户 Schema ============

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1).max(100),
  departmentId: z.string().uuid(),
  roleId: z.string().uuid(),
  feishuUserId: z.string().optional()
})

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).max(100).optional(),
  departmentId: z.string().uuid().optional(),
  roleId: z.string().uuid().optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  avatar: z.string().url().optional()
})

// ============ 部门 Schema ============

export const createDepartmentSchema = z.object({
  name: z.string().min(1).max(100),
  parentId: z.string().uuid().optional(),
  order: z.number().int().min(0).default(0)
})

export const updateDepartmentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  parentId: z.string().uuid().nullable().optional(),
  order: z.number().int().min(0).optional()
})

// ============ 角色 Schema ============

export const rolePermissionsSchema = z.object({
  models: z.array(z.enum(['read', 'use'])).default([]),
  knowledgeBases: z.array(z.enum(['read', 'write', 'admin'])).default([]),
  users: z.array(z.enum(['read', 'write', 'admin'])).default([]),
  statistics: z.array(z.enum(['read', 'export'])).default([]),
  system: z.array(z.enum(['backup', 'restore', 'settings'])).default([])
})

export const createRoleSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(500).optional(),
  permissions: rolePermissionsSchema
})

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional(),
  permissions: rolePermissionsSchema.partial().optional()
})

// ============ 模型 Schema ============

/**
 * 模型能力标签枚举
 */
export const modelCapabilitySchema = z.enum([
  'vision',
  'reasoning',
  'embedding',
  'function_calling',
  'web_search',
  'rerank',
  'free'
])

export const modelConfigSchema = z.object({
  maxTokens: z.number().int().min(1).optional(),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
  capabilities: z.array(modelCapabilitySchema).optional()
})

export const modelQuotaSchema = z.object({
  dailyLimit: z.number().int().min(0).optional(),
  monthlyLimit: z.number().int().min(0).optional(),
  perUserLimit: z.number().int().min(0).optional()
})

export const createModelSchema = z.object({
  providerId: z.string().min(1),
  name: z.string().min(1).max(100),
  displayName: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  apiKey: z.string().min(1),
  apiEndpoint: z.string().url().optional(),
  config: modelConfigSchema.optional(),
  quota: modelQuotaSchema.optional()
})

export const updateModelSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  apiKey: z.string().min(1).optional(),
  apiEndpoint: z.string().url().optional(),
  isEnabled: z.boolean().optional(),
  config: modelConfigSchema.optional(),
  quota: modelQuotaSchema.optional()
})

export const modelPermissionRuleSchema = z.object({
  modelId: z.string().uuid(),
  targetType: z.enum(['department', 'role', 'user']),
  targetId: z.string().uuid(),
  allowed: z.boolean()
})

// ============ 知识库 Schema ============

export const knowledgeBaseConfigSchema = z.object({
  embeddingModel: z.string().default('text-embedding-ada-002'),
  chunkSize: z.number().int().min(100).max(8000).default(1000),
  chunkOverlap: z.number().int().min(0).max(500).default(200),
  maxResults: z.number().int().min(1).max(50).default(10),
  scoreThreshold: z.number().min(0).max(1).default(0.7)
})

export const createKnowledgeBaseSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  visibility: z.enum(['private', 'department', 'company']).default('private'),
  config: knowledgeBaseConfigSchema.optional()
})

export const updateKnowledgeBaseSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  visibility: z.enum(['private', 'department', 'company']).optional(),
  config: knowledgeBaseConfigSchema.partial().optional()
})

export const kbPermissionSchema = z.object({
  targetType: z.enum(['department', 'role', 'user']),
  targetId: z.string().uuid(),
  level: z.enum(['viewer', 'editor', 'admin'])
})

export const searchKnowledgeBaseSchema = z.object({
  query: z.string().min(1).max(2000),
  knowledgeBaseIds: z.array(z.string().uuid()).optional(),
  topK: z.number().int().min(1).max(50).default(10),
  scoreThreshold: z.number().min(0).max(1).default(0.7)
})

// ============ 对话 Schema ============

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1)
})

export const chatRequestSchema = z.object({
  modelId: z.string().uuid(),
  messages: z.array(chatMessageSchema).min(1),
  conversationId: z.string().uuid().optional(),
  stream: z.boolean().default(true),
  knowledgeBaseIds: z.array(z.string().uuid()).optional(),
  config: modelConfigSchema.optional()
})

// ============ 统计 Schema ============

export const usageQuerySchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  userId: z.string().uuid().optional(),
  modelId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  groupBy: z.enum(['day', 'week', 'month', 'user', 'model', 'department']).optional()
})

// ============ 审计日志 Schema ============

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  userId: z.string().uuid().optional(),
  action: z.enum(['login', 'logout', 'create', 'update', 'delete']).optional(),
  resource: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional()
})

// ============ 备份 Schema ============

export const createBackupSchema = z.object({
  type: z.enum(['full', 'incremental', 'archive']).default('full'),
  includeConversations: z.boolean().default(true),
  includeKnowledgeBases: z.boolean().default(true)
})

export const restoreBackupSchema = z.object({
  backupId: z.string().uuid(),
  restoreConversations: z.boolean().default(true),
  restoreKnowledgeBases: z.boolean().default(true)
})

// ============ 企业设置 Schema ============

export const companySettingsSchema = z.object({
  maxUsers: z.number().int().min(1),
  maxStorage: z.number().int().min(0),
  enableKnowledgeBase: z.boolean(),
  enableModelProxy: z.boolean(),
  customBranding: z
    .object({
      logo: z.string().url().optional(),
      primaryColor: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .optional(),
      name: z.string().max(50).optional()
    })
    .optional()
})

// ============ 导出类型 ============

// 注意：PaginationParams 已在 types/index.ts 中定义，这里使用 PaginationParamsInput 避免冲突
export type PaginationParamsInput = z.infer<typeof paginationParamsSchema>
export type FeishuLoginInput = z.infer<typeof feishuLoginSchema>
export type DevLoginInput = z.infer<typeof devLoginSchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>
export type CreateRoleInput = z.infer<typeof createRoleSchema>
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>
export type CreateModelInput = z.infer<typeof createModelSchema>
export type UpdateModelInput = z.infer<typeof updateModelSchema>
export type CreateKnowledgeBaseInput = z.infer<typeof createKnowledgeBaseSchema>
export type UpdateKnowledgeBaseInput = z.infer<typeof updateKnowledgeBaseSchema>
export type KBPermissionInput = z.infer<typeof kbPermissionSchema>
export type SearchKnowledgeBaseInput = z.infer<typeof searchKnowledgeBaseSchema>
export type ChatRequestInput = z.infer<typeof chatRequestSchema>
export type UsageQueryInput = z.infer<typeof usageQuerySchema>
export type AuditLogQueryInput = z.infer<typeof auditLogQuerySchema>
export type CreateBackupInput = z.infer<typeof createBackupSchema>
export type RestoreBackupInput = z.infer<typeof restoreBackupSchema>
export type CompanySettingsInput = z.infer<typeof companySettingsSchema>
