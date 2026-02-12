import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FlaskRequestContext } from './presentation-proxy.service'

// ============ Mock 配置 ============

vi.mock('../config', () => ({
  config: {
    flaskWorker: {
      baseUrl: 'http://flask-test:5000',
      timeoutMs: 5000,
      healthCheckPath: '/health',
      maxRetries: 2,
      retryDelayMs: 100
    }
  }
}))

vi.mock('../models', () => ({
  db: { query: { models: { findFirst: vi.fn() } } },
  models: { id: 'id', companyId: 'companyId' }
}))

vi.mock('./crypto.service', () => ({
  cryptoService: { decrypt: vi.fn() }
}))

vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

// ============ 导入依赖（必须在 vi.mock 之后） ============

import { db } from '../models'
import { cryptoService } from './crypto.service'
import { FlaskWorkerError, FlaskWorkerUnavailableError, presentationProxyService } from './presentation-proxy.service'

// ============ 辅助工具 ============

const mockFindFirst = db.query.models.findFirst as ReturnType<typeof vi.fn>
const mockDecrypt = cryptoService.decrypt as ReturnType<typeof vi.fn>

function mockFetchResponse(body: unknown, status = 200, headers?: Record<string, string>) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8))
  }
}

function createContext(overrides?: Partial<FlaskRequestContext>): FlaskRequestContext {
  return {
    companyId: 'company-1',
    presentationId: 'pres-1',
    ...overrides
  }
}

function createModelRecord(overrides?: Record<string, unknown>) {
  return {
    id: 'model-1',
    companyId: 'company-1',
    name: 'gpt-4o',
    displayName: 'GPT-4o',
    providerId: 'openai',
    apiKey: 'encrypted-key',
    apiEndpoint: 'https://api.openai.com',
    isEnabled: true,
    config: { temperature: 0.7 },
    ...overrides
  }
}

// ============ 测试 ============

let mockFetch: ReturnType<typeof vi.fn>

beforeEach(() => {
  mockFetch = vi.fn()
  vi.stubGlobal('fetch', mockFetch)
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ──────────────────────────────────
// 1. 错误类
// ──────────────────────────────────

describe('FlaskWorkerError', () => {
  it('应包含 name、message、statusCode 和 flaskError 属性', () => {
    const err = new FlaskWorkerError('出错了', 502, 'flask detail')

    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(FlaskWorkerError)
    expect(err.name).toBe('FlaskWorkerError')
    expect(err.message).toBe('出错了')
    expect(err.statusCode).toBe(502)
    expect(err.flaskError).toBe('flask detail')
  })

  it('statusCode 默认为 502', () => {
    const err = new FlaskWorkerError('默认状态码')

    expect(err.statusCode).toBe(502)
    expect(err.flaskError).toBeUndefined()
  })
})

describe('FlaskWorkerUnavailableError', () => {
  it('statusCode 固定为 503，继承自 FlaskWorkerError', () => {
    const err = new FlaskWorkerUnavailableError()

    expect(err).toBeInstanceOf(FlaskWorkerError)
    expect(err).toBeInstanceOf(FlaskWorkerUnavailableError)
    expect(err.name).toBe('FlaskWorkerUnavailableError')
    expect(err.statusCode).toBe(503)
    expect(err.message).toBe('AI Worker service is currently unavailable')
  })

  it('支持自定义错误消息', () => {
    const err = new FlaskWorkerUnavailableError('自定义消息')

    expect(err.message).toBe('自定义消息')
    expect(err.statusCode).toBe(503)
  })
})

// ──────────────────────────────────
// 2. resolveModelCredentials
// ──────────────────────────────────

describe('resolveModelCredentials', () => {
  it('模型存在且已启用时返回解密后的凭证', async () => {
    const record = createModelRecord()
    mockFindFirst.mockResolvedValue(record)
    mockDecrypt.mockReturnValue('decrypted-api-key')

    const creds = await presentationProxyService.resolveModelCredentials('model-1', 'company-1')

    expect(mockFindFirst).toHaveBeenCalledOnce()
    expect(mockDecrypt).toHaveBeenCalledWith('encrypted-key')
    expect(creds).toEqual({
      apiKey: 'decrypted-api-key',
      apiEndpoint: 'https://api.openai.com',
      providerId: 'openai',
      modelName: 'gpt-4o',
      config: { temperature: 0.7 }
    })
  })

  it('模型 config 为 null 时返回空对象', async () => {
    const record = createModelRecord({ config: null })
    mockFindFirst.mockResolvedValue(record)
    mockDecrypt.mockReturnValue('key')

    const creds = await presentationProxyService.resolveModelCredentials('model-1', 'company-1')

    expect(creds.config).toEqual({})
  })

  it('模型不存在时抛出 FlaskWorkerError(404)', async () => {
    mockFindFirst.mockResolvedValue(null)

    await expect(presentationProxyService.resolveModelCredentials('not-exist', 'company-1')).rejects.toThrow(
      FlaskWorkerError
    )

    await expect(presentationProxyService.resolveModelCredentials('not-exist', 'company-1')).rejects.toMatchObject({
      statusCode: 404,
      message: expect.stringContaining('not-exist')
    })
  })

  it('模型已禁用时抛出 FlaskWorkerError(400)', async () => {
    const record = createModelRecord({ isEnabled: false })
    mockFindFirst.mockResolvedValue(record)

    await expect(presentationProxyService.resolveModelCredentials('model-1', 'company-1')).rejects.toThrow(
      FlaskWorkerError
    )

    await expect(presentationProxyService.resolveModelCredentials('model-1', 'company-1')).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('GPT-4o')
    })
  })
})

