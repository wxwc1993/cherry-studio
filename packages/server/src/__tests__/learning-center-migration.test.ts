import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Learning Center 权限迁移脚本 — TDD RED 阶段测试
 *
 * 验证 add-learning-center-permissions.sql 迁移脚本的：
 * 1. 文件存在性
 * 2. SQL 语法结构
 * 3. 幂等性保护
 * 4. 权限值正确性
 * 5. SQL 安全性
 */

const MIGRATION_FILE_PATH = path.resolve(__dirname, '../../src/migrations/add-learning-center-permissions.sql')

// ============ 辅助函数 ============

/**
 * 读取迁移文件内容
 * 用于后续测试的文本解析验证
 */
function readMigrationFile(): string {
  return fs.readFileSync(MIGRATION_FILE_PATH, 'utf-8')
}

/**
 * 将 SQL 内容按语句分割（以分号为界）
 * 返回去除空白后的非空语句数组
 */
function splitStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/**
 * 提取指定角色名的 UPDATE 语句
 * 匹配 UPDATE roles ... WHERE ... name = 'roleName' 模式
 */
function findStatementsForRole(statements: string[], roleName: string): string[] {
  return statements.filter((stmt) => {
    const upper = stmt.toUpperCase()
    return upper.includes('UPDATE') && upper.includes('ROLES') && stmt.includes(`'${roleName}'`)
  })
}

// ============ 1. 文件存在性测试 ============

describe('迁移文件存在性', () => {
  it('迁移文件 add-learning-center-permissions.sql 应存在于 src/migrations/ 目录', () => {
    expect(fs.existsSync(MIGRATION_FILE_PATH)).toBe(true)
  })

  it('迁移文件内容应非空', () => {
    const content = readMigrationFile()
    expect(content.trim().length).toBeGreaterThan(0)
  })
})

// ============ 2. SQL 语法结构验证 ============

describe('SQL 语法结构', () => {
  it('应包含对 super_admin 角色的 learningCenter 权限更新', () => {
    const sql = readMigrationFile()
    const statements = splitStatements(sql)
    const superAdminStatements = findStatementsForRole(statements, 'super_admin')

    // 至少有一条针对 super_admin 的 UPDATE 语句涉及 learningCenter
    const hasLearningCenter = superAdminStatements.some((s) => s.includes('learningCenter'))
    expect(hasLearningCenter).toBe(true)
  })

  it('应包含对 admin 角色的 learningCenter 权限更新', () => {
    const sql = readMigrationFile()
    const statements = splitStatements(sql)
    const adminStatements = findStatementsForRole(statements, 'admin')

    const hasLearningCenter = adminStatements.some((s) => s.includes('learningCenter'))
    expect(hasLearningCenter).toBe(true)
  })

  it('应包含对 manager 角色的 learningCenter 权限更新', () => {
    const sql = readMigrationFile()
    const statements = splitStatements(sql)
    const managerStatements = findStatementsForRole(statements, 'manager')

    const hasLearningCenter = managerStatements.some((s) => s.includes('learningCenter'))
    expect(hasLearningCenter).toBe(true)
  })

  it('应包含对 user 角色的 learningCenter 权限更新', () => {
    const sql = readMigrationFile()
    const statements = splitStatements(sql)
    const userStatements = findStatementsForRole(statements, 'user')

    const hasLearningCenter = userStatements.some((s) => s.includes('learningCenter'))
    expect(hasLearningCenter).toBe(true)
  })

  it('应包含 assistantPresets 补齐语句', () => {
    const sql = readMigrationFile()

    // SQL 中应出现 assistantPresets 关键词
    expect(sql).toContain('assistantPresets')

    // 至少在一条 UPDATE 语句中同时涉及 assistantPresets 和 super_admin 或 admin
    const statements = splitStatements(sql)
    const assistantPresetsStatements = statements.filter((s) => s.includes('assistantPresets'))

    expect(assistantPresetsStatements.length).toBeGreaterThan(0)
  })

  it('所有 UPDATE 语句都应针对 roles 表', () => {
    const sql = readMigrationFile()
    const statements = splitStatements(sql)
    const updateStatements = statements.filter((s) => s.toUpperCase().trimStart().startsWith('UPDATE'))

    expect(updateStatements.length).toBeGreaterThan(0)

    for (const stmt of updateStatements) {
      // 每条 UPDATE 语句应操作 roles 表
      expect(stmt.toUpperCase()).toContain('ROLES')
    }
  })
})

// ============ 3. 幂等性保护验证 ============

