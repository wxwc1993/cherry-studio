/**
 * 模型能力检测纯函数（无 Redux、无 renderer 依赖）
 *
 * 从客户端 src/renderer/src/config/models/ 下提取的核心检测逻辑。
 * 适用于服务端（Admin/Server）自动检测模型能力。
 *
 * 设计要点：
 * - 所有函数为纯函数，仅依赖入参
 * - 跳过 isUserSelectedModelType（服务端不需要用户覆盖机制）
 * - detectWebSearch 从依赖 provider.type 改为依赖 providerId 字符串匹配
 */

import { getLowerBaseModelName } from './naming'

/**
 * 简化的模型接口，仅用于能力检测
 */
export interface SimpleModel {
  /** 模型 ID（如 'openai/gpt-4o'） */
  readonly id: string
  /** 模型显示名称（如 'GPT-4o'） */
  readonly name: string
  /** 供应商 ID（如 'openai'、'anthropic'） */
  readonly provider: string
}

// ============ 正则常量 ============

/** 嵌入模型正则 */
export const EMBEDDING_REGEX =
  /(?:^text-|embed|bge-|e5-|LLM2Vec|retrieval|uae-|gte-|jina-clip|jina-embeddings|voyage-)/i

/** 重排模型正则 */
export const RERANKING_REGEX = /(?:rerank|re-rank|re-ranker|re-ranking|retrieval|retriever)/i

/** 推理模型正则 */
export const REASONING_REGEX =
  /^(?!.*-non-reasoning\b)(o\d+(?:-[\w-]+)?|.*\b(?:reasoning|reasoner|thinking|think)\b.*|.*-[rR]\d+.*|.*\bqwq(?:-[\w-]+)?\b.*|.*\bhunyuan-t1(?:-[\w-]+)?\b.*|.*\bglm-zero-preview\b.*|.*\bgrok-(?:3-mini|4|4-fast)(?:-[\w-]+)?\b.*)$/i

/** 视觉模型允许列表 */
const visionAllowedModels = [
  'llava',
  'moondream',
  'minicpm',
  'gemini-1\\.5',
  'gemini-2\\.0',
  'gemini-2\\.5',
  'gemini-3-(?:flash|pro)(?:-preview)?',
  'gemini-(flash|pro|flash-lite)-latest',
  'gemini-exp',
  'claude-3',
  'claude-haiku-4',
  'claude-sonnet-4',
  'claude-opus-4',
  'vision',
  'glm-4(?:\\.\\d+)?v(?:-[\\w-]+)?',
  'qwen-vl',
  'qwen2-vl',
  'qwen2.5-vl',
  'qwen3-vl',
  'qwen2.5-omni',
  'qwen3-omni(?:-[\\w-]+)?',
  'qvq',
  'internvl2',
  'grok-vision-beta',
  'grok-4(?:-[\\w-]+)?',
  'pixtral',
  'gpt-4(?:-[\\w-]+)',
  'gpt-4.1(?:-[\\w-]+)?',
  'gpt-4o(?:-[\\w-]+)?',
  'gpt-4.5(?:-[\\w-]+)',
  'gpt-5(?:-[\\w-]+)?',
  'chatgpt-4o(?:-[\\w-]+)?',
  'o1(?:-[\\w-]+)?',
  'o3(?:-[\\w-]+)?',
  'o4(?:-[\\w-]+)?',
  'deepseek-vl(?:[\\w-]+)?',
  'kimi-k2.5',
  'kimi-latest',
  'gemma-3(?:-[\\w-]+)',
  'doubao-seed-1[.-][68](?:-[\\w-]+)?',
  'doubao-seed-code(?:-[\\w-]+)?',
  'kimi-thinking-preview',
  'gemma3(?:[-:\\w]+)?',
  'kimi-vl-a3b-thinking(?:-[\\w-]+)?',
  'llama-guard-4(?:-[\\w-]+)?',
  'llama-4(?:-[\\w-]+)?',
  'step-1o(?:.*vision)?',
  'step-1v(?:-[\\w-]+)?',
  'qwen-omni(?:-[\\w-]+)?',
  'mistral-large-(2512|latest)',
  'mistral-medium-(2508|latest)',
  'mistral-small-(2506|latest)'
]

