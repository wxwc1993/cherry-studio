import { createErrorResponse, ERROR_CODES } from '@cherry-studio/enterprise-shared'
import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'

import { createLogger } from '../utils/logger'

const logger = createLogger('ErrorHandler')

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ERROR_CODES.VALIDATION_FAILED, message, 400, details)
    this.name = 'ValidationError'
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(ERROR_CODES.AUTH_UNAUTHORIZED, message, 401)
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Permission denied') {
    super(ERROR_CODES.PERMISSION_DENIED, message, 403)
    this.name = 'AuthorizationError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(ERROR_CODES.RESOURCE_NOT_FOUND, `${resource} not found`, 404)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(ERROR_CODES.RESOURCE_CONFLICT, message, 409)
    this.name = 'ConflictError'
  }
}

export class QuotaExceededError extends AppError {
  constructor(quotaType: 'daily' | 'monthly' | 'user' | 'storage') {
    const codes = {
      daily: ERROR_CODES.QUOTA_EXCEEDED_DAILY,
      monthly: ERROR_CODES.QUOTA_EXCEEDED_MONTHLY,
      user: ERROR_CODES.QUOTA_EXCEEDED_USER,
      storage: ERROR_CODES.QUOTA_STORAGE_EXCEEDED
    }
    super(codes[quotaType], `${quotaType} quota exceeded`, 429)
    this.name = 'QuotaExceededError'
  }
}

export const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // 已发送响应，跳过
  if (res.headersSent) {
    return next(err)
  }

  // Zod 验证错误
  if (err instanceof ZodError) {
    const details = err.errors.reduce(
      (acc, e) => {
        acc[e.path.join('.')] = e.message
        return acc
      },
      {} as Record<string, string>
    )

    res.status(400).json(createErrorResponse(ERROR_CODES.VALIDATION_FAILED, 'Validation failed', details))
    return
  }

  // 自定义应用错误
  if (err instanceof AppError) {
    logger.warn({ err, path: req.path }, err.message)
    res.status(err.statusCode).json(createErrorResponse(err.code, err.message, err.details))
    return
  }

  // 未知错误
  logger.error({ err, path: req.path }, 'Unhandled error')
  res.status(500).json(createErrorResponse(ERROR_CODES.INTERNAL_ERROR, 'Internal server error'))
}
