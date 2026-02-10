import { transformOpenAIBodyToEnterprise } from '@renderer/services/createEnterpriseFetch'
import { describe, expect, it } from 'vitest'

describe('transformOpenAIBodyToEnterprise', () => {
  const TEST_MODEL_ID = 'test-model-uuid'

  it('should remove model field and inject modelId', () => {
    const input = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'hello' }],
      stream: true
    }

    const result = transformOpenAIBodyToEnterprise(input, TEST_MODEL_ID)

    expect(result.model).toBeUndefined()
    expect(result.modelId).toBe(TEST_MODEL_ID)
  })

  it('should preserve messages and stream fields', () => {
    const messages = [
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'hello' }
    ]
    const input = { model: 'gpt-4o', messages, stream: false }

    const result = transformOpenAIBodyToEnterprise(input, TEST_MODEL_ID)

    expect(result.messages).toBe(messages)
    expect(result.stream).toBe(false)
  })

  it('should transform snake_case config fields to camelCase nested config', () => {
    const input = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'test' }],
      stream: true,
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 2048,
      frequency_penalty: 0.5,
      presence_penalty: 0.3
    }

    const result = transformOpenAIBodyToEnterprise(input, TEST_MODEL_ID)

    expect(result.config).toEqual({
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 2048,
      frequencyPenalty: 0.5,
      presencePenalty: 0.3
    })
    expect(result.temperature).toBeUndefined()
    expect(result.top_p).toBeUndefined()
    expect(result.max_tokens).toBeUndefined()
    expect(result.frequency_penalty).toBeUndefined()
    expect(result.presence_penalty).toBeUndefined()
  })

  it('should not include config when no config fields are present', () => {
    const input = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'test' }],
      stream: true
    }

    const result = transformOpenAIBodyToEnterprise(input, TEST_MODEL_ID)

    expect(result.config).toBeUndefined()
  })

  it('should only include defined config fields', () => {
    const input = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'test' }],
      stream: true,
      temperature: 0.5
    }

    const result = transformOpenAIBodyToEnterprise(input, TEST_MODEL_ID)

    expect(result.config).toEqual({ temperature: 0.5 })
  })

  it('should handle multimodal content arrays', () => {
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What is in this image?' },
          { type: 'image_url', image_url: { url: 'https://example.com/img.jpg' } }
        ]
      }
    ]
    const input = { model: 'gpt-4o', messages, stream: true }

    const result = transformOpenAIBodyToEnterprise(input, TEST_MODEL_ID)

    expect(result.messages).toBe(messages)
  })

  it('should pass through unknown fields via rest spread', () => {
    const input = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'test' }],
      stream: true,
      tools: [{ type: 'function', function: { name: 'test' } }],
      response_format: { type: 'json_object' }
    }

    const result = transformOpenAIBodyToEnterprise(input, TEST_MODEL_ID)

    expect(result.tools).toEqual(input.tools)
    expect(result.response_format).toEqual(input.response_format)
  })

  it('should discard existing config field from body to avoid conflicts', () => {
    const input = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'test' }],
      stream: true,
      config: { existingKey: 'should-be-removed' },
      temperature: 0.8
    }

    const result = transformOpenAIBodyToEnterprise(input, TEST_MODEL_ID)

    expect(result.config).toEqual({ temperature: 0.8 })
    expect((result.config as Record<string, unknown>).existingKey).toBeUndefined()
  })

  it('should handle empty messages array', () => {
    const input = {
      model: 'gpt-4o',
      messages: [],
      stream: true
    }

    const result = transformOpenAIBodyToEnterprise(input, TEST_MODEL_ID)

    expect(result.messages).toEqual([])
    expect(result.modelId).toBe(TEST_MODEL_ID)
  })

  it('should handle body without model field', () => {
    const input = {
      messages: [{ role: 'user', content: 'test' }],
      stream: true
    }

    const result = transformOpenAIBodyToEnterprise(input, TEST_MODEL_ID)

    expect(result.model).toBeUndefined()
    expect(result.modelId).toBe(TEST_MODEL_ID)
  })

  it('should default stream to false when not provided', () => {
    const input = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'test' }]
    }

    const result = transformOpenAIBodyToEnterprise(input, TEST_MODEL_ID)

    expect(result.stream).toBe(false)
    expect(result.modelId).toBe(TEST_MODEL_ID)
  })

  it('should produce immutable result without mutating input', () => {
    const input = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'test' }],
      stream: true,
      temperature: 0.7
    }
    const inputCopy = { ...input }

    const result = transformOpenAIBodyToEnterprise(input, TEST_MODEL_ID)

    expect(input).toEqual(inputCopy)
    expect(result).not.toBe(input)
  })
})
