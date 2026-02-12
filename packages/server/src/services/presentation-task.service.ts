import type {
  DescriptionContentInput,
  EditImageInput,
  ExportPresentationInput,
  GenerateOutlineInput,
  OutlineContentInput,
  PresentationConfigInput,
  PresentationTaskStatus,
  PresentationTaskType,
  RefineDescriptionsInput,
  RefineOutlineInput
} from '@cherry-studio/enterprise-shared'
import type { Job } from 'bullmq'
import { Queue, Worker } from 'bullmq'
import { and, desc, eq } from 'drizzle-orm'

import { config } from '../config'
import { db, presentationPages, presentations, presentationTasks } from '../models'
import { createLogger } from '../utils/logger'
import { presentationService } from './presentation.service'
import { presentationFileService } from './presentation-file.service'
import type { FlaskRequestContext, GeneratedImage } from './presentation-proxy.service'
import { FlaskWorkerError, presentationProxyService } from './presentation-proxy.service'

const logger = createLogger('PresentationTaskService')

const QUEUE_NAME = 'presentation-tasks'

// ============ BullMQ 任务数据类型 ============

interface BaseJobData {
  taskId: string
  companyId: string
  presentationId: string
  userId: string
  taskType: PresentationTaskType
  presConfig: PresentationConfigInput
}

interface GenerateOutlineJobData extends BaseJobData {
  taskType: 'generate_outline'
  input: GenerateOutlineInput
  referenceContent?: string
}

interface RefineOutlineJobData extends BaseJobData {
  taskType: 'refine_outline'
  input: RefineOutlineInput
  currentPages: OutlineContentInput[]
}

interface GenerateDescriptionsJobData extends BaseJobData {
  taskType: 'generate_descriptions'
  pages: Array<{ pageId: string; outlineContent: OutlineContentInput }>
}

interface RefineDescriptionsJobData extends BaseJobData {
  taskType: 'refine_descriptions'
  input: RefineDescriptionsInput
  pages: Array<{
    pageId: string
    outlineContent: OutlineContentInput
    descriptionContent: DescriptionContentInput
  }>
}

interface GenerateImagesJobData extends BaseJobData {
  taskType: 'generate_images'
  pages: Array<{
    pageId: string
    descriptionContent: DescriptionContentInput
  }>
}

interface GenerateSingleImageJobData extends BaseJobData {
  taskType: 'generate_single_image'
  pageId: string
  descriptionContent: DescriptionContentInput
  customPrompt?: string
}

interface EditImageJobData extends BaseJobData {
  taskType: 'edit_image'
  pageId: string
  input: EditImageInput
  currentImageKey: string
}

interface ExportPptxJobData extends BaseJobData {
  taskType: 'export_pptx'
  input: ExportPresentationInput
}

interface ExportPdfJobData extends BaseJobData {
  taskType: 'export_pdf'
  input: ExportPresentationInput
}

interface ExportEditablePptxJobData extends BaseJobData {
  taskType: 'export_editable_pptx'
  input: ExportPresentationInput
}

interface ParseReferenceFileJobData extends BaseJobData {
  taskType: 'parse_reference_file'
  /** base64 编码的文件内容 */
  fileBase64: string
  fileName: string
}

type PresentationJobData =
  | GenerateOutlineJobData
  | RefineOutlineJobData
  | GenerateDescriptionsJobData
  | RefineDescriptionsJobData
  | GenerateImagesJobData
  | GenerateSingleImageJobData
  | EditImageJobData
  | ExportPptxJobData
  | ExportPdfJobData
  | ExportEditablePptxJobData
  | ParseReferenceFileJobData

// ============ 任务优先级映射 ============

const TASK_PRIORITY: Record<PresentationTaskType, number> = {
  generate_outline: 3,
  refine_outline: 3,
  generate_descriptions: 3,
  refine_descriptions: 3,
  generate_images: 5,
  generate_single_image: 2,
  edit_image: 2,
  export_pptx: 4,
  export_pdf: 4,
  export_editable_pptx: 4,
  parse_reference_file: 1
}

