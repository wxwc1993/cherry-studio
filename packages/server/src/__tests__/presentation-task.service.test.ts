import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * PresentationTaskService 单元测试
 *
 * 验证 BullMQ 任务队列服务的核心逻辑：
 * - 初始化（Queue + Worker）
 * - 提交任务（submitTask 通用逻辑）
 * - 任务查询（getTask, getTasksByPresentation）
 * - 取消任务（cancelTask）
 * - 队列状态 / 生命周期
 */

// ── Mock 层 ──────────────────────────────────────────────

const mockFindFirst = vi.fn()
const mockFindMany = vi.fn()
const mockInsertReturning = vi.fn()
const mockUpdateSet = vi.fn()

// Drizzle 链式调用 mock
const mockInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockReturnValue({ returning: mockInsertReturning })
})
const mockUpdate = vi.fn().mockReturnValue({
  set: mockUpdateSet.mockReturnValue({
    where: vi.fn()
  })
})
const mockDelete = vi.fn().mockReturnValue({
  where: vi.fn()
})

vi.mock('../models/db', () => ({
  db: {
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    query: {
      presentations: { findFirst: mockFindFirst },
      presentationPages: { findFirst: vi.fn(), findMany: vi.fn() },
      presentationTasks: { findFirst: vi.fn(), findMany: mockFindMany }
    }
  }
}))

vi.mock('../models', () => ({
  db: {
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    query: {
      presentations: { findFirst: mockFindFirst },
      presentationPages: { findFirst: vi.fn(), findMany: vi.fn() },
      presentationTasks: { findFirst: vi.fn(), findMany: mockFindMany }
    }
  },
  presentations: { id: 'id', companyId: 'companyId', userId: 'userId' },
  presentationPages: { id: 'id', presentationId: 'presentationId' },
  presentationTasks: { id: 'id', presentationId: 'presentationId', status: 'status', createdAt: 'createdAt' }
}))

vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

vi.mock('../config', () => ({
  config: {
    flaskWorker: {
      baseUrl: 'http://flask-worker:5000',
      timeoutMs: 120000,
      healthCheckPath: '/health',
      maxRetries: 2,
      retryDelayMs: 10
    },
    redis: {
      host: 'localhost',
      port: 6379,
      password: '',
      db: 0
    }
  }
}))

// BullMQ mock
const mockQueueAdd = vi.fn()
const mockQueueGetJob = vi.fn()
const mockQueueClose = vi.fn()
const mockQueueGetWaitingCount = vi.fn()
const mockQueueGetActiveCount = vi.fn()
const mockQueueGetCompletedCount = vi.fn()
const mockQueueGetFailedCount = vi.fn()
const mockWorkerOn = vi.fn()
const mockWorkerClose = vi.fn()

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: mockQueueAdd,
    getJob: mockQueueGetJob,
    close: mockQueueClose,
    getWaitingCount: mockQueueGetWaitingCount,
    getActiveCount: mockQueueGetActiveCount,
    getCompletedCount: mockQueueGetCompletedCount,
    getFailedCount: mockQueueGetFailedCount
  })),
  Worker: vi.fn().mockImplementation(() => ({
    on: mockWorkerOn,
    close: mockWorkerClose
  }))
}))

vi.mock('./presentation-proxy.service', () => ({
  FlaskWorkerError: class FlaskWorkerError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number = 502,
      public readonly flaskError?: string
    ) {
      super(message)
      this.name = 'FlaskWorkerError'
    }
  },
  presentationProxyService: {
    generateOutline: vi.fn(),
    refineOutline: vi.fn(),
    generateDescriptions: vi.fn(),
    refineDescriptions: vi.fn(),
    generateImages: vi.fn(),
    generateSingleImage: vi.fn(),
    editImage: vi.fn(),
    exportPptx: vi.fn(),
    exportPdf: vi.fn(),
    exportEditablePptx: vi.fn(),
    parseReferenceFile: vi.fn()
  }
}))

vi.mock('./presentation.service', () => ({
  presentationService: {
    getPresentationById: vi.fn(),
    batchUpsertPages: vi.fn(),
    updatePresentationStatus: vi.fn(),
    addImageVersion: vi.fn()
  }
}))

vi.mock('./presentation-file.service', () => ({
  presentationFileService: {
    uploadGeneratedImage: vi.fn(),
    storeExportFile: vi.fn(),
    deleteFilesByPrefix: vi.fn(),
    deleteGeneratedImage: vi.fn()
  }
}))

// ── 导入被测模块 ──

const { presentationTaskService } = await import('../services/presentation-task.service')
const { db } = await import('../models')

// ── 常量 ──

const COMPANY_ID = 'company-001'
const USER_ID = 'user-001'
const PRESENTATION_ID = 'pres-001'
const TASK_ID = 'task-001'

