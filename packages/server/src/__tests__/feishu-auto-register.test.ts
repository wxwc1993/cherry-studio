import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock db 和 models
const mockFindFirst = vi.fn()
const mockFindMany = vi.fn()
const mockUpdate = vi.fn()
const mockInsert = vi.fn()
const mockWhere = vi.fn()
const mockSet = vi.fn()
const mockValues = vi.fn()
const mockReturning = vi.fn()

vi.mock('../models', () => ({
  db: {
    query: {
      companies: { findFirst: (...args: unknown[]) => mockFindFirst('companies', ...args) },
      users: {
        findFirst: (...args: unknown[]) => mockFindFirst('users', ...args),
        findMany: (...args: unknown[]) => mockFindMany('users', ...args)
      },
      departments: { findFirst: (...args: unknown[]) => mockFindFirst('departments', ...args) },
      roles: { findFirst: (...args: unknown[]) => mockFindFirst('roles', ...args) }
    },
    update: (...args: unknown[]) => {
      mockUpdate(...args)
      return {
        set: (...setArgs: unknown[]) => {
          mockSet(...setArgs)
          return {
            where: (...whereArgs: unknown[]) => mockWhere(...whereArgs)
          }
        }
      }
    },
    insert: (...args: unknown[]) => {
      mockInsert(...args)
      return {
        values: (...valArgs: unknown[]) => {
          mockValues(...valArgs)
          return {
            returning: () => mockReturning()
          }
        }
      }
    }
  },
  companies: { feishuAppId: 'companies.feishuAppId' },
  users: { companyId: 'users.companyId', email: 'users.email', id: 'users.id', feishuUserId: 'users.feishuUserId' },
  departments: { id: 'departments.id' },
  roles: { id: 'roles.id' },
  auditLogs: 'auditLogs'
}))

vi.mock('../config', () => ({
  config: {
    feishu: {
      appId: 'test-feishu-app-id',
      appSecret: 'test-feishu-app-secret'
    }
  }
}))

vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

// Import after mocks
import { autoRegisterFeishuUser } from '../services/feishu-auto-register.service'

const baseParams = {
  feishuUserId: 'feishu-user-123',
  feishuOpenId: 'open-id-456',
  name: 'Test User',
  avatarUrl: 'https://example.com/avatar.png',
  email: 'test@example.com',
  mobile: '+86-13800138000'
}

const mockCompany = {
  id: 'company-uuid-1',
  name: 'Test Company',
  feishuAppId: 'test-feishu-app-id',
  settings: {
    maxUsers: 100,
    feishuAutoRegister: {
      enabled: true,
      defaultDepartmentId: 'dept-uuid-1',
      defaultRoleId: 'role-uuid-1',
      defaultStatus: 'active' as const
    }
  }
}

const mockDepartment = {
  id: 'dept-uuid-1',
  name: 'Default Department',
  companyId: 'company-uuid-1'
}

const mockRole = {
  id: 'role-uuid-1',
  name: 'Default Role',
  companyId: 'company-uuid-1',
  permissions: { models: ['read', 'use'] }
}

const mockCreatedUser = {
  id: 'new-user-uuid',
  companyId: 'company-uuid-1',
  departmentId: 'dept-uuid-1',
  roleId: 'role-uuid-1',
  feishuUserId: 'feishu-user-123',
  feishuOpenId: 'open-id-456',
  email: 'test@example.com',
  name: 'Test User',
  avatar: 'https://example.com/avatar.png',
  mobile: '+86-13800138000',
  status: 'active',
  role: mockRole,
  department: mockDepartment
}

