/**
 * useLearningCenter Hook 单元测试（TDD RED 阶段）
 *
 * 被测模块尚不存在，所有测试预期在 RED 阶段失败（模块导入错误）。
 * 覆盖范围：初始状态、非企业模式、企业模式数据加载、加载失败、
 *          refreshHotItems、reload、清理。
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — 先于被测模块加载
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  useSelector: vi.fn(),
  getLearningCenterData: vi.fn(),
  getHotItemsBatch: vi.fn()
}))

// Mock react-redux：useLearningCenter 内部通过 useSelector 读取企业状态
vi.mock('react-redux', () => ({
  useSelector: mocks.useSelector
}))

// Mock EnterpriseApi：hook 通过 enterpriseApi 发起网络请求
vi.mock('@renderer/services/EnterpriseApi', () => ({
  enterpriseApi: {
    getLearningCenterData: mocks.getLearningCenterData,
    getHotItemsBatch: mocks.getHotItemsBatch
  }
}))

// Mock i18n：hook 内部可能使用 t() 生成错误消息
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

// ---------------------------------------------------------------------------
// 测试数据工厂
// ---------------------------------------------------------------------------

/** 构造完整的 LcClientData mock 数据 */
const createMockClientData = (overrides: Record<string, unknown> = {}) => ({
  banners: [{ id: 'banner-1', title: '活动横幅', imageUrl: 'https://example.com/banner.png', order: 1 }],
  courseCategories: [
    {
      id: 'cat-1',
      name: '入门课程',
      order: 1,
      courses: [
        {
          id: 'course-1',
          title: '快速入门',
          videoUrl: 'https://example.com/video.mp4',
          duration: 600,
          order: 1,
          isRecommended: true,
          viewCount: 100
        }
      ]
    }
  ],
  documentCategories: [
    {
      id: 'doc-cat-1',
      name: '使用手册',
      order: 1,
      documents: [
        {
          id: 'doc-1',
          title: '用户指南',
          linkUrl: 'https://example.com/guide',
          linkType: 'external',
          order: 1,
          isRecommended: false,
          viewCount: 50
        }
      ]
    }
  ],
  hotItems: [
    { id: 'hot-1', title: '热搜项目1', linkUrl: 'https://example.com/hot1', heatValue: 99, order: 1 },
    { id: 'hot-2', title: '热搜项目2', linkUrl: 'https://example.com/hot2', heatValue: 88, order: 2 }
  ],
  stats: { totalCourses: 10, totalDocuments: 20, totalViews: 5000 },
  ...overrides
})

/** 构造热搜批次 mock 数据 */
const createMockHotBatch = (ids: string[]) =>
  ids.map((id, index) => ({
    id,
    title: `新热搜-${id}`,
    linkUrl: `https://example.com/${id}`,
    heatValue: 50 - index,
    order: index + 1
  }))

// ---------------------------------------------------------------------------
// 测试套件
// ---------------------------------------------------------------------------