/** 视觉模型排除列表 */
const visionExcludedModels = [
  'gpt-4-\\d+-preview',
  'gpt-4-turbo-preview',
  'gpt-4-32k',
  'gpt-4-\\d+',
  'o1-mini',
  'o3-mini',
  'o1-preview',
  'AIDC-AI/Marco-o1'
]

/** 视觉模型正则 */
export const VISION_REGEX = new RegExp(
  `\\b(?!(?:${visionExcludedModels.join('|')})\\b)(${visionAllowedModels.join('|')})\\b`,
  'i'
)

/** 图像增强模型 */
const IMAGE_ENHANCEMENT_MODELS = [
  'grok-2-image(?:-[\\w-]+)?',
  'qwen-image-edit',
  'gpt-image-1',
  'gemini-2.5-flash-image(?:-[\\w-]+)?',
  'gemini-2.0-flash-preview-image-generation',
  'gemini-3(?:\\.\\d+)?-pro-image(?:-[\\w-]+)?'
]

const IMAGE_ENHANCEMENT_MODELS_REGEX = new RegExp(IMAGE_ENHANCEMENT_MODELS.join('|'), 'i')

/** 专用图像生成模型（仅生成图像，无文本聊天能力） */
const DEDICATED_IMAGE_MODELS = [
  'dall-e(?:-[\\w-]+)?',
  'gpt-image(?:-[\\w-]+)?',
  'grok-2-image(?:-[\\w-]+)?',
  'imagen(?:-[\\w-]+)?',
  'flux(?:-[\\w-]+)?',
  'stable-?diffusion(?:-[\\w-]+)?',
  'stabilityai(?:-[\\w-]+)?',
  'sd-[\\w-]+',
  'sdxl(?:-[\\w-]+)?',
  'cogview(?:-[\\w-]+)?',
  'qwen-image(?:-[\\w-]+)?',
  'janus(?:-[\\w-]+)?',
  'midjourney(?:-[\\w-]+)?',
  'mj-[\\w-]+',
  'z-image(?:-[\\w-]+)?',
  'longcat-image(?:-[\\w-]+)?',
  'hunyuanimage(?:-[\\w-]+)?',
  'seedream(?:-[\\w-]+)?',
  'kandinsky(?:-[\\w-]+)?'
]

const DEDICATED_IMAGE_MODELS_REGEX = new RegExp(DEDICATED_IMAGE_MODELS.join('|'), 'i')

/** 函数调用模型列表 */
const FUNCTION_CALLING_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4',
  'gpt-4.5',
  'gpt-oss(?:-[\\w-]+)',
  'gpt-5(?:-[0-9-]+)?',
  'o(1|3|4)(?:-[\\w-]+)?',
  'claude',
  'qwen',
  'qwen3',
  'hunyuan',
  'deepseek',
  'glm-4(?:-[\\w-]+)?',
  'glm-4.5(?:-[\\w-]+)?',
  'glm-4.7(?:-[\\w-]+)?',
  'learnlm(?:-[\\w-]+)?',
  'gemini(?:-[\\w-]+)?',
  'grok-3(?:-[\\w-]+)?',
  'doubao-seed-1[.-][68](?:-[\\w-]+)?',
  'doubao-seed-code(?:-[\\w-]+)?',
  'kimi-k2(?:-[\\w-]+)?',
  'ling-\\w+(?:-[\\w-]+)?',
  'ring-\\w+(?:-[\\w-]+)?',
  'minimax-m2(?:.1)?',
  'mimo-v2-flash'
]

