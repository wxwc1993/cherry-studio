import type {
  DescriptionContentInput,
  EditImageInput,
  ExportPresentationInput,
  GenerateOutlineInput,
  OutlineContentInput,
  PresentationConfigInput,
  RefineDescriptionsInput,
  RefineOutlineInput
} from '@cherry-studio/enterprise-shared'
import { and, eq } from 'drizzle-orm'

import { config } from '../config'
import { db, models } from '../models'
import { createLogger } from '../utils/logger'
import { cryptoService } from './crypto.service'

const logger = createLogger('PresentationProxyService')

// ============ 类型定义 ============

/** Flask Worker 通用响应 */
interface FlaskResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

/** 生成大纲的返回结果 */
export interface GeneratedOutline {
  pages: OutlineContentInput[]
}

/** 生成描述的返回结果 */
export interface GeneratedDescriptions {
  pages: Array<{
    pageId: string
    descriptionContent: DescriptionContentInput
  }>
}

/** 生成图像的返回结果 */
export interface GeneratedImage {
  pageId: string
  imageBuffer: Buffer
  mimeType: string
}

/** 生成图像批量返回 */
export interface GeneratedImages {
  images: GeneratedImage[]
}

/** 导出文件的返回结果 */
export interface ExportedFile {
  buffer: Buffer
  fileName: string
  mimeType: string
}

/** 参考文件解析结果 */
export interface ParsedReferenceFile {
  markdownContent: string
}

/** 解密后的模型凭证 */
interface ModelCredentials {
  apiKey: string
  apiEndpoint: string | null
  providerId: string
  modelName: string
  config: Record<string, unknown>
}

/** Flask 请求通用参数 */
export interface FlaskRequestContext {
  companyId: string
  presentationId: string
  modelCredentials?: ModelCredentials
  config?: PresentationConfigInput
}

// ============ 错误类 ============

export class FlaskWorkerError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 502,
    public readonly flaskError?: string
  ) {
    super(message)
    this.name = 'FlaskWorkerError'
  }
}

export class FlaskWorkerUnavailableError extends FlaskWorkerError {
  constructor(message = 'AI Worker service is currently unavailable') {
    super(message, 503)
    this.name = 'FlaskWorkerUnavailableError'
  }
}

// ============ 内部工具 ============

/**
 * 从 models 表获取并解密模型凭证
 */
async function resolveModelCredentials(modelId: string, companyId: string): Promise<ModelCredentials> {
  const model = await db.query.models.findFirst({
    where: and(eq(models.id, modelId), eq(models.companyId, companyId))
  })

  if (!model) {
    throw new FlaskWorkerError(`Model not found: ${modelId}`, 404)
  }

  if (!model.isEnabled) {
    throw new FlaskWorkerError(`Model is disabled: ${model.displayName}`, 400)
  }

  const decryptedApiKey = cryptoService.decrypt(model.apiKey)

  return {
    apiKey: decryptedApiKey,
    apiEndpoint: model.apiEndpoint,
    providerId: model.providerId,
    modelName: model.name,
    config: (model.config ?? {}) as Record<string, unknown>
  }
}

/**
 * 发送 HTTP 请求到 Flask Worker（带超时和重试）
 */
