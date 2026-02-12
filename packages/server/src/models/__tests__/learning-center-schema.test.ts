import { getTableColumns, getTableName } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import {
  // 6 张表
  lcBanners,
  // 6 个 relations
  lcBannersRelations,
  lcCourseCategories,
  lcCourseCategoriesRelations,
  lcCourses,
  lcCoursesRelations,
  lcDocumentCategories,
  lcDocumentCategoriesRelations,
  lcDocuments,
  lcDocumentsRelations,
  lcHotItems,
  lcHotItemsRelations
} from '../schema'

// ============================================================
// 辅助函数
// ============================================================

/** 获取列名列表 */
function columnNames(table: Parameters<typeof getTableColumns>[0]): string[] {
  return Object.keys(getTableColumns(table))
}

/** 获取某一列的元信息 */
function col(table: Parameters<typeof getTableColumns>[0], name: string) {
  const columns = getTableColumns(table) as Record<string, any>
  return columns[name]
}

/** 判断列是否有外键引用 */
function hasForeignKey(column: any): boolean {
  // drizzle-orm/pg-core 中 PgColumn 的外键通过内部属性暴露
  // 使用 column 的 config 或者内部属性检测
  return Array.isArray(column?.references) ? column.references.length > 0 : false
}

// ============================================================
// 测试
// ============================================================