const FUNCTION_CALLING_EXCLUDED_MODELS = [
  'aqa(?:-[\\w-]+)?',
  'imagen(?:-[\\w-]+)?',
  'o1-mini',
  'o1-preview',
  'AIDC-AI/Marco-o1',
  'gemini-1(?:\\.[\\w-]+)?',
  'qwen-mt(?:-[\\w-]+)?',
  'gpt-5-chat(?:-[\\w-]+)?',
  'glm-4\\.5v',
  'gemini-2.5-flash-image(?:-[\\w-]+)?',
  'gemini-2.0-flash-preview-image-generation',
  'gemini-3(?:\\.\\d+)?-pro-image(?:-[\\w-]+)?',
  'deepseek-v3.2-speciale'
]

/** 函数调用模型正则 */
export const FUNCTION_CALLING_REGEX = new RegExp(
  `\\b(?!(?:${FUNCTION_CALLING_EXCLUDED_MODELS.join('|')})\\b)(?:${FUNCTION_CALLING_MODELS.join('|')})\\b`,
  'i'
)

/** Claude Web Search 支持的模型正则 */
const CLAUDE_SUPPORTED_WEBSEARCH_REGEX = new RegExp(
  `\\b(?:claude-3(-|\\.)(7|5)-sonnet(?:-[\\w-]+)|claude-3(-|\\.)5-haiku(?:-[\\w-]+)|claude-(haiku|sonnet|opus)-4(?:-[\\w-]+)?)\\b`,
  'i'
)

/** Gemini Search 支持的模型正则 */
const GEMINI_SEARCH_REGEX = new RegExp(
  'gemini-(?:2(?!.*-image-preview).*(?:-latest)?|3(?:\\.\\d+)?-(?:flash|pro)(?:-(?:image-)?preview)?|flash-latest|pro-latest|flash-lite-latest)(?:-[\\w-]+)*$',
  'i'
)

/** Perplexity 搜索模型列表 */
const PERPLEXITY_SEARCH_MODELS = ['sonar-pro', 'sonar', 'sonar-reasoning', 'sonar-reasoning-pro', 'sonar-deep-research']

/** OpenAI Web Search 模型检测 */
const isOpenAIWebSearchModelId = (modelId: string): boolean => {
  return (
    modelId.includes('gpt-4o-search-preview') ||
    modelId.includes('gpt-4o-mini-search-preview') ||
    (modelId.includes('gpt-4.1') && !modelId.includes('gpt-4.1-nano')) ||
    (modelId.includes('gpt-4o') && !modelId.includes('gpt-4o-image')) ||
    modelId.includes('o3') ||
    modelId.includes('o4') ||
    (modelId.includes('gpt-5') && !modelId.includes('chat'))
  )
}

/** 不支持的模型过滤正则（tts、whisper、speech 等） */
export const NOT_SUPPORTED_REGEX = /(?:^tts|whisper|speech)/i

/** DeepSeek V3.x 混合推理模型正则 */
const DEEPSEEK_HYBRID_REGEX = /(\w+-)?deepseek-v3(?:\.\d|-\d)(?:(\.|-)(?!speciale$)\w+)?$/

/** Doubao 思考模型正则 */
const DOUBAO_THINKING_MODEL_REGEX =
  /doubao-(?:1[.-]5-thinking-vision-pro|1[.-]5-thinking-pro-m|seed-1[.-][68](?:-flash)?(?!-(?:thinking)(?:-|$))|seed-code(?:-preview)?(?:-\d+)?)(?:-[\w-]+)*/i

// ============ 检测函数 ============

/**
 * 检测是否为重排模型
 */
export function detectRerank(model: SimpleModel): boolean {
  const modelId = getLowerBaseModelName(model.id)
  return RERANKING_REGEX.test(modelId)
}

/**
 * 检测是否为嵌入模型
 */
