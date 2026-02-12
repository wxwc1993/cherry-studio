import type {
  AdminPresentationQueryInput,
  CreateTemplateInput,
  UpdatePresentationSettingsInput
} from '@cherry-studio/enterprise-shared'

import { api } from './api'

export const presentationsApi = {
  // Admin PPT 列表
  list: (params?: Partial<AdminPresentationQueryInput>) => api.get('/presentations/admin/list', { params }),
  get: (id: string) => api.get(`/presentations/${id}`),

  // 统计
  statistics: (params?: { startDate?: string; endDate?: string; groupBy?: 'day' | 'week' | 'month' }) =>
    api.get('/presentations/admin/statistics', { params }),

  // 模块设置
  getSettings: () => api.get('/presentations/settings'),
  updateSettings: (data: UpdatePresentationSettingsInput) => api.patch('/presentations/settings', data),

  // 模板管理
  listTemplates: (params?: { page?: number; pageSize?: number; search?: string }) =>
    api.get('/presentations/templates', { params }),
  createTemplate: (data: CreateTemplateInput & { file?: FormData }) => {
    if (data.file) {
      const formData = data.file
      formData.append('name', data.name)
      if (data.description) {
        formData.append('description', data.description)
      }
      formData.append('isPublic', String(data.isPublic))
      return api.post('/presentations/templates', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
    }
    return api.post('/presentations/templates', data)
  },
  updateTemplate: (id: string, data: Partial<CreateTemplateInput>) => api.patch(`/presentations/templates/${id}`, data),
  deleteTemplate: (id: string) => api.delete(`/presentations/templates/${id}`)
}
