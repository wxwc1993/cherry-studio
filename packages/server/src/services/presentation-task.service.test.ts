import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ============ vi.hoisted — 在 vi.mock 工厂中安全引用 ============

const {
  mockDb,
  mockQueueAdd,
  mockQueueGetJob,
  mockQueueGetWaitingCount,
  mockQueueGetActiveCount,
  mockQueueGetCompletedCount,
  mockQueueGetFailedCount,
  mockQueueClose,
  mockWorkerOn,
  mockWorkerClose
} = vi.hoisted(() => ({
  mockDb: {
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: {
      presentations: { findFirst: vi.fn(), findMany: vi.fn() },
      presentationPages: { findFirst: vi.fn(), findMany: vi.fn() },
      presentationTasks: { findFirst: vi.fn(), findMany: vi.fn() }
    }
  },
  mockQueueAdd: vi.fn(),
  mockQueueGetJob: vi.fn(),
  mockQueueGetWaitingCount: vi.fn(),
  mockQueueGetActiveCount: vi.fn(),
  mockQueueGetCompletedCount: vi.fn(),
  mockQueueGetFailedCount: vi.fn(),
  mockQueueClose: vi.fn(),
  mockWorkerOn: vi.fn(),
  mockWorkerClose: vi.fn()
}))

// ============ 模块级别 Mock ============

vi.mock('../config', () => ({
  config: {
    redis: { host: '', port: 6379, password: '', db: 0 },
    flaskWorker: {
      baseUrl: 'http://flask:5000',
      timeoutMs: 5000,
      healthCheckPath: '/health',
      maxRetries: 1,
      retryDelayMs: 100
    }
  }
}))

vi.mock('../models', () => ({
  db: mockDb,
  presentations: { id: 'id', companyId: 'companyId', userId: 'userId' },
  presentationPages: { id: 'id', presentationId: 'presentationId', orderIndex: 'orderIndex' },
  presentationTasks: {
    id: 'id',
    presentationId: 'presentationId',
    status: 'status',
    bullmqJobId: 'bullmqJobId',
    createdAt: 'createdAt'
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

vi.mock('./presentation-proxy.service', () => ({
  FlaskWorkerError: class FlaskWorkerError extends Error {
    constructor(
      message: string,
      public statusCode = 502,
      public flaskError?: string
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
    batchUpsertPages: vi.fn(),
    updatePresentationStatus: vi.fn(),
    getPresentationById: vi.fn(),
    addImageVersion: vi.fn()
  }
}))

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: mockQueueAdd,
    getJob: mockQueueGetJob,
    getWaitingCount: mockQueueGetWaitingCount,
    getActiveCount: mockQueueGetActiveCount,
    getCompletedCount: mockQueueGetCompletedCount,
    getFailedCount: mockQueueGetFailedCount,
    close: mockQueueClose
  })),
  Worker: vi.fn().mockImplementation(() => ({
    on: mockWorkerOn,
    close: mockWorkerClose
  }))
}))

vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

// ============ 导入被测模块和依赖 ============

import { Queue, Worker } from 'bullmq'

import { config } from '../config'
import { presentationService } from './presentation.service'
import { presentationFileService } from './presentation-file.service'
import { presentationProxyService } from './presentation-proxy.service'
import { presentationTaskService } from './presentation-task.service'

// ============ 工具函数 ============

function mockInsertReturning(result: unknown[]) {
  const returning = vi.fn().mockResolvedValue(result)
  const values = vi.fn().mockReturnValue({ returning })
  mockDb.insert.mockReturnValue({ values })
}

function mockUpdateWhere(result?: unknown[]) {
  const returning = vi.fn().mockResolvedValue(result ?? [])
  const whereObj = Object.assign(Promise.resolve(), { returning })
  const where = vi.fn().mockReturnValue(whereObj)
  const set = vi.fn().mockReturnValue({ where })
  mockDb.update.mockReturnValue({ set })
}

const COMPANY_ID = 'company-1'
const PRESENTATION_ID = 'pres-1'
const USER_ID = 'user-1'
const TASK_ID = 'task-1'

const DEFAULT_CONFIG = {
  theme: 'default',
  language: 'zh-cn',
  aspectRatio: '16:9'
}

function resetServiceState() {
  const svc = presentationTaskService as unknown as {
    queue: unknown
    worker: unknown
    isInitialized: boolean
  }
  svc.queue = null
  svc.worker = null
  svc.isInitialized = false
}

function setRedisHost(host: string) {
  ;(config as { redis: { host: string } }).redis.host = host
}

function flushSetImmediate(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(() => {
      // 给 processJob 里的异步操作一点时间
      setTimeout(resolve, 50)
    })
  })
}

// ============ 测试 ============