async function flaskRequest<T>(method: 'GET' | 'POST', path: string, body?: unknown, timeoutMs?: number): Promise<T> {
  const { baseUrl, timeoutMs: defaultTimeout, maxRetries, retryDelayMs } = config.flaskWorker
  const url = `${baseUrl}${path}`
  const effectiveTimeout = timeoutMs ?? defaultTimeout

  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), effectiveTimeout)

      const fetchOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        signal: controller.signal
      }

      if (method !== 'GET' && body) {
        fetchOptions.body = JSON.stringify(body)
      }

      const response = await fetch(url, fetchOptions)

      clearTimeout(timer)

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unknown error')
        throw new FlaskWorkerError(`Flask Worker returned ${response.status}: ${errorBody}`, response.status, errorBody)
      }

      const json = (await response.json()) as FlaskResponse<T>

      if (!json.success) {
        throw new FlaskWorkerError(json.error ?? 'Flask Worker returned unsuccessful response', 500, json.error)
      }

      return json.data as T
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))

      // 不重试客户端错误（4xx）
      if (err instanceof FlaskWorkerError && err.statusCode >= 400 && err.statusCode < 500) {
        throw err
      }

      // 超时或网络错误 → 重试
      if (attempt <= maxRetries) {
        const waitTime = retryDelayMs * Math.pow(2, attempt - 1)
        logger.warn(
          { path, attempt, maxRetries: maxRetries + 1, waitTime, error: lastError.message },
          'Flask request failed, retrying'
        )
        await new Promise((resolve) => setTimeout(resolve, waitTime))
      }
    }
  }

  // 所有重试均失败
  if (lastError?.name === 'AbortError') {
    throw new FlaskWorkerUnavailableError('AI Worker request timed out')
  }

  throw new FlaskWorkerUnavailableError(`AI Worker unreachable after ${maxRetries + 1} attempts: ${lastError?.message}`)
}

/**
 * 发送请求并接收 binary 响应（用于图像/导出文件）
 */
async function flaskBinaryRequest(
  path: string,
  body: unknown,
  timeoutMs?: number
): Promise<{ buffer: Buffer; contentType: string; fileName?: string }> {
  const { baseUrl, timeoutMs: defaultTimeout, maxRetries, retryDelayMs } = config.flaskWorker
  const url = `${baseUrl}${path}`
  const effectiveTimeout = timeoutMs ?? defaultTimeout

  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), effectiveTimeout)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/octet-stream, image/*, application/json'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      })

      clearTimeout(timer)

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unknown error')
        throw new FlaskWorkerError(`Flask Worker returned ${response.status}: ${errorBody}`, response.status, errorBody)
      }

      const contentType = response.headers.get('content-type') ?? 'application/octet-stream'

      // 如果返回 JSON 错误
      if (contentType.includes('application/json')) {
        const json = (await response.json()) as FlaskResponse
        if (!json.success) {
          throw new FlaskWorkerError(json.error ?? 'Flask Worker returned unsuccessful response', 500, json.error)
        }
        throw new FlaskWorkerError('Expected binary response but got JSON', 500)
      }

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const disposition = response.headers.get('content-disposition')
      const fileNameMatch = disposition?.match(/filename="?([^";\n]+)"?/)

      return {
        buffer,
        contentType,
        fileName: fileNameMatch?.[1]
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))

      if (err instanceof FlaskWorkerError && err.statusCode >= 400 && err.statusCode < 500) {
        throw err
      }

      if (attempt <= maxRetries) {
        const waitTime = retryDelayMs * Math.pow(2, attempt - 1)
        logger.warn({ path, attempt, waitTime, error: lastError.message }, 'Flask binary request failed, retrying')
        await new Promise((resolve) => setTimeout(resolve, waitTime))
      }
    }
  }

  if (lastError?.name === 'AbortError') {
    throw new FlaskWorkerUnavailableError('AI Worker request timed out')
  }

  throw new FlaskWorkerUnavailableError(`AI Worker unreachable after ${maxRetries + 1} attempts: ${lastError?.message}`)
}

// ============ 健康检查 ============

/**
 * 检查 Flask Worker 是否健康
 */
async function checkHealth(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
  const start = Date.now()

  try {
    await flaskRequest<{ status: string }>('GET', config.flaskWorker.healthCheckPath, undefined, 5000)
    return { healthy: true, latencyMs: Date.now() - start }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.warn({ error: message }, 'Flask Worker health check failed')
    return { healthy: false, latencyMs: Date.now() - start, error: message }
  }
}

// ============ AI 生成：大纲 ============

/**
 * 调用 Flask Worker 生成大纲
 */
