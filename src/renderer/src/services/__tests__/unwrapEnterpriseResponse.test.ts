import { unwrapEnterpriseResponse } from '@renderer/services/unwrapEnterpriseResponse'
import { describe, expect, it } from 'vitest'

/**
 * 构造带指定 Content-Type 和 body 的 Response
 */
function createResponse(body: string, contentType: string, status = 200, statusText = 'OK'): Response {
  return new Response(body, {
    status,
    statusText,
    headers: { 'Content-Type': contentType }
  })
}

describe('unwrapEnterpriseResponse', () => {
  // ── 信封解包（success: true） ─────────────────────────

  it('should unwrap success:true envelope and extract data', async () => {
    const innerData = { id: 'chatcmpl-123', choices: [{ message: { content: 'hi' } }] }
    const envelope = JSON.stringify({ success: true, data: innerData })
    const response = createResponse(envelope, 'application/json')

    const result = await unwrapEnterpriseResponse(response)
    const resultJson = await result.json()

    expect(resultJson).toEqual(innerData)
  })

  it('should preserve original HTTP status code and statusText', async () => {
    const envelope = JSON.stringify({ success: true, data: { id: '1' } })
    const response = createResponse(envelope, 'application/json', 201, 'Created')

    const result = await unwrapEnterpriseResponse(response)

    expect(result.status).toBe(201)
    expect(result.statusText).toBe('Created')
  })

  it('should preserve original headers in unwrapped response', async () => {
    const envelope = JSON.stringify({ success: true, data: { id: '1' } })
    const response = new Response(envelope, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': 'abc-123'
      }
    })

    const result = await unwrapEnterpriseResponse(response)

    expect(result.headers.get('X-Request-Id')).toBe('abc-123')
  })

  it('should handle data: null in envelope', async () => {
    const envelope = JSON.stringify({ success: true, data: null })
    const response = createResponse(envelope, 'application/json')

    const result = await unwrapEnterpriseResponse(response)
    const text = await result.text()

    expect(text).toBe('null')
  })

  // ── 信封错误（success: false） ────────────────────────

  it('should throw error with code and message for success:false', async () => {
    const envelope = JSON.stringify({
      success: false,
      error: { code: 'MODEL_NOT_FOUND', message: 'Model does not exist' }
    })
    const response = createResponse(envelope, 'application/json')

    await expect(unwrapEnterpriseResponse(response)).rejects.toThrow('[MODEL_NOT_FOUND] Model does not exist')
  })

  it('should use default error info when error field is missing', async () => {
    const envelope = JSON.stringify({ success: false })
    const response = createResponse(envelope, 'application/json')

    await expect(unwrapEnterpriseResponse(response)).rejects.toThrow(
      '[ENTERPRISE_ERROR] Enterprise server returned an error'
    )
  })

  it('should use default code when error.code is missing', async () => {
    const envelope = JSON.stringify({
      success: false,
      error: { message: 'Something went wrong' }
    })
    const response = createResponse(envelope, 'application/json')

    await expect(unwrapEnterpriseResponse(response)).rejects.toThrow('[ENTERPRISE_ERROR] Something went wrong')
  })

  it('should use default message when error.message is missing', async () => {
    const envelope = JSON.stringify({
      success: false,
      error: { code: 'RATE_LIMITED' }
    })
    const response = createResponse(envelope, 'application/json')

    await expect(unwrapEnterpriseResponse(response)).rejects.toThrow(
      '[RATE_LIMITED] Enterprise server returned an error'
    )
  })

  // ── 透传：流式响应 ──────────────────────────────────

  it('should pass through streaming responses (text/event-stream)', async () => {
    const body = 'data: {"choices":[]}\n\n'
    const response = createResponse(body, 'text/event-stream')

    const result = await unwrapEnterpriseResponse(response)

    expect(result).toBe(response)
  })

  // ── 透传：非 JSON 响应 ──────────────────────────────

  it('should pass through non-JSON Content-Type', async () => {
    const body = 'plain text content'
    const response = createResponse(body, 'text/plain')

    const result = await unwrapEnterpriseResponse(response)

    expect(result).toBe(response)
  })

  // ── 透传：已是 OpenAI 格式 ─────────────────────────

  it('should pass through JSON that is already OpenAI format (no envelope)', async () => {
    const openaiResponse = { id: 'chatcmpl-123', choices: [{ message: { content: 'hi' } }] }
    const body = JSON.stringify(openaiResponse)
    const response = createResponse(body, 'application/json')

    const result = await unwrapEnterpriseResponse(response)
    const resultJson = await result.json()

    expect(resultJson).toEqual(openaiResponse)
  })

  // ── 边界情况 ────────────────────────────────────────

  it('should handle empty body', async () => {
    const response = createResponse('', 'application/json')

    const result = await unwrapEnterpriseResponse(response)
    const text = await result.text()

    expect(text).toBe('')
  })

  it('should handle invalid JSON body', async () => {
    const response = createResponse('not valid json{', 'application/json')

    const result = await unwrapEnterpriseResponse(response)
    const text = await result.text()

    expect(text).toBe('not valid json{')
  })

  it('should handle Content-Type with charset parameter', async () => {
    const innerData = { id: 'chatcmpl-456', choices: [] }
    const envelope = JSON.stringify({ success: true, data: innerData })
    const response = createResponse(envelope, 'application/json; charset=utf-8')

    const result = await unwrapEnterpriseResponse(response)
    const resultJson = await result.json()

    expect(resultJson).toEqual(innerData)
  })

  it('should not modify the original response object (immutability)', async () => {
    const envelope = JSON.stringify({ success: true, data: { id: '1' } })
    const original = createResponse(envelope, 'application/json')
    const originalStatus = original.status
    const originalStatusText = original.statusText

    const result = await unwrapEnterpriseResponse(original)

    expect(result).not.toBe(original)
    expect(original.status).toBe(originalStatus)
    expect(original.statusText).toBe(originalStatusText)
  })

  it('should handle success:true with data as empty object', async () => {
    const envelope = JSON.stringify({ success: true, data: {} })
    const response = createResponse(envelope, 'application/json')

    const result = await unwrapEnterpriseResponse(response)
    const resultJson = await result.json()

    expect(resultJson).toEqual({})
  })

  it('should return empty string body when data is undefined', async () => {
    const envelope = JSON.stringify({ success: true })
    const response = createResponse(envelope, 'application/json')

    const result = await unwrapEnterpriseResponse(response)
    const text = await result.text()

    expect(text).toBe('')
  })
})
