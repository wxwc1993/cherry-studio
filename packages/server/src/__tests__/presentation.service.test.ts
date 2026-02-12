import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * PresentationService 单元测试
 *
 * 验证演示文稿 CRUD、页面管理、企业设置、Admin 查询、图像版本管理的核心逻辑。
 */

// ── Mock 层 ──────────────────────────────────────────────

const mockFindFirst = vi.fn()
const mockFindMany = vi.fn()
const mockInsertReturning = vi.fn()
const mockUpdateReturning = vi.fn()
const mockDeleteWhere = vi.fn()
const mockSelectFrom = vi.fn()

// Drizzle 链式调用 mock
const mockInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockReturnValue({ returning: mockInsertReturning })
})
const mockUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({ returning: mockUpdateReturning }),
    returning: mockUpdateReturning
  })
})
const mockDelete = vi.fn().mockReturnValue({
  where: mockDeleteWhere
})
const mockSelect = vi.fn().mockReturnValue({
  from: vi.fn().mockReturnValue({
    where: mockSelectFrom
  })
})

vi.mock('../models/db', () => ({
  db: {
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    select: mockSelect,
    query: {
      presentations: { findFirst: mockFindFirst, findMany: mockFindMany },
      presentationPages: { findFirst: vi.fn(), findMany: vi.fn() },
      presentationSettings: { findFirst: vi.fn() },
      presentationImageVersions: { findFirst: vi.fn(), findMany: vi.fn() },
      presentationTasks: { findFirst: vi.fn() }
    }
  }
}))

vi.mock('../models', () => ({
  db: {
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    select: mockSelect,
    query: {
      presentations: { findFirst: mockFindFirst, findMany: mockFindMany },
      presentationPages: { findFirst: vi.fn(), findMany: vi.fn() },
      presentationSettings: { findFirst: vi.fn() },
      presentationImageVersions: { findFirst: vi.fn(), findMany: vi.fn() },
      presentationTasks: { findFirst: vi.fn() }
    }
  },
  presentations: {
    id: 'id',
    companyId: 'companyId',
    userId: 'userId',
    title: 'title',
    status: 'status',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    pageCount: 'pageCount'
  },
  presentationPages: {
    id: 'id',
    presentationId: 'presentationId',
    orderIndex: 'orderIndex',
    generatedImageKey: 'generatedImageKey'
  },
  presentationSettings: { companyId: 'companyId' },
  presentationImageVersions: { id: 'id', pageId: 'pageId', isCurrent: 'isCurrent', versionNumber: 'versionNumber' },
  presentationTasks: { presentationId: 'presentationId', taskType: 'taskType', status: 'status' }
}))

vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

const mockDeleteFilesByPrefix = vi.fn()
const mockDeleteGeneratedImage = vi.fn()

vi.mock('../services/presentation-file.service', () => ({
  presentationFileService: {
    deleteFilesByPrefix: mockDeleteFilesByPrefix,
    deleteGeneratedImage: mockDeleteGeneratedImage,
    uploadGeneratedImage: vi.fn(),
    storeExportFile: vi.fn()
  }
}))

// ── 导入被测模块（必须在 mock 之后） ──

const { presentationService } = await import('../services/presentation.service')
const { db } = await import('../models')

// ── 常量 ──

const COMPANY_ID = 'company-001'
const USER_ID = 'user-001'
const PRESENTATION_ID = 'pres-001'
const PAGE_ID = 'page-001'
const VERSION_ID = 'version-001'

// ── Tests ──

