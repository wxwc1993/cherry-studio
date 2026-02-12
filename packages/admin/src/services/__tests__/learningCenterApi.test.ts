import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the api module before importing the module under test
vi.mock('../api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} })
  }
}))

// Import after mock setup so the mock is applied
import { api } from '../api'
import { learningCenterApi } from '../learningCenterApi'

describe('learningCenterApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ============ Module export validation ============

  it('should export a learningCenterApi object', () => {
    expect(learningCenterApi).toBeDefined()
    expect(typeof learningCenterApi).toBe('object')
  })

  it('should have all 24 API methods', () => {
    const expectedMethods = [
      // Banner (4)
      'listBanners',
      'createBanner',
      'updateBanner',
      'deleteBanner',
      // Course categories (4)
      'listCourseCategories',
      'createCourseCategory',
      'updateCourseCategory',
      'deleteCourseCategory',
      // Courses (4)
      'listCourses',
      'createCourse',
      'updateCourse',
      'deleteCourse',
      // Document categories (4)
      'listDocumentCategories',
      'createDocumentCategory',
      'updateDocumentCategory',
      'deleteDocumentCategory',
      // Documents (4)
      'listDocuments',
      'createDocument',
      'updateDocument',
      'deleteDocument',
      // Hot items (4)
      'listHotItems',
      'createHotItem',
      'updateHotItem',
      'deleteHotItem'
    ]

    for (const method of expectedMethods) {
      expect(learningCenterApi).toHaveProperty(method)
      expect(typeof learningCenterApi[method as keyof typeof learningCenterApi]).toBe('function')
    }
  })

  // ============ Banner CRUD ============

  describe('Banner CRUD', () => {
    it('listBanners should call api.get with correct path', async () => {
      await learningCenterApi.listBanners()
      expect(api.get).toHaveBeenCalledWith('/learning-center/banners', expect.objectContaining({ params: undefined }))
    })

    it('listBanners should forward params', async () => {
      const params = { page: 1, pageSize: 10, isEnabled: true }
      await learningCenterApi.listBanners(params)
      expect(api.get).toHaveBeenCalledWith('/learning-center/banners', { params })
    })

    it('createBanner should call api.post with correct path and data', async () => {
      const data = {
        title: 'Test Banner',
        imageUrl: 'https://example.com/banner.png',
        linkUrl: 'https://example.com',
        linkType: 'external',
        order: 1,
        isEnabled: true
      }
      await learningCenterApi.createBanner(data)
      expect(api.post).toHaveBeenCalledWith('/learning-center/banners', data)
    })

    it('updateBanner should call api.patch with correct ID and data', async () => {
      const id = 'banner-123'
      const data = { title: 'Updated Banner', order: 2 }
      await learningCenterApi.updateBanner(id, data)
      expect(api.patch).toHaveBeenCalledWith(`/learning-center/banners/${id}`, data)
    })

    it('deleteBanner should call api.delete with correct ID', async () => {
      const id = 'banner-456'
      await learningCenterApi.deleteBanner(id)
      expect(api.delete).toHaveBeenCalledWith(`/learning-center/banners/${id}`)
    })
  })

  // ============ Course Category CRUD ============

  describe('Course Category CRUD', () => {
    it('listCourseCategories should call api.get with correct path', async () => {
      await learningCenterApi.listCourseCategories()
      expect(api.get).toHaveBeenCalledWith('/learning-center/course-categories')
    })

    it('createCourseCategory should call api.post with correct path and data', async () => {
      const data = { name: 'AI Basics', order: 1, isEnabled: true }
      await learningCenterApi.createCourseCategory(data)
      expect(api.post).toHaveBeenCalledWith('/learning-center/course-categories', data)
    })

    it('updateCourseCategory should call api.patch with correct ID and data', async () => {
      const id = 'cat-001'
      const data = { name: 'AI Advanced', order: 2 }
      await learningCenterApi.updateCourseCategory(id, data)
      expect(api.patch).toHaveBeenCalledWith(`/learning-center/course-categories/${id}`, data)
    })

    it('deleteCourseCategory should call api.delete with correct ID', async () => {
      const id = 'cat-002'
      await learningCenterApi.deleteCourseCategory(id)
      expect(api.delete).toHaveBeenCalledWith(`/learning-center/course-categories/${id}`)
    })
  })

  // ============ Course CRUD ============

  describe('Course CRUD', () => {
    it('listCourses should call api.get with correct path', async () => {
      await learningCenterApi.listCourses()
      expect(api.get).toHaveBeenCalledWith('/learning-center/courses', expect.objectContaining({ params: undefined }))
    })

    it('listCourses should forward params for filtering and pagination', async () => {
      const params = { page: 2, pageSize: 20, categoryId: 'cat-001', search: 'AI' }
      await learningCenterApi.listCourses(params)
      expect(api.get).toHaveBeenCalledWith('/learning-center/courses', { params })
    })

    it('createCourse should call api.post with correct path and data', async () => {
      const data = {
        title: 'Deep Learning 101',
        videoUrl: 'https://example.com/video.mp4',
        duration: 3600,
        categoryId: 'cat-001',
        author: 'Zhang San',
        order: 1,
        isEnabled: true,
        isRecommended: false
      }
      await learningCenterApi.createCourse(data)
      expect(api.post).toHaveBeenCalledWith('/learning-center/courses', data)
    })

    it('updateCourse should call api.patch with correct ID and data', async () => {
      const id = 'course-001'
      const data = { title: 'Updated Course', isRecommended: true }
      await learningCenterApi.updateCourse(id, data)
      expect(api.patch).toHaveBeenCalledWith(`/learning-center/courses/${id}`, data)
    })

    it('deleteCourse should call api.delete with correct ID', async () => {
      const id = 'course-002'
      await learningCenterApi.deleteCourse(id)
      expect(api.delete).toHaveBeenCalledWith(`/learning-center/courses/${id}`)
    })
  })

  // ============ Document Category CRUD ============

  describe('Document Category CRUD', () => {
    it('listDocumentCategories should call api.get with correct path', async () => {
      await learningCenterApi.listDocumentCategories()
      expect(api.get).toHaveBeenCalledWith('/learning-center/document-categories')
    })

    it('createDocumentCategory should call api.post with correct path and data', async () => {
      const data = { name: 'User Guides', order: 1, isEnabled: true }
      await learningCenterApi.createDocumentCategory(data)
      expect(api.post).toHaveBeenCalledWith('/learning-center/document-categories', data)
    })

    it('updateDocumentCategory should call api.patch with correct ID and data', async () => {
      const id = 'doc-cat-001'
      const data = { name: 'Developer Guides', order: 3 }
      await learningCenterApi.updateDocumentCategory(id, data)
      expect(api.patch).toHaveBeenCalledWith(`/learning-center/document-categories/${id}`, data)
    })

    it('deleteDocumentCategory should call api.delete with correct ID', async () => {
      const id = 'doc-cat-002'
      await learningCenterApi.deleteDocumentCategory(id)
      expect(api.delete).toHaveBeenCalledWith(`/learning-center/document-categories/${id}`)
    })
  })

  // ============ Document CRUD ============

  describe('Document CRUD', () => {
    it('listDocuments should call api.get with correct path', async () => {
      await learningCenterApi.listDocuments()
      expect(api.get).toHaveBeenCalledWith('/learning-center/documents', expect.objectContaining({ params: undefined }))
    })

    it('listDocuments should forward params for filtering and pagination', async () => {
      const params = { page: 1, pageSize: 15, categoryId: 'doc-cat-001', search: 'guide' }
      await learningCenterApi.listDocuments(params)
      expect(api.get).toHaveBeenCalledWith('/learning-center/documents', { params })
    })

    it('createDocument should call api.post with correct path and data', async () => {
      const data = {
        title: 'Getting Started Guide',
        linkUrl: 'https://example.com/guide.pdf',
        linkType: 'pdf',
        categoryId: 'doc-cat-001',
        author: 'Li Si',
        order: 1,
        isEnabled: true,
        isRecommended: true
      }
      await learningCenterApi.createDocument(data)
      expect(api.post).toHaveBeenCalledWith('/learning-center/documents', data)
    })

    it('updateDocument should call api.patch with correct ID and data', async () => {
      const id = 'doc-001'
      const data = { title: 'Updated Guide', isRecommended: false }
      await learningCenterApi.updateDocument(id, data)
      expect(api.patch).toHaveBeenCalledWith(`/learning-center/documents/${id}`, data)
    })

    it('deleteDocument should call api.delete with correct ID', async () => {
      const id = 'doc-002'
      await learningCenterApi.deleteDocument(id)
      expect(api.delete).toHaveBeenCalledWith(`/learning-center/documents/${id}`)
    })
  })

  // ============ Hot Item CRUD ============

  describe('Hot Item CRUD', () => {
    it('listHotItems should call api.get with correct path', async () => {
      await learningCenterApi.listHotItems()
      expect(api.get).toHaveBeenCalledWith('/learning-center/hot-items', expect.objectContaining({ params: undefined }))
    })

    it('listHotItems should forward params', async () => {
      const params = { page: 1, pageSize: 10 }
      await learningCenterApi.listHotItems(params)
      expect(api.get).toHaveBeenCalledWith('/learning-center/hot-items', { params })
    })

    it('createHotItem should call api.post with correct path and data', async () => {
      const data = {
        title: 'Trending Topic',
        linkUrl: 'https://example.com/trending',
        tag: 'hot',
        heatValue: 999,
        order: 1,
        isEnabled: true
      }
      await learningCenterApi.createHotItem(data)
      expect(api.post).toHaveBeenCalledWith('/learning-center/hot-items', data)
    })

    it('updateHotItem should call api.patch with correct ID and data', async () => {
      const id = 'hot-001'
      const data = { title: 'Updated Hot Topic', heatValue: 1500 }
      await learningCenterApi.updateHotItem(id, data)
      expect(api.patch).toHaveBeenCalledWith(`/learning-center/hot-items/${id}`, data)
    })

    it('deleteHotItem should call api.delete with correct ID', async () => {
      const id = 'hot-002'
      await learningCenterApi.deleteHotItem(id)
      expect(api.delete).toHaveBeenCalledWith(`/learning-center/hot-items/${id}`)
    })
  })

  // ============ Edge cases ============

  describe('Edge cases', () => {
    it('should handle empty params for listBanners', async () => {
      await learningCenterApi.listBanners({})
      expect(api.get).toHaveBeenCalledWith('/learning-center/banners', { params: {} })
    })

    it('should correctly interpolate special characters in ID for updateBanner', async () => {
      const id = 'banner-with-special-chars-!@#'
      const data = { title: 'Test' }
      await learningCenterApi.updateBanner(id, data)
      expect(api.patch).toHaveBeenCalledWith(`/learning-center/banners/${id}`, data)
    })

    it('should handle empty data object for createCourse', async () => {
      await learningCenterApi.createCourse({})
      expect(api.post).toHaveBeenCalledWith('/learning-center/courses', {})
    })

    it('should return the api call promise for chaining', async () => {
      const result = learningCenterApi.listBanners()
      expect(result).toBeInstanceOf(Promise)
      const resolved = await result
      expect(resolved).toBeDefined()
    })
  })
})