describe('FeishuAutoRegister Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('autoRegisterFeishuUser', () => {
    it('should throw NotFoundError when no company matches feishu app id', async () => {
      mockFindFirst.mockResolvedValue(undefined)

      await expect(autoRegisterFeishuUser(baseParams)).rejects.toThrow(
        'User not registered. Please contact administrator.'
      )
    })

    it('should throw NotFoundError when auto-register is not enabled', async () => {
      const companyWithDisabled = {
        ...mockCompany,
        settings: {
          ...mockCompany.settings,
          feishuAutoRegister: {
            ...mockCompany.settings.feishuAutoRegister,
            enabled: false
          }
        }
      }

      mockFindFirst.mockImplementation((table: string) => {
        if (table === 'companies') return Promise.resolve(companyWithDisabled)
        return Promise.resolve(undefined)
      })

      await expect(autoRegisterFeishuUser(baseParams)).rejects.toThrow(
        'User not registered. Please contact administrator.'
      )
    })

    it('should throw NotFoundError when feishuAutoRegister settings are missing', async () => {
      const companyWithoutAutoRegister = {
        ...mockCompany,
        settings: { maxUsers: 100 }
      }

      mockFindFirst.mockImplementation((table: string) => {
        if (table === 'companies') return Promise.resolve(companyWithoutAutoRegister)
        return Promise.resolve(undefined)
      })

      await expect(autoRegisterFeishuUser(baseParams)).rejects.toThrow(
        'User not registered. Please contact administrator.'
      )
    })

    it('should throw error when company user limit is reached', async () => {
      mockFindFirst.mockImplementation((table: string) => {
        if (table === 'companies') return Promise.resolve(mockCompany)
        return Promise.resolve(undefined)
      })

      // Return maxUsers number of existing users
      mockFindMany.mockResolvedValue(Array.from({ length: 100 }, (_, i) => ({ id: `user-${i}` })))

      await expect(autoRegisterFeishuUser(baseParams)).rejects.toThrow('Company user limit reached')
    })

    it('should throw error when default department is not found', async () => {
      mockFindFirst.mockImplementation((table: string) => {
        if (table === 'companies') return Promise.resolve(mockCompany)
        if (table === 'departments') return Promise.resolve(undefined)
        return Promise.resolve(undefined)
      })
      mockFindMany.mockResolvedValue([])

      await expect(autoRegisterFeishuUser(baseParams)).rejects.toThrow(
        'Auto-register configuration error: default department not found'
      )
    })

    it('should throw error when default role is not found', async () => {
      mockFindFirst.mockImplementation((table: string) => {
        if (table === 'companies') return Promise.resolve(mockCompany)
        if (table === 'departments') return Promise.resolve(mockDepartment)
        if (table === 'roles') return Promise.resolve(undefined)
        return Promise.resolve(undefined)
      })
      mockFindMany.mockResolvedValue([])

      await expect(autoRegisterFeishuUser(baseParams)).rejects.toThrow(
        'Auto-register configuration error: default role not found'
      )
    })

    it('should bind feishu id to existing user when email matches', async () => {
      const existingUser = {
        id: 'existing-user-uuid',
        companyId: 'company-uuid-1',
        email: 'test@example.com',
        name: 'Old Name',
        role: mockRole,
        department: mockDepartment
      }

      const updatedUser = {
        ...existingUser,
        feishuUserId: 'feishu-user-123',
        feishuOpenId: 'open-id-456',
        name: 'Test User'
      }

      let userFindCallCount = 0
      mockFindFirst.mockImplementation((table: string) => {
        if (table === 'companies') return Promise.resolve(mockCompany)
        if (table === 'departments') return Promise.resolve(mockDepartment)
        if (table === 'roles') return Promise.resolve(mockRole)
        if (table === 'users') {
          userFindCallCount++
          // First call: find by email (existing user found)
          if (userFindCallCount === 1) return Promise.resolve(existingUser)
          // Second call: re-query after update
          return Promise.resolve(updatedUser)
        }
        return Promise.resolve(undefined)
      })
      mockFindMany.mockResolvedValue([])

      const result = await autoRegisterFeishuUser(baseParams)

      expect(result).toEqual(updatedUser)
      expect(mockUpdate).toHaveBeenCalled()
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          feishuUserId: 'feishu-user-123',
          feishuOpenId: 'open-id-456'
        })
      )
    })

    it('should create a new user when no email conflict', async () => {
      mockFindFirst.mockImplementation((table: string) => {
        if (table === 'companies') return Promise.resolve(mockCompany)
        if (table === 'departments') return Promise.resolve(mockDepartment)
        if (table === 'roles') return Promise.resolve(mockRole)
        if (table === 'users') return Promise.resolve(undefined)
        return Promise.resolve(undefined)
      })
      mockFindMany.mockResolvedValue([])
      mockReturning.mockResolvedValue([{ id: 'new-user-uuid' }])

      // After insert, re-query returns full user
      let userFindCount = 0
      mockFindFirst.mockImplementation((table: string) => {
        if (table === 'companies') return Promise.resolve(mockCompany)
        if (table === 'departments') return Promise.resolve(mockDepartment)
        if (table === 'roles') return Promise.resolve(mockRole)
        if (table === 'users') {
          userFindCount++
          // First call: email lookup (not found)
          if (userFindCount === 1) return Promise.resolve(undefined)
          // Second call: after insert, return created user
          return Promise.resolve(mockCreatedUser)
        }
        return Promise.resolve(undefined)
      })

      const result = await autoRegisterFeishuUser(baseParams)

      expect(result).toEqual(mockCreatedUser)
      expect(mockInsert).toHaveBeenCalled()
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'company-uuid-1',
          feishuUserId: 'feishu-user-123',
          feishuOpenId: 'open-id-456',
          email: 'test@example.com',
          name: 'Test User'
        })
      )
    })

    it('should use placeholder email when feishu does not return email', async () => {
      const paramsWithoutEmail = { ...baseParams, email: undefined }

      mockFindFirst.mockImplementation((table: string) => {
        if (table === 'companies') return Promise.resolve(mockCompany)
        if (table === 'departments') return Promise.resolve(mockDepartment)
        if (table === 'roles') return Promise.resolve(mockRole)
        if (table === 'users') return Promise.resolve(mockCreatedUser)
        return Promise.resolve(undefined)
      })
      mockFindMany.mockResolvedValue([])
      mockReturning.mockResolvedValue([{ id: 'new-user-uuid' }])

      await autoRegisterFeishuUser(paramsWithoutEmail)

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'feishu_feishu-user-123@auto.generated'
        })
      )
    })
  })
})
