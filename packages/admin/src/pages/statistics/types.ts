import type { Dayjs } from 'dayjs'

export interface UsageData {
  date: string
  requests: number
  tokens: number
  cost: number
  avgLatency?: number
}

export interface ModelUsage {
  modelId: string | null
  modelName: string
  requests: number
  tokens: number
  cost: number
  avgLatency?: number
}

export interface UserUsage {
  userId: string
  userName: string
  department: string
  requests: number
  tokens: number
  cost: number
}

export interface DepartmentUsage {
  departmentId: string
  departmentName: string
  path: string
  parentId: string | null
  requests: number
  tokens: number
  cost: number
  userCount: number
}

export interface PresetUsage {
  presetId: string
  presetName: string
  emoji: string | null
  requests: number
  tokens: number
  cost: number
  uniqueUsers: number
}

export interface FilterModel {
  id: string
  displayName: string
}

export interface FilterDepartment {
  id: string
  name: string
}

export interface StatisticsFilterParams {
  startDate: string
  endDate: string
  modelId?: string
  departmentId?: string
  assistantPresetId?: string
  groupBy: 'day' | 'week' | 'month'
}

export interface StatisticsFilters {
  dateRange: [Dayjs, Dayjs]
  modelId: string | null
  departmentId: string | null
  groupBy: 'day' | 'week' | 'month'
}
