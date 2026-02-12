/**
 * Learning Center i18n 翻译 key 测试（TDD RED 阶段）
 *
 * 验证 en-us.json 和 zh-cn.json 中包含所有 18 个 learningCenter.* 翻译 key。
 * 在翻译 key 添加之前，所有测试应 FAIL。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

// ---------------------------------------------------------------------------
// 加载 JSON 文件
// ---------------------------------------------------------------------------
const LOCALES_DIR = resolve(__dirname, '../../i18n/locales')

const enUs: Record<string, any> = JSON.parse(readFileSync(resolve(LOCALES_DIR, 'en-us.json'), 'utf-8'))

const zhCn: Record<string, any> = JSON.parse(readFileSync(resolve(LOCALES_DIR, 'zh-cn.json'), 'utf-8'))

// ---------------------------------------------------------------------------
// 辅助函数：从嵌套对象中获取值（支持点分隔的 key 路径）
// ---------------------------------------------------------------------------
function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const keys = path.split('.')

  let current: any = obj
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined
    }
    current = current[key]
  }
  return typeof current === 'string' ? current : undefined
}

// ---------------------------------------------------------------------------
// 辅助函数：收集嵌套对象中所有以指定前缀开头的扁平化 key
// ---------------------------------------------------------------------------
function collectFlatKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const result: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result.push(...collectFlatKeys(value as Record<string, unknown>, fullKey))
    } else if (typeof value === 'string') {
      result.push(fullKey)
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// 期望的翻译 key 列表（共 18 个）
// ---------------------------------------------------------------------------
const LEARNING_CENTER_KEYS = [
  'learningCenter.title',
  'learningCenter.promotion.title',
  'learningCenter.promotion.subtitle',
  'learningCenter.promotion.viewMore',
  'learningCenter.tabs.courses',
  'learningCenter.tabs.documents',
  'learningCenter.hotSearch.title',
  'learningCenter.hotSearch.refresh',
  'learningCenter.hotSearch.noMore',
  'learningCenter.hotSearch.tagHot',
  'learningCenter.hotSearch.tagNew',
  'learningCenter.stats.courses',
  'learningCenter.stats.documents',
  'learningCenter.stats.views',
  'learningCenter.empty.title',
  'learningCenter.empty.courses',
  'learningCenter.empty.documents',
  'learningCenter.empty.hotSearch'
] as const

// ---------------------------------------------------------------------------
// 期望的英文翻译值
// ---------------------------------------------------------------------------
const EN_US_EXPECTED: Record<string, string> = {
  'learningCenter.title': 'Learning Center',
  'learningCenter.promotion.title': 'From Beginner to Expert',
  'learningCenter.promotion.subtitle': 'Master efficient usage tips',
  'learningCenter.promotion.viewMore': 'View More',
  'learningCenter.tabs.courses': 'Featured Courses',
  'learningCenter.tabs.documents': 'Featured Documents',
  'learningCenter.hotSearch.title': 'Trending Searches',
  'learningCenter.hotSearch.refresh': 'Refresh',
  'learningCenter.hotSearch.noMore': 'No more items',
  'learningCenter.hotSearch.tagHot': 'Hot',
  'learningCenter.hotSearch.tagNew': 'New',
  'learningCenter.stats.courses': ' courses',
  'learningCenter.stats.documents': ' documents',
  'learningCenter.stats.views': ' views',
  'learningCenter.empty.title': 'No learning content yet',
  'learningCenter.empty.courses': 'No courses available',
  'learningCenter.empty.documents': 'No documents available',
  'learningCenter.empty.hotSearch': 'No trending searches'
}

// ---------------------------------------------------------------------------
// 期望的中文翻译值
// ---------------------------------------------------------------------------
const ZH_CN_EXPECTED: Record<string, string> = {
  'learningCenter.title': '学习中心',
  'learningCenter.promotion.title': '从入门到精通',
  'learningCenter.promotion.subtitle': '掌握高效使用秘诀',
  'learningCenter.promotion.viewMore': '查看更多',
  'learningCenter.tabs.courses': '精选视频课',
  'learningCenter.tabs.documents': '精选知识文档',
  'learningCenter.hotSearch.title': '大家都在搜',
  'learningCenter.hotSearch.refresh': '换一批',
  'learningCenter.hotSearch.noMore': '没有更多了',
  'learningCenter.hotSearch.tagHot': '热',
  'learningCenter.hotSearch.tagNew': '新',
  'learningCenter.stats.courses': '门视频课',
  'learningCenter.stats.documents': '篇知识文档',
  'learningCenter.stats.views': '次学习访问',
  'learningCenter.empty.title': '暂无学习内容',
  'learningCenter.empty.courses': '暂无课程',
  'learningCenter.empty.documents': '暂无文档',
  'learningCenter.empty.hotSearch': '暂无热搜'
}

// ===========================================================================
// 测试套件
// ===========================================================================

describe('Learning Center i18n - en-us.json', () => {
  it('应包含全部 18 个 learningCenter.* key', () => {
    const allFlatKeys = collectFlatKeys(enUs)
    const existingKeys = allFlatKeys.filter((k) => k.startsWith('learningCenter.'))
    expect(existingKeys).toHaveLength(LEARNING_CENTER_KEYS.length)
  })

  it.each(LEARNING_CENTER_KEYS)('应包含 key: %s', (key) => {
    const value = getNestedValue(enUs, key)
    expect(value).toBeDefined()
  })

  it.each(LEARNING_CENTER_KEYS)('key "%s" 的值应为非空字符串', (key) => {
    const value = getNestedValue(enUs, key)
    expect(typeof value).toBe('string')
    expect(value!.trim().length).toBeGreaterThan(0)
  })

  it.each(LEARNING_CENTER_KEYS)('key "%s" 的值不应包含 [to be translated] 占位符', (key) => {
    const value = getNestedValue(enUs, key)
    expect(value).not.toContain('[to be translated]')
  })

  it.each(Object.entries(EN_US_EXPECTED))('key "%s" 的英文翻译值应为 "%s"', (key, expectedValue) => {
    expect(getNestedValue(enUs, key)).toBe(expectedValue)
  })
})

describe('Learning Center i18n - zh-cn.json', () => {
  it('应包含全部 18 个 learningCenter.* key', () => {
    const allFlatKeys = collectFlatKeys(zhCn)
    const existingKeys = allFlatKeys.filter((k) => k.startsWith('learningCenter.'))
    expect(existingKeys).toHaveLength(LEARNING_CENTER_KEYS.length)
  })

  it.each(LEARNING_CENTER_KEYS)('应包含 key: %s', (key) => {
    const value = getNestedValue(zhCn, key)
    expect(value).toBeDefined()
  })

  it.each(LEARNING_CENTER_KEYS)('key "%s" 的值应为非空字符串', (key) => {
    const value = getNestedValue(zhCn, key)
    expect(typeof value).toBe('string')
    expect(value!.trim().length).toBeGreaterThan(0)
  })

  it.each(LEARNING_CENTER_KEYS)('key "%s" 的值不应包含 [to be translated] 占位符', (key) => {
    const value = getNestedValue(zhCn, key)
    expect(value).not.toContain('[to be translated]')
  })

  it.each(Object.entries(ZH_CN_EXPECTED))('key "%s" 的中文翻译值应为 "%s"', (key, expectedValue) => {
    expect(getNestedValue(zhCn, key)).toBe(expectedValue)
  })
})

describe('Learning Center i18n - key 一致性', () => {
  it('en-us 和 zh-cn 中的 learningCenter.* key 集合应完全一致且非空', () => {
    const enAllKeys = collectFlatKeys(enUs)
    const zhAllKeys = collectFlatKeys(zhCn)
    const enKeys = enAllKeys.filter((k) => k.startsWith('learningCenter.')).sort()
    const zhKeys = zhAllKeys.filter((k) => k.startsWith('learningCenter.')).sort()
    // 确保集合非空（防止两个空集合相等而误通过）
    expect(enKeys.length).toBeGreaterThan(0)
    expect(zhKeys.length).toBeGreaterThan(0)
    expect(enKeys).toEqual(zhKeys)
  })

  it('en-us 中的 learningCenter.* key 数量应与预期列表匹配', () => {
    const allFlatKeys = collectFlatKeys(enUs)
    const enKeys = allFlatKeys.filter((k) => k.startsWith('learningCenter.'))
    expect(enKeys).toHaveLength(LEARNING_CENTER_KEYS.length)
  })

  it('zh-cn 中的 learningCenter.* key 数量应与预期列表匹配', () => {
    const allFlatKeys = collectFlatKeys(zhCn)
    const zhKeys = allFlatKeys.filter((k) => k.startsWith('learningCenter.'))
    expect(zhKeys).toHaveLength(LEARNING_CENTER_KEYS.length)
  })

  it('所有 learningCenter.* key 应按字母排序分组存在', () => {
    const sortedExpected = [...LEARNING_CENTER_KEYS].sort()

    const enAllKeys = collectFlatKeys(enUs)
    const zhAllKeys = collectFlatKeys(zhCn)
    const enLcKeys = enAllKeys.filter((k) => k.startsWith('learningCenter.')).sort()
    const zhLcKeys = zhAllKeys.filter((k) => k.startsWith('learningCenter.')).sort()

    expect(enLcKeys).toEqual(sortedExpected)
    expect(zhLcKeys).toEqual(sortedExpected)
  })
})