async function generateOutline(
  context: FlaskRequestContext,
  input: GenerateOutlineInput,
  referenceContent?: string
): Promise<GeneratedOutline> {
  const { companyId, presentationId, config: presConfig } = context

  // 解析文本模型凭证
  const textModelId = presConfig?.textModelId
  const modelCreds = textModelId ? await resolveModelCredentials(textModelId, companyId) : undefined

  logger.info({ presentationId, companyId, hasModel: !!modelCreds }, 'Requesting outline generation from Flask Worker')

  return flaskRequest<GeneratedOutline>('POST', '/api/v1/generate/outline', {
    presentationId,
    idea: input.idea,
    config: presConfig,
    referenceContent,
    model: modelCreds
      ? {
          apiKey: modelCreds.apiKey,
          apiEndpoint: modelCreds.apiEndpoint,
          providerId: modelCreds.providerId,
          modelName: modelCreds.modelName,
          config: modelCreds.config
        }
      : undefined
  })
}

/**
 * 调用 Flask Worker 优化大纲
 */
async function refineOutline(
  context: FlaskRequestContext,
  input: RefineOutlineInput,
  currentPages: OutlineContentInput[]
): Promise<GeneratedOutline> {
  const { companyId, presentationId, config: presConfig } = context

  const textModelId = presConfig?.textModelId
  const modelCreds = textModelId ? await resolveModelCredentials(textModelId, companyId) : undefined

  logger.info(
    { presentationId, instruction: input.instruction.slice(0, 100) },
    'Requesting outline refinement from Flask Worker'
  )

  return flaskRequest<GeneratedOutline>('POST', '/api/v1/generate/refine-outline', {
    presentationId,
    instruction: input.instruction,
    pages: currentPages,
    config: presConfig,
    model: modelCreds
      ? {
          apiKey: modelCreds.apiKey,
          apiEndpoint: modelCreds.apiEndpoint,
          providerId: modelCreds.providerId,
          modelName: modelCreds.modelName,
          config: modelCreds.config
        }
      : undefined
  })
}

// ============ AI 生成：描述 ============

/**
 * 调用 Flask Worker 生成页面描述
 */
async function generateDescriptions(
  context: FlaskRequestContext,
  pages: Array<{ pageId: string; outlineContent: OutlineContentInput }>
): Promise<GeneratedDescriptions> {
  const { companyId, presentationId, config: presConfig } = context

  const textModelId = presConfig?.textModelId
  const modelCreds = textModelId ? await resolveModelCredentials(textModelId, companyId) : undefined

  logger.info({ presentationId, pageCount: pages.length }, 'Requesting descriptions generation from Flask Worker')

  return flaskRequest<GeneratedDescriptions>('POST', '/api/v1/generate/descriptions', {
    presentationId,
    pages,
    config: presConfig,
    model: modelCreds
      ? {
          apiKey: modelCreds.apiKey,
          apiEndpoint: modelCreds.apiEndpoint,
          providerId: modelCreds.providerId,
          modelName: modelCreds.modelName,
          config: modelCreds.config
        }
      : undefined
  })
}

/**
 * 调用 Flask Worker 优化描述
 */
async function refineDescriptions(
  context: FlaskRequestContext,
  input: RefineDescriptionsInput,
  pages: Array<{
    pageId: string
    outlineContent: OutlineContentInput
    descriptionContent: DescriptionContentInput
  }>
): Promise<GeneratedDescriptions> {
  const { companyId, presentationId, config: presConfig } = context

  const textModelId = presConfig?.textModelId
  const modelCreds = textModelId ? await resolveModelCredentials(textModelId, companyId) : undefined

  logger.info(
    { presentationId, instruction: input.instruction.slice(0, 100), pageCount: pages.length },
    'Requesting descriptions refinement from Flask Worker'
  )

  return flaskRequest<GeneratedDescriptions>('POST', '/api/v1/generate/refine-descriptions', {
    presentationId,
    instruction: input.instruction,
    pageIds: input.pageIds,
    pages,
    config: presConfig,
    model: modelCreds
      ? {
          apiKey: modelCreds.apiKey,
          apiEndpoint: modelCreds.apiEndpoint,
          providerId: modelCreds.providerId,
          modelName: modelCreds.modelName,
          config: modelCreds.config
        }
      : undefined
  })
}

// ============ AI 生成：图像 ============

/**
 * 调用 Flask Worker 批量生成图像
 */
