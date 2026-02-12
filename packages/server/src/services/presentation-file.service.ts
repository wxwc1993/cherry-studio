import { sanitizeFilename } from '@cherry-studio/enterprise-shared'
import { eq } from 'drizzle-orm'

import { db, presentationMaterials, presentationReferenceFiles, presentationTemplates } from '../models'
import { createLogger } from '../utils/logger'
import { getStorageService } from './storage'

const logger = createLogger('PresentationFileService')

// ============ 常量 ============

/** 演示文稿文件存储根路径 */
const STORAGE_ROOT = 'presentations'

/** 文件分类 */
type FileCategory = 'materials' | 'references' | 'templates' | 'images' | 'exports'

/** 素材允许的文件扩展名 */
const MATERIAL_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'])

/** 参考文件允许的扩展名 */
const REFERENCE_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.txt', '.md', '.pptx', '.ppt'])

/** 模板允许的扩展名 */
const TEMPLATE_EXTENSIONS = new Set(['.pptx'])

/** 图片 MIME 类型映射 */
const IMAGE_MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp'
}

/** 导出文件签名 URL 默认过期时间（秒） */
const EXPORT_URL_EXPIRY = 3600

/** 图片签名 URL 默认过期时间（秒） */
const IMAGE_URL_EXPIRY = 7200

// ============ 参数类型 ============

interface UploadMaterialParams {
  companyId: string
  userId: string
  presentationId?: string
  fileName: string
  buffer: Buffer
  mimeType: string
}

interface UploadReferenceFileParams {
  companyId: string
  userId: string
  presentationId: string
  fileName: string
  buffer: Buffer
  fileSize: number
}

interface UploadTemplateParams {
  companyId: string
  uploaderId: string
  name: string
  description?: string
  isPublic: boolean
  buffer: Buffer
  fileName: string
}

interface UploadGeneratedImageParams {
  companyId: string
  presentationId: string
  pageId: string
  buffer: Buffer
  mimeType: string
}

interface StoreExportFileParams {
  companyId: string
  presentationId: string
  format: 'pptx' | 'pdf' | 'editable_pptx'
  buffer: Buffer
  fileName: string
}

// ============ 返回类型 ============

interface MaterialRecord {
  id: string
  fileName: string
  storageKey: string
  fileSize: number
  mimeType: string | null
}

interface ReferenceFileRecord {
  id: string
  fileName: string
  storageKey: string
  fileSize: number
  parseStatus: string
}

interface TemplateRecord {
  id: string
  name: string
  storageKey: string
  previewImageKey: string | null
}

// ============ 工具函数 ============

/**
 * 构建结构化的存储 key
 * 格式: presentations/{companyId}/{category}/{timestamp}-{sanitizedFileName}
 */
function buildStorageKey(companyId: string, category: FileCategory, fileName: string): string {
  const sanitized = sanitizeFilename(fileName)
  const timestamp = Date.now()
  return `${STORAGE_ROOT}/${companyId}/${category}/${timestamp}-${sanitized}`
}

/**
 * 从文件名提取扩展名（小写）
 */
function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.')
  if (lastDot === -1) return ''
  return fileName.slice(lastDot).toLowerCase()
}

/**
 * 验证文件扩展名是否在允许列表中
 */
function validateExtension(fileName: string, allowed: Set<string>): boolean {
  const ext = getFileExtension(fileName)
  return allowed.has(ext)
}

/**
 * 根据扩展名推断 MIME 类型
 */
function inferMimeType(fileName: string, fallback: string): string {
  const ext = getFileExtension(fileName)
  return IMAGE_MIME_MAP[ext] ?? fallback
}

// ============ 素材文件管理 ============

/**
 * 上传素材文件到 OSS 并创建数据库记录
 */
