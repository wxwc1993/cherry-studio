import type { Job } from 'bullmq'
import { Queue, Worker } from 'bullmq'
import { eq } from 'drizzle-orm'
import mammoth from 'mammoth'
import OpenAI from 'openai'
import pdfParse from 'pdf-parse'
import { v4 as uuidv4 } from 'uuid'

import { db, kbDocuments } from '../models'
import { createLogger } from '../utils/logger'
import { getStorageService } from './storage'
import type { DocumentChunk } from './vector.service'
import { vectorService } from './vector.service'

const logger = createLogger('DocumentProcessor')

/**
 * 文档处理任务数据
 */
interface ProcessDocumentJob {
  documentId: string
  priority?: 'high' | 'normal' | 'low'
}

/**
 * 分块配置
 */
interface ChunkingConfig {
  chunkSize: number
  overlap: number
  separator?: string
}

const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  chunkSize: 500,
  overlap: 50,
  separator: '\n'
}

/**
 * 文档处理服务
 * 负责文档解析、分块、向量化
 */
class DocumentProcessorService {
  private queue: Queue<ProcessDocumentJob> | null = null
  private worker: Worker<ProcessDocumentJob> | null = null
  private openai: OpenAI | null = null
  private isInitialized = false

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    const redisUrl = process.env.REDIS_URL
    if (!redisUrl) {
      logger.warn('REDIS_URL not set, document processing queue disabled')
      return
    }

    // 解析 Redis URL
    const url = new URL(redisUrl)
    const connection = {
      host: url.hostname,
      port: parseInt(url.port || '6379', 10),
      password: url.password || undefined
    }

    // 初始化队列
    this.queue = new Queue<ProcessDocumentJob>('document-processing', { connection })

    // 初始化 Worker
    this.worker = new Worker<ProcessDocumentJob>(
      'document-processing',
      async (job: Job<ProcessDocumentJob>) => {
        await this.processDocument(job.data.documentId)
      },
      {
        connection,
        concurrency: 2 // 并发处理 2 个文档
      }
    )

    this.worker.on('completed', (job) => {
      logger.info({ documentId: job.data.documentId }, 'Document processing completed')
    })

    this.worker.on('failed', (job, err) => {
      logger.error({ documentId: job?.data.documentId, error: err }, 'Document processing failed')
    })

