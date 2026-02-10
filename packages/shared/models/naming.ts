/**
 * 模型命名工具函数（纯函数，无外部依赖）
 *
 * 从 src/renderer/src/utils/naming.ts 提取的共享版本。
 * 适用于服务端（Admin/Server）和客户端。
 */

/**
 * 从模型 ID 中提取基础名称。
 * 例如：
 * - 'deepseek/deepseek-r1' => 'deepseek-r1'
 * - 'deepseek-ai/deepseek/deepseek-r1' => 'deepseek-r1'
 * @param id 模型 ID
 * @param delimiter 分隔符，默认为 '/'
 * @returns 基础名称
 */
export const getBaseModelName = (id: string, delimiter: string = '/'): string => {
  const parts = id.split(delimiter)
  return parts[parts.length - 1]
}

/**
 * 从模型 ID 中提取基础名称并转换为小写，同时移除常见后缀。
 * 例如：
 * - 'deepseek/DeepSeek-R1' => 'deepseek-r1'
 * - 'model-name:free' => 'model-name'
 * - 'model-name(free)' => 'model-name'
 * - 'model-name:cloud' => 'model-name'
 * @param id 模型 ID
 * @param delimiter 分隔符，默认为 '/'
 * @returns 小写的基础名称
 */
export const getLowerBaseModelName = (id: string, delimiter: string = '/'): string => {
  let baseModelName = getBaseModelName(id, delimiter).toLowerCase()
  // Remove suffix
  // for openrouter
  if (baseModelName.endsWith(':free')) {
    baseModelName = baseModelName.replace(':free', '')
  }
  // for cherryin
  if (baseModelName.endsWith('(free)')) {
    baseModelName = baseModelName.replace('(free)', '')
  }
  // for ollama
  if (baseModelName.endsWith(':cloud')) {
    baseModelName = baseModelName.replace(':cloud', '')
  }
  return baseModelName
}
