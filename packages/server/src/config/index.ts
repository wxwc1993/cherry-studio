import dotenv from 'dotenv'

dotenv.config()

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue
}

export const config = {
  // 服务配置
  server: {
    port: parseInt(optionalEnv('PORT', '3000'), 10),
    host: optionalEnv('HOST', '0.0.0.0'),
    env: optionalEnv('NODE_ENV', 'development'),
    corsOrigins: optionalEnv('CORS_ORIGINS', '*').split(',')
  },

  // 数据库配置
  database: {
    host: optionalEnv('DB_HOST', 'localhost'),
    port: parseInt(optionalEnv('DB_PORT', '5432'), 10),
    user: optionalEnv('DB_USER', 'postgres'),
    password: optionalEnv('DB_PASSWORD', 'postgres'),
    database: optionalEnv('DB_NAME', 'cherry_studio_enterprise'),
    ssl: optionalEnv('DB_SSL', 'false') === 'true',
    poolSize: parseInt(optionalEnv('DB_POOL_SIZE', '10'), 10)
  },

  // Redis 配置
  redis: {
    host: optionalEnv('REDIS_HOST', 'localhost'),
    port: parseInt(optionalEnv('REDIS_PORT', '6379'), 10),
    password: optionalEnv('REDIS_PASSWORD', ''),
    db: parseInt(optionalEnv('REDIS_DB', '0'), 10)
  },

  // 阿里云 OSS 配置
  oss: {
    region: optionalEnv('OSS_REGION', 'oss-cn-hangzhou'),
    accessKeyId: optionalEnv('OSS_ACCESS_KEY_ID', ''),
    accessKeySecret: optionalEnv('OSS_ACCESS_KEY_SECRET', ''),
    bucket: optionalEnv('OSS_BUCKET', 'cherry-studio-enterprise')
  },

  // 飞书告警配置
  feishuAlert: {
    enabled: optionalEnv('FEISHU_ALERT_ENABLED', 'false') === 'true',
    webhookUrl: optionalEnv('FEISHU_ALERT_WEBHOOK', '')
  },

  // JWT 配置
  jwt: {
    secret: optionalEnv('JWT_SECRET', 'your-super-secret-jwt-key-change-in-production'),
    accessTokenExpiresIn: optionalEnv('JWT_ACCESS_TOKEN_EXPIRES_IN', '1h'),
    refreshTokenExpiresIn: optionalEnv('JWT_REFRESH_TOKEN_EXPIRES_IN', '7d')
  },

  // 飞书配置
  feishu: {
    appId: optionalEnv('FEISHU_APP_ID', ''),
    appSecret: optionalEnv('FEISHU_APP_SECRET', ''),
    redirectUri: optionalEnv('FEISHU_REDIRECT_URI', '')
  },

  // 加密配置
  encryption: {
    key: optionalEnv('ENCRYPTION_KEY', 'your-32-character-encryption-key!')
  },

  // 速率限制
  rateLimit: {
    windowMs: parseInt(optionalEnv('RATE_LIMIT_WINDOW_MS', '60000'), 10),
    max: parseInt(optionalEnv('RATE_LIMIT_MAX', '100'), 10)
  },

  // 备份配置
  backup: {
    enabled: optionalEnv('BACKUP_ENABLED', 'true') === 'true',
    schedule: optionalEnv('BACKUP_SCHEDULE', '0 2 * * *'), // 每天凌晨2点
    retentionDays: parseInt(optionalEnv('BACKUP_RETENTION_DAYS', '7'), 10)
  },

  // 日志配置
  logging: {
    level: optionalEnv('LOG_LEVEL', 'info'),
    format: optionalEnv('LOG_FORMAT', 'json')
  },

  // 开发者登录配置 (仅开发环境)
  devLogin: {
    enabled: optionalEnv('NODE_ENV', 'development') === 'development',
    username: optionalEnv('DEV_LOGIN_USERNAME', 'dev'),
    password: optionalEnv('DEV_LOGIN_PASSWORD', 'dev123')
  }
} as const

export type Config = typeof config
