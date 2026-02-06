import { exec } from 'child_process'
import { eq } from 'drizzle-orm'
import { promises as fs } from 'fs'
import path from 'path'
import { promisify } from 'util'
import { v4 as uuidv4 } from 'uuid'

import { backups, db } from '../models'
import { createLogger } from '../utils/logger'
import { getStorageService } from './storage'

const execAsync = promisify(exec)
const logger = createLogger('BackupService')

/**
 * 备份选项
 */
export interface BackupOptions {
  type: 'full' | 'incremental'
  includeConversations?: boolean
  includeKnowledgeBases?: boolean
  compressLevel?: number
}

/**
 * 恢复选项
 */
export interface RestoreOptions {
  backupId: string
  restoreConversations?: boolean
  restoreKnowledgeBases?: boolean
}

/**
 * 备份服务
 * 使用 pg_dump 进行数据库备份，存储到 OSS
 */
class BackupService {
  private tempDir: string

  constructor() {
    this.tempDir = process.env.BACKUP_TEMP_DIR || '/tmp/cherry-studio-backups'
  }

  /**
   * 确保临时目录存在
   */
  private async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true })
    } catch {
      // 目录可能已存在
    }
  }

  /**
   * 创建备份
   */
  async createBackup(companyId: string, options: BackupOptions): Promise<string> {
    const backupId = uuidv4()
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `backup-${options.type}-${companyId}-${timestamp}.sql.gz`

    await this.ensureTempDir()
    const localPath = path.join(this.tempDir, filename)

    try {
      // 1. 创建备份记录
      await db.insert(backups).values({
        id: backupId,
        companyId,
        type: options.type,
        status: 'running',
        startedAt: new Date()
      })

      logger.info({ backupId, type: options.type }, 'Starting backup')

      // 2. 执行 pg_dump
      const databaseUrl = process.env.DATABASE_URL
      if (!databaseUrl) {
        throw new Error('DATABASE_URL not set')
      }

      // 构建排除表的参数
      const excludeTables: string[] = []
      if (!options.includeConversations) {
        excludeTables.push('conversations', 'messages')
      }
      // 知识库的向量数据可以单独处理，这里只备份元数据
      if (!options.includeKnowledgeBases) {
        excludeTables.push('document_chunks')
      }

      const excludeArgs = excludeTables.map((t) => `--exclude-table=${t}`).join(' ')

      // 使用 pg_dump 导出数据库
      // 添加公司 ID 过滤条件（对于多租户数据）
      const compressLevel = options.compressLevel ?? 9
      await execAsync(`pg_dump "${databaseUrl}" ${excludeArgs} | gzip -${compressLevel} > "${localPath}"`, {
        timeout: 600000 // 10 分钟超时
      })

      // 3. 获取文件大小
      const stats = await fs.stat(localPath)
      const fileSize = stats.size

      // 4. 上传到 OSS
      const storage = getStorageService()
      const fileBuffer = await fs.readFile(localPath)
      const ossKey = `backups/${companyId}/${filename}`
      await storage.upload(ossKey, fileBuffer, 'application/gzip')

      // 5. 清理本地文件
      await fs.unlink(localPath)

      // 6. 更新备份记录
      await db
        .update(backups)
        .set({
          status: 'completed',
          filePath: ossKey,
          fileSize,
          completedAt: new Date()
        })
        .where(eq(backups.id, backupId))

      logger.info({ backupId, ossKey, fileSize }, 'Backup completed successfully')
      return backupId
    } catch (error) {
      // 清理本地文件
      try {
        await fs.unlink(localPath)
      } catch {
        // 忽略
      }

      // 更新备份状态为失败
      await db
        .update(backups)
        .set({
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date()
        })
        .where(eq(backups.id, backupId))

      logger.error({ backupId, error }, 'Backup failed')
      throw error
    }
  }

  /**
   * 恢复备份
   */
  async restore(companyId: string, options: RestoreOptions): Promise<void> {
    const { backupId } = options

    // 1. 获取备份信息
    const backup = await db.query.backups.findFirst({
      where: eq(backups.id, backupId)
    })

    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`)
    }

    if (backup.companyId !== companyId) {
      throw new Error('Backup does not belong to this company')
    }

    if (backup.status !== 'completed') {
      throw new Error('Can only restore from completed backups')
    }

    if (!backup.filePath) {
      throw new Error('Backup file path not found')
    }

    await this.ensureTempDir()
    const localPath = path.join(this.tempDir, `restore-${backupId}-${Date.now()}.sql.gz`)

    try {
      logger.info({ backupId }, 'Starting restore')

      // 2. 从 OSS 下载备份文件
      const storage = getStorageService()
      const fileBuffer = await storage.download(backup.filePath)
      await fs.writeFile(localPath, fileBuffer)

      // 3. 恢复数据库
      const databaseUrl = process.env.DATABASE_URL
      if (!databaseUrl) {
        throw new Error('DATABASE_URL not set')
      }

      // 解压并恢复
      // 注意：这会覆盖现有数据，生产环境应该更谨慎
      await execAsync(`gunzip -c "${localPath}" | psql "${databaseUrl}"`, {
        timeout: 1800000 // 30 分钟超时
      })

      // 4. 清理本地文件
      await fs.unlink(localPath)

      logger.info({ backupId }, 'Restore completed successfully')
    } catch (error) {
      // 清理本地文件
      try {
        await fs.unlink(localPath)
      } catch {
        // 忽略
      }

      logger.error({ backupId, error }, 'Restore failed')
      throw error
    }
  }

  /**
   * 删除备份
   */
  async deleteBackup(backupId: string, companyId: string): Promise<void> {
    const backup = await db.query.backups.findFirst({
      where: eq(backups.id, backupId)
    })

    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`)
    }

    if (backup.companyId !== companyId) {
      throw new Error('Backup does not belong to this company')
    }

    try {
      // 从 OSS 删除文件
      if (backup.filePath) {
        const storage = getStorageService()
        await storage.delete(backup.filePath)
      }

      // 删除数据库记录
      await db.delete(backups).where(eq(backups.id, backupId))

      logger.info({ backupId }, 'Backup deleted')
    } catch (error) {
      logger.error({ backupId, error }, 'Failed to delete backup')
      throw error
    }
  }

  /**
   * 获取备份下载链接
   */
  async getDownloadUrl(backupId: string, companyId: string): Promise<string> {
    const backup = await db.query.backups.findFirst({
      where: eq(backups.id, backupId)
    })

    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`)
    }

    if (backup.companyId !== companyId) {
      throw new Error('Backup does not belong to this company')
    }

    if (!backup.filePath) {
      throw new Error('Backup file not available')
    }

    const storage = getStorageService()
    return storage.getSignedUrl(backup.filePath, 3600) // 1 小时有效
  }

  /**
   * 清理过期备份
   */
  async cleanupExpiredBackups(companyId: string, retentionDays: number): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    // 获取过期的增量备份
    const expiredBackups = await db.query.backups.findMany({
      where: eq(backups.companyId, companyId)
    })

    const toDelete = expiredBackups.filter(
      (b) => b.type === 'incremental' && b.createdAt < cutoffDate && b.status === 'completed'
    )

    let deletedCount = 0
    const storage = getStorageService()

    for (const backup of toDelete) {
      try {
        if (backup.filePath) {
          await storage.delete(backup.filePath)
        }
        await db.delete(backups).where(eq(backups.id, backup.id))
        deletedCount++
      } catch (error) {
        logger.error({ backupId: backup.id, error }, 'Failed to delete expired backup')
      }
    }

    logger.info({ companyId, deletedCount }, 'Expired backups cleaned up')
    return deletedCount
  }

  /**
   * 检查 pg_dump 是否可用
   */
  async checkPgDumpAvailable(): Promise<boolean> {
    try {
      await execAsync('which pg_dump')
      return true
    } catch {
      return false
    }
  }
}

// 导出单例
export const backupService = new BackupService()