// ============ 数据库更新工具 ============

async function updateTaskStatus(
  taskId: string,
  status: PresentationTaskStatus,
  extra?: {
    progress?: Record<string, unknown>
    result?: Record<string, unknown>
    errorMessage?: string
    startedAt?: Date
    completedAt?: Date
  }
): Promise<void> {
  const setData: Record<string, unknown> = {
    status,
    updatedAt: new Date()
  }

  if (extra?.progress !== undefined) {
    setData.progress = extra.progress
  }
  if (extra?.result !== undefined) {
    setData.result = extra.result
  }
  if (extra?.errorMessage !== undefined) {
    setData.errorMessage = extra.errorMessage
  }
  if (extra?.startedAt !== undefined) {
    setData.startedAt = extra.startedAt
  }
  if (extra?.completedAt !== undefined) {
    setData.completedAt = extra.completedAt
  }

  await db.update(presentationTasks).set(setData).where(eq(presentationTasks.id, taskId))
}

async function updateTaskProgress(taskId: string, progress: Record<string, unknown>): Promise<void> {
  await db.update(presentationTasks).set({ progress, updatedAt: new Date() }).where(eq(presentationTasks.id, taskId))
}

// ============ 构建 Flask 请求上下文 ============

function buildFlaskContext(jobData: BaseJobData): FlaskRequestContext {
  return {
    companyId: jobData.companyId,
    presentationId: jobData.presentationId,
    config: jobData.presConfig
  }
}

// ============ 获取导出用的页面数据 ============

async function getExportPages(presentationId: string, companyId: string) {
  const pres = await presentationService.getPresentationById(presentationId, companyId)

  if (!pres) {
    throw new Error(`Presentation not found: ${presentationId}`)
  }

  return pres.pages.map((page) => ({
    orderIndex: page.orderIndex,
    outlineContent: page.outlineContent as OutlineContentInput,
    descriptionContent: (page.descriptionContent ?? undefined) as DescriptionContentInput | undefined,
    generatedImageKey: page.generatedImageKey
  }))
}

// ============ 任务处理器 ============

async function processJob(job: Job<PresentationJobData>): Promise<void> {
  const { taskId, taskType, presentationId } = job.data
  const startedAt = new Date()

  logger.info({ taskId, taskType, presentationId, jobId: job.id }, 'Processing presentation task')

  await updateTaskStatus(taskId, 'running', {
    startedAt,
    progress: { currentStep: `开始执行: ${taskType}` }
  })

  try {
    const result = await executeTask(job)

    await updateTaskStatus(taskId, 'completed', {
      completedAt: new Date(),
      result: result ?? {},
      progress: { completed: 1, total: 1, currentStep: '已完成' }
    })

    // TODO: 当 Flask 端返回 token 用量数据后，在此处调用 db.insert(usageLogs) 记录 AI token 消耗
    // 需要 Flask Worker 在响应中包含 { inputTokens, outputTokens, totalTokens, modelId }

    logger.info(
      { taskId, taskType, presentationId, durationMs: Date.now() - startedAt.getTime() },
      'Presentation task completed'
    )
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    const statusCode = err instanceof FlaskWorkerError ? err.statusCode : 500

    await updateTaskStatus(taskId, 'failed', {
      completedAt: new Date(),
      errorMessage,
      progress: { currentStep: `失败: ${errorMessage.slice(0, 200)}` }
    })

    logger.error({ taskId, taskType, presentationId, statusCode, error: errorMessage }, 'Presentation task failed')

    throw err
  }
}