export function detectEmbedding(model: SimpleModel): boolean {
  if (!model || detectRerank(model)) {
    return false
  }

  const modelId = getLowerBaseModelName(model.id)

  if (['anthropic'].includes(model.provider)) {
    return false
  }

  if (model.provider === 'doubao' || modelId.includes('doubao')) {
    return EMBEDDING_REGEX.test(model.name)
  }

  return EMBEDDING_REGEX.test(modelId)
}

/**
 * 检测是否为专用图像生成模型
 */
function detectDedicatedImageModel(model: SimpleModel): boolean {
  if (!model) return false
  const modelId = getLowerBaseModelName(model.id)
  return DEDICATED_IMAGE_MODELS_REGEX.test(modelId)
}

/**
 * 检测是否为视觉模型
 */
export function detectVision(model: SimpleModel): boolean {
  if (!model || detectEmbedding(model) || detectRerank(model)) {
    return false
  }

  const modelId = getLowerBaseModelName(model.id)

  if (model.provider === 'doubao' || modelId.includes('doubao')) {
    return VISION_REGEX.test(model.name) || VISION_REGEX.test(modelId)
  }

  return VISION_REGEX.test(modelId) || IMAGE_ENHANCEMENT_MODELS_REGEX.test(modelId)
}

/**
 * 检测是否为 DeepSeek 混合推理模型（内部辅助）
 */
function isDeepSeekHybridModel(model: SimpleModel): boolean {
  const modelId = getLowerBaseModelName(model.id)
  return (
    DEEPSEEK_HYBRID_REGEX.test(modelId) || modelId.includes('deepseek-chat-v3.1') || modelId.includes('deepseek-chat')
  )
}

/**
 * 检测是否为推理模型
 *
 * 整合了客户端多个子函数的核心检测逻辑：
 * - Claude reasoning models
 * - OpenAI reasoning models (o-series, GPT-5)
 * - Gemini reasoning models
 * - Qwen reasoning models
 * - Grok reasoning models
 * - Doubao thinking models
 * - Hunyuan reasoning models
 * - Perplexity reasoning models
 * - Zhipu reasoning models
 * - Step reasoning models
 * - DeepSeek hybrid inference models
 * - Ling/Ring reasoning models
 * - MiniMax reasoning models
 * - MiMo reasoning models
 * - Baichuan reasoning models
 * - Kimi reasoning models
 */
