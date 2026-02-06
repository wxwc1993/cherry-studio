import {
  calculateOffset,
  createKnowledgeBaseSchema,
  createPagination,
  createSuccessResponse,
  FILE_LIMITS,
  isValidFileExtension,
  paginationParamsSchema,
  sanitizeFilename,
  searchKnowledgeBaseSchema,
  updateKnowledgeBaseSchema
} from '@cherry-studio/enterprise-shared'
import { and, desc, eq, sql } from 'drizzle-orm'
import { Router } from 'express'
import multer from 'multer'
import OpenAI from 'openai'

import { authenticate, requirePermission } from '../middleware/auth'
import { AuthorizationError, NotFoundError, ValidationError } from '../middleware/errorHandler'
import { uploadLimiter } from '../middleware/rate-limit.middleware'
import { validate } from '../middleware/validate'
import { db, kbDocuments, kbPermissions, knowledgeBases } from '../models'
import { documentProcessorService } from '../services/document-processor.service'
import { getStorageService } from '../services/storage'
import { vectorService } from '../services/vector.service'
import { createLogger } from '../utils/logger'

const router = Router()
const logger = createLogger('KnowledgeBaseRoutes')

// 初始化 OpenAI 客户端用于生成查询向量
let openaiClient: OpenAI | null = null
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not set')
    }
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}

/**
 * 生成查询向量
 */
async function generateQueryEmbedding(query: string): Promise<number[]> {
  const openai = getOpenAIClient()
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: query.trim()
  })
  return response.data[0].embedding
}

// 文件上传配置
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: FILE_LIMITS.MAX_FILE_SIZE
  },
  fileFilter: (req, file, cb) => {
    if (!isValidFileExtension(file.originalname, FILE_LIMITS.ALLOWED_EXTENSIONS)) {
      cb(new ValidationError('Unsupported file type'))
      return
    }
    cb(null, true)
  }
})

router.use(authenticate)

/**
 * 检查知识库访问权限
 */
async function checkKBAccess(
  kb: any,
  userId: string,
  departmentId: string,
  roleId: string,
  requiredLevel: 'viewer' | 'editor' | 'admin' = 'viewer'
): Promise<boolean> {
  // 所有者有完全权限
  if (kb.ownerId === userId) return true

  const levelOrder = { viewer: 1, editor: 2, admin: 3 }
  const requiredLevelNum = levelOrder[requiredLevel]

  // 检查可见性
  if (kb.visibility === 'company' && requiredLevelNum <= 1) return true
  if (kb.visibility === 'department' && kb.ownerDepartmentId === departmentId && requiredLevelNum <= 1) return true

  // 检查权限表
  const permissions = await db.query.kbPermissions.findMany({
    where: eq(kbPermissions.knowledgeBaseId, kb.id)
  })

  for (const perm of permissions) {
    const permLevelNum = levelOrder[perm.level as keyof typeof levelOrder]
    if (permLevelNum >= requiredLevelNum) {
      if (perm.targetType === 'user' && perm.targetId === userId) return true
      if (perm.targetType === 'department' && perm.targetId === departmentId) return true
      if (perm.targetType === 'role' && perm.targetId === roleId) return true
    }
  }

  return false
}

/**
 * 获取知识库列表
 * GET /knowledge-bases
 */
router.get('/', validate(paginationParamsSchema, 'query'), async (req, res, next) => {
  try {
    const params = req.query as any
    const offset = calculateOffset(params)

    // 获取用户有权限访问的知识库
    const allKBs = await db.query.knowledgeBases.findMany({
      where: eq(knowledgeBases.companyId, req.user!.companyId),
      with: {
        owner: { columns: { id: true, name: true } }
      },
      orderBy: desc(knowledgeBases.createdAt)
    })

    const accessibleKBs = []
    for (const kb of allKBs) {
      const hasAccess = await checkKBAccess(kb, req.user!.sub, req.user!.departmentId, req.user!.roleId)
      if (hasAccess) {
        accessibleKBs.push({
          id: kb.id,
          name: kb.name,
          description: kb.description,
          visibility: kb.visibility,
          documentCount: kb.documentCount,
          vectorCount: kb.vectorCount,
          status: kb.status,
          owner: kb.owner,
          createdAt: kb.createdAt
        })
      }
    }

    // 手动分页
    const paginatedKBs = accessibleKBs.slice(offset, offset + params.pageSize)

    res.json(createSuccessResponse(paginatedKBs, createPagination(accessibleKBs.length, params)))
  } catch (err) {
    next(err)
  }
})