async function executeTask(job: Job<PresentationJobData>): Promise<Record<string, unknown> | undefined> {
  const data = job.data
  const context = buildFlaskContext(data)

  switch (data.taskType) {
    case 'generate_outline': {
      await updateTaskProgress(data.taskId, { currentStep: '正在生成大纲...' })

      const outline = await presentationProxyService.generateOutline(context, data.input, data.referenceContent)

      // 将大纲写入页面
      const pages = outline.pages.map((page, index) => ({
        orderIndex: index,
        outlineContent: JSON.stringify(page)
      }))

      await presentationService.batchUpsertPages(data.presentationId, data.companyId, pages)
      await presentationService.updatePresentationStatus(data.presentationId, data.companyId, 'outline_ready')

      return { pageCount: outline.pages.length }
    }

    case 'refine_outline': {
      await updateTaskProgress(data.taskId, { currentStep: '正在优化大纲...' })

      const refined = await presentationProxyService.refineOutline(context, data.input, data.currentPages)

      const pages = refined.pages.map((page, index) => ({
        orderIndex: index,
        outlineContent: JSON.stringify(page)
      }))

      await presentationService.batchUpsertPages(data.presentationId, data.companyId, pages)

      return { pageCount: refined.pages.length }
    }

    case 'generate_descriptions': {
      await updateTaskProgress(data.taskId, {
        currentStep: '正在生成页面描述...',
        total: data.pages.length,
        completed: 0
      })

      const result = await presentationProxyService.generateDescriptions(context, data.pages)

      // 逐页更新描述
      let completed = 0
      for (const pageResult of result.pages) {
        await db
          .update(presentationPages)
          .set({
            descriptionContent: pageResult.descriptionContent as unknown as Record<string, unknown>,
            updatedAt: new Date()
          })
          .where(eq(presentationPages.id, pageResult.pageId))

        completed += 1
        await updateTaskProgress(data.taskId, {
          currentStep: `已更新 ${completed}/${result.pages.length} 页描述`,
          total: result.pages.length,
          completed
        })
      }

      await presentationService.updatePresentationStatus(data.presentationId, data.companyId, 'descriptions_ready')

      return { updatedPages: result.pages.length }
    }

    case 'refine_descriptions': {
      await updateTaskProgress(data.taskId, { currentStep: '正在优化描述...' })

      const result = await presentationProxyService.refineDescriptions(context, data.input, data.pages)

      for (const pageResult of result.pages) {
        await db
          .update(presentationPages)
          .set({
            descriptionContent: pageResult.descriptionContent as unknown as Record<string, unknown>,
            updatedAt: new Date()
          })
          .where(eq(presentationPages.id, pageResult.pageId))
      }

      return { updatedPages: result.pages.length }
    }

    case 'generate_images': {
      await updateTaskProgress(data.taskId, {
        currentStep: '正在生成图像...',
        total: data.pages.length,
        completed: 0
      })

      const result = await presentationProxyService.generateImages(context, data.pages)

      // 逐张保存图像到 OSS，更新页面
      let completed = 0
      for (const image of result.images) {
        await saveGeneratedImage(data.companyId, data.presentationId, image)

        completed += 1
        await updateTaskProgress(data.taskId, {
          currentStep: `已生成 ${completed}/${result.images.length} 张图像`,
          total: result.images.length,
          completed
        })
      }

      await presentationService.updatePresentationStatus(data.presentationId, data.companyId, 'images_ready')

      return { generatedImages: result.images.length }
    }

    case 'generate_single_image': {
      await updateTaskProgress(data.taskId, { currentStep: '正在生成单页图像...' })

      const image = await presentationProxyService.generateSingleImage(
        context,
        data.pageId,
        data.descriptionContent,
        data.customPrompt
      )

      const imageKey = await saveGeneratedImage(data.companyId, data.presentationId, image)

      return { pageId: data.pageId, imageKey }
    }

    case 'edit_image': {
      await updateTaskProgress(data.taskId, { currentStep: '正在编辑图像...' })

      const image = await presentationProxyService.editImage(context, data.pageId, data.input, data.currentImageKey)

      const imageKey = await saveGeneratedImage(data.companyId, data.presentationId, image)

      return { pageId: data.pageId, imageKey }
    }

    case 'export_pptx': {
      await updateTaskProgress(data.taskId, { currentStep: '正在导出 PPTX...' })

      const pages = await getExportPages(data.presentationId, data.companyId)
      const exported = await presentationProxyService.exportPptx(context, pages, data.input)

      const storageKey = await presentationFileService.storeExportFile({
        companyId: data.companyId,
        presentationId: data.presentationId,
        format: 'pptx',
        buffer: exported.buffer,
        fileName: exported.fileName
      })

      return { storageKey, fileName: exported.fileName, mimeType: exported.mimeType }
    }

    case 'export_pdf': {
      await updateTaskProgress(data.taskId, { currentStep: '正在导出 PDF...' })

      const pages = await getExportPages(data.presentationId, data.companyId)
      const exported = await presentationProxyService.exportPdf(context, pages, data.input)

      const storageKey = await presentationFileService.storeExportFile({
        companyId: data.companyId,
        presentationId: data.presentationId,
        format: 'pdf',
        buffer: exported.buffer,
        fileName: exported.fileName
      })

      return { storageKey, fileName: exported.fileName, mimeType: exported.mimeType }
    }

    case 'export_editable_pptx': {
      await updateTaskProgress(data.taskId, { currentStep: '正在导出可编辑 PPTX...' })

      const pages = await getExportPages(data.presentationId, data.companyId)
      const exported = await presentationProxyService.exportEditablePptx(context, pages, data.input)

      const storageKey = await presentationFileService.storeExportFile({
        companyId: data.companyId,
        presentationId: data.presentationId,
        format: 'editable_pptx',
        buffer: exported.buffer,
        fileName: exported.fileName
      })

      return { storageKey, fileName: exported.fileName, mimeType: exported.mimeType }
    }

    case 'parse_reference_file': {
      await updateTaskProgress(data.taskId, { currentStep: '正在解析参考文件...' })

      const fileBuffer = Buffer.from(data.fileBase64, 'base64')
      const parsed = await presentationProxyService.parseReferenceFile(data.companyId, fileBuffer, data.fileName)

      return { markdownContent: parsed.markdownContent }
    }

    default: {
      const _exhaustiveCheck: never = data
      throw new Error(`Unknown task type: ${(_exhaustiveCheck as BaseJobData).taskType}`)
    }
  }
}