export function detectReasoning(model: SimpleModel): boolean {
  if (!model || detectEmbedding(model) || detectRerank(model) || detectDedicatedImageModel(model)) {
    return false
  }

  const modelId = getLowerBaseModelName(model.id)

  // Doubao 特殊处理：同时检查 modelId 和 name
  if (model.provider === 'doubao' || modelId.includes('doubao')) {
    return (
      REASONING_REGEX.test(modelId) ||
      REASONING_REGEX.test(model.name) ||
      DOUBAO_THINKING_MODEL_REGEX.test(modelId) ||
      DOUBAO_THINKING_MODEL_REGEX.test(model.name) ||
      isDeepSeekHybridModel(model)
    )
  }

  // Claude reasoning models
  if (
    modelId.includes('claude-3-7-sonnet') ||
    modelId.includes('claude-3.7-sonnet') ||
    modelId.includes('claude-sonnet-4') ||
    modelId.includes('claude-opus-4') ||
    modelId.includes('claude-haiku-4')
  ) {
    return true
  }

  // OpenAI reasoning models (o-series, GPT-5)
  if (
    modelId.includes('o1') ||
    modelId.includes('o3') ||
    modelId.includes('o4') ||
    modelId.includes('gpt-oss') ||
    (modelId.includes('gpt-5') && !modelId.includes('chat'))
  ) {
    return true
  }

  // Gemini reasoning models
  if (
    (modelId.startsWith('gemini') && modelId.includes('thinking')) ||
    /gemini-(?:2\.5.*(?:-latest)?|3(?:\.\d+)?-(?:flash|pro)(?:-preview)?|flash-latest|pro-latest|flash-lite-latest)(?:-[\w-]+)*$/i.test(
      modelId
    )
  ) {
    // 排除 image 和 tts 模型
    if (!modelId.includes('image') && !modelId.includes('tts')) {
      return true
    }
    // 但 gemini-3-pro-image 支持思考
    if (modelId.includes('gemini-3-pro-image')) {
      return true
    }
  }

  // Qwen reasoning models
  if (modelId.startsWith('qwen3') && !modelId.includes('coder')) {
    return true
  }
  if (modelId.includes('qwq') || modelId.includes('qvq')) {
    return true
  }

  // Grok reasoning models
  if (modelId.includes('grok-3-mini') || (modelId.includes('grok-4') && !modelId.includes('non-reasoning'))) {
    return true
  }

  // Hunyuan reasoning models
  if (modelId.includes('hunyuan-t1') || modelId.includes('hunyuan-a13b')) {
    return true
  }

  // Perplexity reasoning models
  if (
    modelId.includes('sonar-deep-research') ||
    (modelId.includes('reasoning') && !modelId.includes('non-reasoning'))
  ) {
    return true
  }

  // Zhipu reasoning models
  if (['glm-4.5', 'glm-4.6', 'glm-4.7'].some((id) => modelId.includes(id)) || modelId.includes('glm-z1')) {
    return true
  }

  // Step reasoning models
  if (modelId.includes('step-3') || modelId.includes('step-r1-v-mini')) {
    return true
  }

  // DeepSeek hybrid inference models
  if (isDeepSeekHybridModel(model)) {
    return true
  }

  // Ling/Ring reasoning models
  if (['ring-1t', 'ring-mini', 'ring-flash'].some((id) => modelId.includes(id))) {
    return true
  }

  // MiniMax reasoning models
  if (['minimax-m1', 'minimax-m2', 'minimax-m2.1'].some((id) => modelId.includes(id))) {
    return true
  }

  // MiMo reasoning models
  if (modelId.includes('mimo-v2-flash')) {
    return true
  }

  // Baichuan reasoning models
  if (modelId === 'baichuan-m2' || modelId === 'baichuan-m3') {
    return true
  }

  // Kimi reasoning models
  if (/^kimi-k2-thinking(?:-turbo)?$|^kimi-k2\.5(?:-\w)*$/.test(modelId)) {
    return true
  }

  // 其他关键词匹配
  if (
    modelId.includes('magistral') ||
    modelId.includes('pangu-pro-moe') ||
    modelId.includes('seed-oss') ||
    modelId.includes('deepseek-v3.2-speciale')
  ) {
    return true
  }

  // 通用正则兜底
  return REASONING_REGEX.test(modelId)
}

/**
 * 检测是否为函数调用模型
 */
export function detectFunctionCalling(model: SimpleModel): boolean {
  if (!model || detectEmbedding(model) || detectRerank(model) || detectDedicatedImageModel(model)) {
    return false
  }

  const modelId = getLowerBaseModelName(model.id)

  // Doubao 特殊处理
  if (model.provider === 'doubao' || modelId.includes('doubao')) {
    return FUNCTION_CALLING_REGEX.test(modelId) || FUNCTION_CALLING_REGEX.test(model.name)
  }

  // DeepSeek 混合推理模型：部分供应商不支持函数调用
  if (isDeepSeekHybridModel(model)) {
    const unsupportedProviders = ['dashscope', 'doubao']
    if (unsupportedProviders.includes(model.provider)) {
      return false
    }
    return true
  }

  return FUNCTION_CALLING_REGEX.test(modelId)
}

/**
 * 检测是否为 Web 搜索模型
 *
 * 基于 providerId 字符串匹配，替代客户端的 provider.type 依赖。
 * 采用保守策略：对于无法确定的供应商，返回 false。
 */
