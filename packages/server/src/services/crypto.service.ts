import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

/**
 * 加密服务 - 使用 AES-256-GCM 算法加密敏感数据
 * 主要用于 API Key 等敏感信息的加密存储
 */
class CryptoService {
  private readonly algorithm = 'aes-256-gcm'
  private readonly keyLength = 32
  private readonly ivLength = 16
  private readonly tagLength = 16
  private readonly salt = 'cherry-studio-enterprise'
  private masterKey: Buffer | null = null

  /**
   * 获取主密钥（延迟初始化）
   */
  private getMasterKey(): Buffer {
    if (this.masterKey) {
      return this.masterKey
    }

    const key = process.env.ENCRYPTION_KEY
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is not set')
    }

    if (key.length < 16) {
      throw new Error('ENCRYPTION_KEY must be at least 16 characters long')
    }

    this.masterKey = scryptSync(key, this.salt, this.keyLength)
    return this.masterKey
  }

  /**
   * 加密字符串
   * @param plaintext 明文
   * @returns 加密后的 Base64 字符串（格式: iv + encrypted + tag）
   */
  encrypt(plaintext: string): string {
    if (!plaintext) {
      return plaintext
    }

    const iv = randomBytes(this.ivLength)
    const cipher = createCipheriv(this.algorithm, this.getMasterKey(), iv)

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()

    // 格式: base64(iv + encrypted + tag)
    return Buffer.concat([iv, encrypted, tag]).toString('base64')
  }

  /**
   * 解密字符串
   * @param ciphertext Base64 编码的密文
   * @returns 解密后的明文
   */
  decrypt(ciphertext: string): string {
    if (!ciphertext) {
      return ciphertext
    }

    try {
      const data = Buffer.from(ciphertext, 'base64')

      if (data.length < this.ivLength + this.tagLength) {
        throw new Error('Invalid ciphertext: too short')
      }

      const iv = data.subarray(0, this.ivLength)
      const tag = data.subarray(-this.tagLength)
      const encrypted = data.subarray(this.ivLength, -this.tagLength)

      const decipher = createDecipheriv(this.algorithm, this.getMasterKey(), iv)
      decipher.setAuthTag(tag)

      return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8')
    } catch (error) {
      // 如果解密失败，可能是明文数据（向后兼容）
      // 检查是否是有效的 Base64 编码数据
      if (!this.isValidCiphertext(ciphertext)) {
        return ciphertext // 返回原始值（可能是未加密的旧数据）
      }
      throw error
    }
  }

  /**
   * 检查是否是有效的加密文本
   */
  private isValidCiphertext(text: string): boolean {
    try {
      const data = Buffer.from(text, 'base64')
      return data.length >= this.ivLength + this.tagLength
    } catch {
      return false
    }
  }

  /**
   * 检查文本是否已加密
   * 通过尝试解密来判断
   */
  isEncrypted(text: string): boolean {
    if (!text) return false

    try {
      const data = Buffer.from(text, 'base64')
      if (data.length < this.ivLength + this.tagLength) {
        return false
      }

      // 尝试解密
      this.decrypt(text)
      return true
    } catch {
      return false
    }
  }

  /**
   * 如果未加密则加密，已加密则直接返回
   */
  encryptIfNeeded(text: string): string {
    if (!text) return text
    if (this.isEncrypted(text)) return text
    return this.encrypt(text)
  }

  /**
   * 清除缓存的主密钥（用于测试或密钥轮换）
   */
  clearMasterKey(): void {
    this.masterKey = null
  }
}

// 导出单例实例
export const cryptoService = new CryptoService()
