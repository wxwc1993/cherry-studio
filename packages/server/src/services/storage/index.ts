import { createLogger } from '../../utils/logger'
import { AliyunOSSService } from './aliyun-oss.service'
import type { StorageService } from './storage.interface'

export { AliyunOSSService } from './aliyun-oss.service'
export * from './storage.interface'

const logger = createLogger('StorageFactory')

let storageServiceInstance: StorageService | null = null

/**
 * 获取存储服务单例
 * 根据环境变量自动选择存储后端
 */
export function getStorageService(): StorageService {
  if (storageServiceInstance) {
    return storageServiceInstance
  }

  const storageType = process.env.STORAGE_TYPE || 'aliyun-oss'

  switch (storageType) {
    case 'aliyun-oss':
      logger.info('Initializing Aliyun OSS storage service')
      storageServiceInstance = new AliyunOSSService()
      break
    // 可以在这里添加其他存储后端（如本地存储）
    default:
      throw new Error(`Unsupported storage type: ${storageType}`)
  }

  return storageServiceInstance
}

/**
 * 重置存储服务实例（用于测试）
 */
export function resetStorageService(): void {
  storageServiceInstance = null
}
