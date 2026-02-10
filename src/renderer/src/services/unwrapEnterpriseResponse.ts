/**
 * 企业服务器响应信封解包
 *
 * 企业服务器对非流式响应使用 `createSuccessResponse(data)` 包裹为
 * `{success: true, data: {...}}` 信封格式，但 AI SDK 在顶层查找
 * `choices` 等字段进行 Zod 验证，信封导致验证失败。
 *
 * 本模块提供纯函数 `unwrapEnterpriseResponse`，在 fetch 返回后、
 * AI SDK 解析前，将信封解包还原为标准 OpenAI 格式。
 */

/**
 * 企业服务器信封格式
 */
interface EnterpriseEnvelope {
  success: boolean
  data?: unknown
  error?: {
    code?: string
    message?: string
  }
}

/**
 * 检测 JSON 对象是否为企业信封格式
 *
 * 判断条件：顶层对象包含 `success` 布尔字段
 */
function isEnterpriseEnvelope(json: unknown): json is EnterpriseEnvelope {
  return (
    typeof json === 'object' &&
    json !== null &&
    'success' in json &&
    typeof (json as EnterpriseEnvelope).success === 'boolean'
  )
}

/**
 * 解包企业服务器的信封响应
 *
 * - 流式响应（`Content-Type: text/event-stream`）→ 原样返回
 * - 非 JSON 响应 → 原样返回
 * - 非信封 JSON（已是 OpenAI 格式，无 `success` 字段）→ 原样返回
 * - `success: true` → 提取 `data` 字段，构造新 Response
 * - `success: false` → 抛出 Error（包含 `code` + `message`）
 *
 * @param response - 原始 fetch Response
 * @returns 解包后的新 Response（不修改原始对象）
 */
export async function unwrapEnterpriseResponse(response: Response): Promise<Response> {
  const contentType = response.headers.get('Content-Type') ?? ''

  // 流式响应：不解包
  if (contentType.includes('text/event-stream')) {
    return response
  }

  // 非 JSON 响应：不解包
  if (!contentType.includes('application/json')) {
    return response
  }

  // 读取 body 文本
  const text = await response.text()

  if (!text) {
    return new Response(text, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    })
  }

  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    // 无效 JSON：返回携带原始文本的新 Response
    return new Response(text, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    })
  }

  // 非信封格式：返回携带原始文本的新 Response
  if (!isEnterpriseEnvelope(json)) {
    return new Response(text, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    })
  }

  // 信封格式 — 业务错误
  if (!json.success) {
    const code = json.error?.code ?? 'ENTERPRISE_ERROR'
    const message = json.error?.message ?? 'Enterprise server returned an error'
    throw new Error(`[${code}] ${message}`)
  }

  // 信封格式 — 成功：提取 data，构造新 Response
  const unwrappedBody = json.data !== undefined ? JSON.stringify(json.data) : ''

  return new Response(unwrappedBody, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  })
}