// ============ 图像保存工具 ============

async function saveGeneratedImage(companyId: string, presentationId: string, image: GeneratedImage): Promise<string> {
  // 上传到 OSS
  const imageKey = await presentationFileService.uploadGeneratedImage({
    companyId,
    presentationId,
    pageId: image.pageId,
    buffer: image.imageBuffer,
    mimeType: image.mimeType
  })

  // 添加图像版本记录
  await presentationService.addImageVersion(image.pageId, imageKey)

  return imageKey
}

// ============ 服务类 ============

class PresentationTaskService {
  private queue: Queue<PresentationJobData> | null = null
  private worker: Worker<PresentationJobData> | null = null
  private isInitialized = false

  /**
   * 初始化 BullMQ 队列和 Worker
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    const connection = this.buildRedisConnection()

    if (!connection) {
      logger.warn('Redis connection not available, presentation task queue disabled')
      return
    }

    this.queue = new Queue<PresentationJobData>(QUEUE_NAME, { connection })

    this.worker = new Worker<PresentationJobData>(
      QUEUE_NAME,
      async (job: Job<PresentationJobData>) => {
        await processJob(job)
      },
      {
        connection,
        concurrency: 3
      }
    )

    this.worker.on('completed', (job) => {
      logger.info({ taskId: job.data.taskId, taskType: job.data.taskType, jobId: job.id }, 'BullMQ job completed')
    })

    this.worker.on('failed', (job, err) => {
      logger.error(
        { taskId: job?.data.taskId, taskType: job?.data.taskType, jobId: job?.id, error: err.message },
        'BullMQ job failed'
      )
    })

    this.isInitialized = true
    logger.info('Presentation task service initialized')
  }

  /**
   * 构建 Redis 连接配置
   * 优先使用 REDIS_URL，否则使用 config.redis 配置
   */
  private buildRedisConnection(): { host: string; port: number; password?: string; db?: number } | null {
    const redisUrl = process.env.REDIS_URL

    if (redisUrl) {
      try {
        const url = new URL(redisUrl)
        return {
          host: url.hostname,
          port: parseInt(url.port || '6379', 10),
          password: url.password || undefined,
          db: url.pathname ? parseInt(url.pathname.slice(1), 10) || undefined : undefined
        }
      } catch {
        logger.error({ redisUrl }, 'Invalid REDIS_URL format')
        return null
      }
    }

    const { host, port, password, db: redisDb } = config.redis

    if (!host) {
      return null
    }

    return {
      host,
      port,
      password: password || undefined,
      db: redisDb || undefined
    }
  }

