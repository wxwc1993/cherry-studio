/**
 * 生成预设提示词助手的 PostgreSQL INSERT SQL
 *
 * 数据源: resources/data/agents-zh.json, agents-en.json
 * 目标表: assistant_preset_tags, assistant_presets, assistant_preset_tag_relations
 *
 * 运行: npx tsx scripts/generate-preset-sql.ts
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { v4 as uuidv4 } from 'uuid'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ============ 类型定义 ============

interface Agent {
  readonly id: string
  readonly name: string
  readonly emoji: string
  readonly description: string
  readonly group: readonly string[]
  readonly prompt: string
}

interface TagRecord {
  readonly id: string
  readonly name: string
  readonly locale: string
  readonly order: number
}

interface PresetRecord {
  readonly id: string
  readonly name: string
  readonly emoji: string
  readonly description: string
  readonly prompt: string
  readonly locale: string
  readonly order: number
}

interface RelationRecord {
  readonly presetId: string
  readonly tagId: string
}

// ============ 常量 ============

const COMPANY_ID = '74855283-9f2a-4940-b350-a78c5627ab30'
const BATCH_SIZE = 100

const ROOT_DIR = join(__dirname, '..')
const ZH_DATA_PATH = join(ROOT_DIR, 'resources/data/agents-zh.json')
const EN_DATA_PATH = join(ROOT_DIR, 'resources/data/agents-en.json')
const OUTPUT_DIR = join(ROOT_DIR, 'scripts/output')
const OUTPUT_PATH = join(OUTPUT_DIR, 'assistant-presets-seed.sql')

// 中英文分类映射（key 为中文名，value 为英文名）
const GROUP_ZH_TO_EN: Readonly<Record<string, string>> = {
  职业: 'Career',
  商业: 'Business',
  工具: 'Tools',
  语言: 'Language',
  办公: 'Office',
  通用: 'General',
  写作: 'Writing',
  精选: 'Featured',
  编程: 'Programming',
  情感: 'Emotion',
  教育: 'Education',
  创意: 'Creative',
  学术: 'Academic',
  设计: 'Design',
  艺术: 'Art',
  娱乐: 'Entertainment',
  生活: 'Life',
  医疗: 'Medical',
  游戏: 'Games',
  翻译: 'Translation',
  音乐: 'Music',
  点评: 'Review',
  文案: 'Copywriting',
  百科: 'Encyclopedia',
  健康: 'Health',
  营销: 'Marketing',
  科学: 'Science',
  分析: 'Analysis',
  法律: 'Legal',
  咨询: 'Consulting',
  金融: 'Finance',
  旅游: 'Travel',
  管理: 'Management'
}

// ============ 工具函数 ============

function escapeSql(text: string): string {
  return text.replace(/'/g, "''")
}

function sqlValue(value: string | null | undefined): string {
  if (value == null || value === '') {
    return 'NULL'
  }
  return `'${escapeSql(value.trim())}'`
}

function formatBatchInsert(table: string, columns: readonly string[], rows: readonly string[][]): string {
  const batches: string[] = []
  const quotedColumns = columns.map((col) => (col === 'order' ? `"order"` : col))
  const header = `INSERT INTO ${table} (${quotedColumns.join(', ')}) VALUES`

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const values = batch.map((row) => `  (${row.join(', ')})`).join(',\n')
    batches.push(`${header}\n${values};`)
  }

  return batches.join('\n\n')
}

// ============ 数据处理 ============

function buildTagRecords(zhGroups: readonly string[]): {
  readonly zhTags: readonly TagRecord[]
  readonly enTags: readonly TagRecord[]
  readonly zhTagMap: ReadonlyMap<string, string>
  readonly enTagMap: ReadonlyMap<string, string>
} {
  const zhTags: TagRecord[] = []
  const enTags: TagRecord[] = []
  const zhTagMap = new Map<string, string>()
  const enTagMap = new Map<string, string>()

  zhGroups.forEach((zhName, index) => {
    const enName = GROUP_ZH_TO_EN[zhName]
    if (!enName) {
      throw new Error(`未找到分类 "${zhName}" 的英文映射`)
    }

    const zhId = uuidv4()
    const enId = uuidv4()

    zhTags.push({ id: zhId, name: zhName, locale: 'zh-cn', order: index })
    enTags.push({ id: enId, name: enName, locale: 'en-us', order: index })

    zhTagMap.set(zhName, zhId)
    enTagMap.set(enName, enId)
  })

  return { zhTags, enTags, zhTagMap, enTagMap }
}

function buildPresetRecords(agents: readonly Agent[], locale: string): readonly PresetRecord[] {
  return agents.map((agent, index) => ({
    id: uuidv4(),
    name: agent.name,
    emoji: agent.emoji,
    description: agent.description,
    prompt: agent.prompt,
    locale,
    order: index
  }))
}

function buildRelationRecords(
  agents: readonly Agent[],
  presets: readonly PresetRecord[],
  tagMap: ReadonlyMap<string, string>
): readonly RelationRecord[] {
  const relations: RelationRecord[] = []

  agents.forEach((agent, index) => {
    const presetId = presets[index].id
    for (const group of agent.group) {
      const tagId = tagMap.get(group)
      if (!tagId) {
        throw new Error(`未找到分类 "${group}" 对应的标签 ID（助手: ${agent.name}）`)
      }
      relations.push({ presetId, tagId })
    }
  })

  return relations
}

// ============ SQL 生成 ============

function generateTagsSql(tags: readonly TagRecord[]): string {
  const columns = ['id', 'company_id', 'name', 'locale', 'order'] as const
  const rows = tags.map((tag) => [
    sqlValue(tag.id),
    sqlValue(COMPANY_ID),
    sqlValue(tag.name),
    sqlValue(tag.locale),
    String(tag.order)
  ])
  return formatBatchInsert('assistant_preset_tags', columns, rows)
}

function generatePresetsSql(presets: readonly PresetRecord[], locale: string): string {
  const columns = [
    'id',
    'company_id',
    'name',
    'emoji',
    'description',
    'prompt',
    'locale',
    'is_enabled',
    'order'
  ] as const
  const rows = presets.map((preset) => [
    sqlValue(preset.id),
    sqlValue(COMPANY_ID),
    sqlValue(preset.name),
    sqlValue(preset.emoji),
    sqlValue(preset.description),
    sqlValue(preset.prompt),
    sqlValue(locale),
    'true',
    String(preset.order)
  ])
  return formatBatchInsert('assistant_presets', columns, rows)
}

function generateRelationsSql(relations: readonly RelationRecord[]): string {
  const columns = ['preset_id', 'tag_id'] as const
  const rows = relations.map((rel) => [sqlValue(rel.presetId), sqlValue(rel.tagId)])
  return formatBatchInsert('assistant_preset_tag_relations', columns, rows)
}

// ============ 主流程 ============

async function main(): Promise<void> {
  // 1. 读取数据源
  const [zhRaw, enRaw] = await Promise.all([readFile(ZH_DATA_PATH, 'utf-8'), readFile(EN_DATA_PATH, 'utf-8')])

  const zhAgents: readonly Agent[] = JSON.parse(zhRaw)
  const enAgents: readonly Agent[] = JSON.parse(enRaw)

  // 2. 收集所有中文分类（保持顺序）
  const zhGroupSet = new Set<string>()
  for (const agent of zhAgents) {
    for (const group of agent.group) {
      zhGroupSet.add(group)
    }
  }
  const zhGroups = [...zhGroupSet]

  // 3. 构建标签记录
  const { zhTags, enTags, zhTagMap, enTagMap } = buildTagRecords(zhGroups)

  // 4. 构建助手预设记录
  const zhPresets = buildPresetRecords(zhAgents, 'zh-cn')
  const enPresets = buildPresetRecords(enAgents, 'en-us')

  // 5. 构建关联关系
  const zhRelations = buildRelationRecords(zhAgents, zhPresets, zhTagMap)
  const enRelations = buildRelationRecords(enAgents, enPresets, enTagMap)
  const allRelations = [...zhRelations, ...enRelations]

  // 6. 生成 SQL
  const now = new Date().toISOString().split('T')[0]

  const sqlParts = [
    `-- Cherry Studio 预设助手初始化数据`,
    `-- 生成时间: ${now}`,
    `-- 数据源: resources/data/agents-zh.json, agents-en.json`,
    `-- 统计: ${zhAgents.length} 助手 × 2 语言, ${zhGroups.length} 分类 × 2 语言`,
    `-- 总记录数: 标签 ${zhTags.length + enTags.length} 条, 助手 ${zhPresets.length + enPresets.length} 条, 关联 ${allRelations.length} 条`,
    ``,
    `BEGIN;`,
    ``,
    `-- ============================================================`,
    `-- 1. 清理旧数据（可选，取消注释后执行）`,
    `-- ============================================================`,
    `-- DELETE FROM assistant_preset_tag_relations WHERE preset_id IN (SELECT id FROM assistant_presets WHERE company_id = '${COMPANY_ID}');`,
    `-- DELETE FROM assistant_presets WHERE company_id = '${COMPANY_ID}';`,
    `-- DELETE FROM assistant_preset_tags WHERE company_id = '${COMPANY_ID}';`,
    ``,
    `-- ============================================================`,
    `-- 2. 插入分类标签（中文 ${zhTags.length} 条 + 英文 ${enTags.length} 条 = ${zhTags.length + enTags.length} 条）`,
    `-- ============================================================`,
    ``,
    generateTagsSql([...zhTags, ...enTags]),
    ``,
    `-- ============================================================`,
    `-- 3. 插入助手预设 - 中文（${zhPresets.length} 条）`,
    `-- ============================================================`,
    ``,
    generatePresetsSql(zhPresets, 'zh-cn'),
    ``,
    `-- ============================================================`,
    `-- 4. 插入助手预设 - 英文（${enPresets.length} 条）`,
    `-- ============================================================`,
    ``,
    generatePresetsSql(enPresets, 'en-us'),
    ``,
    `-- ============================================================`,
    `-- 5. 插入标签关联关系（${allRelations.length} 条）`,
    `-- ============================================================`,
    ``,
    generateRelationsSql(allRelations),
    ``,
    `COMMIT;`,
    ``
  ]

  const sql = sqlParts.join('\n')

  // 7. 写入文件
  await mkdir(OUTPUT_DIR, { recursive: true })
  await writeFile(OUTPUT_PATH, sql, 'utf-8')

  // 8. 输出统计
  const stats = [
    `✅ SQL 文件已生成: ${OUTPUT_PATH}`,
    ``,
    `📊 统计:`,
    `   分类标签: ${zhTags.length + enTags.length} 条 (中文 ${zhTags.length} + 英文 ${enTags.length})`,
    `   助手预设: ${zhPresets.length + enPresets.length} 条 (中文 ${zhPresets.length} + 英文 ${enPresets.length})`,
    `   关联关系: ${allRelations.length} 条 (中文 ${zhRelations.length} + 英文 ${enRelations.length})`,
    `   文件大小: ${(Buffer.byteLength(sql, 'utf-8') / 1024 / 1024).toFixed(2)} MB`
  ]

  for (const line of stats) {
    process.stdout.write(line + '\n')
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`❌ 生成失败: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
