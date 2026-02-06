import { useCallback } from 'react'
import useSWR from 'swr'

import { enterpriseApi } from '@renderer/services/EnterpriseApi'
import { adaptEnterpriseModels, type EnterpriseApiModel } from '@renderer/services/EnterpriseModelAdapter'
import { useAppSelector } from '@renderer/store'
import { selectIsAuthenticated, selectIsEnterpriseMode } from '@renderer/store/enterprise'
import type { Model } from '@renderer/types'

/**
 * Hook for fetching models from enterprise API
 * Only active when in enterprise mode and authenticated
 */
export function useEnterpriseModels() {
  const isEnterpriseMode = useAppSelector(selectIsEnterpriseMode)
  const isAuthenticated = useAppSelector(selectIsAuthenticated)

  const fetcher = useCallback(async (): Promise<Model[]> => {
    const response = await enterpriseApi.getModels()
    const enterpriseModels = response.data as EnterpriseApiModel[]
    return adaptEnterpriseModels(enterpriseModels)
  }, [])

  const shouldFetch = isEnterpriseMode && isAuthenticated

  const { data, error, isLoading, mutate } = useSWR(shouldFetch ? '/enterprise/models' : null, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 60000 // 1 minute cache
  })

  return {
    models: data ?? [],
    error,
    isLoading,
    refetch: mutate,
    isEnterpriseMode,
    isAuthenticated
  }
}

/**
 * Hook that returns appropriate models based on current mode
 * In enterprise mode: returns enterprise models
 * In personal mode: should be combined with local useApiModels hook
 */
export function useCurrentModels() {
  const isEnterpriseMode = useAppSelector(selectIsEnterpriseMode)
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const enterpriseResult = useEnterpriseModels()

  // 如果是企业模式且已认证，返回企业模型
  if (isEnterpriseMode && isAuthenticated) {
    return {
      ...enterpriseResult,
      source: 'enterprise' as const
    }
  }

  // 否则返回空结果，调用方需要自行使用本地模型 hook
  return {
    models: [] as Model[],
    error: null,
    isLoading: false,
    refetch: () => Promise.resolve(undefined),
    isEnterpriseMode,
    isAuthenticated,
    source: 'local' as const
  }
}
