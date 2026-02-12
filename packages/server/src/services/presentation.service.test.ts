import { beforeEach, describe, expect, it, vi } from 'vitest'

// ============ vi.hoisted — 声明在 vi.mock 工厂中可引用的变量 ============

const {
  mockLogger,
  mockInsert,
  mockUpdate,
  mockDelete,
  mockSelect,
  mockQuery,
  mockDeleteFilesByPrefix,
  mockDeleteGeneratedImage
} = vi.hoisted(() => ({
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  },
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockSelect: vi.fn(),
  mockQuery: {
    presentations: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    },
    presentationPages: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    },
    presentationSettings: {
      findFirst: vi.fn()
    },
    presentationImageVersions: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    }
  },
  mockDeleteFilesByPrefix: vi.fn().mockResolvedValue(undefined),
  mockDeleteGeneratedImage: vi.fn().mockResolvedValue(undefined)
}))

// ============ Mock 辅助函数 ============

/**
 * 构建 Drizzle insert 链式 mock：db.insert(table).values(data).returning()
 */
function createInsertChain(returnValue: unknown[]) {
  return vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue(returnValue)
    })
  })
}

// ============ Mock 模块 ============

vi.mock('../utils/logger', () => ({
  createLogger: vi.fn(() => mockLogger)
}))

vi.mock('./presentation-file.service', () => ({
  presentationFileService: {
    deleteFilesByPrefix: mockDeleteFilesByPrefix,
    deleteGeneratedImage: mockDeleteGeneratedImage
  }
}))

vi.mock('../models', () => ({
  db: {
    query: mockQuery,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    select: mockSelect
  },
  presentations: {
    id: 'presentations.id',
    companyId: 'presentations.companyId',
    userId: 'presentations.userId',
    title: 'presentations.title',
    status: 'presentations.status',
    createdAt: 'presentations.createdAt',
    updatedAt: 'presentations.updatedAt',
    pageCount: 'presentations.pageCount',
    config: 'presentations.config'
  },
  presentationPages: {
    id: 'presentationPages.id',
    presentationId: 'presentationPages.presentationId',
    orderIndex: 'presentationPages.orderIndex',
    generatedImageKey: 'presentationPages.generatedImageKey'
  },
  presentationSettings: {
    companyId: 'presentationSettings.companyId'
  },
  presentationImageVersions: {
    id: 'presentationImageVersions.id',
    pageId: 'presentationImageVersions.pageId',
    isCurrent: 'presentationImageVersions.isCurrent',
    versionNumber: 'presentationImageVersions.versionNumber'
  },
  presentationTasks: {
    presentationId: 'presentationTasks.presentationId',
    taskType: 'presentationTasks.taskType',
    status: 'presentationTasks.status'
  }
}))

// ============ 导入被测服务（必须在 vi.mock 之后） ============

import { presentationService } from './presentation.service'

// ============ 常用测试数据 ============

const COMPANY_ID = 'c0a80101-0000-0000-0000-000000000001'
const USER_ID = 'u0a80101-0000-0000-0000-000000000001'
const PRESENTATION_ID = 'p0a80101-0000-0000-0000-000000000001'
const PAGE_ID_1 = 'pg0a8010-0000-0000-0000-000000000001'
const PAGE_ID_2 = 'pg0a8010-0000-0000-0000-000000000002'
const PAGE_ID_3 = 'pg0a8010-0000-0000-0000-000000000003'
const SETTINGS_ID = 'st0a8010-0000-0000-0000-000000000001'
const VERSION_ID_1 = 'v0a80101-0000-0000-0000-000000000001'
const VERSION_ID_2 = 'v0a80101-0000-0000-0000-000000000002'
const TEXT_MODEL_ID = 'tm0a8010-0000-0000-0000-000000000001'
const IMAGE_MODEL_ID = 'im0a8010-0000-0000-0000-000000000001'

const NOW = new Date('2025-06-01T00:00:00Z')

function makePresentationRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: PRESENTATION_ID,
    companyId: COMPANY_ID,
    userId: USER_ID,
    title: '测试演示文稿',
    creationType: 'idea',
    status: 'draft',
    config: { theme: 'dark' },
    pageCount: 3,
    sourceContent: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  }
}

function makePageRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: PAGE_ID_1,
    presentationId: PRESENTATION_ID,
    orderIndex: 0,
    outlineContent: { heading: '标题' },
    descriptionContent: { body: '描述' },
    generatedImageKey: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  }
}

function makeSettingsRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: SETTINGS_ID,
    companyId: COMPANY_ID,
    defaultTextModelId: TEXT_MODEL_ID,
    defaultImageModelId: IMAGE_MODEL_ID,
    config: { maxPages: 50 },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  }
}

function makeImageVersionRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: VERSION_ID_1,
    pageId: PAGE_ID_1,
    imageKey: 'images/v1.png',
    versionNumber: 1,
    isCurrent: true,
    prompt: '生成一张封面图',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  }
}

// ============ 测试开始 ============

