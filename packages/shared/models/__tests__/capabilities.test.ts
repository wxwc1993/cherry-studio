import { describe, expect, it } from 'vitest'

import type { SimpleModel } from '../capabilities'
import {
  detectCapabilities,
  detectEmbedding,
  detectFree,
  detectFunctionCalling,
  detectReasoning,
  detectRerank,
  detectVision,
  detectWebSearch,
  isNotSupportedModel
} from '../capabilities'

// ============ 辅助函数 ============

function model(id: string, provider: string = 'openai', name?: string): SimpleModel {
  return { id, name: name ?? id, provider }
}

// ============ detectEmbedding ============

describe('detectEmbedding', () => {
  it('should detect text-embedding models', () => {
    expect(detectEmbedding(model('text-embedding-3-small'))).toBe(true)
    expect(detectEmbedding(model('text-embedding-ada-002'))).toBe(true)
  })

  it('should detect embed-based models', () => {
    expect(detectEmbedding(model('embed-english-v3.0'))).toBe(true)
  })

  it('should detect bge models', () => {
    expect(detectEmbedding(model('bge-large-en-v1.5'))).toBe(true)
  })

  it('should detect e5 models', () => {
    expect(detectEmbedding(model('e5-mistral-7b-instruct'))).toBe(true)
  })

  it('should detect voyage models', () => {
    expect(detectEmbedding(model('voyage-3'))).toBe(true)
  })

  it('should detect jina-embeddings models', () => {
    expect(detectEmbedding(model('jina-embeddings-v2'))).toBe(true)
  })

  it('should detect gte models', () => {
    expect(detectEmbedding(model('gte-large-en-v1.5'))).toBe(true)
  })

  it('should not detect regular chat models', () => {
    expect(detectEmbedding(model('gpt-4o'))).toBe(false)
    expect(detectEmbedding(model('claude-3-sonnet'))).toBe(false)
  })

  it('should not detect reranking models as embedding', () => {
    expect(detectEmbedding(model('rerank-english-v3.0'))).toBe(false)
  })

  it('should not detect embedding for anthropic provider', () => {
    expect(detectEmbedding(model('text-embedding-3-small', 'anthropic'))).toBe(false)
  })

  it('should use model name for doubao provider', () => {
    // "Embedding-3" contains "embed" so EMBEDDING_REGEX matches on name
    expect(detectEmbedding(model('ep-xxx', 'doubao', 'Embedding-3'))).toBe(true)
    expect(detectEmbedding(model('doubao-embedding', 'doubao', 'doubao-embedding'))).toBe(true)
  })

  it('should not detect doubao non-embedding by name', () => {
    expect(detectEmbedding(model('ep-xxx', 'doubao', 'Doubao-pro-32k'))).toBe(false)
  })
})

// ============ detectRerank ============

describe('detectRerank', () => {
  it('should detect rerank models', () => {
    expect(detectRerank(model('rerank-english-v3.0'))).toBe(true)
    // "bge-reranker-v2-m3" contains "re-rank" substring (via "reranker") so RERANKING_REGEX matches
    expect(detectRerank(model('bge-reranker-v2-m3'))).toBe(true)
  })

  it('should detect re-rank and re-ranker models', () => {
    expect(detectRerank(model('model-re-rank'))).toBe(true)
    expect(detectRerank(model('model-re-ranker'))).toBe(true)
    expect(detectRerank(model('model-re-ranking'))).toBe(true)
  })

  it('should detect retrieval models', () => {
    expect(detectRerank(model('retrieval-model'))).toBe(true)
    expect(detectRerank(model('retriever-v1'))).toBe(true)
  })

  it('should not detect regular chat models', () => {
    expect(detectRerank(model('gpt-4o'))).toBe(false)
    expect(detectRerank(model('claude-sonnet-4'))).toBe(false)
  })
})

// ============ detectVision ============

