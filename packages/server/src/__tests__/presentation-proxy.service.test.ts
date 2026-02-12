import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * PresentationProxyService 单元测试
 *
 * 验证 Flask Worker HTTP 代理的核心逻辑：
 * - 错误类（FlaskWorkerError, FlaskWorkerUnavailableError）
 * - 健康检查
 * - flaskRequest 重试逻辑（网络错误重试、4xx 不重试）
 * - resolveModelCredentials
 * - 各生成/导出方法的调用链
 */

// ── Mock 层 ──────────────────────────────────────────────

const mockFindFirst = vi.fn()

vi.mock('../models/db', () => ({
  db: {
    query: {
      models: { findFirst: mockFindFirst }
    }
  }
}))

vi.mock('../models', () => ({
  db: {
    query: {
      models: { findFirst: mockFindFirst }
    }
  },
  models: { id: 'id', companyId: 'companyId' }
}))

vi.mock('../config', () => ({
  config: {
    flaskWorker: {
      baseUrl: 'http://flask-worker:5000',
      timeoutMs: 120000,
      healthCheckPath: '/health',
      maxRetries: 2,
      retryDelayMs: 10 // 测试中缩短重试延迟
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

const mockDecrypt = vi.fn()

vi.mock('./crypto.service', () => ({
  cryptoService: {
    decrypt: mockDecrypt
  }
}))

// ── 导入被测模块 ──

const { presentationProxyService, FlaskWorkerError, FlaskWorkerUnavailableError } = await import(
  '../services/presentation-proxy.service'
)

// ── 常量 ──

const COMPANY_ID = 'company-001'
const PRESENTATION_ID = 'pres-001'
const MODEL_ID = '550e8400-e29b-41d4-a716-446655440000'

// ── 辅助函数 ──

function mockFetchResponse(
  body: unknown,
  options?: {
    ok?: boolean
    status?: number
    headers?: Record<string, string>
  }
) {
  const ok = options?.ok ?? true
  const status = options?.status ?? 200
  const headers = new Map(Object.entries(options?.headers ?? { 'content-type': 'application/json' }))

  return vi.fn().mockResolvedValue({
    ok,
    status,
    headers: {
      get: (name: string) => headers.get(name) ?? null
    },
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
    arrayBuffer: vi.fn().mockResolvedValue(body instanceof ArrayBuffer ? body : new ArrayBuffer(0))
  })
}

// ── Tests ──

describe('PresentationProxyService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mockFetchResponse({ success: true, data: {} }))
  })

  // ============ 错误类 ============

  describe('FlaskWorkerError', () => {
    it('应正确设置属性', () => {
      const err = new FlaskWorkerError('Test error', 502, 'flask detail')

      expect(err).toBeInstanceOf(Error)
      expect(err.name).toBe('FlaskWorkerError')
      expect(err.message).toBe('Test error')
      expect(err.statusCode).toBe(502)
      expect(err.flaskError).toBe('flask detail')
    })

    it('statusCode 默认值应为 502', () => {
      const err = new FlaskWorkerError('Error')

      expect(err.statusCode).toBe(502)
    })
  })

  describe('FlaskWorkerUnavailableError', () => {
    it('应继承 FlaskWorkerError', () => {
      const err = new FlaskWorkerUnavailableError()

      expect(err).toBeInstanceOf(FlaskWorkerError)
      expect(err.name).toBe('FlaskWorkerUnavailableError')
      expect(err.statusCode).toBe(503)
    })

    it('应使用默认消息', () => {
      const err = new FlaskWorkerUnavailableError()

      expect(err.message).toBe('AI Worker service is currently unavailable')
    })

    it('应接受自定义消息', () => {
      const err = new FlaskWorkerUnavailableError('Custom message')

      expect(err.message).toBe('Custom message')
    })
  })

  // ============ resolveModelCredentials ============

  describe('resolveModelCredentials', () => {
    it('应成功解析模型凭证', async () => {
      const mockModel = {
        id: MODEL_ID,
        companyId: COMPANY_ID,
        isEnabled: true,
        apiKey: 'encrypted-key',
        apiEndpoint: 'https://api.openai.com',
        providerId: 'openai',
        name: 'gpt-4',
        displayName: 'GPT-4',
        config: { temperature: 0.7 }
      }
      mockFindFirst.mockResolvedValue(mockModel)
      mockDecrypt.mockReturnValue('decrypted-api-key')

      const result = await presentationProxyService.resolveModelCredentials(MODEL_ID, COMPANY_ID)

      expect(result).toEqual({
        apiKey: 'decrypted-api-key',
        apiEndpoint: 'https://api.openai.com',
        providerId: 'openai',
        modelName: 'gpt-4',
        config: { temperature: 0.7 }
      })
      expect(mockDecrypt).toHaveBeenCalledWith('encrypted-key')
    })

    it('模型不存在时应抛出 FlaskWorkerError (404)', async () => {
      mockFindFirst.mockResolvedValue(undefined)

      await expect(presentationProxyService.resolveModelCredentials(MODEL_ID, COMPANY_ID)).rejects.toThrow(
        FlaskWorkerError
      )

      try {
        await presentationProxyService.resolveModelCredentials(MODEL_ID, COMPANY_ID)
      } catch (err) {
        expect((err as FlaskWorkerError).statusCode).toBe(404)
      }
    })

    it('模型被禁用时应抛出 FlaskWorkerError (400)', async () => {
      mockFindFirst.mockResolvedValue({
        id: MODEL_ID,
        isEnabled: false,
        displayName: 'GPT-4'
      })

      await expect(presentationProxyService.resolveModelCredentials(MODEL_ID, COMPANY_ID)).rejects.toThrow(
        FlaskWorkerError
      )
    })
  })

  // ============ 健康检查 ============

  describe('checkHealth', () => {
    it('Flask Worker 健康时应返回 healthy=true', async () => {
      vi.stubGlobal('fetch', mockFetchResponse({ success: true, data: { status: 'ok' } }))

      const result = await presentationProxyService.checkHealth()

      expect(result.healthy).toBe(true)
      expect(result.latencyMs).toBeGreaterThanOrEqual(0)
      expect(result.error).toBeUndefined()
    })

    it('Flask Worker 不健康时应返回 healthy=false', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')))

      const result = await presentationProxyService.checkHealth()

      expect(result.healthy).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  // ============ flaskRequest 重试逻辑 ============

  describe('重试逻辑（通过 generateOutline 间接测试）', () => {
    const context = {
      companyId: COMPANY_ID,
      presentationId: PRESENTATION_ID,
      config: {}
    }
    const input = { idea: '测试主意' }

    it('成功请求不重试', async () => {
      const fetchMock = mockFetchResponse({
        success: true,
        data: { pages: [{ title: '页面1' }] }
      })
      vi.stubGlobal('fetch', fetchMock)

      await presentationProxyService.generateOutline(context, input)

      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('5xx 错误应重试', async () => {
      const fetchMock = vi
        .fn()
        // 前两次返回 500
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          headers: { get: () => null },
          text: vi.fn().mockResolvedValue('Internal Server Error')
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          headers: { get: () => null },
          text: vi.fn().mockResolvedValue('Internal Server Error')
        })
        // 第三次成功
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: vi.fn().mockResolvedValue({
            success: true,
            data: { pages: [{ title: '页面1' }] }
          })
        })
      vi.stubGlobal('fetch', fetchMock)

      const result = await presentationProxyService.generateOutline(context, input)

      // maxRetries=2, 所以总共 3 次请求
      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(result.pages).toHaveLength(1)
    })

    it('4xx 错误不应重试', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: { get: () => null },
        text: vi.fn().mockResolvedValue('Bad Request')
      })
      vi.stubGlobal('fetch', fetchMock)

      await expect(presentationProxyService.generateOutline(context, input)).rejects.toThrow(FlaskWorkerError)

      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('所有重试失败后应抛出 FlaskWorkerUnavailableError', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'))
      vi.stubGlobal('fetch', fetchMock)

      await expect(presentationProxyService.generateOutline(context, input)).rejects.toThrow(
        FlaskWorkerUnavailableError
      )

      // 1 初始 + 2 重试 = 3
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('Flask 返回 success=false 应抛出 FlaskWorkerError', async () => {
      vi.stubGlobal(
        'fetch',
        mockFetchResponse({
          success: false,
          error: 'Generation failed'
        })
      )

      await expect(presentationProxyService.generateOutline(context, input)).rejects.toThrow('Generation failed')
    })
  })

  // ============ 生成方法调用链 ============

  describe('generateOutline', () => {
    it('应调用正确的 Flask 端点', async () => {
      const fetchMock = mockFetchResponse({
        success: true,
        data: { pages: [{ title: '大纲页面' }] }
      })
      vi.stubGlobal('fetch', fetchMock)

      const result = await presentationProxyService.generateOutline(
        { companyId: COMPANY_ID, presentationId: PRESENTATION_ID, config: {} },
        { idea: '关于 AI' }
      )

      expect(result.pages).toHaveLength(1)
      expect(fetchMock).toHaveBeenCalledWith(
        'http://flask-worker:5000/api/v1/generate/outline',
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('有 textModelId 时应解析凭证', async () => {
      mockFindFirst.mockResolvedValue({
        id: MODEL_ID,
        companyId: COMPANY_ID,
        isEnabled: true,
        apiKey: 'enc',
        apiEndpoint: null,
        providerId: 'openai',
        name: 'gpt-4',
        config: {}
      })
      mockDecrypt.mockReturnValue('dec-key')

      const fetchMock = mockFetchResponse({
        success: true,
        data: { pages: [] }
      })
      vi.stubGlobal('fetch', fetchMock)

      await presentationProxyService.generateOutline(
        { companyId: COMPANY_ID, presentationId: PRESENTATION_ID, config: { textModelId: MODEL_ID } },
        { idea: 'AI 主题' }
      )

      expect(mockDecrypt).toHaveBeenCalledWith('enc')
    })
  })

  describe('refineOutline', () => {
    it('应调用正确的 Flask 端点', async () => {
      const fetchMock = mockFetchResponse({
        success: true,
        data: { pages: [] }
      })
      vi.stubGlobal('fetch', fetchMock)

      await presentationProxyService.refineOutline(
        { companyId: COMPANY_ID, presentationId: PRESENTATION_ID, config: {} },
        { instruction: '添加更多细节', pages: [{ title: '页面1' }] },
        [{ title: '页面1' }]
      )

      expect(fetchMock).toHaveBeenCalledWith(
        'http://flask-worker:5000/api/v1/generate/refine-outline',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  describe('generateDescriptions', () => {
    it('应调用正确的 Flask 端点', async () => {
      const fetchMock = mockFetchResponse({
        success: true,
        data: { pages: [] }
      })
      vi.stubGlobal('fetch', fetchMock)

      await presentationProxyService.generateDescriptions(
        { companyId: COMPANY_ID, presentationId: PRESENTATION_ID, config: {} },
        [{ pageId: 'p1', outlineContent: { title: '页面' } }]
      )

      expect(fetchMock).toHaveBeenCalledWith(
        'http://flask-worker:5000/api/v1/generate/descriptions',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  describe('refineDescriptions', () => {
    it('应调用正确的 Flask 端点', async () => {
      const fetchMock = mockFetchResponse({
        success: true,
        data: { pages: [] }
      })
      vi.stubGlobal('fetch', fetchMock)

      await presentationProxyService.refineDescriptions(
        { companyId: COMPANY_ID, presentationId: PRESENTATION_ID, config: {} },
        { instruction: '优化描述' },
        [{ pageId: 'p1', outlineContent: { title: '页面' }, descriptionContent: { text: '描述' } }]
      )

      expect(fetchMock).toHaveBeenCalledWith(
        'http://flask-worker:5000/api/v1/generate/refine-descriptions',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  describe('generateImages', () => {
    it('应调用正确的 Flask 端点', async () => {
      const fetchMock = mockFetchResponse({
        success: true,
        data: { images: [] }
      })
      vi.stubGlobal('fetch', fetchMock)

      await presentationProxyService.generateImages(
        { companyId: COMPANY_ID, presentationId: PRESENTATION_ID, config: {} },
        [{ pageId: 'p1', descriptionContent: { text: '描述' } }]
      )

      expect(fetchMock).toHaveBeenCalledWith(
        'http://flask-worker:5000/api/v1/generate/images',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  describe('generateSingleImage（二进制响应）', () => {
    it('应返回 Buffer 和 mimeType', async () => {
      const imageBuffer = new ArrayBuffer(8)
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => {
            if (name === 'content-type') return 'image/png'
            if (name === 'content-disposition') return 'attachment; filename="slide.png"'
            return null
          }
        },
        arrayBuffer: vi.fn().mockResolvedValue(imageBuffer)
      })
      vi.stubGlobal('fetch', fetchMock)

      const result = await presentationProxyService.generateSingleImage(
        { companyId: COMPANY_ID, presentationId: PRESENTATION_ID, config: {} },
        'page-1',
        { text: '描述' }
      )

      expect(result.pageId).toBe('page-1')
      expect(result.imageBuffer).toBeInstanceOf(Buffer)
      expect(result.mimeType).toBe('image/png')
    })
  })

  describe('exportPptx', () => {
    it('应返回导出文件信息', async () => {
      const fileBuffer = new ArrayBuffer(16)
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => {
            if (name === 'content-type') return 'application/octet-stream'
            if (name === 'content-disposition') return 'attachment; filename="export.pptx"'
            return null
          }
        },
        arrayBuffer: vi.fn().mockResolvedValue(fileBuffer)
      })
      vi.stubGlobal('fetch', fetchMock)

      const result = await presentationProxyService.exportPptx(
        { companyId: COMPANY_ID, presentationId: PRESENTATION_ID, config: {} },
        [{ orderIndex: 0, outlineContent: { title: '页面' } }],
        { format: 'pptx' }
      )

      expect(result.fileName).toBe('export.pptx')
      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(result.mimeType).toBe('application/vnd.openxmlformats-officedocument.presentationml.presentation')
    })
  })

  describe('exportPdf', () => {
    it('应返回导出文件信息', async () => {
      const fileBuffer = new ArrayBuffer(16)
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => {
            if (name === 'content-type') return 'application/pdf'
            if (name === 'content-disposition') return null
            return null
          }
        },
        arrayBuffer: vi.fn().mockResolvedValue(fileBuffer)
      })
      vi.stubGlobal('fetch', fetchMock)

      const result = await presentationProxyService.exportPdf(
        { companyId: COMPANY_ID, presentationId: PRESENTATION_ID, config: {} },
        [],
        { format: 'pdf' }
      )

      expect(result.mimeType).toBe('application/pdf')
      // 无 content-disposition 时应使用默认文件名
      expect(result.fileName).toContain('presentation-')
    })
  })

  describe('parseReferenceFile', () => {
    it('应成功解析参考文件', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: vi.fn().mockResolvedValue({
          success: true,
          data: { markdownContent: '# Title\n\nContent' }
        })
      })
      vi.stubGlobal('fetch', fetchMock)

      const result = await presentationProxyService.parseReferenceFile(
        COMPANY_ID,
        Buffer.from('file content'),
        'doc.pdf'
      )

      expect(result.markdownContent).toBe('# Title\n\nContent')
    })

    it('Flask 返回错误时应抛出 FlaskWorkerError', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: { get: () => null },
        text: vi.fn().mockResolvedValue('Parse error')
      })
      vi.stubGlobal('fetch', fetchMock)

      await expect(presentationProxyService.parseReferenceFile(COMPANY_ID, Buffer.from(''), 'bad.pdf')).rejects.toThrow(
        FlaskWorkerError
      )
    })

    it('网络错误时应抛出 FlaskWorkerUnavailableError', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))

      await expect(presentationProxyService.parseReferenceFile(COMPANY_ID, Buffer.from(''), 'doc.pdf')).rejects.toThrow(
        FlaskWorkerUnavailableError
      )
    })
  })
})
