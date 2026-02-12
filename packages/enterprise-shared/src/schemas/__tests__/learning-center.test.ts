/**
 * 学习中心 Zod Schema — RED 阶段测试
 *
 * 这些 Schema 尚未实现。运行本文件应看到全部 FAIL。
 * 实现路径：packages/enterprise-shared/src/schemas/learning-center.ts
 */

import { describe, expect, it } from 'vitest'

import {
  courseQuerySchema,
  // Types
  type CreateBannerInput,
  createBannerSchema,
  createCourseCategorySchema,
  type CreateCourseInput,
  createCourseSchema,
  createDocumentCategorySchema,
  type CreateDocumentInput,
  createDocumentSchema,
  type CreateHotItemInput,
  createHotItemSchema,
  documentQuerySchema,
  hotItemsRefreshQuerySchema,
  // Schema
  lcIdParamSchema,
  lcPaginationSchema,
  type UpdateBannerInput,
  updateBannerSchema,
  updateCourseCategorySchema,
  type UpdateCourseInput,
  updateCourseSchema,
  updateDocumentCategorySchema,
  type UpdateDocumentInput,
  updateDocumentSchema,
  type UpdateHotItemInput,
  updateHotItemSchema
} from '../learning-center'

// ────────────────────────────────────────────
// 测试辅助常量
// ────────────────────────────────────────────

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'
const VALID_UUID_2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
const VALID_URL = 'https://example.com/image.png'
const VALID_HTTP_URL = 'http://example.com/video.mp4'

/** 生成指定长度的字符串 */
function strOfLength(len: number): string {
  return 'a'.repeat(len)
}