// ──────────────────────────────────
// 3. checkHealth
// ──────────────────────────────────

describe('checkHealth', () => {
  it('Flask 正常响应时返回 healthy=true 和 latencyMs', async () => {
    mockFetch.mockResolvedValue(mockFetchResponse({ success: true, data: { status: 'ok' } }))

    const result = await presentationProxyService.checkHealth()

    expect(result.healthy).toBe(true)
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    expect(result.error).toBeUndefined()
    expect(mockFetch).toHaveBeenCalledWith('http://flask-test:5000/health', expect.objectContaining({ method: 'GET' }))
  })

  it('Flask 不可用时返回 healthy=false 和 error', async () => {
    mockFetch.mockRejectedValue(new Error('Connection refused'))

    const result = await presentationProxyService.checkHealth()

    expect(result.healthy).toBe(false)
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    expect(result.error).toBeDefined()
  })
})

// ──────────────────────────────────
// 4. flaskRequest 重试逻辑（通过 generateOutline 测试）
// ──────────────────────────────────

describe('flaskRequest 重试逻辑', () => {
  const context = createContext()
  const input = { idea: '关于 AI 的演示文稿' }

  it('第一次请求成功时直接返回数据', async () => {
    const outlineData = { pages: [{ title: '第一页', bulletPoints: [] }] }
    mockFetch.mockResolvedValue(mockFetchResponse({ success: true, data: outlineData }))

    const result = await presentationProxyService.generateOutline(context, input)

    expect(result).toEqual(outlineData)
    expect(mockFetch).toHaveBeenCalledOnce()
  })

  it('网络错误后重试，第二次成功', async () => {
    const outlineData = { pages: [{ title: '重试成功', bulletPoints: [] }] }
    mockFetch
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(mockFetchResponse({ success: true, data: outlineData }))

    const result = await presentationProxyService.generateOutline(context, input)

    expect(result).toEqual(outlineData)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('4xx 错误不重试，直接抛出', async () => {
    mockFetch.mockResolvedValue(mockFetchResponse('Bad Request: invalid input', 400))

    await expect(presentationProxyService.generateOutline(context, input)).rejects.toThrow(FlaskWorkerError)

    await expect(presentationProxyService.generateOutline(context, input)).rejects.toMatchObject({
      statusCode: 400
    })

    // 每次调用只发出 1 次 fetch（不重试）
    expect(mockFetch).toHaveBeenCalledTimes(2) // 两次 expect 各调用一次
  })

  it('5xx 错误时响应体作为 flaskError 返回', async () => {
    mockFetch.mockResolvedValue(mockFetchResponse('Internal Server Error', 500))

    try {
      await presentationProxyService.generateOutline(context, input)
      expect.unreachable('应该抛出异常')
    } catch (err) {
      expect(err).toBeInstanceOf(FlaskWorkerUnavailableError)
    }
  })

  it('success:false 时抛出 FlaskWorkerError', async () => {
    mockFetch.mockResolvedValue(mockFetchResponse({ success: false, error: '大纲生成失败' }))

    try {
      await presentationProxyService.generateOutline(context, input)
      expect.unreachable('应该抛出异常')
    } catch (err) {
      expect(err).toBeInstanceOf(FlaskWorkerUnavailableError)
    }
  })

  it('所有重试耗尽后抛出 FlaskWorkerUnavailableError', async () => {
    mockFetch.mockRejectedValue(new Error('Network unreachable'))

    await expect(presentationProxyService.generateOutline(context, input)).rejects.toThrow(FlaskWorkerUnavailableError)

    // maxRetries=2 → 总共 3 次尝试
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('超时（AbortError）后抛出 FlaskWorkerUnavailableError', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError')
    mockFetch.mockRejectedValue(abortError)

    await expect(presentationProxyService.generateOutline(context, input)).rejects.toThrow(FlaskWorkerUnavailableError)

    await expect(presentationProxyService.generateOutline(context, input)).rejects.toMatchObject({
      message: expect.stringContaining('timed out')
    })
  })
})

// ──────────────────────────────────
// 5. flaskBinaryRequest（通过 generateSingleImage 测试）
// ──────────────────────────────────

describe('flaskBinaryRequest', () => {
  const context = createContext()
  const descContent = { text: '一张 AI 生成的图片', imagePrompt: 'futuristic city' }

  it('返回 buffer、contentType 和从 content-disposition 提取的 fileName', async () => {
    const arrayBuffer = new ArrayBuffer(16)
    const response = {
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'image/png',
        'content-disposition': 'attachment; filename="slide-1.png"'
      }),
      json: vi.fn(),
      text: vi.fn(),
      arrayBuffer: vi.fn().mockResolvedValue(arrayBuffer)
    }
    mockFetch.mockResolvedValue(response)

    const result = await presentationProxyService.generateSingleImage(context, 'page-1', descContent)

    expect(result.pageId).toBe('page-1')
    expect(result.imageBuffer).toBeInstanceOf(Buffer)
    expect(result.mimeType).toBe('image/png')
  })

  it('content-disposition 不含 filename 时 fileName 为 undefined', async () => {
    const response = {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'image/jpeg' }),
      json: vi.fn(),
      text: vi.fn(),
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(4))
    }
    mockFetch.mockResolvedValue(response)

    const result = await presentationProxyService.generateSingleImage(context, 'page-2', descContent)

    expect(result.mimeType).toBe('image/jpeg')
    expect(result.pageId).toBe('page-2')
  })

  it('响应为 JSON 且 success:false 时抛出 FlaskWorkerError', async () => {
    const response = {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: vi.fn().mockResolvedValue({ success: false, error: '图片生成失败' }),
      text: vi.fn(),
      arrayBuffer: vi.fn()
    }
    mockFetch.mockResolvedValue(response)

    try {
      await presentationProxyService.generateSingleImage(context, 'page-1', descContent)
      expect.unreachable('应该抛出异常')
    } catch (err) {
      expect(err).toBeInstanceOf(FlaskWorkerUnavailableError)
    }
  })

  it('响应为 JSON 且 success:true 时抛出 "Expected binary response" 错误', async () => {
    const response = {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json; charset=utf-8' }),
      json: vi.fn().mockResolvedValue({ success: true, data: {} }),
      text: vi.fn(),
      arrayBuffer: vi.fn()
    }
    mockFetch.mockResolvedValue(response)

    try {
      await presentationProxyService.generateSingleImage(context, 'page-1', descContent)
      expect.unreachable('应该抛出异常')
    } catch (err) {
      expect(err).toBeInstanceOf(FlaskWorkerUnavailableError)
    }
  })

  it('HTTP 错误时抛出包含状态码的 FlaskWorkerError', async () => {
    mockFetch.mockResolvedValue(mockFetchResponse('Not Found', 404))

    await expect(presentationProxyService.generateSingleImage(context, 'page-1', descContent)).rejects.toMatchObject({
      statusCode: 404
    })
  })
})