describe('detectVision', () => {
  it('should detect GPT-4o as vision model', () => {
    expect(detectVision(model('gpt-4o'))).toBe(true)
    expect(detectVision(model('gpt-4o-mini'))).toBe(true)
  })

  it('should detect GPT-4.1 as vision model', () => {
    expect(detectVision(model('gpt-4.1'))).toBe(true)
    expect(detectVision(model('gpt-4.1-mini'))).toBe(true)
  })

  it('should detect GPT-5 as vision model', () => {
    expect(detectVision(model('gpt-5'))).toBe(true)
  })

  it('should detect Claude 3 as vision model', () => {
    expect(detectVision(model('claude-3-sonnet'))).toBe(true)
    expect(detectVision(model('claude-3-opus'))).toBe(true)
  })

  it('should detect Claude 4 as vision model', () => {
    expect(detectVision(model('claude-sonnet-4'))).toBe(true)
    expect(detectVision(model('claude-opus-4'))).toBe(true)
    expect(detectVision(model('claude-haiku-4'))).toBe(true)
  })

  it('should detect Gemini as vision model', () => {
    expect(detectVision(model('gemini-2.0-flash'))).toBe(true)
    expect(detectVision(model('gemini-2.5-pro'))).toBe(true)
  })

  it('should detect Qwen-VL as vision model', () => {
    expect(detectVision(model('qwen-vl-plus'))).toBe(true)
    expect(detectVision(model('qwen2.5-vl-72b'))).toBe(true)
  })

  it('should detect o1/o3/o4 as vision model', () => {
    expect(detectVision(model('o1'))).toBe(true)
    // o3-mini and o4-mini are in the vision exclusion list
    expect(detectVision(model('o3'))).toBe(true)
    expect(detectVision(model('o4-mini'))).toBe(true)
  })

  it('should detect image enhancement models as vision', () => {
    expect(detectVision(model('grok-2-image-latest'))).toBe(true)
    expect(detectVision(model('gpt-image-1'))).toBe(true)
  })

  it('should exclude gpt-4-turbo-preview (not vision)', () => {
    expect(detectVision(model('gpt-4-turbo-preview'))).toBe(false)
  })

  it('should exclude o1-mini and o3-mini from vision exclusion list', () => {
    // o1-mini and o3-mini are in the exclusion list
    expect(detectVision(model('o1-mini'))).toBe(false)
    expect(detectVision(model('o3-mini'))).toBe(false)
  })

  it('should not detect embedding models as vision', () => {
    expect(detectVision(model('text-embedding-3-small'))).toBe(false)
  })

  it('should not detect rerank models as vision', () => {
    expect(detectVision(model('rerank-english-v3.0'))).toBe(false)
  })

  it('should not detect regular text-only models', () => {
    expect(detectVision(model('gpt-3.5-turbo'))).toBe(false)
  })
})

// ============ detectReasoning ============

