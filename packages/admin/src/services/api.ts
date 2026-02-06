import { API_PREFIX } from '@cherry-studio/enterprise-shared'
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

import { useAuthStore } from '../store/auth'

// Token 刷新队列管理 - 防止并发刷新竞态问题
let isRefreshing = false
let refreshSubscribers: ((token: string) => void)[] = []

function subscribeTokenRefresh(callback: (token: string) => void) {
  refreshSubscribers.push(callback)
}

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((callback) => callback(token))
  refreshSubscribers = []
}

export const api = axios.create({
  baseURL: API_PREFIX,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器：添加 token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const { accessToken } = useAuthStore.getState()
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

// 响应拦截器：处理 token 过期（带刷新队列防止并发竞态）
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // 如果是 401 错误且未重试过
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // 已经在刷新中，等待刷新完成后重试
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            resolve(api(originalRequest))
          })
          // 设置超时，避免无限等待
          setTimeout(() => {
            reject(error)
          }, 10000)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const refreshed = await useAuthStore.getState().refreshTokens()
        if (refreshed) {
          const { accessToken } = useAuthStore.getState()
          onTokenRefreshed(accessToken!)
          originalRequest.headers.Authorization = `Bearer ${accessToken}`
          return api(originalRequest)
        } else {
          // 刷新失败，清空所有等待的请求
          refreshSubscribers = []
          return Promise.reject(error)
        }
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

// API 函数封装
export const authApi = {
  feishuLogin: (code: string) => api.post('/auth/feishu/login', { code }),
  devLogin: (username: string, password: string) => api.post('/auth/dev/login', { username, password }),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me')
}

export const usersApi = {
  list: (params?: any) => api.get('/users', { params }),
  options: () => api.get('/users/options'),
  get: (id: string) => api.get(`/users/${id}`),
  create: (data: any) => api.post('/users', data),
  update: (id: string, data: any) => api.patch(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`)
}

export const departmentsApi = {
  list: () => api.get('/departments'),
  tree: () => api.get('/departments/tree'),
  get: (id: string) => api.get(`/departments/${id}`),
  getUsers: (id: string) => api.get(`/departments/${id}/users`),
  create: (data: any) => api.post('/departments', data),
  update: (id: string, data: any) => api.patch(`/departments/${id}`, data),
  delete: (id: string) => api.delete(`/departments/${id}`)
}

export const rolesApi = {
  list: () => api.get('/roles'),
  get: (id: string) => api.get(`/roles/${id}`),
  create: (data: any) => api.post('/roles', data),
  update: (id: string, data: any) => api.patch(`/roles/${id}`, data),
  delete: (id: string) => api.delete(`/roles/${id}`)
}

export const modelsApi = {
  list: (params?: any) => api.get('/models', { params }),
  get: (id: string) => api.get(`/models/${id}`),
  create: (data: any) => api.post('/models', data),
  update: (id: string, data: any) => api.patch(`/models/${id}`, data),
  delete: (id: string) => api.delete(`/models/${id}`),
  getUsage: (id: string) => api.get(`/models/${id}/usage`),
  updatePermissions: (id: string, data: any) => api.patch(`/models/${id}/permissions`, data)
}

export const knowledgeBasesApi = {
  list: (params?: any) => api.get('/knowledge-bases', { params }),
  get: (id: string) => api.get(`/knowledge-bases/${id}`),
  create: (data: any) => api.post('/knowledge-bases', data),
  update: (id: string, data: any) => api.patch(`/knowledge-bases/${id}`, data),
  delete: (id: string) => api.delete(`/knowledge-bases/${id}`),
  getDocuments: (id: string, params?: any) => api.get(`/knowledge-bases/${id}/documents`, { params }),
  uploadDocument: (id: string, formData: FormData) =>
    api.post(`/knowledge-bases/${id}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  deleteDocument: (kbId: string, docId: string) => api.delete(`/knowledge-bases/${kbId}/documents/${docId}`),
  updatePermissions: (id: string, data: any) => api.patch(`/knowledge-bases/${id}/permissions`, data)
}

export const statisticsApi = {
  overview: () => api.get('/statistics/overview'),
  usage: (params: any) => api.get('/statistics/usage', { params }),
  byModel: (params: any) => api.get('/statistics/models', { params }),
  byUser: (params: any) => api.get('/statistics/users', { params }),
  export: (params: any) => api.get('/statistics/export', { params, responseType: 'blob' })
}

export const adminApi = {
  health: () => api.get('/admin/health'),
  getSettings: () => api.get('/admin/settings'),
  updateSettings: (data: any) => api.patch('/admin/settings', data),
  listBackups: () => api.get('/admin/backups'),
  createBackup: (data: any) => api.post('/admin/backup', data),
  restore: (data: any) => api.post('/admin/restore', data),
  deleteBackup: (id: string) => api.delete(`/admin/backups/${id}`),
  downloadBackup: (id: string) => api.get(`/admin/backups/${id}/download`, { responseType: 'blob' }),
  uploadBackup: (formData: FormData) =>
    api.post('/admin/backups/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  cleanupBackups: () => api.post('/admin/cleanup-backups')
}
