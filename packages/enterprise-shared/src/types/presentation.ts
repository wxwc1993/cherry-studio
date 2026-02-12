import type { BaseEntity } from './index'

// ============ 枚举类型 ============

export type PresentationStatus = 'draft' | 'outline_ready' | 'descriptions_ready' | 'images_ready' | 'completed'

export type PresentationCreationType = 'idea' | 'outline' | 'description'

export type PresentationTaskType =
  | 'generate_outline'
  | 'generate_descriptions'
  | 'generate_images'
  | 'generate_single_image'
  | 'edit_image'
  | 'export_pptx'
  | 'export_pdf'
  | 'export_editable_pptx'
  | 'refine_outline'
  | 'refine_descriptions'
  | 'parse_reference_file'

export type PresentationTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export type ReferenceFileParseStatus = 'pending' | 'processing' | 'completed' | 'failed'

export type PresentationPermission = 'read' | 'write' | 'export' | 'admin'

// ============ 核心类型 ============

export interface PresentationConfig {
  /** PPT 风格/主题 */
  theme?: string
  /** 语言 */
  language?: string
  /** 页面数量偏好 */
  pageCount?: number
  /** 图像风格 */
  imageStyle?: string
  /** 图像比例 */
  imageRatio?: string
  /** 文本模型 ID */
  textModelId?: string
  /** 图像模型 ID */
  imageModelId?: string
  /** 模板 ID */
  templateId?: string
  /** 自定义参数 */
  [key: string]: unknown
}

export interface Presentation extends BaseEntity {
  companyId: string
  userId: string
  title: string
  creationType: PresentationCreationType
  status: PresentationStatus
  config: PresentationConfig
  pageCount: number
  /** 用户输入的原始 idea/大纲/描述 */
  sourceContent?: string
}

// ============ 页面相关 ============

export interface OutlineContent {
  title: string
  bulletPoints?: string[]
  notes?: string
  [key: string]: unknown
}

export interface DescriptionContent {
  /** AI 生成的页面描述（用于图像生成） */
  text: string
  /** 图像提示词（用于图像生成） */
  imagePrompt?: string
  /** 页面布局提示 */
  layout?: string
  [key: string]: unknown
}

export interface PresentationPage extends BaseEntity {
  presentationId: string
  orderIndex: number
  outlineContent: OutlineContent
  descriptionContent?: DescriptionContent
  /** 当前生成图像的 OSS key */
  generatedImageKey?: string
}

// ============ 图像版本 ============

export interface PresentationImageVersion extends BaseEntity {
  pageId: string
  /** OSS 存储 key */
  imageKey: string
  versionNumber: number
  isCurrent: boolean
  /** 生成时的提示词 */
  prompt?: string
}

// ============ 任务 ============

export interface PresentationTaskProgress {
  /** 已完成数量 */
  completed?: number
  /** 总数量 */
  total?: number
  /** 当前步骤描述 */
  currentStep?: string
  /** 额外信息 */
  [key: string]: unknown
}

export interface PresentationTask extends BaseEntity {
  presentationId: string
  userId: string
  taskType: PresentationTaskType
  status: PresentationTaskStatus
  progress: PresentationTaskProgress
  /** BullMQ Job ID */
  bullmqJobId?: string
  /** 任务结果（如导出文件 URL） */
  result?: Record<string, unknown>
  /** 错误信息 */
  errorMessage?: string
  startedAt?: Date
  completedAt?: Date
}

// ============ 素材 ============

export interface PresentationMaterial extends BaseEntity {
  companyId: string
  userId: string
  presentationId?: string
  /** 文件名 */
  fileName: string
  /** OSS 存储 key */
  storageKey: string
  /** 文件大小（bytes） */
  fileSize: number
  /** MIME 类型 */
  mimeType?: string
}

// ============ 参考文件 ============

export interface PresentationReferenceFile extends BaseEntity {
  companyId: string
  userId: string
  presentationId: string
  /** 原始文件名 */
  fileName: string
  /** OSS 存储 key */
  storageKey: string
  /** 解析后的 Markdown 内容 */
  markdownContent?: string
  /** 解析状态 */
  parseStatus: ReferenceFileParseStatus
  /** 文件大小（bytes） */
  fileSize: number
  /** 错误信息 */
  errorMessage?: string
}

// ============ 模板 ============

export interface PresentationTemplate extends BaseEntity {
  companyId: string
  /** 上传者 ID */
  uploaderId: string
  name: string
  description?: string
  /** OSS 存储 key */
  storageKey: string
  /** 预览图 OSS key */
  previewImageKey?: string
  /** 是否公开（全公司可用） */
  isPublic: boolean
}

// ============ 企业设置 ============

export interface PresentationSettingsConfig {
  /** 最大并发任务数 */
  maxConcurrentTasks?: number
  /** 单个 PPT 最大页数 */
  maxPages?: number
  /** 启用的导出格式 */
  enabledExportFormats?: ('pptx' | 'pdf' | 'editable_pptx')[]
  /** 自定义参数 */
  [key: string]: unknown
}

export interface PresentationSettings extends BaseEntity {
  companyId: string
  /** 默认文本模型 ID */
  defaultTextModelId?: string
  /** 默认图像模型 ID */
  defaultImageModelId?: string
  config: PresentationSettingsConfig
}

// ============ 聚合响应类型 ============

export interface PresentationWithPages extends Presentation {
  pages: PresentationPage[]
}

export interface PresentationListItem extends Presentation {
  /** 第一页预览图 */
  previewImageKey?: string
}

export interface PresentationTaskWithPresentation extends PresentationTask {
  presentation?: Pick<Presentation, 'id' | 'title'>
}

// ============ 统计类型 ============

export interface PresentationStats {
  totalPresentations: number
  totalExports: number
  totalAiCalls: number
  activeUsers: number
}

export interface PresentationUsageTrend {
  date: string
  count: number
}
