import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ============ Mocks ============

// Mock the learningCenterApi service
const mockListBanners = vi.fn().mockResolvedValue({ data: { data: [], pagination: { total: 0 } } })
const mockCreateBanner = vi.fn().mockResolvedValue({ data: { data: {} } })
const mockUpdateBanner = vi.fn().mockResolvedValue({ data: { data: {} } })
const mockDeleteBanner = vi.fn().mockResolvedValue({ data: {} })
const mockListCourseCategories = vi.fn().mockResolvedValue({ data: { data: [] } })
const mockCreateCourseCategory = vi.fn().mockResolvedValue({ data: { data: {} } })
const mockUpdateCourseCategory = vi.fn().mockResolvedValue({ data: { data: {} } })
const mockDeleteCourseCategory = vi.fn().mockResolvedValue({ data: {} })
const mockListCourses = vi.fn().mockResolvedValue({ data: { data: [], pagination: { total: 0 } } })
const mockCreateCourse = vi.fn().mockResolvedValue({ data: { data: {} } })
const mockUpdateCourse = vi.fn().mockResolvedValue({ data: { data: {} } })
const mockDeleteCourse = vi.fn().mockResolvedValue({ data: {} })
const mockListDocumentCategories = vi.fn().mockResolvedValue({ data: { data: [] } })
const mockCreateDocumentCategory = vi.fn().mockResolvedValue({ data: { data: {} } })
const mockUpdateDocumentCategory = vi.fn().mockResolvedValue({ data: { data: {} } })
const mockDeleteDocumentCategory = vi.fn().mockResolvedValue({ data: {} })
const mockListDocuments = vi.fn().mockResolvedValue({ data: { data: [], pagination: { total: 0 } } })
const mockCreateDocument = vi.fn().mockResolvedValue({ data: { data: {} } })
const mockUpdateDocument = vi.fn().mockResolvedValue({ data: { data: {} } })
const mockDeleteDocument = vi.fn().mockResolvedValue({ data: {} })
const mockListHotItems = vi.fn().mockResolvedValue({ data: { data: [], pagination: { total: 0 } } })
const mockCreateHotItem = vi.fn().mockResolvedValue({ data: { data: {} } })
const mockUpdateHotItem = vi.fn().mockResolvedValue({ data: { data: {} } })
const mockDeleteHotItem = vi.fn().mockResolvedValue({ data: {} })

vi.mock('../../services/learningCenterApi', () => ({
  learningCenterApi: {
    listBanners: mockListBanners,
    createBanner: mockCreateBanner,
    updateBanner: mockUpdateBanner,
    deleteBanner: mockDeleteBanner,
    listCourseCategories: mockListCourseCategories,
    createCourseCategory: mockCreateCourseCategory,
    updateCourseCategory: mockUpdateCourseCategory,
    deleteCourseCategory: mockDeleteCourseCategory,
    listCourses: mockListCourses,
    createCourse: mockCreateCourse,
    updateCourse: mockUpdateCourse,
    deleteCourse: mockDeleteCourse,
    listDocumentCategories: mockListDocumentCategories,
    createDocumentCategory: mockCreateDocumentCategory,
    updateDocumentCategory: mockUpdateDocumentCategory,
    deleteDocumentCategory: mockDeleteDocumentCategory,
    listDocuments: mockListDocuments,
    createDocument: mockCreateDocument,
    updateDocument: mockUpdateDocument,
    deleteDocument: mockDeleteDocument,
    listHotItems: mockListHotItems,
    createHotItem: mockCreateHotItem,
    updateHotItem: mockUpdateHotItem,
    deleteHotItem: mockDeleteHotItem
  }
}))

// Mock the auth store
const mockHasPermission = vi.fn().mockReturnValue(true)

vi.mock('../../store/auth', () => ({
  useAuthStore: () => ({
    hasPermission: mockHasPermission,
    user: { id: 'user-1', name: 'Admin', role: { permissions: {} } }
  })
}))

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/learning-center' })
}))

// Mock antd message
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd')
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn()
    }
  }
})

// Import components under test (these files do not exist yet - RED phase)
import LearningCenter from '../LearningCenter'
import BannerManager from '../LearningCenter/BannerManager'
import CourseManager from '../LearningCenter/CourseManager'
import DocumentManager from '../LearningCenter/DocumentManager'
import HotItemManager from '../LearningCenter/HotItemManager'