/**
 * 获取单个知识库
 * GET /knowledge-bases/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const kb = await db.query.knowledgeBases.findFirst({
      where: and(eq(knowledgeBases.id, req.params.id), eq(knowledgeBases.companyId, req.user!.companyId)),
      with: {
        owner: { columns: { id: true, name: true, email: true } }
      }
    })

    if (!kb) {
      throw new NotFoundError('Knowledge base')
    }

    const hasAccess = await checkKBAccess(kb, req.user!.sub, req.user!.departmentId, req.user!.roleId)
    if (!hasAccess) {
      throw new AuthorizationError('No access to this knowledge base')
    }

    res.json(
      createSuccessResponse({
        id: kb.id,
        name: kb.name,
        description: kb.description,
        visibility: kb.visibility,
        config: kb.config,
        documentCount: kb.documentCount,
        vectorCount: kb.vectorCount,
        status: kb.status,
        owner: kb.owner,
        createdAt: kb.createdAt,
        updatedAt: kb.updatedAt
      })
    )
  } catch (err) {
    next(err)
  }
})

/**
 * 创建知识库
 * POST /knowledge-bases
 */
router.post(
  '/',
  requirePermission('knowledgeBases', 'write'),
  validate(createKnowledgeBaseSchema),
  async (req, res, next) => {
    try {
      const data = req.body

      const [newKB] = await db
        .insert(knowledgeBases)
        .values({
          companyId: req.user!.companyId,
          name: data.name,
          description: data.description,
          ownerDepartmentId: req.user!.departmentId,
          ownerId: req.user!.sub,
          visibility: data.visibility,
          config: data.config || {
            embeddingModel: 'text-embedding-ada-002',
            chunkSize: 1000,
            chunkOverlap: 200,
            maxResults: 10,
            scoreThreshold: 0.7
          }
        })
        .returning()

      logger.info({ kbId: newKB.id, createdBy: req.user!.sub }, 'Knowledge base created')

      res.status(201).json(createSuccessResponse(newKB))
    } catch (err) {
      next(err)
    }
  }
)

/**
 * 更新知识库
 * PATCH /knowledge-bases/:id
 */
router.patch('/:id', validate(updateKnowledgeBaseSchema), async (req, res, next) => {
  try {
    const data = req.body

    const kb = await db.query.knowledgeBases.findFirst({
      where: and(eq(knowledgeBases.id, req.params.id), eq(knowledgeBases.companyId, req.user!.companyId))
    })

    if (!kb) {
      throw new NotFoundError('Knowledge base')
    }

    const hasAccess = await checkKBAccess(kb, req.user!.sub, req.user!.departmentId, req.user!.roleId, 'admin')
    if (!hasAccess) {
      throw new AuthorizationError('No permission to edit this knowledge base')
    }

    const [updated] = await db
      .update(knowledgeBases)
      .set({
        ...data,
        config: data.config ? { ...(kb.config as object), ...data.config } : kb.config,
        updatedAt: new Date()
      })
      .where(eq(knowledgeBases.id, req.params.id))
      .returning()

    logger.info({ kbId: updated.id, updatedBy: req.user!.sub }, 'Knowledge base updated')

    res.json(createSuccessResponse(updated))
  } catch (err) {
    next(err)
  }
})

