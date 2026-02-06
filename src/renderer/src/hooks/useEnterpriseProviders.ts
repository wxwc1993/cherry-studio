import { groupModelsToProviders } from '@renderer/services/EnterpriseModelAdapter'
import type { Provider } from '@renderer/types'
import { useMemo } from 'react'

import { useEnterpriseModels } from './useEnterpriseModels'

/**
 * 获取企业 providers（将企业 models 按 provider 分组）
 */
export function useEnterpriseProviders() {
  const { models, isLoading, error, isEnterpriseMode, isAuthenticated } = useEnterpriseModels()

  const providers = useMemo((): Provider[] => {
    if (!models || models.length === 0) return []
    return groupModelsToProviders(models)
  }, [models])

  return {
    providers,
    isLoading,
    error,
    isEnterpriseMode,
    isAuthenticated,
    isEmpty: !isLoading && providers.length === 0
  }
}
