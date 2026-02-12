import { describe, expect, it } from 'vitest'

import { rolePermissionsSchema } from '../../schemas/index'
import { API_ROUTES, BANNER_IMAGE_LIMITS, DEFAULT_ROLE_PERMISSIONS } from '../index'

// ============ API_ROUTES.LEARNING_CENTER ============

describe('API_ROUTES.LEARNING_CENTER', () => {
  it('应定义 BASE 路由', () => {
    expect(API_ROUTES.LEARNING_CENTER.BASE).toBe('/learning-center')
  })

  it('应定义客户端聚合路由', () => {
    expect(API_ROUTES.LEARNING_CENTER.CLIENT).toBe('/learning-center/client')
    expect(API_ROUTES.LEARNING_CENTER.CLIENT_HOT_ITEMS).toBe('/learning-center/client/hot-items')
  })

  describe('Banner 路由', () => {
    it('应定义 Banner CRUD 路由', () => {
      expect(API_ROUTES.LEARNING_CENTER.BANNERS).toBe('/learning-center/banners')
      expect(API_ROUTES.LEARNING_CENTER.BANNER_UPLOAD).toBe('/learning-center/banners/upload')
    })

    it('应正确生成 Banner 动态路由', () => {
      const id = '550e8400-e29b-41d4-a716-446655440000'
      expect(API_ROUTES.LEARNING_CENTER.BANNER_BY_ID(id)).toBe(`/learning-center/banners/${id}`)
    })
  })

  describe('课程分类路由', () => {
    it('应定义课程分类列表路由', () => {
      expect(API_ROUTES.LEARNING_CENTER.COURSE_CATEGORIES).toBe('/learning-center/course-categories')
    })

    it('应正确生成课程分类动态路由', () => {
      const id = '550e8400-e29b-41d4-a716-446655440001'
      expect(API_ROUTES.LEARNING_CENTER.COURSE_CATEGORY_BY_ID(id)).toBe(`/learning-center/course-categories/${id}`)
    })
  })

  describe('课程路由', () => {
    it('应定义课程列表路由', () => {
      expect(API_ROUTES.LEARNING_CENTER.COURSES).toBe('/learning-center/courses')
    })

    it('应正确生成课程动态路由', () => {
      const id = '550e8400-e29b-41d4-a716-446655440002'
      expect(API_ROUTES.LEARNING_CENTER.COURSE_BY_ID(id)).toBe(`/learning-center/courses/${id}`)
    })
  })

  describe('文档分类路由', () => {
    it('应定义文档分类列表路由', () => {
      expect(API_ROUTES.LEARNING_CENTER.DOCUMENT_CATEGORIES).toBe('/learning-center/document-categories')
    })

    it('应正确生成文档分类动态路由', () => {
      const id = '550e8400-e29b-41d4-a716-446655440003'
      expect(API_ROUTES.LEARNING_CENTER.DOCUMENT_CATEGORY_BY_ID(id)).toBe(`/learning-center/document-categories/${id}`)
    })
  })

  describe('文档路由', () => {
    it('应定义文档列表路由', () => {
      expect(API_ROUTES.LEARNING_CENTER.DOCUMENTS).toBe('/learning-center/documents')
    })

    it('应正确生成文档动态路由', () => {
      const id = '550e8400-e29b-41d4-a716-446655440004'
      expect(API_ROUTES.LEARNING_CENTER.DOCUMENT_BY_ID(id)).toBe(`/learning-center/documents/${id}`)
    })
  })

  describe('热门项目路由', () => {
    it('应定义热门项目列表路由', () => {
      expect(API_ROUTES.LEARNING_CENTER.HOT_ITEMS).toBe('/learning-center/hot-items')
    })

    it('应正确生成热门项目动态路由', () => {
      const id = '550e8400-e29b-41d4-a716-446655440005'
      expect(API_ROUTES.LEARNING_CENTER.HOT_ITEM_BY_ID(id)).toBe(`/learning-center/hot-items/${id}`)
    })
  })
})

// ============ DEFAULT_ROLE_PERMISSIONS learningCenter ============

describe('DEFAULT_ROLE_PERMISSIONS learningCenter', () => {
  it('super_admin 应具有完整权限', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.super_admin.learningCenter).toEqual(['read', 'write', 'admin'])
  })

  it('admin 应具有完整权限', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.admin.learningCenter).toEqual(['read', 'write', 'admin'])
  })

  it('manager 应具有只读权限', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.manager.learningCenter).toEqual(['read'])
  })

  it('user 应具有只读权限', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.user.learningCenter).toEqual(['read'])
  })
})

// ============ BANNER_IMAGE_LIMITS ============

describe('BANNER_IMAGE_LIMITS', () => {
  it('应定义最大文件大小为 5MB', () => {
    expect(BANNER_IMAGE_LIMITS.MAX_FILE_SIZE).toBe(5 * 1024 * 1024)
  })

  it('应允许常见图片格式', () => {
    expect(BANNER_IMAGE_LIMITS.ALLOWED_EXTENSIONS).toContain('.jpg')
    expect(BANNER_IMAGE_LIMITS.ALLOWED_EXTENSIONS).toContain('.jpeg')
    expect(BANNER_IMAGE_LIMITS.ALLOWED_EXTENSIONS).toContain('.png')
    expect(BANNER_IMAGE_LIMITS.ALLOWED_EXTENSIONS).toContain('.webp')
    expect(BANNER_IMAGE_LIMITS.ALLOWED_EXTENSIONS).toContain('.gif')
  })

  it('应定义对应的 MIME 类型', () => {
    expect(BANNER_IMAGE_LIMITS.ALLOWED_MIME_TYPES).toContain('image/jpeg')
    expect(BANNER_IMAGE_LIMITS.ALLOWED_MIME_TYPES).toContain('image/png')
    expect(BANNER_IMAGE_LIMITS.ALLOWED_MIME_TYPES).toContain('image/webp')
    expect(BANNER_IMAGE_LIMITS.ALLOWED_MIME_TYPES).toContain('image/gif')
  })

  it('不应允许非图片格式', () => {
    expect(BANNER_IMAGE_LIMITS.ALLOWED_EXTENSIONS).not.toContain('.pdf')
    expect(BANNER_IMAGE_LIMITS.ALLOWED_EXTENSIONS).not.toContain('.doc')
    expect(BANNER_IMAGE_LIMITS.ALLOWED_MIME_TYPES).not.toContain('application/pdf')
  })
})

// ============ rolePermissionsSchema learningCenter ============

describe('rolePermissionsSchema learningCenter 字段', () => {
  it('包含 learningCenter 字段时应通过验证', () => {
    const input = {
      models: ['read'],
      knowledgeBases: ['read'],
      users: [],
      statistics: [],
      system: [],
      assistantPresets: [],
      learningCenter: ['read', 'write']
    }
    const result = rolePermissionsSchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.learningCenter).toEqual(['read', 'write'])
    }
  })

  it('learningCenter 默认值应为空数组', () => {
    const input = {
      models: [],
      knowledgeBases: [],
      users: [],
      statistics: [],
      system: [],
      assistantPresets: []
    }
    const result = rolePermissionsSchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.learningCenter).toEqual([])
    }
  })

  it('learningCenter 只接受有效权限值', () => {
    const validInput = {
      learningCenter: ['read', 'write', 'admin']
    }
    const result = rolePermissionsSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('learningCenter 应拒绝无效权限值', () => {
    const invalidInput = {
      learningCenter: ['read', 'invalid_permission']
    }
    const result = rolePermissionsSchema.safeParse(invalidInput)
    expect(result.success).toBe(false)
  })
})
