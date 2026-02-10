/**
 * 企业 Provider 工厂
 *
 * 根据企业 Model 构建一个完整的 Provider 对象，
 * 使其能被 AI Core 管线（ModernAiProvider）正常处理。
 *
 * 核心思路：企业服务器是 OpenAI 兼容代理，可将其当作 openai-compatible Provider 接入。
 * - apiHost 使用 `#` 尾缀阻止 `formatProviderApiHost` 追加 `/v1`
 * - type: 'openai' 确保走 openai-compatible fallback
 * - apiKey 使用企业 accessToken（Bearer token）
 */
import { loggerService } from '@logger'
import store from '@renderer/store'
import type { Model, Provider } from '@renderer/types'

const logger = loggerService.withContext('EnterpriseProviderFactory')

/**
 * 构建企业 Provider 对象
 *
 * @param model - 企业模式下选择的模型
 * @returns 一个可被 AI Core 管线处理的 Provider 对象
 *
 * @remarks
 * - `apiHost` 设为 `${serverUrl}/api/v1/chat/completions#`，经 `routeToEndpoint()` 解析后
 *   → baseURL = `${serverUrl}/api/v1`, endpoint = `chat/completions`
 * - `type: 'openai'` 确保在 `getAiSdkProviderId()` 中跳过 type 解析，最终走 `openai-compatible` fallback
 * - `apiKey` 使用 accessToken，由 AI SDK 传入 `Authorization: Bearer` 头
 * - 实际 URL 重写由 `createEnterpriseFetch` 完成（注入于 `prepareSpecialProviderConfig`）
 */
export function buildEnterpriseProvider(model: Model): Provider {
  const state = store.getState()
  const serverUrl = state.enterprise?.enterpriseServer || ''
  const accessToken = state.enterprise?.accessToken || ''

  // 使用 # 尾缀防止 formatProviderApiHost 追加 /v1
  // AI SDK 会发送到 baseURL + /chat/completions，
  // 由自定义 fetch 在 prepareSpecialProviderConfig 中重写 URL
  const apiHost = `${serverUrl}/api/v1/chat/completions#`

  const providerId = `enterprise-${model.provider || 'default'}`

  logger.info('Building enterprise provider', {
    providerId,
    modelId: model.id,
    serverUrl,
    apiHost
  })

  return {
    id: providerId,
    type: 'openai' as const,
    name: model.provider || 'Enterprise',
    apiKey: accessToken,
    apiHost,
    models: [model],
    enabled: true,
    isSystem: false
  }
}