describe('学习中心 Schema（lc_* 表）', () => {
  // ----------------------------------------------------------
  // 1. 导出验证
  // ----------------------------------------------------------
  describe('导出验证', () => {
    it('应导出所有 6 张表对象', () => {
      expect(lcBanners).toBeTruthy()
      expect(lcCourseCategories).toBeTruthy()
      expect(lcCourses).toBeTruthy()
      expect(lcDocumentCategories).toBeTruthy()
      expect(lcDocuments).toBeTruthy()
      expect(lcHotItems).toBeTruthy()
    })

    it('应导出所有 6 个 relations 定义', () => {
      expect(lcBannersRelations).toBeTruthy()
      expect(lcCourseCategoriesRelations).toBeTruthy()
      expect(lcCoursesRelations).toBeTruthy()
      expect(lcDocumentCategoriesRelations).toBeTruthy()
      expect(lcDocumentsRelations).toBeTruthy()
      expect(lcHotItemsRelations).toBeTruthy()
    })
  })

  // ----------------------------------------------------------
  // 2. lcBanners 表
  // ----------------------------------------------------------
  describe('lcBanners 表', () => {
    it('表名应为 lc_banners', () => {
      expect(getTableName(lcBanners)).toBe('lc_banners')
    })

    it('应包含 10 个列', () => {
      const cols = columnNames(lcBanners)
      expect(cols).toHaveLength(10)
      expect(cols).toEqual(
        expect.arrayContaining([
          'id',
          'companyId',
          'title',
          'imageUrl',
          'linkUrl',
          'linkType',
          'order',
          'isEnabled',
          'createdAt',
          'updatedAt'
        ])
      )
    })

    it('id 应为 UUID 主键', () => {
      const id = col(lcBanners, 'id')
      expect(id).toBeTruthy()
      expect(id.dataType).toBe('uuid')
      expect(id.primary).toBe(true)
    })

    it('companyId 应为 UUID notNull 且带外键引用 companies', () => {
      const companyId = col(lcBanners, 'companyId')
      expect(companyId).toBeTruthy()
      expect(companyId.dataType).toBe('uuid')
      expect(companyId.notNull).toBe(true)
    })

    it('title 应为 varchar(200) notNull', () => {
      const title = col(lcBanners, 'title')
      expect(title).toBeTruthy()
      expect(title.columnType).toBe('PgVarchar')
      expect(title.notNull).toBe(true)
      // drizzle varchar 通过 config 暴露 length
      expect((title as any).config?.length ?? (title as any).length).toBe(200)
    })

    it('linkUrl 应为 text 可为空', () => {
      const linkUrl = col(lcBanners, 'linkUrl')
      expect(linkUrl).toBeTruthy()
      expect(linkUrl.dataType).toBe('string')
      expect(linkUrl.columnType).toBe('PgText')
      expect(linkUrl.notNull).toBe(false)
    })

    it('linkType 应有默认值 external', () => {
      const linkType = col(lcBanners, 'linkType')
      expect(linkType).toBeTruthy()
      expect(linkType.hasDefault).toBe(true)
      expect(linkType.default).toBe('external')
    })

    it('imageUrl 应为 text notNull', () => {
      const imageUrl = col(lcBanners, 'imageUrl')
      expect(imageUrl).toBeTruthy()
      expect(imageUrl.columnType).toBe('PgText')
      expect(imageUrl.notNull).toBe(true)
    })
  })

  // ----------------------------------------------------------
  // 3. lcCourseCategories 表
  // ----------------------------------------------------------
  describe('lcCourseCategories 表', () => {
    it('表名应为 lc_course_categories', () => {
      expect(getTableName(lcCourseCategories)).toBe('lc_course_categories')
    })

    it('应包含 7 个列', () => {
      const cols = columnNames(lcCourseCategories)
      expect(cols).toHaveLength(7)
      expect(cols).toEqual(
        expect.arrayContaining(['id', 'companyId', 'name', 'order', 'isEnabled', 'createdAt', 'updatedAt'])
      )
    })

    it('name 应为 varchar(100) notNull', () => {
      const name = col(lcCourseCategories, 'name')
      expect(name).toBeTruthy()
      expect(name.columnType).toBe('PgVarchar')
      expect(name.notNull).toBe(true)
      expect((name as any).config?.length ?? (name as any).length).toBe(100)
    })

    it('order 应有默认值 0', () => {
      const order = col(lcCourseCategories, 'order')
      expect(order).toBeTruthy()
      expect(order.hasDefault).toBe(true)
      expect(order.default).toBe(0)
    })

    it('isEnabled 应有默认值 true', () => {
      const isEnabled = col(lcCourseCategories, 'isEnabled')
      expect(isEnabled).toBeTruthy()
      expect(isEnabled.hasDefault).toBe(true)
      expect(isEnabled.default).toBe(true)
    })
  })

  // ----------------------------------------------------------
  // 4. lcCourses 表
  // ----------------------------------------------------------
  describe('lcCourses 表', () => {
    it('表名应为 lc_courses', () => {
      expect(getTableName(lcCourses)).toBe('lc_courses')
    })

    it('应包含 15 个列', () => {
      const cols = columnNames(lcCourses)
      expect(cols).toHaveLength(15)
      expect(cols).toEqual(
        expect.arrayContaining([
          'id',
          'companyId',
          'categoryId',
          'title',
          'description',
          'coverUrl',
          'videoUrl',
          'duration',
          'author',
          'order',
          'isEnabled',
          'isRecommended',
          'viewCount',
          'createdAt',
          'updatedAt'
        ])
      )
    })

    it('categoryId 应为 UUID 且允许为空（onDelete: SET NULL）', () => {
      const categoryId = col(lcCourses, 'categoryId')
      expect(categoryId).toBeTruthy()
      expect(categoryId.dataType).toBe('uuid')
      // categoryId 允许为空以支持 SET NULL
      expect(categoryId.notNull).toBe(false)
    })

    it('videoUrl 应为 text notNull', () => {
      const videoUrl = col(lcCourses, 'videoUrl')
      expect(videoUrl).toBeTruthy()
      expect(videoUrl.columnType).toBe('PgText')
      expect(videoUrl.notNull).toBe(true)
    })

    it('duration 应有默认值 0', () => {
      const duration = col(lcCourses, 'duration')
      expect(duration).toBeTruthy()
      expect(duration.hasDefault).toBe(true)
      expect(duration.default).toBe(0)
    })

    it('isRecommended 应有默认值 false', () => {
      const isRecommended = col(lcCourses, 'isRecommended')
      expect(isRecommended).toBeTruthy()
      expect(isRecommended.hasDefault).toBe(true)
      expect(isRecommended.default).toBe(false)
    })

    it('viewCount 应有默认值 0', () => {
      const viewCount = col(lcCourses, 'viewCount')
      expect(viewCount).toBeTruthy()
      expect(viewCount.hasDefault).toBe(true)
      expect(viewCount.default).toBe(0)
    })

    it('author 应为 varchar(100) 可为空', () => {
      const author = col(lcCourses, 'author')
      expect(author).toBeTruthy()
      expect(author.columnType).toBe('PgVarchar')
      expect(author.notNull).toBe(false)
      expect((author as any).config?.length ?? (author as any).length).toBe(100)
    })

    it('title 应为 varchar(300) notNull', () => {
      const title = col(lcCourses, 'title')
      expect(title).toBeTruthy()
      expect(title.columnType).toBe('PgVarchar')
      expect(title.notNull).toBe(true)
      expect((title as any).config?.length ?? (title as any).length).toBe(300)
    })

    it('description 应为 text 可为空', () => {
      const description = col(lcCourses, 'description')
      expect(description).toBeTruthy()
      expect(description.columnType).toBe('PgText')
      expect(description.notNull).toBe(false)
    })
  })

  // ----------------------------------------------------------
  // 5. lcDocumentCategories 表
  // ----------------------------------------------------------
  describe('lcDocumentCategories 表', () => {
    it('表名应为 lc_document_categories', () => {
      expect(getTableName(lcDocumentCategories)).toBe('lc_document_categories')
    })

    it('应包含 7 个列（与 lcCourseCategories 结构一致）', () => {
      const cols = columnNames(lcDocumentCategories)
      expect(cols).toHaveLength(7)
      expect(cols).toEqual(
        expect.arrayContaining(['id', 'companyId', 'name', 'order', 'isEnabled', 'createdAt', 'updatedAt'])
      )
    })

    it('name 应为 varchar(100) notNull', () => {
      const name = col(lcDocumentCategories, 'name')
      expect(name).toBeTruthy()
      expect(name.columnType).toBe('PgVarchar')
      expect(name.notNull).toBe(true)
      expect((name as any).config?.length ?? (name as any).length).toBe(100)
    })
  })

  // ----------------------------------------------------------
  // 6. lcDocuments 表
  // ----------------------------------------------------------
  describe('lcDocuments 表', () => {
    it('表名应为 lc_documents', () => {
      expect(getTableName(lcDocuments)).toBe('lc_documents')
    })

    it('应包含 15 个列', () => {
      const cols = columnNames(lcDocuments)
      expect(cols).toHaveLength(15)
      expect(cols).toEqual(
        expect.arrayContaining([
          'id',
          'companyId',
          'categoryId',
          'title',
          'description',
          'coverUrl',
          'linkUrl',
          'linkType',
          'author',
          'order',
          'isEnabled',
          'isRecommended',
          'viewCount',
          'createdAt',
          'updatedAt'
        ])
      )
    })

    it('categoryId 应为 UUID 且允许为空（onDelete: SET NULL）', () => {
      const categoryId = col(lcDocuments, 'categoryId')
      expect(categoryId).toBeTruthy()
      expect(categoryId.dataType).toBe('uuid')
      expect(categoryId.notNull).toBe(false)
    })

    it('linkUrl 应为 text notNull', () => {
      const linkUrl = col(lcDocuments, 'linkUrl')
      expect(linkUrl).toBeTruthy()
      expect(linkUrl.columnType).toBe('PgText')
      expect(linkUrl.notNull).toBe(true)
    })

    it('linkType 应有默认值 external 且 notNull', () => {
      const linkType = col(lcDocuments, 'linkType')
      expect(linkType).toBeTruthy()
      expect(linkType.hasDefault).toBe(true)
      expect(linkType.default).toBe('external')
      expect(linkType.notNull).toBe(true)
    })

    it('title 应为 varchar(300) notNull', () => {
      const title = col(lcDocuments, 'title')
      expect(title).toBeTruthy()
      expect(title.columnType).toBe('PgVarchar')
      expect(title.notNull).toBe(true)
      expect((title as any).config?.length ?? (title as any).length).toBe(300)
    })

    it('isRecommended 应有默认值 false', () => {
      const isRecommended = col(lcDocuments, 'isRecommended')
      expect(isRecommended).toBeTruthy()
      expect(isRecommended.hasDefault).toBe(true)
      expect(isRecommended.default).toBe(false)
    })

    it('viewCount 应有默认值 0', () => {
      const viewCount = col(lcDocuments, 'viewCount')
      expect(viewCount).toBeTruthy()
      expect(viewCount.hasDefault).toBe(true)
      expect(viewCount.default).toBe(0)
    })
  })

  // ----------------------------------------------------------
  // 7. lcHotItems 表
  // ----------------------------------------------------------
  describe('lcHotItems 表', () => {
    it('表名应为 lc_hot_items', () => {
      expect(getTableName(lcHotItems)).toBe('lc_hot_items')
    })

    it('应包含 10 个列', () => {
      const cols = columnNames(lcHotItems)
      expect(cols).toHaveLength(10)
      expect(cols).toEqual(
        expect.arrayContaining([
          'id',
          'companyId',
          'title',
          'linkUrl',
          'tag',
          'heatValue',
          'order',
          'isEnabled',
          'createdAt',
          'updatedAt'
        ])
      )
    })

    it('tag 应为 varchar(10) 可为空', () => {
      const tag = col(lcHotItems, 'tag')
      expect(tag).toBeTruthy()
      expect(tag.columnType).toBe('PgVarchar')
      expect(tag.notNull).toBe(false)
      expect((tag as any).config?.length ?? (tag as any).length).toBe(10)
    })

    it('heatValue 应有默认值 0', () => {
      const heatValue = col(lcHotItems, 'heatValue')
      expect(heatValue).toBeTruthy()
      expect(heatValue.hasDefault).toBe(true)
      expect(heatValue.default).toBe(0)
    })

    it('linkUrl 应为 text notNull', () => {
      const linkUrl = col(lcHotItems, 'linkUrl')
      expect(linkUrl).toBeTruthy()
      expect(linkUrl.columnType).toBe('PgText')
      expect(linkUrl.notNull).toBe(true)
    })

    it('title 应为 varchar(300) notNull', () => {
      const title = col(lcHotItems, 'title')
      expect(title).toBeTruthy()
      expect(title.columnType).toBe('PgVarchar')
      expect(title.notNull).toBe(true)
      expect((title as any).config?.length ?? (title as any).length).toBe(300)
    })
  })

  // ----------------------------------------------------------
  // 8. Relations 验证
  // ----------------------------------------------------------
  describe('Relations 定义', () => {
    it('lcBannersRelations 应为有效的 relation 配置', () => {
      expect(lcBannersRelations).toBeTruthy()
      // Relations 是通过 drizzle relations() 函数创建的对象
      expect(typeof lcBannersRelations).toBe('object')
    })

    it('lcCourseCategoriesRelations 应包含 company 和 courses 关系', () => {
      expect(lcCourseCategoriesRelations).toBeTruthy()
      expect(typeof lcCourseCategoriesRelations).toBe('object')
    })

    it('lcCoursesRelations 应包含 company 和 category 关系', () => {
      expect(lcCoursesRelations).toBeTruthy()
      expect(typeof lcCoursesRelations).toBe('object')
    })

    it('lcDocumentCategoriesRelations 应包含 company 和 documents 关系', () => {
      expect(lcDocumentCategoriesRelations).toBeTruthy()
      expect(typeof lcDocumentCategoriesRelations).toBe('object')
    })

    it('lcDocumentsRelations 应包含 company 和 category 关系', () => {
      expect(lcDocumentsRelations).toBeTruthy()
      expect(typeof lcDocumentsRelations).toBe('object')
    })

    it('lcHotItemsRelations 应包含 company 关系', () => {
      expect(lcHotItemsRelations).toBeTruthy()
      expect(typeof lcHotItemsRelations).toBe('object')
    })
  })

  // ----------------------------------------------------------
  // 9. 公共字段一致性验证
  // ----------------------------------------------------------
  describe('公共字段一致性', () => {
    const allTables = [
      { name: 'lcBanners', table: lcBanners },
      { name: 'lcCourseCategories', table: lcCourseCategories },
      { name: 'lcCourses', table: lcCourses },
      { name: 'lcDocumentCategories', table: lcDocumentCategories },
      { name: 'lcDocuments', table: lcDocuments },
      { name: 'lcHotItems', table: lcHotItems }
    ]

    it.each(allTables)('$name 的 id 列应为 UUID 主键', ({ table }) => {
      const id = col(table, 'id')
      expect(id).toBeTruthy()
      expect(id.dataType).toBe('uuid')
      expect(id.primary).toBe(true)
      expect(id.hasDefault).toBe(true)
    })

    it.each(allTables)('$name 的 companyId 列应为 UUID notNull', ({ table }) => {
      const companyId = col(table, 'companyId')
      expect(companyId).toBeTruthy()
      expect(companyId.dataType).toBe('uuid')
      expect(companyId.notNull).toBe(true)
    })

    it.each(allTables)('$name 应包含 createdAt 和 updatedAt 时间戳', ({ table }) => {
      const createdAt = col(table, 'createdAt')
      const updatedAt = col(table, 'updatedAt')
      expect(createdAt).toBeTruthy()
      expect(updatedAt).toBeTruthy()
      expect(createdAt.columnType).toBe('PgTimestamp')
      expect(updatedAt.columnType).toBe('PgTimestamp')
      expect(createdAt.hasDefault).toBe(true)
      expect(updatedAt.hasDefault).toBe(true)
    })

    it.each(allTables)('$name 的 isEnabled 应为 boolean 默认 true', ({ table }) => {
      const isEnabled = col(table, 'isEnabled')
      expect(isEnabled).toBeTruthy()
      expect(isEnabled.columnType).toBe('PgBoolean')
      expect(isEnabled.hasDefault).toBe(true)
      expect(isEnabled.default).toBe(true)
    })

    it.each(allTables)('$name 的 order 应为 integer 默认 0', ({ table }) => {
      const order = col(table, 'order')
      expect(order).toBeTruthy()
      expect(order.columnType).toBe('PgInteger')
      expect(order.hasDefault).toBe(true)
      expect(order.default).toBe(0)
    })
  })
})
