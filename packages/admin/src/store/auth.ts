import type { RolePermissions } from '@cherry-studio/enterprise-shared'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { api } from '../services/api'

interface User {
  id: string
  name: string
  email: string
  avatar?: string
  role: {
    id: string
    name: string
    permissions: RolePermissions
  }
  department: {
    id: string
    name: string
  }
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  setAuth: (user: User, accessToken: string, refreshToken: string) => void
  logout: () => void
  refreshTokens: () => Promise<boolean>
  hasPermission: (category: keyof RolePermissions, permission: string) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken) => {
        set({ user, accessToken, refreshToken, isAuthenticated: true })
      },

      logout: () => {
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
      },

      refreshTokens: async () => {
        const { refreshToken } = get()
        if (!refreshToken) return false

        try {
          const response = await api.post('/auth/refresh', { refreshToken })
          const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data.data
          set({ accessToken: newAccessToken, refreshToken: newRefreshToken })
          return true
        } catch {
          get().logout()
          return false
        }
      },

      hasPermission: (category, permission) => {
        const { user } = get()
        if (!user?.role?.permissions) return false
        const permissions = user.role.permissions[category] as string[] | undefined
        return permissions?.includes(permission) ?? false
      }
    }),
    {
      name: 'cherry-studio-admin-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
)
