import type { NextFunction, Request, Response } from 'express'
import type { ZodSchema } from 'zod'

type RequestPart = 'body' | 'query' | 'params'

/**
 * 请求验证中间件工厂
 */
export function validate(schema: ZodSchema, part: RequestPart = 'body') {
  if (!schema) {
    throw new Error(
      `[validate] schema is undefined for part "${part}" — check that the schema is correctly imported and the package is built`
    )
  }
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = req[part]
      const parsed = await schema.parseAsync(data)
      // req.query 和 req.params 在某些 Express 配置下是只读的 getter，使用 Object.assign 更新
      if (part === 'body') {
        req.body = parsed
      } else {
        Object.assign(req[part], parsed)
      }
      next()
    } catch (err) {
      next(err)
    }
  }
}

/**
 * 组合验证多个部分
 */
export function validateMultiple(schemas: Partial<Record<RequestPart, ZodSchema>>) {
  for (const [part, schema] of Object.entries(schemas)) {
    if (!schema) {
      throw new Error(
        `[validateMultiple] schema is undefined for part "${part}" — check that the schema is correctly imported and the package is built`
      )
    }
  }
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      for (const [part, schema] of Object.entries(schemas) as [RequestPart, ZodSchema][]) {
        if (schema) {
          const parsed = await schema.parseAsync(req[part])
          // req.query 和 req.params 在某些 Express 配置下是只读的 getter，使用 Object.assign 更新
          if (part === 'body') {
            req.body = parsed
          } else {
            Object.assign(req[part], parsed)
          }
        }
      }
      next()
    } catch (err) {
      next(err)
    }
  }
}
