import { enterpriseApi } from '@renderer/services/EnterpriseApi'
import { adaptEnterpriseModel, type EnterpriseApiModel } from '@renderer/services/EnterpriseModelAdapter'
import { useAppSelector } from '@renderer/store'
import { selectIsAuthenticated, selectIsEnterpriseMode } from '@renderer/store/enterprise'
import type { Model } from '@renderer/types'
import { useCallback } from 'react'
import useSWR from 'swr'

interface EnterpriseDefaultModels {
  defaultAssistantModel: Model | undefined
  quickModel: Model | undefined
  translateModel: Model | undefined
  isLoading: boolean
  error: Error | undefined
}

/**
 * 企业默认模型 Hook
 * 从服务端获取管理员配置的默认模型（助手模型、快速模型、翻译模型）
 * 仅在企业模式激活时发起请求
 */
export function useEnterpriseDefaultModels(): EnterpriseDefaultModels {
  const isEnterpriseMode = useAppSelector(selectIsEnterpriseMode)
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const shouldFetch = isEnterpriseMode && isAuthenticated

  const fetcher = useCallback(async () => {
    const response = await enterpriseApi.getClientSettings()
    const { defaultModels } = response.data

    return {
      defaultAssistantModel: defaultModels.defaultAssistantModel
        ? adaptEnterpriseModel(defaultModels.defaultAssistantModel as unknown as EnterpriseApiModel)
        : undefined,
      quickModel: defaultModels.quickModel
        ? adaptEnterpriseModel(defaultModels.quickModel as unknown as EnterpriseApiModel)
        : undefined,
      translateModel: defaultModels.translateModel
        ? adaptEnterpriseModel(defaultModels.translateModel as unknown as EnterpriseApiModel)
        : undefined
    }
  }, [])

  const { data, error, isLoading } = useSWR(shouldFetch ? '/enterprise/client-settings' : null, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 60000
  })

  return {
    defaultAssistantModel: data?.defaultAssistantModel,
    quickModel: data?.quickModel,
    translateModel: data?.translateModel,
    isLoading,
    error
  }
}
