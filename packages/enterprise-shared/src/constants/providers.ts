/**
 * 企业版供应商配置
 *
 * 此文件定义了 Admin 管理端和客户端共享的供应商 ID 与显示名称映射。
 * 这些 ID 直接对应客户端的 SystemProviderId，确保图标正确显示。
 */

/**
 * 所有支持的供应商 ID
 * 这些 ID 与客户端的 SystemProviderId 完全一致
 */
export const ENTERPRISE_PROVIDER_IDS = {
  // 国际主流供应商
  openai: 'openai',
  anthropic: 'anthropic',
  'azure-openai': 'azure-openai',
  gemini: 'gemini',
  vertexai: 'vertexai',
  'aws-bedrock': 'aws-bedrock',
  mistral: 'mistral',
  groq: 'groq',
  together: 'together',
  fireworks: 'fireworks',
  nvidia: 'nvidia',
  grok: 'grok',
  hyperbolic: 'hyperbolic',
  perplexity: 'perplexity',
  huggingface: 'huggingface',
  cerebras: 'cerebras',

  // 国内供应商
  deepseek: 'deepseek',
  zhipu: 'zhipu',
  moonshot: 'moonshot',
  dashscope: 'dashscope',
  doubao: 'doubao',
  minimax: 'minimax',
  baichuan: 'baichuan',
  yi: 'yi',
  stepfun: 'stepfun',
  hunyuan: 'hunyuan',
  infini: 'infini',
  'baidu-cloud': 'baidu-cloud',
  'tencent-cloud-ti': 'tencent-cloud-ti',
  modelscope: 'modelscope',
  xirang: 'xirang',
  mimo: 'mimo',

  // 聚合/中转平台
  silicon: 'silicon',
  openrouter: 'openrouter',
  aihubmix: 'aihubmix',
  ocoolai: 'ocoolai',
  ppio: 'ppio',
  alayanew: 'alayanew',
  qiniu: 'qiniu',
  dmxapi: 'dmxapi',
  burncloud: 'burncloud',
  tokenflux: 'tokenflux',
  '302ai': '302ai',
  cephalon: 'cephalon',
  lanyun: 'lanyun',
  ph8: 'ph8',
  sophnet: 'sophnet',
  aionly: 'aionly',
  longcat: 'longcat',
  cherryin: 'cherryin',

  // 本地/私有化部署
  ollama: 'ollama',
  lmstudio: 'lmstudio',
  'new-api': 'new-api',
  ovms: 'ovms',
  gpustack: 'gpustack',
  gateway: 'gateway',

  // 其他
  github: 'github',
  copilot: 'copilot',
  jina: 'jina',
  voyageai: 'voyageai',
  poe: 'poe'
} as const

export type EnterpriseProviderId = keyof typeof ENTERPRISE_PROVIDER_IDS

/**
 * 供应商显示名称映射
 */
export const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  // 国际主流供应商
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  'azure-openai': 'Azure OpenAI',
  gemini: 'Google Gemini',
  vertexai: 'Vertex AI',
  'aws-bedrock': 'AWS Bedrock',
  mistral: 'Mistral',
  groq: 'Groq',
  together: 'Together',
  fireworks: 'Fireworks',
  nvidia: 'NVIDIA',
  grok: 'Grok',
  hyperbolic: 'Hyperbolic',
  perplexity: 'Perplexity',
  huggingface: 'Hugging Face',
  cerebras: 'Cerebras AI',

  // 国内供应商
  deepseek: 'DeepSeek',
  zhipu: '智谱 AI',
  moonshot: 'Moonshot AI',
  dashscope: '阿里云百炼',
  doubao: '字节豆包',
  minimax: 'MiniMax',
  baichuan: '百川智能',
  yi: '零一万物',
  stepfun: '阶跃星辰',
  hunyuan: '腾讯混元',
  infini: '无问芯穹',
  'baidu-cloud': '百度智能云',
  'tencent-cloud-ti': '腾讯云 TI',
  modelscope: 'ModelScope',
  xirang: '天翼云息壤',
  mimo: '小米 MiMo',

  // 聚合/中转平台
  silicon: 'Silicon Flow',
  openrouter: 'OpenRouter',
  aihubmix: 'AiHubMix',
  ocoolai: 'ocoolAI',
  ppio: 'PPIO',
  alayanew: 'AlayaNew',
  qiniu: '七牛云',
  dmxapi: 'DMXAPI',
  burncloud: 'BurnCloud',
  tokenflux: 'TokenFlux',
  '302ai': '302.AI',
  cephalon: 'Cephalon',
  lanyun: '蓝耘 AI',
  ph8: 'PH8',
  sophnet: 'SophNet',
  aionly: 'AIOnly',
  longcat: 'LongCat',
  cherryin: 'CherryIN',

  // 本地/私有化部署
  ollama: 'Ollama',
  lmstudio: 'LM Studio',
  'new-api': 'New API',
  ovms: 'OpenVINO Model Server',
  gpustack: 'GPUStack',
  gateway: 'Vercel AI Gateway',

  // 其他
  github: 'Github Models',
  copilot: 'Github Copilot',
  jina: 'Jina',
  voyageai: 'VoyageAI',
  poe: 'Poe'
}

/**
 * 获取所有供应商选项列表（用于 Admin 下拉选择）
 */
export function getProviderOptions(): Array<{ label: string; value: string }> {
  return Object.keys(ENTERPRISE_PROVIDER_IDS)
    .map((id) => ({
      label: PROVIDER_DISPLAY_NAMES[id] || id,
      value: id
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))
}

/**
 * 检查是否为有效的企业供应商 ID
 */
export function isEnterpriseProviderId(id: string): id is EnterpriseProviderId {
  return id in ENTERPRISE_PROVIDER_IDS
}
