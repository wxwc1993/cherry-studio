/**
 * LearningCenterPage 页面组件测试（TDD RED 阶段）
 *
 * 被测组件和子组件尚不存在，所有测试预期在 RED 阶段失败（模块导入错误）。
 * 覆盖范围：加载状态、错误状态、空数据状态、正常渲染、子组件 props 传递。
 */
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — 先于被测模块加载
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  useLearningCenter: vi.fn(),
  t: vi.fn((key: string) => key)
}))

// Mock useLearningCenter hook
vi.mock('../hooks/useLearningCenter', () => ({
  useLearningCenter: mocks.useLearningCenter
}))

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mocks.t })
}))

// Mock 子组件，使用 data-testid 便于断言
vi.mock('../components/PromotionBanner', () => ({
  default: (props: { stats: unknown }) => (
    <div data-testid="promotion-banner" data-stats={JSON.stringify(props.stats)}>
      PromotionBanner
    </div>
  )
}))

vi.mock('../components/CarouselBanner', () => ({
  default: (props: { banners: unknown[] }) => (
    <div data-testid="carousel-banner" data-banners-count={Array.isArray(props.banners) ? props.banners.length : 0}>
      CarouselBanner
    </div>
  )
}))

vi.mock('../components/LearningTabs', () => ({
  default: (props: { courseCategories: unknown[]; documentCategories: unknown[] }) => (
    <div
      data-testid="learning-tabs"
      data-course-count={Array.isArray(props.courseCategories) ? props.courseCategories.length : 0}
      data-doc-count={Array.isArray(props.documentCategories) ? props.documentCategories.length : 0}>
      LearningTabs
    </div>
  )
}))

vi.mock('../components/HotSearchPanel', () => ({
  default: (props: { items: unknown[]; onRefresh: () => void; noMore: boolean }) => (
    <div
      data-testid="hot-search-panel"
      data-items-count={Array.isArray(props.items) ? props.items.length : 0}
      data-no-more={String(props.noMore)}>
      <button type="button" data-testid="hot-search-refresh" onClick={props.onRefresh}>
        Refresh
      </button>
      HotSearchPanel
    </div>
  )
}))

// Mock antd 组件
vi.mock('antd', () => ({
  Spin: ({ size }: { size?: string }) => <div data-testid="spin" data-size={size} />,
  Empty: ({ description }: { description?: string }) => (
    <div data-testid="empty" data-description={description}>
      Empty
    </div>
  )
}))

// ---------------------------------------------------------------------------
// 测试数据工厂
// ---------------------------------------------------------------------------

/** 构造 useLearningCenter 的默认返回值 */
const createDefaultHookReturn = (overrides: Record<string, unknown> = {}) => ({
  data: null,
  hotItems: [],
  loading: false,
  error: null,
  noMoreHotItems: false,
  refreshHotItems: vi.fn(),
  reload: vi.fn(),
  ...overrides
})

/** 构造完整的页面数据 */
const createFullData = () => ({
  banners: [
    { id: 'b1', title: '横幅1', imageUrl: 'https://example.com/b1.png', order: 1 },
    { id: 'b2', title: '横幅2', imageUrl: 'https://example.com/b2.png', order: 2 }
  ],
  courseCategories: [
    {
      id: 'cc1',
      name: '基础课程',
      order: 1,
      courses: [
        {
          id: 'c1',
          title: '入门教程',
          videoUrl: 'https://example.com/v1.mp4',
          duration: 300,
          order: 1,
          isRecommended: true,
          viewCount: 100
        }
      ]
    },
    {
      id: 'cc2',
      name: '进阶课程',
      order: 2,
      courses: []
    }
  ],
  documentCategories: [
    {
      id: 'dc1',
      name: '用户手册',
      order: 1,
      documents: [
        {
          id: 'd1',
          title: '快速开始',
          linkUrl: 'https://example.com/doc1',
          linkType: 'external',
          order: 1,
          isRecommended: false,
          viewCount: 50
        }
      ]
    }
  ],
  hotItems: [
    { id: 'h1', title: '热搜1', linkUrl: 'https://example.com/h1', heatValue: 99, order: 1 },
    { id: 'h2', title: '热搜2', linkUrl: 'https://example.com/h2', heatValue: 88, order: 2 }
  ],
  stats: { totalCourses: 15, totalDocuments: 30, totalViews: 8000 }
})

