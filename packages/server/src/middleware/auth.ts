import type { JWTPayload } from '@cherry-studio/enterprise-shared'
import { randomUUID } from 'crypto'
import type { NextFunction, Request, Response } from 'express'
import * as jose from 'jose'

import { config } from '../config'
import { AuthenticationError, AuthorizationError } from './errorHandler'

declare module 'express-serve-static-core' {
  interface Request {
    user?: JWTPayload
  }
}

const secret = new TextEncoder().encode(config.jwt.secret)

/**
 * 验证 JWT token 的中间件
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided')
    }

    const token = authHeader.substring(7)

    try {
      const { payload } = await jose.jwtVerify(token, secret)
      req.user = payload as unknown as JWTPayload
      next()
    } catch (err) {
      if (err instanceof jose.errors.JWTExpired) {
        throw new AuthenticationError('Token expired')
      }
      throw new AuthenticationError('Invalid token')
    }
  } catch (err) {
    next(err)
  }
}

/**
 * 可选认证中间件（不强制要求登录）
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      try {
        const { payload } = await jose.jwtVerify(token, secret)
        req.user = payload as unknown as JWTPayload
      } catch {
        // 忽略无效 token，继续作为未认证请求
      }
    }
    next()
  } catch (err) {
    next(err)
  }
}

/**
 * 权限检查中间件工厂
 */
export function requirePermission(
  category: keyof JWTPayload['permissions'],
  permission: string
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthenticationError())
    }

    const userPermissions = req.user.permissions[category] as string[]
    if (!userPermissions || !userPermissions.includes(permission)) {
      return next(new AuthorizationError(`Missing permission: ${category}.${permission}`))
    }

    next()
  }
}

/**
 * 多权限检查（需要任一权限）
 */
export function requireAnyPermission(
  permissions: Array<{ category: keyof JWTPayload['permissions']; permission: string }>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthenticationError())
    }

    const hasPermission = permissions.some(({ category, permission }) => {
      const userPermissions = req.user!.permissions[category] as string[]
      return userPermissions && userPermissions.includes(permission)
    })

    if (!hasPermission) {
      return next(new AuthorizationError('Insufficient permissions'))
    }

    next()
  }
}

/**
 * 生成 JWT token
 */
export async function generateTokens(
  payload: Omit<JWTPayload, 'iat' | 'exp'>
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = await new jose.SignJWT(payload as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(config.jwt.accessTokenExpiresIn)
    .sign(secret)

  const refreshToken = await new jose.SignJWT({
    sub: payload.sub,
    type: 'refresh',
    jti: randomUUID() // 添加唯一 JWT ID 防止并发刷新时生成相同 token
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(config.jwt.refreshTokenExpiresIn)
    .sign(secret)

  return { accessToken, refreshToken }
}

/**
 * 验证刷新 token
 */
export async function verifyRefreshToken(token: string): Promise<string> {
  try {
    const { payload } = await jose.jwtVerify(token, secret)
    if (payload.type !== 'refresh') {
      throw new AuthenticationError('Invalid refresh token')
    }
    return payload.sub as string
  } catch (err) {
    if (err instanceof jose.errors.JWTExpired) {
      throw new AuthenticationError('Refresh token expired')
    }
    throw new AuthenticationError('Invalid refresh token')
  }
}