async function uploadMaterial(params: UploadMaterialParams): Promise<MaterialRecord> {
  const { companyId, userId, presentationId, fileName, buffer, mimeType } = params

  if (!validateExtension(fileName, MATERIAL_EXTENSIONS)) {
    throw new Error(`Unsupported material file type: ${getFileExtension(fileName)}`)
  }

  const storageKey = buildStorageKey(companyId, 'materials', fileName)
  const storage = getStorageService()

  await storage.upload(storageKey, buffer, mimeType)

  const [record] = await db
    .insert(presentationMaterials)
    .values({
      companyId,
      userId,
      presentationId: presentationId ?? null,
      fileName: sanitizeFilename(fileName),
      storageKey,
      fileSize: buffer.length,
      mimeType
    })
    .returning()

  logger.info({ materialId: record.id, companyId, userId }, 'Material uploaded')

  return {
    id: record.id,
    fileName: record.fileName,
    storageKey: record.storageKey,
    fileSize: record.fileSize,
    mimeType: record.mimeType
  }
}

/**
 * 获取素材文件的签名下载 URL
 */
async function getMaterialSignedUrl(materialId: string, companyId: string): Promise<string> {
  const material = await db.query.presentationMaterials.findFirst({
    where: eq(presentationMaterials.id, materialId)
  })

  if (!material || material.companyId !== companyId) {
    throw new Error('Material not found')
  }

  const storage = getStorageService()
  return storage.getSignedUrl(material.storageKey, IMAGE_URL_EXPIRY)
}

/**
 * 删除素材文件（OSS + 数据库记录）
 */
async function deleteMaterial(materialId: string, companyId: string): Promise<void> {
  const material = await db.query.presentationMaterials.findFirst({
    where: eq(presentationMaterials.id, materialId)
  })

  if (!material || material.companyId !== companyId) {
    throw new Error('Material not found')
  }

  const storage = getStorageService()

  try {
    await storage.delete(material.storageKey)
  } catch (err) {
    logger.warn({ materialId, storageKey: material.storageKey, err }, 'Failed to delete material from storage')
  }

  await db.delete(presentationMaterials).where(eq(presentationMaterials.id, materialId))

  logger.info({ materialId, companyId }, 'Material deleted')
}

// ============ 参考文件管理 ============

/**
 * 上传参考文件到 OSS 并创建数据库记录（解析状态为 pending）
 */
async function uploadReferenceFile(params: UploadReferenceFileParams): Promise<ReferenceFileRecord> {
  const { companyId, userId, presentationId, fileName, buffer, fileSize } = params

  if (!validateExtension(fileName, REFERENCE_EXTENSIONS)) {
    throw new Error(`Unsupported reference file type: ${getFileExtension(fileName)}`)
  }

  const storageKey = buildStorageKey(companyId, 'references', fileName)
  const storage = getStorageService()
  const ext = getFileExtension(fileName)
  const mimeType = inferMimeType(fileName, 'application/octet-stream')

  await storage.upload(storageKey, buffer, mimeType)

  const [record] = await db
    .insert(presentationReferenceFiles)
    .values({
      companyId,
      userId,
      presentationId,
      fileName: sanitizeFilename(fileName),
      storageKey,
      parseStatus: 'pending',
      fileSize
    })
    .returning()

  logger.info({ referenceFileId: record.id, companyId, presentationId, ext }, 'Reference file uploaded, pending parse')

  return {
    id: record.id,
    fileName: record.fileName,
    storageKey: record.storageKey,
    fileSize: record.fileSize,
    parseStatus: record.parseStatus
  }
}

/**
 * 删除参考文件（OSS + 数据库记录）
 */
async function deleteReferenceFile(referenceFileId: string, companyId: string): Promise<void> {
  const refFile = await db.query.presentationReferenceFiles.findFirst({
    where: eq(presentationReferenceFiles.id, referenceFileId)
  })

  if (!refFile || refFile.companyId !== companyId) {
    throw new Error('Reference file not found')
  }

  const storage = getStorageService()

  try {
    await storage.delete(refFile.storageKey)
  } catch (err) {
    logger.warn(
      { referenceFileId, storageKey: refFile.storageKey, err },
      'Failed to delete reference file from storage'
    )
  }

  await db.delete(presentationReferenceFiles).where(eq(presentationReferenceFiles.id, referenceFileId))

  logger.info({ referenceFileId, companyId }, 'Reference file deleted')
}

/**
 * 下载参考文件内容（供文档解析服务使用）
 */