async function generateImages(
  context: FlaskRequestContext,
  pages: Array<{
    pageId: string
    descriptionContent: DescriptionContentInput
  }>
): Promise<GeneratedImages> {
  const { companyId, presentationId, config: presConfig } = context

  const imageModelId = presConfig?.imageModelId
  const modelCreds = imageModelId ? await resolveModelCredentials(imageModelId, companyId) : undefined

  logger.info(
    { presentationId, pageCount: pages.length, hasModel: !!modelCreds },
    'Requesting images generation from Flask Worker'
  )

  // 图像生成超时更长（每页最多 60 秒）
  const timeoutMs = Math.max(config.flaskWorker.timeoutMs, pages.length * 60000)

  return flaskRequest<GeneratedImages>(
    'POST',
    '/api/v1/generate/images',
    {
      presentationId,
      pages,
      config: presConfig,
      model: modelCreds
        ? {
            apiKey: modelCreds.apiKey,
            apiEndpoint: modelCreds.apiEndpoint,
            providerId: modelCreds.providerId,
            modelName: modelCreds.modelName,
            config: modelCreds.config
          }
        : undefined
    },
    timeoutMs
  )
}

/**
 * 调用 Flask Worker 为单页生成图像
 */
async function generateSingleImage(
  context: FlaskRequestContext,
  pageId: string,
  descriptionContent: DescriptionContentInput,
  customPrompt?: string
): Promise<GeneratedImage> {
  const { companyId, presentationId, config: presConfig } = context

  const imageModelId = presConfig?.imageModelId
  const modelCreds = imageModelId ? await resolveModelCredentials(imageModelId, companyId) : undefined

  logger.info(
    { presentationId, pageId, hasCustomPrompt: !!customPrompt },
    'Requesting single image generation from Flask Worker'
  )

  const result = await flaskBinaryRequest(
    '/api/v1/generate/single-image',
    {
      presentationId,
      pageId,
      descriptionContent,
      customPrompt,
      config: presConfig,
      model: modelCreds
        ? {
            apiKey: modelCreds.apiKey,
            apiEndpoint: modelCreds.apiEndpoint,
            providerId: modelCreds.providerId,
            modelName: modelCreds.modelName,
            config: modelCreds.config
          }
        : undefined
    },
    180000 // 单张图片 3 分钟超时
  )

  return {
    pageId,
    imageBuffer: result.buffer,
    mimeType: result.contentType
  }
}

/**
 * 调用 Flask Worker 编辑图像
 */
async function editImage(
  context: FlaskRequestContext,
  pageId: string,
  input: EditImageInput,
  currentImageKey: string
): Promise<GeneratedImage> {
  const { companyId, presentationId, config: presConfig } = context

  const imageModelId = presConfig?.imageModelId
  const modelCreds = imageModelId ? await resolveModelCredentials(imageModelId, companyId) : undefined

  logger.info(
    { presentationId, pageId, instruction: input.instruction.slice(0, 100) },
    'Requesting image edit from Flask Worker'
  )

  const result = await flaskBinaryRequest(
    '/api/v1/generate/edit-image',
    {
      presentationId,
      pageId,
      instruction: input.instruction,
      maskData: input.maskData,
      currentImageKey,
      config: presConfig,
      model: modelCreds
        ? {
            apiKey: modelCreds.apiKey,
            apiEndpoint: modelCreds.apiEndpoint,
            providerId: modelCreds.providerId,
            modelName: modelCreds.modelName,
            config: modelCreds.config
          }
        : undefined
    },
    180000
  )

  return {
    pageId,
    imageBuffer: result.buffer,
    mimeType: result.contentType
  }
}

// ============ 导出 ============

/**
 * 调用 Flask Worker 导出 PPTX
 */
async function exportPptx(
  context: FlaskRequestContext,
  pages: Array<{
    orderIndex: number
    outlineContent: OutlineContentInput
    descriptionContent?: DescriptionContentInput
    generatedImageKey?: string | null
  }>,
  input: ExportPresentationInput
): Promise<ExportedFile> {
  return exportPresentation(context, pages, input, 'pptx')
}