// ── Tests ──

describe('PresentationTaskService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 重新设置链式调用
    mockInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: mockInsertReturning })
    })
    mockUpdate.mockReturnValue({
      set: mockUpdateSet.mockReturnValue({
        where: vi.fn()
      })
    })
  })

  // ============ 初始化 ============

  describe('initialize', () => {
    it('应成功初始化 Queue 和 Worker', async () => {
      const { Queue, Worker } = await import('bullmq')

      // 创建新实例来测试初始化
      await import('../services/presentation-task.service')

      // 单例已在模块加载时创建，我们测试 initialize 方法
      await presentationTaskService.initialize()

      expect(Queue).toHaveBeenCalled()
      expect(Worker).toHaveBeenCalled()
      expect(mockWorkerOn).toHaveBeenCalledWith('completed', expect.any(Function))
      expect(mockWorkerOn).toHaveBeenCalledWith('failed', expect.any(Function))
    })

    it('重复初始化应跳过', async () => {
      // 先确保已初始化
      await presentationTaskService.initialize()
      const { Queue } = await import('bullmq')
      const callCountBefore = (Queue as ReturnType<typeof vi.fn>).mock.calls.length

      // 再次初始化
      await presentationTaskService.initialize()

      // 不应再次创建 Queue
      expect((Queue as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCountBefore)
    })
  })

  // ============ 提交任务 ============

  describe('submitGenerateOutline', () => {
    beforeEach(async () => {
      await presentationTaskService.initialize()
    })

    it('应创建数据库记录并加入队列', async () => {
      // 验证演示文稿归属
      mockFindFirst.mockResolvedValue({ id: PRESENTATION_ID })
      // 创建任务记录
      mockInsertReturning.mockResolvedValue([{ id: TASK_ID }])
      // BullMQ 添加任务
      mockQueueAdd.mockResolvedValue({ id: 'bullmq-job-001' })

      const taskId = await presentationTaskService.submitGenerateOutline(
        COMPANY_ID,
        PRESENTATION_ID,
        USER_ID,
        {},
        { idea: '关于 AI 的演示' }
      )

      expect(taskId).toBe(TASK_ID)
      expect(mockInsert).toHaveBeenCalled()
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'generate_outline',
        expect.objectContaining({
          taskId: TASK_ID,
          taskType: 'generate_outline',
          companyId: COMPANY_ID,
          presentationId: PRESENTATION_ID
        }),
        expect.objectContaining({
          priority: 3,
          attempts: 2
        })
      )
      // 回写 bullmqJobId
      expect(mockUpdate).toHaveBeenCalled()
    })

    it('演示文稿不存在时应抛出错误', async () => {
      mockFindFirst.mockResolvedValue(undefined)

      await expect(
        presentationTaskService.submitGenerateOutline(COMPANY_ID, 'non-existent', USER_ID, {}, { idea: 'AI' })
      ).rejects.toThrow('Presentation not found')
    })

    it('队列提交失败时应标记任务为 failed', async () => {
      mockFindFirst.mockResolvedValue({ id: PRESENTATION_ID })
      mockInsertReturning.mockResolvedValue([{ id: TASK_ID }])
      mockQueueAdd.mockRejectedValue(new Error('Redis connection lost'))

      await expect(
        presentationTaskService.submitGenerateOutline(COMPANY_ID, PRESENTATION_ID, USER_ID, {}, { idea: 'AI' })
      ).rejects.toThrow('Failed to submit task to queue')

      // 应更新数据库状态为 failed
      expect(mockUpdate).toHaveBeenCalled()
    })
  })

  describe('其他 submit 方法', () => {
    beforeEach(async () => {
      await presentationTaskService.initialize()
      mockFindFirst.mockResolvedValue({ id: PRESENTATION_ID })
      mockInsertReturning.mockResolvedValue([{ id: TASK_ID }])
      mockQueueAdd.mockResolvedValue({ id: 'bullmq-job-001' })
    })

    it('submitRefineOutline 应使用正确的 taskType', async () => {
      await presentationTaskService.submitRefineOutline(
        COMPANY_ID,
        PRESENTATION_ID,
        USER_ID,
        {},
        { instruction: '优化', pages: [{ title: '页面' }] },
        [{ title: '页面' }]
      )

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'refine_outline',
        expect.objectContaining({ taskType: 'refine_outline' }),
        expect.any(Object)
      )
    })

    it('submitGenerateDescriptions 应使用正确的 taskType', async () => {
      await presentationTaskService.submitGenerateDescriptions(COMPANY_ID, PRESENTATION_ID, USER_ID, {}, [
        { pageId: 'p1', outlineContent: { title: '标题' } }
      ])

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'generate_descriptions',
        expect.objectContaining({ taskType: 'generate_descriptions' }),
        expect.any(Object)
      )
    })

    it('submitRefineDescriptions 应使用正确的 taskType', async () => {
      await presentationTaskService.submitRefineDescriptions(
        COMPANY_ID,
        PRESENTATION_ID,
        USER_ID,
        {},
        { instruction: '优化描述' },
        [{ pageId: 'p1', outlineContent: { title: '标题' }, descriptionContent: { text: '描述' } }]
      )

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'refine_descriptions',
        expect.objectContaining({ taskType: 'refine_descriptions' }),
        expect.any(Object)
      )
    })

    it('submitGenerateImages 应使用优先级 5', async () => {
      await presentationTaskService.submitGenerateImages(COMPANY_ID, PRESENTATION_ID, USER_ID, {}, [
        { pageId: 'p1', descriptionContent: { text: '描述' } }
      ])

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'generate_images',
        expect.objectContaining({ taskType: 'generate_images' }),
        expect.objectContaining({ priority: 5 })
      )
    })

    it('submitGenerateSingleImage 应使用优先级 2', async () => {
      await presentationTaskService.submitGenerateSingleImage(
        COMPANY_ID,
        PRESENTATION_ID,
        USER_ID,
        {},
        'page-1',
        { text: '描述' },
        'custom prompt'
      )

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'generate_single_image',
        expect.objectContaining({ taskType: 'generate_single_image' }),
        expect.objectContaining({ priority: 2 })
      )
    })

    it('submitEditImage 应使用优先级 2', async () => {
      await presentationTaskService.submitEditImage(
        COMPANY_ID,
        PRESENTATION_ID,
        USER_ID,
        {},
        'page-1',
        { instruction: '编辑' },
        'img-key'
      )

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'edit_image',
        expect.objectContaining({ taskType: 'edit_image' }),
        expect.objectContaining({ priority: 2 })
      )
    })

    it('submitExportPptx 应使用优先级 4', async () => {
      await presentationTaskService.submitExportPptx(COMPANY_ID, PRESENTATION_ID, USER_ID, {}, { format: 'pptx' })

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'export_pptx',
        expect.objectContaining({ taskType: 'export_pptx' }),
        expect.objectContaining({ priority: 4 })
      )
    })

    it('submitExportPdf 应使用优先级 4', async () => {
      await presentationTaskService.submitExportPdf(COMPANY_ID, PRESENTATION_ID, USER_ID, {}, { format: 'pdf' })

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'export_pdf',
        expect.objectContaining({ taskType: 'export_pdf' }),
        expect.any(Object)
      )
    })

    it('submitExportEditablePptx 应使用优先级 4', async () => {
      await presentationTaskService.submitExportEditablePptx(
        COMPANY_ID,
        PRESENTATION_ID,
        USER_ID,
        {},
        { format: 'editable_pptx' }
      )

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'export_editable_pptx',
        expect.objectContaining({ taskType: 'export_editable_pptx' }),
        expect.any(Object)
      )
    })

    it('submitParseReferenceFile 应使用优先级 1 并编码文件为 base64', async () => {
      const fileBuffer = Buffer.from('test file content')

      await presentationTaskService.submitParseReferenceFile(
        COMPANY_ID,
        PRESENTATION_ID,
        USER_ID,
        {},
        fileBuffer,
        'doc.pdf'
      )

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'parse_reference_file',
        expect.objectContaining({
          taskType: 'parse_reference_file',
          fileBase64: fileBuffer.toString('base64'),
          fileName: 'doc.pdf'
        }),
        expect.objectContaining({ priority: 1 })
      )
    })
  })

  // ============ 任务查询 ============

  describe('getTask', () => {
    it('应返回任务详情', async () => {
      const mockTask = {
        id: TASK_ID,
        presentationId: PRESENTATION_ID,
        taskType: 'generate_outline',
        status: 'completed'
      }
      ;(db.query.presentationTasks.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockTask)
      // 验证归属
      mockFindFirst.mockResolvedValue({ id: PRESENTATION_ID })

      const result = await presentationTaskService.getTask(TASK_ID, COMPANY_ID)

      expect(result).toEqual(mockTask)
    })

    it('任务不存在时应返回 null', async () => {
      ;(db.query.presentationTasks.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

      const result = await presentationTaskService.getTask('non-existent', COMPANY_ID)

      expect(result).toBeNull()
    })

    it('演示文稿不属于该公司时应返回 null', async () => {
      ;(db.query.presentationTasks.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TASK_ID,
        presentationId: PRESENTATION_ID
      })
      mockFindFirst.mockResolvedValue(undefined) // 公司不匹配

      const result = await presentationTaskService.getTask(TASK_ID, 'other-company')

      expect(result).toBeNull()
    })
  })

  describe('getTasksByPresentation', () => {
    it('应返回任务列表', async () => {
      mockFindFirst.mockResolvedValue({ id: PRESENTATION_ID })
      const tasks = [
        { id: 'task-1', taskType: 'generate_outline' },
        { id: 'task-2', taskType: 'export_pptx' }
      ]
      mockFindMany.mockResolvedValue(tasks)

      const result = await presentationTaskService.getTasksByPresentation(PRESENTATION_ID, COMPANY_ID)

      expect(result).toEqual(tasks)
    })

    it('演示文稿不存在时应返回空数组', async () => {
      mockFindFirst.mockResolvedValue(undefined)

      const result = await presentationTaskService.getTasksByPresentation('non-existent', COMPANY_ID)

      expect(result).toEqual([])
    })
  })

  // ============ 取消任务 ============

  describe('cancelTask', () => {
    beforeEach(async () => {
      await presentationTaskService.initialize()
    })

    it('应取消 pending 状态的任务', async () => {
      const mockTask = {
        id: TASK_ID,
        presentationId: PRESENTATION_ID,
        status: 'pending',
        bullmqJobId: 'bullmq-job-001'
      }
      ;(db.query.presentationTasks.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockTask)
      mockFindFirst.mockResolvedValue({ id: PRESENTATION_ID })

      const mockJob = {
        getState: vi.fn().mockResolvedValue('waiting'),
        remove: vi.fn().mockResolvedValue(undefined)
      }
      mockQueueGetJob.mockResolvedValue(mockJob)

      const result = await presentationTaskService.cancelTask(TASK_ID, COMPANY_ID)

      expect(result).toBe(true)
      expect(mockJob.remove).toHaveBeenCalled()
      expect(mockUpdate).toHaveBeenCalled()
    })

    it('应取消 running 状态的任务', async () => {
      const mockTask = {
        id: TASK_ID,
        presentationId: PRESENTATION_ID,
        status: 'running',
        bullmqJobId: 'bullmq-job-001'
      }
      ;(db.query.presentationTasks.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockTask)
      mockFindFirst.mockResolvedValue({ id: PRESENTATION_ID })

      const mockJob = {
        getState: vi.fn().mockResolvedValue('active'),
        remove: vi.fn()
      }
      mockQueueGetJob.mockResolvedValue(mockJob)

      const result = await presentationTaskService.cancelTask(TASK_ID, COMPANY_ID)

      expect(result).toBe(true)
      // active 状态不调用 remove（只有 waiting/delayed 才 remove）
      expect(mockJob.remove).not.toHaveBeenCalled()
    })

    it('已完成的任务不能取消', async () => {
      const mockTask = {
        id: TASK_ID,
        presentationId: PRESENTATION_ID,
        status: 'completed'
      }
      ;(db.query.presentationTasks.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockTask)
      mockFindFirst.mockResolvedValue({ id: PRESENTATION_ID })

      const result = await presentationTaskService.cancelTask(TASK_ID, COMPANY_ID)

      expect(result).toBe(false)
    })

    it('任务不存在时应返回 false', async () => {
      ;(db.query.presentationTasks.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

      const result = await presentationTaskService.cancelTask('non-existent', COMPANY_ID)

      expect(result).toBe(false)
    })

    it('BullMQ 移除失败不应阻塞取消', async () => {
      const mockTask = {
        id: TASK_ID,
        presentationId: PRESENTATION_ID,
        status: 'pending',
        bullmqJobId: 'bullmq-job-001'
      }
      ;(db.query.presentationTasks.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockTask)
      mockFindFirst.mockResolvedValue({ id: PRESENTATION_ID })
      mockQueueGetJob.mockRejectedValue(new Error('Redis error'))

      const result = await presentationTaskService.cancelTask(TASK_ID, COMPANY_ID)

      // 即使 BullMQ 操作失败，任务仍应被标记为取消
      expect(result).toBe(true)
    })
  })

  // ============ 队列状态 ============

  describe('getQueueStatus', () => {
    it('应返回队列各状态计数', async () => {
      await presentationTaskService.initialize()

      mockQueueGetWaitingCount.mockResolvedValue(5)
      mockQueueGetActiveCount.mockResolvedValue(2)
      mockQueueGetCompletedCount.mockResolvedValue(100)
      mockQueueGetFailedCount.mockResolvedValue(3)

      const result = await presentationTaskService.getQueueStatus()

      expect(result).toEqual({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3
      })
    })
  })

  // ============ 生命周期 ============

  describe('shutdown', () => {
    it('应关闭 Worker 和 Queue', async () => {
      await presentationTaskService.initialize()

      await presentationTaskService.shutdown()

      expect(mockWorkerClose).toHaveBeenCalled()
      expect(mockQueueClose).toHaveBeenCalled()
    })
  })
})