async function downloadReferenceFile(referenceFileId: string, companyId: string): Promise<Buffer> {
  const refFile = await db.query.presentationReferenceFiles.findFirst({
    where: eq(presentationReferenceFiles.id, referenceFileId)
  })

  if (!refFile || refFile.companyId !== companyId) {
    throw new Error('Reference file not found')
  }

  const storage = getStorageService()
  return storage.download(refFile.storageKey)
}

// ============ 模板文件管理 ============

/**
 * 上传模板文件到 OSS 并创建数据库记录
 */
async function uploadTemplate(params: UploadTemplateParams): Promise<TemplateRecord> {
  const { companyId, uploaderId, name, description, isPublic, buffer, fileName } = params

  if (!validateExtension(fileName, TEMPLATE_EXTENSIONS)) {
    throw new Error(`Unsupported template file type: ${getFileExtension(fileName)}. Only .pptx is allowed`)
  }

  const storageKey = buildStorageKey(companyId, 'templates', fileName)
  const storage = getStorageService()
  const mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

  await storage.upload(storageKey, buffer, mimeType)

  const [record] = await db
    .insert(presentationTemplates)
    .values({
      companyId,
      uploaderId,
      name,
      description: description ?? null,
      storageKey,
      isPublic
    })
    .returning()

  logger.info({ templateId: record.id, companyId, uploaderId }, 'Template uploaded')

  return {
    id: record.id,
    name: record.name,
    storageKey: record.storageKey,
    previewImageKey: record.previewImageKey
  }
}

/**
 * 为模板上传预览图
 */
async function uploadTemplatePreview(
  templateId: string,
  companyId: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const template = await db.query.presentationTemplates.findFirst({
    where: eq(presentationTemplates.id, templateId)
  })

  if (!template || template.companyId !== companyId) {
    throw new Error('Template not found')
  }

  const previewKey = buildStorageKey(companyId, 'templates', `preview-${templateId}.png`)
  const storage = getStorageService()

  // 删除旧预览图（如果存在）
  if (template.previewImageKey) {
    try {
      await storage.delete(template.previewImageKey)
    } catch (err) {
      logger.warn({ templateId, oldKey: template.previewImageKey, err }, 'Failed to delete old preview image')
    }
  }

  await storage.upload(previewKey, buffer, mimeType)

  await db
    .update(presentationTemplates)
    .set({ previewImageKey: previewKey, updatedAt: new Date() })
    .where(eq(presentationTemplates.id, templateId))

  logger.info({ templateId, previewKey }, 'Template preview image uploaded')

  return previewKey
}

/**
 * 删除模板（OSS 文件 + 预览图 + 数据库记录）
 */
async function deleteTemplate(templateId: string, companyId: string): Promise<void> {
  const template = await db.query.presentationTemplates.findFirst({
    where: eq(presentationTemplates.id, templateId)
  })

  if (!template || template.companyId !== companyId) {
    throw new Error('Template not found')
  }

  const storage = getStorageService()

  // 删除模板文件
  try {
    await storage.delete(template.storageKey)
  } catch (err) {
    logger.warn({ templateId, storageKey: template.storageKey, err }, 'Failed to delete template file from storage')
  }

  // 删除预览图
  if (template.previewImageKey) {
    try {
      await storage.delete(template.previewImageKey)
    } catch (err) {
      logger.warn({ templateId, previewKey: template.previewImageKey, err }, 'Failed to delete template preview')
    }
  }

  await db.delete(presentationTemplates).where(eq(presentationTemplates.id, templateId))

  logger.info({ templateId, companyId }, 'Template deleted')
}

// ============ AI 生成图像管理 ============

/**
 * 上传 AI 生成的图像到 OSS
 * 返回存储 key（由调用方写入 page 或 image_version 表）
 */
async function uploadGeneratedImage(params: UploadGeneratedImageParams): Promise<string> {
  const { companyId, presentationId, pageId, buffer, mimeType } = params

  const ext = mimeType === 'image/png' ? '.png' : '.jpg'
  const fileName = `page-${pageId}${ext}`
  const storageKey = buildStorageKey(companyId, 'images', `${presentationId}/${fileName}`)
  const storage = getStorageService()

  await storage.upload(storageKey, buffer, mimeType)

  logger.info({ storageKey, presentationId, pageId }, 'Generated image uploaded')

  return storageKey
}

/**
 * 删除 AI 生成的图像
 */