/**
 * 删除知识库
 * DELETE /knowledge-bases/:id
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const kb = await db.query.knowledgeBases.findFirst({
      where: and(eq(knowledgeBases.id, req.params.id), eq(knowledgeBases.companyId, req.user!.companyId))
    })

    if (!kb) {
      throw new NotFoundError('Knowledge base')
    }

    // 只有所有者或管理员可以删除
    if (kb.ownerId !== req.user!.sub) {
      const hasAdminPerm = req.user!.permissions.knowledgeBases.includes('admin')
      if (!hasAdminPerm) {
        throw new AuthorizationError('Only owner or admin can delete knowledge base')
      }
    }

    // 删除存储中的文件
    try {
      const storage = getStorageService()
      const docs = await db.query.kbDocuments.findMany({
        where: eq(kbDocuments.knowledgeBaseId, kb.id)
      })
      for (const doc of docs) {
        try {
          await storage.delete(doc.filePath)
        } catch (err) {
          logger.warn({ docId: doc.id, filePath: doc.filePath, err }, 'Failed to delete document file')
        }
      }
    } catch (err) {
      logger.warn({ kbId: kb.id, err }, 'Failed to delete knowledge base files from storage')
    }

    // 删除向量数据（级联删除会自动处理 document_chunks）
    try {
      await vectorService.deleteByKnowledgeBase(kb.id)
    } catch (err) {
      logger.warn({ kbId: kb.id, err }, 'Failed to delete knowledge base vectors')
    }

    await db.delete(knowledgeBases).where(eq(knowledgeBases.id, req.params.id))

    logger.info({ kbId: req.params.id, deletedBy: req.user!.sub }, 'Knowledge base deleted')

    res.json(createSuccessResponse({ message: 'Knowledge base deleted successfully' }))
  } catch (err) {
    next(err)
  }
})

/**
 * 获取知识库文档列表
 * GET /knowledge-bases/:id/documents
 */
router.get('/:id/documents', validate(paginationParamsSchema, 'query'), async (req, res, next) => {
  try {
    const params = req.query as any
    const offset = calculateOffset(params)

    const kb = await db.query.knowledgeBases.findFirst({
      where: and(eq(knowledgeBases.id, req.params.id), eq(knowledgeBases.companyId, req.user!.companyId))
    })

    if (!kb) {
      throw new NotFoundError('Knowledge base')
    }

    const hasAccess = await checkKBAccess(kb, req.user!.sub, req.user!.departmentId, req.user!.roleId)
    if (!hasAccess) {
      throw new AuthorizationError('No access to this knowledge base')
    }

    const [docs, countResult] = await Promise.all([
      db.query.kbDocuments.findMany({
        where: eq(kbDocuments.knowledgeBaseId, req.params.id),
        with: {
          uploader: { columns: { id: true, name: true } }
        },
        limit: params.pageSize,
        offset,
        orderBy: desc(kbDocuments.createdAt)
      }),
      db
        .select({ count: sql<number>`count(*)` })
        .from(kbDocuments)
        .where(eq(kbDocuments.knowledgeBaseId, req.params.id))
    ])

    res.json(
      createSuccessResponse(
        docs.map((d) => ({
          id: d.id,
          fileName: d.fileName,
          fileType: d.fileType,
          fileSize: d.fileSize,
          status: d.status,
          vectorCount: d.vectorCount,
          errorMessage: d.errorMessage,
          uploader: d.uploader,
          createdAt: d.createdAt
        })),
        createPagination(Number(countResult[0].count), params)
      )
    )
  } catch (err) {
    next(err)
  }
})

/**
 * 上传文档到知识库
 * POST /knowledge-bases/:id/documents
 */
