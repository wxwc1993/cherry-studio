import { describe, expect, it } from 'vitest'

import { buildChatCompletionsUrl, buildModelsListUrl } from '../endpoints'

describe('buildModelsListUrl', () => {
  it('should return empty string for empty endpoint', () => {
    expect(buildModelsListUrl('')).toBe('')
  })

  it('should insert /v1 when endpoint has no version path', () => {
    expect(buildModelsListUrl('https://api.openai.com')).toBe('https://api.openai.com/v1/models')
  })

  it('should not insert /v1 when endpoint already contains /v1', () => {
    expect(buildModelsListUrl('https://api.cerebras.ai/v1')).toBe('https://api.cerebras.ai/v1/models')
  })

  it('should handle /v2, /v3, /v4 version paths', () => {
    expect(buildModelsListUrl('https://qianfan.baidubce.com/v2')).toBe('https://qianfan.baidubce.com/v2/models')
    expect(buildModelsListUrl('https://ark.cn-beijing.volces.com/api/v3')).toBe(
      'https://ark.cn-beijing.volces.com/api/v3/models'
    )
    expect(buildModelsListUrl('https://open.bigmodel.cn/api/paas/v4')).toBe(
      'https://open.bigmodel.cn/api/paas/v4/models'
    )
  })

  it('should strip trailing slashes', () => {
    expect(buildModelsListUrl('https://api.perplexity.ai/')).toBe('https://api.perplexity.ai/v1/models')
    expect(buildModelsListUrl('https://router.huggingface.co/v1/')).toBe('https://router.huggingface.co/v1/models')
  })

  it('should handle version path followed by sub-paths', () => {
    expect(buildModelsListUrl('https://api.ppinfra.com/v3/openai/')).toBe('https://api.ppinfra.com/v3/openai/models')
  })

  it('should handle localhost endpoints', () => {
    expect(buildModelsListUrl('http://localhost:11434')).toBe('http://localhost:11434/v1/models')
    expect(buildModelsListUrl('http://localhost:8000/v3/')).toBe('http://localhost:8000/v3/models')
  })
})

describe('buildChatCompletionsUrl', () => {
  it('should return empty string for empty endpoint', () => {
    expect(buildChatCompletionsUrl('')).toBe('')
  })

  it('should insert /v1 when endpoint has no version path', () => {
    expect(buildChatCompletionsUrl('https://api.openai.com')).toBe('https://api.openai.com/v1/chat/completions')
  })

  it('should not insert /v1 when endpoint already contains /v1', () => {
    expect(buildChatCompletionsUrl('https://api.cerebras.ai/v1')).toBe('https://api.cerebras.ai/v1/chat/completions')
  })

  it('should handle /v2, /v3, /v4 version paths', () => {
    expect(buildChatCompletionsUrl('https://qianfan.baidubce.com/v2')).toBe(
      'https://qianfan.baidubce.com/v2/chat/completions'
    )
    expect(buildChatCompletionsUrl('https://ark.cn-beijing.volces.com/api/v3')).toBe(
      'https://ark.cn-beijing.volces.com/api/v3/chat/completions'
    )
    expect(buildChatCompletionsUrl('https://open.bigmodel.cn/api/paas/v4')).toBe(
      'https://open.bigmodel.cn/api/paas/v4/chat/completions'
    )
  })

  it('should strip trailing slashes', () => {
    expect(buildChatCompletionsUrl('https://api.perplexity.ai/')).toBe('https://api.perplexity.ai/v1/chat/completions')
    expect(buildChatCompletionsUrl('https://router.huggingface.co/v1/')).toBe(
      'https://router.huggingface.co/v1/chat/completions'
    )
  })

  it('should handle version path followed by sub-paths', () => {
    expect(buildChatCompletionsUrl('https://api.ppinfra.com/v3/openai/')).toBe(
      'https://api.ppinfra.com/v3/openai/chat/completions'
    )
  })

  it('should handle localhost endpoints', () => {
    expect(buildChatCompletionsUrl('http://localhost:11434')).toBe('http://localhost:11434/v1/chat/completions')
    expect(buildChatCompletionsUrl('http://localhost:8000/v3/')).toBe('http://localhost:8000/v3/chat/completions')
  })
})
