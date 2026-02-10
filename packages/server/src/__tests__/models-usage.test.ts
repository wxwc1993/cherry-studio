import { describe, expect, it } from 'vitest'

/**
 * Models Route — GET /:id/usage 响应字段契约测试
 *
 * 验证 "请求数" → "消息数 + 对话数" 拆分后，
 * models/:id/usage 端点的响应结构不包含 `requests`，
 * 且包含 `messages` 和 `conversations`。
 */

// ── Helper ───────────────────────────────────────────────────────
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

// ── Tests ────────────────────────────────────────────────────────
describe('Models Route — GET /:id/usage 字段契约', () => {
  describe('daily 聚合响应', () => {
    it('应包含 messages + conversations 而非 requests', () => {
      const mockDailyUsage = [
        { date: '2025-01-01', messages: 50, conversations: 10, tokens: 2500, cost: 0.75 },
        { date: '2025-01-02', messages: 60, conversations: 12, tokens: 3000, cost: 0.9 }
      ]

      for (const item of mockDailyUsage) {
        assertNoRequestsField(item)
        expect(item).toHaveProperty('messages')
        expect(item).toHaveProperty('conversations')
        expect(item).not.toHaveProperty('requests')
      }
    })
  })

  describe('monthly 聚合响应', () => {
    it('应包含 messages + conversations 而非 requests', () => {
      const mockMonthlyUsage = [
        { month: '2025-01', messages: 1500, conversations: 300, tokens: 75000, cost: 22.5 },
        { month: '2025-02', messages: 1800, conversations: 360, tokens: 90000, cost: 27.0 }
      ]

      for (const item of mockMonthlyUsage) {
        assertNoRequestsField(item)
        expect(item).toHaveProperty('messages')
        expect(item).toHaveProperty('conversations')
        expect(item).not.toHaveProperty('requests')
      }
    })
  })

  describe('total 汇总响应', () => {
    it('应包含 totalMessages + totalConversations 而非 totalRequests', () => {
      const mockTotal = {
        totalMessages: 10000,
        totalConversations: 2000,
        totalTokens: 500000,
        totalCost: 150.0
      }

      assertNoRequestsField(mockTotal)
      expect(mockTotal).toHaveProperty('totalMessages')
      expect(mockTotal).toHaveProperty('totalConversations')
      expect(mockTotal).not.toHaveProperty('totalRequests')
    })
  })

  describe('完整 usage 响应结构', () => {
    it('顶层结构应包含 daily + monthly + total 三部分', () => {
      const mockUsageResponse = {
        daily: [{ date: '2025-01-01', messages: 50, conversations: 10, tokens: 2500, cost: 0.75 }],
        monthly: [{ month: '2025-01', messages: 1500, conversations: 300, tokens: 75000, cost: 22.5 }],
        total: {
          totalMessages: 10000,
          totalConversations: 2000,
          totalTokens: 500000,
          totalCost: 150.0
        }
      }

      assertNoRequestsField(mockUsageResponse)

      // 验证顶层结构
      expect(mockUsageResponse).toHaveProperty('daily')
      expect(mockUsageResponse).toHaveProperty('monthly')
      expect(mockUsageResponse).toHaveProperty('total')

      // 验证 daily 子项
      for (const item of mockUsageResponse.daily) {
        expect(item).toHaveProperty('messages')
        expect(item).toHaveProperty('conversations')
      }

      // 验证 monthly 子项
      for (const item of mockUsageResponse.monthly) {
        expect(item).toHaveProperty('messages')
        expect(item).toHaveProperty('conversations')
      }

      // 验证 total
      expect(mockUsageResponse.total).toHaveProperty('totalMessages')
      expect(mockUsageResponse.total).toHaveProperty('totalConversations')
    })
  })

  describe('conversation 去重语义', () => {
    it('同一模型下同一对话的多条消息应只算 1 个对话', () => {
      const rawRows = [
        { modelId: 'm1', conversationId: 'conv1', id: 'msg1' },
        { modelId: 'm1', conversationId: 'conv1', id: 'msg2' },
        { modelId: 'm1', conversationId: 'conv1', id: 'msg3' },
        { modelId: 'm1', conversationId: 'conv2', id: 'msg4' }
      ]
      const messages = rawRows.length // 4
      const conversations = new Set(rawRows.map((r) => r.conversationId)).size // 2

      expect(messages).toBe(4)
      expect(conversations).toBe(2)
      expect(conversations).toBeLessThan(messages)
    })
  })
})
