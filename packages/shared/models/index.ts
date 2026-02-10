/**
 * 模型工具函数统一导出入口
 *
 * 包含模型命名和能力检测的纯函数，可在客户端和服务端共用。
 */

export type { ModelCapability, SimpleModel } from './capabilities'
export {
  detectCapabilities,
  detectEmbedding,
  detectFree,
  detectFunctionCalling,
  detectReasoning,
  detectRerank,
  detectVision,
  detectWebSearch,
  EMBEDDING_REGEX,
  FUNCTION_CALLING_REGEX,
  isNotSupportedModel,
  NOT_SUPPORTED_REGEX,
  REASONING_REGEX,
  RERANKING_REGEX,
  VISION_REGEX
} from './capabilities'
export { getBaseModelName, getLowerBaseModelName } from './naming'