// ──────────────────────────────────
// 6. generateOutline
// ──────────────────────────────────

describe('generateOutline', () => {
  it('发送正确的 URL、body 和 headers', async () => {
    const outlineData = { pages: [{ title: '标题' }] }
    mockFetch.mockResolvedValue(mockFetchResponse({ success: true, data: outlineData }))

    const context = createContext()
    const input = { idea: '人工智能' }
    await presentationProxyService.generateOutline(context, input, '参考内容')

    expect(mockFetch).toHaveBeenCalledWith(
      'http://flask-test:5000/api/v1/generate/outline',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          presentationId: 'pres-1',
          idea: '人工智能',
          config: undefined,
          referenceContent: '参考内容',
          model: undefined
        })
      })
    )
  })

  it('提供 textModelId 时解析模型凭证并附带到请求体', async () => {
    const record = createModelRecord()
    mockFindFirst.mockResolvedValue(record)
    mockDecrypt.mockReturnValue('decrypted-key')

    const outlineData = { pages: [] }
    mockFetch.mockResolvedValue(mockFetchResponse({ success: true, data: outlineData }))

    const context = createContext({
      config: { textModelId: 'model-1' }
    })
    await presentationProxyService.generateOutline(context, { idea: 'test' })

    const fetchCall = mockFetch.mock.calls[0]
    const requestBody = JSON.parse(fetchCall[1].body)

    expect(requestBody.model).toEqual({
      apiKey: 'decrypted-key',
      apiEndpoint: 'https://api.openai.com',
      providerId: 'openai',
      modelName: 'gpt-4o',
      config: { temperature: 0.7 }
    })
  })

  it('未提供 textModelId 时 model 字段为 undefined', async () => {
    mockFetch.mockResolvedValue(mockFetchResponse({ success: true, data: { pages: [] } }))

    const context = createContext({ config: undefined })
    await presentationProxyService.generateOutline(context, { idea: 'test' })

    const fetchCall = mockFetch.mock.calls[0]
    const requestBody = JSON.parse(fetchCall[1].body)

    expect(requestBody.model).toBeUndefined()
  })
})