router.post('/:id/documents', uploadLimiter, upload.array('files', 10), async (req, res, next) => {
  try {
    const kb = await db.query.knowledgeBases.findFirst({
      where: and(eq(knowledgeBases.id, req.params.id), eq(knowledgeBases.companyId, req.user!.companyId))
    })

    if (!kb) {
      throw new NotFoundError('Knowledge base')
    }

    const hasAccess = await checkKBAccess(kb, req.user!.sub, req.user!.departmentId, req.user!.roleId, 'editor')
    if (!hasAccess) {
      throw new AuthorizationError('No permission to upload to this knowledge base')
    }

    const files = req.files as Express.Multer.File[]
    if (!files || files.length === 0) {
      throw new ValidationError('No files uploaded')
    }

    const uploadedDocs = []

    const storage = getStorageService()

    for (const file of files) {
      const fileName = sanitizeFilename(file.originalname)
      const fileType = fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase()
      const filePath = `knowledge-bases/${kb.id}/${Date.now()}-${fileName}`

      // 上传到存储服务
      await storage.upload(filePath, file.buffer, file.mimetype)

      const [doc] = await db
        .insert(kbDocuments)
        .values({
          knowledgeBaseId: kb.id,
          fileName,
          fileType,
          fileSize: file.size,
          filePath,
          uploaderId: req.user!.sub,
          status: 'pending'
        })
        .returning()

      uploadedDocs.push(doc)

      // 启动异步处理任务（文档解析、向量化）
      try {
        await documentProcessorService.enqueue(doc.id, 'normal')
        logger.info({ docId: doc.id, kbId: kb.id }, 'Document uploaded and enqueued for processing')
      } catch (err) {
        logger.warn({ docId: doc.id, err }, 'Failed to enqueue document, will process later')
      }
    }

    // 更新知识库文档数
    await db
      .update(knowledgeBases)
      .set({
        documentCount: sql`document_count + ${files.length}`,
        updatedAt: new Date()
      })
      .where(eq(knowledgeBases.id, kb.id))

    res.status(201).json(
      createSuccessResponse(
        uploadedDocs.map((d) => ({
          id: d.id,
          fileName: d.fileName,
          status: d.status
        }))
      )
    )
  } catch (err) {
    next(err)
  }
})

/**
 * 删除文档
 * DELETE /knowledge-bases/:kbId/documents/:docId
 */
router.delete('/:kbId/documents/:docId', async (req, res, next) => {
  try {
    const kb = await db.query.knowledgeBases.findFirst({
      where: and(eq(knowledgeBases.id, req.params.kbId), eq(knowledgeBases.companyId, req.user!.companyId))
    })

    if (!kb) {
      throw new NotFoundError('Knowledge base')
    }

    const hasAccess = await checkKBAccess(kb, req.user!.sub, req.user!.departmentId, req.user!.roleId, 'editor')
    if (!hasAccess) {
      throw new AuthorizationError('No permission to delete documents')
    }

    const doc = await db.query.kbDocuments.findFirst({
      where: and(eq(kbDocuments.id, req.params.docId), eq(kbDocuments.knowledgeBaseId, req.params.kbId))
    })

    if (!doc) {
      throw new NotFoundError('Document')
    }

    // 从存储删除文件
    try {
      const storage = getStorageService()
      await storage.delete(doc.filePath)
    } catch (err) {
      logger.warn({ docId: doc.id, filePath: doc.filePath, err }, 'Failed to delete document file from storage')
    }

    // 删除向量数据
    try {
      await vectorService.deleteByDocument(doc.id)
    } catch (err) {
      logger.warn({ docId: doc.id, err }, 'Failed to delete document vectors')
    }

    await db.delete(kbDocuments).where(eq(kbDocuments.id, req.params.docId))

    // 更新知识库计数
    await db
      .update(knowledgeBases)
      .set({
        documentCount: sql`document_count - 1`,
        vectorCount: sql`vector_count - ${doc.vectorCount}`,
        updatedAt: new Date()
      })
      .where(eq(knowledgeBases.id, kb.id))

    logger.info({ docId: req.params.docId, kbId: kb.id, deletedBy: req.user!.sub }, 'Document deleted')

    res.json(createSuccessResponse({ message: 'Document deleted successfully' }))
  } catch (err) {
    next(err)
  }
})

/**
 * 知识库检索
 * POST /knowledge-bases/:id/search
 */
