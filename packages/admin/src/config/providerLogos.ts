/**
 * 供应商图标映射配置
 *
 * 通过 Vite 别名引用客户端 renderer 的图标资源，
 * 使用 import.meta.glob 批量导入并自动建立文件名索引。
 */

// 批量导入 providers 和 models 目录的图标（eager 模式）
const providerModules: Record<string, { default: string }> = import.meta.glob('@provider-logos/*.{png,webp,svg,jpeg}', {
  eager: true
})

const modelModules: Record<string, { default: string }> = import.meta.glob('@model-logos/*.{png,webp,svg,jpeg}', {
  eager: true
})

/**
 * 从文件路径提取不带扩展名的文件名
 * 例如: "@provider-logos/openai.png" → "openai"
 */
function extractFilename(filepath: string): string {
  const parts = filepath.split('/')
  const fullName = parts[parts.length - 1]
  const dotIndex = fullName.lastIndexOf('.')
  return dotIndex > 0 ? fullName.slice(0, dotIndex) : fullName
}

// 建立 { filename: imageUrl } 索引
const providerLogoIndex: Record<string, string> = {}
for (const [path, mod] of Object.entries(providerModules)) {
  const name = extractFilename(path)
  providerLogoIndex[name] = mod.default
}

const modelLogoIndex: Record<string, string> = {}
for (const [path, mod] of Object.entries(modelModules)) {
  const name = extractFilename(path)
  modelLogoIndex[name] = mod.default
}

/**
 * providerId → 图标来源配置
 * dir: 'providers' | 'models' 表示图标所在目录
 * filename: 不带扩展名的文件名
 */
interface LogoEntry {
  dir: 'providers' | 'models'
  filename: string
}

const PROVIDER_LOGO_MAP: Record<string, LogoEntry> = {
  openai: { dir: 'providers', filename: 'openai' },
  anthropic: { dir: 'providers', filename: 'anthropic' },
  'azure-openai': { dir: 'models', filename: 'microsoft' },
  gemini: { dir: 'providers', filename: 'google' },
  vertexai: { dir: 'providers', filename: 'vertexai' },
  'aws-bedrock': { dir: 'providers', filename: 'aws-bedrock' },
  mistral: { dir: 'providers', filename: 'mistral' },
  groq: { dir: 'providers', filename: 'groq' },
  together: { dir: 'providers', filename: 'together' },
  fireworks: { dir: 'providers', filename: 'fireworks' },
  nvidia: { dir: 'providers', filename: 'nvidia' },
  grok: { dir: 'providers', filename: 'grok' },
  hyperbolic: { dir: 'providers', filename: 'hyperbolic' },
  perplexity: { dir: 'providers', filename: 'perplexity' },
  huggingface: { dir: 'providers', filename: 'huggingface' },
  cerebras: { dir: 'providers', filename: 'cerebras' },
  deepseek: { dir: 'providers', filename: 'deepseek' },
  zhipu: { dir: 'providers', filename: 'zhipu' },
  moonshot: { dir: 'providers', filename: 'moonshot' },
  dashscope: { dir: 'providers', filename: 'bailian' },
  doubao: { dir: 'providers', filename: 'volcengine' },
  minimax: { dir: 'providers', filename: 'minimax' },
  baichuan: { dir: 'providers', filename: 'baichuan' },
  yi: { dir: 'providers', filename: 'zero-one' },
  stepfun: { dir: 'providers', filename: 'step' },
  hunyuan: { dir: 'models', filename: 'hunyuan' },
  infini: { dir: 'providers', filename: 'infini' },
  'baidu-cloud': { dir: 'providers', filename: 'baidu-cloud' },
  'tencent-cloud-ti': { dir: 'providers', filename: 'tencent-cloud-ti' },
  modelscope: { dir: 'providers', filename: 'modelscope' },
  xirang: { dir: 'providers', filename: 'xirang' },
  mimo: { dir: 'providers', filename: 'mimo' },
  silicon: { dir: 'providers', filename: 'silicon' },
  openrouter: { dir: 'providers', filename: 'openrouter' },
  aihubmix: { dir: 'providers', filename: 'aihubmix' },
  ocoolai: { dir: 'providers', filename: 'ocoolai' },
  ppio: { dir: 'providers', filename: 'ppio' },
  alayanew: { dir: 'providers', filename: 'alayanew' },
  qiniu: { dir: 'providers', filename: 'qiniu' },
  dmxapi: { dir: 'providers', filename: 'DMXAPI' },
  burncloud: { dir: 'providers', filename: 'burncloud' },
  tokenflux: { dir: 'providers', filename: 'tokenflux' },
  '302ai': { dir: 'providers', filename: '302ai' },
  cephalon: { dir: 'providers', filename: 'cephalon' },
  lanyun: { dir: 'providers', filename: 'lanyun' },
  ph8: { dir: 'providers', filename: 'ph8' },
  sophnet: { dir: 'providers', filename: 'sophnet' },
  aionly: { dir: 'providers', filename: 'aiOnly' },
  longcat: { dir: 'providers', filename: 'longcat' },
  cherryin: { dir: 'providers', filename: 'cherryin' },
  ollama: { dir: 'providers', filename: 'ollama' },
  lmstudio: { dir: 'providers', filename: 'lmstudio' },
  'new-api': { dir: 'providers', filename: 'newapi' },
  ovms: { dir: 'providers', filename: 'intel' },
  gpustack: { dir: 'providers', filename: 'gpustack' },
  gateway: { dir: 'providers', filename: 'vercel' },
  github: { dir: 'providers', filename: 'github' },
  copilot: { dir: 'providers', filename: 'github' },
  jina: { dir: 'providers', filename: 'jina' },
  voyageai: { dir: 'providers', filename: 'voyageai' }
}

/**
 * 根据 providerId 获取图标 URL
 * @returns 图标 URL，如果没有对应图标则返回 undefined
 */
export function getProviderLogoUrl(providerId: string): string | undefined {
  const entry = PROVIDER_LOGO_MAP[providerId]
  if (!entry) {
    return undefined
  }

  const index = entry.dir === 'providers' ? providerLogoIndex : modelLogoIndex
  return index[entry.filename]
}
