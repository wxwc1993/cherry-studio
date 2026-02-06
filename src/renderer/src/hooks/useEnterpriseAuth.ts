import { enterpriseApi } from '@renderer/services/EnterpriseApi'
import { useAppSelector } from '@renderer/store'
import {
  selectAccessToken,
  selectIsAuthenticated,
  selectIsEnterpriseMode,
  selectUser,
  useEnterpriseStore
} from '@renderer/store/enterprise'
import { useCallback, useEffect } from 'react'

/**
 * 企业版认证 Hook
 * 提供认证状态管理和自动刷新功能
 */
export function useEnterpriseAuth() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const user = useAppSelector(selectUser)
  const accessToken = useAppSelector(selectAccessToken)
  const isEnterpriseMode = useAppSelector(selectIsEnterpriseMode)
  const { clearAuth, updateUser } = useEnterpriseStore()

  // 验证当前 token 是否有效
  const validateToken = useCallback(async (): Promise<boolean> => {
    if (!accessToken) return false

    try {
      await enterpriseApi.getMe()
      return true
    } catch {
      return false
    }
  }, [accessToken])

  // 刷新用户信息
  const refreshUser = useCallback(async () => {
    if (!isAuthenticated) return

    try {
      const response = await enterpriseApi.getMe()
      if (user) {
        updateUser(response.data as Record<string, unknown>)
      }
    } catch {
      // 忽略错误
    }
  }, [isAuthenticated, user, updateUser])

  // 登出
  const logout = useCallback(async () => {
    try {
      await enterpriseApi.logout()
    } catch {
      // 忽略错误
    }
    clearAuth()
  }, [clearAuth])

  // 初始化时验证 token
  useEffect(() => {
    if (isEnterpriseMode && accessToken) {
      validateToken().then((valid) => {
        if (!valid) {
          clearAuth()
        } else {
          refreshUser()
        }
      })
    }
  }, [isEnterpriseMode, accessToken, validateToken, clearAuth, refreshUser])

  return {
    isAuthenticated,
    user,
    isEnterpriseMode,
    logout,
    refreshUser,
    validateToken
  }
}

/**
 * 权限检查 Hook
 */
export function useHasPermission(category: string, action: string): boolean {
  const { hasPermission } = useEnterpriseStore()
  return hasPermission(category, action)
}

/**
 * 要求特定权限的 Hook
 * 如果没有权限，返回 null 表示不应渲染
 */
export function useRequirePermission(category: string, action: string): { hasPermission: boolean; user: unknown } {
  const user = useAppSelector(selectUser)
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const hasPermission = useHasPermission(category, action)

  return {
    hasPermission: isAuthenticated && hasPermission,
    user
  }
}

/**
 * 获取可用模型列表（考虑权限）
 */
export function useEnterpriseModelsFromAuth() {
  const isEnterpriseMode = useAppSelector(selectIsEnterpriseMode)
  const isAuthenticated = useAppSelector(selectIsAuthenticated)

  const fetchModels = useCallback(async () => {
    if (!isEnterpriseMode || !isAuthenticated) {
      return []
    }

    try {
      const response = await enterpriseApi.getModels()
      return response.data
    } catch {
      return []
    }
  }, [isEnterpriseMode, isAuthenticated])

  return { fetchModels }
}

/**
 * 企业版知识库 Hook
 */
export function useEnterpriseKnowledgeBases() {
  const isEnterpriseMode = useAppSelector(selectIsEnterpriseMode)
  const isAuthenticated = useAppSelector(selectIsAuthenticated)

  const fetchKnowledgeBases = useCallback(async () => {
    if (!isEnterpriseMode || !isAuthenticated) {
      return []
    }

    try {
      const response = await enterpriseApi.getKnowledgeBases()
      return response.data
    } catch {
      return []
    }
  }, [isEnterpriseMode, isAuthenticated])

  const search = useCallback(
    async (kbId: string, query: string, topK = 10) => {
      if (!isEnterpriseMode || !isAuthenticated) {
        return []
      }

      try {
        const response = await enterpriseApi.searchKnowledgeBase(kbId, query, topK)
        return response.data
      } catch {
        return []
      }
    },
    [isEnterpriseMode, isAuthenticated]
  )

  return { fetchKnowledgeBases, search }
}
