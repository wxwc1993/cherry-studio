import type { NextFunction,Request, Response } from 'express'

import { httpRequestDuration,httpRequestsTotal } from '../metrics'

/**
 * Prometheus 指标采集中间件
 * 自动记录每个 HTTP 请求的计数和延迟
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 跳过 metrics 端点本身，避免循环
  if (req.path === '/metrics') {
    next()
    return
  }

  const startTime = process.hrtime.bigint()

  // 响应完成时记录指标
  res.on('finish', () => {
    const endTime = process.hrtime.bigint()
    const durationNs = Number(endTime - startTime)
    const durationSeconds = durationNs / 1e9

    // 规范化路径（避免高基数问题）
    const normalizedPath = normalizePath(req.path)

    // 记录请求计数
    httpRequestsTotal.inc({
      method: req.method,
      path: normalizedPath,
      status: res.statusCode
    })

    // 记录请求延迟
    httpRequestDuration.observe(
      {
        method: req.method,
        path: normalizedPath
      },
      durationSeconds
    )
  })

  next()
}

/**
 * 规范化请求路径
 * 将动态参数（如 UUID、ID）替换为占位符，避免指标基数爆炸
 */
function normalizePath(path: string): string {
  // UUID 格式: 8-4-4-4-12 hex chars
  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

  // 数字 ID
  const numericIdRegex = /\/\d+(?=\/|$)/g

  return path.replace(uuidRegex, ':id').replace(numericIdRegex, '/:id').replace(/\/+/g, '/') // 清理多余斜杠
}
