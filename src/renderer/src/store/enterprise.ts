import type { PayloadAction } from '@reduxjs/toolkit'
import { createSlice } from '@reduxjs/toolkit'
import { useCallback } from 'react'

import type { RootState } from '.'
import { useAppDispatch, useAppSelector } from '.'

export interface EnterpriseUser {
  id: string
  name: string
  email: string
  avatar?: string
  role: {
    id: string
    name: string
    permissions: Record<string, string[]>
  }
  department: {
    id: string
    name: string
  }
}

type User = EnterpriseUser

export interface EnterpriseState {
  // 认证状态
  isAuthenticated: boolean
  user: User | null
  accessToken: string | null
  refreshToken: string | null

  // 企业模式
  isEnterpriseMode: boolean
  enterpriseServer: string | null
}

const initialState: EnterpriseState = {
  isAuthenticated: false,
  user: null,
  accessToken: null,
  refreshToken: null,
  isEnterpriseMode: true, // 企业版默认启用
  enterpriseServer: null
}

const enterpriseSlice = createSlice({
  name: 'enterprise',
  initialState,
  reducers: {
    setAuth: (
      state,
      action: PayloadAction<{
        user: User
        accessToken: string
        refreshToken: string
      }>
    ) => {
      state.isAuthenticated = true
      state.user = action.payload.user
      state.accessToken = action.payload.accessToken
      state.refreshToken = action.payload.refreshToken
    },

    clearAuth: (state) => {
      state.isAuthenticated = false
      state.user = null
      state.accessToken = null
      state.refreshToken = null
    },

    setEnterpriseMode: (
      state,
      action: PayloadAction<{
        enabled: boolean
        server?: string
      }>
    ) => {
      state.isEnterpriseMode = action.payload.enabled
      state.enterpriseServer = action.payload.server || null
    },

    updateTokens: (
      state,
      action: PayloadAction<{
        accessToken: string
        refreshToken: string
      }>
    ) => {
      state.accessToken = action.payload.accessToken
      state.refreshToken = action.payload.refreshToken
    },

    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload }
      }
    }
  }
})

export const { setAuth, clearAuth, setEnterpriseMode, updateTokens, updateUser } = enterpriseSlice.actions

// Selectors
export const selectEnterpriseState = (state: RootState) => state.enterprise
export const selectIsAuthenticated = (state: RootState) => state.enterprise?.isAuthenticated ?? false
export const selectIsEnterpriseMode = (state: RootState) => state.enterprise?.isEnterpriseMode ?? false
export const selectUser = (state: RootState) => state.enterprise?.user ?? null
export const selectEnterpriseServer = (state: RootState) => state.enterprise?.enterpriseServer ?? null
export const selectAccessToken = (state: RootState) => state.enterprise?.accessToken ?? null
export const selectRefreshToken = (state: RootState) => state.enterprise?.refreshToken ?? null

// 权限检查
export const selectHasPermission = (state: RootState, category: string, action: string): boolean => {
  const user = state.enterprise?.user
  if (!user) return false

  const permissions = user.role.permissions[category]
  if (!permissions) return false

  return permissions.includes(action)
}

// Custom Hooks for convenience
export function useEnterpriseStore() {
  const dispatch = useAppDispatch()
  const state = useAppSelector(selectEnterpriseState) || initialState

  const setAuthAction = useCallback(
    (user: User, accessToken: string, refreshToken: string) => {
      dispatch(setAuth({ user, accessToken, refreshToken }))
    },
    [dispatch]
  )

  const clearAuthAction = useCallback(() => {
    dispatch(clearAuth())
  }, [dispatch])

  const setEnterpriseModeAction = useCallback(
    (enabled: boolean, server?: string) => {
      dispatch(setEnterpriseMode({ enabled, server }))
    },
    [dispatch]
  )

  const updateTokensAction = useCallback(
    (accessToken: string, refreshToken: string) => {
      dispatch(updateTokens({ accessToken, refreshToken }))
    },
    [dispatch]
  )

  const updateUserAction = useCallback(
    (updates: Partial<User>) => {
      dispatch(updateUser(updates))
    },
    [dispatch]
  )

  const hasPermission = useCallback(
    (category: string, action: string): boolean => {
      const user = state.user
      if (!user) return false

      const permissions = user.role.permissions[category]
      if (!permissions) return false

      return permissions.includes(action)
    },
    [state.user]
  )

  return {
    ...state,
    setAuth: setAuthAction,
    clearAuth: clearAuthAction,
    setEnterpriseMode: setEnterpriseModeAction,
    updateTokens: updateTokensAction,
    updateUser: updateUserAction,
    hasPermission
  }
}

// 权限 Hook
export function usePermission(category: string, action: string): boolean {
  const { hasPermission } = useEnterpriseStore()
  return hasPermission(category, action)
}

// 认证 Hook
export function useAuth() {
  const { isAuthenticated, user, clearAuth } = useEnterpriseStore()
  return { isAuthenticated, user, logout: clearAuth }
}

// 企业模式 Hook
export function useEnterpriseMode() {
  const { isEnterpriseMode, enterpriseServer, setEnterpriseMode } = useEnterpriseStore()
  return { isEnterpriseMode, enterpriseServer, setEnterpriseMode }
}

export default enterpriseSlice.reducer