describe('LearningCenter main container', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHasPermission.mockReturnValue(true)
  })

  afterEach(() => {
    cleanup()
  })

  it('should render the page title', () => {
    render(<LearningCenter />)
    expect(screen.getByText('学习中心管理')).toBeInTheDocument()
  })

  it('should render Tabs component', () => {
    render(<LearningCenter />)
    // Tabs should be visible in the DOM
    const tabsElement = screen.getByRole('tablist')
    expect(tabsElement).toBeInTheDocument()
  })

  it('should render 4 tab items', () => {
    render(<LearningCenter />)
    expect(screen.getByRole('tab', { name: /Banner 管理/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /视频课程/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /知识文档/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /热搜要闻/i })).toBeInTheDocument()
  })

  it('should have banners tab active by default', () => {
    render(<LearningCenter />)
    const bannersTab = screen.getByRole('tab', { name: /Banner 管理/i })
    expect(bannersTab).toHaveAttribute('aria-selected', 'true')
  })

  it('should switch to courses tab when clicked', async () => {
    const user = userEvent.setup()
    render(<LearningCenter />)

    const coursesTab = screen.getByRole('tab', { name: /视频课程/i })
    await user.click(coursesTab)

    expect(coursesTab).toHaveAttribute('aria-selected', 'true')
  })

  it('should switch to documents tab when clicked', async () => {
    const user = userEvent.setup()
    render(<LearningCenter />)

    const documentsTab = screen.getByRole('tab', { name: /知识文档/i })
    await user.click(documentsTab)

    expect(documentsTab).toHaveAttribute('aria-selected', 'true')
  })

  it('should switch to hot items tab when clicked', async () => {
    const user = userEvent.setup()
    render(<LearningCenter />)

    const hotItemsTab = screen.getByRole('tab', { name: /热搜要闻/i })
    await user.click(hotItemsTab)

    expect(hotItemsTab).toHaveAttribute('aria-selected', 'true')
  })
})

// ============ BannerManager Tests ============

describe('BannerManager', () => {
  const mockBanners = [
    {
      id: 'banner-1',
      title: 'Welcome Banner',
      imageUrl: 'https://example.com/banner1.png',
      linkUrl: 'https://example.com',
      linkType: 'external',
      order: 1,
      isEnabled: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    },
    {
      id: 'banner-2',
      title: 'Event Banner',
      imageUrl: 'https://example.com/banner2.png',
      order: 2,
      isEnabled: false,
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z'
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockHasPermission.mockReturnValue(true)
    mockListBanners.mockResolvedValue({ data: { data: mockBanners, pagination: { total: 2 } } })
  })

  afterEach(() => {
    cleanup()
  })

  it('should render a table with correct columns', async () => {
    render(<BannerManager />)

    await waitFor(() => {
      expect(screen.getByText('图片预览')).toBeInTheDocument()
      expect(screen.getByText('标题')).toBeInTheDocument()
      expect(screen.getByText('链接')).toBeInTheDocument()
      expect(screen.getByText('排序')).toBeInTheDocument()
      expect(screen.getByText('状态')).toBeInTheDocument()
      expect(screen.getByText('操作')).toBeInTheDocument()
    })
  })

  it('should render banner data in the table', async () => {
    render(<BannerManager />)

    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument()
      expect(screen.getByText('Event Banner')).toBeInTheDocument()
    })
  })

  it('should render an add button', async () => {
    render(<BannerManager />)

    await waitFor(() => {
      const addButton = screen.getByRole('button', { name: /新增/i })
      expect(addButton).toBeInTheDocument()
    })
  })

  it('should open a modal when add button is clicked', async () => {
    const user = userEvent.setup()
    render(<BannerManager />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /新增/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /新增/i }))

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  it('should have form fields in the modal: title, imageUrl, linkUrl, linkType, order, isEnabled', async () => {
    const user = userEvent.setup()
    render(<BannerManager />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /新增/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /新增/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/标题/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/图片/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/链接地址/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/链接类型/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/排序/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/启用/i)).toBeInTheDocument()
    })
  })

  it('should show loading state while fetching data', () => {
    mockListBanners.mockReturnValue(new Promise(() => {})) // Never resolves
    render(<BannerManager />)

    expect(
      screen.getByText(/加载/i).closest('.ant-spin') ||
        screen.getByRole('img', { name: /loading/i }) ||
        document.querySelector('.ant-spin')
    ).toBeTruthy()
  })

  it('should show delete confirmation when delete button is clicked', async () => {
    const user = userEvent.setup()
    render(<BannerManager />)

    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument()
    })

    // Find and click the first delete button
    const deleteButtons = screen.getAllByRole('button', { name: /删除/i })
    await user.click(deleteButtons[0])

    await waitFor(() => {
      expect(screen.getByText(/确定/i)).toBeInTheDocument()
    })
  })

  it('should call deleteBanner when delete is confirmed', async () => {
    const user = userEvent.setup()
    render(<BannerManager />)

    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByRole('button', { name: /删除/i })
    await user.click(deleteButtons[0])

    await waitFor(() => {
      expect(screen.getByText(/确定/i)).toBeInTheDocument()
    })

    await user.click(screen.getByText(/确定/i))

    await waitFor(() => {
      expect(mockDeleteBanner).toHaveBeenCalledWith('banner-1')
    })
  })

  it('should call listBanners on mount', async () => {
    render(<BannerManager />)

    await waitFor(() => {
      expect(mockListBanners).toHaveBeenCalled()
    })
  })
})

