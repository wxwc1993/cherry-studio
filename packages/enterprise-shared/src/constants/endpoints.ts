/**
 * 供应商默认 API 端点映射
 *
 * 从客户端 src/renderer/src/config/providers.ts 中提取的端点配置。
 * 用于 Admin 管理面板在获取模型列表时自动填充端点地址。
 *
 * 注意：所有端点均为 OpenAI 兼容格式的基础 URL（用于 GET /models 请求）。
 * 部分供应商（如 Azure、Vertex AI）需要用户手动配置端点。
 */

/**
 * 供应商默认 API 端点
 *
 * 值为空字符串表示该供应商需要用户手动配置端点。
 */
export const PROVIDER_DEFAULT_ENDPOINTS: Readonly<Record<string, string>> = {
  // 国际主流供应商
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
  'azure-openai': '', // 需要用户配置
  gemini: 'https://generativelanguage.googleapis.com',
  vertexai: '', // 需要用户配置
  'aws-bedrock': '', // 需要用户配置
  mistral: 'https://api.mistral.ai',
  groq: 'https://api.groq.com/openai',
  together: 'https://api.together.xyz',
  fireworks: 'https://api.fireworks.ai/inference',
  nvidia: 'https://integrate.api.nvidia.com',
  grok: 'https://api.x.ai',
  hyperbolic: 'https://api.hyperbolic.xyz',
  perplexity: 'https://api.perplexity.ai/',
  huggingface: 'https://router.huggingface.co/v1/',
  cerebras: 'https://api.cerebras.ai/v1',

  // 国内供应商
  deepseek: 'https://api.deepseek.com',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4/',
  moonshot: 'https://api.moonshot.cn',
  dashscope: 'https://dashscope.aliyuncs.com/compatible-mode/v1/',
  doubao: 'https://ark.cn-beijing.volces.com/api/v3/',
  minimax: 'https://api.minimaxi.com/v1',
  baichuan: 'https://api.baichuan-ai.com',
  yi: 'https://api.lingyiwanwu.com',
  stepfun: 'https://api.stepfun.com',
  hunyuan: 'https://api.hunyuan.cloud.tencent.com',
  infini: 'https://cloud.infini-ai.com/maas',
  'baidu-cloud': 'https://qianfan.baidubce.com/v2/',
  'tencent-cloud-ti': 'https://api.lkeap.cloud.tencent.com',
  modelscope: 'https://api-inference.modelscope.cn/v1/',
  xirang: 'https://wishub-x1.ctyun.cn',
  mimo: 'https://api.xiaomimimo.com',

  // 聚合/中转平台
  silicon: 'https://api.siliconflow.cn',
  openrouter: 'https://openrouter.ai/api/v1/',
  aihubmix: 'https://aihubmix.com',
  ocoolai: 'https://api.ocoolai.com',
  ppio: 'https://api.ppinfra.com/v3/openai/',
  alayanew: 'https://deepseek.alayanew.com',
  qiniu: 'https://api.qnaigc.com',
  dmxapi: 'https://www.dmxapi.cn',
  burncloud: 'https://ai.burncloud.com',
  tokenflux: 'https://api.tokenflux.ai/openai/v1',
  '302ai': 'https://api.302.ai',
  cephalon: 'https://cephalon.cloud/user-center/v1/model',
  lanyun: 'https://maas-api.lanyun.net',
  ph8: 'https://ph8.co',
  sophnet: 'https://www.sophnet.com/api/open-apis/v1',
  aionly: 'https://api.aiionly.com',
  longcat: 'https://api.longcat.chat/openai',
  cherryin: 'https://open.cherryin.net',

  // 本地/私有化部署
  ollama: 'http://localhost:11434',
  lmstudio: 'http://localhost:1234',
  'new-api': '', // 需要用户配置
  ovms: 'http://localhost:8000/v3/',
  gpustack: 'http://localhost:3000',
  gateway: 'https://ai-gateway.vercel.sh/v1/ai',

  // 其他
  github: 'https://models.github.ai/inference',
  copilot: 'https://api.githubcopilot.com/',
  jina: 'https://api.jina.ai',
  voyageai: 'https://api.voyageai.com',
  poe: 'https://api.poe.com/v1/'
} as const

/**
 * 获取供应商默认端点
 *
 * @param providerId 供应商 ID
 * @returns 默认端点 URL，未找到时返回空字符串
 */
export function getProviderDefaultEndpoint(providerId: string): string {
  return PROVIDER_DEFAULT_ENDPOINTS[providerId] ?? ''
}

/**
 * 构建 API 子路径的完整 URL（内部辅助函数）
 *
 * 根据供应商端点和子路径拼接完整 URL。
 * 自动检测端点是否已包含版本路径（/v1、/v2 等），
 * 若无则插入 /v1 前缀。
 *
 * @param endpoint 供应商 API 基础端点
 * @param subPath API 子路径（如 '/models'、'/chat/completions'）
 * @returns 完整的 API 请求 URL
 */
function buildApiUrl(endpoint: string, subPath: string): string {
  if (!endpoint) {
    return ''
  }

  const trimmed = endpoint.replace(/\/+$/, '')

  // 如果端点已包含版本路径（/v1、/v2、/v3 等），直接追加子路径
  if (/\/v\d+(?:\/.*)?$/.test(trimmed)) {
    return `${trimmed}${subPath}`
  }

  // 默认插入 /v1 前缀
  return `${trimmed}/v1${subPath}`
}

/**
 * 构建获取模型列表的完整 URL
 *
 * 根据供应商端点拼接 /v1/models 路径（OpenAI 兼容格式）。
 *
 * @param endpoint 供应商 API 基础端点
 * @returns 完整的模型列表请求 URL
 */
export function buildModelsListUrl(endpoint: string): string {
  return buildApiUrl(endpoint, '/models')
}

/**
 * 构建聊天补全请求的完整 URL
 *
 * 根据供应商端点拼接 /v1/chat/completions 路径（OpenAI 兼容格式）。
 *
 * @param endpoint 供应商 API 基础端点
 * @returns 完整的聊天补全请求 URL
 */
export function buildChatCompletionsUrl(endpoint: string): string {
  return buildApiUrl(endpoint, '/chat/completions')
}
