// 企业版类型定义

// ============ 基础类型 ============

export interface BaseEntity {
  id: string
  createdAt: Date
  updatedAt: Date
}

// ============ 企业相关 ============

export interface Company extends BaseEntity {
  name: string
  feishuAppId?: string
  feishuAppSecret?: string
  settings: CompanySettings
}

export interface FeishuAutoRegisterSettings {
  enabled: boolean
  defaultDepartmentId: string
  defaultRoleId: string
  defaultStatus: 'active' | 'inactive'
}

export interface DefaultModelRef {
  modelId: string // models 表 UUID
  modelName: string // 显示名称（冗余存储，便于展示）
  providerId: string // provider ID
}

export interface DefaultModelsConfig {
  defaultAssistantModel?: DefaultModelRef
  quickModel?: DefaultModelRef
  translateModel?: DefaultModelRef
}

export interface CompanySettings {
  maxUsers: number
  maxStorage: number // bytes
  enableKnowledgeBase: boolean
  enableModelProxy: boolean
  customBranding?: {
    logo?: string
    primaryColor?: string
    name?: string
  }
  feishuAutoRegister?: FeishuAutoRegisterSettings
  defaultModels?: DefaultModelsConfig
}

// ============ 用户与组织 ============

export interface Department extends BaseEntity {
  companyId: string
  parentId?: string
  name: string
  order: number
  path: string // 如 /1/2/3 表示层级路径
}

export interface User extends BaseEntity {
  companyId: string
  departmentId: string
  roleId: string
  feishuUserId?: string
  feishuOpenId?: string
  mobile?: string
  email: string
  name: string
  avatar?: string
  status: UserStatus
  lastLoginAt?: Date
}

export type UserStatus = 'active' | 'inactive' | 'suspended'

export interface Role extends BaseEntity {
  companyId: string
  name: string
  description?: string
  permissions: RolePermissions
  isSystem: boolean // 系统角色不可删除
}

export interface RolePermissions {
  models: ModelPermission[]
  knowledgeBases: KnowledgeBasePermission[]
  users: UserPermission[]
  statistics: StatisticsPermission[]
  system: SystemPermission[]
  assistantPresets: AssistantPresetPermission[]
  learningCenter?: LearningCenterPermission[]
  presentations?: PresentationPermission[]
}

export type ModelPermission = 'read' | 'use'
export type KnowledgeBasePermission = 'read' | 'write' | 'admin'
export type UserPermission = 'read' | 'write' | 'admin'
export type StatisticsPermission = 'read' | 'export'
export type SystemPermission = 'backup' | 'restore' | 'settings'
export type AssistantPresetPermission = 'read' | 'write' | 'admin'
export type LearningCenterPermission = 'read' | 'write' | 'admin'
export type PresentationPermission = 'read' | 'write' | 'export' | 'admin'

// ============ 模型管理 ============

/**
 * 模型能力类型（与客户端保持一致）
 * - vision: 视觉理解
 * - reasoning: 深度推理
 * - embedding: 文本嵌入
 * - function_calling: 函数调用
 * - web_search: 网络搜索
 * - rerank: 重排序
 * - free: 免费模型
 */
export type ModelCapability =
  | 'vision'
  | 'reasoning'
  | 'embedding'
  | 'function_calling'
  | 'web_search'
  | 'rerank'
  | 'free'

export interface Model extends BaseEntity {
  companyId: string
  providerId: string
  name: string
  displayName: string
  description?: string
  apiKey: string // 加密存储
  apiEndpoint?: string
  isEnabled: boolean
  config: ModelConfig
  quota?: ModelQuota
}

export interface ModelConfig {
  maxTokens?: number
  temperature?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  /** 模型能力标签列表 */
  capabilities?: ModelCapability[]
  [key: string]: unknown
}

export interface ModelQuota {
  dailyLimit?: number
  monthlyLimit?: number
  perUserLimit?: number
}

export interface ModelPermissionRule extends BaseEntity {
  modelId: string
  targetType: 'department' | 'role' | 'user'
  targetId: string
  allowed: boolean
}

// ============ 知识库 ============