router.post('/:id/search', validate(searchKnowledgeBaseSchema), async (req, res, next) => {
  try {
    const { query, topK, scoreThreshold } = req.body

    const kb = await db.query.knowledgeBases.findFirst({
      where: and(eq(knowledgeBases.id, req.params.id), eq(knowledgeBases.companyId, req.user!.companyId))
    })

    if (!kb) {
      throw new NotFoundError('Knowledge base')
    }

    const hasAccess = await checkKBAccess(kb, req.user!.sub, req.user!.departmentId, req.user!.roleId)
    if (!hasAccess) {
      throw new AuthorizationError('No access to this knowledge base')
    }

    // 获取知识库配置
    const config = kb.config as { maxResults?: number; scoreThreshold?: number } | null

    // 生成查询向量
    const queryEmbedding = await generateQueryEmbedding(query)

    // 向量检索
    const searchResults = await vectorService.search(
      kb.id,
      queryEmbedding,
      topK || config?.maxResults || 10,
      scoreThreshold || config?.scoreThreshold || 0.7
    )

    // 获取文档信息
    const docIds = [...new Set(searchResults.map((r) => r.documentId))]
    const docs = await db.query.kbDocuments.findMany({
      where: sql`id IN (${sql.raw(docIds.map((id) => `'${id}'`).join(','))})`
    })
    const docMap = new Map(docs.map((d) => [d.id, d]))

    // 组装结果
    const results = searchResults.map((r) => ({
      id: r.id,
      content: r.content,
      score: r.score,
      metadata: r.metadata,
      document: docMap.get(r.documentId)
        ? {
            id: docMap.get(r.documentId)!.id,
            fileName: docMap.get(r.documentId)!.fileName,
            fileType: docMap.get(r.documentId)!.fileType
          }
        : null
    }))

    logger.info({ kbId: kb.id, query, resultsCount: results.length }, 'Knowledge base search')

    res.json(createSuccessResponse(results))
  } catch (err) {
    next(err)
  }
})

/**
 * 更新知识库权限
 * PATCH /knowledge-bases/:id/permissions
 */
router.patch('/:id/permissions', async (req, res, next) => {
  try {
    const kb = await db.query.knowledgeBases.findFirst({
      where: and(eq(knowledgeBases.id, req.params.id), eq(knowledgeBases.companyId, req.user!.companyId))
    })

    if (!kb) {
      throw new NotFoundError('Knowledge base')
    }

    const hasAccess = await checkKBAccess(kb, req.user!.sub, req.user!.departmentId, req.user!.roleId, 'admin')
    if (!hasAccess) {
      throw new AuthorizationError('No permission to manage permissions')
    }

    const { add, remove } = req.body as {
      add?: Array<{ targetType: string; targetId: string; level: string }>
      remove?: Array<{ targetType: string; targetId: string }>
    }

    // 删除权限
    if (remove?.length) {
      for (const perm of remove) {
        await db
          .delete(kbPermissions)
          .where(
            and(
              eq(kbPermissions.knowledgeBaseId, kb.id),
              eq(kbPermissions.targetType, perm.targetType),
              eq(kbPermissions.targetId, perm.targetId)
            )
          )
      }
    }

    // 添加权限
    if (add?.length) {
      for (const perm of add) {
        // 先删除已有的同类权限
        await db
          .delete(kbPermissions)
          .where(
            and(
              eq(kbPermissions.knowledgeBaseId, kb.id),
              eq(kbPermissions.targetType, perm.targetType),
              eq(kbPermissions.targetId, perm.targetId)
            )
          )

        await db.insert(kbPermissions).values({
          knowledgeBaseId: kb.id,
          targetType: perm.targetType,
          targetId: perm.targetId,
          level: perm.level
        })
      }
    }

    logger.info({ kbId: kb.id, updatedBy: req.user!.sub }, 'Knowledge base permissions updated')

    // 返回更新后的权限列表
    const updatedPerms = await db.query.kbPermissions.findMany({
      where: eq(kbPermissions.knowledgeBaseId, kb.id)
    })

    res.json(createSuccessResponse(updatedPerms))
  } catch (err) {
    next(err)
  }
})

export default router