// ============ CourseManager Tests ============

describe('CourseManager', () => {
  const mockCategories = [
    { id: 'cat-1', name: 'AI Basics', order: 1, isEnabled: true },
    { id: 'cat-2', name: 'Advanced Topics', order: 2, isEnabled: true }
  ]

  const mockCourses = [
    {
      id: 'course-1',
      title: 'Intro to AI',
      categoryId: 'cat-1',
      duration: 3600,
      author: 'Zhang San',
      isRecommended: true,
      isEnabled: true,
      viewCount: 100,
      order: 1
    },
    {
      id: 'course-2',
      title: 'Deep Learning',
      categoryId: 'cat-2',
      duration: 7200,
      author: 'Li Si',
      isRecommended: false,
      isEnabled: false,
      viewCount: 50,
      order: 2
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockHasPermission.mockReturnValue(true)
    mockListCourseCategories.mockResolvedValue({ data: { data: mockCategories } })
    mockListCourses.mockResolvedValue({ data: { data: mockCourses, pagination: { total: 2 } } })
  })

  afterEach(() => {
    cleanup()
  })

  it('should render a left-side category list', async () => {
    render(<CourseManager />)

    await waitFor(() => {
      expect(screen.getByText('AI Basics')).toBeInTheDocument()
      expect(screen.getByText('Advanced Topics')).toBeInTheDocument()
    })
  })

  it('should render a right-side course table with correct columns', async () => {
    render(<CourseManager />)

    await waitFor(() => {
      expect(screen.getByText('标题')).toBeInTheDocument()
      expect(screen.getByText('分类')).toBeInTheDocument()
      expect(screen.getByText('时长')).toBeInTheDocument()
      expect(screen.getByText('作者')).toBeInTheDocument()
      expect(screen.getByText('推荐')).toBeInTheDocument()
      expect(screen.getByText('状态')).toBeInTheDocument()
      expect(screen.getByText('操作')).toBeInTheDocument()
    })
  })

  it('should render course data in the table', async () => {
    render(<CourseManager />)

    await waitFor(() => {
      expect(screen.getByText('Intro to AI')).toBeInTheDocument()
      expect(screen.getByText('Deep Learning')).toBeInTheDocument()
    })
  })

  it('should have a search input', async () => {
    render(<CourseManager />)

    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText(/搜索/i)
      expect(searchInput).toBeInTheDocument()
    })
  })

  it('should filter courses when a category is clicked', async () => {
    const user = userEvent.setup()
    render(<CourseManager />)

    await waitFor(() => {
      expect(screen.getByText('AI Basics')).toBeInTheDocument()
    })

    await user.click(screen.getByText('AI Basics'))

    await waitFor(() => {
      expect(mockListCourses).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 'cat-1' }))
    })
  })

  it('should have a manage categories button that opens a modal', async () => {
    const user = userEvent.setup()
    render(<CourseManager />)

    await waitFor(() => {
      const manageCatButton = screen.getByRole('button', { name: /管理分类/i })
      expect(manageCatButton).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /管理分类/i }))

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  it('should call listCourseCategories and listCourses on mount', async () => {
    render(<CourseManager />)

    await waitFor(() => {
      expect(mockListCourseCategories).toHaveBeenCalled()
      expect(mockListCourses).toHaveBeenCalled()
    })
  })
})

// ============ DocumentManager Tests ============

