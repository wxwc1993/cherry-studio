import { API_PREFIX } from '@cherry-studio/enterprise-shared'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import morgan from 'morgan'

import { config } from './config'
import { registry } from './metrics'
import { errorHandler } from './middleware/errorHandler'
import { metricsMiddleware } from './middleware/metrics.middleware'
import { apiLimiter } from './middleware/rate-limit.middleware'
import { closeConnection,testConnection } from './models/db'
import routes from './routes'
import { feishuAlertService } from './services/feishu-alert.service'
import { createLogger } from './utils/logger'

const logger = createLogger('Server')

async function main() {
  const app = express()

  // 安全中间件
  app.use(helmet())
  app.use(
    cors({
      origin: config.server.corsOrigins,
      credentials: true
    })
  )

  // 速率限制（全局）
  app.use(apiLimiter)

  // 指标采集中间件
  app.use(metricsMiddleware)

  // 请求解析
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true }))

  // 日志
  if (config.server.env !== 'test') {
    app.use(
      morgan('combined', {
        stream: {
          write: (message: string) => logger.info(message.trim())
        }
      })
    )
  }

  // 健康检查端点（不需要认证）
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // Prometheus 指标端点
  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', registry.contentType)
      res.end(await registry.metrics())
    } catch (err) {
      res.status(500).end()
    }
  })

  // AlertManager webhook 端点
  app.post('/webhooks/alertmanager', express.json(), async (req, res) => {
    try {
      await feishuAlertService.handleAlertManagerWebhook(req.body)
      res.json({ status: 'ok' })
    } catch (err) {
      logger.error({ err }, 'Failed to handle AlertManager webhook')
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // API 路由
  app.use(API_PREFIX, routes)

  // 404 处理
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Cannot ${req.method} ${req.path}`
      }
    })
  })

  // 错误处理
  app.use(errorHandler)

  // 测试数据库连接
  const dbConnected = await testConnection()
  if (!dbConnected) {
    logger.error('Failed to connect to database. Exiting...')
    process.exit(1)
  }

  // 启动服务器
  const server = app.listen(config.server.port, config.server.host, () => {
    logger.info(`Server running at http://${config.server.host}:${config.server.port}`)
    logger.info(`API available at http://${config.server.host}:${config.server.port}${API_PREFIX}`)
    logger.info(`Environment: ${config.server.env}`)
  })

  // 优雅关闭
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Shutting down gracefully...`)

    server.close(async () => {
      logger.info('HTTP server closed')
      await closeConnection()
      process.exit(0)
    })

    // 强制关闭超时
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout')
      process.exit(1)
    }, 30000)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start server')
  process.exit(1)
})