  // ============ 任务创建 ============

  /**
   * 提交生成大纲任务
   */
  async submitGenerateOutline(
    companyId: string,
    presentationId: string,
    userId: string,
    presConfig: PresentationConfigInput,
    input: GenerateOutlineInput,
    referenceContent?: string
  ): Promise<string> {
    return this.submitTask({
      taskType: 'generate_outline',
      companyId,
      presentationId,
      userId,
      presConfig,
      input,
      referenceContent
    } as Omit<GenerateOutlineJobData, 'taskId'>)
  }

  /**
   * 提交优化大纲任务
   */
  async submitRefineOutline(
    companyId: string,
    presentationId: string,
    userId: string,
    presConfig: PresentationConfigInput,
    input: RefineOutlineInput,
    currentPages: OutlineContentInput[]
  ): Promise<string> {
    return this.submitTask({
      taskType: 'refine_outline',
      companyId,
      presentationId,
      userId,
      presConfig,
      input,
      currentPages
    } as Omit<RefineOutlineJobData, 'taskId'>)
  }

  /**
   * 提交生成描述任务
   */
  async submitGenerateDescriptions(
    companyId: string,
    presentationId: string,
    userId: string,
    presConfig: PresentationConfigInput,
    pages: Array<{ pageId: string; outlineContent: OutlineContentInput }>
  ): Promise<string> {
    return this.submitTask({
      taskType: 'generate_descriptions',
      companyId,
      presentationId,
      userId,
      presConfig,
      pages
    } as Omit<GenerateDescriptionsJobData, 'taskId'>)
  }

  /**
   * 提交优化描述任务
   */
  async submitRefineDescriptions(
    companyId: string,
    presentationId: string,
    userId: string,
    presConfig: PresentationConfigInput,
    input: RefineDescriptionsInput,
    pages: Array<{
      pageId: string
      outlineContent: OutlineContentInput
      descriptionContent: DescriptionContentInput
    }>
  ): Promise<string> {
    return this.submitTask({
      taskType: 'refine_descriptions',
      companyId,
      presentationId,
      userId,
      presConfig,
      input,
      pages
    } as Omit<RefineDescriptionsJobData, 'taskId'>)
  }

  /**
   * 提交批量生成图像任务
   */
  async submitGenerateImages(
    companyId: string,
    presentationId: string,
    userId: string,
    presConfig: PresentationConfigInput,
    pages: Array<{
      pageId: string
      descriptionContent: DescriptionContentInput
    }>
  ): Promise<string> {
    return this.submitTask({
      taskType: 'generate_images',
      companyId,
      presentationId,
      userId,
      presConfig,
      pages
    } as Omit<GenerateImagesJobData, 'taskId'>)
  }

  /**
   * 提交单页图像生成任务
   */
  async submitGenerateSingleImage(
    companyId: string,
    presentationId: string,
    userId: string,
    presConfig: PresentationConfigInput,
    pageId: string,
    descriptionContent: DescriptionContentInput,
    customPrompt?: string
  ): Promise<string> {
    return this.submitTask({
      taskType: 'generate_single_image',
      companyId,
      presentationId,
      userId,
      presConfig,
      pageId,
      descriptionContent,
      customPrompt
    } as Omit<GenerateSingleImageJobData, 'taskId'>)
  }

