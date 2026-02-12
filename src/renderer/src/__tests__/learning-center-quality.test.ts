/**
 * Learning Center 代码质量检查测试（TDD RED 阶段）
 *
 * 验证学习中心新增文件的存在性、代码规范和导出完整性。
 * 在实现代码完成之前，所有测试应 FAIL。
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

// ---------------------------------------------------------------------------
// 项目根目录
// ---------------------------------------------------------------------------
const PROJECT_ROOT = resolve(__dirname, '../../../../')

// ---------------------------------------------------------------------------
// 需要检查的新建文件路径列表
// ---------------------------------------------------------------------------
const EXPECTED_FILES = {
  // enterprise-shared 类型与 Schema
  'enterprise-shared types': 'packages/enterprise-shared/src/types/learning-center.ts',
  'enterprise-shared schemas': 'packages/enterprise-shared/src/schemas/learning-center.ts',

  // server 路由
  'server routes': 'packages/server/src/routes/learning-center.ts',

  // admin 面板
  'admin API service': 'packages/admin/src/services/learningCenterApi.ts',
  'admin LearningCenter index': 'packages/admin/src/pages/LearningCenter/index.tsx',
  'admin BannerManager': 'packages/admin/src/pages/LearningCenter/BannerManager.tsx',
  'admin CourseManager': 'packages/admin/src/pages/LearningCenter/CourseManager.tsx',
  'admin DocumentManager': 'packages/admin/src/pages/LearningCenter/DocumentManager.tsx',
  'admin HotItemManager': 'packages/admin/src/pages/LearningCenter/HotItemManager.tsx',

  // 客户端展示页面
  'client LearningCenterPage': 'src/renderer/src/pages/learning/LearningCenterPage.tsx',
  'client useLearningCenter hook': 'src/renderer/src/pages/learning/hooks/useLearningCenter.ts',
  'client PromotionBanner': 'src/renderer/src/pages/learning/components/PromotionBanner.tsx',
  'client CarouselBanner': 'src/renderer/src/pages/learning/components/CarouselBanner.tsx',
  'client LearningTabs': 'src/renderer/src/pages/learning/components/LearningTabs.tsx',
  'client HotSearchPanel': 'src/renderer/src/pages/learning/components/HotSearchPanel.tsx'
} as const

// ---------------------------------------------------------------------------
// TypeScript 文件列表（用于代码规范检查）
// ---------------------------------------------------------------------------
const TS_FILES = Object.values(EXPECTED_FILES)

// ===========================================================================
// 文件存在性检查
// ===========================================================================

describe('Learning Center - 文件存在性检查', () => {
  it.each(Object.entries(EXPECTED_FILES))('%s 文件应存在（%s）', (_label, relativePath) => {
    const absolutePath = resolve(PROJECT_ROOT, relativePath)
    expect(existsSync(absolutePath)).toBe(true)
  })

  it('所有 15 个计划中的新建文件应全部存在', () => {
    const missingFiles = Object.entries(EXPECTED_FILES)
      .filter(([, relativePath]) => !existsSync(resolve(PROJECT_ROOT, relativePath)))
      .map(([label, relativePath]) => `${label}: ${relativePath}`)

    expect(missingFiles).toHaveLength(0)
  })
})

// ===========================================================================
// 代码规范检查
// ===========================================================================

describe('Learning Center - 代码规范检查', () => {
  describe('禁止 console.log 语句', () => {
    it.each(TS_FILES)('文件 %s 不应包含 console.log', (relativePath) => {
      const absolutePath = resolve(PROJECT_ROOT, relativePath)

      if (!existsSync(absolutePath)) {
        // 文件不存在时测试也应失败（RED 阶段）
        expect(existsSync(absolutePath)).toBe(true)
        return
      }

      const content = readFileSync(absolutePath, 'utf-8')
      // 匹配 console.log（排除注释行）
      const lines = content.split('\n')
      const consoleLogLines = lines.filter((line) => {
        const trimmed = line.trim()
        // 跳过注释行
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
          return false
        }
        return /\bconsole\.log\b/.test(trimmed)
      })

      expect(consoleLogLines).toHaveLength(0)
    })
  })

  describe('避免 any 类型使用', () => {
    it.each(TS_FILES)('文件 %s 应尽量不使用 any 类型', (relativePath) => {
      const absolutePath = resolve(PROJECT_ROOT, relativePath)

      if (!existsSync(absolutePath)) {
        expect(existsSync(absolutePath)).toBe(true)
        return
      }

      const content = readFileSync(absolutePath, 'utf-8')
      const lines = content.split('\n')
      const anyTypeLines = lines.filter((line) => {
        const trimmed = line.trim()
        // 跳过注释行
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
          return false
        }
        // 匹配类型注解中的 any（如 : any, <any>, as any）
        return /\bany\b/.test(trimmed)
      })

      // 允许最多 3 个 any 使用（某些场景确实需要）
      expect(anyTypeLines.length).toBeLessThanOrEqual(3)
    })
  })

  describe('文件行数限制', () => {
    it.each(TS_FILES)('文件 %s 行数不应超过 800 行', (relativePath) => {
      const absolutePath = resolve(PROJECT_ROOT, relativePath)

      if (!existsSync(absolutePath)) {
        expect(existsSync(absolutePath)).toBe(true)
        return
      }

      const content = readFileSync(absolutePath, 'utf-8')
      const lineCount = content.split('\n').length

      expect(lineCount).toBeLessThanOrEqual(800)
    })
  })
})

// ===========================================================================
// 导出完整性检查
// ===========================================================================

describe('Learning Center - 导出完整性检查', () => {
  it('enterprise-shared types/index.ts 应导出 learning-center 类型', () => {
    const indexPath = resolve(PROJECT_ROOT, 'packages/enterprise-shared/src/types/index.ts')
    expect(existsSync(indexPath)).toBe(true)

    const content = readFileSync(indexPath, 'utf-8')
    // 应包含对 learning-center 模块的导出语句
    const hasLearningCenterExport = /export\s+\*\s+from\s+['"]\.\/learning-center['"]/.test(content)
    expect(hasLearningCenterExport).toBe(true)
  })

  it('enterprise-shared schemas/index.ts 应导出 learning-center schemas', () => {
    const indexPath = resolve(PROJECT_ROOT, 'packages/enterprise-shared/src/schemas/index.ts')
    expect(existsSync(indexPath)).toBe(true)

    const content = readFileSync(indexPath, 'utf-8')
    const hasLearningCenterExport = /export\s+\*\s+from\s+['"]\.\/learning-center['"]/.test(content)
    expect(hasLearningCenterExport).toBe(true)
  })

  it('enterprise-shared constants/index.ts 应导出 learning center 相关常量', () => {
    const indexPath = resolve(PROJECT_ROOT, 'packages/enterprise-shared/src/constants/index.ts')
    expect(existsSync(indexPath)).toBe(true)

    const content = readFileSync(indexPath, 'utf-8')
    // 检查 API_ROUTES 中是否包含 LEARNING_CENTER 路由配置
    const hasLearningCenterRoutes = /LEARNING_CENTER/.test(content)
    expect(hasLearningCenterRoutes).toBe(true)
  })

  it('enterprise-shared index.ts 应通过 barrel 导出 learning-center 模块', () => {
    const indexPath = resolve(PROJECT_ROOT, 'packages/enterprise-shared/src/index.ts')
    expect(existsSync(indexPath)).toBe(true)

    // 验证 barrel 导出链完整：index.ts -> types -> learning-center
    // index.ts 已有 export * from './types'，所以只需验证 types/index.ts 有导出即可
    const typesIndexPath = resolve(PROJECT_ROOT, 'packages/enterprise-shared/src/types/index.ts')
    const typesContent = readFileSync(typesIndexPath, 'utf-8')
    const hasExport = /export\s+\*\s+from\s+['"]\.\/learning-center['"]/.test(typesContent)
    expect(hasExport).toBe(true)
  })
})
