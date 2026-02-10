import {
  adaptEnterpriseModel,
  adaptEnterpriseModels,
  type EnterpriseApiModel,
  groupModelsToProviders,
  isEnterpriseModelFree,
  matchProviderNameToSystemId
} from '@renderer/services/EnterpriseModelAdapter'
import { describe, expect, it } from 'vitest'

// ── matchProviderNameToSystemId ──────────────────────

describe('matchProviderNameToSystemId', () => {
  // ── 标准 Enterprise Provider ID（直接匹配） ──────

  it('should match standard enterprise ID "dashscope"', () => {
    expect(matchProviderNameToSystemId('dashscope')).toBe('dashscope')
  })

  it('should match standard enterprise ID "openai"', () => {
    expect(matchProviderNameToSystemId('openai')).toBe('openai')
  })

  it('should match standard enterprise ID "anthropic"', () => {
    expect(matchProviderNameToSystemId('anthropic')).toBe('anthropic')
  })

  it('should match standard enterprise ID "deepseek"', () => {
    expect(matchProviderNameToSystemId('deepseek')).toBe('deepseek')
  })

  it('should match standard enterprise ID "gemini"', () => {
    expect(matchProviderNameToSystemId('gemini')).toBe('gemini')
  })

  it('should match standard enterprise ID "azure-openai"', () => {
    expect(matchProviderNameToSystemId('azure-openai')).toBe('azure-openai')
  })

  // ── Legacy 精确匹配 ──────────────────────────────

  it('should map legacy "qwen" to "dashscope"', () => {
    expect(matchProviderNameToSystemId('qwen')).toBe('dashscope')
  })

  it('should map legacy "azure" to "azure-openai"', () => {
    expect(matchProviderNameToSystemId('azure')).toBe('azure-openai')
  })

  it('should map legacy "google" to "gemini"', () => {
    expect(matchProviderNameToSystemId('google')).toBe('gemini')
  })

  it('should map legacy "wenxin" to "baidu-cloud"', () => {
    expect(matchProviderNameToSystemId('wenxin')).toBe('baidu-cloud')
  })

  it('should map legacy "claude" to "anthropic"', () => {
    expect(matchProviderNameToSystemId('claude')).toBe('anthropic')
  })

  // ── 大小写不敏感 ─────────────────────────────────

  it('should be case-insensitive for enterprise IDs', () => {
    expect(matchProviderNameToSystemId('OpenAI')).toBe('openai')
    expect(matchProviderNameToSystemId('DASHSCOPE')).toBe('dashscope')
  })

  it('should be case-insensitive for legacy mappings', () => {
    expect(matchProviderNameToSystemId('QWEN')).toBe('dashscope')
    expect(matchProviderNameToSystemId('Azure')).toBe('azure-openai')
  })

  it('should trim whitespace', () => {
    expect(matchProviderNameToSystemId('  openai  ')).toBe('openai')
    expect(matchProviderNameToSystemId(' qwen ')).toBe('dashscope')
  })

  // ── 自定义 ID 不应被模糊匹配（核心修复验证） ────

  it('should NOT match custom ID "yadea_qwen" (no fuzzy match)', () => {
    expect(matchProviderNameToSystemId('yadea_qwen')).toBeUndefined()
  })

  it('should NOT match custom ID "my_azure_service" (no fuzzy match)', () => {
    expect(matchProviderNameToSystemId('my_azure_service')).toBeUndefined()
  })

  it('should NOT match custom ID "team_claude_v1" (no fuzzy match)', () => {
    expect(matchProviderNameToSystemId('team_claude_v1')).toBeUndefined()
  })

  it('should NOT match custom ID "xxx_google_yyy" (no fuzzy match)', () => {
    expect(matchProviderNameToSystemId('xxx_google_yyy')).toBeUndefined()
  })

  it('should NOT match custom ID "wenxin_custom" (no fuzzy match)', () => {
    expect(matchProviderNameToSystemId('wenxin_custom')).toBeUndefined()
  })

  // ── 完全未知的 ID ────────────────────────────────

  it('should return undefined for completely unknown provider', () => {
    expect(matchProviderNameToSystemId('my_custom_provider')).toBeUndefined()
  })

  it('should return undefined for empty string', () => {
    expect(matchProviderNameToSystemId('')).toBeUndefined()
  })

  it('should return undefined for whitespace-only string', () => {
    expect(matchProviderNameToSystemId('   ')).toBeUndefined()
  })
})

// ── groupModelsToProviders ───────────────────────────