describe('PresentationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==================== 演示文稿 CRUD ====================

  describe('createPresentation', () => {
    it('应成功插入记录并返回', async () => {
      const record = makePresentationRecord()
      const insertChain = createInsertChain([record])
      mockInsert.mockImplementation(insertChain)

      const result = await presentationService.createPresentation(COMPANY_ID, USER_ID, {
        title: '测试演示文稿',
        creationType: 'idea',
        config: { theme: 'dark' }
      })

      expect(result).toEqual(record)
      expect(mockInsert).toHaveBeenCalledTimes(1)
      expect(mockLogger.info).toHaveBeenCalledWith(
        { presentationId: PRESENTATION_ID, companyId: COMPANY_ID, userId: USER_ID },
        'Presentation created'
      )
    })

    it('应正确处理无 config 和 sourceContent 的输入', async () => {
      const record = makePresentationRecord({ config: {}, sourceContent: null })
      const insertChain = createInsertChain([record])
      mockInsert.mockImplementation(insertChain)

      const result = await presentationService.createPresentation(COMPANY_ID, USER_ID, {
        title: '简单文稿',
        creationType: 'idea'
      })

      expect(result).toEqual(record)
    })
  })

  describe('listPresentations', () => {
    it('应返回分页列表并映射 previewImageKey', async () => {
      const items = [
        {
          ...makePresentationRecord(),
          pages: [{ generatedImageKey: 'images/preview.png' }]
        },
        {
          ...makePresentationRecord({ id: 'p0a80101-0000-0000-0000-000000000002', title: '第二个文稿' }),
          pages: []
        }
      ]
      mockQuery.presentations.findMany.mockResolvedValue(items)
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ total: 2 }])
        })
      })

      const result = await presentationService.listPresentations(COMPANY_ID, USER_ID, {
        page: 1,
        pageSize: 10,
        sortBy: 'updatedAt',
        sortOrder: 'desc'
      })

      expect(result.total).toBe(2)
      expect(result.page).toBe(1)
      expect(result.pageSize).toBe(10)
      expect(result.list).toHaveLength(2)
      expect(result.list[0].previewImageKey).toBe('images/preview.png')
      expect(result.list[0].pages).toBeUndefined()
      expect(result.list[1].previewImageKey).toBeNull()
    })

    it('应支持 status 筛选', async () => {
      mockQuery.presentations.findMany.mockResolvedValue([])
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ total: 0 }])
        })
      })

      const result = await presentationService.listPresentations(COMPANY_ID, USER_ID, {
        page: 1,
        pageSize: 10,
        status: 'completed',
        sortBy: 'updatedAt',
        sortOrder: 'desc'
      })

      expect(result.list).toEqual([])
      expect(result.total).toBe(0)
      expect(mockQuery.presentations.findMany).toHaveBeenCalledTimes(1)
    })

    it('应支持搜索关键词', async () => {
      mockQuery.presentations.findMany.mockResolvedValue([])
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ total: 0 }])
        })
      })

      const result = await presentationService.listPresentations(COMPANY_ID, USER_ID, {
        page: 2,
        pageSize: 5,
        search: '年度报告',
        sortBy: 'title',
        sortOrder: 'asc'
      })

      expect(result.page).toBe(2)
      expect(result.pageSize).toBe(5)
    })

    it('应支持 createdAt 排序', async () => {
      mockQuery.presentations.findMany.mockResolvedValue([])
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ total: 0 }])
        })
      })

      await presentationService.listPresentations(COMPANY_ID, USER_ID, {
        page: 1,
        pageSize: 10,
        sortBy: 'createdAt',
        sortOrder: 'asc'
      })

      expect(mockQuery.presentations.findMany).toHaveBeenCalledTimes(1)
    })
  })

  describe('getPresentationById', () => {
    it('应返回含页面和图像版本的详情', async () => {
      const record = {
        ...makePresentationRecord(),
        pages: [{ ...makePageRecord(), imageVersions: [makeImageVersionRecord()] }]
      }
      mockQuery.presentations.findFirst.mockResolvedValue(record)

      const result = await presentationService.getPresentationById(PRESENTATION_ID, COMPANY_ID)

      expect(result).toEqual(record)
      expect(mockQuery.presentations.findFirst).toHaveBeenCalledTimes(1)
    })

    it('应在找不到时返回 null', async () => {
      mockQuery.presentations.findFirst.mockResolvedValue(undefined)

      const result = await presentationService.getPresentationById('nonexistent-id', COMPANY_ID)

      expect(result).toBeNull()
    })
  })

  describe('updatePresentation', () => {
    it('应检查所有权并返回更新后的记录', async () => {
      const existing = makePresentationRecord()
      const updated = makePresentationRecord({ title: '新标题' })

      mockQuery.presentations.findFirst.mockResolvedValue(existing)

      const returningFn = vi.fn().mockResolvedValue([updated])
      const whereFn = vi.fn().mockReturnValue(Object.assign(Promise.resolve(), { returning: returningFn }))
      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({ where: whereFn })
      })

      const result = await presentationService.updatePresentation(PRESENTATION_ID, COMPANY_ID, USER_ID, {
        title: '新标题'
      })

      expect(result).toEqual(updated)
      expect(mockQuery.presentations.findFirst).toHaveBeenCalledTimes(1)
      expect(mockLogger.info).toHaveBeenCalledWith(
        { presentationId: PRESENTATION_ID, companyId: COMPANY_ID },
        'Presentation updated'
      )
    })

    it('应在非所有者时返回 null', async () => {
      mockQuery.presentations.findFirst.mockResolvedValue(undefined)

      const result = await presentationService.updatePresentation(PRESENTATION_ID, COMPANY_ID, 'other-user-id', {
        title: '新标题'
      })

      expect(result).toBeNull()
      expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('应合并 config 而非覆盖', async () => {
      const existing = makePresentationRecord({ config: { theme: 'dark', font: 'serif' } })
      const merged = makePresentationRecord({ config: { theme: 'light', font: 'serif', size: 'large' } })

      mockQuery.presentations.findFirst.mockResolvedValue(existing)

      const setFn = vi.fn()
      const returningFn = vi.fn().mockResolvedValue([merged])
      const whereFn = vi.fn().mockReturnValue(Object.assign(Promise.resolve(), { returning: returningFn }))
      setFn.mockReturnValue({ where: whereFn })
      mockUpdate.mockReturnValue({ set: setFn })

      const result = await presentationService.updatePresentation(PRESENTATION_ID, COMPANY_ID, USER_ID, {
        config: { theme: 'light', size: 'large' }
      })

      expect(result).toEqual(merged)
      // 验证 set 被调用时 config 是合并后的值
      const setCallArg = setFn.mock.calls[0][0]
      expect(setCallArg.config).toEqual({ theme: 'light', font: 'serif', size: 'large' })
    })

    it('应支持只更新 sourceContent', async () => {
      const existing = makePresentationRecord()
      const updated = makePresentationRecord({ sourceContent: '新内容' })

      mockQuery.presentations.findFirst.mockResolvedValue(existing)

      const setFn = vi.fn()
      const returningFn = vi.fn().mockResolvedValue([updated])
      const whereFn = vi.fn().mockReturnValue(Object.assign(Promise.resolve(), { returning: returningFn }))
      setFn.mockReturnValue({ where: whereFn })
      mockUpdate.mockReturnValue({ set: setFn })

      const result = await presentationService.updatePresentation(PRESENTATION_ID, COMPANY_ID, USER_ID, {
        sourceContent: '新内容'
      })

      expect(result).toEqual(updated)
      const setCallArg = setFn.mock.calls[0][0]
      expect(setCallArg.sourceContent).toBe('新内容')
    })
  })

  describe('deletePresentation', () => {
    it('应检查所有权、清理文件、级联删除并返回 true', async () => {
      const existing = makePresentationRecord()
      mockQuery.presentations.findFirst.mockResolvedValue(existing)

      const deleteWhereFn = vi.fn().mockResolvedValue(undefined)
      mockDelete.mockReturnValue({ where: deleteWhereFn })

      const result = await presentationService.deletePresentation(PRESENTATION_ID, COMPANY_ID, USER_ID)

      expect(result).toBe(true)
      expect(mockDeleteFilesByPrefix).toHaveBeenCalledWith(COMPANY_ID, PRESENTATION_ID)
      expect(mockDelete).toHaveBeenCalledTimes(1)
      expect(mockLogger.info).toHaveBeenCalledWith(
        { presentationId: PRESENTATION_ID, companyId: COMPANY_ID, userId: USER_ID },
        'Presentation deleted'
      )
    })

    it('应在找不到时返回 false', async () => {
      mockQuery.presentations.findFirst.mockResolvedValue(undefined)

      const result = await presentationService.deletePresentation('nonexistent-id', COMPANY_ID, USER_ID)

      expect(result).toBe(false)
      expect(mockDeleteFilesByPrefix).not.toHaveBeenCalled()
      expect(mockDelete).not.toHaveBeenCalled()
    })

    it('应在文件清理失败时优雅降级（warn 日志并继续删除）', async () => {
      const existing = makePresentationRecord()
      mockQuery.presentations.findFirst.mockResolvedValue(existing)

      const cleanupError = new Error('OSS 连接超时')
      mockDeleteFilesByPrefix.mockRejectedValueOnce(cleanupError)

      const deleteWhereFn = vi.fn().mockResolvedValue(undefined)
      mockDelete.mockReturnValue({ where: deleteWhereFn })

      const result = await presentationService.deletePresentation(PRESENTATION_ID, COMPANY_ID, USER_ID)

      expect(result).toBe(true)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { presentationId: PRESENTATION_ID, err: cleanupError },
        'Failed to cleanup storage files during deletion'
      )
      expect(mockDelete).toHaveBeenCalledTimes(1)
    })
  })

  describe('updatePresentationStatus', () => {
    it('应更新状态并返回更新后的记录', async () => {
      const updated = makePresentationRecord({ status: 'generating' })

      const returningFn = vi.fn().mockResolvedValue([updated])
      const whereFn = vi.fn().mockReturnValue(Object.assign(Promise.resolve(), { returning: returningFn }))
      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({ where: whereFn })
      })

      const result = await presentationService.updatePresentationStatus(PRESENTATION_ID, COMPANY_ID, 'generating')

      expect(result).toEqual(updated)
      expect(mockLogger.info).toHaveBeenCalledWith(
        { presentationId: PRESENTATION_ID, status: 'generating' },
        'Presentation status updated'
      )
    })

    it('应在未找到记录时返回 null', async () => {
      const returningFn = vi.fn().mockResolvedValue([])
      const whereFn = vi.fn().mockReturnValue(Object.assign(Promise.resolve(), { returning: returningFn }))
      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({ where: whereFn })
      })

      const result = await presentationService.updatePresentationStatus('nonexistent-id', COMPANY_ID, 'completed')

      expect(result).toBeNull()
      expect(mockLogger.info).not.toHaveBeenCalled()
    })
  })

  // ==================== 页面管理 ====================

  describe('getPages', () => {
    it('应验证演示文稿存在后返回含图像版本的页面列表', async () => {
      const pages = [
        { ...makePageRecord(), imageVersions: [makeImageVersionRecord()] },
        { ...makePageRecord({ id: PAGE_ID_2, orderIndex: 1 }), imageVersions: [] }
      ]
      mockQuery.presentations.findFirst.mockResolvedValue({ id: PRESENTATION_ID })
      mockQuery.presentationPages.findMany.mockResolvedValue(pages)

      const result = await presentationService.getPages(PRESENTATION_ID, COMPANY_ID)

      expect(result).toEqual(pages)
      expect(result).toHaveLength(2)
      expect(mockQuery.presentations.findFirst).toHaveBeenCalledTimes(1)
      expect(mockQuery.presentationPages.findMany).toHaveBeenCalledTimes(1)
    })

    it('应在演示文稿不存在时返回 null', async () => {
      mockQuery.presentations.findFirst.mockResolvedValue(undefined)

      const result = await presentationService.getPages('nonexistent-id', COMPANY_ID)

      expect(result).toBeNull()
      expect(mockQuery.presentationPages.findMany).not.toHaveBeenCalled()
    })
  })

  describe('createPage', () => {
    it('应验证演示文稿后插入页面并增加 pageCount', async () => {
      const page = makePageRecord()
      mockQuery.presentations.findFirst.mockResolvedValue({ id: PRESENTATION_ID, pageCount: 3 })

      // insert 返回页面
      const insertChain = createInsertChain([page])
      mockInsert.mockImplementation(insertChain)

      // update pageCount（无 returning）
      const updateWhereFn = vi.fn().mockImplementation(() => Promise.resolve())
      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({ where: updateWhereFn })
      })

      const result = await presentationService.createPage(PRESENTATION_ID, COMPANY_ID, {
        orderIndex: 0,
        outlineContent: { heading: '标题' },
        descriptionContent: { body: '描述' }
      })

      expect(result).toEqual(page)
      expect(mockInsert).toHaveBeenCalledTimes(1)
      expect(mockUpdate).toHaveBeenCalledTimes(1)
      expect(mockLogger.info).toHaveBeenCalledWith(
        { pageId: PAGE_ID_1, presentationId: PRESENTATION_ID },
        'Page created'
      )
    })

    it('应在演示文稿不存在时返回 null', async () => {
      mockQuery.presentations.findFirst.mockResolvedValue(undefined)

      const result = await presentationService.createPage('nonexistent-id', COMPANY_ID, {
        orderIndex: 0,
        outlineContent: { heading: '标题' }
      })

      expect(result).toBeNull()
      expect(mockInsert).not.toHaveBeenCalled()
    })
  })

  describe('updatePage', () => {
    it('应验证归属关系后更新页面并刷新父级 updatedAt', async () => {
      const updated = makePageRecord({ outlineContent: { heading: '新标题' } })
      mockQuery.presentations.findFirst.mockResolvedValue({ id: PRESENTATION_ID })
      mockQuery.presentationPages.findFirst.mockResolvedValue(makePageRecord())

      // 第一次 update：页面（带 returning）
      // 第二次 update：父演示文稿 updatedAt（无 returning）
      let callCount = 0
      mockUpdate.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          const returningFn = vi.fn().mockResolvedValue([updated])
          const whereFn = vi.fn().mockReturnValue(Object.assign(Promise.resolve(), { returning: returningFn }))
          return { set: vi.fn().mockReturnValue({ where: whereFn }) }
        }
        return {
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => Promise.resolve())
          })
        }
      })

      const result = await presentationService.updatePage(PAGE_ID_1, PRESENTATION_ID, COMPANY_ID, {
        outlineContent: { heading: '新标题' }
      })

      expect(result).toEqual(updated)
      expect(mockUpdate).toHaveBeenCalledTimes(2)
      expect(mockLogger.info).toHaveBeenCalledWith(
        { pageId: PAGE_ID_1, presentationId: PRESENTATION_ID },
        'Page updated'
      )
    })

    it('应在演示文稿不存在时返回 null', async () => {
      mockQuery.presentations.findFirst.mockResolvedValue(undefined)

      const result = await presentationService.updatePage(PAGE_ID_1, 'nonexistent-id', COMPANY_ID, { orderIndex: 1 })

      expect(result).toBeNull()
      expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('应在页面不存在时返回 null', async () => {
      mockQuery.presentations.findFirst.mockResolvedValue({ id: PRESENTATION_ID })
      mockQuery.presentationPages.findFirst.mockResolvedValue(undefined)

      const result = await presentationService.updatePage('nonexistent-page-id', PRESENTATION_ID, COMPANY_ID, {
        orderIndex: 1
      })

      expect(result).toBeNull()
      expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('应支持部分字段更新（仅 descriptionContent）', async () => {
      const updated = makePageRecord({ descriptionContent: { body: '新描述' } })
      mockQuery.presentations.findFirst.mockResolvedValue({ id: PRESENTATION_ID })
      mockQuery.presentationPages.findFirst.mockResolvedValue(makePageRecord())

      let callCount = 0
      const capturedSetArgs: unknown[] = []
      mockUpdate.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          const setFn = vi.fn().mockImplementation((data: unknown) => {
            capturedSetArgs.push(data)
            const returningFn = vi.fn().mockResolvedValue([updated])
            const whereFn = vi.fn().mockReturnValue(Object.assign(Promise.resolve(), { returning: returningFn }))
            return { where: whereFn }
          })
          return { set: setFn }
        }
        return {
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => Promise.resolve())
          })
        }
      })

      const result = await presentationService.updatePage(PAGE_ID_1, PRESENTATION_ID, COMPANY_ID, {
        descriptionContent: { body: '新描述' }
      })

      expect(result).toEqual(updated)
      const setArg = capturedSetArgs[0] as Record<string, unknown>
      expect(setArg.descriptionContent).toEqual({ body: '新描述' })
      expect(setArg).toHaveProperty('updatedAt')
      expect(setArg).not.toHaveProperty('orderIndex')
      expect(setArg).not.toHaveProperty('outlineContent')
    })
  })

  describe('deletePage', () => {
    it('应验证后删除页面并递减 pageCount', async () => {
      mockQuery.presentations.findFirst.mockResolvedValue({ id: PRESENTATION_ID })
      mockQuery.presentationPages.findFirst.mockResolvedValue(makePageRecord())

      // delete 页面
      const deleteWhereFn = vi.fn().mockResolvedValue(undefined)
      mockDelete.mockReturnValue({ where: deleteWhereFn })

      // update pageCount
      const updateWhereFn = vi.fn().mockImplementation(() => Promise.resolve())
      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({ where: updateWhereFn })
      })

      const result = await presentationService.deletePage(PAGE_ID_1, PRESENTATION_ID, COMPANY_ID)

      expect(result).toBe(true)
      expect(mockDelete).toHaveBeenCalledTimes(1)
      expect(mockUpdate).toHaveBeenCalledTimes(1)
      expect(mockLogger.info).toHaveBeenCalledWith(
        { pageId: PAGE_ID_1, presentationId: PRESENTATION_ID },
        'Page deleted'
      )
    })

    it('应在演示文稿不存在时返回 false', async () => {
      mockQuery.presentations.findFirst.mockResolvedValue(undefined)

      const result = await presentationService.deletePage(PAGE_ID_1, 'nonexistent-id', COMPANY_ID)

      expect(result).toBe(false)
      expect(mockDelete).not.toHaveBeenCalled()
    })

    it('应在页面不存在时返回 false', async () => {
      mockQuery.presentations.findFirst.mockResolvedValue({ id: PRESENTATION_ID })
      mockQuery.presentationPages.findFirst.mockResolvedValue(undefined)

      const result = await presentationService.deletePage('nonexistent-page', PRESENTATION_ID, COMPANY_ID)

      expect(result).toBe(false)
      expect(mockDelete).not.toHaveBeenCalled()
    })

    it('应在页面有生成图像时尝试删除图像', async () => {
      const pageWithImage = makePageRecord({ generatedImageKey: 'images/page1.png' })
      mockQuery.presentations.findFirst.mockResolvedValue({ id: PRESENTATION_ID })
      mockQuery.presentationPages.findFirst.mockResolvedValue(pageWithImage)

      const deleteWhereFn = vi.fn().mockResolvedValue(undefined)
      mockDelete.mockReturnValue({ where: deleteWhereFn })

      const updateWhereFn = vi.fn().mockImplementation(() => Promise.resolve())
      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({ where: updateWhereFn })
      })

      await presentationService.deletePage(PAGE_ID_1, PRESENTATION_ID, COMPANY_ID)

      expect(mockDeleteGeneratedImage).toHaveBeenCalledWith('images/page1.png')
    })

    it('应在图像删除失败时优雅降级', async () => {
      const pageWithImage = makePageRecord({ generatedImageKey: 'images/page1.png' })
      const deleteImageError = new Error('存储服务不可用')
      mockQuery.presentations.findFirst.mockResolvedValue({ id: PRESENTATION_ID })
      mockQuery.presentationPages.findFirst.mockResolvedValue(pageWithImage)

      mockDeleteGeneratedImage.mockRejectedValueOnce(deleteImageError)

      const deleteWhereFn = vi.fn().mockResolvedValue(undefined)
      mockDelete.mockReturnValue({ where: deleteWhereFn })

      const updateWhereFn = vi.fn().mockImplementation(() => Promise.resolve())
      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({ where: updateWhereFn })
      })

      const result = await presentationService.deletePage(PAGE_ID_1, PRESENTATION_ID, COMPANY_ID)

      expect(result).toBe(true)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { pageId: PAGE_ID_1, err: deleteImageError },
        'Failed to delete page generated image'
      )
      expect(mockDelete).toHaveBeenCalledTimes(1)
    })

    it('应在页面无生成图像时跳过图像删除', async () => {
      mockQuery.presentations.findFirst.mockResolvedValue({ id: PRESENTATION_ID })
      mockQuery.presentationPages.findFirst.mockResolvedValue(makePageRecord({ generatedImageKey: null }))

      const deleteWhereFn = vi.fn().mockResolvedValue(undefined)
      mockDelete.mockReturnValue({ where: deleteWhereFn })

      const updateWhereFn = vi.fn().mockImplementation(() => Promise.resolve())
      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({ where: updateWhereFn })
      })

      await presentationService.deletePage(PAGE_ID_1, PRESENTATION_ID, COMPANY_ID)

      expect(mockDeleteGeneratedImage).not.toHaveBeenCalled()
    })
  })

  describe('reorderPages', () => {
    it('应批量更新 orderIndex 并刷新父级 updatedAt', async () => {
      mockQuery.presentations.findFirst.mockResolvedValue({ id: PRESENTATION_ID })

      // 每次 update 调用都返回一个有效的链
      mockUpdate.mockImplementation(() => ({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => Promise.resolve())
        })
      }))

      const result = await presentationService.reorderPages(PRESENTATION_ID, COMPANY_ID, {
        pageIds: [PAGE_ID_3, PAGE_ID_1, PAGE_ID_2]
      })

      expect(result).toBe(true)
      // 3 次页面 orderIndex 更新 + 1 次父级 updatedAt 更新
      expect(mockUpdate).toHaveBeenCalledTimes(4)
      expect(mockLogger.info).toHaveBeenCalledWith({ presentationId: PRESENTATION_ID, pageCount: 3 }, 'Pages reordered')
    })

    it('应在演示文稿不存在时返回 false', async () => {
      mockQuery.presentations.findFirst.mockResolvedValue(undefined)

      const result = await presentationService.reorderPages('nonexistent-id', COMPANY_ID, {
        pageIds: [PAGE_ID_1]
      })

      expect(result).toBe(false)
      expect(mockUpdate).not.toHaveBeenCalled()
    })
  })

  describe('batchUpsertPages', () => {
    it('应先删除旧页面再批量插入新页面并更新 pageCount', async () => {
      const newPages = [
        makePageRecord({ id: 'new-page-1', orderIndex: 0 }),
        makePageRecord({ id: 'new-page-2', orderIndex: 1 })
      ]
      mockQuery.presentations.findFirst.mockResolvedValue({ id: PRESENTATION_ID })

      // delete 旧页面
      const deleteWhereFn = vi.fn().mockResolvedValue(undefined)
      mockDelete.mockReturnValue({ where: deleteWhereFn })

      // insert 新页面
      const insertChain = createInsertChain(newPages)
      mockInsert.mockImplementation(insertChain)

      // update pageCount
      const updateWhereFn = vi.fn().mockImplementation(() => Promise.resolve())
      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({ where: updateWhereFn })
      })

      const result = await presentationService.batchUpsertPages(PRESENTATION_ID, COMPANY_ID, [
        { orderIndex: 0, outlineContent: { heading: '页面 1' } },
        { orderIndex: 1, outlineContent: { heading: '页面 2' } }
      ])

      expect(result).toEqual(newPages)
      expect(mockDelete).toHaveBeenCalledTimes(1)
      expect(mockInsert).toHaveBeenCalledTimes(1)
      expect(mockUpdate).toHaveBeenCalledTimes(1)
      expect(mockLogger.info).toHaveBeenCalledWith(
        { presentationId: PRESENTATION_ID, pageCount: 2 },
        'Pages batch upserted'
      )
    })

    it('应在演示文稿不存在时返回 null', async () => {
      mockQuery.presentations.findFirst.mockResolvedValue(undefined)

      const result = await presentationService.batchUpsertPages('nonexistent-id', COMPANY_ID, [])

      expect(result).toBeNull()
      expect(mockDelete).not.toHaveBeenCalled()
    })

    it('应在空数组时删除旧页面并将 pageCount 设为 0', async () => {
      mockQuery.presentations.findFirst.mockResolvedValue({ id: PRESENTATION_ID })

      const deleteWhereFn = vi.fn().mockResolvedValue(undefined)
      mockDelete.mockReturnValue({ where: deleteWhereFn })

      const updateWhereFn = vi.fn().mockImplementation(() => Promise.resolve())
      const capturedSetArgs: unknown[] = []
      mockUpdate.mockReturnValue({
        set: vi.fn().mockImplementation((data: unknown) => {
          capturedSetArgs.push(data)
          return { where: updateWhereFn }
        })
      })

      const result = await presentationService.batchUpsertPages(PRESENTATION_ID, COMPANY_ID, [])

      expect(result).toEqual([])
      expect(mockDelete).toHaveBeenCalledTimes(1)
      expect(mockInsert).not.toHaveBeenCalled()
      const setArg = capturedSetArgs[0] as Record<string, unknown>
      expect(setArg.pageCount).toBe(0)
    })
  })

  // ==================== 企业设置 ====================

  describe('getSettings', () => {
    it('应返回已有设置记录', async () => {
      const record = makeSettingsRecord()
      mockQuery.presentationSettings.findFirst.mockResolvedValue(record)

      const result = await presentationService.getSettings(COMPANY_ID)

      expect(result).toEqual(record)
    })

    it('应在无记录时返回默认值', async () => {
      mockQuery.presentationSettings.findFirst.mockResolvedValue(undefined)

      const result = await presentationService.getSettings(COMPANY_ID)

      expect(result).toEqual({
        companyId: COMPANY_ID,
        defaultTextModelId: null,
        defaultImageModelId: null,
        config: {}
      })
    })
  })

  describe('updateSettings', () => {
    it('应在已有记录时更新并合并 config', async () => {
      const existing = makeSettingsRecord({ config: { maxPages: 50, theme: 'blue' } })
      const updated = makeSettingsRecord({ config: { maxPages: 100, theme: 'blue', lang: 'zh' } })

      mockQuery.presentationSettings.findFirst.mockResolvedValue(existing)

      const setFn = vi.fn()
      const returningFn = vi.fn().mockResolvedValue([updated])
      const whereFn = vi.fn().mockReturnValue(Object.assign(Promise.resolve(), { returning: returningFn }))
      setFn.mockReturnValue({ where: whereFn })
      mockUpdate.mockReturnValue({ set: setFn })

      const result = await presentationService.updateSettings(COMPANY_ID, {
        config: { maxPages: 100, lang: 'zh' }
      })

      expect(result).toEqual(updated)
      const setArg = setFn.mock.calls[0][0]
      expect(setArg.config).toEqual({ maxPages: 100, theme: 'blue', lang: 'zh' })
      expect(mockLogger.info).toHaveBeenCalledWith({ companyId: COMPANY_ID }, 'Presentation settings updated')
    })

    it('应在已有记录时支持更新模型 ID', async () => {
      const existing = makeSettingsRecord()
      const updated = makeSettingsRecord({ defaultTextModelId: 'new-text-model-id' })

      mockQuery.presentationSettings.findFirst.mockResolvedValue(existing)

      const setFn = vi.fn()
      const returningFn = vi.fn().mockResolvedValue([updated])
      const whereFn = vi.fn().mockReturnValue(Object.assign(Promise.resolve(), { returning: returningFn }))
      setFn.mockReturnValue({ where: whereFn })
      mockUpdate.mockReturnValue({ set: setFn })

      const result = await presentationService.updateSettings(COMPANY_ID, {
        defaultTextModelId: 'new-text-model-id'
      })

      expect(result).toEqual(updated)
      const setArg = setFn.mock.calls[0][0]
      expect(setArg.defaultTextModelId).toBe('new-text-model-id')
    })

    it('应在无记录时新建设置', async () => {
      const created = makeSettingsRecord()

      mockQuery.presentationSettings.findFirst.mockResolvedValue(undefined)

      const insertChain = createInsertChain([created])
      mockInsert.mockImplementation(insertChain)

      const result = await presentationService.updateSettings(COMPANY_ID, {
        defaultTextModelId: TEXT_MODEL_ID,
        defaultImageModelId: IMAGE_MODEL_ID,
        config: { maxPages: 50 }
      })

      expect(result).toEqual(created)
      expect(mockInsert).toHaveBeenCalledTimes(1)
      expect(mockUpdate).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith({ companyId: COMPANY_ID }, 'Presentation settings created')
    })

    it('应在无记录且无输入时使用默认空值创建', async () => {
      const created = makeSettingsRecord({
        defaultTextModelId: null,
        defaultImageModelId: null,
        config: {}
      })

      mockQuery.presentationSettings.findFirst.mockResolvedValue(undefined)

      const insertChain = createInsertChain([created])
      mockInsert.mockImplementation(insertChain)

      const result = await presentationService.updateSettings(COMPANY_ID, {})

      expect(result).toEqual(created)
    })
  })

  // ==================== Admin 查询 ====================

  describe('adminListPresentations', () => {
    it('应返回含用户信息的分页列表', async () => {
      const items = [{ ...makePresentationRecord(), user: { id: USER_ID, name: '张三' } }]
      mockQuery.presentations.findMany.mockResolvedValue(items)
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ total: 1 }])
        })
      })

      const result = await presentationService.adminListPresentations(COMPANY_ID, {
        page: 1,
        pageSize: 20,
        sortBy: 'updatedAt',
        sortOrder: 'desc'
      })

      expect(result.list).toEqual(items)
      expect(result.total).toBe(1)
      expect(result.page).toBe(1)
      expect(result.pageSize).toBe(20)
    })

    it('应支持 userId 筛选', async () => {
      mockQuery.presentations.findMany.mockResolvedValue([])
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ total: 0 }])
        })
      })

      const result = await presentationService.adminListPresentations(COMPANY_ID, {
        page: 1,
        pageSize: 20,
        userId: USER_ID,
        sortBy: 'updatedAt',
        sortOrder: 'desc'
      })

      expect(result.total).toBe(0)
      expect(mockQuery.presentations.findMany).toHaveBeenCalledTimes(1)
    })

    it('应支持日期范围筛选', async () => {
      const startDate = new Date('2025-01-01')
      const endDate = new Date('2025-06-30')

      mockQuery.presentations.findMany.mockResolvedValue([])
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ total: 0 }])
        })
      })

      const result = await presentationService.adminListPresentations(COMPANY_ID, {
        page: 1,
        pageSize: 10,
        startDate,
        endDate,
        sortBy: 'createdAt',
        sortOrder: 'asc'
      })

      expect(result.total).toBe(0)
      expect(mockQuery.presentations.findMany).toHaveBeenCalledTimes(1)
    })

    it('应支持 status 和 search 组合筛选', async () => {
      mockQuery.presentations.findMany.mockResolvedValue([])
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ total: 0 }])
        })
      })

      await presentationService.adminListPresentations(COMPANY_ID, {
        page: 1,
        pageSize: 10,
        status: 'completed',
        search: '季度报告',
        sortBy: 'title',
        sortOrder: 'asc'
      })

      expect(mockQuery.presentations.findMany).toHaveBeenCalledTimes(1)
    })
  })

  describe('getStats', () => {
    it('应返回 4 项聚合统计数据', async () => {
      mockSelect
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 42 }])
          })
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 15 }])
          })
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 128 }])
          })
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 8 }])
          })
        })

      const result = await presentationService.getStats(COMPANY_ID)

      expect(result).toEqual({
        totalPresentations: 42,
        totalExports: 15,
        totalAiCalls: 128,
        activeUsers: 8
      })
      expect(mockSelect).toHaveBeenCalledTimes(4)
    })

    it('应在无数据时返回全零', async () => {
      const emptyResult = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ total: 0 }])
        })
      }
      mockSelect
        .mockReturnValueOnce(emptyResult)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 0 }])
          })
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 0 }])
          })
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 0 }])
          })
        })

      const result = await presentationService.getStats(COMPANY_ID)

      expect(result).toEqual({
        totalPresentations: 0,
        totalExports: 0,
        totalAiCalls: 0,
        activeUsers: 0
      })
    })

    it('应在查询结果为空数组时使用默认值 0', async () => {
      const emptyArrayResult = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([])
        })
      }
      mockSelect
        .mockReturnValueOnce(emptyArrayResult)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([])
          })
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([])
          })
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([])
          })
        })

      const result = await presentationService.getStats(COMPANY_ID)

      expect(result).toEqual({
        totalPresentations: 0,
        totalExports: 0,
        totalAiCalls: 0,
        activeUsers: 0
      })
    })
  })

  // ==================== 图像版本管理 ====================

  describe('addImageVersion', () => {
    it('应取消当前版本、获取下一版本号、插入新版本并更新页面 imageKey', async () => {
      const newVersion = makeImageVersionRecord({
        id: VERSION_ID_2,
        versionNumber: 3,
        imageKey: 'images/v3.png'
      })

      // 第一次 update：取消当前版本标记（无 returning）
      // 第三次 update：更新页面 generatedImageKey（无 returning）
      mockUpdate.mockImplementation(() => {
        return {
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => Promise.resolve())
          })
        }
      })

      // select max version
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ max: 2 }])
        })
      })

      // insert 新版本
      const insertChain = createInsertChain([newVersion])
      mockInsert.mockImplementation(insertChain)

      const result = await presentationService.addImageVersion(PAGE_ID_1, 'images/v3.png', '生成新封面')

      expect(result).toEqual(newVersion)
      expect(mockUpdate).toHaveBeenCalledTimes(2) // 取消当前 + 更新页面
      expect(mockSelect).toHaveBeenCalledTimes(1)
      expect(mockInsert).toHaveBeenCalledTimes(1)
      expect(mockLogger.info).toHaveBeenCalledWith({ pageId: PAGE_ID_1, versionNumber: 3 }, 'Image version added')
    })

    it('应在无历史版本时从版本号 1 开始', async () => {
      const firstVersion = makeImageVersionRecord({ versionNumber: 1 })

      mockUpdate.mockImplementation(() => ({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => Promise.resolve())
        })
      }))

      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ max: 0 }])
        })
      })

      const insertChain = createInsertChain([firstVersion])
      mockInsert.mockImplementation(insertChain)

      const result = await presentationService.addImageVersion(PAGE_ID_1, 'images/v1.png')

      expect(result).toEqual(firstVersion)
      expect(mockLogger.info).toHaveBeenCalledWith({ pageId: PAGE_ID_1, versionNumber: 1 }, 'Image version added')
    })

    it('应在无 prompt 时传入 null', async () => {
      const version = makeImageVersionRecord({ prompt: null })

      mockUpdate.mockImplementation(() => ({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => Promise.resolve())
        })
      }))

      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ max: 0 }])
        })
      })

      const insertChain = createInsertChain([version])
      mockInsert.mockImplementation(insertChain)

      const result = await presentationService.addImageVersion(PAGE_ID_1, 'images/v1.png')

      expect(result).toEqual(version)
    })
  })

  describe('getImageVersions', () => {
    it('应返回按版本号降序排列的版本列表', async () => {
      const versions = [
        makeImageVersionRecord({ id: VERSION_ID_2, versionNumber: 2, imageKey: 'images/v2.png' }),
        makeImageVersionRecord({ id: VERSION_ID_1, versionNumber: 1, imageKey: 'images/v1.png' })
      ]
      mockQuery.presentationImageVersions.findMany.mockResolvedValue(versions)

      const result = await presentationService.getImageVersions(PAGE_ID_1)

      expect(result).toEqual(versions)
      expect(result[0].versionNumber).toBeGreaterThan(result[1].versionNumber)
      expect(mockQuery.presentationImageVersions.findMany).toHaveBeenCalledTimes(1)
    })

    it('应在无版本时返回空数组', async () => {
      mockQuery.presentationImageVersions.findMany.mockResolvedValue([])

      const result = await presentationService.getImageVersions('page-without-versions')

      expect(result).toEqual([])
    })
  })

  describe('switchImageVersion', () => {
    it('应验证版本存在、取消所有标记、标记目标版本并更新页面 imageKey', async () => {
      const version = makeImageVersionRecord({
        id: VERSION_ID_1,
        imageKey: 'images/v1.png',
        isCurrent: false
      })
      const updatedVersion = makeImageVersionRecord({
        id: VERSION_ID_1,
        imageKey: 'images/v1.png',
        isCurrent: true
      })

      mockQuery.presentationImageVersions.findFirst.mockResolvedValue(version)

      // 三次 update：
      //   1. 取消所有 isCurrent（无 returning）
      //   2. 设置目标 isCurrent=true（带 returning）
      //   3. 更新页面 generatedImageKey（无 returning）
      let updateIdx = 0
      mockUpdate.mockImplementation(() => {
        updateIdx++
        if (updateIdx === 2) {
          const returningFn = vi.fn().mockResolvedValue([updatedVersion])
          const whereFn = vi.fn().mockReturnValue(Object.assign(Promise.resolve(), { returning: returningFn }))
          return { set: vi.fn().mockReturnValue({ where: whereFn }) }
        }
        return {
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => Promise.resolve())
          })
        }
      })

      const result = await presentationService.switchImageVersion(PAGE_ID_1, VERSION_ID_1)

      expect(result).toEqual(updatedVersion)
      expect(mockUpdate).toHaveBeenCalledTimes(3)
      expect(mockLogger.info).toHaveBeenCalledWith(
        { pageId: PAGE_ID_1, versionId: VERSION_ID_1 },
        'Image version switched'
      )
    })

    it('应在版本不存在时返回 null', async () => {
      mockQuery.presentationImageVersions.findFirst.mockResolvedValue(undefined)

      const result = await presentationService.switchImageVersion(PAGE_ID_1, 'nonexistent-version')

      expect(result).toBeNull()
      expect(mockUpdate).not.toHaveBeenCalled()
    })
  })
})
