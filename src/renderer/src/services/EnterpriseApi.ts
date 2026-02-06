import store from '@renderer/store'
import { clearAuth, updateTokens } from '@renderer/store/enterprise'

const API_PREFIX = '/api/v1'

interface ApiResponse<T> {
  success: boolean
  data: T
  error?: {
    code: string
    message: string
  }
}

export interface ApiLogEntry {
  timestamp: string
  method: string
  endpoint: string
  success: boolean
  statusCode?: number
  duration?: number
  error?: string
}

class EnterpriseApiService {
  private logStore: ApiLogEntry[] = []
  private readonly maxLogs = 50

  private logRequest(
    method: string,
    endpoint: string,
    success: boolean,
    statusCode?: number,
    duration?: number,
    error?: string
  ): void {
    const entry: ApiLogEntry = {
      timestamp: new Date().toISOString(),
      method,
      endpoint,
      success,
      statusCode,
      duration,
      error
    }
    this.logStore = [entry, ...this.logStore].slice(0, this.maxLogs)
  }

  getLogs(): ApiLogEntry[] {
    return this.logStore
  }

  clearLogs(): void {
    this.logStore = []
  }

  private getBaseUrl(): string {
    const state = store.getState()
    return state.enterprise?.enterpriseServer || ''
  }

  private getAccessToken(): string | null {
    const state = store.getState()
    return state.enterprise?.accessToken || null
  }

  private getRefreshToken(): string | null {
    const state = store.getState()
    return state.enterprise?.refreshToken || null
  }

  private getHeaders(): Record<string, string> {
    const accessToken = this.getAccessToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }
    return headers
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    if (response.status === 401) {
      // 尝试刷新 token
      const refreshed = await this.refreshTokens()
      if (!refreshed) {
        store.dispatch(clearAuth())
        throw new Error('Authentication expired')
      }
      throw new Error('Token refreshed, please retry')
    }

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error?.message || 'API request failed')
    }
    return data
  }

  private async refreshTokens(): Promise<boolean> {
    const refreshToken = this.getRefreshToken()
    if (!refreshToken) return false

    try {
      const response = await fetch(`${this.getBaseUrl()}${API_PREFIX}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      })

      if (!response.ok) return false

      const data = await response.json()
      store.dispatch(
        updateTokens({
          accessToken: data.data.accessToken,
          refreshToken: data.data.refreshToken
        })
      )
      return true
    } catch {
      return false
    }
  }

  private async request<T>(method: string, endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    const startTime = Date.now()
    let response: Response | undefined

    try {
      response = await fetch(`${this.getBaseUrl()}${API_PREFIX}${endpoint}`, {
        method,
        headers: this.getHeaders(),
        body: body ? JSON.stringify(body) : undefined
      })

      const result = await this.handleResponse<T>(response)
      this.logRequest(method, endpoint, true, response.status, Date.now() - startTime)
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logRequest(method, endpoint, false, response?.status, Date.now() - startTime, errorMessage)
      throw error
    }
  }

  // 认证
  async feishuLogin(code: string) {
    return this.request<{
      user: unknown
      accessToken: string
      refreshToken: string
    }>('POST', '/auth/feishu/login', { code })
  }

  async devLogin(username: string, password: string) {
    return this.request<{
      user: unknown
      accessToken: string
      refreshToken: string
    }>('POST', '/auth/dev/login', { username, password })
  }

  async logout() {
    return this.request<void>('POST', '/auth/logout')
  }

  async getMe() {
    return this.request<unknown>('GET', '/auth/me')
  }

  // 模型
  async getModels() {
    return this.request<unknown[]>('GET', '/models')
  }

  async chat(modelId: string, messages: unknown[], options?: Record<string, unknown>) {
    return this.request<unknown>('POST', `/models/${modelId}/chat`, {
      messages,
      stream: false,
      ...options
    })
  }

  async chatStream(
    modelId: string,
    messages: unknown[],
    options?: Record<string, unknown>,
    onChunk?: (chunk: string) => void
  ): Promise<void> {
    const response = await fetch(`${this.getBaseUrl()}${API_PREFIX}/models/${modelId}/chat`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        messages,
        stream: true,
        ...options
      })
    })

    if (!response.ok) {
      throw new Error('Chat request failed')
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      if (onChunk) {
        onChunk(chunk)
      }
    }
  }

  // 知识库
  async getKnowledgeBases() {
    return this.request<unknown[]>('GET', '/knowledge-bases')
  }

  async searchKnowledgeBase(kbId: string, query: string, topK = 10) {
    return this.request<unknown[]>('POST', `/knowledge-bases/${kbId}/search`, {
      query,
      topK
    })
  }

  // 对话历史
  async getConversations(page = 1, pageSize = 20) {
    return this.request<unknown[]>('GET', `/conversations?page=${page}&pageSize=${pageSize}`)
  }

  async getConversation(id: string) {
    return this.request<unknown>('GET', `/conversations/${id}`)
  }

  async createConversation(title: string, modelId: string) {
    return this.request<unknown>('POST', '/conversations', { title, modelId })
  }

  async deleteConversation(id: string) {
    return this.request<void>('DELETE', `/conversations/${id}`)
  }

  // 用量统计
  async getUsageStats() {
    return this.request<unknown>('GET', '/statistics/overview')
  }
}

export const enterpriseApi = new EnterpriseApiService()
