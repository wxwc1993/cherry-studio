import { describe, expect, it } from 'vitest'

import type { LearningCenterPermission, RolePermissions } from '../index'
import type {
  LcBanner,
  LcCategoryWithCourses,
  LcCategoryWithDocuments,
  LcClientData,
  LcCourse,
  LcCourseCategory,
  LcDocument,
  LcDocumentCategory,
  LcHotItem,
  LcStats
} from '../learning-center'

// ============ 1. 类型导出验证 ============

describe('Learning Center type exports', () => {
  it('should export all types from learning-center module', () => {
    // 编译时验证：如果类型不存在，TypeScript 编译失败
    const _assertTypes: [
      LcBanner,
      LcCourseCategory,
      LcCourse,
      LcDocumentCategory,
      LcDocument,
      LcHotItem,
      LcCategoryWithCourses,
      LcCategoryWithDocuments,
      LcStats,
      LcClientData
    ] = undefined as never

    void _assertTypes
    expect(true).toBe(true)
  })

  it('should export LearningCenterPermission from index', () => {
    const _permission: LearningCenterPermission = undefined as never
    void _permission
    expect(true).toBe(true)
  })
})

// ============ 2. 类型结构编译时验证 ============

describe('LcBanner', () => {
  it('should have all required fields', () => {
    const banner = {
      id: 'banner-1',
      companyId: 'company-1',
      title: '欢迎使用学习中心',
      imageUrl: 'https://example.com/banner.png',
      order: 1,
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    } satisfies LcBanner

    expect(banner.id).toBe('banner-1')
    expect(banner.companyId).toBe('company-1')
    expect(banner.title).toBe('欢迎使用学习中心')
    expect(banner.imageUrl).toBe('https://example.com/banner.png')
    expect(banner.order).toBe(1)
    expect(banner.isEnabled).toBe(true)
    expect(banner.createdAt).toBeInstanceOf(Date)
    expect(banner.updatedAt).toBeInstanceOf(Date)
  })

  it('should accept optional linkUrl field', () => {
    const banner = {
      id: 'banner-2',
      companyId: 'company-1',
      title: '活动公告',
      imageUrl: 'https://example.com/event.png',
      linkUrl: 'https://example.com/event',
      order: 2,
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    } satisfies LcBanner

    expect(banner.linkUrl).toBe('https://example.com/event')
  })

  it('should accept optional linkType field', () => {
    const banner = {
      id: 'banner-3',
      companyId: 'company-1',
      title: '课程推荐',
      imageUrl: 'https://example.com/course.png',
      linkUrl: 'https://example.com/course/1',
      linkType: 'external',
      order: 3,
      isEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date()
    } satisfies LcBanner

    expect(banner.linkType).toBe('external')
  })
})

describe('LcCourse', () => {
  it('should have all required fields', () => {
    const course = {
      id: 'course-1',
      companyId: 'company-1',
      title: 'AI 入门课程',
      videoUrl: 'https://example.com/video.mp4',
      duration: 3600,
      order: 1,
      isEnabled: true,
      isRecommended: false,
      viewCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    } satisfies LcCourse

    expect(course.id).toBe('course-1')
    expect(course.companyId).toBe('company-1')
    expect(course.title).toBe('AI 入门课程')
    expect(course.videoUrl).toBe('https://example.com/video.mp4')
    expect(course.duration).toBe(3600)
    expect(course.order).toBe(1)
    expect(course.isEnabled).toBe(true)
    expect(course.isRecommended).toBe(false)
    expect(course.viewCount).toBe(0)
  })

  it('should accept optional categoryId field', () => {
    const course = {
      id: 'course-2',
      companyId: 'company-1',
      title: '进阶课程',
      videoUrl: 'https://example.com/advanced.mp4',
      duration: 7200,
      order: 2,
      isEnabled: true,
      isRecommended: true,
      viewCount: 100,
      categoryId: 'cat-1',
      createdAt: new Date(),
      updatedAt: new Date()
    } satisfies LcCourse

    expect(course.categoryId).toBe('cat-1')
  })

  it('should accept optional description, coverUrl, and author fields', () => {
    const course = {
      id: 'course-3',
      companyId: 'company-1',
      title: '完整课程',
      videoUrl: 'https://example.com/full.mp4',
      duration: 5400,
      order: 3,
      isEnabled: true,
      isRecommended: false,
      viewCount: 50,
      description: '一门完整的课程',
      coverUrl: 'https://example.com/cover.png',
      author: '张三',
      createdAt: new Date(),
      updatedAt: new Date()
    } satisfies LcCourse

    expect(course.description).toBe('一门完整的课程')
    expect(course.coverUrl).toBe('https://example.com/cover.png')
    expect(course.author).toBe('张三')
  })
})