    // 初始化 OpenAI 客户端
    const openaiKey = process.env.OPENAI_API_KEY
    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey })
    } else {
      logger.warn('OPENAI_API_KEY not set, embedding generation disabled')
    }

    this.isInitialized = true
    logger.info('Document processor service initialized')
  }

  /**
   * 将文档加入处理队列
   */
  async enqueue(documentId: string, priority: 'high' | 'normal' | 'low' = 'normal'): Promise<void> {
    if (!this.queue) {
      logger.warn('Queue not initialized, processing synchronously')
      await this.processDocument(documentId)
      return
    }

    const priorityMap = { high: 1, normal: 5, low: 10 }

    await this.queue.add(
      'process',
      { documentId, priority },
      {
        priority: priorityMap[priority],
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 }
      }
    )

    logger.info({ documentId, priority }, 'Document enqueued for processing')
  }

  /**
   * 处理单个文档
   */
  async processDocument(documentId: string): Promise<void> {
    const startTime = Date.now()

    try {
      // 1. 获取文档信息
      const doc = await db.query.kbDocuments.findFirst({
        where: eq(kbDocuments.id, documentId)
      })

      if (!doc) {
        throw new Error(`Document not found: ${documentId}`)
      }

      // 更新状态为处理中
      await db
        .update(kbDocuments)
        .set({ status: 'processing', updatedAt: new Date() })
        .where(eq(kbDocuments.id, documentId))

      // 2. 从存储下载文件
      const storage = getStorageService()
      const fileBuffer = await storage.download(doc.filePath)

      // 3. 解析文件内容
      const content = await this.parseDocument(fileBuffer, doc.fileType, doc.fileName)

      if (!content || content.trim().length === 0) {
        throw new Error('Document is empty or could not be parsed')
      }

      // 4. 分块
      const chunks = this.chunkText(content)

      if (chunks.length === 0) {
        throw new Error('No chunks generated from document')
      }

      // 5. 生成 Embedding
      const embeddings = await this.generateEmbeddings(chunks)

      // 6. 删除旧分块
      await vectorService.deleteByDocument(documentId)

      // 7. 存储到数据库
      const documentChunks: DocumentChunk[] = chunks.map((chunk, i) => ({
        id: uuidv4(),
        documentId,
        knowledgeBaseId: doc.knowledgeBaseId,
        chunkIndex: i,
        content: chunk,
        embedding: embeddings[i],
        metadata: {
          source: doc.fileName,
          fileType: doc.fileType,
          chunkSize: chunk.length
        }
      }))

      await vectorService.insertChunks(documentChunks)

      // 8. 更新文档和知识库统计
      await vectorService.updateDocumentVectorCount(documentId)
      await vectorService.updateKnowledgeBaseVectorCount(doc.knowledgeBaseId)

      // 9. 更新文档状态为完成
      await db
        .update(kbDocuments)
        .set({
          status: 'indexed',
          vectorCount: chunks.length,
          updatedAt: new Date()
        })
        .where(eq(kbDocuments.id, documentId))

      const duration = Date.now() - startTime
      logger.info({ documentId, chunks: chunks.length, duration }, 'Document processed successfully')
    } catch (error) {
      // 更新状态为失败
      await db
        .update(kbDocuments)
        .set({
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          updatedAt: new Date()
        })
        .where(eq(kbDocuments.id, documentId))

      logger.error({ documentId, error }, 'Document processing failed')
      throw error
    }
  }

  /**
   * 解析文档内容
   */
  private async parseDocument(buffer: Buffer, fileType: string, fileName: string): Promise<string> {
    const type = fileType.toLowerCase()

    switch (type) {
      case 'pdf':
      case 'application/pdf':
        return this.parsePdf(buffer)

      case 'docx':
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return this.parseDocx(buffer)

      case 'doc':
      case 'application/msword':
        // doc 格式暂不支持，可以后续添加
        throw new Error('DOC format not supported, please convert to DOCX')

      case 'txt':
      case 'text/plain':
      case 'md':
      case 'text/markdown':
        return buffer.toString('utf-8')

      case 'json':
      case 'application/json':
        return buffer.toString('utf-8')

      default:
        // 尝试作为文本解析
        logger.warn({ fileType, fileName }, 'Unknown file type, treating as text')
        return buffer.toString('utf-8')
    }
  }

  /**
   * 解析 PDF 文件
   */
  private async parsePdf(buffer: Buffer): Promise<string> {
    const data = await pdfParse(buffer)
    return data.text
  }

  /**
   * 解析 DOCX 文件
   */
  private async parseDocx(buffer: Buffer): Promise<string> {
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  /**
   * 文本分块
   */
  chunkText(text: string, config: ChunkingConfig = DEFAULT_CHUNKING_CONFIG): string[] {
    const { chunkSize, overlap, separator } = config
    const chunks: string[] = []

    // 先按分隔符分割
    const segments = separator ? text.split(separator) : [text]

    let currentChunk = ''

    for (const segment of segments) {
      const segmentWithSeparator = segment + (separator || '')

      if (currentChunk.length + segmentWithSeparator.length <= chunkSize) {
        currentChunk += segmentWithSeparator
      } else {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.trim())
        }

        // 处理长段落
        if (segmentWithSeparator.length > chunkSize) {
          const subChunks = this.splitLongText(segmentWithSeparator, chunkSize, overlap)
          chunks.push(...subChunks.slice(0, -1))
          currentChunk = subChunks[subChunks.length - 1] || ''
        } else {
          // 重叠处理
          if (chunks.length > 0 && overlap > 0) {
            const lastChunk = chunks[chunks.length - 1]
            const overlapText = lastChunk.slice(-overlap)
            currentChunk = overlapText + segmentWithSeparator
          } else {
            currentChunk = segmentWithSeparator
          }
        }
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim())
    }

    return chunks.filter((chunk) => chunk.length > 0)
  }

  /**
   * 分割长文本
   */
  private splitLongText(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = []
    let start = 0

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length)
      chunks.push(text.slice(start, end).trim())
      start = end - overlap

      if (start >= text.length - overlap) break
    }

    return chunks
  }

  /**
   * 生成 Embedding 向量
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized')
    }

    const embeddings: number[][] = []
    const batchSize = 100 // OpenAI 限制

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)

      // 清理文本，移除过长的空白
      const cleanedBatch = batch.map((t) => t.replace(/\s+/g, ' ').trim()).filter((t) => t.length > 0)

      if (cleanedBatch.length === 0) {
        // 为空文本返回零向量
        embeddings.push(...batch.map(() => new Array(1536).fill(0)))
        continue
      }

      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: cleanedBatch
      })

      embeddings.push(...response.data.map((d) => d.embedding))

      // 速率限制
      if (i + batchSize < texts.length) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    return embeddings
  }

  /**
   * 关闭服务
   */
  async shutdown(): Promise<void> {
    if (this.worker) {
      await this.worker.close()
    }
    if (this.queue) {
      await this.queue.close()
    }
    this.isInitialized = false
    logger.info('Document processor service shut down')
  }

  /**
   * 获取队列状态
   */
  async getQueueStatus(): Promise<{ waiting: number; active: number; completed: number; failed: number } | null> {
    if (!this.queue) return null

    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount()
    ])

    return { waiting, active, completed, failed }
  }
}

// 导出单例
export const documentProcessorService = new DocumentProcessorService()