async function deleteGeneratedImage(storageKey: string): Promise<void> {
  const storage = getStorageService()

  try {
    await storage.delete(storageKey)
    logger.info({ storageKey }, 'Generated image deleted')
  } catch (err) {
    logger.warn({ storageKey, err }, 'Failed to delete generated image from storage')
  }
}

// ============ 导出文件管理 ============

/**
 * 存储导出的 PPT/PDF 文件到 OSS
 * 返回存储 key（由调用方写入 task.result）
 */
async function storeExportFile(params: StoreExportFileParams): Promise<string> {
  const { companyId, presentationId, format, buffer, fileName } = params

  const mimeTypeMap: Record<string, string> = {
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    pdf: 'application/pdf',
    editable_pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  }

  const storageKey = buildStorageKey(companyId, 'exports', `${presentationId}/${fileName}`)
  const storage = getStorageService()
  const mimeType = mimeTypeMap[format] ?? 'application/octet-stream'

  await storage.upload(storageKey, buffer, mimeType)

  logger.info({ storageKey, presentationId, format }, 'Export file stored')

  return storageKey
}

/**
 * 获取导出文件的签名下载 URL
 * @param companyId 用于验证 storageKey 前缀归属
 */
async function getExportSignedUrl(companyId: string, storageKey: string, expiresIn?: number): Promise<string> {
  validateStorageKeyOwnership(companyId, storageKey)
  const storage = getStorageService()
  return storage.getSignedUrl(storageKey, expiresIn ?? EXPORT_URL_EXPIRY)
}

// ============ 通用工具 ============

/**
 * 获取任意文件的签名 URL
 * @param companyId 用于验证 storageKey 前缀归属
 */
async function getSignedUrl(companyId: string, storageKey: string, expiresIn?: number): Promise<string> {
  validateStorageKeyOwnership(companyId, storageKey)
  const storage = getStorageService()
  return storage.getSignedUrl(storageKey, expiresIn ?? IMAGE_URL_EXPIRY)
}

/**
 * 验证 storageKey 属于指定公司（防止跨租户文件访问）
 */
function validateStorageKeyOwnership(companyId: string, storageKey: string): void {
  const expectedPrefix = `${STORAGE_ROOT}/${companyId}/`
  if (!storageKey.startsWith(expectedPrefix)) {
    throw new Error(`Storage key does not belong to company: ${companyId}`)
  }
}

/**
 * 检查文件是否存在
 */
async function fileExists(storageKey: string): Promise<boolean> {
  const storage = getStorageService()
  return storage.exists(storageKey)
}

/**
 * 批量删除指定前缀下的所有文件
 * 用于清理整个演示文稿的所有关联文件
 */
async function deleteFilesByPrefix(companyId: string, presentationId: string): Promise<number> {
  const storage = getStorageService()
  let deletedCount = 0

  const categories: FileCategory[] = ['images', 'exports']

  for (const category of categories) {
    const prefix = `${STORAGE_ROOT}/${companyId}/${category}/${presentationId}`

    try {
      const files = await storage.list(prefix)

      for (const file of files) {
        try {
          await storage.delete(file.key)
          deletedCount++
        } catch (err) {
          logger.warn({ key: file.key, err }, 'Failed to delete file during batch cleanup')
        }
      }
    } catch (err) {
      logger.warn({ prefix, err }, 'Failed to list files for batch deletion')
    }
  }

  logger.info({ companyId, presentationId, deletedCount }, 'Batch file cleanup completed')

  return deletedCount
}

// ============ 导出服务对象 ============

export const presentationFileService = {
  // 素材
  uploadMaterial,
  getMaterialSignedUrl,
  deleteMaterial,

  // 参考文件
  uploadReferenceFile,
  deleteReferenceFile,
  downloadReferenceFile,

  // 模板
  uploadTemplate,
  uploadTemplatePreview,
  deleteTemplate,

  // AI 生成图像
  uploadGeneratedImage,
  deleteGeneratedImage,

  // 导出
  storeExportFile,
  getExportSignedUrl,

  // 通用
  getSignedUrl,
  fileExists,
  deleteFilesByPrefix,

  // 工具（供测试和其他服务使用）
  buildStorageKey
}
