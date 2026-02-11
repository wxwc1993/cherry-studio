import type { BaseEntity } from './index'

// ============ 学习中心 Banner ============

export interface LcBanner extends BaseEntity {
  companyId: string
  title: string
  imageUrl: string
  linkUrl?: string
  linkType?: 'internal' | 'external'
  order: number
  isEnabled: boolean
}

// ============ 课程相关 ============

export interface LcCourseCategory extends BaseEntity {
  companyId: string
  name: string
  order: number
  isEnabled: boolean
}

export interface LcCourse extends BaseEntity {
  companyId: string
  categoryId?: string // SET NULL on category delete
  title: string
  description?: string
  coverUrl?: string
  videoUrl: string
  duration: number // seconds
  author?: string
  order: number
  isEnabled: boolean
  isRecommended: boolean
  viewCount: number
}

// ============ 文档相关 ============

export interface LcDocumentCategory extends BaseEntity {
  companyId: string
  name: string
  order: number
  isEnabled: boolean
}

export interface LcDocument extends BaseEntity {
  companyId: string
  categoryId?: string // SET NULL on category delete
  title: string
  description?: string
  coverUrl?: string
  linkUrl: string
  linkType: 'internal' | 'external'
  author?: string
  order: number
  isEnabled: boolean
  isRecommended: boolean
  viewCount: number
}

// ============ 热搜要闻 ============

export interface LcHotItem extends BaseEntity {
  companyId: string
  title: string
  linkUrl: string
  tag?: 'hot' | 'new'
  heatValue: number // 万
  order: number
  isEnabled: boolean
}

// ============ 客户端聚合响应 ============

export interface LcCategoryWithCourses extends LcCourseCategory {
  courses: LcCourse[]
}

export interface LcCategoryWithDocuments extends LcDocumentCategory {
  documents: LcDocument[]
}

export interface LcStats {
  totalCourses: number
  totalDocuments: number
  totalViews: number
}

export interface LcClientData {
  banners: LcBanner[]
  courseCategories: LcCategoryWithCourses[]
  documentCategories: LcCategoryWithDocuments[]
  hotItems: LcHotItem[]
  stats: LcStats
}