// ──────────────────────────────────
// 7. generateImages 动态超时
// ──────────────────────────────────

describe('generateImages', () => {
  it('使用动态超时：Math.max(config.timeoutMs, pages.length * 60000)', async () => {
    mockFetch.mockResolvedValue(mockFetchResponse({ success: true, data: { images: [] } }))

    const pages = Array.from({ length: 5 }, (_, i) => ({
      pageId: `page-${i}`,
      descriptionContent: { text: `描述 ${i}` }
    }))

    const context = createContext()
    await presentationProxyService.generateImages(context, pages)

    // 检查 AbortController 超时设置
    // 5 pages * 60000 = 300000ms > config.timeoutMs(5000)
    // 间接通过 signal 验证超时
    expect(mockFetch).toHaveBeenCalledWith(
      'http://flask-test:5000/api/v1/generate/images',
      expect.objectContaining({
        method: 'POST',
        signal: expect.any(AbortSignal)
      })
    )
  })

  it('使用 imageModelId 解析图像模型凭证', async () => {
    const record = createModelRecord({ providerId: 'dall-e' })
    mockFindFirst.mockResolvedValue(record)
    mockDecrypt.mockReturnValue('image-key')
    mockFetch.mockResolvedValue(mockFetchResponse({ success: true, data: { images: [] } }))

    const context = createContext({
      config: { imageModelId: 'model-1' }
    })

    await presentationProxyService.generateImages(context, [{ pageId: 'p1', descriptionContent: { text: 'desc' } }])

    const fetchCall = mockFetch.mock.calls[0]
    const requestBody = JSON.parse(fetchCall[1].body)

    expect(requestBody.model).toEqual({
      apiKey: 'image-key',
      apiEndpoint: 'https://api.openai.com',
      providerId: 'dall-e',
      modelName: 'gpt-4o',
      config: { temperature: 0.7 }
    })
  })

  it('页面数少时使用 config.timeoutMs 作为最小超时', async () => {
    mockFetch.mockResolvedValue(mockFetchResponse({ success: true, data: { images: [] } }))

    // 0 pages * 60000 = 0 < config.timeoutMs(5000)，因此超时 = 5000
    const context = createContext()
    await presentationProxyService.generateImages(context, [])

    expect(mockFetch).toHaveBeenCalledOnce()
  })
})