describe('groupModelsToProviders', () => {
  it('should group models by provider and create separate Provider entries', () => {
    const models = [
      { id: 'qwen-max', provider: 'dashscope', name: 'Qwen Max', group: 'qwen' },
      { id: 'qwen-plus', provider: 'dashscope', name: 'Qwen Plus', group: 'qwen' },
      { id: 'custom-qwen', provider: 'yadea_qwen', name: 'Custom Qwen', group: 'yadea' }
    ]

    const providers = groupModelsToProviders(models)

    expect(providers).toHaveLength(2)

    const dashscopeProvider = providers.find((p) => p.id === 'dashscope')
    expect(dashscopeProvider).toBeDefined()
    expect(dashscopeProvider!.isSystem).toBe(true)
    expect(dashscopeProvider!.models).toHaveLength(2)

    const customProvider = providers.find((p) => p.id === 'enterprise-yadea_qwen')
    expect(customProvider).toBeDefined()
    expect(customProvider!.isSystem).toBe(false)
    expect(customProvider!.models).toHaveLength(1)
  })

  it('should not merge custom and standard providers with similar names', () => {
    const models = [
      { id: 'ds-model', provider: 'dashscope', name: 'DS Model', group: 'ds' },
      { id: 'yadea-model', provider: 'yadea_qwen', name: 'Yadea Model', group: 'yadea' },
      { id: 'or-model', provider: 'openrouter', name: 'OR Model', group: 'or' }
    ]

    const providers = groupModelsToProviders(models)

    expect(providers).toHaveLength(3)

    const ids = providers.map((p) => p.id).sort()
    expect(ids).toEqual(['dashscope', 'enterprise-yadea_qwen', 'openrouter'])
  })

  it('should handle legacy provider names via exact match', () => {
    const models = [{ id: 'model-1', provider: 'qwen', name: 'Qwen Model', group: 'qwen' }]

    const providers = groupModelsToProviders(models)

    expect(providers).toHaveLength(1)
    expect(providers[0].id).toBe('dashscope')
    expect(providers[0].isSystem).toBe(true)
  })

  it('should handle models with missing provider field', () => {
    const models = [{ id: 'model-1', provider: '', name: 'No Provider', group: '' }]

    const providers = groupModelsToProviders(models)

    expect(providers).toHaveLength(1)
    expect(providers[0].name).toBe('unknown')
  })

  it('should return empty array for empty models list', () => {
    const providers = groupModelsToProviders([])
    expect(providers).toHaveLength(0)
  })
})

// ── adaptEnterpriseModel ─────────────────────────────

describe('adaptEnterpriseModel', () => {
  it('should convert enterprise API model to client model format', () => {
    const enterprise: EnterpriseApiModel = {
      id: 'qwen-max',
      name: 'qwen-max',
      provider: 'dashscope',
      displayName: 'Qwen Max',
      description: 'Test model',
      capabilities: ['chat', 'vision'],
      group: 'qwen',
      maxTokens: 8192,
      contextLength: 32768
    }

    const result = adaptEnterpriseModel(enterprise)

    expect(result.id).toBe('qwen-max')
    expect(result.provider).toBe('dashscope')
    expect(result.name).toBe('Qwen Max')
    expect(result.group).toBe('qwen')
    expect(result.description).toBe('Test model')
  })

  it('should fall back to providerId when provider is missing', () => {
    const enterprise: EnterpriseApiModel = {
      id: 'model-1',
      name: 'model-1',
      providerId: 'yadea_qwen'
    }

    const result = adaptEnterpriseModel(enterprise)

    expect(result.provider).toBe('yadea_qwen')
  })

  it('should use "unknown" when both provider and providerId are missing', () => {
    const enterprise: EnterpriseApiModel = {
      id: 'model-1',
      name: 'model-1'
    }

    const result = adaptEnterpriseModel(enterprise)

    expect(result.provider).toBe('unknown')
  })

  it('should map pricing information correctly', () => {
    const enterprise: EnterpriseApiModel = {
      id: 'model-1',
      name: 'model-1',
      pricing: {
        input_per_million_tokens: 2.5,
        output_per_million_tokens: 10,
        currencySymbol: '¥'
      }
    }

    const result = adaptEnterpriseModel(enterprise)

    expect(result.pricing).toEqual({
      input_per_million_tokens: 2.5,
      output_per_million_tokens: 10,
      currencySymbol: '¥'
    })
  })

  it('should use name as fallback when displayName is missing', () => {
    const enterprise: EnterpriseApiModel = {
      id: 'model-1',
      name: 'raw-model-name'
    }

    const result = adaptEnterpriseModel(enterprise)

    expect(result.name).toBe('raw-model-name')
  })
})

// ── adaptEnterpriseModels ────────────────────────────

describe('adaptEnterpriseModels', () => {
  it('should filter out disabled models', () => {
    const models: EnterpriseApiModel[] = [
      { id: 'model-1', name: 'Model 1', enabled: true },
      { id: 'model-2', name: 'Model 2', enabled: false },
      { id: 'model-3', name: 'Model 3' }
    ]

    const result = adaptEnterpriseModels(models)

    expect(result).toHaveLength(2)
    expect(result.map((m) => m.id)).toEqual(['model-1', 'model-3'])
  })

  it('should return empty array for empty input', () => {
    expect(adaptEnterpriseModels([])).toHaveLength(0)
  })
})

// ── isEnterpriseModelFree ────────────────────────────

describe('isEnterpriseModelFree', () => {
  it('should return true when capabilities include "free"', () => {
    const model: EnterpriseApiModel = {
      id: 'model-1',
      name: 'Model 1',
      capabilities: ['chat', 'free']
    }

    expect(isEnterpriseModelFree(model)).toBe(true)
  })

  it('should be case-insensitive for "free" capability', () => {
    const model: EnterpriseApiModel = {
      id: 'model-1',
      name: 'Model 1',
      capabilities: ['chat', 'FREE']
    }

    expect(isEnterpriseModelFree(model)).toBe(true)
  })

  it('should return false when capabilities do not include "free"', () => {
    const model: EnterpriseApiModel = {
      id: 'model-1',
      name: 'Model 1',
      capabilities: ['chat', 'vision']
    }

    expect(isEnterpriseModelFree(model)).toBe(false)
  })

  it('should return false when capabilities is undefined', () => {
    const model: EnterpriseApiModel = {
      id: 'model-1',
      name: 'Model 1'
    }

    expect(isEnterpriseModelFree(model)).toBe(false)
  })
})
