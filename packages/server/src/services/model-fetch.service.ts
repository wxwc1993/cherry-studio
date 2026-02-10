/**
 * 远程模型获取服务
 *
 * 通过 OpenAI 兼容的 GET /v1/models 接口远程获取供应商模型列表，
 * 自动检测模型能力（vision、reasoning、function_calling 等），
 * 并过滤不支持的非聊天模型（tts、whisper、speech 等）。
 */

import { buildModelsListUrl, getProviderDefaultEndpoint, type RemoteModel } from '@cherry-studio/enterprise-shared'
import type { SimpleModel } from '@shared/models'
import { detectCapabilities, isNotSupportedModel } from '@shared/models'

import { createLogger } from '../utils/logger'

const logger = createLogger('ModelFetchService')

/** 请求超时时间（毫秒） */
const FETCH_TIMEOUT_MS = 15_000

/** 最大返回模型数 */
const MAX_MODELS = 500

/**
 * OpenAI 兼容的模型列表响应结构
 */
interface OpenAIModelsResponse {
  readonly data: ReadonlyArray<{
    readonly id: string
    readonly object?: string
    readonly created?: number
    readonly owned_by?: string
  }>
}

/**
 * 远程获取模型列表的参数
 */
interface FetchRemoteModelsParams {
  readonly providerId: string
  readonly apiKey: string
  readonly apiEndpoint?: string
}

/**
 * 批量获取结果
 */
interface FetchRemoteModelsResult {
  readonly models: ReadonlyArray<RemoteModel>
  readonly total: number
}

/**
 * 解析端点地址
 *
 * 优先使用传入的端点，否则使用默认端点。
 */
function resolveEndpoint(providerId: string, apiEndpoint?: string): string {
  if (apiEndpoint && apiEndpoint.trim() !== '') {
    return apiEndpoint.trim()
  }
  return getProviderDefaultEndpoint(providerId)
}

/**
 * 将远程模型 ID 转换为 SimpleModel 用于能力检测
 */
function toSimpleModel(modelId: string, providerId: string): SimpleModel {
  return {
    id: modelId,
    name: modelId,
    provider: providerId
  } as const
}

/**
 * 远程获取供应商模型列表
 *
 * 调用供应商的 OpenAI 兼容 GET /v1/models 接口，
 * 自动检测每个模型的能力，过滤不支持的非聊天模型。
 *
 * @param params 请求参数（providerId、apiKey、apiEndpoint）
 * @param existingModelNames 已存在的模型名称集合（用于标记 isAdded）
 * @returns 模型列表及总数
 */
export async function fetchRemoteModels(
  params: FetchRemoteModelsParams,
  existingModelNames: ReadonlySet<string>
): Promise<FetchRemoteModelsResult> {
  const { providerId, apiKey } = params
  const endpoint = resolveEndpoint(providerId, params.apiEndpoint)

  if (!endpoint) {
    logger.warn({ providerId }, 'No endpoint configured for provider, cannot fetch models')
    return { models: [], total: 0 }
  }

  const modelsUrl = buildModelsListUrl(endpoint)

  if (!modelsUrl) {
    logger.warn({ providerId, endpoint }, 'Failed to build models list URL')
    return { models: [], total: 0 }
  }

  logger.info({ providerId, modelsUrl }, 'Fetching remote models')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(modelsUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      logger.error({ providerId, status: response.status, errorText }, 'Failed to fetch remote models')
      throw new Error(`Failed to fetch models from ${providerId}: ${response.status} ${errorText}`)
    }

    const data = (await response.json()) as OpenAIModelsResponse

    if (!data.data || !Array.isArray(data.data)) {
      logger.warn({ providerId }, 'Invalid response format: missing data array')
      return { models: [], total: 0 }
    }

    const remoteModels: RemoteModel[] = data.data
      .filter((item) => item.id && !isNotSupportedModel(item.id))
      .slice(0, MAX_MODELS)
      .map((item) => {
        const simpleModel = toSimpleModel(item.id, providerId)
        const capabilities = detectCapabilities(simpleModel)

        return {
          id: item.id,
          name: item.id,
          capabilities,
          isAdded: existingModelNames.has(item.id)
        }
      })

    logger.info(
      { providerId, totalFetched: data.data.length, afterFilter: remoteModels.length },
      'Remote models fetched successfully'
    )

    return {
      models: remoteModels,
      total: remoteModels.length
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error({ providerId, timeoutMs: FETCH_TIMEOUT_MS }, 'Fetch remote models timed out')
      throw new Error(`Fetch models from ${providerId} timed out after ${FETCH_TIMEOUT_MS}ms`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}