describe('幂等性保护', () => {
  it('每条 learningCenter 的 UPDATE 应包含 IS NULL 检查条件', () => {
    const sql = readMigrationFile()
    const statements = splitStatements(sql)

    // 筛选包含 learningCenter 的 UPDATE 语句
    const learningCenterUpdates = statements.filter((s) => {
      const upper = s.toUpperCase()
      return upper.includes('UPDATE') && s.includes('learningCenter')
    })

    expect(learningCenterUpdates.length).toBeGreaterThan(0)

    for (const stmt of learningCenterUpdates) {
      // 幂等保护：WHERE 条件中应包含 IS NULL 检查
      expect(stmt.toUpperCase()).toContain('IS NULL')
    }
  })

  it('每条 assistantPresets 的 UPDATE 应包含 IS NULL 检查条件', () => {
    const sql = readMigrationFile()
    const statements = splitStatements(sql)

    // 筛选包含 assistantPresets 的 UPDATE 语句
    const assistantPresetsUpdates = statements.filter((s) => {
      const upper = s.toUpperCase()
      return upper.includes('UPDATE') && s.includes('assistantPresets')
    })

    expect(assistantPresetsUpdates.length).toBeGreaterThan(0)

    for (const stmt of assistantPresetsUpdates) {
      expect(stmt.toUpperCase()).toContain('IS NULL')
    }
  })

  it('所有 UPDATE 语句都应使用 jsonb_set 函数', () => {
    const sql = readMigrationFile()
    const statements = splitStatements(sql)
    const updateStatements = statements.filter((s) => s.toUpperCase().trimStart().startsWith('UPDATE'))

    expect(updateStatements.length).toBeGreaterThan(0)

    for (const stmt of updateStatements) {
      expect(stmt.toLowerCase()).toContain('jsonb_set')
    }
  })

  it('重复执行不应产生副作用（WHERE 条件排除已有字段的行）', () => {
    const sql = readMigrationFile()
    const statements = splitStatements(sql)
    const updateStatements = statements.filter((s) => s.toUpperCase().trimStart().startsWith('UPDATE'))

    // 验证每条 UPDATE 的 WHERE 子句同时包含角色名匹配和 IS NULL 检查
    for (const stmt of updateStatements) {
      const upper = stmt.toUpperCase()
      expect(upper).toContain('WHERE')
      expect(upper).toContain('IS NULL')
    }
  })
})

// ============ 4. 权限值正确性 ============

