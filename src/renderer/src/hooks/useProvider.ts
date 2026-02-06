import { createSelector } from '@reduxjs/toolkit'
import { CHERRYAI_PROVIDER } from '@renderer/config/providers'
import { getDefaultProvider } from '@renderer/services/AssistantService'
import { type RootState, useAppDispatch, useAppSelector } from '@renderer/store'
import {
  addModel,
  addProvider,
  removeModel,
  removeProvider,
  updateModel,
  updateProvider,
  updateProviders
} from '@renderer/store/llm'
import type { Assistant, Model, Provider } from '@renderer/types'
import { isSystemProvider } from '@renderer/types'
import { withoutTrailingSlash } from '@renderer/utils/api'
import { useMemo } from 'react'

import { useDefaultModel } from './useAssistant'
import { useEnterpriseProviders } from './useEnterpriseProviders'
import { useEnterpriseRestrictions } from './useEnterpriseRestrictions'

/**
 * Normalizes provider apiHost by removing trailing slashes.
 * This ensures consistent URL concatenation across the application.
 */
function normalizeProvider<T extends Provider>(provider: T): T {
  return {
    ...provider,
    apiHost: withoutTrailingSlash(provider.apiHost)
  }
}

const selectProviders = (state: RootState) => state.llm.providers

const selectEnabledProviders = createSelector(selectProviders, (providers) =>
  providers
    .map(normalizeProvider)
    .filter((p) => p.enabled)
    .concat(CHERRYAI_PROVIDER)
)

const selectSystemProviders = createSelector(selectProviders, (providers) =>
  providers.filter((p) => isSystemProvider(p)).map(normalizeProvider)
)

const selectUserProviders = createSelector(selectProviders, (providers) =>
  providers.filter((p) => !isSystemProvider(p)).map(normalizeProvider)
)

const selectAllProviders = createSelector(selectProviders, (providers) => providers.map(normalizeProvider))

const selectAllProvidersWithCherryAI = createSelector(selectProviders, (providers) =>
  [...providers, CHERRYAI_PROVIDER].map(normalizeProvider)
)

export function useProviders() {
  const { isEnterpriseActive } = useEnterpriseRestrictions()
  const { providers: enterpriseProviders } = useEnterpriseProviders()
  const localProviders: Provider[] = useAppSelector(selectEnabledProviders)
  const dispatch = useAppDispatch()

  // 根据模式选择数据源：企业模式返回企业 providers，非企业模式返回本地 providers + CherryAI
  const providers = useMemo(() => {
    return isEnterpriseActive ? enterpriseProviders : localProviders
  }, [isEnterpriseActive, enterpriseProviders, localProviders])

  return {
    providers: providers || [],
    addProvider: (provider: Provider) => dispatch(addProvider(provider)),
    removeProvider: (provider: Provider) => dispatch(removeProvider(provider)),
    updateProvider: (updates: Partial<Provider> & { id: string }) => dispatch(updateProvider(updates)),
    updateProviders: (providers: Provider[]) => dispatch(updateProviders(providers))
  }
}

export function useSystemProviders() {
  return useAppSelector(selectSystemProviders)
}

export function useUserProviders() {
  return useAppSelector(selectUserProviders)
}

export function useAllProviders() {
  return useAppSelector(selectAllProviders)
}

export function useProvider(id: string) {
  const { isEnterpriseActive } = useEnterpriseRestrictions()
  const { providers: enterpriseProviders } = useEnterpriseProviders()
  const allLocalProviders = useAppSelector(selectAllProvidersWithCherryAI)
  const dispatch = useAppDispatch()

  const provider = useMemo(() => {
    // 企业模式：优先从企业 providers 查找
    if (isEnterpriseActive) {
      const enterpriseProvider = enterpriseProviders.find((p) => p.id === id)
      if (enterpriseProvider) {
        return enterpriseProvider
      }
    }
    // 本地模式或企业模式未找到：使用本地 providers
    return allLocalProviders.find((p) => p.id === id) || getDefaultProvider()
  }, [isEnterpriseActive, enterpriseProviders, allLocalProviders, id])

  // 企业模式下禁用修改操作
  const noOp = () => {}

  return {
    provider,
    models: provider?.models ?? [],
    isEnterpriseActive,
    updateProvider: isEnterpriseActive
      ? noOp
      : (updates: Partial<Provider>) => dispatch(updateProvider({ id, ...updates })),
    addModel: isEnterpriseActive ? noOp : (model: Model) => dispatch(addModel({ providerId: id, model })),
    removeModel: isEnterpriseActive ? noOp : (model: Model) => dispatch(removeModel({ providerId: id, model })),
    updateModel: isEnterpriseActive ? noOp : (model: Model) => dispatch(updateModel({ providerId: id, model }))
  }
}

export function useProviderByAssistant(assistant: Assistant) {
  const { defaultModel } = useDefaultModel()
  const model = assistant.model || defaultModel
  const { provider } = useProvider(model.provider)
  return provider
}
