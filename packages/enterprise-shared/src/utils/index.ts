import type { ApiResponse, Pagination, PaginationParams } from '../types'

/**
 * 创建成功的 API 响应
 */
export function createSuccessResponse<T>(data: T, pagination?: Pagination): ApiResponse<T> {
  return {
    success: true,
    data,
    pagination
  }
}

/**
 * 创建错误的 API 响应
 */
export function createErrorResponse(code: string, message: string, details?: Record<string, unknown>): ApiResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details
    }
  }
}

/**
 * 创建分页信息
 */
export function createPagination(total: number, params: PaginationParams): Pagination {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize)
  }
}

/**
 * 计算分页偏移量
 */
export function calculateOffset(params: PaginationParams): number {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  return (page - 1) * pageSize
}

/**
 * 生成部门路径
 */
export function generateDepartmentPath(parentPath: string | undefined, departmentId: string): string {
  if (!parentPath || parentPath === '/') {
    return `/${departmentId}`
  }
  return `${parentPath}/${departmentId}`
}

/**
 * 检查是否为祖先部门
 */
export function isAncestorDepartment(ancestorPath: string, descendantPath: string): boolean {
  return descendantPath.startsWith(ancestorPath + '/')
}

/**
 * 从路径获取所有祖先部门ID
 */
export function getAncestorDepartmentIds(path: string): string[] {
  return path.split('/').filter(Boolean)
}

/**
 * 权限检查工具
 */
export function hasPermission(userPermissions: string[], requiredPermissions: string[], requireAll = false): boolean {
  if (requireAll) {
    return requiredPermissions.every((p) => userPermissions.includes(p))
  }
  return requiredPermissions.some((p) => userPermissions.includes(p))
}

/**
 * 检查知识库权限级别
 */
export function hasKBPermissionLevel(
  userLevel: 'viewer' | 'editor' | 'admin',
  requiredLevel: 'viewer' | 'editor' | 'admin'
): boolean {
  const levelOrder = { viewer: 1, editor: 2, admin: 3 }
  return levelOrder[userLevel] >= levelOrder[requiredLevel]
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let unitIndex = 0
  let size = bytes

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`
}

/**
 * 格式化 token 数量
 */
export function formatTokenCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(2)}M`
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(2)}K`
  }
  return count.toString()
}

/**
 * 安全地解析 JSON
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

/**
 * 深度合并对象
 */
export function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target }

  for (const key of Object.keys(source) as (keyof T)[]) {
    const sourceValue = source[key]
    const targetValue = result[key]

    if (
      sourceValue !== undefined &&
      typeof sourceValue === 'object' &&
      sourceValue !== null &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === 'object' &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      ) as T[keyof T]
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[keyof T]
    }
  }

  return result
}

/**
 * 生成随机 ID
 */
export function generateId(): string {
  return crypto.randomUUID()
}

/**
 * 延迟执行
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 重试函数
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; delayMs?: number; backoff?: boolean } = {}
): Promise<T> {
  const { maxAttempts = 3, delayMs = 1000, backoff = true } = options
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < maxAttempts) {
        const waitTime = backoff ? delayMs * Math.pow(2, attempt - 1) : delayMs
        await delay(waitTime)
      }
    }
  }

  throw lastError
}

/**
 * 批量处理数组
 */
export async function batchProcess<T, R>(items: T[], processFn: (item: T) => Promise<R>, batchSize = 10): Promise<R[]> {
  const results: R[] = []

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(processFn))
    results.push(...batchResults)
  }

  return results
}

/**
 * 计算费用（基于 token）
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  inputPricePerMillion: number,
  outputPricePerMillion: number
): number {
  const inputCost = (inputTokens / 1_000_000) * inputPricePerMillion
  const outputCost = (outputTokens / 1_000_000) * outputPricePerMillion
  return Number((inputCost + outputCost).toFixed(6))
}

/**
 * 检查是否为有效的文件扩展名
 */
export function isValidFileExtension(filename: string, allowedExtensions: readonly string[]): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'))
  return allowedExtensions.includes(ext)
}

/**
 * 清理文件名
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\.+/g, '.')
    .trim()
}