  /**
   * 提交图像编辑任务
   */
  async submitEditImage(
    companyId: string,
    presentationId: string,
    userId: string,
    presConfig: PresentationConfigInput,
    pageId: string,
    input: EditImageInput,
    currentImageKey: string
  ): Promise<string> {
    return this.submitTask({
      taskType: 'edit_image',
      companyId,
      presentationId,
      userId,
      presConfig,
      pageId,
      input,
      currentImageKey
    } as Omit<EditImageJobData, 'taskId'>)
  }

  /**
   * 提交导出 PPTX 任务
   */
  async submitExportPptx(
    companyId: string,
    presentationId: string,
    userId: string,
    presConfig: PresentationConfigInput,
    input: ExportPresentationInput
  ): Promise<string> {
    return this.submitTask({
      taskType: 'export_pptx',
      companyId,
      presentationId,
      userId,
      presConfig,
      input
    } as Omit<ExportPptxJobData, 'taskId'>)
  }

  /**
   * 提交导出 PDF 任务
   */
  async submitExportPdf(
    companyId: string,
    presentationId: string,
    userId: string,
    presConfig: PresentationConfigInput,
    input: ExportPresentationInput
  ): Promise<string> {
    return this.submitTask({
      taskType: 'export_pdf',
      companyId,
      presentationId,
      userId,
      presConfig,
      input
    } as Omit<ExportPdfJobData, 'taskId'>)
  }

  /**
   * 提交导出可编辑 PPTX 任务
   */
  async submitExportEditablePptx(
    companyId: string,
    presentationId: string,
    userId: string,
    presConfig: PresentationConfigInput,
    input: ExportPresentationInput
  ): Promise<string> {
    return this.submitTask({
      taskType: 'export_editable_pptx',
      companyId,
      presentationId,
      userId,
      presConfig,
      input
    } as Omit<ExportEditablePptxJobData, 'taskId'>)
  }

  /**
   * 提交参考文件解析任务
   */
  async submitParseReferenceFile(
    companyId: string,
    presentationId: string,
    userId: string,
    presConfig: PresentationConfigInput,
    fileBuffer: Buffer,
    fileName: string
  ): Promise<string> {
    return this.submitTask({
      taskType: 'parse_reference_file',
      companyId,
      presentationId,
      userId,
      presConfig,
      fileBase64: fileBuffer.toString('base64'),
      fileName
    } as Omit<ParseReferenceFileJobData, 'taskId'>)
  }

  // ============ 任务查询 ============

  /**
   * 获取任务详情
   */
  async getTask(taskId: string, companyId: string): Promise<typeof presentationTasks.$inferSelect | null> {
    const task = await db.query.presentationTasks.findFirst({
      where: eq(presentationTasks.id, taskId)
    })

    if (!task) {
      return null
    }

    // 通过 presentationId 验证 companyId 归属
    const pres = await db.query.presentations.findFirst({
      where: and(eq(presentations.id, task.presentationId), eq(presentations.companyId, companyId)),
      columns: { id: true }
    })

    if (!pres) {
      return null
    }

    return task
  }

  /**
   * 获取演示文稿的所有任务
   */
  async getTasksByPresentation(
    presentationId: string,
    companyId: string
  ): Promise<Array<typeof presentationTasks.$inferSelect>> {
    // 先验证归属
    const pres = await db.query.presentations.findFirst({
      where: and(eq(presentations.id, presentationId), eq(presentations.companyId, companyId)),
      columns: { id: true }
    })

    if (!pres) {
      return []
    }

    return db.query.presentationTasks.findMany({
      where: eq(presentationTasks.presentationId, presentationId),
      orderBy: desc(presentationTasks.createdAt)
    })
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId: string, companyId: string): Promise<boolean> {
    const task = await this.getTask(taskId, companyId)

    if (!task) {
      return false
    }

    // 只能取消 pending 或 running 的任务
    if (task.status !== 'pending' && task.status !== 'running') {
      return false
    }

    // 尝试从 BullMQ 队列中移除
    if (task.bullmqJobId && this.queue) {
      try {
        const job = await this.queue.getJob(task.bullmqJobId)
        if (job) {
          const state = await job.getState()
          if (state === 'waiting' || state === 'delayed') {
            await job.remove()
          }
        }
      } catch (err) {
        logger.warn(
          { taskId, bullmqJobId: task.bullmqJobId, error: err },
          'Failed to remove BullMQ job during cancellation'
        )
      }
    }

    await updateTaskStatus(taskId, 'cancelled', {
      completedAt: new Date(),
      progress: { currentStep: '已取消' }
    })

    logger.info({ taskId }, 'Presentation task cancelled')
    return true
  }

