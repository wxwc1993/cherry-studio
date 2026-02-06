import {eq, sql } from 'drizzle-orm'

import { db, documentChunks, kbDocuments,knowledgeBases } from '../models'
import { createLogger } from '../utils/logger'

const logger = createLogger('VectorService')

/**
 * 文档分块数据
 */
export interface DocumentChunk {
  id: string
  documentId: string
  knowledgeBaseId: string
  chunkIndex: number
  content: string
  embedding: number[]
  metadata?: Record<string, unknown>
}

/**
 * 向量搜索结果
 */
export interface SearchResult {
  id: string
  documentId: string
  chunkIndex: number
  content: string
  metadata: Record<string, unknown> | null
  score: number
}

/**
 * 向量服务 - 基于 pgvector 的向量检索
 */
class VectorService {
  /**
   * 插入文档分块及其向量
   */
  async insertChunks(chunks: DocumentChunk[]): Promise<void> {
    if (chunks.length === 0) return

    try {
      // 批量插入，每批 100 条
      const batchSize = 100
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize)
        await db.insert(documentChunks).values(
          batch.map((chunk) => ({
            id: chunk.id,
            documentId: chunk.documentId,
            knowledgeBaseId: chunk.knowledgeBaseId,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            embedding: chunk.embedding,
            metadata: chunk.metadata || {}
          }))
        )
      }

      logger.info({ count: chunks.length }, 'Document chunks inserted')
    } catch (error) {
      logger.error({ error }, 'Failed to insert document chunks')
      throw error
    }
  }

  /**
   * 向量相似度搜索
   * @param knowledgeBaseId 知识库 ID
   * @param queryEmbedding 查询向量
   * @param topK 返回结果数量
   * @param minScore 最小相似度分数（0-1）
   */
  async search(
    knowledgeBaseId: string,
    queryEmbedding: number[],
    topK: number = 5,
    minScore: number = 0.7
  ): Promise<SearchResult[]> {
    try {
      const embeddingStr = `[${queryEmbedding.join(',')}]`

      // 使用余弦距离进行相似度搜索
      // 1 - (embedding <=> query) 转换距离为相似度分数
      const results = await db.execute(sql`
        SELECT
          id,
          document_id as "documentId",
          chunk_index as "chunkIndex",
          content,
          metadata,
          1 - (embedding <=> ${embeddingStr}::vector) as score
        FROM document_chunks
        WHERE knowledge_base_id = ${knowledgeBaseId}
          AND embedding IS NOT NULL
          AND 1 - (embedding <=> ${embeddingStr}::vector) >= ${minScore}
        ORDER BY embedding <=> ${embeddingStr}::vector
        LIMIT ${topK}
      `)

      return results.rows as unknown as SearchResult[]
    } catch (error) {
      logger.error({ knowledgeBaseId, error }, 'Vector search failed')
      throw error
    }
  }

  /**
   * 在多个知识库中搜索
   */
  async searchMultiple(
    knowledgeBaseIds: string[],
    queryEmbedding: number[],
    topK: number = 5,
    minScore: number = 0.7
  ): Promise<SearchResult[]> {
    if (knowledgeBaseIds.length === 0) return []

    try {
      const embeddingStr = `[${queryEmbedding.join(',')}]`
      const kbIdsStr = knowledgeBaseIds.map((id) => `'${id}'`).join(',')

      const results = await db.execute(sql`
        SELECT
          id,
          document_id as "documentId",
          chunk_index as "chunkIndex",
          content,
          metadata,
          1 - (embedding <=> ${embeddingStr}::vector) as score
        FROM document_chunks
        WHERE knowledge_base_id IN (${sql.raw(kbIdsStr)})
          AND embedding IS NOT NULL
          AND 1 - (embedding <=> ${embeddingStr}::vector) >= ${minScore}
        ORDER BY embedding <=> ${embeddingStr}::vector
        LIMIT ${topK}
      `)

      return results.rows as unknown as SearchResult[]
    } catch (error) {
      logger.error({ knowledgeBaseIds, error }, 'Multi-KB vector search failed')
      throw error
    }
  }

  /**
   * 删除文档的所有分块
   */
  async deleteByDocument(documentId: string): Promise<void> {
    try {
      await db.delete(documentChunks).where(eq(documentChunks.documentId, documentId))

      logger.info({ documentId }, 'Document chunks deleted')
    } catch (error) {
      logger.error({ documentId, error }, 'Failed to delete document chunks')
      throw error
    }
  }

  /**
   * 删除知识库的所有分块
   */
  async deleteByKnowledgeBase(knowledgeBaseId: string): Promise<void> {
    try {
      await db.delete(documentChunks).where(eq(documentChunks.knowledgeBaseId, knowledgeBaseId))

      logger.info({ knowledgeBaseId }, 'Knowledge base chunks deleted')
    } catch (error) {
      logger.error({ knowledgeBaseId, error }, 'Failed to delete knowledge base chunks')
      throw error
    }
  }

  /**
   * 获取文档的分块数量
   */
  async getChunkCount(documentId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(documentChunks)
      .where(eq(documentChunks.documentId, documentId))

    return Number(result[0]?.count || 0)
  }

  /**
   * 获取知识库的总分块数量
   */
  async getKnowledgeBaseChunkCount(knowledgeBaseId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(documentChunks)
      .where(eq(documentChunks.knowledgeBaseId, knowledgeBaseId))

    return Number(result[0]?.count || 0)
  }

  /**
   * 更新知识库的向量计数
   */
  async updateKnowledgeBaseVectorCount(knowledgeBaseId: string): Promise<void> {
    const count = await this.getKnowledgeBaseChunkCount(knowledgeBaseId)

    await db
      .update(knowledgeBases)
      .set({
        vectorCount: count,
        updatedAt: new Date()
      })
      .where(eq(knowledgeBases.id, knowledgeBaseId))
  }

  /**
   * 更新文档的向量计数
   */
  async updateDocumentVectorCount(documentId: string): Promise<void> {
    const count = await this.getChunkCount(documentId)

    await db
      .update(kbDocuments)
      .set({
        vectorCount: count,
        updatedAt: new Date()
      })
      .where(eq(kbDocuments.id, documentId))
  }
}

// 导出单例
export const vectorService = new VectorService()