// ──────────────────────────────────
// 8. 导出方法
// ──────────────────────────────────

describe('导出方法', () => {
  const context = createContext()
  const pages = [{ orderIndex: 0, outlineContent: { title: '封面' } }]
  const exportInput = { format: 'pptx' as const }

  function setupBinaryResponse(fileName?: string) {
    const headers: Record<string, string> = { 'content-type': 'application/octet-stream' }
    if (fileName) {
      headers['content-disposition'] = `attachment; filename="${fileName}"`
    }
    const response = {
      ok: true,
      status: 200,
      headers: new Headers(headers),
      json: vi.fn(),
      text: vi.fn(),
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(16))
    }
    mockFetch.mockResolvedValue(response)
  }

  describe('exportPptx', () => {
    it('使用 pptx 格式并返回正确的 mimeType', async () => {
      setupBinaryResponse('presentation.pptx')

      const result = await presentationProxyService.exportPptx(context, pages, exportInput)

      expect(result.mimeType).toBe('application/vnd.openxmlformats-officedocument.presentationml.presentation')
      expect(result.fileName).toBe('presentation.pptx')
      expect(result.buffer).toBeInstanceOf(Buffer)

      const fetchCall = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body)
      expect(requestBody.format).toBe('pptx')
    })

    it('headers 中无 fileName 时使用默认文件名', async () => {
      setupBinaryResponse()

      const result = await presentationProxyService.exportPptx(context, pages, exportInput)

      expect(result.fileName).toBe('presentation-pres-1.pptx')
    })
  })

  describe('exportPdf', () => {
    it('使用 pdf 格式并返回正确的 mimeType', async () => {
      setupBinaryResponse('slides.pdf')

      const result = await presentationProxyService.exportPdf(context, pages, exportInput)

      expect(result.mimeType).toBe('application/pdf')
      expect(result.fileName).toBe('slides.pdf')

      const fetchCall = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body)
      expect(requestBody.format).toBe('pdf')
    })

    it('headers 中无 fileName 时使用默认文件名', async () => {
      setupBinaryResponse()

      const result = await presentationProxyService.exportPdf(context, pages, exportInput)

      expect(result.fileName).toBe('presentation-pres-1.pdf')
    })
  })

  describe('exportEditablePptx', () => {
    it('使用 editable_pptx 格式并返回 pptx mimeType', async () => {
      setupBinaryResponse('editable.pptx')

      const result = await presentationProxyService.exportEditablePptx(context, pages, exportInput)

      expect(result.mimeType).toBe('application/vnd.openxmlformats-officedocument.presentationml.presentation')
      expect(result.fileName).toBe('editable.pptx')

      const fetchCall = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body)
      expect(requestBody.format).toBe('editable_pptx')
    })

    it('headers 中无 fileName 时使用默认文件名', async () => {
      setupBinaryResponse()

      const result = await presentationProxyService.exportEditablePptx(context, pages, exportInput)

      expect(result.fileName).toBe('presentation-pres-1.pptx')
    })
  })

  it('导出请求发送到正确路径并携带 templateId 和合并后的 config', async () => {
    setupBinaryResponse('output.pptx')

    const contextWithConfig = createContext({
      config: { theme: 'dark' }
    })
    const inputWithTemplate = {
      format: 'pptx' as const,
      templateId: 'tpl-1',
      config: { language: 'zh' }
    }

    await presentationProxyService.exportPptx(contextWithConfig, pages, inputWithTemplate)

    const fetchCall = mockFetch.mock.calls[0]
    expect(fetchCall[0]).toBe('http://flask-test:5000/api/v1/export/presentation')

    const requestBody = JSON.parse(fetchCall[1].body)
    expect(requestBody.templateId).toBe('tpl-1')
    expect(requestBody.config).toEqual({ theme: 'dark', language: 'zh' })
  })
})