describe('权限值正确性', () => {
  it('super_admin 的 learningCenter 应包含 read, write, admin', () => {
    const sql = readMigrationFile()
    const statements = splitStatements(sql)
    const superAdminLcStatements = findStatementsForRole(statements, 'super_admin').filter((s) =>
      s.includes('learningCenter')
    )

    expect(superAdminLcStatements.length).toBeGreaterThan(0)

    // 权限值中应包含全部三个权限
    const combined = superAdminLcStatements.join(' ')
    expect(combined).toContain('read')
    expect(combined).toContain('write')
    expect(combined).toContain('admin')
  })

  it('admin 的 learningCenter 应包含 read, write, admin', () => {
    const sql = readMigrationFile()
    const statements = splitStatements(sql)
    const adminLcStatements = findStatementsForRole(statements, 'admin').filter((s) => s.includes('learningCenter'))

    expect(adminLcStatements.length).toBeGreaterThan(0)

    const combined = adminLcStatements.join(' ')
    expect(combined).toContain('read')
    expect(combined).toContain('write')
    expect(combined).toContain('admin')
  })

  it('manager 的 learningCenter 应仅包含 read', () => {
    const sql = readMigrationFile()
    const statements = splitStatements(sql)
    const managerLcStatements = findStatementsForRole(statements, 'manager').filter((s) => s.includes('learningCenter'))

    expect(managerLcStatements.length).toBeGreaterThan(0)

    const combined = managerLcStatements.join(' ')
    expect(combined).toContain('read')

    // 提取 learningCenter 对应的 JSON 值，验证不包含 write 和 admin
    // 通过正则提取 learningCenter 后的 JSON 数组
    const lcValueMatch = combined.match(/learningCenter['"]*\s*[:,]\s*(\[[^\]]*\])/i)
    if (lcValueMatch) {
      const lcValue = lcValueMatch[1]
      expect(lcValue).not.toContain('write')
      expect(lcValue).not.toContain('admin')
    }
  })

  it('user 的 learningCenter 应仅包含 read', () => {
    const sql = readMigrationFile()
    const statements = splitStatements(sql)
    const userLcStatements = findStatementsForRole(statements, 'user').filter((s) => s.includes('learningCenter'))

    expect(userLcStatements.length).toBeGreaterThan(0)

    const combined = userLcStatements.join(' ')
    expect(combined).toContain('read')

    // 验证不包含超额权限
    const lcValueMatch = combined.match(/learningCenter['"]*\s*[:,]\s*(\[[^\]]*\])/i)
    if (lcValueMatch) {
      const lcValue = lcValueMatch[1]
      expect(lcValue).not.toContain('write')
      expect(lcValue).not.toContain('admin')
    }
  })

  it('assistantPresets 补齐应包含 read, write, admin', () => {
    const sql = readMigrationFile()
    const statements = splitStatements(sql)

    // 找到 assistantPresets 相关的 UPDATE 语句
    const apStatements = statements.filter((s) => {
      const upper = s.toUpperCase()
      return upper.includes('UPDATE') && s.includes('assistantPresets')
    })

    expect(apStatements.length).toBeGreaterThan(0)

    const combined = apStatements.join(' ')
    expect(combined).toContain('read')
    expect(combined).toContain('write')
    expect(combined).toContain('admin')
  })

  it('assistantPresets 补齐应覆盖 super_admin 和 admin 角色', () => {
    const sql = readMigrationFile()
    const statements = splitStatements(sql)

    // super_admin 应有 assistantPresets 语句
    const superAdminAp = findStatementsForRole(statements, 'super_admin').filter((s) => s.includes('assistantPresets'))
    expect(superAdminAp.length).toBeGreaterThan(0)

    // admin 应有 assistantPresets 语句
    const adminAp = findStatementsForRole(statements, 'admin').filter((s) => s.includes('assistantPresets'))
    expect(adminAp.length).toBeGreaterThan(0)
  })
})

// ============ 5. SQL 安全性 ============

describe('SQL 安全性', () => {
  it('不应包含 DROP 语句', () => {
    const sql = readMigrationFile()
    const upper = sql.toUpperCase()
    expect(upper).not.toContain('DROP TABLE')
    expect(upper).not.toContain('DROP INDEX')
    expect(upper).not.toContain('DROP COLUMN')
  })

  it('不应包含 DELETE FROM roles', () => {
    const sql = readMigrationFile()
    const upper = sql.toUpperCase()

    // 不允许 DELETE FROM roles（可能删除角色数据）
    expect(upper).not.toMatch(/DELETE\s+FROM\s+ROLES/i)
  })

  it('不应包含 TRUNCATE 语句', () => {
    const sql = readMigrationFile()
    const upper = sql.toUpperCase()
    expect(upper).not.toContain('TRUNCATE')
  })

  it('不应使用字符串拼接方式构造 SQL（防止注入风险）', () => {
    const sql = readMigrationFile()

    // 不应包含 EXECUTE 或 EXEC（动态 SQL 构造）
    const upper = sql.toUpperCase()
    expect(upper).not.toMatch(/\bEXECUTE\b/)
    expect(upper).not.toMatch(/\bEXEC\b/)
  })

  it('不应修改表结构（ALTER TABLE）', () => {
    const sql = readMigrationFile()
    const upper = sql.toUpperCase()

    // 此迁移仅做数据更新，不应修改表结构
    expect(upper).not.toContain('ALTER TABLE')
  })

  it('不应包含危险的全表更新（UPDATE 无 WHERE 子句）', () => {
    const sql = readMigrationFile()
    const statements = splitStatements(sql)
    const updateStatements = statements.filter((s) => s.toUpperCase().trimStart().startsWith('UPDATE'))

    for (const stmt of updateStatements) {
      // 每条 UPDATE 必须包含 WHERE 子句
      expect(stmt.toUpperCase()).toContain('WHERE')
    }
  })

  it('只应使用 UPDATE 操作，不应包含 INSERT 或 CREATE', () => {
    const sql = readMigrationFile()
    const statements = splitStatements(sql)

    // 过滤掉注释行
    const executableStatements = statements.filter((s) => {
      const trimmed = s.trim()
      return !trimmed.startsWith('--')
    })

    for (const stmt of executableStatements) {
      const upper = stmt.toUpperCase().trim()
      // 跳过纯注释块
      if (upper.startsWith('--')) continue
      // 应只包含 UPDATE 语句
      expect(upper).toMatch(/^(--|UPDATE)/i)
    }
  })
})

// ============ 6. 语句完整性 ============

describe('语句完整性', () => {
  it('应至少包含 6 条 UPDATE 语句（4 个角色 x learningCenter + 2 个角色 x assistantPresets）', () => {
    const sql = readMigrationFile()
    const statements = splitStatements(sql)
    const updateStatements = statements.filter((s) => s.toUpperCase().trimStart().startsWith('UPDATE'))

    // 4 条 learningCenter（super_admin, admin, manager, user）
    // + 2 条 assistantPresets（super_admin, admin）
    // = 最少 6 条
    expect(updateStatements.length).toBeGreaterThanOrEqual(6)
  })

  it('每条 UPDATE 语句都应以 WHERE 子句结束（含角色名和 IS NULL 条件）', () => {
    const sql = readMigrationFile()
    const statements = splitStatements(sql)
    const updateStatements = statements.filter((s) => s.toUpperCase().trimStart().startsWith('UPDATE'))

    for (const stmt of updateStatements) {
      const upper = stmt.toUpperCase()
      // WHERE 子句应包含角色名过滤
      expect(upper).toContain('WHERE')
      // 应通过 name 字段匹配角色
      expect(stmt.toLowerCase()).toContain('name')
    }
  })

  it('涉及的角色名应为已定义的系统角色', () => {
    const sql = readMigrationFile()
    const validRoles = ['super_admin', 'admin', 'manager', 'user']

    // 提取 SQL 中引用的角色名
    const roleMatches = sql.match(/name\s*=\s*'([^']+)'/gi)
    expect(roleMatches).not.toBeNull()

    if (roleMatches) {
      for (const match of roleMatches) {
        const roleName = match.match(/name\s*=\s*'([^']+)'/i)?.[1]
        expect(roleName).toBeDefined()
        if (roleName) {
          expect(validRoles).toContain(roleName)
        }
      }
    }
  })
})