/**
 * 调用 Flask Worker 导出 PDF
 */
async function exportPdf(
  context: FlaskRequestContext,
  pages: Array<{
    orderIndex: number
    outlineContent: OutlineContentInput
    descriptionContent?: DescriptionContentInput
    generatedImageKey?: string | null
  }>,
  input: ExportPresentationInput
): Promise<ExportedFile> {
  return exportPresentation(context, pages, input, 'pdf')
}

/**
 * 调用 Flask Worker 导出可编辑 PPTX
 */
async function exportEditablePptx(
  context: FlaskRequestContext,
  pages: Array<{
    orderIndex: number
    outlineContent: OutlineContentInput
    descriptionContent?: DescriptionContentInput
    generatedImageKey?: string | null
  }>,
  input: ExportPresentationInput
): Promise<ExportedFile> {
  return exportPresentation(context, pages, input, 'editable_pptx')
}

/**
 * 通用导出实现
 */
async function exportPresentation(
  context: FlaskRequestContext,
  pages: Array<{
    orderIndex: number
    outlineContent: OutlineContentInput
    descriptionContent?: DescriptionContentInput
    generatedImageKey?: string | null
  }>,
  input: ExportPresentationInput,
  format: 'pptx' | 'pdf' | 'editable_pptx'
): Promise<ExportedFile> {
  const { presentationId } = context

  logger.info({ presentationId, format, pageCount: pages.length }, 'Requesting presentation export from Flask Worker')

  const result = await flaskBinaryRequest(
    '/api/v1/export/presentation',
    {
      presentationId,
      format,
      pages,
      templateId: input.templateId,
      config: { ...context.config, ...input.config }
    },
    300000 // 导出 5 分钟超时
  )

  const extMap: Record<string, string> = {
    pptx: '.pptx',
    pdf: '.pdf',
    editable_pptx: '.pptx'
  }

  const mimeMap: Record<string, string> = {
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    pdf: 'application/pdf',
    editable_pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  }

  return {
    buffer: result.buffer,
    fileName: result.fileName ?? `presentation-${presentationId}${extMap[format]}`,
    mimeType: mimeMap[format] ?? result.contentType
  }
}

// ============ 参考文件解析 ============

/**
 * 调用 Flask Worker 解析参考文件
 */
async function parseReferenceFile(
  companyId: string,
  fileBuffer: Buffer,
  fileName: string
): Promise<ParsedReferenceFile> {
  logger.info({ companyId, fileName }, 'Requesting reference file parsing from Flask Worker')

  // 使用 multipart/form-data 发送文件
  const formData = new FormData()
  const blob = new Blob([fileBuffer])
  formData.append('file', blob, fileName)
  formData.append('companyId', companyId)

  const { baseUrl, timeoutMs } = config.flaskWorker
  const url = `${baseUrl}/api/v1/parse/reference-file`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    })

    clearTimeout(timer)

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error')
      throw new FlaskWorkerError(
        `Flask Worker returned ${response.status} during file parsing: ${errorBody}`,
        response.status,
        errorBody
      )
    }

    const json = (await response.json()) as FlaskResponse<ParsedReferenceFile>

    if (!json.success || !json.data) {
      throw new FlaskWorkerError(json.error ?? 'File parsing returned unsuccessful response', 500, json.error)
    }

    return json.data
  } catch (err) {
    clearTimeout(timer)

    if (err instanceof FlaskWorkerError) {
      throw err
    }

    const message = err instanceof Error ? err.message : String(err)
    throw new FlaskWorkerUnavailableError(`File parsing failed: ${message}`)
  }
}

// ============ 导出服务对象 ============

export const presentationProxyService = {
  // 健康检查
  checkHealth,

  // AI 生成：大纲
  generateOutline,
  refineOutline,

  // AI 生成：描述
  generateDescriptions,
  refineDescriptions,

  // AI 生成：图像
  generateImages,
  generateSingleImage,
  editImage,

  // 导出
  exportPptx,
  exportPdf,
  exportEditablePptx,

  // 参考文件解析
  parseReferenceFile,

  // 工具（供测试使用）
  resolveModelCredentials
}
