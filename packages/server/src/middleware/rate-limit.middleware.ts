import type { Request, Response } from 'express'
import rateLimit, { type Options, type RateLimitRequestHandler } from 'express-rate-limit'

import { createLogger } from '../utils/logger'

const logger = createLogger('RateLimitMiddleware')

/**
 * 创建速率限制中间件
 * @param options 配置选项
 */
export function createRateLimiter(options: Partial<Options> & { name?: string }): RateLimitRequestHandler {
  const { name = 'default', ...rateLimitOptions } = options
  const isDevelopment = process.env.NODE_ENV === 'development'

  return rateLimit({
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: '请求过于频繁，请稍后再试'
      }
    },
    handler: (req: Request, res: Response) => {
      logger.warn(
        {
          limiter: name,
          ip: req.ip,
          path: req.path,
          userId: (req as Request & { user?: { id: string } }).user?.id
        },
        'Rate limit exceeded'
      )

      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: '请求过于频繁，请稍后再试'
        }
      })
    },
    keyGenerator: (req: Request) => {
      // 优先使用用户 ID，否则使用 IP
      const userId = (req as Request & { user?: { id: string } }).user?.id
      if (userId) return userId

      // 多种回退方式确保返回有效 key
      const forwardedFor = req.headers['x-forwarded-for']
      const ip = req.ip || (typeof forwardedFor === 'string' ? forwardedFor.split(',')[0].trim() : undefined)
      return ip || req.socket?.remoteAddress || `anonymous-${Date.now()}`
    },
    skip: (req: Request) => {
      // 开发环境跳过限流
      if (isDevelopment) {
        return true
      }
      // 跳过健康检查端点
      return req.path === '/health' || req.path === '/metrics'
    },
    ...rateLimitOptions
  })
}

// ============ 预定义限制器 ============

/**
 * 登录限制器
 * 5 次 / 5 分钟（防暴力破解）
 */
export const loginLimiter = createRateLimiter({
  name: 'login',
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5,
  message: {
    success: false,
    error: {
      code: 'LOGIN_RATE_LIMIT_EXCEEDED',
      message: '登录尝试过于频繁，请 5 分钟后再试'
    }
  },
  keyGenerator: (req: Request) => {
    // 登录使用 IP 作为 key（因为用户还未认证）
    const forwardedFor = req.headers['x-forwarded-for']
    const ip = req.ip || (typeof forwardedFor === 'string' ? forwardedFor.split(',')[0].trim() : undefined)
    return ip || req.socket?.remoteAddress || `anonymous-${Date.now()}`
  }
})

/**
 * 聊天限制器
 * 30 次 / 分钟 / 用户
 */
export const chatLimiter = createRateLimiter({
  name: 'chat',
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: {
    success: false,
    error: {
      code: 'CHAT_RATE_LIMIT_EXCEEDED',
      message: '对话请求过于频繁，请稍后再试'
    }
  }
})

/**
 * 上传限制器
 * 100 次 / 小时 / 用户
 */
export const uploadLimiter = createRateLimiter({
  name: 'upload',
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  message: {
    success: false,
    error: {
      code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
      message: '上传请求过于频繁，请稍后再试'
    }
  }
})

/**
 * API 通用限制器
 * 100 次 / 分钟 / 用户
 */
export const apiLimiter = createRateLimiter({
  name: 'api',
  windowMs: 60 * 1000, // 1 minute
  max: 100
})

/**
 * 严格限制器（用于敏感操作）
 * 10 次 / 分钟 / 用户
 */
export const strictLimiter = createRateLimiter({
  name: 'strict',
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: {
    success: false,
    error: {
      code: 'STRICT_RATE_LIMIT_EXCEEDED',
      message: '操作过于频繁，请稍后再试'
    }
  }
})