describe('PresentationTaskService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetServiceState()
    setRedisHost('')
    delete process.env.REDIS_URL
  })

  afterEach(async () => {
    resetServiceState()
  })

  // ========================================
  // 1. initialize()
  // ========================================

  describe('initialize()', () => {
    it('当 Redis host 为空时不创建 Queue 和 Worker', async () => {
      setRedisHost('')

      await presentationTaskService.initialize()

      expect(Queue).not.toHaveBeenCalled()
      expect(Worker).not.toHaveBeenCalled()
    })

    it('当 Redis host 可用时创建 Queue 和 Worker', async () => {
      setRedisHost('redis-host')

      await presentationTaskService.initialize()

      expect(Queue).toHaveBeenCalledWith('presentation-tasks', {
        connection: {
          host: 'redis-host',
          port: 6379,
          password: undefined,
          db: undefined
        }
      })
      expect(Worker).toHaveBeenCalledTimes(1)
      expect(mockWorkerOn).toHaveBeenCalledWith('completed', expect.any(Function))
      expect(mockWorkerOn).toHaveBeenCalledWith('failed', expect.any(Function))
    })

    it('多次调用 initialize 只初始化一次', async () => {
      setRedisHost('redis-host')

      await presentationTaskService.initialize()
      await presentationTaskService.initialize()

      expect(Queue).toHaveBeenCalledTimes(1)
      expect(Worker).toHaveBeenCalledTimes(1)
    })

    it('通过 REDIS_URL 环境变量解析 Redis 连接', async () => {
      process.env.REDIS_URL = 'redis://:mypassword@redis.example.com:6380/2'

      await presentationTaskService.initialize()

      expect(Queue).toHaveBeenCalledWith('presentation-tasks', {
        connection: {
          host: 'redis.example.com',
          port: 6380,
          password: 'mypassword',
          db: 2
        }
      })
    })

    it('REDIS_URL 格式无效时不创建 Queue', async () => {
      process.env.REDIS_URL = 'not-a-valid-url'

      await presentationTaskService.initialize()

      expect(Queue).not.toHaveBeenCalled()
    })

    it('REDIS_URL 不含密码时 password 为 undefined', async () => {
      process.env.REDIS_URL = 'redis://redis.example.com:6379/0'

      await presentationTaskService.initialize()

      expect(Queue).toHaveBeenCalledWith('presentation-tasks', {
        connection: expect.objectContaining({
          host: 'redis.example.com',
          password: undefined
        })
      })
    })
  })

  // ========================================
  // 2. submitTask（通过 submitGenerateOutline 测试）
  // ========================================

  describe('submitTask（通过 submitGenerateOutline）', () => {
    const outlineInput = { topic: '测试演示', pageCount: 5 }

    it('演示文稿不存在时抛出错误', async () => {
      mockDb.query.presentations.findFirst.mockResolvedValue(null)

      await expect(
        presentationTaskService.submitGenerateOutline(
          COMPANY_ID,
          PRESENTATION_ID,
          USER_ID,
          DEFAULT_CONFIG as never,
          outlineInput as never
        )
      ).rejects.toThrow(`Presentation not found: ${PRESENTATION_ID}`)
    })

    it('队列可用时：创建任务记录、加入队列、回写 bullmqJobId', async () => {
      // 设置 Redis 并初始化队列
      setRedisHost('redis-host')
      await presentationTaskService.initialize()

      // 验证演示文稿归属
      mockDb.query.presentations.findFirst.mockResolvedValue({ id: PRESENTATION_ID })

      // 创建任务记录
      mockInsertReturning([{ id: TASK_ID }])

      // queue.add 返回带 id 的 job
      mockQueueAdd.mockResolvedValue({ id: 'bullmq-job-1' })

      // 回写 bullmqJobId 的 update
      mockUpdateWhere()

      const taskId = await presentationTaskService.submitGenerateOutline(
        COMPANY_ID,
        PRESENTATION_ID,
        USER_ID,
        DEFAULT_CONFIG as never,
        outlineInput as never
      )

      expect(taskId).toBe(TASK_ID)

      // 验证 insert 被调用
      expect(mockDb.insert).toHaveBeenCalled()

      // 验证 queue.add 被调用，带正确的 taskType 和 priority
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'generate_outline',
        expect.objectContaining({
          taskId: TASK_ID,
          taskType: 'generate_outline',
          companyId: COMPANY_ID,
          presentationId: PRESENTATION_ID,
          userId: USER_ID,
          input: outlineInput
        }),
        expect.objectContaining({
          priority: 3,
          attempts: 2,
          backoff: { type: 'exponential', delay: 5000 }
        })
      )

      // 验证 update 被调用（回写 bullmqJobId）
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('队列不可用时通过 setImmediate 同步执行任务', async () => {
      // 不初始化队列 → queue 为 null
      mockDb.query.presentations.findFirst.mockResolvedValue({ id: PRESENTATION_ID })
      mockInsertReturning([{ id: TASK_ID }])

      // processJob 内部会调用 updateTaskStatus（running），然后 executeTask，然后 updateTaskStatus（completed）
      // executeTask → generate_outline 分支需要 proxy 和 service 的 mock
      vi.mocked(presentationProxyService.generateOutline).mockResolvedValue({
        pages: [{ title: '第一页', bullets: ['内容1'] }]
      } as never)
      vi.mocked(presentationService.batchUpsertPages).mockResolvedValue(undefined as never)
      vi.mocked(presentationService.updatePresentationStatus).mockResolvedValue(undefined as never)

      // processJob 中的多次 update 调用
      mockUpdateWhere()

      const taskId = await presentationTaskService.submitGenerateOutline(
        COMPANY_ID,
        PRESENTATION_ID,
        USER_ID,
        DEFAULT_CONFIG as never,
        outlineInput as never
      )

      expect(taskId).toBe(TASK_ID)
      expect(mockQueueAdd).not.toHaveBeenCalled()

      // 等待 setImmediate 回调执行
      await flushSetImmediate()

      // processJob 内部调用了 proxy 服务
      expect(presentationProxyService.generateOutline).toHaveBeenCalled()
    })

    it('queue.add 抛出错误时标记任务为失败并抛出异常', async () => {
      setRedisHost('redis-host')
      await presentationTaskService.initialize()

      mockDb.query.presentations.findFirst.mockResolvedValue({ id: PRESENTATION_ID })
      mockInsertReturning([{ id: TASK_ID }])
      mockQueueAdd.mockRejectedValue(new Error('Redis connection refused'))
      mockUpdateWhere()

      await expect(
        presentationTaskService.submitGenerateOutline(
          COMPANY_ID,
          PRESENTATION_ID,
          USER_ID,
          DEFAULT_CONFIG as never,
          outlineInput as never
        )
      ).rejects.toThrow('Failed to submit task to queue: Redis connection refused')

      // 验证 updateTaskStatus 被调用（标记失败）
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('带 referenceContent 提交生成大纲任务', async () => {
      setRedisHost('redis-host')
      await presentationTaskService.initialize()

      mockDb.query.presentations.findFirst.mockResolvedValue({ id: PRESENTATION_ID })
      mockInsertReturning([{ id: TASK_ID }])
      mockQueueAdd.mockResolvedValue({ id: 'bullmq-job-2' })
      mockUpdateWhere()

      await presentationTaskService.submitGenerateOutline(
        COMPANY_ID,
        PRESENTATION_ID,
        USER_ID,
        DEFAULT_CONFIG as never,
        outlineInput as never,
        '参考文件内容'
      )

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'generate_outline',
        expect.objectContaining({
          referenceContent: '参考文件内容'
        }),
        expect.any(Object)
      )
    })
  })

  // ========================================
  // 3. getTask
  // ========================================

  describe('getTask()', () => {
    const mockTask = {
      id: TASK_ID,
      presentationId: PRESENTATION_ID,
      taskType: 'generate_outline',
      status: 'pending',
      userId: USER_ID
    }

    it('任务存在且 companyId 匹配时返回任务', async () => {
      mockDb.query.presentationTasks.findFirst.mockResolvedValue(mockTask)
      mockDb.query.presentations.findFirst.mockResolvedValue({ id: PRESENTATION_ID })

      const result = await presentationTaskService.getTask(TASK_ID, COMPANY_ID)

      expect(result).toEqual(mockTask)
    })

    it('任务不存在时返回 null', async () => {
      mockDb.query.presentationTasks.findFirst.mockResolvedValue(null)

      const result = await presentationTaskService.getTask(TASK_ID, COMPANY_ID)

      expect(result).toBeNull()
    })

    it('companyId 不匹配时返回 null（演示文稿不属于该公司）', async () => {
      mockDb.query.presentationTasks.findFirst.mockResolvedValue(mockTask)
      mockDb.query.presentations.findFirst.mockResolvedValue(null)

      const result = await presentationTaskService.getTask(TASK_ID, 'wrong-company')

      expect(result).toBeNull()
    })
  })

  // ========================================
  // 4. getTasksByPresentation
  // ========================================

  describe('getTasksByPresentation()', () => {
    it('演示文稿归属正确时返回任务列表', async () => {
      const tasks = [
        { id: 'task-2', taskType: 'generate_images', createdAt: new Date() },
        { id: 'task-1', taskType: 'generate_outline', createdAt: new Date(Date.now() - 1000) }
      ]
      mockDb.query.presentations.findFirst.mockResolvedValue({ id: PRESENTATION_ID })
      mockDb.query.presentationTasks.findMany.mockResolvedValue(tasks)

      const result = await presentationTaskService.getTasksByPresentation(PRESENTATION_ID, COMPANY_ID)

      expect(result).toEqual(tasks)
      expect(result).toHaveLength(2)
    })

    it('演示文稿不存在时返回空数组', async () => {
      mockDb.query.presentations.findFirst.mockResolvedValue(null)

      const result = await presentationTaskService.getTasksByPresentation(PRESENTATION_ID, 'wrong-company')

      expect(result).toEqual([])
      expect(mockDb.query.presentationTasks.findMany).not.toHaveBeenCalled()
    })
  })

  // ========================================
  // 5. cancelTask
  // ========================================

  describe('cancelTask()', () => {
    it('取消 pending 任务：移除 BullMQ 任务并更新状态', async () => {
      setRedisHost('redis-host')
      await presentationTaskService.initialize()

      const mockTask = {
        id: TASK_ID,
        presentationId: PRESENTATION_ID,
        status: 'pending',
        bullmqJobId: 'bullmq-job-1'
      }
      mockDb.query.presentationTasks.findFirst.mockResolvedValue(mockTask)
      mockDb.query.presentations.findFirst.mockResolvedValue({ id: PRESENTATION_ID })

      const mockJob = {
        getState: vi.fn().mockResolvedValue('waiting'),
        remove: vi.fn().mockResolvedValue(undefined)
      }
      mockQueueGetJob.mockResolvedValue(mockJob)
      mockUpdateWhere()

      const result = await presentationTaskService.cancelTask(TASK_ID, COMPANY_ID)

      expect(result).toBe(true)
      expect(mockQueueGetJob).toHaveBeenCalledWith('bullmq-job-1')
      expect(mockJob.getState).toHaveBeenCalled()
      expect(mockJob.remove).toHaveBeenCalled()
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('取消 running 任务：更新状态为 cancelled', async () => {
      const mockTask = {
        id: TASK_ID,
        presentationId: PRESENTATION_ID,
        status: 'running',
        bullmqJobId: null
      }
      mockDb.query.presentationTasks.findFirst.mockResolvedValue(mockTask)
      mockDb.query.presentations.findFirst.mockResolvedValue({ id: PRESENTATION_ID })
      mockUpdateWhere()

      const result = await presentationTaskService.cancelTask(TASK_ID, COMPANY_ID)

      expect(result).toBe(true)
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('已完成任务返回 false', async () => {
      const mockTask = {
        id: TASK_ID,
        presentationId: PRESENTATION_ID,
        status: 'completed',
        bullmqJobId: null
      }
      mockDb.query.presentationTasks.findFirst.mockResolvedValue(mockTask)
      mockDb.query.presentations.findFirst.mockResolvedValue({ id: PRESENTATION_ID })

      const result = await presentationTaskService.cancelTask(TASK_ID, COMPANY_ID)

      expect(result).toBe(false)
    })

    it('已失败任务返回 false', async () => {
      const mockTask = {
        id: TASK_ID,
        presentationId: PRESENTATION_ID,
        status: 'failed',
        bullmqJobId: null
      }
      mockDb.query.presentationTasks.findFirst.mockResolvedValue(mockTask)
      mockDb.query.presentations.findFirst.mockResolvedValue({ id: PRESENTATION_ID })

      const result = await presentationTaskService.cancelTask(TASK_ID, COMPANY_ID)

      expect(result).toBe(false)
    })

    it('任务不存在时返回 false', async () => {
      mockDb.query.presentationTasks.findFirst.mockResolvedValue(null)

      const result = await presentationTaskService.cancelTask(TASK_ID, COMPANY_ID)

      expect(result).toBe(false)
    })

    it('BullMQ 任务移除失败时仍然取消任务（优雅降级）', async () => {
      setRedisHost('redis-host')
      await presentationTaskService.initialize()

      const mockTask = {
        id: TASK_ID,
        presentationId: PRESENTATION_ID,
        status: 'pending',
        bullmqJobId: 'bullmq-job-1'
      }
      mockDb.query.presentationTasks.findFirst.mockResolvedValue(mockTask)
      mockDb.query.presentations.findFirst.mockResolvedValue({ id: PRESENTATION_ID })
      mockQueueGetJob.mockRejectedValue(new Error('Redis timeout'))
      mockUpdateWhere()

      const result = await presentationTaskService.cancelTask(TASK_ID, COMPANY_ID)

      expect(result).toBe(true)
      // 尽管 BullMQ 操作失败，仍然更新了数据库状态
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('BullMQ 任务状态非 waiting/delayed 时不调用 remove', async () => {
      setRedisHost('redis-host')
      await presentationTaskService.initialize()

      const mockTask = {
        id: TASK_ID,
        presentationId: PRESENTATION_ID,
        status: 'pending',
        bullmqJobId: 'bullmq-job-1'
      }
      mockDb.query.presentationTasks.findFirst.mockResolvedValue(mockTask)
      mockDb.query.presentations.findFirst.mockResolvedValue({ id: PRESENTATION_ID })

      const mockJob = {
        getState: vi.fn().mockResolvedValue('active'),
        remove: vi.fn()
      }
      mockQueueGetJob.mockResolvedValue(mockJob)
      mockUpdateWhere()

      const result = await presentationTaskService.cancelTask(TASK_ID, COMPANY_ID)

      expect(result).toBe(true)
      expect(mockJob.remove).not.toHaveBeenCalled()
    })

    it('BullMQ 队列中找不到任务时仍然取消', async () => {
      setRedisHost('redis-host')
      await presentationTaskService.initialize()

      const mockTask = {
        id: TASK_ID,
        presentationId: PRESENTATION_ID,
        status: 'pending',
        bullmqJobId: 'bullmq-job-1'
      }
      mockDb.query.presentationTasks.findFirst.mockResolvedValue(mockTask)
      mockDb.query.presentations.findFirst.mockResolvedValue({ id: PRESENTATION_ID })
      mockQueueGetJob.mockResolvedValue(null)
      mockUpdateWhere()

      const result = await presentationTaskService.cancelTask(TASK_ID, COMPANY_ID)

      expect(result).toBe(true)
    })
  })

  // ========================================
  // 6. getQueueStatus
  // ========================================

  describe('getQueueStatus()', () => {
    it('队列为 null 时返回 null', async () => {
      const result = await presentationTaskService.getQueueStatus()

      expect(result).toBeNull()
    })

    it('队列可用时返回各状态计数', async () => {
      setRedisHost('redis-host')
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

  // ========================================
  // 7. shutdown
  // ========================================

  describe('shutdown()', () => {
    it('关闭 Worker 和 Queue 并重置 isInitialized', async () => {
      setRedisHost('redis-host')
      await presentationTaskService.initialize()

      await presentationTaskService.shutdown()

      expect(mockWorkerClose).toHaveBeenCalledTimes(1)
      expect(mockQueueClose).toHaveBeenCalledTimes(1)

      // 验证 isInitialized 已重置 — 再次 initialize 应创建新实例
      vi.clearAllMocks()
      setRedisHost('redis-host')
      await presentationTaskService.initialize()

      expect(Queue).toHaveBeenCalledTimes(1)
    })

    it('worker 和 queue 为 null 时安全调用 shutdown', async () => {
      // 没有初始化，直接调用 shutdown
      await presentationTaskService.shutdown()

      expect(mockWorkerClose).not.toHaveBeenCalled()
      expect(mockQueueClose).not.toHaveBeenCalled()
    })
  })

  // ========================================
  // 8. 各 submit 方法（验证 taskType 传递正确）
  // ========================================

  describe('各 submit 方法的 taskType 验证', () => {
    beforeEach(async () => {
      setRedisHost('redis-host')
      await presentationTaskService.initialize()
      mockDb.query.presentations.findFirst.mockResolvedValue({ id: PRESENTATION_ID })
      mockInsertReturning([{ id: TASK_ID }])
      mockQueueAdd.mockResolvedValue({ id: 'bullmq-job-x' })
      mockUpdateWhere()
    })

    it('submitRefineOutline → taskType: refine_outline', async () => {
      await presentationTaskService.submitRefineOutline(
        COMPANY_ID,
        PRESENTATION_ID,
        USER_ID,
        DEFAULT_CONFIG as never,
        { feedback: '更简洁' } as never,
        [{ title: '页面1', bullets: [] }] as never
      )

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'refine_outline',
        expect.objectContaining({
          taskType: 'refine_outline',
          input: { feedback: '更简洁' },
          currentPages: [{ title: '页面1', bullets: [] }]
        }),
        expect.objectContaining({ priority: 3 })
      )
    })

    it('submitGenerateDescriptions → taskType: generate_descriptions', async () => {
      const pages = [{ pageId: 'page-1', outlineContent: { title: '页面1' } }]

      await presentationTaskService.submitGenerateDescriptions(
        COMPANY_ID,
        PRESENTATION_ID,
        USER_ID,
        DEFAULT_CONFIG as never,
        pages as never
      )

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'generate_descriptions',
        expect.objectContaining({
          taskType: 'generate_descriptions',
          pages
        }),
        expect.objectContaining({ priority: 3 })
      )
    })

    it('submitRefineDescriptions → taskType: refine_descriptions', async () => {
      const input = { feedback: '更详细' }
      const pages = [
        {
          pageId: 'page-1',
          outlineContent: { title: '标题' },
          descriptionContent: { layout: 'full' }
        }
      ]

      await presentationTaskService.submitRefineDescriptions(
        COMPANY_ID,
        PRESENTATION_ID,
        USER_ID,
        DEFAULT_CONFIG as never,
        input as never,
        pages as never
      )

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'refine_descriptions',
        expect.objectContaining({
          taskType: 'refine_descriptions',
          input,
          pages
        }),
        expect.objectContaining({ priority: 3 })
      )
    })

    it('submitGenerateImages → taskType: generate_images', async () => {
      const pages = [{ pageId: 'page-1', descriptionContent: { layout: 'full' } }]

      await presentationTaskService.submitGenerateImages(
        COMPANY_ID,
        PRESENTATION_ID,
        USER_ID,
        DEFAULT_CONFIG as never,
        pages as never
      )

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'generate_images',
        expect.objectContaining({
          taskType: 'generate_images',
          pages
        }),
        expect.objectContaining({ priority: 5 })
      )
    })

    it('submitGenerateSingleImage → taskType: generate_single_image', async () => {
      await presentationTaskService.submitGenerateSingleImage(
        COMPANY_ID,
        PRESENTATION_ID,
        USER_ID,
        DEFAULT_CONFIG as never,
        'page-1',
        { layout: 'full' } as never,
        '自定义提示'
      )

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'generate_single_image',
        expect.objectContaining({
          taskType: 'generate_single_image',
          pageId: 'page-1',
          descriptionContent: { layout: 'full' },
          customPrompt: '自定义提示'
        }),
        expect.objectContaining({ priority: 2 })
      )
    })

    it('submitEditImage → taskType: edit_image', async () => {
      const editInput = { editPrompt: '修改背景颜色' }

      await presentationTaskService.submitEditImage(
        COMPANY_ID,
        PRESENTATION_ID,
        USER_ID,
        DEFAULT_CONFIG as never,
        'page-1',
        editInput as never,
        'images/current.png'
      )

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'edit_image',
        expect.objectContaining({
          taskType: 'edit_image',
          pageId: 'page-1',
          input: editInput,
          currentImageKey: 'images/current.png'
        }),
        expect.objectContaining({ priority: 2 })
      )
    })

    it('submitExportPptx → taskType: export_pptx', async () => {
      const exportInput = { includeNotes: true }

      await presentationTaskService.submitExportPptx(
        COMPANY_ID,
        PRESENTATION_ID,
        USER_ID,
        DEFAULT_CONFIG as never,
        exportInput as never
      )

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'export_pptx',
        expect.objectContaining({
          taskType: 'export_pptx',
          input: exportInput
        }),
        expect.objectContaining({ priority: 4 })
      )
    })

    it('submitExportPdf → taskType: export_pdf', async () => {
      const exportInput = { includeNotes: false }

      await presentationTaskService.submitExportPdf(
        COMPANY_ID,
        PRESENTATION_ID,
        USER_ID,
        DEFAULT_CONFIG as never,
        exportInput as never
      )

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'export_pdf',
        expect.objectContaining({
          taskType: 'export_pdf',
          input: exportInput
        }),
        expect.objectContaining({ priority: 4 })
      )
    })

    it('submitExportEditablePptx → taskType: export_editable_pptx', async () => {
      const exportInput = { includeNotes: true }

      await presentationTaskService.submitExportEditablePptx(
        COMPANY_ID,
        PRESENTATION_ID,
        USER_ID,
        DEFAULT_CONFIG as never,
        exportInput as never
      )

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'export_editable_pptx',
        expect.objectContaining({
          taskType: 'export_editable_pptx',
          input: exportInput
        }),
        expect.objectContaining({ priority: 4 })
      )
    })

    it('submitParseReferenceFile → taskType: parse_reference_file，Buffer 转 base64', async () => {
      const fileBuffer = Buffer.from('PDF文件内容', 'utf-8')
      const expectedBase64 = fileBuffer.toString('base64')

      await presentationTaskService.submitParseReferenceFile(
        COMPANY_ID,
        PRESENTATION_ID,
        USER_ID,
        DEFAULT_CONFIG as never,
        fileBuffer,
        'reference.pdf'
      )

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'parse_reference_file',
        expect.objectContaining({
          taskType: 'parse_reference_file',
          fileBase64: expectedBase64,
          fileName: 'reference.pdf'
        }),
        expect.objectContaining({ priority: 1 })
      )
    })
  })

  // ========================================
  // 9. setImmediate 回退路径的间接测试（processJob + executeTask）
  // ========================================

  describe('setImmediate 回退路径（processJob + executeTask 间接测试）', () => {
    beforeEach(() => {
      // 不初始化队列 → queue=null → 走 setImmediate 路径
      mockDb.query.presentations.findFirst.mockResolvedValue({ id: PRESENTATION_ID })
      mockInsertReturning([{ id: TASK_ID }])
      mockUpdateWhere()
    })

    it('generate_outline：调用 proxy 并更新页面和状态', async () => {
      vi.mocked(presentationProxyService.generateOutline).mockResolvedValue({
        pages: [
          { title: '开篇', bullets: ['要点1'] },
          { title: '结尾', bullets: ['要点2'] }
        ]
      } as never)
      vi.mocked(presentationService.batchUpsertPages).mockResolvedValue(undefined as never)
      vi.mocked(presentationService.updatePresentationStatus).mockResolvedValue(undefined as never)

      await presentationTaskService.submitGenerateOutline(
        COMPANY_ID,
        PRESENTATION_ID,
        USER_ID,
        DEFAULT_CONFIG as never,
        { topic: '测试' } as never
      )

      await flushSetImmediate()

      expect(presentationProxyService.generateOutline).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: COMPANY_ID,
          presentationId: PRESENTATION_ID,
          config: DEFAULT_CONFIG
        }),
        { topic: '测试' },
        undefined
      )
      expect(presentationService.batchUpsertPages).toHaveBeenCalledWith(
        PRESENTATION_ID,
        COMPANY_ID,
        expect.arrayContaining([expect.objectContaining({ orderIndex: 0 }), expect.objectContaining({ orderIndex: 1 })])
      )
      expect(presentationService.updatePresentationStatus).toHaveBeenCalledWith(
        PRESENTATION_ID,
        COMPANY_ID,
        'outline_ready'
      )
    })

    it('refine_outline：调用 proxy 并更新页面', async () => {
      vi.mocked(presentationProxyService.refineOutline).mockResolvedValue({
        pages: [{ title: '优化后标题', bullets: ['优化要点'] }]
      } as never)
      vi.mocked(presentationService.batchUpsertPages).mockResolvedValue(undefined as never)

      await presentationTaskService.submitRefineOutline(
        COMPANY_ID,
        PRESENTATION_ID,
        USER_ID,
        DEFAULT_CONFIG as never,
        { feedback: '简化' } as never,
        [{ title: '原标题' }] as never
      )

      await flushSetImmediate()

      expect(presentationProxyService.refineOutline).toHaveBeenCalled()
      expect(presentationService.batchUpsertPages).toHaveBeenCalled()
    })

    it('generate_descriptions：逐页更新描述并更新状态', async () => {
      vi.mocked(presentationProxyService.generateDescriptions).mockResolvedValue({
        pages: [
          { pageId: 'page-1', descriptionContent: { layout: 'full', elements: [] } },
          { pageId: 'page-2', descriptionContent: { layout: 'split', elements: [] } }
        ]
      } as never)
      vi.mocked(presentationService.updatePresentationStatus).mockResolvedValue(undefined as never)

      await presentationTaskService.submitGenerateDescriptions(
        COMPANY_ID,
        PRESENTATION_ID,
        USER_ID,
        DEFAULT_CONFIG as never,
        [
          { pageId: 'page-1', outlineContent: { title: '页面1' } },
          { pageId: 'page-2', outlineContent: { title: '页面2' } }
        ] as never
      )

      await flushSetImmediate()

      expect(presentationProxyService.generateDescriptions).toHaveBeenCalled()
      // update 会被多次调用：updateTaskStatus(running) + 逐页 update + updateTaskProgress + updateTaskStatus(completed)
      expect(mockDb.update).toHaveBeenCalled()
      expect(presentationService.updatePresentationStatus).toHaveBeenCalledWith(
        PRESENTATION_ID,
        COMPANY_ID,
        'descriptions_ready'
      )
    })

    it('generate_images：调用 proxy 并保存图像', async () => {
      const mockImageBuffer = Buffer.from('fake-png')
      vi.mocked(presentationProxyService.generateImages).mockResolvedValue({
        images: [{ pageId: 'page-1', imageBuffer: mockImageBuffer, mimeType: 'image/png' }]
      } as never)
      vi.mocked(presentationFileService.uploadGeneratedImage).mockResolvedValue('images/page-1.png')
      vi.mocked(presentationService.addImageVersion).mockResolvedValue(undefined as never)
      vi.mocked(presentationService.updatePresentationStatus).mockResolvedValue(undefined as never)

      await presentationTaskService.submitGenerateImages(
        COMPANY_ID,
        PRESENTATION_ID,
        USER_ID,
        DEFAULT_CONFIG as never,
        [{ pageId: 'page-1', descriptionContent: { layout: 'full' } }] as never
      )

      await flushSetImmediate()

      expect(presentationProxyService.generateImages).toHaveBeenCalled()
      expect(presentationFileService.uploadGeneratedImage).toHaveBeenCalledWith(
        COMPANY_ID,
        PRESENTATION_ID,
        'page-1',
        mockImageBuffer,
        'image/png'
      )
      expect(presentationService.addImageVersion).toHaveBeenCalledWith('page-1', 'images/page-1.png')
      expect(presentationService.updatePresentationStatus).toHaveBeenCalledWith(
        PRESENTATION_ID,
        COMPANY_ID,
        'images_ready'
      )
    })

    it('generate_single_image：生成单页图像并保存', async () => {
      const mockImageBuffer = Buffer.from('single-png')
      vi.mocked(presentationProxyService.generateSingleImage).mockResolvedValue({
        pageId: 'page-1',
        imageBuffer: mockImageBuffer,
        mimeType: 'image/png'
      } as never)
      vi.mocked(presentationFileService.uploadGeneratedImage).mockResolvedValue('images/single.png')
      vi.mocked(presentationService.addImageVersion).mockResolvedValue(undefined as never)

      await presentationTaskService.submitGenerateSingleImage(
        COMPANY_ID,
        PRESENTATION_ID,
        USER_ID,
        DEFAULT_CONFIG as never,
        'page-1',
        { layout: 'full' } as never,
        '自定义提示'
      )

      await flushSetImmediate()

      expect(presentationProxyService.generateSingleImage).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: COMPANY_ID }),
        'page-1',
        { layout: 'full' },
        '自定义提示'
      )
      expect(presentationFileService.uploadGeneratedImage).toHaveBeenCalled()
      expect(presentationService.addImageVersion).toHaveBeenCalledWith('page-1', 'images/single.png')
    })

    it('edit_image：编辑图像并保存新版本', async () => {
      const mockImageBuffer = Buffer.from('edited-png')
      vi.mocked(presentationProxyService.editImage).mockResolvedValue({
        pageId: 'page-1',
        imageBuffer: mockImageBuffer,
        mimeType: 'image/png'
      } as never)
      vi.mocked(presentationFileService.uploadGeneratedImage).mockResolvedValue('images/edited.png')
      vi.mocked(presentationService.addImageVersion).mockResolvedValue(undefined as never)

      await presentationTaskService.submitEditImage(
        COMPANY_ID,
        PRESENTATION_ID,
        USER_ID,
        DEFAULT_CONFIG as never,
        'page-1',
        { editPrompt: '修改颜色' } as never,
        'images/old.png'
      )

      await flushSetImmediate()

      expect(presentationProxyService.editImage).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: COMPANY_ID }),
        'page-1',
        { editPrompt: '修改颜色' },
        'images/old.png'
      )
      expect(presentationFileService.uploadGeneratedImage).toHaveBeenCalled()
    })

    it('export_pptx：导出并存储文件', async () => {
      const exportBuffer = Buffer.from('pptx-content')
      vi.mocked(presentationService.getPresentationById).mockResolvedValue({
        pages: [
          {
            orderIndex: 0,
            outlineContent: { title: '页面1' },
            descriptionContent: null,
            generatedImageKey: 'img/1.png'
          }
        ]
      } as never)
      vi.mocked(presentationProxyService.exportPptx).mockResolvedValue({
        buffer: exportBuffer,
        fileName: 'presentation.pptx',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      } as never)
      vi.mocked(presentationFileService.storeExportFile).mockResolvedValue('exports/pres.pptx')

      await presentationTaskService.submitExportPptx(
        COMPANY_ID,
        PRESENTATION_ID,
        USER_ID,
        DEFAULT_CONFIG as never,
        { includeNotes: true } as never
      )

      await flushSetImmediate()

      expect(presentationService.getPresentationById).toHaveBeenCalledWith(PRESENTATION_ID, COMPANY_ID)
      expect(presentationProxyService.exportPptx).toHaveBeenCalled()
      expect(presentationFileService.storeExportFile).toHaveBeenCalledWith(
        COMPANY_ID,
        PRESENTATION_ID,
        exportBuffer,
        'presentation.pptx',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      )
    })

    it('export_pdf：导出 PDF 并存储', async () => {
      const exportBuffer = Buffer.from('pdf-content')
      vi.mocked(presentationService.getPresentationById).mockResolvedValue({
        pages: [
          {
            orderIndex: 0,
            outlineContent: { title: '页面1' },
            descriptionContent: null,
            generatedImageKey: null
          }
        ]
      } as never)
      vi.mocked(presentationProxyService.exportPdf).mockResolvedValue({
        buffer: exportBuffer,
        fileName: 'presentation.pdf',
        mimeType: 'application/pdf'
      } as never)
      vi.mocked(presentationFileService.storeExportFile).mockResolvedValue('exports/pres.pdf')

      await presentationTaskService.submitExportPdf(
        COMPANY_ID,
        PRESENTATION_ID,
        USER_ID,
        DEFAULT_CONFIG as never,
        { includeNotes: false } as never
      )

      await flushSetImmediate()

      expect(presentationProxyService.exportPdf).toHaveBeenCalled()
      expect(presentationFileService.storeExportFile).toHaveBeenCalledWith(
        COMPANY_ID,
        PRESENTATION_ID,
        exportBuffer,
        'presentation.pdf',
        'application/pdf'
      )
    })

    it('export_editable_pptx：导出可编辑 PPTX', async () => {
      const exportBuffer = Buffer.from('editable-pptx')
      vi.mocked(presentationService.getPresentationById).mockResolvedValue({
        pages: [
          {
            orderIndex: 0,
            outlineContent: { title: '页面1' },
            descriptionContent: { layout: 'full' },
            generatedImageKey: 'img/1.png'
          }
        ]
      } as never)
      vi.mocked(presentationProxyService.exportEditablePptx).mockResolvedValue({
        buffer: exportBuffer,
        fileName: 'editable.pptx',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      } as never)
      vi.mocked(presentationFileService.storeExportFile).mockResolvedValue('exports/editable.pptx')

      await presentationTaskService.submitExportEditablePptx(
        COMPANY_ID,
        PRESENTATION_ID,
        USER_ID,
        DEFAULT_CONFIG as never,
        { includeNotes: true } as never
      )

      await flushSetImmediate()

      expect(presentationProxyService.exportEditablePptx).toHaveBeenCalled()
      expect(presentationFileService.storeExportFile).toHaveBeenCalled()
    })

    it('parse_reference_file：Buffer 转 base64 后解析', async () => {
      vi.mocked(presentationProxyService.parseReferenceFile).mockResolvedValue({
        markdownContent: '# 解析内容\n正文...'
      } as never)

      const fileBuffer = Buffer.from('参考文件原始内容', 'utf-8')

      await presentationTaskService.submitParseReferenceFile(
        COMPANY_ID,
        PRESENTATION_ID,
        USER_ID,
        DEFAULT_CONFIG as never,
        fileBuffer,
        'reference.docx'
      )

      await flushSetImmediate()

      expect(presentationProxyService.parseReferenceFile).toHaveBeenCalledWith(
        COMPANY_ID,
        expect.any(Buffer),
        'reference.docx'
      )
    })

    it('refine_descriptions：调用 proxy 并逐页更新', async () => {
      vi.mocked(presentationProxyService.refineDescriptions).mockResolvedValue({
        pages: [{ pageId: 'page-1', descriptionContent: { layout: 'refined' } }]
      } as never)

      await presentationTaskService.submitRefineDescriptions(
        COMPANY_ID,
        PRESENTATION_ID,
        USER_ID,
        DEFAULT_CONFIG as never,
        { feedback: '优化' } as never,
        [
          {
            pageId: 'page-1',
            outlineContent: { title: '标题' },
            descriptionContent: { layout: 'original' }
          }
        ] as never
      )

      await flushSetImmediate()

      expect(presentationProxyService.refineDescriptions).toHaveBeenCalled()
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('executeTask 抛出异常时标记任务为 failed', async () => {
      vi.mocked(presentationProxyService.generateOutline).mockRejectedValue(new Error('Flask 服务不可用'))

      await presentationTaskService.submitGenerateOutline(
        COMPANY_ID,
        PRESENTATION_ID,
        USER_ID,
        DEFAULT_CONFIG as never,
        { topic: '测试' } as never
      )

      await flushSetImmediate()

      // processJob 捕获异常后调用 updateTaskStatus(taskId, 'failed', ...)
      // 这会触发 mockDb.update
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('export 时演示文稿不存在会触发失败', async () => {
      vi.mocked(presentationService.getPresentationById).mockResolvedValue(null as never)

      await presentationTaskService.submitExportPptx(
        COMPANY_ID,
        PRESENTATION_ID,
        USER_ID,
        DEFAULT_CONFIG as never,
        { includeNotes: true } as never
      )

      await flushSetImmediate()

      // getExportPages 会抛出 Error，processJob 会捕获并标记为 failed
      expect(mockDb.update).toHaveBeenCalled()
    })
  })
})
