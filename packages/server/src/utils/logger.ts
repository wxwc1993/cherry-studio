import pino from 'pino'

import { config } from '../config'

const transport =
  config.server.env === 'development'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      }
    : undefined

export const logger = pino({
  level: config.logging.level,
  transport
})

export function createLogger(context: string) {
  return logger.child({ context })
}