export function detectWebSearch(model: SimpleModel): boolean {
  if (!model || detectEmbedding(model) || detectRerank(model) || detectDedicatedImageModel(model)) {
    return false
  }

  const providerId = model.provider
  const modelId = getLowerBaseModelName(model.id, '/')

  // Anthropic 系列（排除 AWS Bedrock）
  if (modelId.startsWith('claude') && providerId !== 'aws-bedrock') {
    return CLAUDE_SUPPORTED_WEBSEARCH_REGEX.test(modelId)
  }

  // OpenAI 系列
  if (providerId === 'openai' || providerId === 'azure-openai') {
    return isOpenAIWebSearchModelId(modelId)
  }

  // Perplexity
  if (providerId === 'perplexity') {
    return PERPLEXITY_SEARCH_MODELS.includes(modelId)
  }

  // AiHubMix（聚合平台）
  if (providerId === 'aihubmix') {
    if (!modelId.endsWith('-search') && GEMINI_SEARCH_REGEX.test(modelId)) {
      return true
    }
    return isOpenAIWebSearchModelId(modelId)
  }

  // Gemini / Vertex AI
  if (providerId === 'gemini' || providerId === 'vertexai') {
    return GEMINI_SEARCH_REGEX.test(modelId)
  }

  // 腾讯混元
  if (providerId === 'hunyuan') {
    return modelId !== 'hunyuan-lite'
  }

  // 智谱
  if (providerId === 'zhipu') {
    return modelId.startsWith('glm-4-')
  }

  // 阿里云百炼
  if (providerId === 'dashscope') {
    const models = ['qwen-turbo', 'qwen-max', 'qwen-plus', 'qwq', 'qwen-flash', 'qwen3-max']
    return models.some((i) => modelId.startsWith(i))
  }

  // OpenRouter（几乎所有模型都支持）
  if (providerId === 'openrouter') {
    return true
  }

  // Grok
  if (providerId === 'grok') {
    return true
  }

  // OpenAI 兼容 / New API 平台：检查 Gemini 和 OpenAI 模型
  if (providerId === 'new-api') {
    return GEMINI_SEARCH_REGEX.test(modelId) || isOpenAIWebSearchModelId(modelId)
  }

  return false
}

/**
 * 检测是否为免费模型
 */
export function detectFree(model: SimpleModel): boolean {
  if (!model) return false

  const id = model.id.toLowerCase()
  const name = model.name.toLowerCase()

  return (
    id.endsWith(':free') ||
    id.endsWith('(free)') ||
    id.endsWith('-free') ||
    name.endsWith(':free') ||
    name.endsWith('(free)') ||
    name.endsWith('-free')
  )
}

// ============ 聚合函数 ============

/**
 * 可检测的能力类型
 */
export type ModelCapability =
  | 'vision'
  | 'reasoning'
  | 'embedding'
  | 'function_calling'
  | 'web_search'
  | 'rerank'
  | 'free'

/**
 * 自动检测模型的所有能力
 * @param model 简化的模型信息
 * @returns 检测到的能力数组
 */
export function detectCapabilities(model: SimpleModel): ModelCapability[] {
  const capabilities: ModelCapability[] = []

  if (detectEmbedding(model)) {
    capabilities.push('embedding')
    return capabilities // 嵌入模型不会有其他能力
  }

  if (detectRerank(model)) {
    capabilities.push('rerank')
    return capabilities // 重排模型不会有其他能力
  }

  if (detectVision(model)) {
    capabilities.push('vision')
  }

  if (detectReasoning(model)) {
    capabilities.push('reasoning')
  }

  if (detectFunctionCalling(model)) {
    capabilities.push('function_calling')
  }

  if (detectWebSearch(model)) {
    capabilities.push('web_search')
  }

  if (detectFree(model)) {
    capabilities.push('free')
  }

  return capabilities
}

/**
 * 检测模型是否应被过滤（tts、whisper、speech 等非聊天模型）
 */
export function isNotSupportedModel(modelId: string): boolean {
  const lowerModelId = getLowerBaseModelName(modelId)
  return NOT_SUPPORTED_REGEX.test(lowerModelId)
}
