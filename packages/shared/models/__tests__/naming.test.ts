import { describe, expect, it } from 'vitest'

import { getBaseModelName, getLowerBaseModelName } from '../naming'

describe('getBaseModelName', () => {
  it('should return the last segment after delimiter', () => {
    expect(getBaseModelName('deepseek/deepseek-r1')).toBe('deepseek-r1')
  })

  it('should return the last segment with multiple delimiters', () => {
    expect(getBaseModelName('deepseek-ai/deepseek/deepseek-r1')).toBe('deepseek-r1')
  })

  it('should return the full id if no delimiter exists', () => {
    expect(getBaseModelName('gpt-4o')).toBe('gpt-4o')
  })

  it('should handle empty string', () => {
    expect(getBaseModelName('')).toBe('')
  })

  it('should support custom delimiter', () => {
    expect(getBaseModelName('provider:model-name', ':')).toBe('model-name')
  })

  it('should handle trailing delimiter', () => {
    expect(getBaseModelName('openai/')).toBe('')
  })
})

describe('getLowerBaseModelName', () => {
  it('should return lowercased base model name', () => {
    expect(getLowerBaseModelName('deepseek/DeepSeek-R1')).toBe('deepseek-r1')
  })

  it('should remove :free suffix (openrouter)', () => {
    expect(getLowerBaseModelName('meta-llama/llama-3:free')).toBe('llama-3')
  })

  it('should remove (free) suffix (cherryin)', () => {
    expect(getLowerBaseModelName('provider/model-name(free)')).toBe('model-name')
  })

  it('should remove :cloud suffix (ollama)', () => {
    expect(getLowerBaseModelName('ollama/model-name:cloud')).toBe('model-name')
  })

  it('should handle id without delimiter', () => {
    expect(getLowerBaseModelName('GPT-4o')).toBe('gpt-4o')
  })

  it('should support custom delimiter', () => {
    expect(getLowerBaseModelName('PROVIDER:MODEL-NAME', ':')).toBe('model-name')
  })

  it('should only remove known suffixes', () => {
    expect(getLowerBaseModelName('model-name:latest')).toBe('model-name:latest')
  })

  it('should handle empty string', () => {
    expect(getLowerBaseModelName('')).toBe('')
  })
})