describe('LcDocument', () => {
  it('should have all required fields', () => {
    const doc = {
      id: 'doc-1',
      companyId: 'company-1',
      title: '使用指南',
      linkUrl: 'https://example.com/guide.pdf',
      linkType: 'external',
      order: 1,
      isEnabled: true,
      isRecommended: false,
      viewCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    } satisfies LcDocument

    expect(doc.id).toBe('doc-1')
    expect(doc.companyId).toBe('company-1')
    expect(doc.title).toBe('使用指南')
    expect(doc.linkUrl).toBe('https://example.com/guide.pdf')
    expect(doc.linkType).toBe('external')
    expect(doc.order).toBe(1)
    expect(doc.isEnabled).toBe(true)
    expect(doc.isRecommended).toBe(false)
    expect(doc.viewCount).toBe(0)
  })

  it('should accept optional categoryId field', () => {
    const doc = {
      id: 'doc-2',
      companyId: 'company-1',
      title: '分类文档',
      linkUrl: 'https://example.com/doc.pdf',
      linkType: 'external',
      order: 2,
      isEnabled: true,
      isRecommended: true,
      viewCount: 20,
      categoryId: 'doc-cat-1',
      createdAt: new Date(),
      updatedAt: new Date()
    } satisfies LcDocument

    expect(doc.categoryId).toBe('doc-cat-1')
  })

  it('should accept optional description, coverUrl, and author fields', () => {
    const doc = {
      id: 'doc-3',
      companyId: 'company-1',
      title: '完整文档',
      linkUrl: 'https://example.com/full-doc.html',
      linkType: 'external',
      order: 3,
      isEnabled: true,
      isRecommended: false,
      viewCount: 10,
      description: '一份详细的文档',
      coverUrl: 'https://example.com/doc-cover.png',
      author: '李四',
      createdAt: new Date(),
      updatedAt: new Date()
    } satisfies LcDocument

    expect(doc.description).toBe('一份详细的文档')
    expect(doc.coverUrl).toBe('https://example.com/doc-cover.png')
    expect(doc.author).toBe('李四')
  })
})

describe('LcHotItem', () => {
  it('should have all required fields', () => {
    const hotItem = {
      id: 'hot-1',
      companyId: 'company-1',
      title: '热门话题',
      linkUrl: 'https://example.com/hot',
      heatValue: 999,
      order: 1,
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    } satisfies LcHotItem

    expect(hotItem.id).toBe('hot-1')
    expect(hotItem.companyId).toBe('company-1')
    expect(hotItem.title).toBe('热门话题')
    expect(hotItem.linkUrl).toBe('https://example.com/hot')
    expect(hotItem.heatValue).toBe(999)
    expect(hotItem.order).toBe(1)
    expect(hotItem.isEnabled).toBe(true)
  })

  it('should accept optional tag field', () => {
    const hotItem = {
      id: 'hot-2',
      companyId: 'company-1',
      title: '带标签的热门',
      linkUrl: 'https://example.com/hot-tagged',
      heatValue: 500,
      order: 2,
      isEnabled: true,
      tag: 'hot',
      createdAt: new Date(),
      updatedAt: new Date()
    } satisfies LcHotItem

    expect(hotItem.tag).toBe('hot')
  })
})

describe('LcStats', () => {
  it('should have all required fields', () => {
    const stats = {
      totalCourses: 42,
      totalDocuments: 108,
      totalViews: 9999
    } satisfies LcStats

    expect(stats.totalCourses).toBe(42)
    expect(stats.totalDocuments).toBe(108)
    expect(stats.totalViews).toBe(9999)
  })
})

describe('LcClientData', () => {
  it('should have all required fields', () => {
    const clientData = {
      banners: [] as LcBanner[],
      courseCategories: [] as LcCategoryWithCourses[],
      documentCategories: [] as LcCategoryWithDocuments[],
      hotItems: [] as LcHotItem[],
      stats: {
        totalCourses: 0,
        totalDocuments: 0,
        totalViews: 0
      }
    } satisfies LcClientData

    expect(clientData.banners).toEqual([])
    expect(clientData.courseCategories).toEqual([])
    expect(clientData.documentCategories).toEqual([])
    expect(clientData.hotItems).toEqual([])
    expect(clientData.stats.totalCourses).toBe(0)
    expect(clientData.stats.totalDocuments).toBe(0)
    expect(clientData.stats.totalViews).toBe(0)
  })
})

// ============ 3. RolePermissions 兼容性 ============

describe('RolePermissions compatibility', () => {
  it('should accept legacy data without learningCenter field', () => {
    const legacyPermissions: RolePermissions = {
      models: ['read', 'use'],
      knowledgeBases: ['read'],
      users: ['read'],
      statistics: ['read'],
      system: ['settings'],
      assistantPresets: ['read']
    }

    expect(legacyPermissions.models).toEqual(['read', 'use'])
    expect(legacyPermissions).not.toHaveProperty('learningCenter')
  })

  it('should accept new data with learningCenter field', () => {
    const newPermissions: RolePermissions = {
      models: ['read', 'use'],
      knowledgeBases: ['read', 'write'],
      users: ['read', 'write', 'admin'],
      statistics: ['read', 'export'],
      system: ['backup', 'restore', 'settings'],
      assistantPresets: ['read', 'write', 'admin'],
      learningCenter: ['read', 'write', 'admin']
    }

    expect(newPermissions.learningCenter).toEqual(['read', 'write', 'admin'])
  })
})

// ============ 4. LearningCenterPermission 类型 ============

describe('LearningCenterPermission', () => {
  it('should accept "read" as a valid value', () => {
    const permission: LearningCenterPermission = 'read'
    expect(permission).toBe('read')
  })

  it('should accept "write" as a valid value', () => {
    const permission: LearningCenterPermission = 'write'
    expect(permission).toBe('write')
  })

  it('should accept "admin" as a valid value', () => {
    const permission: LearningCenterPermission = 'admin'
    expect(permission).toBe('admin')
  })

  it('should be usable in arrays for RolePermissions', () => {
    const permissions: LearningCenterPermission[] = ['read', 'write', 'admin']
    expect(permissions).toHaveLength(3)
    expect(permissions).toContain('read')
    expect(permissions).toContain('write')
    expect(permissions).toContain('admin')
  })
})
