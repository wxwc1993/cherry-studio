import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'

import { config } from '../config'
import { createLogger } from '../utils/logger'
import * as schema from './schema'

const logger = createLogger('Database')

const pool = new pg.Pool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
  ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
  max: config.database.poolSize
})

pool.on('error', (err) => {
  logger.error({ err }, 'Database pool error')
})

export const db = drizzle(pool, { schema, logger: true })

export async function testConnection(): Promise<boolean> {
  try {
    const client = await pool.connect()
    await client.query('SELECT 1')
    client.release()
    logger.info('Database connection successful')
    return true
  } catch (err) {
    logger.error({ err }, 'Database connection failed')
    return false
  }
}

export async function closeConnection(): Promise<void> {
  await pool.end()
  logger.info('Database connection closed')
}