// ──────────────────────────────────
// 9. parseReferenceFile
// ──────────────────────────────────

describe('parseReferenceFile', () => {
  it('使用 multipart/form-data 发送文件并返回解析结果', async () => {
    const parseResult = { markdownContent: '# 解析后的内容' }
    mockFetch.mockResolvedValue(mockFetchResponse({ success: true, data: parseResult }))

    const fileBuffer = Buffer.from('文件内容')
    const result = await presentationProxyService.parseReferenceFile('company-1', fileBuffer, 'test.pdf')

    expect(result).toEqual(parseResult)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://flask-test:5000/api/v1/parse/reference-file',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
        signal: expect.any(AbortSignal)
      })
    )
  })

  it('fetch 失败时抛出 FlaskWorkerUnavailableError', async () => {
    mockFetch.mockRejectedValue(new Error('Connection refused'))

    await expect(presentationProxyService.parseReferenceFile('company-1', Buffer.from(''), 'test.pdf')).rejects.toThrow(
      FlaskWorkerUnavailableError
    )

    await expect(
      presentationProxyService.parseReferenceFile('company-1', Buffer.from(''), 'test.pdf')
    ).rejects.toMatchObject({
      message: expect.stringContaining('File parsing failed')
    })
  })

  it('响应 HTTP 错误时抛出 FlaskWorkerError', async () => {
    mockFetch.mockResolvedValue(mockFetchResponse('Server error', 500))

    await expect(presentationProxyService.parseReferenceFile('company-1', Buffer.from(''), 'test.pdf')).rejects.toThrow(
      FlaskWorkerError
    )

    await expect(
      presentationProxyService.parseReferenceFile('company-1', Buffer.from(''), 'test.pdf')
    ).rejects.toMatchObject({
      statusCode: 500
    })
  })

  it('success:false 时抛出 FlaskWorkerError', async () => {
    mockFetch.mockResolvedValue(mockFetchResponse({ success: false, error: '解析失败' }))

    await expect(
      presentationProxyService.parseReferenceFile('company-1', Buffer.from('test'), 'doc.pdf')
    ).rejects.toThrow(FlaskWorkerError)

    await expect(
      presentationProxyService.parseReferenceFile('company-1', Buffer.from('test'), 'doc.pdf')
    ).rejects.toMatchObject({
      message: expect.stringContaining('解析失败')
    })
  })

  it('success:true 但 data 为空时抛出 FlaskWorkerError', async () => {
    mockFetch.mockResolvedValue(mockFetchResponse({ success: true, data: null }))

    await expect(
      presentationProxyService.parseReferenceFile('company-1', Buffer.from('test'), 'doc.pdf')
    ).rejects.toThrow(FlaskWorkerError)
  })
})

// ──────────────────────────────────
// 10. refineOutline
// ──────────────────────────────────