describe('DocumentManager', () => {
  const mockDocCategories = [
    { id: 'doc-cat-1', name: 'User Guides', order: 1, isEnabled: true },
    { id: 'doc-cat-2', name: 'API Docs', order: 2, isEnabled: true }
  ]

  const mockDocuments = [
    {
      id: 'doc-1',
      title: 'Getting Started',
      categoryId: 'doc-cat-1',
      linkUrl: 'https://example.com/guide.pdf',
      linkType: 'external',
      author: 'Wang Wu',
      isRecommended: true,
      isEnabled: true,
      viewCount: 200,
      order: 1
    },
    {
      id: 'doc-2',
      title: 'API Reference',
      categoryId: 'doc-cat-2',
      linkUrl: '/docs/api',
      linkType: 'internal',
      author: 'Zhao Liu',
      isRecommended: false,
      isEnabled: false,
      viewCount: 80,
      order: 2
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockHasPermission.mockReturnValue(true)
    mockListDocumentCategories.mockResolvedValue({ data: { data: mockDocCategories } })
    mockListDocuments.mockResolvedValue({ data: { data: mockDocuments, pagination: { total: 2 } } })
  })

  afterEach(() => {
    cleanup()
  })

  it('should render a left-side category list', async () => {
    render(<DocumentManager />)

    await waitFor(() => {
      expect(screen.getByText('User Guides')).toBeInTheDocument()
      expect(screen.getByText('API Docs')).toBeInTheDocument()
    })
  })

  it('should render a right-side document table with correct columns', async () => {
    render(<DocumentManager />)

    await waitFor(() => {
      expect(screen.getByText('标题')).toBeInTheDocument()
      expect(screen.getByText('分类')).toBeInTheDocument()
      expect(screen.getByText('链接类型')).toBeInTheDocument()
      expect(screen.getByText('作者')).toBeInTheDocument()
      expect(screen.getByText('推荐')).toBeInTheDocument()
      expect(screen.getByText('状态')).toBeInTheDocument()
      expect(screen.getByText('操作')).toBeInTheDocument()
    })
  })

  it('should render document data in the table', async () => {
    render(<DocumentManager />)

    await waitFor(() => {
      expect(screen.getByText('Getting Started')).toBeInTheDocument()
      expect(screen.getByText('API Reference')).toBeInTheDocument()
    })
  })

  it('should call listDocumentCategories and listDocuments on mount', async () => {
    render(<DocumentManager />)

    await waitFor(() => {
      expect(mockListDocumentCategories).toHaveBeenCalled()
      expect(mockListDocuments).toHaveBeenCalled()
    })
  })

  it('should have a manage categories button', async () => {
    render(<DocumentManager />)

    await waitFor(() => {
      const manageCatButton = screen.getByRole('button', { name: /管理分类/i })
      expect(manageCatButton).toBeInTheDocument()
    })
  })
})

// ============ HotItemManager Tests ============

describe('HotItemManager', () => {
  const mockHotItemsData = [
    {
      id: 'hot-1',
      title: 'AI Trends 2024',
      linkUrl: 'https://example.com/trends',
      tag: 'hot',
      heatValue: 999,
      order: 1,
      isEnabled: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    },
    {
      id: 'hot-2',
      title: 'New Feature Release',
      linkUrl: 'https://example.com/release',
      tag: 'new',
      heatValue: 500,
      order: 2,
      isEnabled: true,
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z'
    },
    {
      id: 'hot-3',
      title: 'Community Update',
      linkUrl: 'https://example.com/community',
      heatValue: 300,
      order: 3,
      isEnabled: false,
      createdAt: '2024-01-03T00:00:00Z',
      updatedAt: '2024-01-03T00:00:00Z'
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockHasPermission.mockReturnValue(true)
    mockListHotItems.mockResolvedValue({ data: { data: mockHotItemsData, pagination: { total: 3 } } })
  })

  afterEach(() => {
    cleanup()
  })

  it('should render a table with correct columns', async () => {
    render(<HotItemManager />)

    await waitFor(() => {
      expect(screen.getByText('标题')).toBeInTheDocument()
      expect(screen.getByText('链接')).toBeInTheDocument()
      expect(screen.getByText('标签')).toBeInTheDocument()
      expect(screen.getByText('热度值')).toBeInTheDocument()
      expect(screen.getByText('排序')).toBeInTheDocument()
      expect(screen.getByText('状态')).toBeInTheDocument()
      expect(screen.getByText('操作')).toBeInTheDocument()
    })
  })

  it('should render hot item data in the table', async () => {
    render(<HotItemManager />)

    await waitFor(() => {
      expect(screen.getByText('AI Trends 2024')).toBeInTheDocument()
      expect(screen.getByText('New Feature Release')).toBeInTheDocument()
      expect(screen.getByText('Community Update')).toBeInTheDocument()
    })
  })

  it('should display tag labels correctly (hot/new/none)', async () => {
    render(<HotItemManager />)

    await waitFor(() => {
      // Hot tag for first item
      expect(screen.getByText('热')).toBeInTheDocument()
      // New tag for second item
      expect(screen.getByText('新')).toBeInTheDocument()
    })
  })

  it('should render an add button', async () => {
    render(<HotItemManager />)

    await waitFor(() => {
      const addButton = screen.getByRole('button', { name: /新增/i })
      expect(addButton).toBeInTheDocument()
    })
  })

  it('should open a modal with form when add button is clicked', async () => {
    const user = userEvent.setup()
    render(<HotItemManager />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /新增/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /新增/i }))

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByLabelText(/标题/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/链接/i)).toBeInTheDocument()
    })
  })

  it('should call listHotItems on mount', async () => {
    render(<HotItemManager />)

    await waitFor(() => {
      expect(mockListHotItems).toHaveBeenCalled()
    })
  })
})