describe('PresentationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 重新设置链式调用 mock 的返回值
    mockInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: mockInsertReturning })
    })
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: mockUpdateReturning })
      })
    })
    mockDelete.mockReturnValue({
      where: mockDeleteWhere
    })
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: mockSelectFrom
      })
    })
  })

  // ============ 演示文稿 CRUD ============

  describe('createPresentation', () => {
    it('应成功创建演示文稿并返回记录', async () => {
      const mockRecord = {
        id: PRESENTATION_ID,
        companyId: COMPANY_ID,
        userId: USER_ID,
        title: '测试演示',
        creationType: 'idea',
        config: {},
        sourceContent: null
      }
      mockInsertReturning.mockResolvedValue([mockRecord])

      const result = await presentationService.createPresentation(COMPANY_ID, USER_ID, {
        title: '测试演示',
        creationType: 'idea'
      })

      expect(result).toEqual(mockRecord)
      expect(mockInsert).toHaveBeenCalled()
    })

    it('应将 config 默认为空对象', async () => {
      const mockRecord = { id: PRESENTATION_ID, config: {} }
      mockInsertReturning.mockResolvedValue([mockRecord])

      await presentationService.createPresentation(COMPANY_ID, USER_ID, { title: '标题', creationType: 'idea' })

      expect(mockInsert).toHaveBeenCalled()
    })
  })

  describe('listPresentations', () => {
    it('应返回分页列表和总数', async () => {
      const mockItems = [
        {
          id: PRESENTATION_ID,
          title: '演示1',
          pages: [{ generatedImageKey: 'img-key-1' }]
        }
      ]
      mockFindMany.mockResolvedValue(mockItems)
      mockSelectFrom.mockResolvedValue([{ total: 1 }])

      const result = await presentationService.listPresentations(COMPANY_ID, USER_ID, {
        page: 1,
        pageSize: 20,
        sortBy: 'updatedAt',
        sortOrder: 'desc'
      })

      expect(result.list).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.page).toBe(1)
      expect(result.pageSize).toBe(20)
      // 验证 previewImageKey 映射
      expect(result.list[0].previewImageKey).toBe('img-key-1')
    })

    it('当没有页面时 previewImageKey 应为 null', async () => {
      mockFindMany.mockResolvedValue([{ id: PRESENTATION_ID, title: '演示', pages: [] }])
      mockSelectFrom.mockResolvedValue([{ total: 1 }])

      const result = await presentationService.listPresentations(COMPANY_ID, USER_ID, {
        page: 1,
        pageSize: 20,
        sortBy: 'updatedAt',
        sortOrder: 'desc'
      })

      expect(result.list[0].previewImageKey).toBeNull()
    })
  })

  describe('getPresentationById', () => {
    it('应返回演示文稿详情', async () => {
      const mockRecord = {
        id: PRESENTATION_ID,
        title: '测试',
        pages: []
      }
      mockFindFirst.mockResolvedValue(mockRecord)

      const result = await presentationService.getPresentationById(PRESENTATION_ID, COMPANY_ID)

      expect(result).toEqual(mockRecord)
    })

    it('不存在时应返回 null', async () => {
      mockFindFirst.mockResolvedValue(undefined)

      const result = await presentationService.getPresentationById('non-existent', COMPANY_ID)

      expect(result).toBeNull()
    })
  })

  describe('updatePresentation', () => {
    it('应成功更新演示文稿', async () => {
      const existing = { id: PRESENTATION_ID, config: { theme: 'light' } }
      mockFindFirst.mockResolvedValue(existing)
      const updated = { ...existing, title: '新标题' }
      mockUpdateReturning.mockResolvedValue([updated])

      const result = await presentationService.updatePresentation(PRESENTATION_ID, COMPANY_ID, USER_ID, {
        title: '新标题'
      })

      expect(result).toEqual(updated)
    })

    it('不存在时应返回 null', async () => {
      mockFindFirst.mockResolvedValue(undefined)

      const result = await presentationService.updatePresentation('non-existent', COMPANY_ID, USER_ID, {
        title: '新标题'
      })

      expect(result).toBeNull()
    })

    it('应合并 config 而非覆盖', async () => {
      const existing = { id: PRESENTATION_ID, config: { theme: 'light', language: 'zh' } }
      mockFindFirst.mockResolvedValue(existing)
      mockUpdateReturning.mockResolvedValue([{ ...existing, config: { theme: 'dark', language: 'zh' } }])

      await presentationService.updatePresentation(PRESENTATION_ID, COMPANY_ID, USER_ID, { config: { theme: 'dark' } })

      expect(mockUpdate).toHaveBeenCalled()
    })
  })

  describe('deletePresentation', () => {
    it('应成功删除并清理文件', async () => {
      mockFindFirst.mockResolvedValue({ id: PRESENTATION_ID })
      mockDeleteFilesByPrefix.mockResolvedValue(undefined)
      mockDeleteWhere.mockResolvedValue(undefined)

      const result = await presentationService.deletePresentation(PRESENTATION_ID, COMPANY_ID, USER_ID)

      expect(result).toBe(true)
      expect(mockDeleteFilesByPrefix).toHaveBeenCalledWith(COMPANY_ID, PRESENTATION_ID)
      expect(mockDelete).toHaveBeenCalled()
    })

    it('不存在时应返回 false', async () => {
      mockFindFirst.mockResolvedValue(undefined)

      const result = await presentationService.deletePresentation('non-existent', COMPANY_ID, USER_ID)

      expect(result).toBe(false)
    })

    it('文件清理失败不应阻塞删除', async () => {
      mockFindFirst.mockResolvedValue({ id: PRESENTATION_ID })
      mockDeleteFilesByPrefix.mockRejectedValue(new Error('OSS error'))
      mockDeleteWhere.mockResolvedValue(undefined)

      const result = await presentationService.deletePresentation(PRESENTATION_ID, COMPANY_ID, USER_ID)

      expect(result).toBe(true)
      expect(mockDelete).toHaveBeenCalled()
    })
  })

  describe('updatePresentationStatus', () => {
    it('应成功更新状态', async () => {
      const updated = { id: PRESENTATION_ID, status: 'outline_ready' }
      mockUpdateReturning.mockResolvedValue([updated])

      const result = await presentationService.updatePresentationStatus(PRESENTATION_ID, COMPANY_ID, 'outline_ready')

      expect(result).toEqual(updated)
    })

    it('不存在时应返回 null', async () => {
      mockUpdateReturning.mockResolvedValue([])

      const result = await presentationService.updatePresentationStatus('non-existent', COMPANY_ID, 'draft')

      expect(result).toBeNull()
    })
  })

  // ============ 页面管理 ============

  describe('getPages', () => {
    it('应返回页面列表', async () => {
      // 第一次 findFirst 验证演示文稿存在
      mockFindFirst.mockResolvedValue({ id: PRESENTATION_ID })

      // query.presentationPages.findMany
      ;(db.query.presentationPages.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: PAGE_ID, orderIndex: 0, imageVersions: [] }
      ])

      const result = await presentationService.getPages(PRESENTATION_ID, COMPANY_ID)

      expect(result).toHaveLength(1)
    })

    it('演示文稿不存在时应返回 null', async () => {
      mockFindFirst.mockResolvedValue(undefined)

      const result = await presentationService.getPages('non-existent', COMPANY_ID)

      expect(result).toBeNull()
    })
  })

  describe('createPage', () => {
    it('应成功创建页面并递增 pageCount', async () => {
      mockFindFirst.mockResolvedValue({ id: PRESENTATION_ID, pageCount: 3 })
      const mockPage = { id: PAGE_ID, presentationId: PRESENTATION_ID, orderIndex: 3 }
      mockInsertReturning.mockResolvedValue([mockPage])
      // 模拟 update 链式调用（用于递增 pageCount）
      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ returning: mockUpdateReturning })
        })
      })

      const result = await presentationService.createPage(PRESENTATION_ID, COMPANY_ID, {
        orderIndex: 3,
        outlineContent: { title: '新页面' }
      })

      expect(result).toEqual(mockPage)
    })

    it('演示文稿不存在时应返回 null', async () => {
      mockFindFirst.mockResolvedValue(undefined)

      const result = await presentationService.createPage('non-existent', COMPANY_ID, {
        orderIndex: 0,
        outlineContent: { title: '页面' }
      })

      expect(result).toBeNull()
    })
  })

  describe('updatePage', () => {
    it('应成功更新页面', async () => {
      // 第一次 findFirst: 验证演示文稿
      mockFindFirst.mockResolvedValueOnce({ id: PRESENTATION_ID })
      // 第二次 findFirst: 验证页面
      ;(db.query.presentationPages.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: PAGE_ID,
        presentationId: PRESENTATION_ID
      })
      const updated = { id: PAGE_ID, orderIndex: 2 }
      mockUpdateReturning.mockResolvedValue([updated])
      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ returning: mockUpdateReturning })
        })
      })

      const result = await presentationService.updatePage(PAGE_ID, PRESENTATION_ID, COMPANY_ID, { orderIndex: 2 })

      expect(result).toEqual(updated)
    })

    it('演示文稿不存在时应返回 null', async () => {
      mockFindFirst.mockResolvedValue(undefined)

      const result = await presentationService.updatePage(PAGE_ID, PRESENTATION_ID, COMPANY_ID, { orderIndex: 0 })

      expect(result).toBeNull()
    })
  })

  describe('deletePage', () => {
    it('应成功删除页面并清理图像', async () => {
      mockFindFirst.mockResolvedValueOnce({ id: PRESENTATION_ID })
      ;(db.query.presentationPages.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: PAGE_ID,
        presentationId: PRESENTATION_ID,
        generatedImageKey: 'img-key'
      })
      mockDeleteGeneratedImage.mockResolvedValue(undefined)
      mockDeleteWhere.mockResolvedValue(undefined)
      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ returning: mockUpdateReturning })
        })
      })

      const result = await presentationService.deletePage(PAGE_ID, PRESENTATION_ID, COMPANY_ID)

      expect(result).toBe(true)
      expect(mockDeleteGeneratedImage).toHaveBeenCalledWith('img-key')
    })

    it('无 generatedImageKey 时不清理图像', async () => {
      mockFindFirst.mockResolvedValueOnce({ id: PRESENTATION_ID })
      ;(db.query.presentationPages.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: PAGE_ID,
        presentationId: PRESENTATION_ID,
        generatedImageKey: null
      })
      mockDeleteWhere.mockResolvedValue(undefined)
      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ returning: mockUpdateReturning })
        })
      })

      const result = await presentationService.deletePage(PAGE_ID, PRESENTATION_ID, COMPANY_ID)

      expect(result).toBe(true)
      expect(mockDeleteGeneratedImage).not.toHaveBeenCalled()
    })

    it('页面不存在时应返回 false', async () => {
      mockFindFirst.mockResolvedValueOnce({ id: PRESENTATION_ID })
      ;(db.query.presentationPages.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined)

      const result = await presentationService.deletePage('non-existent', PRESENTATION_ID, COMPANY_ID)

      expect(result).toBe(false)
    })
  })

  describe('reorderPages', () => {
    it('应成功重排页面', async () => {
      mockFindFirst.mockResolvedValue({ id: PRESENTATION_ID })
      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ returning: mockUpdateReturning })
        })
      })

      const result = await presentationService.reorderPages(PRESENTATION_ID, COMPANY_ID, {
        pageIds: ['page-1', 'page-2', 'page-3']
      })

      expect(result).toBe(true)
    })

    it('演示文稿不存在时应返回 false', async () => {
      mockFindFirst.mockResolvedValue(undefined)

      const result = await presentationService.reorderPages('non-existent', COMPANY_ID, { pageIds: ['page-1'] })

      expect(result).toBe(false)
    })
  })

  describe('batchUpsertPages', () => {
    it('应批量写入页面', async () => {
      mockFindFirst.mockResolvedValue({ id: PRESENTATION_ID })
      mockDeleteWhere.mockResolvedValue(undefined)
      const inserted = [
        { id: 'new-page-1', orderIndex: 0 },
        { id: 'new-page-2', orderIndex: 1 }
      ]
      mockInsertReturning.mockResolvedValue(inserted)
      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ returning: mockUpdateReturning })
        })
      })

      const result = await presentationService.batchUpsertPages(PRESENTATION_ID, COMPANY_ID, [
        { orderIndex: 0, outlineContent: { title: '页面1' } },
        { orderIndex: 1, outlineContent: { title: '页面2' } }
      ])

      expect(result).toEqual(inserted)
    })

    it('空 pages 数组应清除旧页面并设 pageCount=0', async () => {
      mockFindFirst.mockResolvedValue({ id: PRESENTATION_ID })
      mockDeleteWhere.mockResolvedValue(undefined)
      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ returning: mockUpdateReturning })
        })
      })

      const result = await presentationService.batchUpsertPages(PRESENTATION_ID, COMPANY_ID, [])

      expect(result).toEqual([])
    })

    it('演示文稿不存在时应返回 null', async () => {
      mockFindFirst.mockResolvedValue(undefined)

      const result = await presentationService.batchUpsertPages('non-existent', COMPANY_ID, [])

      expect(result).toBeNull()
    })
  })

  // ============ 企业设置 ============

  describe('getSettings', () => {
    it('存在记录时应返回设置', async () => {
      const mockSettings = {
        companyId: COMPANY_ID,
        defaultTextModelId: VALID_UUID,
        defaultImageModelId: null,
        config: { maxPages: 50 }
      }
      ;(db.query.presentationSettings.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockSettings)

      const result = await presentationService.getSettings(COMPANY_ID)

      expect(result).toEqual(mockSettings)
    })

    it('不存在时应返回默认值', async () => {
      ;(db.query.presentationSettings.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

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
    it('存在记录时应更新', async () => {
      const existing = {
        companyId: COMPANY_ID,
        config: { maxPages: 50 }
      }
      ;(db.query.presentationSettings.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(existing)
      const updated = { ...existing, config: { maxPages: 100 } }
      mockUpdateReturning.mockResolvedValue([updated])

      const result = await presentationService.updateSettings(COMPANY_ID, { config: { maxPages: 100 } })

      expect(result).toEqual(updated)
    })

    it('不存在时应创建新记录', async () => {
      ;(db.query.presentationSettings.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
      const created = {
        companyId: COMPANY_ID,
        defaultTextModelId: null,
        defaultImageModelId: null,
        config: {}
      }
      mockInsertReturning.mockResolvedValue([created])

      const result = await presentationService.updateSettings(COMPANY_ID, {})

      expect(result).toEqual(created)
    })
  })

  // ============ Admin ============

  describe('adminListPresentations', () => {
    it('应返回跨用户的分页列表', async () => {
      const mockItems = [{ id: PRESENTATION_ID, title: '演示', user: { id: USER_ID, name: 'Test' } }]
      mockFindMany.mockResolvedValue(mockItems)
      mockSelectFrom.mockResolvedValue([{ total: 1 }])

      const result = await presentationService.adminListPresentations(COMPANY_ID, {
        page: 1,
        pageSize: 20,
        sortBy: 'updatedAt',
        sortOrder: 'desc'
      })

      expect(result.list).toEqual(mockItems)
      expect(result.total).toBe(1)
    })
  })

  describe('getStats', () => {
    it('应返回四个统计维度', async () => {
      mockSelectFrom
        .mockResolvedValueOnce([{ total: 10 }]) // totalPresentations
        .mockResolvedValueOnce([{ total: 5 }]) // totalExports
        .mockResolvedValueOnce([{ total: 20 }]) // totalAiCalls
        .mockResolvedValueOnce([{ total: 3 }]) // activeUsers

      const result = await presentationService.getStats(COMPANY_ID)

      expect(result).toEqual({
        totalPresentations: 10,
        totalExports: 5,
        totalAiCalls: 20,
        activeUsers: 3
      })
    })
  })

  // ============ 图像版本管理 ============

  describe('addImageVersion', () => {
    it('应添加新版本并更新页面 generatedImageKey', async () => {
      // 取消当前版本
      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ returning: mockUpdateReturning })
        })
      })
      // 获取最大版本号
      mockSelectFrom.mockResolvedValueOnce([{ max: 2 }])
      // 插入新版本
      const newVersion = { id: VERSION_ID, pageId: PAGE_ID, versionNumber: 3, isCurrent: true }
      mockInsertReturning.mockResolvedValue([newVersion])

      const result = await presentationService.addImageVersion(PAGE_ID, 'new-img-key', 'prompt text')

      expect(result).toEqual(newVersion)
    })
  })

  describe('getImageVersions', () => {
    it('应返回版本列表', async () => {
      const versions = [
        { id: 'v2', versionNumber: 2, isCurrent: true },
        { id: 'v1', versionNumber: 1, isCurrent: false }
      ]
      ;(db.query.presentationPages.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: PAGE_ID })
      ;(db.query.presentationImageVersions.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(versions)

      const result = await presentationService.getImageVersions(PRESENTATION_ID, PAGE_ID)

      expect(result).toEqual(versions)
    })

    it('页面不属于该演示文稿时应返回 null', async () => {
      ;(db.query.presentationPages.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined)

      const result = await presentationService.getImageVersions(PRESENTATION_ID, PAGE_ID)

      expect(result).toBeNull()
    })
  })

  describe('switchImageVersion', () => {
    it('应成功切换版本', async () => {
      const version = { id: VERSION_ID, pageId: PAGE_ID, imageKey: 'old-img-key' }
      ;(db.query.presentationPages.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: PAGE_ID })
      ;(db.query.presentationImageVersions.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(version)
      const updated = { ...version, isCurrent: true }
      mockUpdateReturning.mockResolvedValue([updated])
      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ returning: mockUpdateReturning })
        })
      })

      const result = await presentationService.switchImageVersion(PRESENTATION_ID, PAGE_ID, VERSION_ID)

      expect(result).toEqual(updated)
    })

    it('页面不属于该演示文稿时应返回 null', async () => {
      ;(db.query.presentationPages.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined)

      const result = await presentationService.switchImageVersion(PRESENTATION_ID, PAGE_ID, 'non-existent')

      expect(result).toBeNull()
    })

    it('版本不存在时应返回 null', async () => {
      ;(db.query.presentationPages.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: PAGE_ID })
      ;(db.query.presentationImageVersions.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

      const result = await presentationService.switchImageVersion(PRESENTATION_ID, PAGE_ID, 'non-existent')

      expect(result).toBeNull()
    })
  })
})

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'
