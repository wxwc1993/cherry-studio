import { ENTERPRISE_PROVIDER_IDS, isEnterpriseProviderId } from '@cherry-studio/enterprise-shared'
import type { Model, ModelCapability, ModelPricing, ModelType, Provider } from '@renderer/types'
import { isSystemProviderId } from '@renderer/types'

/**
 * 企业 API 返回的模型格式
 */
export interface EnterpriseApiModel {
  id: string
  name: string
  provider?: string // 新格式
  providerId?: string // 兼容旧格式
  displayName?: string
  description?: string
  capabilities?: string[]
  group?: string
  pricing?: {
    input_per_million_tokens?: number
    output_per_million_tokens?: number
    currencySymbol?: string
  }
  maxTokens?: number
  contextLength?: number
  enabled?: boolean
}

/**
 * 将企业 API 的 capabilities 转换为客户端格式
 * 注意：free 标签不会作为 ModelCapability，由 isEnterpriseModelFree 单独处理
 */
function mapCapabilities(capabilities?: string[]): ModelCapability[] | undefined {
  if (!capabilities || capabilities.length === 0) return undefined

  const typeMap: Record<string, ModelType> = {
    text: 'text',
    chat: 'text',
    completion: 'text',
    embedding: 'embedding',
    vision: 'vision',
    function_calling: 'function_calling',
    tool_use: 'function_calling',
    reasoning: 'reasoning',
    web_search: 'web_search',
    rerank: 'rerank'
  }

  const result: ModelCapability[] = []
  const addedTypes = new Set<ModelType>()

  for (const cap of capabilities) {
    const lowerCap = cap.toLowerCase()

    // 跳过 free 标签（由 isEnterpriseModelFree 函数单独处理）
    if (lowerCap === 'free') {
      continue
    }

    const modelType = typeMap[lowerCap]
    if (modelType && !addedTypes.has(modelType)) {
      addedTypes.add(modelType)
      result.push({ type: modelType, isUserSelected: true })
    }
  }

  return result.length > 0 ? result : undefined
}

/**
 * 检查企业模型是否为免费模型
 */
export function isEnterpriseModelFree(enterpriseModel: EnterpriseApiModel): boolean {
  return enterpriseModel.capabilities?.some((cap) => cap.toLowerCase() === 'free') ?? false
}

/**
 * 将企业 API 返回的模型转换为客户端本地模型格式
 */
export function adaptEnterpriseModel(enterpriseModel: EnterpriseApiModel): Model {
  // 优先使用 provider，回退到 providerId
  const provider = enterpriseModel.provider || enterpriseModel.providerId || 'unknown'

  const pricing: ModelPricing | undefined = enterpriseModel.pricing
    ? {
        input_per_million_tokens: enterpriseModel.pricing.input_per_million_tokens ?? 0,
        output_per_million_tokens: enterpriseModel.pricing.output_per_million_tokens ?? 0,
        currencySymbol: enterpriseModel.pricing.currencySymbol
      }
    : undefined

  return {
    id: enterpriseModel.id,
    provider,
    name: enterpriseModel.displayName || enterpriseModel.name,
    group: enterpriseModel.group || provider,
    description: enterpriseModel.description,
    capabilities: mapCapabilities(enterpriseModel.capabilities),
    pricing
  }
}

/**
 * 批量转换企业模型
 */
export function adaptEnterpriseModels(enterpriseModels: EnterpriseApiModel[]): Model[] {
  return enterpriseModels.filter((m) => m.enabled !== false).map(adaptEnterpriseModel)
}

/**
 * 创建企业版的虚拟 Provider
 */
export function createEnterpriseProvider(serverUrl: string) {
  return {
    id: 'enterprise',
    name: 'Enterprise',
    type: 'enterprise',
    apiKey: '', // 由 token 处理
    apiHost: serverUrl,
    isEnabled: true,
    models: []
  }
}

/**
 * 匹配企业 provider 名称到系统 provider ID（用于图标显示）
 *
 * 现在 Admin 端直接使用与客户端 SystemProviderId 一致的 ID，
 * 所以大部分情况下可以直接使用，无需复杂的映射逻辑。
 */
export function matchProviderNameToSystemId(name: string): string | undefined {
  const normalized = name.toLowerCase().trim()

  // 直接匹配：Admin 现在使用与客户端一致的 ID
  if (isEnterpriseProviderId(normalized)) {
    return ENTERPRISE_PROVIDER_IDS[normalized]
  }

  // 兼容旧版 Admin 数据的映射
  const legacyMappings: Record<string, string> = {
    // 旧版 Admin 使用的 ID -> 标准 SystemProviderId
    azure: 'azure-openai',
    google: 'gemini',
    qwen: 'dashscope',
    wenxin: 'baidu-cloud',
    claude: 'anthropic'
  }

  if (legacyMappings[normalized]) {
    return legacyMappings[normalized]
  }

  return undefined
}

/**
 * 将企业 models 按 provider 分组生成 Provider 对象数组
 */
export function groupModelsToProviders(models: Model[]): Provider[] {
  // 按 provider 分组
  const grouped = new Map<string, Model[]>()

  for (const model of models) {
    const provider = model.provider || 'unknown'
    if (!grouped.has(provider)) {
      grouped.set(provider, [])
    }
    grouped.get(provider)!.push(model)
  }

  // 转换为 Provider 对象
  return Array.from(grouped.entries()).map(([providerName, providerModels]) => {
    const systemId = matchProviderNameToSystemId(providerName)
    const providerId = systemId || `enterprise-${providerName.toLowerCase().replace(/\s+/g, '-')}`

    return {
      id: providerId,
      type: 'openai' as const, // 默认类型
      name: providerName,
      apiKey: '', // 由企业服务器管理
      apiHost: '', // 由企业服务器管理
      models: providerModels,
      enabled: true,
      isSystem: isSystemProviderId(providerId)
    }
  })
}