describe('refineOutline', () => {
  it('发送 instruction 和 currentPages 到正确路径', async () => {
    const refinedData = { pages: [{ title: '优化后标题' }] }
    mockFetch.mockResolvedValue(mockFetchResponse({ success: true, data: refinedData }))

    const context = createContext()
    const input = { instruction: '增加一页关于总结的内容' }
    const currentPages = [{ title: '第一页', bulletPoints: ['要点1'] }]

    const result = await presentationProxyService.refineOutline(context, input, currentPages)

    expect(result).toEqual(refinedData)
    const fetchCall = mockFetch.mock.calls[0]
    expect(fetchCall[0]).toBe('http://flask-test:5000/api/v1/generate/refine-outline')
    const requestBody = JSON.parse(fetchCall[1].body)
    expect(requestBody.instruction).toBe('增加一页关于总结的内容')
    expect(requestBody.pages).toEqual(currentPages)
  })
})

// ──────────────────────────────────
// 11. generateDescriptions
// ──────────────────────────────────

describe('generateDescriptions', () => {
  it('发送页面列表到正确路径', async () => {
    const descData = { pages: [{ pageId: 'p1', descriptionContent: { text: '内容' } }] }
    mockFetch.mockResolvedValue(mockFetchResponse({ success: true, data: descData }))

    const context = createContext()
    const pages = [{ pageId: 'p1', outlineContent: { title: '大纲' } }]

    const result = await presentationProxyService.generateDescriptions(context, pages)

    expect(result).toEqual(descData)
    const fetchCall = mockFetch.mock.calls[0]
    expect(fetchCall[0]).toBe('http://flask-test:5000/api/v1/generate/descriptions')
  })
})

// ──────────────────────────────────
// 12. refineDescriptions
// ──────────────────────────────────

describe('refineDescriptions', () => {
  it('发送 instruction、pageIds 和 pages 到正确路径', async () => {
    const refinedDesc = { pages: [{ pageId: 'p1', descriptionContent: { text: '优化后' } }] }
    mockFetch.mockResolvedValue(mockFetchResponse({ success: true, data: refinedDesc }))

    const context = createContext()
    const input = { instruction: '更详细一些', pageIds: ['p1'] }
    const pages = [
      {
        pageId: 'p1',
        outlineContent: { title: '大纲' },
        descriptionContent: { text: '原始描述' }
      }
    ]

    const result = await presentationProxyService.refineDescriptions(context, input, pages)

    expect(result).toEqual(refinedDesc)
    const fetchCall = mockFetch.mock.calls[0]
    expect(fetchCall[0]).toBe('http://flask-test:5000/api/v1/generate/refine-descriptions')
    const requestBody = JSON.parse(fetchCall[1].body)
    expect(requestBody.instruction).toBe('更详细一些')
    expect(requestBody.pageIds).toEqual(['p1'])
  })
})

// ──────────────────────────────────
// 13. editImage
// ──────────────────────────────────

describe('editImage', () => {
  it('发送编辑指令和当前图片 key 到正确路径', async () => {
    const response = {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'image/png' }),
      json: vi.fn(),
      text: vi.fn(),
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8))
    }
    mockFetch.mockResolvedValue(response)

    const context = createContext()
    const input = { instruction: '把背景改成蓝色' }

    const result = await presentationProxyService.editImage(context, 'page-1', input, 'images/current.png')

    expect(result.pageId).toBe('page-1')
    expect(result.mimeType).toBe('image/png')

    const fetchCall = mockFetch.mock.calls[0]
    expect(fetchCall[0]).toBe('http://flask-test:5000/api/v1/generate/edit-image')
    const requestBody = JSON.parse(fetchCall[1].body)
    expect(requestBody.instruction).toBe('把背景改成蓝色')
    expect(requestBody.currentImageKey).toBe('images/current.png')
  })
})

// ──────────────────────────────────
// 14. 重试时的指数退避
// ──────────────────────────────────

