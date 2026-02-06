import store from '@renderer/store'
import { useAppSelector } from '@renderer/store'
import { selectIsAuthenticated, selectIsEnterpriseMode } from '@renderer/store/enterprise'
import type { Model } from '@renderer/types'
import { useCallback, useMemo } from 'react'

import { enterpriseApi } from './EnterpriseApi'

/**
 * 对话消息格式
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

/**
 * 对话选项
 */
export interface ChatOptions {
  temperature?: number
  maxTokens?: number
  topP?: number
  stream?: boolean
  [key: string]: unknown
}

/**
 * 对话响应
 */
export interface ChatResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * Hook for routing chat requests based on current mode
 * In enterprise mode: uses enterprise API
 * In personal mode: uses local chat logic
 */
export function useChatRouter() {
  const isEnterpriseMode = useAppSelector(selectIsEnterpriseMode)
  const isAuthenticated = useAppSelector(selectIsAuthenticated)

  const isEnterpriseChat = useMemo(() => {
    return isEnterpriseMode && isAuthenticated
  }, [isEnterpriseMode, isAuthenticated])

  /**
   * 发送聊天消息
   * 根据当前模式决定使用企业 API 还是本地 API
   */
  const sendMessage = useCallback(
    async (model: Model, messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> => {
      if (isEnterpriseChat) {
        const response = (await enterpriseApi.chat(model.id, messages, options)) as {
          data: {
            content?: string
            message?: { content?: string }
            usage?: {
              prompt_tokens?: number
              completion_tokens?: number
              total_tokens?: number
            }
          }
        }
        return {
          content: response.data.content || response.data.message?.content || '',
          usage: response.data.usage
            ? {
                promptTokens: response.data.usage.prompt_tokens || 0,
                completionTokens: response.data.usage.completion_tokens || 0,
                totalTokens: response.data.usage.total_tokens || 0
              }
            : undefined
        }
      }

      // 个人模式 - 抛出错误，调用方需要使用本地聊天逻辑
      throw new Error('Personal mode chat should use local chat service')
    },
    [isEnterpriseChat]
  )

  /**
   * 发送流式聊天消息
   */
  const sendStreamMessage = useCallback(
    async (
      model: Model,
      messages: ChatMessage[],
      options?: ChatOptions,
      onChunk?: (chunk: string) => void
    ): Promise<void> => {
      if (isEnterpriseChat) {
        await enterpriseApi.chatStream(model.id, messages, options, onChunk)
        return
      }

      // 个人模式 - 抛出错误
      throw new Error('Personal mode chat should use local chat service')
    },
    [isEnterpriseChat]
  )

  /**
   * 检查是否应该使用企业聊天
   */
  const shouldUseEnterpriseChat = useCallback((): boolean => {
    return isEnterpriseChat
  }, [isEnterpriseChat])

  return {
    sendMessage,
    sendStreamMessage,
    shouldUseEnterpriseChat,
    isEnterpriseMode,
    isAuthenticated
  }
}

/**
 * 非 Hook 版本的聊天路由器，用于非组件上下文
 */
export class ChatRouterService {
  isEnterpriseChat(): boolean {
    const state = store.getState()
    const isEnterpriseMode = state.enterprise?.isEnterpriseMode ?? false
    const isAuthenticated = state.enterprise?.isAuthenticated ?? false
    return isEnterpriseMode && isAuthenticated
  }

  async sendMessage(model: Model, messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    if (!this.isEnterpriseChat()) {
      throw new Error('Not in enterprise mode')
    }

    const response = (await enterpriseApi.chat(model.id, messages, options)) as {
      data: {
        content?: string
        message?: { content?: string }
        usage?: {
          prompt_tokens?: number
          completion_tokens?: number
          total_tokens?: number
        }
      }
    }
    return {
      content: response.data.content || response.data.message?.content || '',
      usage: response.data.usage
        ? {
            promptTokens: response.data.usage.prompt_tokens || 0,
            completionTokens: response.data.usage.completion_tokens || 0,
            totalTokens: response.data.usage.total_tokens || 0
          }
        : undefined
    }
  }

  async sendStreamMessage(
    model: Model,
    messages: ChatMessage[],
    options?: ChatOptions,
    onChunk?: (chunk: string) => void
  ): Promise<void> {
    if (!this.isEnterpriseChat()) {
      throw new Error('Not in enterprise mode')
    }

    await enterpriseApi.chatStream(model.id, messages, options, onChunk)
  }
}

export const chatRouterService = new ChatRouterService()
