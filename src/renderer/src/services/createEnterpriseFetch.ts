/**
 * 企业自定义 Fetch 包装器
 *
 * 将 AI SDK 发出的标准 OpenAI `/chat/completions` 请求重写为
 * 企业服务器的 `/api/v1/models/:modelId/chat` 格式。
 *
 * 同时处理：
 * - URL 重写
 * - 每次请求注入最新的 accessToken（确保 token 刷新后仍有效）
 * - 401 自动刷新 token 并重试
 */
import { loggerService } from '@logger'
import store from '@renderer/store'
import { clearAuth, updateTokens } from '@renderer/store/enterprise'

import { unwrapEnterpriseResponse } from './unwrapEnterpriseResponse'

const logger = loggerService.withContext('EnterpriseFetch')

/**
 * 企业统计元数据，随请求一起发送以支持后台统计
 */
export interface EnterpriseMetadata {
  conversationId?: string
  assistantPresetId?: string
}

/**
 * 将 AI SDK 发送的 OpenAI 兼容格式请求体转换为企业服务器期望的格式
 *
 * 转换规则：
 * - 移除 `model` 字段（服务器从 URL param 获取）
 * - 注入 `modelId`
 * - 将顶层 OpenAI 配置字段收纳为嵌套 `config` 对象
 * - snake_case → camelCase 转换（top_p → topP, max_tokens → maxTokens 等）
 * - messages 和 stream 原样保留
 * - 注入统计元数据（conversationId, assistantPresetId）
 */
export function transformOpenAIBodyToEnterprise(
  body: Record<string, unknown>,
  modelId: string,
  metadata?: EnterpriseMetadata
): Record<string, unknown> {
  const {
    model: _model,
    config: _existingConfig,
    temperature,
    top_p,
    max_tokens,
    frequency_penalty,
    presence_penalty,
    messages,
    stream,
    ...rest
  } = body

  const config: Record<string, unknown> = {}
  if (temperature !== undefined) config.temperature = temperature
  if (top_p !== undefined) config.topP = top_p
  if (max_tokens !== undefined) config.maxTokens = max_tokens
  if (frequency_penalty !== undefined) config.frequencyPenalty = frequency_penalty
  if (presence_penalty !== undefined) config.presencePenalty = presence_penalty

  return {
    ...rest,
    modelId,
    messages,
    stream: stream ?? false,
    ...(Object.keys(config).length > 0 ? { config } : {}),
    ...(metadata?.conversationId ? { conversationId: metadata.conversationId } : {}),
    ...(metadata?.assistantPresetId ? { assistantPresetId: metadata.assistantPresetId } : {})
  }
}

/**
 * 尝试刷新企业 accessToken
 *
 * @returns 是否刷新成功
 */
async function tryRefreshToken(): Promise<boolean> {
  const state = store.getState()
  const refreshToken = state.enterprise?.refreshToken
  const serverUrl = state.enterprise?.enterpriseServer || ''

  if (!refreshToken) {
    return false
  }

  try {
    const response = await fetch(`${serverUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    })

    if (!response.ok) {
      return false
    }

    const data = await response.json()
    store.dispatch(
      updateTokens({
        accessToken: data.data.accessToken,
        refreshToken: data.data.refreshToken
      })
    )
    return true
  } catch (error) {
    logger.error('Failed to refresh enterprise token', { error: error as Error })
    return false
  }
}

/**
 * 创建企业自定义 fetch 包装器
 *
 * @param modelId - 当前使用的模型 ID，用于 URL 重写
 * @param serverUrl - 企业服务器地址
 * @param metadata - 可选的统计元数据（conversationId, assistantPresetId）
 * @returns 自定义的 fetch 函数
 *
 * @remarks
 * URL 重写规则：包含 `/chat/completions` 的请求 → `/api/v1/models/:modelId/chat`
 * 认证：每次请求读取最新的 accessToken，401 时自动刷新并重试
 */
export function createEnterpriseFetch(modelId: string, serverUrl: string, metadata?: EnterpriseMetadata): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const originalUrl = typeof input === 'string' ? input : input.toString()
    const isChatCompletions = originalUrl.includes('/chat/completions')

    // URL 重写：/chat/completions → /models/:modelId/chat
    const url = isChatCompletions ? `${serverUrl}/api/v1/models/${encodeURIComponent(modelId)}/chat` : originalUrl

    // Body 转换（仅对 chat/completions 请求）
    let finalInit = init
    if (isChatCompletions && init?.body) {
      try {
        const parsed = JSON.parse(init.body as string) as Record<string, unknown>
        const transformed = transformOpenAIBodyToEnterprise(parsed, modelId, metadata)
        finalInit = { ...init, body: JSON.stringify(transformed) }
      } catch (error) {
        logger.error('Failed to transform enterprise request body', { error: error as Error })
      }
    }

    // 注入最新的 accessToken（确保 token 刷新后仍有效）
    const state = store.getState()
    const accessToken = state.enterprise?.accessToken || ''
    const headers = new Headers(finalInit?.headers)
    headers.set('Authorization', `Bearer ${accessToken}`)
    headers.set('Content-Type', 'application/json')

    const response = await fetch(url, { ...finalInit, headers })

    // 401 自动刷新 token 并重试
    if (response.status === 401) {
      logger.info('Enterprise fetch got 401, attempting token refresh')
      const refreshed = await tryRefreshToken()
      if (refreshed) {
        const newState = store.getState()
        const newToken = newState.enterprise?.accessToken || ''
        headers.set('Authorization', `Bearer ${newToken}`)
        const retryResponse = await fetch(url, { ...finalInit, headers })
        return isChatCompletions ? unwrapEnterpriseResponse(retryResponse) : retryResponse
      }
      store.dispatch(clearAuth())
      throw new Error('Authentication expired')
    }

    return isChatCompletions ? unwrapEnterpriseResponse(response) : response
  }
}