export interface KnowledgeBase extends BaseEntity {
  companyId: string
  name: string
  description?: string
  ownerDepartmentId: string
  ownerId: string
  visibility: KnowledgeBaseVisibility
  config: KnowledgeBaseConfig
  documentCount: number
  vectorCount: number
  status: KnowledgeBaseStatus
}

export type KnowledgeBaseVisibility = 'private' | 'department' | 'company'
export type KnowledgeBaseStatus = 'active' | 'processing' | 'error'

export interface KnowledgeBaseConfig {
  embeddingModel: string
  chunkSize: number
  chunkOverlap: number
  maxResults: number
  scoreThreshold: number
}

export interface KnowledgeBasePermissionRule extends BaseEntity {
  knowledgeBaseId: string
  targetType: 'department' | 'role' | 'user'
  targetId: string
  level: KBPermissionLevel
}

export type KBPermissionLevel = 'viewer' | 'editor' | 'admin'

export interface KnowledgeBaseDocument extends BaseEntity {
  knowledgeBaseId: string
  fileName: string
  fileType: string
  fileSize: number
  filePath: string
  uploaderId: string
  status: DocumentStatus
  vectorCount: number
  errorMessage?: string
}

export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed'

// ============ 对话与消息 ============

export interface Conversation extends BaseEntity {
  userId: string
  modelId: string
  title?: string
  messageCount: number
  tokenCount: number
}

export interface Message extends BaseEntity {
  conversationId: string
  role: MessageRole
  content: string
  tokenCount: number
  metadata?: MessageMetadata
}

export type MessageRole = 'user' | 'assistant' | 'system'

export interface MessageMetadata {
  model?: string
  knowledgeBaseIds?: string[]
  retrievedDocuments?: string[]
  [key: string]: unknown
}

// ============ 用量统计 ============

export interface UsageLog extends BaseEntity {
  companyId: string
  userId: string
  modelId: string
  conversationId?: string
  assistantPresetId?: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cost: number
  duration: number // ms
}

export interface UsageSummary {
  period: 'daily' | 'weekly' | 'monthly'
  date: Date
  companyId: string
  userId?: string
  modelId?: string
  departmentId?: string
  totalMessages: number
  totalConversations: number
  totalTokens: number
  totalCost: number
  averageLatency: number
}

// ============ 备份 ============

export interface Backup extends BaseEntity {
  companyId: string
  type: BackupType
  status: BackupStatus
  filePath: string
  fileSize: number
  startedAt: Date
  completedAt?: Date
  errorMessage?: string
}

export type BackupType = 'full' | 'incremental' | 'archive'
export type BackupStatus = 'pending' | 'running' | 'completed' | 'failed'

// ============ 认证相关 ============

export interface AuthToken {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: 'Bearer'
}

export interface FeishuUserInfo {
  openId: string
  userId: string
  name: string
  avatar?: string
  email?: string
  mobile?: string
  departmentIds: string[]
}

export interface JWTPayload {
  sub: string // user id
  companyId: string
  departmentId: string
  roleId: string
  permissions: RolePermissions
  iat: number
  exp: number
}

// ============ API 响应 ============

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: ApiError
  pagination?: Pagination
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}

export interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface PaginationParams {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// ============ 搜索相关 ============

export interface SearchResult {
  documentId: string
  knowledgeBaseId: string
  content: string
  score: number
  metadata: Record<string, unknown>
}

export interface SearchRequest {
  query: string
  knowledgeBaseIds?: string[]
  topK?: number
  scoreThreshold?: number
}

// ============ 提示词助手预设 ============

export interface AssistantPresetTag extends BaseEntity {
  companyId: string
  name: string
  locale: string
  order: number
}

export interface AssistantPresetItem extends BaseEntity {
  companyId: string
  name: string
  emoji?: string
  description?: string
  prompt: string
  locale: string
  isEnabled: boolean
  order: number
  tags?: AssistantPresetTag[]
}

export interface AssistantPresetClientData {
  tags: AssistantPresetTag[]
  presets: AssistantPresetItem[]
}

// ============ 学习中心 ============
export * from './learning-center'

// ============ 演示文稿 ============
export * from './presentation'