/** 生成指定数量的 UUID 数组 */
function uuidsOfCount(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}`)
}

// ============================================================
// 1. lcIdParamSchema
// ============================================================

describe('lcIdParamSchema', () => {
  it('应接受有效的 UUID', () => {
    const result = lcIdParamSchema.safeParse({ id: VALID_UUID })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe(VALID_UUID)
    }
  })

  it('应拒绝非 UUID 格式的 id', () => {
    const result = lcIdParamSchema.safeParse({ id: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('应拒绝空字符串 id', () => {
    const result = lcIdParamSchema.safeParse({ id: '' })
    expect(result.success).toBe(false)
  })

  it('应拒绝缺少 id 字段', () => {
    const result = lcIdParamSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

// ============================================================
// 2. lcPaginationSchema
// ============================================================

describe('lcPaginationSchema', () => {
  it('应接受有效的分页参数', () => {
    const result = lcPaginationSchema.safeParse({ page: 2, pageSize: 50 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(2)
      expect(result.data.pageSize).toBe(50)
    }
  })

  it('应使用默认值 page=1, pageSize=20', () => {
    const result = lcPaginationSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.pageSize).toBe(20)
    }
  })

  it('应接受字符串数字（coerce）', () => {
    const result = lcPaginationSchema.safeParse({ page: '3', pageSize: '30' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(3)
      expect(result.data.pageSize).toBe(30)
    }
  })

  it('应拒绝 page < 1', () => {
    const result = lcPaginationSchema.safeParse({ page: 0 })
    expect(result.success).toBe(false)
  })

  it('应拒绝 pageSize = 0', () => {
    const result = lcPaginationSchema.safeParse({ pageSize: 0 })
    expect(result.success).toBe(false)
  })

  it('应拒绝 pageSize = 101（超过上限 100）', () => {
    const result = lcPaginationSchema.safeParse({ pageSize: 101 })
    expect(result.success).toBe(false)
  })

  it('应接受 pageSize = 1（下限边界）', () => {
    const result = lcPaginationSchema.safeParse({ pageSize: 1 })
    expect(result.success).toBe(true)
  })

  it('应接受 pageSize = 100（上限边界）', () => {
    const result = lcPaginationSchema.safeParse({ pageSize: 100 })
    expect(result.success).toBe(true)
  })
})

// ============================================================
// 3. Banner Schema
// ============================================================

describe('createBannerSchema', () => {
  const validBanner = {
    title: 'Test Banner',
    imageUrl: VALID_URL,
    linkUrl: 'https://example.com',
    linkType: 'external',
    order: 0,
    isEnabled: true
  }

  describe('有效输入', () => {
    it('应接受有效的完整输入', () => {
      const result = createBannerSchema.safeParse(validBanner)
      expect(result.success).toBe(true)
    })

    it('应接受仅必填字段', () => {
      const result = createBannerSchema.safeParse({
        title: 'Test Banner',
        imageUrl: VALID_URL
      })
      expect(result.success).toBe(true)
    })

    it('应接受 http 协议的 URL', () => {
      const result = createBannerSchema.safeParse({
        title: 'Banner',
        imageUrl: VALID_HTTP_URL
      })
      expect(result.success).toBe(true)
    })
  })

  describe('默认值', () => {
    it('order 默认值应为 0', () => {
      const result = createBannerSchema.safeParse({
        title: 'Banner',
        imageUrl: VALID_URL
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.order).toBe(0)
      }
    })

    it('isEnabled 默认值应为 true', () => {
      const result = createBannerSchema.safeParse({
        title: 'Banner',
        imageUrl: VALID_URL
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isEnabled).toBe(true)
      }
    })
  })

  describe('无效输入', () => {
    it('应拒绝空 title', () => {
      const result = createBannerSchema.safeParse({
        ...validBanner,
        title: ''
      })
      expect(result.success).toBe(false)
    })

    it('应拒绝超过 200 字符的 title', () => {
      const result = createBannerSchema.safeParse({
        ...validBanner,
        title: strOfLength(201)
      })
      expect(result.success).toBe(false)
    })

    it('应接受刚好 200 字符的 title', () => {
      const result = createBannerSchema.safeParse({
        ...validBanner,
        title: strOfLength(200)
      })
      expect(result.success).toBe(true)
    })

    it('应拒绝非 URL 格式的 imageUrl', () => {
      const result = createBannerSchema.safeParse({
        ...validBanner,
        imageUrl: 'not-a-url'
      })
      expect(result.success).toBe(false)
    })

    it('应拒绝负数 order', () => {
      const result = createBannerSchema.safeParse({
        ...validBanner,
        order: -1
      })
      expect(result.success).toBe(false)
    })
  })

  describe('安全校验 — URL 协议限制', () => {
    it('应拒绝 javascript: 协议的 imageUrl', () => {
      const result = createBannerSchema.safeParse({
        ...validBanner,
        imageUrl: 'javascript:alert(1)'
      })
      expect(result.success).toBe(false)
    })

    it('应拒绝 data: 协议的 imageUrl', () => {
      const result = createBannerSchema.safeParse({
        ...validBanner,
        imageUrl: 'data:text/html,<script>alert(1)</script>'
      })
      expect(result.success).toBe(false)
    })

    it('应拒绝 javascript: 协议的 linkUrl', () => {
      const result = createBannerSchema.safeParse({
        ...validBanner,
        linkUrl: 'javascript:alert(1)'
      })
      expect(result.success).toBe(false)
    })

    it('应拒绝 data: 协议的 linkUrl', () => {
      const result = createBannerSchema.safeParse({
        ...validBanner,
        linkUrl: 'data:text/html,<script>alert(1)</script>'
      })
      expect(result.success).toBe(false)
    })
  })
})

describe('updateBannerSchema', () => {
  it('应接受部分更新字段', () => {
    const result = updateBannerSchema.safeParse({
      title: 'Updated Banner'
    })
    expect(result.success).toBe(true)
  })

  it('应接受空对象（不更新任何字段）', () => {
    const result = updateBannerSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('应拒绝空 title', () => {
    const result = updateBannerSchema.safeParse({ title: '' })
    expect(result.success).toBe(false)
  })

  it('应拒绝 javascript: 协议的 imageUrl', () => {
    const result = updateBannerSchema.safeParse({
      imageUrl: 'javascript:alert(1)'
    })
    expect(result.success).toBe(false)
  })

  it('应拒绝 data: 协议的 linkUrl', () => {
    const result = updateBannerSchema.safeParse({
      linkUrl: 'data:text/html,<script>alert(1)</script>'
    })
    expect(result.success).toBe(false)
  })
})

// ============================================================
// 4. Course Category Schema
// ============================================================

describe('createCourseCategorySchema', () => {
  it('应接受有效输入', () => {
    const result = createCourseCategorySchema.safeParse({
      name: '编程课程',
      order: 1
    })
    expect(result.success).toBe(true)
  })

  it('应接受仅必填字段', () => {
    const result = createCourseCategorySchema.safeParse({
      name: '编程课程'
    })
    expect(result.success).toBe(true)
  })

  it('order 默认值应为 0', () => {
    const result = createCourseCategorySchema.safeParse({
      name: '编程课程'
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.order).toBe(0)
    }
  })

  it('应拒绝空 name', () => {
    const result = createCourseCategorySchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })
})

describe('updateCourseCategorySchema', () => {
  it('应接受部分更新', () => {
    const result = updateCourseCategorySchema.safeParse({ name: '新名称' })
    expect(result.success).toBe(true)
  })

  it('应接受空对象', () => {
    const result = updateCourseCategorySchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('应拒绝空 name', () => {
    const result = updateCourseCategorySchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })
})

// ============================================================
// 5. Course Schema
// ============================================================

describe('createCourseSchema', () => {
  const validCourse = {
    title: '入门教程',
    description: '这是一个入门教程',
    coverUrl: VALID_URL,
    videoUrl: VALID_URL,
    categoryId: VALID_UUID,
    order: 0,
    isEnabled: true
  }

  describe('有效输入', () => {
    it('应接受有效的完整输入', () => {
      const result = createCourseSchema.safeParse(validCourse)
      expect(result.success).toBe(true)
    })

    it('应接受仅必填字段', () => {
      const result = createCourseSchema.safeParse({
        title: '入门教程',
        categoryId: VALID_UUID
      })
      expect(result.success).toBe(true)
    })
  })

  describe('默认值', () => {
    it('order 默认值应为 0', () => {
      const result = createCourseSchema.safeParse({
        title: '入门教程',
        categoryId: VALID_UUID
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.order).toBe(0)
      }
    })

    it('isEnabled 默认值应为 true', () => {
      const result = createCourseSchema.safeParse({
        title: '入门教程',
        categoryId: VALID_UUID
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isEnabled).toBe(true)
      }
    })

    it('isRecommended 默认值应为 false', () => {
      const result = createCourseSchema.safeParse({
        title: '入门教程',
        categoryId: VALID_UUID
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isRecommended).toBe(false)
      }
    })
  })

  describe('无效输入', () => {
    it('应拒绝空 title', () => {
      const result = createCourseSchema.safeParse({
        ...validCourse,
        title: ''
      })
      expect(result.success).toBe(false)
    })

    it('应拒绝超过 300 字符的 title', () => {
      const result = createCourseSchema.safeParse({
        ...validCourse,
        title: strOfLength(301)
      })
      expect(result.success).toBe(false)
    })

    it('应接受刚好 300 字符的 title', () => {
      const result = createCourseSchema.safeParse({
        ...validCourse,
        title: strOfLength(300)
      })
      expect(result.success).toBe(true)
    })

    it('应拒绝超过 2000 字符的 description', () => {
      const result = createCourseSchema.safeParse({
        ...validCourse,
        description: strOfLength(2001)
      })
      expect(result.success).toBe(false)
    })

    it('应接受刚好 2000 字符的 description', () => {
      const result = createCourseSchema.safeParse({
        ...validCourse,
        description: strOfLength(2000)
      })
      expect(result.success).toBe(true)
    })

    it('应拒绝非 UUID 的 categoryId', () => {
      const result = createCourseSchema.safeParse({
        ...validCourse,
        categoryId: 'not-a-uuid'
      })
      expect(result.success).toBe(false)
    })

    it('应拒绝负数 order', () => {
      const result = createCourseSchema.safeParse({
        ...validCourse,
        order: -1
      })
      expect(result.success).toBe(false)
    })
  })

  describe('安全校验 — URL 协议限制', () => {
    it('应拒绝 javascript: 协议的 coverUrl', () => {
      const result = createCourseSchema.safeParse({
        ...validCourse,
        coverUrl: 'javascript:alert(1)'
      })
      expect(result.success).toBe(false)
    })

    it('应拒绝 data: 协议的 coverUrl', () => {
      const result = createCourseSchema.safeParse({
        ...validCourse,
        coverUrl: 'data:text/html,<script>alert(1)</script>'
      })
      expect(result.success).toBe(false)
    })

    it('应拒绝 javascript: 协议的 videoUrl', () => {
      const result = createCourseSchema.safeParse({
        ...validCourse,
        videoUrl: 'javascript:alert(1)'
      })
      expect(result.success).toBe(false)
    })

    it('应拒绝 data: 协议的 videoUrl', () => {
      const result = createCourseSchema.safeParse({
        ...validCourse,
        videoUrl: 'data:text/html,<script>alert(1)</script>'
      })
      expect(result.success).toBe(false)
    })
  })
})

describe('updateCourseSchema', () => {
  it('应接受部分更新', () => {
    const result = updateCourseSchema.safeParse({
      title: '更新后的标题'
    })
    expect(result.success).toBe(true)
  })

  it('应接受空对象', () => {
    const result = updateCourseSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('应拒绝空 title', () => {
    const result = updateCourseSchema.safeParse({ title: '' })
    expect(result.success).toBe(false)
  })

  it('应拒绝 javascript: 协议的 coverUrl', () => {
    const result = updateCourseSchema.safeParse({
      coverUrl: 'javascript:alert(1)'
    })
    expect(result.success).toBe(false)
  })

  it('应拒绝 data: 协议的 videoUrl', () => {
    const result = updateCourseSchema.safeParse({
      videoUrl: 'data:text/html,<script>alert(1)</script>'
    })
    expect(result.success).toBe(false)
  })
})

describe('courseQuerySchema', () => {
  it('应接受有效的查询参数', () => {
    const result = courseQuerySchema.safeParse({
      page: 1,
      pageSize: 20,
      categoryId: VALID_UUID,
      search: 'AI'
    })
    expect(result.success).toBe(true)
  })

  it('应使用默认分页值', () => {
    const result = courseQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.pageSize).toBe(20)
    }
  })

  it('应拒绝非 UUID 的 categoryId', () => {
    const result = courseQuerySchema.safeParse({ categoryId: 'invalid' })
    expect(result.success).toBe(false)
  })

  it('应接受 isEnabled 过滤', () => {
    const result = courseQuerySchema.safeParse({ isEnabled: true })
    expect(result.success).toBe(true)
  })

  it('应接受 isRecommended 过滤', () => {
    const result = courseQuerySchema.safeParse({ isRecommended: true })
    expect(result.success).toBe(true)
  })
})

// ============================================================
// 6. Document Category Schema
// ============================================================

describe('createDocumentCategorySchema', () => {
  it('应接受有效输入', () => {
    const result = createDocumentCategorySchema.safeParse({
      name: '技术文档',
      order: 1
    })
    expect(result.success).toBe(true)
  })

  it('应接受仅必填字段', () => {
    const result = createDocumentCategorySchema.safeParse({
      name: '技术文档'
    })
    expect(result.success).toBe(true)
  })

  it('order 默认值应为 0', () => {
    const result = createDocumentCategorySchema.safeParse({
      name: '技术文档'
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.order).toBe(0)
    }
  })

  it('应拒绝空 name', () => {
    const result = createDocumentCategorySchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })
})

describe('updateDocumentCategorySchema', () => {
  it('应接受部分更新', () => {
    const result = updateDocumentCategorySchema.safeParse({ name: '新分类' })
    expect(result.success).toBe(true)
  })

  it('应接受空对象', () => {
    const result = updateDocumentCategorySchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('应拒绝空 name', () => {
    const result = updateDocumentCategorySchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })
})

// ============================================================
// 7. Document Schema
// ============================================================

describe('createDocumentSchema', () => {
  const validDocument = {
    title: '使用指南',
    description: '详细的使用指南',
    coverUrl: VALID_URL,
    contentUrl: VALID_URL,
    categoryId: VALID_UUID,
    order: 0,
    isEnabled: true
  }

  describe('有效输入', () => {
    it('应接受有效的完整输入', () => {
      const result = createDocumentSchema.safeParse(validDocument)
      expect(result.success).toBe(true)
    })

    it('应接受仅必填字段', () => {
      const result = createDocumentSchema.safeParse({
        title: '使用指南',
        categoryId: VALID_UUID
      })
      expect(result.success).toBe(true)
    })
  })

  describe('默认值', () => {
    it('order 默认值应为 0', () => {
      const result = createDocumentSchema.safeParse({
        title: '使用指南',
        categoryId: VALID_UUID
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.order).toBe(0)
      }
    })

    it('isEnabled 默认值应为 true', () => {
      const result = createDocumentSchema.safeParse({
        title: '使用指南',
        categoryId: VALID_UUID
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isEnabled).toBe(true)
      }
    })

    it('isRecommended 默认值应为 false', () => {
      const result = createDocumentSchema.safeParse({
        title: '使用指南',
        categoryId: VALID_UUID
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isRecommended).toBe(false)
      }
    })
  })

  describe('无效输入', () => {
    it('应拒绝空 title', () => {
      const result = createDocumentSchema.safeParse({
        ...validDocument,
        title: ''
      })
      expect(result.success).toBe(false)
    })

    it('应拒绝超过 300 字符的 title', () => {
      const result = createDocumentSchema.safeParse({
        ...validDocument,
        title: strOfLength(301)
      })
      expect(result.success).toBe(false)
    })

    it('应接受刚好 300 字符的 title', () => {
      const result = createDocumentSchema.safeParse({
        ...validDocument,
        title: strOfLength(300)
      })
      expect(result.success).toBe(true)
    })

    it('应拒绝超过 2000 字符的 description', () => {
      const result = createDocumentSchema.safeParse({
        ...validDocument,
        description: strOfLength(2001)
      })
      expect(result.success).toBe(false)
    })

    it('应接受刚好 2000 字符的 description', () => {
      const result = createDocumentSchema.safeParse({
        ...validDocument,
        description: strOfLength(2000)
      })
      expect(result.success).toBe(true)
    })

    it('应拒绝非 UUID 的 categoryId', () => {
      const result = createDocumentSchema.safeParse({
        ...validDocument,
        categoryId: 'invalid'
      })
      expect(result.success).toBe(false)
    })

    it('应拒绝负数 order', () => {
      const result = createDocumentSchema.safeParse({
        ...validDocument,
        order: -1
      })
      expect(result.success).toBe(false)
    })
  })

  describe('安全校验 — URL 协议限制', () => {
    it('应拒绝 javascript: 协议的 coverUrl', () => {
      const result = createDocumentSchema.safeParse({
        ...validDocument,
        coverUrl: 'javascript:alert(1)'
      })
      expect(result.success).toBe(false)
    })

    it('应拒绝 data: 协议的 coverUrl', () => {
      const result = createDocumentSchema.safeParse({
        ...validDocument,
        coverUrl: 'data:text/html,<script>alert(1)</script>'
      })
      expect(result.success).toBe(false)
    })

    it('应拒绝 javascript: 协议的 contentUrl', () => {
      const result = createDocumentSchema.safeParse({
        ...validDocument,
        contentUrl: 'javascript:alert(1)'
      })
      expect(result.success).toBe(false)
    })

    it('应拒绝 data: 协议的 contentUrl', () => {
      const result = createDocumentSchema.safeParse({
        ...validDocument,
        contentUrl: 'data:text/html,<script>alert(1)</script>'
      })
      expect(result.success).toBe(false)
    })
  })
})

describe('updateDocumentSchema', () => {
  it('应接受部分更新', () => {
    const result = updateDocumentSchema.safeParse({
      title: '更新后的标题'
    })
    expect(result.success).toBe(true)
  })

  it('应接受空对象', () => {
    const result = updateDocumentSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('应拒绝空 title', () => {
    const result = updateDocumentSchema.safeParse({ title: '' })
    expect(result.success).toBe(false)
  })

  it('应拒绝 javascript: 协议的 coverUrl', () => {
    const result = updateDocumentSchema.safeParse({
      coverUrl: 'javascript:alert(1)'
    })
    expect(result.success).toBe(false)
  })

  it('应拒绝 data: 协议的 contentUrl', () => {
    const result = updateDocumentSchema.safeParse({
      contentUrl: 'data:text/html,<script>alert(1)</script>'
    })
    expect(result.success).toBe(false)
  })
})

describe('documentQuerySchema', () => {
  it('应接受有效的查询参数', () => {
    const result = documentQuerySchema.safeParse({
      page: 1,
      pageSize: 20,
      categoryId: VALID_UUID,
      search: 'API'
    })
    expect(result.success).toBe(true)
  })

  it('应使用默认分页值', () => {
    const result = documentQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.pageSize).toBe(20)
    }
  })

  it('应拒绝非 UUID 的 categoryId', () => {
    const result = documentQuerySchema.safeParse({ categoryId: 'invalid' })
    expect(result.success).toBe(false)
  })

  it('应接受 isEnabled 过滤', () => {
    const result = documentQuerySchema.safeParse({ isEnabled: true })
    expect(result.success).toBe(true)
  })

  it('应接受 isRecommended 过滤', () => {
    const result = documentQuerySchema.safeParse({ isRecommended: true })
    expect(result.success).toBe(true)
  })
})

// ============================================================
// 8. Hot Item Schema
// ============================================================

describe('createHotItemSchema', () => {
  const validHotItem = {
    title: '热门推荐',
    description: '这是一个热门推荐',
    coverUrl: VALID_URL,
    linkUrl: 'https://example.com/article',
    itemType: 'course',
    itemId: VALID_UUID,
    order: 0,
    isEnabled: true
  }

  describe('有效输入', () => {
    it('应接受有效的完整输入', () => {
      const result = createHotItemSchema.safeParse(validHotItem)
      expect(result.success).toBe(true)
    })

    it('应接受仅必填字段', () => {
      const result = createHotItemSchema.safeParse({
        title: '热门推荐',
        itemType: 'course',
        itemId: VALID_UUID
      })
      expect(result.success).toBe(true)
    })
  })

  describe('默认值', () => {
    it('order 默认值应为 0', () => {
      const result = createHotItemSchema.safeParse({
        title: '热门推荐',
        itemType: 'course',
        itemId: VALID_UUID
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.order).toBe(0)
      }
    })

    it('isEnabled 默认值应为 true', () => {
      const result = createHotItemSchema.safeParse({
        title: '热门推荐',
        itemType: 'course',
        itemId: VALID_UUID
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isEnabled).toBe(true)
      }
    })
  })

  describe('无效输入', () => {
    it('应拒绝空 title', () => {
      const result = createHotItemSchema.safeParse({
        ...validHotItem,
        title: ''
      })
      expect(result.success).toBe(false)
    })

    it('应拒绝非 UUID 的 itemId', () => {
      const result = createHotItemSchema.safeParse({
        ...validHotItem,
        itemId: 'not-uuid'
      })
      expect(result.success).toBe(false)
    })

    it('应拒绝负数 order', () => {
      const result = createHotItemSchema.safeParse({
        ...validHotItem,
        order: -1
      })
      expect(result.success).toBe(false)
    })
  })

  describe('安全校验 — URL 协议限制', () => {
    it('应拒绝 javascript: 协议的 coverUrl', () => {
      const result = createHotItemSchema.safeParse({
        ...validHotItem,
        coverUrl: 'javascript:alert(1)'
      })
      expect(result.success).toBe(false)
    })

    it('应拒绝 data: 协议的 coverUrl', () => {
      const result = createHotItemSchema.safeParse({
        ...validHotItem,
        coverUrl: 'data:text/html,<script>alert(1)</script>'
      })
      expect(result.success).toBe(false)
    })

    it('应拒绝 javascript: 协议的 linkUrl', () => {
      const result = createHotItemSchema.safeParse({
        ...validHotItem,
        linkUrl: 'javascript:alert(1)'
      })
      expect(result.success).toBe(false)
    })

    it('应拒绝 data: 协议的 linkUrl', () => {
      const result = createHotItemSchema.safeParse({
        ...validHotItem,
        linkUrl: 'data:text/html,<script>alert(1)</script>'
      })
      expect(result.success).toBe(false)
    })
  })
})

describe('updateHotItemSchema', () => {
  it('应接受部分更新', () => {
    const result = updateHotItemSchema.safeParse({
      title: '更新后的推荐'
    })
    expect(result.success).toBe(true)
  })

  it('应接受空对象', () => {
    const result = updateHotItemSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('应拒绝空 title', () => {
    const result = updateHotItemSchema.safeParse({ title: '' })
    expect(result.success).toBe(false)
  })

  it('应拒绝 javascript: 协议的 coverUrl', () => {
    const result = updateHotItemSchema.safeParse({
      coverUrl: 'javascript:alert(1)'
    })
    expect(result.success).toBe(false)
  })

  it('应拒绝 data: 协议的 linkUrl', () => {
    const result = updateHotItemSchema.safeParse({
      linkUrl: 'data:text/html,<script>alert(1)</script>'
    })
    expect(result.success).toBe(false)
  })
})

// ============================================================
// 9. hotItemsRefreshQuerySchema（M1 修订）
// ============================================================

describe('hotItemsRefreshQuerySchema', () => {
  it('应接受不带 exclude 的请求', () => {
    const result = hotItemsRefreshQuerySchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('exclude 为空字符串时应返回空数组', () => {
    const result = hotItemsRefreshQuerySchema.safeParse({ exclude: '' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.exclude).toEqual([])
    }
  })

  it('exclude 包含有效 UUID 时应正确解析', () => {
    const result = hotItemsRefreshQuerySchema.safeParse({
      exclude: `${VALID_UUID},${VALID_UUID_2}`
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.exclude).toEqual([VALID_UUID, VALID_UUID_2])
    }
  })

  it('应拒绝包含无效 UUID 的 exclude', () => {
    const result = hotItemsRefreshQuerySchema.safeParse({
      exclude: `${VALID_UUID},not-a-uuid`
    })
    expect(result.success).toBe(false)
  })

  it('应拒绝超过 20 个 UUID 的 exclude', () => {
    const ids = uuidsOfCount(21)
    const result = hotItemsRefreshQuerySchema.safeParse({
      exclude: ids.join(',')
    })
    expect(result.success).toBe(false)
  })

  it('应接受刚好 20 个 UUID 的 exclude', () => {
    const ids = uuidsOfCount(20)
    const result = hotItemsRefreshQuerySchema.safeParse({
      exclude: ids.join(',')
    })
    expect(result.success).toBe(true)
  })

  it('应拒绝 exclude 总长度超过 740 字符', () => {
    // 20 个 UUID（36 chars each）+ 19 个逗号 = 739 chars → 合法
    // 构造一个超长字符串
    const longExclude = strOfLength(741)
    const result = hotItemsRefreshQuerySchema.safeParse({
      exclude: longExclude
    })
    expect(result.success).toBe(false)
  })

  it('错误消息不应泄露用户输入值（M8 修订）', () => {
    const maliciousInput = '<script>alert("xss")</script>'
    const result = hotItemsRefreshQuerySchema.safeParse({
      exclude: maliciousInput
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const errorMessage = JSON.stringify(result.error.issues)
      expect(errorMessage).not.toContain(maliciousInput)
    }
  })
})

// ============================================================
// 10. 导出类型验证
// ============================================================

describe('导出类型', () => {
  it('CreateBannerInput 类型应可用', () => {
    const input: CreateBannerInput = {
      title: 'Banner',
      imageUrl: VALID_URL,
      order: 0,
      isEnabled: true
    }
    expect(input.title).toBe('Banner')
  })

  it('UpdateBannerInput 类型应可用', () => {
    const input: UpdateBannerInput = {
      title: 'Updated'
    }
    expect(input.title).toBe('Updated')
  })

  it('CreateCourseInput 类型应可用', () => {
    const input: CreateCourseInput = {
      title: 'Course',
      categoryId: VALID_UUID,
      duration: 3600,
      order: 0,
      isEnabled: true,
      isRecommended: false
    }
    expect(input.title).toBe('Course')
  })

  it('UpdateCourseInput 类型应可用', () => {
    const input: UpdateCourseInput = {
      title: 'Updated Course'
    }
    expect(input.title).toBe('Updated Course')
  })

  it('CreateDocumentInput 类型应可用', () => {
    const input: CreateDocumentInput = {
      title: 'Document',
      categoryId: VALID_UUID,
      order: 0,
      isEnabled: true,
      isRecommended: false
    }
    expect(input.title).toBe('Document')
  })

  it('UpdateDocumentInput 类型应可用', () => {
    const input: UpdateDocumentInput = {
      title: 'Updated Document'
    }
    expect(input.title).toBe('Updated Document')
  })

  it('CreateHotItemInput 类型应可用', () => {
    const input: CreateHotItemInput = {
      title: 'Hot Item',
      itemType: 'course',
      itemId: VALID_UUID,
      order: 0,
      isEnabled: true
    }
    expect(input.title).toBe('Hot Item')
  })

  it('UpdateHotItemInput 类型应可用', () => {
    const input: UpdateHotItemInput = {
      title: 'Updated Hot Item'
    }
    expect(input.title).toBe('Updated Hot Item')
  })
})
