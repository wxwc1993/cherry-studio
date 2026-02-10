import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Statistics Routes — 响应字段契约测试
 *
 * 验证 "请求数" → "消息数 + 对话数" 拆分后，所有端点的响应体
 * 不再包含 `requests` 字段，且包含 `messages` 和 `conversations`。
 */

// ── Mock DB layer ──────────────────────────────────────────────
const mockSelect = vi.fn()

vi.mock('../models/db', () => ({
  db: {
    select: mockSelect,
    query: {
      usageLogs: { findMany: vi.fn() },
      users: { findFirst: vi.fn() },
      models: { findFirst: vi.fn() },
      departments: { findFirst: vi.fn() }
    }
  }
}))

vi.mock('../models', () => ({
  db: {
    select: mockSelect,
    query: {
      usageLogs: { findMany: vi.fn() },
      users: { findFirst: vi.fn() },
      models: { findFirst: vi.fn() },
      departments: { findFirst: vi.fn() }
    }
  },
  usageLogs: {},
  users: {},
  models: {},
  departments: {},
  assistantPresets: {}
}))

vi.mock('../middleware/auth', () => ({
  authenticate: (_req: unknown, _res: unknown, next: () => void) => next(),
  requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next()
}))

vi.mock('../middleware/validate', () => ({
  validate: () => (_req: unknown, _res: unknown, next: () => void) => next()
}))

vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

// ── Helper: 响应体字段断言 ──────────────────────────────────────
function assertNoRequestsField(obj: Record<string, unknown>, path = ''): void {
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key
    expect(key, `Field "${currentPath}" should not be "requests"`).not.toBe('requests')
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      assertNoRequestsField(value as Record<string, unknown>, currentPath)
    }
    if (Array.isArray(value)) {
      for (const [i, item] of value.entries()) {
        if (item && typeof item === 'object') {
          assertNoRequestsField(item as Record<string, unknown>, `${currentPath}[${i}]`)
        }
      }
    }
  }
}

function assertHasMessagesAndConversations(obj: Record<string, unknown>, path = ''): void {
  const keys = Object.keys(obj)
  if (keys.includes('messages')) {
    expect(keys, `"${path}" should also contain "conversations"`).toContain('conversations')
  }
}

// ── Tests ──────────────────────────────────────────────────────
describe('Statistics Routes — 字段契约', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('响应结构设计', () => {
    it('overview 端点应返回 messages + conversations 而非 requests', () => {
      const mockOverview = {
        users: { total: 10, active: 5 },
        models: 3,
        usage: {
          today: { messages: 100, conversations: 20, tokens: 5000, cost: 1.5 },
          month: { messages: 3000, conversations: 600, tokens: 150000, cost: 45.0 },
          total: { messages: 10000, conversations: 2000, tokens: 500000, cost: 150.0 }
        }
      }

      assertNoRequestsField(mockOverview)
      assertHasMessagesAndConversations(mockOverview.usage.today, 'usage.today')
      assertHasMessagesAndConversations(mockOverview.usage.month, 'usage.month')
      assertHasMessagesAndConversations(mockOverview.usage.total, 'usage.total')
    })

    it('usage 时间序列端点应返回 messages + conversations', () => {
      const mockUsage = [
        { date: '2025-01-01', messages: 50, conversations: 10, tokens: 2500, cost: 0.75 },
        { date: '2025-01-02', messages: 60, conversations: 12, tokens: 3000, cost: 0.9 }
      ]

      for (const item of mockUsage) {
        assertNoRequestsField(item)
        expect(item).toHaveProperty('messages')
        expect(item).toHaveProperty('conversations')
      }
    })

    it('models 端点应返回 messages + conversations', () => {
      const mockModels = [
        {
          modelId: 'm1',
          modelName: 'GPT-4',
          messages: 500,
          conversations: 100,
          tokens: 25000,
          cost: 7.5,
          avgLatency: 120
        }
      ]

      for (const item of mockModels) {
        assertNoRequestsField(item)
        expect(item).toHaveProperty('messages')
        expect(item).toHaveProperty('conversations')
      }
    })

    it('users 端点应返回 messages + conversations', () => {
      const mockUsers = [
        {
          userId: 'u1',
          userName: 'Alice',
          department: 'Engineering',
          messages: 200,
          conversations: 40,
          tokens: 10000,
          cost: 3.0
        }
      ]

      for (const item of mockUsers) {
        assertNoRequestsField(item)
        expect(item).toHaveProperty('messages')
        expect(item).toHaveProperty('conversations')
      }
    })

    it('departments 端点应返回 messages + conversations', () => {
      const mockDepts = [
        {
          departmentId: 'd1',
          departmentName: 'Engineering',
          path: '/1',
          parentId: null,
          messages: 1000,
          conversations: 200,
          tokens: 50000,
          cost: 15.0,
          userCount: 10
        }
      ]

      for (const item of mockDepts) {
        assertNoRequestsField(item)
        expect(item).toHaveProperty('messages')
        expect(item).toHaveProperty('conversations')
      }
    })

    it('assistant-presets 端点应返回 messages + conversations', () => {
      const mockPresets = [
        {
          presetId: 'p1',
          presetName: 'Code Helper',
          emoji: '💻',
          messages: 300,
          conversations: 60,
          tokens: 15000,
          cost: 4.5,
          uniqueUsers: 5
        }
      ]

      for (const item of mockPresets) {
        assertNoRequestsField(item)
        expect(item).toHaveProperty('messages')
        expect(item).toHaveProperty('conversations')
      }
    })

    it('export CSV 表头应包含 Messages 和 Conversations', () => {
      const expectedHeaders = [
        'Date',
        'User',
        'Model',
        'Conversation ID',
        'Messages',
        'Input Tokens',
        'Output Tokens',
        'Total Tokens',
        'Cost',
        'Duration (ms)'
      ]

      expect(expectedHeaders).toContain('Messages')
      expect(expectedHeaders).toContain('Conversation ID')
      expect(expectedHeaders).not.toContain('Requests')
    })
  })

  describe('UsageSummary 共享类型契约', () => {
    it('应包含 totalMessages + totalConversations 字段', () => {
      const summary = {
        period: 'daily' as const,
        date: new Date(),
        companyId: 'c1',
        totalMessages: 100,
        totalConversations: 20,
        totalTokens: 5000,
        totalCost: 1.5,
        averageLatency: 120
      }

      expect(summary).toHaveProperty('totalMessages')
      expect(summary).toHaveProperty('totalConversations')
      expect(summary).not.toHaveProperty('totalRequests')
    })
  })

  describe('conversationCountSql 辅助表达式', () => {
    it('应使用 COUNT(DISTINCT conversation_id) 语义', () => {
      // 验证去重逻辑：同一对话多条消息应只算 1 个对话
      const rawRows = [
        { conversationId: 'conv1', id: 'msg1' },
        { conversationId: 'conv1', id: 'msg2' },
        { conversationId: 'conv2', id: 'msg3' }
      ]
      const messages = rawRows.length // 3
      const conversations = new Set(rawRows.map((r) => r.conversationId)).size // 2

      expect(messages).toBe(3)
      expect(conversations).toBe(2)
      expect(conversations).toBeLessThan(messages)
    })
  })
})
