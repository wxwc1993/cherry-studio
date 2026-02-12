import * as z from 'zod'

// ============ 通用 ============

export const presentationIdParamSchema = z.object({
  id: z.string().uuid('Invalid presentation ID format')
})

export const presentationPageIdParamSchema = z.object({
  id: z.string().uuid('Invalid presentation ID format'),
  pageId: z.string().uuid('Invalid page ID format')
})

export const presentationPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
})

// ============ 演示文稿配置 Schema ============

export const presentationConfigSchema = z.object({
  theme: z.string().max(100).optional(),
  language: z.string().max(20).optional(),
  pageCount: z.number().int().min(1).max(100).optional(),
  imageStyle: z.string().max(100).optional(),
  imageRatio: z.string().max(20).optional(),
  textModelId: z.string().uuid().optional(),
  imageModelId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional()
})

// ============ 大纲 / 描述内容 Schema ============

export const outlineContentSchema = z.object({
  title: z.string().min(1).max(500),
  bulletPoints: z.array(z.string().max(1000)).max(20).optional(),
  notes: z.string().max(5000).optional()
})

export const descriptionContentSchema = z.object({
  text: z.string().min(1).max(5000),
  imagePrompt: z.string().max(2000).optional(),
  layout: z.string().max(100).optional()
})

// ============ 演示文稿 CRUD Schema ============

export const createPresentationSchema = z.object({
  title: z.string().min(1).max(300),
  creationType: z.enum(['idea', 'outline', 'description']),
  config: presentationConfigSchema.optional(),
  sourceContent: z.string().max(50000).optional()
})

export const updatePresentationSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  config: presentationConfigSchema.optional(),
  sourceContent: z.string().max(50000).optional()
})

export const presentationQuerySchema = presentationPaginationSchema.extend({
  status: z.enum(['draft', 'outline_ready', 'descriptions_ready', 'images_ready', 'completed']).optional(),
  search: z.string().max(200).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
})

// ============ 页面管理 Schema ============

export const createPageSchema = z.object({
  orderIndex: z.number().int().min(0),
  outlineContent: outlineContentSchema,
  descriptionContent: descriptionContentSchema.optional()
})

export const updatePageSchema = z.object({
  orderIndex: z.number().int().min(0).optional(),
  outlineContent: outlineContentSchema.optional(),
  descriptionContent: descriptionContentSchema.optional()
})

export const reorderPagesSchema = z.object({
  pageIds: z.array(z.string().uuid()).min(1).max(100)
})

// ============ AI 生成 Schema ============

export const generateOutlineSchema = z.object({
  idea: z.string().min(1).max(10000),
  config: presentationConfigSchema.optional(),
  referenceFileIds: z.array(z.string().uuid()).max(10).optional()
})

export const refineOutlineSchema = z.object({
  instruction: z.string().min(1).max(5000),
  pages: z.array(outlineContentSchema).min(1).max(100)
})

export const generateDescriptionsSchema = z.object({
  config: presentationConfigSchema.optional()
})

export const refineDescriptionsSchema = z.object({
  instruction: z.string().min(1).max(5000),
  pageIds: z.array(z.string().uuid()).optional()
})

export const generateImagesSchema = z.object({
  config: presentationConfigSchema.optional(),
  pageIds: z.array(z.string().uuid()).optional()
})

export const generateSingleImageSchema = z.object({
  prompt: z.string().min(1).max(2000).optional(),
  config: presentationConfigSchema.optional()
})

export const editImageSchema = z.object({
  instruction: z.string().min(1).max(2000),
  maskData: z.string().optional()
})

// ============ 导出 Schema ============

export const exportPresentationSchema = z.object({
  format: z.enum(['pptx', 'pdf', 'editable_pptx']),
  templateId: z.string().uuid().optional(),
  config: presentationConfigSchema.optional()
})

// ============ 任务查询 Schema ============

export const taskIdParamSchema = z.object({
  taskId: z.string().uuid('Invalid task ID format')
})

// ============ 素材 Schema ============

export const materialIdParamSchema = z.object({
  id: z.string().uuid('Invalid material ID format')
})

// ============ 参考文件 Schema ============

export const referenceFileIdParamSchema = z.object({
  id: z.string().uuid('Invalid reference file ID format')
})

// ============ 模板 Schema ============

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  isPublic: z.boolean().default(false)
})

export const templateIdParamSchema = z.object({
  id: z.string().uuid('Invalid template ID format')
})

// ============ 企业设置 Schema ============

export const presentationSettingsConfigSchema = z.object({
  maxConcurrentTasks: z.number().int().min(1).max(50).optional(),
  maxPages: z.number().int().min(1).max(200).optional(),
  enabledExportFormats: z.array(z.enum(['pptx', 'pdf', 'editable_pptx'])).optional()
})

export const updatePresentationSettingsSchema = z.object({
  defaultTextModelId: z.string().uuid().nullable().optional(),
  defaultImageModelId: z.string().uuid().nullable().optional(),
  config: presentationSettingsConfigSchema.optional()
})

// ============ Admin 查询 Schema ============

export const adminPresentationQuerySchema = presentationPaginationSchema.extend({
  userId: z.string().uuid().optional(),
  status: z.enum(['draft', 'outline_ready', 'descriptions_ready', 'images_ready', 'completed']).optional(),
  search: z.string().max(200).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
})

// ============ 导出类型 ============

export type CreatePresentationInput = z.infer<typeof createPresentationSchema>
export type UpdatePresentationInput = z.infer<typeof updatePresentationSchema>
export type PresentationQueryInput = z.infer<typeof presentationQuerySchema>
export type CreatePageInput = z.infer<typeof createPageSchema>
export type UpdatePageInput = z.infer<typeof updatePageSchema>
export type ReorderPagesInput = z.infer<typeof reorderPagesSchema>
export type GenerateOutlineInput = z.infer<typeof generateOutlineSchema>
export type RefineOutlineInput = z.infer<typeof refineOutlineSchema>
export type GenerateDescriptionsInput = z.infer<typeof generateDescriptionsSchema>
export type RefineDescriptionsInput = z.infer<typeof refineDescriptionsSchema>
export type GenerateImagesInput = z.infer<typeof generateImagesSchema>
export type GenerateSingleImageInput = z.infer<typeof generateSingleImageSchema>
export type EditImageInput = z.infer<typeof editImageSchema>
export type ExportPresentationInput = z.infer<typeof exportPresentationSchema>
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>
export type UpdatePresentationSettingsInput = z.infer<typeof updatePresentationSettingsSchema>
export type AdminPresentationQueryInput = z.infer<typeof adminPresentationQuerySchema>
export type PresentationConfigInput = z.infer<typeof presentationConfigSchema>
export type OutlineContentInput = z.infer<typeof outlineContentSchema>
export type DescriptionContentInput = z.infer<typeof descriptionContentSchema>