  // ============ 队列状态 ============

  /**
   * 获取队列状态
   */
  async getQueueStatus(): Promise<{
    waiting: number
    active: number
    completed: number
    failed: number
  } | null> {
    if (!this.queue) return null

    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount()
    ])

    return { waiting, active, completed, failed }
  }

  // ============ 生命周期 ============

  /**
   * 优雅关闭
   */
  async shutdown(): Promise<void> {
    if (this.worker) {
      await this.worker.close()
    }
    if (this.queue) {
      await this.queue.close()
    }
    this.isInitialized = false
    logger.info('Presentation task service shut down')
  }

  // ============ 内部方法 ============

  /**
   * 提交任务通用逻辑：
   * 1. 在 presentation_tasks 表创建记录
   * 2. 加入 BullMQ 队列
   * 3. 更新记录的 bullmqJobId
   */
  private async submitTask(jobDataWithoutTaskId: Omit<PresentationJobData, 'taskId'>): Promise<string> {
    const { taskType, companyId, presentationId, userId } = jobDataWithoutTaskId

    // 验证演示文稿归属
    const pres = await db.query.presentations.findFirst({
      where: and(eq(presentations.id, presentationId), eq(presentations.companyId, companyId)),
      columns: { id: true }
    })

    if (!pres) {
      throw new Error(`Presentation not found: ${presentationId}`)
    }

    // 1. 在数据库创建任务记录
    const [taskRecord] = await db
      .insert(presentationTasks)
      .values({
        presentationId,
        userId,
        taskType,
        status: 'pending',
        progress: { currentStep: '等待队列...' }
      })
      .returning()

    const taskId = taskRecord.id
    const jobData = { ...jobDataWithoutTaskId, taskId } as PresentationJobData

    // 2. 加入 BullMQ 队列
    if (this.queue) {
      try {
        const job = await this.queue.add(taskType, jobData, {
          priority: TASK_PRIORITY[taskType] ?? 5,
          attempts: 2,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 200 }
        })

        // 3. 回写 bullmqJobId
        await db
          .update(presentationTasks)
          .set({ bullmqJobId: job.id, updatedAt: new Date() })
          .where(eq(presentationTasks.id, taskId))

        logger.info({ taskId, taskType, presentationId, bullmqJobId: job.id }, 'Presentation task submitted to queue')
      } catch (err) {
        // 队列提交失败 → 标记数据库记录为失败
        const errorMessage = err instanceof Error ? err.message : String(err)
        await updateTaskStatus(taskId, 'failed', {
          completedAt: new Date(),
          errorMessage: `Queue submission failed: ${errorMessage}`
        })
        throw new Error(`Failed to submit task to queue: ${errorMessage}`)
      }
    } else {
      // 队列不可用 → 同步执行（开发/回退模式）
      logger.warn({ taskId, taskType }, 'Queue not initialized, executing task synchronously')

      // 不在此处 await — 直接在后台执行，避免阻塞调用方
      setImmediate(async () => {
        try {
          await processJob({ data: jobData, id: taskId } as Job<PresentationJobData>)
        } catch (err) {
          logger.error({ taskId, error: err }, 'Synchronous task execution failed')
        }
      })
    }

    return taskId
  }
}

// ============ 导出单例 ============

export const presentationTaskService = new PresentationTaskService()
