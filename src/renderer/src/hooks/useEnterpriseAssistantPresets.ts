import { loggerService } from '@logger'
import { useAppSelector } from '@renderer/store'
import { selectIsAuthenticated, selectIsEnterpriseMode } from '@renderer/store/enterprise'
import type { AssistantPreset } from '@renderer/types'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { enterpriseApi } from '../services/EnterpriseApi'

const logger = loggerService.withContext('useEnterpriseAssistantPresets')

interface EnterprisePresetTag {
  id: string
  name: string
  locale: string
  order: number
}

interface EnterprisePresetItem {
  id: string
  name: string
  emoji?: string
  description?: string
  prompt: string
  locale: string
  isEnabled: boolean
  order: number
  tags?: EnterprisePresetTag[]
}

/**
 * 将服务端预设数据转换为客户端 AssistantPreset 格式
 */
function toAssistantPreset(item: EnterprisePresetItem): AssistantPreset {
  return {
    id: item.id,
    name: item.name,
    emoji: item.emoji,
    description: item.description,
    prompt: item.prompt,
    topics: [],
    type: 'agent',
    group: (item.tags || []).map((tag) => tag.name)
  }
}

/**
 * 企业模式下从服务端获取助手预设数据的 Hook。
 * 仅在企业模式 + 已认证时从服务端获取，否则返回空数组。
 */
export function useEnterpriseAssistantPresets(): AssistantPreset[] {
  const isEnterpriseMode = useAppSelector(selectIsEnterpriseMode)
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const [presets, setPresets] = useState<AssistantPreset[]>([])
  const { i18n } = useTranslation()
  const currentLanguage = i18n.language

  useEffect(() => {
    if (!isEnterpriseMode || !isAuthenticated) {
      setPresets([])
      return
    }

    const loadPresets = async () => {
      try {
        const locale = currentLanguage === 'zh-CN' ? 'zh-CN' : 'en-US'
        const response = await enterpriseApi.getAssistantPresets(locale)
        const items = response.data?.presets || []
        const converted = items.map(toAssistantPreset)
        setPresets(converted)
      } catch (error) {
        logger.error('Failed to load enterprise assistant presets:', error as Error)
        setPresets([])
      }
    }

    loadPresets()
  }, [isEnterpriseMode, isAuthenticated, currentLanguage])

  return presets
}