// ---------------------------------------------------------------------------
// 测试套件
// ---------------------------------------------------------------------------

describe('LearningCenterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // =========================================================================
  // 1. 加载状态
  // =========================================================================
  describe('加载状态', () => {
    it('loading 为 true 时应渲染 Spin 组件', async () => {
      mocks.useLearningCenter.mockReturnValue(createDefaultHookReturn({ loading: true }))

      const { default: LearningCenterPage } = await import('../LearningCenterPage')
      render(<LearningCenterPage />)

      expect(screen.getByTestId('spin')).toBeInTheDocument()
      expect(screen.getByTestId('spin').getAttribute('data-size')).toBe('large')
    })

    it('loading 为 true 时不应渲染内容区域', async () => {
      mocks.useLearningCenter.mockReturnValue(createDefaultHookReturn({ loading: true }))

      const { default: LearningCenterPage } = await import('../LearningCenterPage')
      render(<LearningCenterPage />)

      expect(screen.queryByTestId('promotion-banner')).not.toBeInTheDocument()
      expect(screen.queryByTestId('carousel-banner')).not.toBeInTheDocument()
      expect(screen.queryByTestId('learning-tabs')).not.toBeInTheDocument()
      expect(screen.queryByTestId('hot-search-panel')).not.toBeInTheDocument()
    })
  })

  // =========================================================================
  // 2. 错误状态
  // =========================================================================
  describe('错误状态', () => {
    it('error 存在时应显示错误消息文本', async () => {
      const errorMessage = '加载学习中心数据失败'
      mocks.useLearningCenter.mockReturnValue(createDefaultHookReturn({ error: errorMessage }))

      const { default: LearningCenterPage } = await import('../LearningCenterPage')
      render(<LearningCenterPage />)

      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })

    it('错误消息应有红色样式标识', async () => {
      mocks.useLearningCenter.mockReturnValue(createDefaultHookReturn({ error: '网络错误' }))

      const { default: LearningCenterPage } = await import('../LearningCenterPage')
      const { container } = render(<LearningCenterPage />)

      // 错误消息应包含红色相关的 CSS 类名或内联样式
      const errorElement = screen.getByText('网络错误')
      const hasRedStyle =
        errorElement.className.includes('red') ||
        errorElement.className.includes('error') ||
        errorElement.style.color.includes('red') ||
        container.querySelector('[class*="red"]') !== null ||
        container.querySelector('[class*="error"]') !== null
      expect(hasRedStyle).toBe(true)
    })
  })

  // =========================================================================
  // 3. 空数据状态
  // =========================================================================
  describe('空数据状态', () => {
    it('data 为 null 时应显示空状态标题', async () => {
      mocks.useLearningCenter.mockReturnValue(createDefaultHookReturn({ data: null }))

      const { default: LearningCenterPage } = await import('../LearningCenterPage')
      render(<LearningCenterPage />)

      // 应显示 i18n key 对应的空状态文本
      expect(screen.getByText('learningCenter.empty.title')).toBeInTheDocument()
    })
  })

  // =========================================================================
  // 4. 正常渲染
  // =========================================================================
  describe('正常渲染', () => {
    const setupNormalRender = () => {
      const fullData = createFullData()
      const mockRefreshHotItems = vi.fn()
      mocks.useLearningCenter.mockReturnValue(
        createDefaultHookReturn({
          data: fullData,
          hotItems: fullData.hotItems,
          refreshHotItems: mockRefreshHotItems,
          noMoreHotItems: false
        })
      )
      return { fullData, mockRefreshHotItems }
    }

    it('应渲染 PromotionBanner 组件', async () => {
      setupNormalRender()

      const { default: LearningCenterPage } = await import('../LearningCenterPage')
      render(<LearningCenterPage />)

      expect(screen.getByTestId('promotion-banner')).toBeInTheDocument()
    })

    it('应渲染 CarouselBanner 组件', async () => {
      setupNormalRender()

      const { default: LearningCenterPage } = await import('../LearningCenterPage')
      render(<LearningCenterPage />)

      expect(screen.getByTestId('carousel-banner')).toBeInTheDocument()
    })

    it('应渲染 LearningTabs 组件', async () => {
      setupNormalRender()

      const { default: LearningCenterPage } = await import('../LearningCenterPage')
      render(<LearningCenterPage />)

      expect(screen.getByTestId('learning-tabs')).toBeInTheDocument()
    })

    it('应渲染 HotSearchPanel 组件', async () => {
      setupNormalRender()

      const { default: LearningCenterPage } = await import('../LearningCenterPage')
      render(<LearningCenterPage />)

      expect(screen.getByTestId('hot-search-panel')).toBeInTheDocument()
    })
  })

  // =========================================================================
  // 5. 子组件 props 传递
  // =========================================================================
  describe('子组件 props 传递', () => {
    it('PromotionBanner 应接收正确的 stats', async () => {
      const fullData = createFullData()
      mocks.useLearningCenter.mockReturnValue(
        createDefaultHookReturn({
          data: fullData,
          hotItems: fullData.hotItems
        })
      )

      const { default: LearningCenterPage } = await import('../LearningCenterPage')
      render(<LearningCenterPage />)

      const banner = screen.getByTestId('promotion-banner')
      const passedStats = JSON.parse(banner.getAttribute('data-stats') || '{}')
      expect(passedStats.totalCourses).toBe(15)
      expect(passedStats.totalDocuments).toBe(30)
      expect(passedStats.totalViews).toBe(8000)
    })

    it('CarouselBanner 应接收正确数量的 banners', async () => {
      const fullData = createFullData()
      mocks.useLearningCenter.mockReturnValue(
        createDefaultHookReturn({
          data: fullData,
          hotItems: fullData.hotItems
        })
      )

      const { default: LearningCenterPage } = await import('../LearningCenterPage')
      render(<LearningCenterPage />)

      const carousel = screen.getByTestId('carousel-banner')
      expect(carousel.getAttribute('data-banners-count')).toBe('2')
    })

    it('LearningTabs 应接收正确数量的分类', async () => {
      const fullData = createFullData()
      mocks.useLearningCenter.mockReturnValue(
        createDefaultHookReturn({
          data: fullData,
          hotItems: fullData.hotItems
        })
      )

      const { default: LearningCenterPage } = await import('../LearningCenterPage')
      render(<LearningCenterPage />)

      const tabs = screen.getByTestId('learning-tabs')
      expect(tabs.getAttribute('data-course-count')).toBe('2')
      expect(tabs.getAttribute('data-doc-count')).toBe('1')
    })

    it('HotSearchPanel 应接收 onRefresh 回调', async () => {
      const fullData = createFullData()
      const mockRefreshHotItems = vi.fn()
      mocks.useLearningCenter.mockReturnValue(
        createDefaultHookReturn({
          data: fullData,
          hotItems: fullData.hotItems,
          refreshHotItems: mockRefreshHotItems,
          noMoreHotItems: false
        })
      )

      const { default: LearningCenterPage } = await import('../LearningCenterPage')
      render(<LearningCenterPage />)

      // 点击刷新按钮，验证回调被调用
      const refreshButton = screen.getByTestId('hot-search-refresh')
      refreshButton.click()

      expect(mockRefreshHotItems).toHaveBeenCalledTimes(1)
    })

    it('HotSearchPanel 应接收正确的 noMore 状态', async () => {
      const fullData = createFullData()
      mocks.useLearningCenter.mockReturnValue(
        createDefaultHookReturn({
          data: fullData,
          hotItems: fullData.hotItems,
          noMoreHotItems: true
        })
      )

      const { default: LearningCenterPage } = await import('../LearningCenterPage')
      render(<LearningCenterPage />)

      const panel = screen.getByTestId('hot-search-panel')
      expect(panel.getAttribute('data-no-more')).toBe('true')
    })

    it('HotSearchPanel 应接收正确数量的 items', async () => {
      const fullData = createFullData()
      mocks.useLearningCenter.mockReturnValue(
        createDefaultHookReturn({
          data: fullData,
          hotItems: fullData.hotItems
        })
      )

      const { default: LearningCenterPage } = await import('../LearningCenterPage')
      render(<LearningCenterPage />)

      const panel = screen.getByTestId('hot-search-panel')
      expect(panel.getAttribute('data-items-count')).toBe('2')
    })
  })
})
