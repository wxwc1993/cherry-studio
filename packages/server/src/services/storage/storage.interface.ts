/**
 * 存储服务接口
 * 抽象层用于支持多种存储后端（阿里云 OSS、MinIO 等）
 */
export interface StorageService {
  /**
   * 上传文件
   * @param key 文件路径/键名
   * @param data 文件数据
   * @param contentType MIME 类型
   * @returns 文件访问 URL
   */
  upload(key: string, data: Buffer, contentType: string): Promise<string>

  /**
   * 下载文件
   * @param key 文件路径/键名
   * @returns 文件数据
   */
  download(key: string): Promise<Buffer>

  /**
   * 删除文件
   * @param key 文件路径/键名
   */
  delete(key: string): Promise<void>

  /**
   * 获取签名 URL（用于临时访问）
   * @param key 文件路径/键名
   * @param expiresIn 过期时间（秒），默认 3600
   * @returns 签名 URL
   */
  getSignedUrl(key: string, expiresIn?: number): Promise<string>

  /**
   * 检查文件是否存在
   * @param key 文件路径/键名
   */
  exists(key: string): Promise<boolean>

  /**
   * 列出指定前缀下的文件
   * @param prefix 路径前缀
   * @param maxKeys 最大返回数量
   */
  list(prefix: string, maxKeys?: number): Promise<StorageObject[]>

  /**
   * 复制文件
   * @param sourceKey 源文件路径
   * @param targetKey 目标文件路径
   */
  copy(sourceKey: string, targetKey: string): Promise<void>

  /**
   * 获取文件元信息
   * @param key 文件路径/键名
   */
  getMetadata(key: string): Promise<StorageMetadata | null>

  /**
   * 健康检查
   */
  healthCheck(): Promise<boolean>
}

/**
 * 存储对象信息
 */
export interface StorageObject {
  key: string
  size: number
  lastModified: Date
  etag?: string
}

/**
 * 存储元信息
 */
export interface StorageMetadata {
  contentType: string
  contentLength: number
  lastModified: Date
  etag?: string
  customMetadata?: Record<string, string>
}

/**
 * 存储配置
 */
export interface StorageConfig {
  type: 'aliyun-oss' | 'local'
  region?: string
  accessKeyId?: string
  accessKeySecret?: string
  bucket?: string
  endpoint?: string
  basePath?: string
}