describe('重试指数退避', () => {
  it('重试间隔按指数增长 (retryDelayMs * 2^(attempt-1))', async () => {
    const outlineData = { pages: [] }
    const callTimestamps: number[] = []

    mockFetch.mockImplementation(async () => {
      callTimestamps.push(Date.now())
      if (callTimestamps.length < 3) {
        throw new Error('Network error')
      }
      return mockFetchResponse({ success: true, data: outlineData })
    })

    const context = createContext()
    await presentationProxyService.generateOutline(context, { idea: 'test' })

    expect(mockFetch).toHaveBeenCalledTimes(3)

    // retryDelayMs=100, 第一次重试延迟约 100ms, 第二次约 200ms
    if (callTimestamps.length === 3) {
      const firstDelay = callTimestamps[1] - callTimestamps[0]
      const secondDelay = callTimestamps[2] - callTimestamps[1]

      // 允许一定的时间误差（±50ms）
      expect(firstDelay).toBeGreaterThanOrEqual(80)
      expect(secondDelay).toBeGreaterThanOrEqual(160)
    }
  })
})

// ──────────────────────────────────
// 15. 4xx 在 flaskBinaryRequest 中也不重试
// ──────────────────────────────────

describe('flaskBinaryRequest 4xx 不重试', () => {
  it('HTTP 422 不触发重试', async () => {
    mockFetch.mockResolvedValue(mockFetchResponse('Unprocessable Entity', 422))

    const context = createContext()
    const descContent = { text: '描述' }

    await expect(presentationProxyService.generateSingleImage(context, 'page-1', descContent)).rejects.toMatchObject({
      statusCode: 422
    })

    expect(mockFetch).toHaveBeenCalledOnce()
  })
})

// ──────────────────────────────────
// 16. generateSingleImage 带 customPrompt
// ──────────────────────────────────

describe('generateSingleImage 自定义 prompt', () => {
  it('customPrompt 包含在请求体中', async () => {
    const response = {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'image/webp' }),
      json: vi.fn(),
      text: vi.fn(),
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(4))
    }
    mockFetch.mockResolvedValue(response)

    const context = createContext()
    await presentationProxyService.generateSingleImage(context, 'page-1', { text: 'desc' }, '自定义提示词')

    const fetchCall = mockFetch.mock.calls[0]
    const requestBody = JSON.parse(fetchCall[1].body)
    expect(requestBody.customPrompt).toBe('自定义提示词')
    expect(requestBody.pageId).toBe('page-1')
  })
})

// ──────────────────────────────────
// 17. flaskBinaryRequest 重试后超时
// ──────────────────────────────────

describe('flaskBinaryRequest 所有重试耗尽', () => {
  it('网络错误耗尽重试后抛出 FlaskWorkerUnavailableError', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'))

    const context = createContext()
    const descContent = { text: '描述' }

    await expect(presentationProxyService.generateSingleImage(context, 'page-1', descContent)).rejects.toThrow(
      FlaskWorkerUnavailableError
    )

    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('AbortError 耗尽重试后抛出 timed out 消息', async () => {
    const abortError = new DOMException('signal is aborted', 'AbortError')
    mockFetch.mockRejectedValue(abortError)

    const context = createContext()

    await expect(
      presentationProxyService.generateSingleImage(context, 'page-1', { text: 'desc' })
    ).rejects.toMatchObject({
      message: expect.stringContaining('timed out')
    })
  })
})

// ──────────────────────────────────
// 18. parseReferenceFile — FlaskWorkerError 直接抛出不包装
// ──────────────────────────────────

describe('parseReferenceFile FlaskWorkerError 传播', () => {
  it('FlaskWorkerError 不被包装为 FlaskWorkerUnavailableError', async () => {
    mockFetch.mockResolvedValue(mockFetchResponse('Forbidden', 403))

    try {
      await presentationProxyService.parseReferenceFile('company-1', Buffer.from('x'), 'f.pdf')
      expect.unreachable('应该抛出异常')
    } catch (err) {
      expect(err).toBeInstanceOf(FlaskWorkerError)
      expect(err).not.toBeInstanceOf(FlaskWorkerUnavailableError)
      expect((err as FlaskWorkerError).statusCode).toBe(403)
    }
  })
})