describe('detectReasoning', () => {
  it('should detect OpenAI o-series as reasoning', () => {
    expect(detectReasoning(model('o1'))).toBe(true)
    expect(detectReasoning(model('o1-mini'))).toBe(true)
    expect(detectReasoning(model('o3-mini'))).toBe(true)
    expect(detectReasoning(model('o4-mini'))).toBe(true)
  })

  it('should detect GPT-5 as reasoning', () => {
    expect(detectReasoning(model('gpt-5'))).toBe(true)
    expect(detectReasoning(model('gpt-5-0602'))).toBe(true)
  })

  it('should not detect GPT-5 chat variants as reasoning', () => {
    expect(detectReasoning(model('gpt-5-chat'))).toBe(false)
  })

  it('should detect Claude reasoning models', () => {
    expect(detectReasoning(model('claude-3-7-sonnet', 'anthropic'))).toBe(true)
    expect(detectReasoning(model('claude-3.7-sonnet', 'anthropic'))).toBe(true)
    expect(detectReasoning(model('claude-sonnet-4', 'anthropic'))).toBe(true)
    expect(detectReasoning(model('claude-opus-4', 'anthropic'))).toBe(true)
    expect(detectReasoning(model('claude-haiku-4', 'anthropic'))).toBe(true)
  })

  it('should detect Gemini reasoning models', () => {
    expect(detectReasoning(model('gemini-2.5-flash', 'gemini'))).toBe(true)
    expect(detectReasoning(model('gemini-2.5-pro', 'gemini'))).toBe(true)
    expect(detectReasoning(model('gemini-2.0-flash-thinking-exp', 'gemini'))).toBe(true)
  })

  it('should detect Qwen reasoning models', () => {
    expect(detectReasoning(model('qwen3-30b-a3b', 'dashscope'))).toBe(true)
    expect(detectReasoning(model('qwq-32b-preview', 'dashscope'))).toBe(true)
    expect(detectReasoning(model('qvq-72b-preview', 'dashscope'))).toBe(true)
  })

  it('should not detect Qwen coder as reasoning', () => {
    expect(detectReasoning(model('qwen3-coder', 'dashscope'))).toBe(false)
  })

  it('should detect DeepSeek hybrid models as reasoning', () => {
    expect(detectReasoning(model('deepseek-v3.1'))).toBe(true)
    expect(detectReasoning(model('deepseek-chat'))).toBe(true)
    expect(detectReasoning(model('deepseek-chat-v3.1'))).toBe(true)
  })

  it('should detect Grok reasoning models', () => {
    expect(detectReasoning(model('grok-3-mini', 'grok'))).toBe(true)
    expect(detectReasoning(model('grok-4', 'grok'))).toBe(true)
    expect(detectReasoning(model('grok-4-fast', 'grok'))).toBe(true)
  })

  it('should not detect non-reasoning Grok as reasoning', () => {
    expect(detectReasoning(model('grok-4-non-reasoning', 'grok'))).toBe(false)
  })

  it('should detect Hunyuan reasoning models', () => {
    expect(detectReasoning(model('hunyuan-t1', 'hunyuan'))).toBe(true)
    expect(detectReasoning(model('hunyuan-a13b', 'hunyuan'))).toBe(true)
  })

  it('should detect GLM reasoning models', () => {
    expect(detectReasoning(model('glm-4.5', 'zhipu'))).toBe(true)
    expect(detectReasoning(model('glm-z1-flash', 'zhipu'))).toBe(true)
  })

  it('should detect MiniMax reasoning models', () => {
    expect(detectReasoning(model('minimax-m1', 'minimax'))).toBe(true)
    expect(detectReasoning(model('minimax-m2', 'minimax'))).toBe(true)
    expect(detectReasoning(model('minimax-m2.1', 'minimax'))).toBe(true)
  })

  it('should detect Kimi reasoning models', () => {
    expect(detectReasoning(model('kimi-k2-thinking', 'moonshot'))).toBe(true)
    expect(detectReasoning(model('kimi-k2.5', 'moonshot'))).toBe(true)
  })

  it('should detect models with reasoning/thinking keywords', () => {
    expect(detectReasoning(model('some-model-reasoning'))).toBe(true)
    expect(detectReasoning(model('some-model-thinking'))).toBe(true)
  })

  it('should not detect embedding models as reasoning', () => {
    expect(detectReasoning(model('text-embedding-3-small'))).toBe(false)
  })

  it('should not detect rerank models as reasoning', () => {
    expect(detectReasoning(model('rerank-english-v3.0'))).toBe(false)
  })

  it('should not detect regular chat models as reasoning', () => {
    expect(detectReasoning(model('gpt-4o'))).toBe(false)
    expect(detectReasoning(model('gpt-3.5-turbo'))).toBe(false)
  })
})

// ============ detectFunctionCalling ============

describe('detectFunctionCalling', () => {
  it('should detect GPT-4o as function calling', () => {
    expect(detectFunctionCalling(model('gpt-4o'))).toBe(true)
    expect(detectFunctionCalling(model('gpt-4o-mini'))).toBe(true)
  })

  it('should detect GPT-4.5 and GPT-5 as function calling', () => {
    expect(detectFunctionCalling(model('gpt-4.5-preview'))).toBe(true)
    expect(detectFunctionCalling(model('gpt-5'))).toBe(true)
  })

  it('should detect Claude as function calling', () => {
    expect(detectFunctionCalling(model('claude-3-sonnet', 'anthropic'))).toBe(true)
    expect(detectFunctionCalling(model('claude-sonnet-4', 'anthropic'))).toBe(true)
  })

  it('should detect Gemini as function calling', () => {
    expect(detectFunctionCalling(model('gemini-2.0-flash', 'gemini'))).toBe(true)
    expect(detectFunctionCalling(model('gemini-2.5-pro', 'gemini'))).toBe(true)
  })

  it('should detect Qwen as function calling', () => {
    expect(detectFunctionCalling(model('qwen-max', 'dashscope'))).toBe(true)
    expect(detectFunctionCalling(model('qwen3-30b-a3b', 'dashscope'))).toBe(true)
  })

  it('should detect DeepSeek as function calling', () => {
    expect(detectFunctionCalling(model('deepseek-v3', 'deepseek'))).toBe(true)
  })

  it('should detect GLM as function calling', () => {
    expect(detectFunctionCalling(model('glm-4-flash', 'zhipu'))).toBe(true)
    expect(detectFunctionCalling(model('glm-4.5', 'zhipu'))).toBe(true)
  })

  it('should not detect excluded models', () => {
    expect(detectFunctionCalling(model('o1-mini'))).toBe(false)
    expect(detectFunctionCalling(model('o1-preview'))).toBe(false)
    expect(detectFunctionCalling(model('imagen-v3', 'gemini'))).toBe(false)
  })

  it('should not detect DeepSeek hybrid on unsupported providers (dashscope)', () => {
    // deepseek-chat matches FUNCTION_CALLING_REGEX via "deepseek", but hybrid detection
    // returns false for dashscope. However, the general regex match still hits first.
    // The actual behavior: deepseek-chat on dashscope → isDeepSeekHybridModel → unsupported → false
    expect(detectFunctionCalling(model('deepseek-chat', 'dashscope'))).toBe(false)
  })

  it('should match deepseek on doubao via doubao-specific branch', () => {
    // On doubao provider, code enters the doubao-specific branch first
    // and FUNCTION_CALLING_REGEX matches "deepseek" in "deepseek-chat"
    expect(detectFunctionCalling(model('deepseek-chat', 'doubao'))).toBe(true)
  })

  it('should detect DeepSeek hybrid on supported providers', () => {
    expect(detectFunctionCalling(model('deepseek-chat', 'deepseek'))).toBe(true)
    expect(detectFunctionCalling(model('deepseek-chat', 'openai'))).toBe(true)
  })

  it('should not detect embedding models as function calling', () => {
    expect(detectFunctionCalling(model('text-embedding-3-small'))).toBe(false)
  })

  it('should not detect rerank models as function calling', () => {
    expect(detectFunctionCalling(model('rerank-english-v3.0'))).toBe(false)
  })
})

