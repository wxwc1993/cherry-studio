import { api } from './api'

export const learningCenterApi = {
  // Banner
  listBanners: (params?: Record<string, unknown>) => api.get('/learning-center/banners', { params }),
  createBanner: (data: Record<string, unknown>) => api.post('/learning-center/banners', data),
  updateBanner: (id: string, data: Record<string, unknown>) => api.patch(`/learning-center/banners/${id}`, data),
  deleteBanner: (id: string) => api.delete(`/learning-center/banners/${id}`),

  // 课程分类
  listCourseCategories: () => api.get('/learning-center/course-categories'),
  createCourseCategory: (data: Record<string, unknown>) => api.post('/learning-center/course-categories', data),
  updateCourseCategory: (id: string, data: Record<string, unknown>) =>
    api.patch(`/learning-center/course-categories/${id}`, data),
  deleteCourseCategory: (id: string) => api.delete(`/learning-center/course-categories/${id}`),

  // 课程
  listCourses: (params?: Record<string, unknown>) => api.get('/learning-center/courses', { params }),
  createCourse: (data: Record<string, unknown>) => api.post('/learning-center/courses', data),
  updateCourse: (id: string, data: Record<string, unknown>) => api.patch(`/learning-center/courses/${id}`, data),
  deleteCourse: (id: string) => api.delete(`/learning-center/courses/${id}`),

  // 文档分类
  listDocumentCategories: () => api.get('/learning-center/document-categories'),
  createDocumentCategory: (data: Record<string, unknown>) => api.post('/learning-center/document-categories', data),
  updateDocumentCategory: (id: string, data: Record<string, unknown>) =>
    api.patch(`/learning-center/document-categories/${id}`, data),
  deleteDocumentCategory: (id: string) => api.delete(`/learning-center/document-categories/${id}`),

  // 文档
  listDocuments: (params?: Record<string, unknown>) => api.get('/learning-center/documents', { params }),
  createDocument: (data: Record<string, unknown>) => api.post('/learning-center/documents', data),
  updateDocument: (id: string, data: Record<string, unknown>) => api.patch(`/learning-center/documents/${id}`, data),
  deleteDocument: (id: string) => api.delete(`/learning-center/documents/${id}`),

  // 热搜
  listHotItems: (params?: Record<string, unknown>) => api.get('/learning-center/hot-items', { params }),
  createHotItem: (data: Record<string, unknown>) => api.post('/learning-center/hot-items', data),
  updateHotItem: (id: string, data: Record<string, unknown>) => api.patch(`/learning-center/hot-items/${id}`, data),
  deleteHotItem: (id: string) => api.delete(`/learning-center/hot-items/${id}`)
}
