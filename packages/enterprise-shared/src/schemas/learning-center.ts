import * as z from 'zod'

// ============ 安全 URL 验证器（C1 修正）============
// 仅允许 http(s) 协议，防止 javascript: XSS 攻击

const safeUrl = z
  .string()
  .url()
  .refine((url) => /^https?:\/\//i.test(url), { message: 'URL must use http or https protocol' })

// ============ 通用 ============

export const lcIdParamSchema = z.object({
  id: z.string().uuid('Invalid ID format')
})

export const lcPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
})

// ============ Banner Schema ============

export const createBannerSchema = z.object({
  title: z.string().min(1).max(200),
  imageUrl: safeUrl,
  linkUrl: safeUrl.optional(),
  linkType: z.enum(['internal', 'external']).default('external').optional(),
  order: z.number().int().min(0).default(0),
  isEnabled: z.boolean().default(true)
})

export const updateBannerSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  imageUrl: safeUrl.optional(),
  linkUrl: safeUrl.nullable().optional(),
  linkType: z.enum(['internal', 'external']).nullable().optional(),
  order: z.number().int().min(0).optional(),
  isEnabled: z.boolean().optional()
})

// ============ 课程分类 Schema ============

export const createCourseCategorySchema = z.object({
  name: z.string().min(1).max(100),
  order: z.number().int().min(0).default(0),
  isEnabled: z.boolean().default(true)
})

export const updateCourseCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  order: z.number().int().min(0).optional(),
  isEnabled: z.boolean().optional()
})

// ============ 课程 Schema ============

export const createCourseSchema = z.object({
  categoryId: z.string().uuid().optional(),
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  coverUrl: safeUrl.optional(),
  videoUrl: safeUrl,
  duration: z.number().int().min(0).default(0),
  author: z.string().max(100).optional(),
  order: z.number().int().min(0).default(0),
  isEnabled: z.boolean().default(true),
  isRecommended: z.boolean().default(false)
})

export const updateCourseSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(2000).nullable().optional(),
  coverUrl: safeUrl.nullable().optional(),
  videoUrl: safeUrl.optional(),
  duration: z.number().int().min(0).optional(),
  author: z.string().max(100).nullable().optional(),
  order: z.number().int().min(0).optional(),
  isEnabled: z.boolean().optional(),
  isRecommended: z.boolean().optional()
})

export const courseQuerySchema = lcPaginationSchema.extend({
  categoryId: z.string().uuid().optional(),
  uncategorized: z.coerce.boolean().optional() // categoryId IS NULL filter
})

// ============ 文档分类 Schema ============

export const createDocumentCategorySchema = z.object({
  name: z.string().min(1).max(100),
  order: z.number().int().min(0).default(0),
  isEnabled: z.boolean().default(true)
})

export const updateDocumentCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  order: z.number().int().min(0).optional(),
  isEnabled: z.boolean().optional()
})

// ============ 文档 Schema ============

export const createDocumentSchema = z.object({
  categoryId: z.string().uuid().optional(),
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  coverUrl: safeUrl.optional(),
  linkUrl: safeUrl,
  linkType: z.enum(['internal', 'external']).default('external'),
  author: z.string().max(100).optional(),
  order: z.number().int().min(0).default(0),
  isEnabled: z.boolean().default(true),
  isRecommended: z.boolean().default(false)
})

export const updateDocumentSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(2000).nullable().optional(),
  coverUrl: safeUrl.nullable().optional(),
  linkUrl: safeUrl.optional(),
  linkType: z.enum(['internal', 'external']).optional(),
  author: z.string().max(100).nullable().optional(),
  order: z.number().int().min(0).optional(),
  isEnabled: z.boolean().optional(),
  isRecommended: z.boolean().optional()
})

export const documentQuerySchema = lcPaginationSchema.extend({
  categoryId: z.string().uuid().optional(),
  uncategorized: z.coerce.boolean().optional()
})

// ============ 热搜 Schema ============

export const createHotItemSchema = z.object({
  title: z.string().min(1).max(300),
  linkUrl: safeUrl,
  tag: z.enum(['hot', 'new']).optional(),
  heatValue: z.number().int().min(0).default(0),
  order: z.number().int().min(0).default(0),
  isEnabled: z.boolean().default(true)
})

export const updateHotItemSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  linkUrl: safeUrl.optional(),
  tag: z.enum(['hot', 'new']).nullable().optional(),
  heatValue: z.number().int().min(0).optional(),
  order: z.number().int().min(0).optional(),
  isEnabled: z.boolean().optional()
})

// ============ 客户端热搜"换一批"参数 ============

export const hotItemsRefreshQuerySchema = z.object({
  exclude: z
    .string()
    .max(740) // M1: 36 chars * 20 items + 20 commas = 740
    .optional()
    .transform((v) => {
      if (!v) return []
      const ids = v.split(',').filter(Boolean)
      if (ids.length > 20) {
        throw new Error('Maximum 20 exclude IDs allowed')
      }
      for (const id of ids) {
        if (!z.string().uuid().safeParse(id).success) {
          // M8: Do not leak user input in error messages
          throw new Error('Invalid UUID format in exclude parameter')
        }
      }
      return ids
    })
})

// ============ 导出类型 ============

export type CreateBannerInput = z.infer<typeof createBannerSchema>
export type UpdateBannerInput = z.infer<typeof updateBannerSchema>
export type CreateCourseCategoryInput = z.infer<typeof createCourseCategorySchema>
export type UpdateCourseCategoryInput = z.infer<typeof updateCourseCategorySchema>
export type CreateCourseInput = z.infer<typeof createCourseSchema>
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>
export type CreateDocumentCategoryInput = z.infer<typeof createDocumentCategorySchema>
export type UpdateDocumentCategoryInput = z.infer<typeof updateDocumentCategorySchema>
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>
export type CreateHotItemInput = z.infer<typeof createHotItemSchema>
export type UpdateHotItemInput = z.infer<typeof updateHotItemSchema>