// ============ detectWebSearch ============

describe('detectWebSearch', () => {
  it('should detect Claude web search models', () => {
    expect(detectWebSearch(model('claude-3.5-sonnet-20240620', 'anthropic'))).toBe(true)
    expect(detectWebSearch(model('claude-3.7-sonnet-latest', 'anthropic'))).toBe(true)
    expect(detectWebSearch(model('claude-sonnet-4-20250514', 'anthropic'))).toBe(true)
    expect(detectWebSearch(model('claude-opus-4-latest', 'anthropic'))).toBe(true)
    expect(detectWebSearch(model('claude-haiku-4-latest', 'anthropic'))).toBe(true)
  })

  it('should not detect Claude on AWS Bedrock', () => {
    expect(detectWebSearch(model('claude-sonnet-4', 'aws-bedrock'))).toBe(false)
  })

  it('should detect OpenAI search models', () => {
    expect(detectWebSearch(model('gpt-4o-search-preview', 'openai'))).toBe(true)
    expect(detectWebSearch(model('gpt-4.1', 'openai'))).toBe(true)
    expect(detectWebSearch(model('o3-mini', 'openai'))).toBe(true)
    expect(detectWebSearch(model('o4-mini', 'openai'))).toBe(true)
  })

  it('should not detect gpt-4.1-nano as web search', () => {
    expect(detectWebSearch(model('gpt-4.1-nano', 'openai'))).toBe(false)
  })

  it('should detect Perplexity search models', () => {
    expect(detectWebSearch(model('sonar', 'perplexity'))).toBe(true)
    expect(detectWebSearch(model('sonar-pro', 'perplexity'))).toBe(true)
    expect(detectWebSearch(model('sonar-deep-research', 'perplexity'))).toBe(true)
  })

  it('should detect Gemini search models', () => {
    expect(detectWebSearch(model('gemini-2.0-flash', 'gemini'))).toBe(true)
    expect(detectWebSearch(model('gemini-2.5-pro-latest', 'gemini'))).toBe(true)
  })

  it('should detect OpenRouter (all models support search)', () => {
    expect(detectWebSearch(model('any-model', 'openrouter'))).toBe(true)
  })

  it('should detect Grok (all models support search)', () => {
    expect(detectWebSearch(model('grok-3', 'grok'))).toBe(true)
  })

  it('should detect Hunyuan (except hunyuan-lite)', () => {
    expect(detectWebSearch(model('hunyuan-pro', 'hunyuan'))).toBe(true)
    expect(detectWebSearch(model('hunyuan-lite', 'hunyuan'))).toBe(false)
  })

  it('should detect Zhipu glm-4- models', () => {
    expect(detectWebSearch(model('glm-4-flash', 'zhipu'))).toBe(true)
    expect(detectWebSearch(model('glm-4.5', 'zhipu'))).toBe(false) // not glm-4-
  })

  it('should detect DashScope supported models', () => {
    expect(detectWebSearch(model('qwen-max', 'dashscope'))).toBe(true)
    expect(detectWebSearch(model('qwen-turbo-latest', 'dashscope'))).toBe(true)
    expect(detectWebSearch(model('qwq-32b', 'dashscope'))).toBe(true)
  })

  it('should return false for unknown providers', () => {
    expect(detectWebSearch(model('some-model', 'unknown-provider'))).toBe(false)
  })

  it('should not detect embedding models as web search', () => {
    expect(detectWebSearch(model('text-embedding-3-small', 'openai'))).toBe(false)
  })
})

