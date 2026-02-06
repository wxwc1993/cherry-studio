import { relations } from 'drizzle-orm'
import {
  bigint,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  varchar} from 'drizzle-orm/pg-core'

// ============ 自定义类型：pgvector ============

/**
 * pgvector 类型定义
 * 用于存储文档 embedding 向量
 * 需要在数据库中执行: CREATE EXTENSION IF NOT EXISTS vector;
 */
export const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(1536)' // OpenAI text-embedding-ada-002 默认维度
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`
  },
  fromDriver(value: string): number[] {
    // PostgreSQL 返回格式: [0.1,0.2,0.3,...]
    return value
      .slice(1, -1)
      .split(',')
      .map((n) => parseFloat(n))
  }
})

// ============ 企业表 ============

export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  feishuAppId: varchar('feishu_app_id', { length: 100 }),
  feishuAppSecret: text('feishu_app_secret'),
  settings: jsonb('settings').notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
})

// ============ 部门表 ============

export const departments = pgTable(
  'departments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'),
    name: varchar('name', { length: 100 }).notNull(),
    path: varchar('path', { length: 500 }).notNull(),
    order: integer('order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow()
  },
  (table) => [index('departments_company_id_idx').on(table.companyId), index('departments_path_idx').on(table.path)]
)

// ============ 角色表 ============

export const roles = pgTable(
  'roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 50 }).notNull(),
    description: text('description'),
    permissions: jsonb('permissions').notNull().default({}),
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow()
  },
  (table) => [index('roles_company_id_idx').on(table.companyId)]
)

// ============ 用户表 ============

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id),
    feishuUserId: varchar('feishu_user_id', { length: 100 }),
    email: varchar('email', { length: 255 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    avatar: text('avatar'),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    lastLoginAt: timestamp('last_login_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow()
  },
  (table) => [
    index('users_company_id_idx').on(table.companyId),
    index('users_department_id_idx').on(table.departmentId),
    index('users_email_idx').on(table.email),
    index('users_feishu_user_id_idx').on(table.feishuUserId)
  ]
)

// ============ 模型表 ============

export const models = pgTable(
  'models',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    providerId: varchar('provider_id', { length: 50 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    displayName: varchar('display_name', { length: 100 }).notNull(),
    description: text('description'),
    apiKey: text('api_key').notNull(),
    apiEndpoint: text('api_endpoint'),
    isEnabled: boolean('is_enabled').notNull().default(true),
    config: jsonb('config').notNull().default({}),
    quota: jsonb('quota').default({}),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow()
  },
  (table) => [index('models_company_id_idx').on(table.companyId)]
)

// ============ 模型权限表 ============

export const modelPermissions = pgTable(
  'model_permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    modelId: uuid('model_id')
      .notNull()
      .references(() => models.id, { onDelete: 'cascade' }),
    targetType: varchar('target_type', { length: 20 }).notNull(),
    targetId: uuid('target_id').notNull(),
    allowed: boolean('allowed').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow()
  },
  (table) => [index('model_permissions_model_id_idx').on(table.modelId)]
)

// ============ 知识库表 ============

export const knowledgeBases = pgTable(
  'knowledge_bases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    ownerDepartmentId: uuid('owner_department_id')
      .notNull()
      .references(() => departments.id),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    visibility: varchar('visibility', { length: 20 }).notNull().default('private'),
    config: jsonb('config').notNull().default({}),
    documentCount: integer('document_count').notNull().default(0),
    vectorCount: integer('vector_count').notNull().default(0),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow()
  },
  (table) => [
    index('knowledge_bases_company_id_idx').on(table.companyId),
    index('knowledge_bases_owner_id_idx').on(table.ownerId)
  ]
)

// ============ 知识库权限表 ============

export const kbPermissions = pgTable(
  'kb_permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    knowledgeBaseId: uuid('knowledge_base_id')
      .notNull()
      .references(() => knowledgeBases.id, { onDelete: 'cascade' }),
    targetType: varchar('target_type', { length: 20 }).notNull(),
    targetId: uuid('target_id').notNull(),
    level: varchar('level', { length: 20 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow()
  },
  (table) => [index('kb_permissions_kb_id_idx').on(table.knowledgeBaseId)]
)

// ============ 知识库文档表 ============

export const kbDocuments = pgTable(
  'kb_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    knowledgeBaseId: uuid('knowledge_base_id')
      .notNull()
      .references(() => knowledgeBases.id, { onDelete: 'cascade' }),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    fileType: varchar('file_type', { length: 50 }).notNull(),
    fileSize: bigint('file_size', { mode: 'number' }).notNull(),
    filePath: text('file_path').notNull(),
    uploaderId: uuid('uploader_id')
      .notNull()
      .references(() => users.id),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    vectorCount: integer('vector_count').notNull().default(0),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow()
  },
  (table) => [index('kb_documents_kb_id_idx').on(table.knowledgeBaseId)]
)

// ============ 文档分块表（向量存储）============

/**
 * 文档分块表 - 存储文档的向量化分块
 * 使用 pgvector 存储 embedding
 *
 * 注意：需要在数据库中创建向量索引：
 * CREATE INDEX ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
 */
export const documentChunks = pgTable(
  'document_chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => kbDocuments.id, { onDelete: 'cascade' }),
    knowledgeBaseId: uuid('knowledge_base_id')
      .notNull()
      .references(() => knowledgeBases.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull(),
    content: text('content').notNull(),
    embedding: vector('embedding'),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at').notNull().defaultNow()
  },
  (table) => [
    index('document_chunks_document_id_idx').on(table.documentId),
    index('document_chunks_kb_id_idx').on(table.knowledgeBaseId)
  ]
)

// ============ 对话表 ============

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    modelId: uuid('model_id').references(() => models.id),
    title: varchar('title', { length: 255 }),
    messageCount: integer('message_count').notNull().default(0),
    tokenCount: integer('token_count').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow()
  },
  (table) => [index('conversations_user_id_idx').on(table.userId)]
)

// ============ 消息表 ============

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 }).notNull(),
    content: text('content').notNull(),
    tokenCount: integer('token_count').notNull().default(0),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at').notNull().defaultNow()
  },
  (table) => [index('messages_conversation_id_idx').on(table.conversationId)]
)

// ============ 用量日志表 ============

export const usageLogs = pgTable(
  'usage_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    modelId: uuid('model_id')
      .notNull()
      .references(() => models.id),
    conversationId: uuid('conversation_id'),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    totalTokens: integer('total_tokens').notNull().default(0),
    cost: real('cost').notNull().default(0),
    duration: integer('duration').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow()
  },
  (table) => [
    index('usage_logs_company_id_idx').on(table.companyId),
    index('usage_logs_user_id_idx').on(table.userId),
    index('usage_logs_model_id_idx').on(table.modelId),
    index('usage_logs_created_at_idx').on(table.createdAt)
  ]
)

// ============ 备份表 ============

export const backups = pgTable(
  'backups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 20 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    filePath: text('file_path'),
    fileSize: bigint('file_size', { mode: 'number' }),
    startedAt: timestamp('started_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').notNull().defaultNow()
  },
  (table) => [index('backups_company_id_idx').on(table.companyId)]
)

// ============ 刷新 Token 表 ============

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow()
  },
  (table) => [index('refresh_tokens_user_id_idx').on(table.userId), index('refresh_tokens_token_idx').on(table.token)]
)

// ============ 关系定义 ============

export const companiesRelations = relations(companies, ({ many }) => ({
  departments: many(departments),
  roles: many(roles),
  users: many(users),
  models: many(models),
  knowledgeBases: many(knowledgeBases)
}))

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  company: one(companies, {
    fields: [departments.companyId],
    references: [companies.id]
  }),
  parent: one(departments, {
    fields: [departments.parentId],
    references: [departments.id]
  }),
  users: many(users)
}))

export const rolesRelations = relations(roles, ({ one, many }) => ({
  company: one(companies, {
    fields: [roles.companyId],
    references: [companies.id]
  }),
  users: many(users)
}))

export const usersRelations = relations(users, ({ one, many }) => ({
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id]
  }),
  department: one(departments, {
    fields: [users.departmentId],
    references: [departments.id]
  }),
  role: one(roles, {
    fields: [users.roleId],
    references: [roles.id]
  }),
  conversations: many(conversations),
  usageLogs: many(usageLogs)
}))

export const modelsRelations = relations(models, ({ one, many }) => ({
  company: one(companies, {
    fields: [models.companyId],
    references: [companies.id]
  }),
  permissions: many(modelPermissions)
}))

export const knowledgeBasesRelations = relations(knowledgeBases, ({ one, many }) => ({
  company: one(companies, {
    fields: [knowledgeBases.companyId],
    references: [companies.id]
  }),
  owner: one(users, {
    fields: [knowledgeBases.ownerId],
    references: [users.id]
  }),
  documents: many(kbDocuments),
  permissions: many(kbPermissions),
  chunks: many(documentChunks)
}))

export const kbDocumentsRelations = relations(kbDocuments, ({ one, many }) => ({
  knowledgeBase: one(knowledgeBases, {
    fields: [kbDocuments.knowledgeBaseId],
    references: [knowledgeBases.id]
  }),
  uploader: one(users, {
    fields: [kbDocuments.uploaderId],
    references: [users.id]
  }),
  chunks: many(documentChunks)
}))

export const documentChunksRelations = relations(documentChunks, ({ one }) => ({
  document: one(kbDocuments, {
    fields: [documentChunks.documentId],
    references: [kbDocuments.id]
  }),
  knowledgeBase: one(knowledgeBases, {
    fields: [documentChunks.knowledgeBaseId],
    references: [knowledgeBases.id]
  })
}))

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id]
  }),
  model: one(models, {
    fields: [conversations.modelId],
    references: [models.id]
  }),
  messages: many(messages)
}))

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id]
  })
}))

// ============ 审计日志表 ============

/**
 * 审计日志表
 * 记录用户操作历史，用于安全审计和问题追溯
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 50 }).notNull(), // login, logout, create, update, delete, etc.
    resource: varchar('resource', { length: 50 }).notNull(), // user, model, knowledge_base, etc.
    resourceId: uuid('resource_id'),
    details: jsonb('details').default({}), // 操作详情
    ipAddress: varchar('ip_address', { length: 45 }), // 支持 IPv6
    userAgent: text('user_agent'),
    status: varchar('status', { length: 20 }).notNull().default('success'), // success, failed
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').notNull().defaultNow()
  },
  (table) => [
    index('audit_logs_company_id_idx').on(table.companyId),
    index('audit_logs_user_id_idx').on(table.userId),
    index('audit_logs_action_idx').on(table.action),
    index('audit_logs_resource_idx').on(table.resource),
    index('audit_logs_created_at_idx').on(table.createdAt)
  ]
)

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  company: one(companies, {
    fields: [auditLogs.companyId],
    references: [companies.id]
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id]
  })
}))
