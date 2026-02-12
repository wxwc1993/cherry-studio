import type { Dayjs } from 'dayjs'

export interface PresentationListFilters {
  page: number
  pageSize: number
  status?: string
  userId?: string
  search?: string
  startDate?: string
  endDate?: string
  sortBy: 'createdAt' | 'updatedAt' | 'title'
  sortOrder: 'asc' | 'desc'
}

export interface PresentationListItem {
  id: string
  title: string
  status: string
  creationType: string
  pageCount: number
  userId: string
  userName?: string
  departmentName?: string
  createdAt: string
  updatedAt: string
  previewImageKey?: string
}

export interface PresentationDetailData {
  id: string
  title: string
  status: string
  creationType: string
  pageCount: number
  userId: string
  userName?: string
  departmentName?: string
  config: Record<string, unknown>
  sourceContent?: string
  createdAt: string
  updatedAt: string
  pages: PresentationPageItem[]
}

export interface PresentationPageItem {
  id: string
  orderIndex: number
  outlineContent: {
    title: string
    bulletPoints?: string[]
    notes?: string
  }
  descriptionContent?: {
    text: string
    imagePrompt?: string
    layout?: string
  }
  generatedImageKey?: string
}

export interface TemplateItem {
  id: string
  name: string
  description?: string
  storageKey: string
  previewImageKey?: string
  isPublic: boolean
  uploaderId: string
  uploaderName?: string
  createdAt: string
}

export interface PresentationSettingsData {
  id?: string
  defaultTextModelId?: string
  defaultImageModelId?: string
  config: {
    maxConcurrentTasks?: number
    maxPages?: number
    enabledExportFormats?: ('pptx' | 'pdf' | 'editable_pptx')[]
  }
}

export interface PresentationStatsData {
  totalPresentations: number
  totalExports: number
  totalAiCalls: number
  activeUsers: number
}

export interface PresentationUsageTrendItem {
  date: string
  count: number
}

export interface PresentationStatisticsFilters {
  dateRange: [Dayjs, Dayjs]
  groupBy: 'day' | 'week' | 'month'
}

export const PRESENTATION_STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'default' },
  outline_ready: { label: '大纲就绪', color: 'blue' },
  descriptions_ready: { label: '描述就绪', color: 'cyan' },
  images_ready: { label: '图像就绪', color: 'green' },
  completed: { label: '已完成', color: 'success' }
}

export const CREATION_TYPE_MAP: Record<string, string> = {
  idea: '灵感创建',
  outline: '大纲创建',
  description: '描述创建'
}