describe('useLearningCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // =========================================================================
  // 1. 初始状态
  // =========================================================================
  describe('初始状态', () => {
    it('初始 loading 应为 true', async () => {
      // 模拟企业模式，API 永远 pending
      mocks.useSelector.mockReturnValue('https://enterprise.example.com')
      mocks.getLearningCenterData.mockReturnValue(new Promise(() => {}))

      const { useLearningCenter } = await import('../hooks/useLearningCenter')
      const { result } = renderHook(() => useLearningCenter())

      expect(result.current.loading).toBe(true)
    })

    it('初始 data 应为 null', async () => {
      mocks.useSelector.mockReturnValue('https://enterprise.example.com')
      mocks.getLearningCenterData.mockReturnValue(new Promise(() => {}))

      const { useLearningCenter } = await import('../hooks/useLearningCenter')
      const { result } = renderHook(() => useLearningCenter())

      expect(result.current.data).toBeNull()
    })

    it('初始 error 应为 null', async () => {
      mocks.useSelector.mockReturnValue('https://enterprise.example.com')
      mocks.getLearningCenterData.mockReturnValue(new Promise(() => {}))

      const { useLearningCenter } = await import('../hooks/useLearningCenter')
      const { result } = renderHook(() => useLearningCenter())

      expect(result.current.error).toBeNull()
    })

    it('初始 noMoreHotItems 应为 false', async () => {
      mocks.useSelector.mockReturnValue('https://enterprise.example.com')
      mocks.getLearningCenterData.mockReturnValue(new Promise(() => {}))

      const { useLearningCenter } = await import('../hooks/useLearningCenter')
      const { result } = renderHook(() => useLearningCenter())

      expect(result.current.noMoreHotItems).toBe(false)
    })
  })

  // =========================================================================
  // 2. 非企业模式行为
  // =========================================================================
  describe('非企业模式行为', () => {
    it('enterpriseServer 为空时不应调用 API', async () => {
      // 非企业模式：selector 返回 null/空
      mocks.useSelector.mockReturnValue(null)

      const { useLearningCenter } = await import('../hooks/useLearningCenter')
      renderHook(() => useLearningCenter())

      expect(mocks.getLearningCenterData).not.toHaveBeenCalled()
    })

    it('非企业模式下 loading 应为 false', async () => {
      mocks.useSelector.mockReturnValue(null)

      const { useLearningCenter } = await import('../hooks/useLearningCenter')
      const { result } = renderHook(() => useLearningCenter())

      expect(result.current.loading).toBe(false)
    })
  })

  // =========================================================================
  // 3. 企业模式数据加载
  // =========================================================================
  describe('企业模式数据加载', () => {
    it('应调用 enterpriseApi.getLearningCenterData()', async () => {
      const mockData = createMockClientData()
      mocks.useSelector.mockReturnValue('https://enterprise.example.com')
      mocks.getLearningCenterData.mockResolvedValue({ success: true, data: mockData })

      const { useLearningCenter } = await import('../hooks/useLearningCenter')
      renderHook(() => useLearningCenter())

      await waitFor(() => {
        expect(mocks.getLearningCenterData).toHaveBeenCalledTimes(1)
      })
    })

    it('成功后应设置 data', async () => {
      const mockData = createMockClientData()
      mocks.useSelector.mockReturnValue('https://enterprise.example.com')
      mocks.getLearningCenterData.mockResolvedValue({ success: true, data: mockData })

      const { useLearningCenter } = await import('../hooks/useLearningCenter')
      const { result } = renderHook(() => useLearningCenter())

      await waitFor(() => {
        expect(result.current.data).not.toBeNull()
      })
      expect(result.current.data?.banners).toHaveLength(1)
      expect(result.current.data?.stats.totalCourses).toBe(10)
    })

    it('成功后应设置 hotItems', async () => {
      const mockData = createMockClientData()
      mocks.useSelector.mockReturnValue('https://enterprise.example.com')
      mocks.getLearningCenterData.mockResolvedValue({ success: true, data: mockData })

      const { useLearningCenter } = await import('../hooks/useLearningCenter')
      const { result } = renderHook(() => useLearningCenter())

      await waitFor(() => {
        expect(result.current.hotItems).toHaveLength(2)
      })
      expect(result.current.hotItems[0].id).toBe('hot-1')
    })

    it('成功后 loading 应变为 false', async () => {
      const mockData = createMockClientData()
      mocks.useSelector.mockReturnValue('https://enterprise.example.com')
      mocks.getLearningCenterData.mockResolvedValue({ success: true, data: mockData })

      const { useLearningCenter } = await import('../hooks/useLearningCenter')
      const { result } = renderHook(() => useLearningCenter())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
    })
  })

  // =========================================================================
  // 4. 加载失败
  // =========================================================================
  describe('加载失败', () => {
    it('API 抛出错误时应设置 error 消息', async () => {
      mocks.useSelector.mockReturnValue('https://enterprise.example.com')
      mocks.getLearningCenterData.mockRejectedValue(new Error('Network failure'))

      const { useLearningCenter } = await import('../hooks/useLearningCenter')
      const { result } = renderHook(() => useLearningCenter())

      await waitFor(() => {
        expect(result.current.error).not.toBeNull()
      })
      expect(result.current.error).toContain('Network failure')
    })

    it('API 失败后 loading 应变为 false', async () => {
      mocks.useSelector.mockReturnValue('https://enterprise.example.com')
      mocks.getLearningCenterData.mockRejectedValue(new Error('Server error'))

      const { useLearningCenter } = await import('../hooks/useLearningCenter')
      const { result } = renderHook(() => useLearningCenter())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
    })
  })

  // =========================================================================
  // 5. refreshHotItems 方法
  // =========================================================================
  describe('refreshHotItems 方法', () => {
    it('应调用 getHotItemsBatch 并传入 excludeIds', async () => {
      const mockData = createMockClientData()
      mocks.useSelector.mockReturnValue('https://enterprise.example.com')
      mocks.getLearningCenterData.mockResolvedValue({ success: true, data: mockData })

      const newBatch = createMockHotBatch(['hot-3', 'hot-4'])
      mocks.getHotItemsBatch.mockResolvedValue({ success: true, data: newBatch })

      const { useLearningCenter } = await import('../hooks/useLearningCenter')
      const { result } = renderHook(() => useLearningCenter())

      // 等待初始数据加载完成
      await waitFor(() => {
        expect(result.current.data).not.toBeNull()
      })

      // 调用 refreshHotItems
      await act(async () => {
        result.current.refreshHotItems()
        // 快进 debounce 时间
        vi.advanceTimersByTime(300)
      })

      await waitFor(() => {
        expect(mocks.getHotItemsBatch).toHaveBeenCalled()
      })

      // 应传入已见过的 hotItem IDs 作为排除列表
      const calledArgs = mocks.getHotItemsBatch.mock.calls[0]
      expect(calledArgs[0]).toContain('hot-1')
      expect(calledArgs[0]).toContain('hot-2')
    })

    it('返回空数组时应设置 noMoreHotItems=true', async () => {
      const mockData = createMockClientData()
      mocks.useSelector.mockReturnValue('https://enterprise.example.com')
      mocks.getLearningCenterData.mockResolvedValue({ success: true, data: mockData })
      mocks.getHotItemsBatch.mockResolvedValue({ success: true, data: [] })

      const { useLearningCenter } = await import('../hooks/useLearningCenter')
      const { result } = renderHook(() => useLearningCenter())

      await waitFor(() => {
        expect(result.current.data).not.toBeNull()
      })

      await act(async () => {
        result.current.refreshHotItems()
        vi.advanceTimersByTime(300)
      })

      await waitFor(() => {
        expect(result.current.noMoreHotItems).toBe(true)
      })
    })

    it('返回新数据时应更新 hotItems', async () => {
      const mockData = createMockClientData()
      mocks.useSelector.mockReturnValue('https://enterprise.example.com')
      mocks.getLearningCenterData.mockResolvedValue({ success: true, data: mockData })

      const newBatch = createMockHotBatch(['hot-new-1', 'hot-new-2'])
      mocks.getHotItemsBatch.mockResolvedValue({ success: true, data: newBatch })

      const { useLearningCenter } = await import('../hooks/useLearningCenter')
      const { result } = renderHook(() => useLearningCenter())

      await waitFor(() => {
        expect(result.current.hotItems).toHaveLength(2)
      })

      await act(async () => {
        result.current.refreshHotItems()
        vi.advanceTimersByTime(300)
      })

      await waitFor(() => {
        // 热搜应已更新为新批次
        expect(result.current.hotItems.some((item: { id: string }) => item.id === 'hot-new-1')).toBe(true)
      })
    })

    it('refreshHotItems 应有 300ms debounce', async () => {
      const mockData = createMockClientData()
      mocks.useSelector.mockReturnValue('https://enterprise.example.com')
      mocks.getLearningCenterData.mockResolvedValue({ success: true, data: mockData })
      mocks.getHotItemsBatch.mockResolvedValue({ success: true, data: [] })

      const { useLearningCenter } = await import('../hooks/useLearningCenter')
      const { result } = renderHook(() => useLearningCenter())

      await waitFor(() => {
        expect(result.current.data).not.toBeNull()
      })

      // 连续快速调用多次
      await act(async () => {
        result.current.refreshHotItems()
        result.current.refreshHotItems()
        result.current.refreshHotItems()
      })

      // debounce 期间不应发起请求
      expect(mocks.getHotItemsBatch).not.toHaveBeenCalled()

      // 快进 300ms，触发 debounce
      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      await waitFor(() => {
        // 只应调用一次（debounce 合并多次调用）
        expect(mocks.getHotItemsBatch).toHaveBeenCalledTimes(1)
      })
    })
  })

  // =========================================================================
  // 6. reload 方法
  // =========================================================================
  describe('reload 方法', () => {
    it('调用 reload 后应重新加载数据', async () => {
      const mockData = createMockClientData()
      mocks.useSelector.mockReturnValue('https://enterprise.example.com')
      mocks.getLearningCenterData.mockResolvedValue({ success: true, data: mockData })

      const { useLearningCenter } = await import('../hooks/useLearningCenter')
      const { result } = renderHook(() => useLearningCenter())

      // 等待首次加载完成
      await waitFor(() => {
        expect(result.current.data).not.toBeNull()
      })
      expect(mocks.getLearningCenterData).toHaveBeenCalledTimes(1)

      // 调用 reload
      const updatedData = createMockClientData({ stats: { totalCourses: 20, totalDocuments: 40, totalViews: 10000 } })
      mocks.getLearningCenterData.mockResolvedValue({ success: true, data: updatedData })

      await act(async () => {
        await result.current.reload()
      })

      expect(mocks.getLearningCenterData).toHaveBeenCalledTimes(2)
    })
  })

  // =========================================================================
  // 7. 清理
  // =========================================================================
  describe('清理', () => {
    it('组件卸载时应清除 debounce timer', async () => {
      const mockData = createMockClientData()
      mocks.useSelector.mockReturnValue('https://enterprise.example.com')
      mocks.getLearningCenterData.mockResolvedValue({ success: true, data: mockData })
      mocks.getHotItemsBatch.mockResolvedValue({ success: true, data: [] })

      const { useLearningCenter } = await import('../hooks/useLearningCenter')
      const { result, unmount } = renderHook(() => useLearningCenter())

      await waitFor(() => {
        expect(result.current.data).not.toBeNull()
      })

      // 触发 refreshHotItems 但不等 debounce 结束
      await act(async () => {
        result.current.refreshHotItems()
      })

      // 立即卸载
      unmount()

      // 快进 debounce 时间，由于已卸载不应触发请求
      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      expect(mocks.getHotItemsBatch).not.toHaveBeenCalled()
    })
  })
})
