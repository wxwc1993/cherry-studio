import { loggerService } from '@logger'
import { enterpriseApi } from '@renderer/services/EnterpriseApi'
import type { RootState } from '@renderer/store'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'

const logger = loggerService.withContext('useLearningCenter')

interface LcStats {
  totalCourses: number
  totalDocuments: number
  totalViews: number
}

interface LcHotItem {
  id: string
  title: string
  linkUrl: string
  tag?: string
  heatValue: number
  order: number
}

interface LcCourse {
  id: string
  title: string
  description?: string
  coverUrl?: string
  videoUrl: string
  duration: number
  author?: string
  order: number
  isRecommended: boolean
  viewCount: number
}

interface LcDocument {
  id: string
  title: string
  description?: string
  coverUrl?: string
  linkUrl: string
  linkType: string
  author?: string
  order: number
  isRecommended: boolean
  viewCount: number
}

export interface LcCourseCategory {
  id: string
  name: string
  order: number
  courses: LcCourse[]
}

export interface LcDocumentCategory {
  id: string
  name: string
  order: number
  documents: LcDocument[]
}

interface LcBanner {
  id: string
  title: string
  imageUrl: string
  linkUrl?: string
  linkType?: string
  order: number
}

export interface LcClientData {
  banners: LcBanner[]
  courseCategories: LcCourseCategory[]
  documentCategories: LcDocumentCategory[]
  hotItems: LcHotItem[]
  stats: LcStats
}

export type { LcBanner, LcCourse, LcDocument, LcHotItem, LcStats }

export function useLearningCenter() {
  const [data, setData] = useState<LcClientData | null>(null)
  const [hotItems, setHotItems] = useState<LcHotItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [noMoreHotItems, setNoMoreHotItems] = useState(false)

  const seenHotItemIds = useRef<Set<string>>(new Set())
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  const isEnterpriseMode = useSelector((state: RootState) => !!state.enterprise?.enterpriseServer)

  const loadData = useCallback(async () => {
    if (!isEnterpriseMode) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const response = await enterpriseApi.getLearningCenterData()
      setData(response.data)
      setHotItems(response.data.hotItems)
      const ids = new Set<string>()
      for (const item of response.data.hotItems) {
        ids.add(item.id)
      }
      seenHotItemIds.current = ids
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load learning center data'
      setError(message)
      logger.error('Failed to load learning center data', { error: message })
    } finally {
      setLoading(false)
    }
  }, [isEnterpriseMode])

  useEffect(() => {
    loadData()
  }, [loadData])

  const refreshHotItems = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(async () => {
      try {
        const excludeIds = Array.from(seenHotItemIds.current)
        const response = await enterpriseApi.getHotItemsBatch(excludeIds)
        const newItems = response.data

        if (newItems.length === 0) {
          setNoMoreHotItems(true)
          return
        }

        setHotItems(newItems)
        for (const item of newItems) {
          seenHotItemIds.current.add(item.id)
        }
        setNoMoreHotItems(false)
      } catch (err) {
        logger.error('Failed to refresh hot items', { error: err instanceof Error ? err.message : 'Unknown' })
      }
    }, 300)
  }, [])

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [])

  return {
    data,
    hotItems,
    loading,
    error,
    noMoreHotItems,
    refreshHotItems,
    reload: loadData
  }
}
