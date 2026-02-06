import OSS from 'ali-oss'

import { createLogger } from '../../utils/logger'
import type { StorageMetadata, StorageObject, StorageService } from './storage.interface'

const logger = createLogger('AliyunOSSService')

/**
 * 阿里云 OSS 存储服务实现
 */
export class AliyunOSSService implements StorageService {
  private client: OSS
  private bucket: string

  constructor() {
    const region = process.env.OSS_REGION
    const accessKeyId = process.env.OSS_ACCESS_KEY_ID
    const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET
    const bucket = process.env.OSS_BUCKET

    if (!region || !accessKeyId || !accessKeySecret || !bucket) {
      throw new Error(
        'Missing required OSS environment variables: OSS_REGION, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET'
      )
    }

    this.bucket = bucket
    this.client = new OSS({
      region,
      accessKeyId,
      accessKeySecret,
      bucket,
      secure: true,
      timeout: 60000
    })
  }

  async upload(key: string, data: Buffer, contentType: string): Promise<string> {
    try {
      const result = await this.client.put(key, data, {
        headers: {
          'Content-Type': contentType
        }
      })

      logger.info({ key, size: data.length }, 'File uploaded to OSS')
      return result.url
    } catch (error) {
      logger.error({ key, error }, 'Failed to upload file to OSS')
      throw error
    }
  }

  async download(key: string): Promise<Buffer> {
    try {
      const result = await this.client.get(key)
      return result.content as Buffer
    } catch (error) {
      logger.error({ key, error }, 'Failed to download file from OSS')
      throw error
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.delete(key)
      logger.info({ key }, 'File deleted from OSS')
    } catch (error) {
      logger.error({ key, error }, 'Failed to delete file from OSS')
      throw error
    }
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      // OSS signatureUrl expects expires in seconds
      return this.client.signatureUrl(key, { expires: expiresIn })
    } catch (error) {
      logger.error({ key, error }, 'Failed to generate signed URL')
      throw error
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.head(key)
      return true
    } catch (error: any) {
      if (error.code === 'NoSuchKey' || error.status === 404) {
        return false
      }
      throw error
    }
  }

  async list(prefix: string, maxKeys: number = 100): Promise<StorageObject[]> {
    try {
      const result = await this.client.list(
        {
          prefix,
          'max-keys': maxKeys
        },
        {}
      )

      return (result.objects || []).map((obj) => ({
        key: obj.name,
        size: obj.size,
        lastModified: new Date(obj.lastModified),
        etag: obj.etag
      }))
    } catch (error) {
      logger.error({ prefix, error }, 'Failed to list files from OSS')
      throw error
    }
  }

  async copy(sourceKey: string, targetKey: string): Promise<void> {
    try {
      await this.client.copy(targetKey, sourceKey)
      logger.info({ sourceKey, targetKey }, 'File copied in OSS')
    } catch (error) {
      logger.error({ sourceKey, targetKey, error }, 'Failed to copy file in OSS')
      throw error
    }
  }

  async getMetadata(key: string): Promise<StorageMetadata | null> {
    try {
      const result = await this.client.head(key)
      const headers = result.res.headers as Record<string, string>
      const meta = result.meta as Record<string, string | number> | undefined

      // 转换 meta 为 string 类型
      let customMetadata: Record<string, string> | undefined
      if (meta) {
        customMetadata = {}
        for (const [k, v] of Object.entries(meta)) {
          customMetadata[k] = String(v)
        }
      }

      return {
        contentType: headers['content-type'] || 'application/octet-stream',
        contentLength: parseInt(headers['content-length'] || '0', 10),
        lastModified: new Date(headers['last-modified'] || Date.now()),
        etag: headers['etag'],
        customMetadata
      }
    } catch (error: any) {
      if (error.code === 'NoSuchKey' || error.status === 404) {
        return null
      }
      throw error
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.getBucketInfo(this.bucket)
      return true
    } catch (error) {
      logger.error({ error }, 'OSS health check failed')
      return false
    }
  }
}
