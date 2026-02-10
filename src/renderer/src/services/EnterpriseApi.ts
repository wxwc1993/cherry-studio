import { loggerService } from '@logger'
import store from '@renderer/store'
import { clearAuth, updateTokens } from '@renderer/store/enterprise'

const API_PREFIX = '/api/v1'
const logger = loggerService.withContext('EnterpriseApi')

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

  async feishuPoll(sessionId: string) {
    return this.request<{
      status: 'pending' | 'success' | 'error'
      user?: unknown
      accessToken?: string
      refreshToken?: string
      error?: string
    }>('GET', `/auth/feishu/poll?session_id=${encodeURIComponent(sessionId)}`)
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
      modelId,
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
    const startTime = Date.now()
    const endpoint = `/models/${modelId}/chat`
    const response = await fetch(`${this.getBaseUrl()}${API_PREFIX}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        modelId,
        messages,
        stream: true,
        ...options
      })
    })

    if (response.status === 401) {
      const refreshed = await this.refreshTokens()
      if (!refreshed) {
        store.dispatch(clearAuth())
        this.logRequest('POST', endpoint, false, 401, Date.now() - startTime, 'Authentication expired')
        throw new Error('Authentication expired')
      }
      this.logRequest('POST', endpoint, false, 401, Date.now() - startTime, 'Token refreshed, please retry')
      throw new Error('Token refreshed, please retry')
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      this.logRequest('POST', endpoint, false, response.status, Date.now() - startTime, errorText)
      throw new Error(`Enterprise chat request failed: ${response.status} ${errorText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      this.logRequest('POST', endpoint, false, response.status, Date.now() - startTime, 'No response body')
      throw new Error('No response body')
    }

    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        if (onChunk) {
          onChunk(chunk)
        }
      }
      this.logRequest('POST', endpoint, true, response.status, Date.now() - startTime)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logRequest('POST', endpoint, false, response.status, Date.now() - startTime, errorMessage)
      throw error
    }
  }

  /**
   * 流式对话（带 SSE 解析），将原始 SSE 流解析为文本内容回调
   * 服务端使用 OpenAI 兼容 SSE 格式：data: {"choices":[{"delta":{"content":"..."}}]}
   */
  async chatStreamParsed(
    modelId: string,
    messages: unknown[],
    options?: Record<string, unknown>,
    callbacks?: {
      onTextContent?: (text: string) => void
      onThinkingContent?: (text: string) => void
      onUsage?: (usage: { promptTokens: number; completionTokens: number; totalTokens: number }) => void
    }
  ): Promise<void> {
    let sseBuffer = ''

    await this.chatStream(modelId, messages, options, (rawChunk: string) => {
      sseBuffer += rawChunk
      const lines = sseBuffer.split('\n')
      // 保留最后一个可能不完整的行
      sseBuffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) {
          continue
        }

        const dataStr = trimmed.slice(6)
        if (dataStr === '[DONE]') {
          continue
        }

        try {
          const data = JSON.parse(dataStr)
          const delta = data.choices?.[0]?.delta

          if (delta?.content) {
            callbacks?.onTextContent?.(delta.content)
          }

          // 部分模型支持 reasoning_content 字段
          if (delta?.reasoning_content) {
            callbacks?.onThinkingContent?.(delta.reasoning_content)
          }

          if (data.usage) {
            callbacks?.onUsage?.({
              promptTokens: data.usage.prompt_tokens || 0,
              completionTokens: data.usage.completion_tokens || 0,
              totalTokens: data.usage.total_tokens || 0
            })
          }
        } catch {
          logger.debug('Failed to parse SSE chunk', { dataStr })
        }
      }
    })

    // 处理缓冲区中可能残留的最后一行
    if (sseBuffer.trim()) {
      const trimmed = sseBuffer.trim()
      if (trimmed.startsWith('data: ') && trimmed.slice(6) !== '[DONE]') {
        try {
          const data = JSON.parse(trimmed.slice(6))
          const delta = data.choices?.[0]?.delta
          if (delta?.content) {
            callbacks?.onTextContent?.(delta.content)
          }
          if (delta?.reasoning_content) {
            callbacks?.onThinkingContent?.(delta.reasoning_content)
          }
        } catch {
          logger.debug('Failed to parse final SSE buffer', { sseBuffer })
        }
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

  // 客户端设置
  async getClientSettings() {
    return this.request<{
      defaultModels: {
        defaultAssistantModel: {
          id: string
          name: string
          provider: string
          providerId: string
          displayName: string
          description?: string
          capabilities: string[]
          enabled: boolean
        } | null
        quickModel: {
          id: string
          name: string
          provider: string
          providerId: string
          displayName: string
          description?: string
          capabilities: string[]
          enabled: boolean
        } | null
        translateModel: {
          id: string
          name: string
          provider: string
          providerId: string
          displayName: string
          description?: string
          capabilities: string[]
          enabled: boolean
        } | null
      }
    }>('GET', '/settings/client')
  }

  // 提示词助手预设
  async getAssistantPresets(locale?: string) {
    const params = locale ? `?locale=${locale}` : ''
    return this.request<{
      tags: Array<{
        id: string
        name: string
        locale: string
        order: number
      }>
      presets: Array<{
        id: string
        name: string
        emoji?: string
        description?: string
        prompt: string
        locale: string
        isEnabled: boolean
        order: number
        usageCount: number
        hotScore: number
        tags?: Array<{
          id: string
          name: string
          locale: string
          order: number
        }>
      }>
    }>('GET', `/assistant-presets/client${params}`)
  }
}

export const enterpriseApi = new EnterpriseApiService()
