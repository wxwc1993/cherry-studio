import * as z from 'zod'

// ============ 标签 Schema ============

export const createAssistantPresetTagSchema = z.object({
  name: z.string().min(1).max(50),
  locale: z.string().min(2).max(10),
  order: z.number().int().min(0).default(0)
})

export const updateAssistantPresetTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  locale: z.string().min(2).max(10).optional(),
  order: z.number().int().min(0).optional()
})

// ============ 预设 Schema ============

export const createAssistantPresetSchema = z.object({
  name: z.string().min(1).max(200),
  emoji: z.string().max(50).optional(),
  description: z.string().optional(),
  prompt: z.string().min(1),
  locale: z.string().min(2).max(10),
  isEnabled: z.boolean().default(true),
  order: z.number().int().min(0).default(0),
  tagIds: z.array(z.string().uuid()).optional()
})

export const updateAssistantPresetSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  emoji: z.string().max(50).optional(),
  description: z.string().optional(),
  prompt: z.string().min(1).optional(),
  locale: z.string().min(2).max(10).optional(),
  isEnabled: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
  tagIds: z.array(z.string().uuid()).optional()
})

// ============ 批量导入 Schema ============

export const seedAssistantPresetsSchema = z.object({
  overwrite: z.boolean().default(false)
})

// ============ AI 生成 Schema ============

export const generatePromptSchema = z.object({
  content: z.string().min(1).max(2000)
})

// ============ 查询参数 Schema ============

export const assistantPresetQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  locale: z.string().min(2).max(10).optional(),
  tagId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  isEnabled: z
    .string()
    .transform((v) => v === 'true')
    .optional()
})

export const assistantPresetTagQuerySchema = z.object({
  locale: z.string().min(2).max(10).optional()
})

// ============ 导出类型 ============

export type CreateAssistantPresetTagInput = z.infer<typeof createAssistantPresetTagSchema>
export type UpdateAssistantPresetTagInput = z.infer<typeof updateAssistantPresetTagSchema>
export type CreateAssistantPresetInput = z.infer<typeof createAssistantPresetSchema>
export type UpdateAssistantPresetInput = z.infer<typeof updateAssistantPresetSchema>
export type SeedAssistantPresetsInput = z.infer<typeof seedAssistantPresetsSchema>
export type GeneratePromptInput = z.infer<typeof generatePromptSchema>
export type AssistantPresetQueryInput = z.infer<typeof assistantPresetQuerySchema>
export type AssistantPresetTagQueryInput = z.infer<typeof assistantPresetTagQuerySchema>