// ============ detectFree ============

describe('detectFree', () => {
  it('should detect :free suffix', () => {
    expect(detectFree(model('meta-llama/llama-3.1-8b:free', 'openrouter'))).toBe(true)
  })

  it('should detect (free) suffix', () => {
    expect(detectFree(model('model-name(free)'))).toBe(true)
  })

  it('should detect -free suffix', () => {
    expect(detectFree(model('model-name-free'))).toBe(true)
  })

  it('should detect free in model name', () => {
    expect(detectFree(model('regular-model', 'openai', 'Regular Model:free'))).toBe(true)
  })

  it('should not detect regular models as free', () => {
    expect(detectFree(model('gpt-4o'))).toBe(false)
    expect(detectFree(model('claude-sonnet-4'))).toBe(false)
  })

  it('should not detect free in the middle of id', () => {
    expect(detectFree(model('free-model'))).toBe(false)
    expect(detectFree(model('freedom-v1'))).toBe(false)
  })
})

// ============ detectCapabilities (聚合函数) ============

describe('detectCapabilities', () => {
  it('should return only embedding for embedding models', () => {
    const caps = detectCapabilities(model('text-embedding-3-small'))
    expect(caps).toEqual(['embedding'])
  })

  it('should return only rerank for reranking models', () => {
    const caps = detectCapabilities(model('rerank-english-v3.0'))
    expect(caps).toEqual(['rerank'])
  })

  it('should detect multiple capabilities for GPT-4o', () => {
    const caps = detectCapabilities(model('gpt-4o', 'openai'))
    expect(caps).toContain('vision')
    expect(caps).toContain('function_calling')
    expect(caps).toContain('web_search')
  })

  it('should detect reasoning for o3-mini', () => {
    const caps = detectCapabilities(model('o3-mini', 'openai'))
    expect(caps).toContain('reasoning')
    expect(caps).toContain('function_calling')
    expect(caps).toContain('web_search')
  })

  it('should detect vision + reasoning + function_calling for Claude Sonnet 4', () => {
    const caps = detectCapabilities(model('claude-sonnet-4-latest', 'anthropic'))
    expect(caps).toContain('vision')
    expect(caps).toContain('reasoning')
    expect(caps).toContain('function_calling')
    expect(caps).toContain('web_search')
  })

  it('should detect free for free models', () => {
    const caps = detectCapabilities(model('llama-3.1-8b:free', 'openrouter'))
    expect(caps).toContain('free')
  })

  it('should return empty array for basic chat models', () => {
    const caps = detectCapabilities(model('gpt-3.5-turbo'))
    expect(caps).toEqual([])
  })

  it('should detect Gemini 2.5 pro capabilities', () => {
    const caps = detectCapabilities(model('gemini-2.5-pro', 'gemini'))
    expect(caps).toContain('vision')
    expect(caps).toContain('reasoning')
    expect(caps).toContain('function_calling')
    expect(caps).toContain('web_search')
  })
})

// ============ isNotSupportedModel ============

describe('isNotSupportedModel', () => {
  it('should filter tts models', () => {
    expect(isNotSupportedModel('tts-1')).toBe(true)
    expect(isNotSupportedModel('tts-1-hd')).toBe(true)
  })

  it('should filter whisper models', () => {
    expect(isNotSupportedModel('whisper-1')).toBe(true)
  })

  it('should filter speech models', () => {
    expect(isNotSupportedModel('speech-to-text')).toBe(true)
  })

  it('should not filter regular chat models', () => {
    expect(isNotSupportedModel('gpt-4o')).toBe(false)
    expect(isNotSupportedModel('claude-sonnet-4')).toBe(false)
    expect(isNotSupportedModel('gemini-2.5-pro')).toBe(false)
  })

  it('should handle namespaced model ids', () => {
    expect(isNotSupportedModel('openai/tts-1')).toBe(true)
    expect(isNotSupportedModel('openai/whisper-1')).toBe(true)
  })
})
