# Learning Center Portal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为雅迪企业版构建"学习中心"门户页面，包含宣传位统计、轮播 Banner、精选视频课/知识文档（分类浏览）、热搜要闻版块。支持 Admin 后台管理和客户端展示。

**Architecture:** 全栈开发——6 张 PostgreSQL 新表（Drizzle ORM）→ 共享类型层（enterprise-shared）→ Express 5 CRUD + 聚合 API → Admin 管理面板（React 18 + Ant Design）→ Electron 客户端展示页面。采用 SET NULL 级联策略保护数据安全。

**Tech Stack:** Drizzle ORM + PostgreSQL, Express 5, Zod 验证, React 18, Ant Design 5, Tailwind CSS 4, Redux Persist 迁移, lucide-react 图标

---

## Task 1: 共享类型层 — 学习中心类型定义

**Files:**
- Create: `packages/enterprise-shared/src/types/learning-center.ts`
- Modify: `packages/enterprise-shared/src/types/index.ts` (L87-94: RolePermissions 接口)
- Modify: `packages/enterprise-shared/src/index.ts` (导出)

**Step 1: 创建学习中心类型文件**

```typescript
// packages/enterprise-shared/src/types/learning-center.ts
import type { BaseEntity } from './index'

// ============ 学习中心 Banner ============

export interface LcBanner extends BaseEntity {
  companyId: string
  title: string
  imageUrl: string
  linkUrl?: string
  linkType?: 'internal' | 'external'
  order: number
  isEnabled: boolean
}

// ============ 课程相关 ============

export interface LcCourseCategory extends BaseEntity {
  companyId: string
  name: string
  order: number
  isEnabled: boolean
}

export interface LcCourse extends BaseEntity {
  companyId: string
  categoryId?: string // SET NULL on category delete
  title: string
  description?: string
  coverUrl?: string
  videoUrl: string
  duration: number // seconds
  author?: string
  order: number
  isEnabled: boolean
  isRecommended: boolean
  viewCount: number
}

// ============ 文档相关 ============

export interface LcDocumentCategory extends BaseEntity {
  companyId: string
  name: string
  order: number
  isEnabled: boolean
}

export interface LcDocument extends BaseEntity {
  companyId: string
  categoryId?: string // SET NULL on category delete
  title: string
  description?: string
  coverUrl?: string
  linkUrl: string
  linkType: 'internal' | 'external'
  author?: string
  order: number
  isEnabled: boolean
  isRecommended: boolean
  viewCount: number
}

// ============ 热搜要闻 ============

export interface LcHotItem extends BaseEntity {
  companyId: string
  title: string
  linkUrl: string
  tag?: 'hot' | 'new'
  heatValue: number // 万
  order: number
  isEnabled: boolean
}

// ============ 客户端聚合响应 ============

export interface LcCategoryWithCourses extends LcCourseCategory {
  courses: LcCourse[]
}

export interface LcCategoryWithDocuments extends LcDocumentCategory {
  documents: LcDocument[]
}

export interface LcStats {
  totalCourses: number
  totalDocuments: number
  totalViews: number
}

export interface LcClientData {
  banners: LcBanner[]
  courseCategories: LcCategoryWithCourses[]
  documentCategories: LcCategoryWithDocuments[]
  hotItems: LcHotItem[]
  stats: LcStats
}
```

**Step 2: 更新 RolePermissions 接口**

在 `packages/enterprise-shared/src/types/index.ts` 第 94 行 `assistantPresets` 后添加（**必须可选**，兼容旧数据）：

```typescript
// 在 RolePermissions 接口闭合大括号前添加：
export type LearningCenterPermission = 'read' | 'write' | 'admin'

// RolePermissions 接口新增第 7 个字段：
export interface RolePermissions {
  models: ModelPermission[]
  knowledgeBases: KnowledgeBasePermission[]
  users: UserPermission[]
  statistics: StatisticsPermission[]
  system: SystemPermission[]
  assistantPresets: AssistantPresetPermission[]
  learningCenter?: LearningCenterPermission[]  // ← 可选
}
```

**Step 3: 更新 index.ts 导出**

在 `packages/enterprise-shared/src/index.ts` 添加：

```typescript
export * from './types/learning-center'
```

**Step 4: 运行类型检查验证**

Run: `cd /Users/yadea/Documents/pythonWorkSpace/cherry-studio && pnpm typecheck`
Expected: PASS（新类型不影响任何现有代码）

**Step 5: Commit**

```bash
git add packages/enterprise-shared/src/types/learning-center.ts packages/enterprise-shared/src/types/index.ts packages/enterprise-shared/src/index.ts
git commit --signoff -m "feat: add learning center types and permission type to enterprise-shared"
```

---

## Task 2: 共享 Schema 层 — Zod 验证 Schema

**Files:**
- Create: `packages/enterprise-shared/src/schemas/learning-center.ts`
- Modify: `packages/enterprise-shared/src/schemas/index.ts` (L4: 添加导出)

**Step 1: 创建学习中心 Zod Schema 文件**

```typescript
// packages/enterprise-shared/src/schemas/learning-center.ts
import * as z from 'zod'

// ============ 通用 ============

export const lcIdParamSchema = z.object({
  id: z.string().uuid('无效的 ID 格式')
})

export const lcPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
})

// ============ Banner Schema ============

export const createBannerSchema = z.object({
  title: z.string().min(1).max(200),
  imageUrl: z.string().url(),
  linkUrl: z.string().url().optional(),
  linkType: z.enum(['internal', 'external']).default('external').optional(),
  order: z.number().int().min(0).default(0),
  isEnabled: z.boolean().default(true)
})

export const updateBannerSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  imageUrl: z.string().url().optional(),
  linkUrl: z.string().url().nullable().optional(),
  linkType: z.enum(['internal', 'external']).nullable().optional(),
  order: z.number().int().min(0).optional(),
  isEnabled: z.boolean().optional()
})

// ============ 课程分类 Schema ============

export const createCourseCategorySchema = z.object({
  name: z.string().min(1).max(100),
  order: z.number().int().min(0).default(0),
  isEnabled: z.boolean().default(true)
})

export const updateCourseCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  order: z.number().int().min(0).optional(),
  isEnabled: z.boolean().optional()
})

// ============ 课程 Schema ============

export const createCourseSchema = z.object({
  categoryId: z.string().uuid().optional(),
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  coverUrl: z.string().url().optional(),
  videoUrl: z.string().url(),
  duration: z.number().int().min(0).default(0),
  author: z.string().max(100).optional(),
  order: z.number().int().min(0).default(0),
  isEnabled: z.boolean().default(true),
  isRecommended: z.boolean().default(false)
})

export const updateCourseSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(2000).nullable().optional(),
  coverUrl: z.string().url().nullable().optional(),
  videoUrl: z.string().url().optional(),
  duration: z.number().int().min(0).optional(),
  author: z.string().max(100).nullable().optional(),
  order: z.number().int().min(0).optional(),
  isEnabled: z.boolean().optional(),
  isRecommended: z.boolean().optional()
})

export const courseQuerySchema = lcPaginationSchema.extend({
  categoryId: z.string().uuid().optional(),
  uncategorized: z.coerce.boolean().optional() // categoryId IS NULL 筛选
})

// ============ 文档分类 Schema ============

export const createDocumentCategorySchema = z.object({
  name: z.string().min(1).max(100),
  order: z.number().int().min(0).default(0),
  isEnabled: z.boolean().default(true)
})

export const updateDocumentCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  order: z.number().int().min(0).optional(),
  isEnabled: z.boolean().optional()
})

// ============ 文档 Schema ============

export const createDocumentSchema = z.object({
  categoryId: z.string().uuid().optional(),
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  coverUrl: z.string().url().optional(),
  linkUrl: z.string().url(),
  linkType: z.enum(['internal', 'external']).default('external'),
  author: z.string().max(100).optional(),
  order: z.number().int().min(0).default(0),
  isEnabled: z.boolean().default(true),
  isRecommended: z.boolean().default(false)
})

export const updateDocumentSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(2000).nullable().optional(),
  coverUrl: z.string().url().nullable().optional(),
  linkUrl: z.string().url().optional(),
  linkType: z.enum(['internal', 'external']).optional(),
  author: z.string().max(100).nullable().optional(),
  order: z.number().int().min(0).optional(),
  isEnabled: z.boolean().optional(),
  isRecommended: z.boolean().optional()
})

export const documentQuerySchema = lcPaginationSchema.extend({
  categoryId: z.string().uuid().optional(),
  uncategorized: z.coerce.boolean().optional()
})

// ============ 热搜 Schema ============

export const createHotItemSchema = z.object({
  title: z.string().min(1).max(300),
  linkUrl: z.string().url(),
  tag: z.enum(['hot', 'new']).optional(),
  heatValue: z.number().int().min(0).default(0),
  order: z.number().int().min(0).default(0),
  isEnabled: z.boolean().default(true)
})

export const updateHotItemSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  linkUrl: z.string().url().optional(),
  tag: z.enum(['hot', 'new']).nullable().optional(),
  heatValue: z.number().int().min(0).optional(),
  order: z.number().int().min(0).optional(),
  isEnabled: z.boolean().optional()
})

// ============ 客户端热搜"换一批"参数 ============

export const hotItemsRefreshQuerySchema = z.object({
  exclude: z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return []
      const ids = v.split(',').filter(Boolean)
      for (const id of ids) {
        if (!z.string().uuid().safeParse(id).success) {
          throw new Error(`Invalid UUID in exclude: ${id}`)
        }
      }
      return ids
    })
})

// ============ 导出类型 ============

export type CreateBannerInput = z.infer<typeof createBannerSchema>
export type UpdateBannerInput = z.infer<typeof updateBannerSchema>
export type CreateCourseCategoryInput = z.infer<typeof createCourseCategorySchema>
export type UpdateCourseCategoryInput = z.infer<typeof updateCourseCategorySchema>
export type CreateCourseInput = z.infer<typeof createCourseSchema>
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>
export type CreateDocumentCategoryInput = z.infer<typeof createDocumentCategorySchema>
export type UpdateDocumentCategoryInput = z.infer<typeof updateDocumentCategorySchema>
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>
export type CreateHotItemInput = z.infer<typeof createHotItemSchema>
export type UpdateHotItemInput = z.infer<typeof updateHotItemSchema>
```

**Step 2: 更新 schemas/index.ts 导出**

在 `packages/enterprise-shared/src/schemas/index.ts` 第 4 行后添加：

```typescript
export * from './learning-center'
```

**Step 3: 运行类型检查**

Run: `cd /Users/yadea/Documents/pythonWorkSpace/cherry-studio && pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/enterprise-shared/src/schemas/learning-center.ts packages/enterprise-shared/src/schemas/index.ts
git commit --signoff -m "feat: add learning center Zod validation schemas"
```

---

## Task 3: 共享常量层 — API 路由 + 权限默认值 + Banner 限制

**Files:**
- Modify: `packages/enterprise-shared/src/constants/index.ts` (API_ROUTES L97, DEFAULT_ROLE_PERMISSIONS L197-230)
- Modify: `packages/enterprise-shared/src/schemas/index.ts` (rolePermissionsSchema L69-76)

**Step 1: 更新 API_ROUTES — 添加 LEARNING_CENTER 段**

在 `packages/enterprise-shared/src/constants/index.ts` 第 96-97 行 `ASSISTANT_PRESETS` 闭合大括号后、`} as const` 前添加：

```typescript
  // 学习中心
  LEARNING_CENTER: {
    BASE: '/learning-center',
    CLIENT: '/learning-center/client',
    CLIENT_HOT_ITEMS: '/learning-center/client/hot-items',
    BANNERS: '/learning-center/banners',
    BANNER_BY_ID: (id: string) => `/learning-center/banners/${id}`,
    BANNER_UPLOAD: '/learning-center/banners/upload',
    COURSE_CATEGORIES: '/learning-center/course-categories',
    COURSE_CATEGORY_BY_ID: (id: string) => `/learning-center/course-categories/${id}`,
    COURSES: '/learning-center/courses',
    COURSE_BY_ID: (id: string) => `/learning-center/courses/${id}`,
    DOCUMENT_CATEGORIES: '/learning-center/document-categories',
    DOCUMENT_CATEGORY_BY_ID: (id: string) => `/learning-center/document-categories/${id}`,
    DOCUMENTS: '/learning-center/documents',
    DOCUMENT_BY_ID: (id: string) => `/learning-center/documents/${id}`,
    HOT_ITEMS: '/learning-center/hot-items',
    HOT_ITEM_BY_ID: (id: string) => `/learning-center/hot-items/${id}`
  }
```

**Step 2: 更新 DEFAULT_ROLE_PERMISSIONS — 各角色添加 learningCenter**

在第 197-230 行的每个角色对象末尾添加 `learningCenter` 字段：

```typescript
// SUPER_ADMIN (L204 assistantPresets 后):
learningCenter: ['read', 'write', 'admin']

// ADMIN (L212 assistantPresets 后):
learningCenter: ['read', 'write', 'admin']

// MANAGER (L220 assistantPresets 后):
learningCenter: ['read']

// USER (L228 assistantPresets 后):
learningCenter: ['read']
```

**Step 3: 添加 Banner 图片上传限制常量**

在 `FILE_LIMITS` 常量后（约 L186 后）添加：

```typescript
// Banner 图片上传限制（独立于知识库 FILE_LIMITS）
export const BANNER_IMAGE_LIMITS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
} as const
```

**Step 4: 更新 rolePermissionsSchema — 添加 learningCenter 字段**

在 `packages/enterprise-shared/src/schemas/index.ts` 第 75 行 `assistantPresets` 后添加：

```typescript
  learningCenter: z.array(z.enum(['read', 'write', 'admin'])).default([])
```

**Step 5: 运行类型检查**

Run: `cd /Users/yadea/Documents/pythonWorkSpace/cherry-studio && pnpm typecheck`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/enterprise-shared/src/constants/index.ts packages/enterprise-shared/src/schemas/index.ts
git commit --signoff -m "feat: add learning center API routes, permissions defaults, and banner upload limits"
```

---

## Task 4: 数据库层 — 6 张新表 + Relations

**Files:**
- Modify: `packages/server/src/models/schema.ts` (L681 末尾追加)

**Step 1: 在 schema.ts 末尾添加 6 张 lc_* 表定义**

在文件末尾（第 682 行后）追加：

```typescript
// ============ 学习中心 — Banner 表 ============

export const lcBanners = pgTable(
  'lc_banners',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    imageUrl: text('image_url').notNull(),
    linkUrl: text('link_url'),
    linkType: varchar('link_type', { length: 20 }).default('external'),
    order: integer('order').notNull().default(0),
    isEnabled: boolean('is_enabled').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow()
  },
  (table) => [index('lc_banners_company_id_idx').on(table.companyId)]
)

// ============ 学习中心 — 课程分类表 ============

export const lcCourseCategories = pgTable(
  'lc_course_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    order: integer('order').notNull().default(0),
    isEnabled: boolean('is_enabled').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow()
  },
  (table) => [index('lc_course_categories_company_id_idx').on(table.companyId)]
)

// ============ 学习中心 — 课程表 ============

export const lcCourses = pgTable(
  'lc_courses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => lcCourseCategories.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 300 }).notNull(),
    description: text('description'),
    coverUrl: text('cover_url'),
    videoUrl: text('video_url').notNull(),
    duration: integer('duration').notNull().default(0),
    author: varchar('author', { length: 100 }),
    order: integer('order').notNull().default(0),
    isEnabled: boolean('is_enabled').notNull().default(true),
    isRecommended: boolean('is_recommended').notNull().default(false),
    viewCount: integer('view_count').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow()
  },
  (table) => [
    index('lc_courses_company_id_idx').on(table.companyId),
    index('lc_courses_category_id_idx').on(table.categoryId)
  ]
)

// ============ 学习中心 — 文档分类表 ============

export const lcDocumentCategories = pgTable(
  'lc_document_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    order: integer('order').notNull().default(0),
    isEnabled: boolean('is_enabled').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow()
  },
  (table) => [index('lc_document_categories_company_id_idx').on(table.companyId)]
)

// ============ 学习中心 — 文档表 ============

export const lcDocuments = pgTable(
  'lc_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => lcDocumentCategories.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 300 }).notNull(),
    description: text('description'),
    coverUrl: text('cover_url'),
    linkUrl: text('link_url').notNull(),
    linkType: varchar('link_type', { length: 20 }).notNull().default('external'),
    author: varchar('author', { length: 100 }),
    order: integer('order').notNull().default(0),
    isEnabled: boolean('is_enabled').notNull().default(true),
    isRecommended: boolean('is_recommended').notNull().default(false),
    viewCount: integer('view_count').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow()
  },
  (table) => [
    index('lc_documents_company_id_idx').on(table.companyId),
    index('lc_documents_category_id_idx').on(table.categoryId)
  ]
)

// ============ 学习中心 — 热搜要闻表 ============

export const lcHotItems = pgTable(
  'lc_hot_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 300 }).notNull(),
    linkUrl: text('link_url').notNull(),
    tag: varchar('tag', { length: 10 }),
    heatValue: integer('heat_value').notNull().default(0),
    order: integer('order').notNull().default(0),
    isEnabled: boolean('is_enabled').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow()
  },
  (table) => [index('lc_hot_items_company_id_idx').on(table.companyId)]
)

// ============ 学习中心 — Relations ============

export const lcBannersRelations = relations(lcBanners, ({ one }) => ({
  company: one(companies, {
    fields: [lcBanners.companyId],
    references: [companies.id]
  })
}))

export const lcCourseCategoriesRelations = relations(lcCourseCategories, ({ one, many }) => ({
  company: one(companies, {
    fields: [lcCourseCategories.companyId],
    references: [companies.id]
  }),
  courses: many(lcCourses)
}))

export const lcCoursesRelations = relations(lcCourses, ({ one }) => ({
  company: one(companies, {
    fields: [lcCourses.companyId],
    references: [companies.id]
  }),
  category: one(lcCourseCategories, {
    fields: [lcCourses.categoryId],
    references: [lcCourseCategories.id]
  })
}))

export const lcDocumentCategoriesRelations = relations(lcDocumentCategories, ({ one, many }) => ({
  company: one(companies, {
    fields: [lcDocumentCategories.companyId],
    references: [companies.id]
  }),
  documents: many(lcDocuments)
}))

export const lcDocumentsRelations = relations(lcDocuments, ({ one }) => ({
  company: one(companies, {
    fields: [lcDocuments.companyId],
    references: [companies.id]
  }),
  category: one(lcDocumentCategories, {
    fields: [lcDocuments.categoryId],
    references: [lcDocumentCategories.id]
  })
}))

export const lcHotItemsRelations = relations(lcHotItems, ({ one }) => ({
  company: one(companies, {
    fields: [lcHotItems.companyId],
    references: [companies.id]
  })
}))
```

**Step 2: 生成 Drizzle 迁移**

Run: `cd /Users/yadea/Documents/pythonWorkSpace/cherry-studio/packages/server && pnpm db:generate`
Expected: 生成新的迁移文件包含 6 张 `lc_*` 表

**Step 3: 推送 schema 变更（开发环境）**

Run: `cd /Users/yadea/Documents/pythonWorkSpace/cherry-studio/packages/server && pnpm db:push`
Expected: 成功推送 6 张新表到开发 PostgreSQL

**Step 4: Commit**

```bash
git add packages/server/src/models/schema.ts packages/server/drizzle/
git commit --signoff -m "feat: add 6 learning center database tables with relations"
```

---

## Task 5: SQL 数据迁移 — 已有角色权限补充

**Files:**
- Create: `packages/server/src/migrations/add-learning-center-permissions.sql`

**Step 1: 创建 SQL 迁移脚本**

```sql
-- 为 super_admin / admin 角色补充 learningCenter 完整权限
UPDATE roles
SET permissions = jsonb_set(
  permissions,
  '{learningCenter}',
  '["read", "write", "admin"]'::jsonb
)
WHERE permissions->>'learningCenter' IS NULL
  AND name IN ('super_admin', 'admin');

-- 为 manager 角色补充 learningCenter 只读权限
UPDATE roles
SET permissions = jsonb_set(
  permissions,
  '{learningCenter}',
  '["read"]'::jsonb
)
WHERE permissions->>'learningCenter' IS NULL
  AND name = 'manager';

-- 为 user 角色补充 learningCenter 只读权限
UPDATE roles
SET permissions = jsonb_set(
  permissions,
  '{learningCenter}',
  '["read"]'::jsonb
)
WHERE permissions->>'learningCenter' IS NULL
  AND name = 'user';

-- 同时补齐可能缺失的 assistantPresets（遗留问题）
UPDATE roles
SET permissions = jsonb_set(
  permissions,
  '{assistantPresets}',
  '["read", "write", "admin"]'::jsonb
)
WHERE permissions->>'assistantPresets' IS NULL
  AND name IN ('super_admin', 'admin');
```

**Step 2: 执行迁移脚本**

Run: `cd /Users/yadea/Documents/pythonWorkSpace/cherry-studio/packages/server && psql "$DATABASE_URL" -f src/migrations/add-learning-center-permissions.sql`
Expected: UPDATE 语句影响对应行数，无错误

**Step 3: Commit**

```bash
git add packages/server/src/migrations/add-learning-center-permissions.sql
git commit --signoff -m "feat: add SQL migration for existing role learning center permissions"
```

---

## Task 6: 服务端 API — 学习中心路由（客户端聚合 + Admin CRUD）

**Files:**
- Create: `packages/server/src/routes/learning-center.ts`
- Modify: `packages/server/src/routes/index.ts` (L13: import + L27: router.use)

**Step 1: 创建学习中心路由文件**

创建 `packages/server/src/routes/learning-center.ts`——完整路由文件。参考 `assistant-presets.ts` 的模式：

```typescript
// packages/server/src/routes/learning-center.ts
import { and, asc, count, desc, eq, inArray, isNull, not, sql } from 'drizzle-orm'
import { Router } from 'express'

import { authenticate } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'
import { validate } from '../middleware/validate'
import {
  lcBanners,
  lcCourseCategories,
  lcCourses,
  lcDocumentCategories,
  lcDocuments,
  lcHotItems
} from '../models/schema'
import { db } from '../utils/db'
import { createSuccessResponse, createPagination } from '@cherry-studio/enterprise-shared'

import {
  createBannerSchema,
  updateBannerSchema,
  createCourseCategorySchema,
  updateCourseCategorySchema,
  createCourseSchema,
  updateCourseSchema,
  courseQuerySchema,
  createDocumentCategorySchema,
  updateDocumentCategorySchema,
  createDocumentSchema,
  updateDocumentSchema,
  documentQuerySchema,
  createHotItemSchema,
  updateHotItemSchema,
  lcIdParamSchema,
  lcPaginationSchema,
  hotItemsRefreshQuerySchema
} from '@cherry-studio/enterprise-shared'

const router = Router()

// 所有路由需认证
router.use(authenticate)

// ============ 客户端聚合 API（仅需 authenticate） ============

// GET /client — 一次性返回所有学习中心数据
router.get('/client', async (req, res, next) => {
  try {
    const companyId = req.user!.companyId

    // 并行查询 6 张表 + 统计
    const [banners, courseCategories, documentCategories, hotItems, courseCount, documentCount, viewStats] =
      await Promise.all([
        // Banners
        db
          .select()
          .from(lcBanners)
          .where(and(eq(lcBanners.companyId, companyId), eq(lcBanners.isEnabled, true)))
          .orderBy(asc(lcBanners.order), desc(lcBanners.createdAt)),

        // 课程分类 + 课程
        db.query.lcCourseCategories.findMany({
          where: and(eq(lcCourseCategories.companyId, companyId), eq(lcCourseCategories.isEnabled, true)),
          orderBy: [asc(lcCourseCategories.order), desc(lcCourseCategories.createdAt)],
          with: {
            courses: {
              where: eq(lcCourses.isEnabled, true),
              orderBy: [asc(lcCourses.order), desc(lcCourses.createdAt)]
            }
          }
        }),

        // 文档分类 + 文档
        db.query.lcDocumentCategories.findMany({
          where: and(eq(lcDocumentCategories.companyId, companyId), eq(lcDocumentCategories.isEnabled, true)),
          orderBy: [asc(lcDocumentCategories.order), desc(lcDocumentCategories.createdAt)],
          with: {
            documents: {
              where: eq(lcDocuments.isEnabled, true),
              orderBy: [asc(lcDocuments.order), desc(lcDocuments.createdAt)]
            }
          }
        }),

        // 热搜
        db
          .select()
          .from(lcHotItems)
          .where(and(eq(lcHotItems.companyId, companyId), eq(lcHotItems.isEnabled, true)))
          .orderBy(asc(lcHotItems.order), desc(lcHotItems.createdAt))
          .limit(10),

        // 统计 — 课程总数
        db
          .select({ value: count() })
          .from(lcCourses)
          .where(and(eq(lcCourses.companyId, companyId), eq(lcCourses.isEnabled, true))),

        // 统计 — 文档总数
        db
          .select({ value: count() })
          .from(lcDocuments)
          .where(and(eq(lcDocuments.companyId, companyId), eq(lcDocuments.isEnabled, true))),

        // 统计 — 总浏览次数（课程 + 文档）
        db
          .select({
            courseViews: sql<number>`COALESCE(SUM(${lcCourses.viewCount}), 0)`.as('course_views')
          })
          .from(lcCourses)
          .where(and(eq(lcCourses.companyId, companyId), eq(lcCourses.isEnabled, true)))
      ])

    // 计算文档浏览次数
    const docViewStats = await db
      .select({
        docViews: sql<number>`COALESCE(SUM(${lcDocuments.viewCount}), 0)`.as('doc_views')
      })
      .from(lcDocuments)
      .where(and(eq(lcDocuments.companyId, companyId), eq(lcDocuments.isEnabled, true)))

    const totalViews = Number(viewStats[0]?.courseViews ?? 0) + Number(docViewStats[0]?.docViews ?? 0)

    res.json(
      createSuccessResponse({
        banners: banners ?? [],
        courseCategories: courseCategories ?? [],
        documentCategories: documentCategories ?? [],
        hotItems: hotItems ?? [],
        stats: {
          totalCourses: courseCount[0]?.value ?? 0,
          totalDocuments: documentCount[0]?.value ?? 0,
          totalViews
        }
      })
    )
  } catch (err) {
    next(err)
  }
})

// GET /client/hot-items — 换一批热搜
router.get('/client/hot-items', validate(hotItemsRefreshQuerySchema, 'query'), async (req, res, next) => {
  try {
    const companyId = req.user!.companyId
    const excludeIds: string[] = req.query.exclude as string[] ?? []

    const conditions = [eq(lcHotItems.companyId, companyId), eq(lcHotItems.isEnabled, true)]
    if (excludeIds.length > 0) {
      conditions.push(not(inArray(lcHotItems.id, excludeIds)))
    }

    const items = await db
      .select()
      .from(lcHotItems)
      .where(and(...conditions))
      .orderBy(sql`random()`)
      .limit(10)

    res.json(createSuccessResponse(items))
  } catch (err) {
    next(err)
  }
})

// ============ Banner CRUD（需 admin 权限） ============

router.get('/banners', requirePermission('learningCenter', 'read'), validate(lcPaginationSchema, 'query'), async (req, res, next) => {
  try {
    const companyId = req.user!.companyId
    const { page, pageSize } = req.query as any

    const [items, total] = await Promise.all([
      db
        .select()
        .from(lcBanners)
        .where(eq(lcBanners.companyId, companyId))
        .orderBy(asc(lcBanners.order), desc(lcBanners.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ value: count() }).from(lcBanners).where(eq(lcBanners.companyId, companyId))
    ])

    res.json(createSuccessResponse(items, createPagination(total[0]?.value ?? 0, { page, pageSize })))
  } catch (err) {
    next(err)
  }
})

router.post('/banners', requirePermission('learningCenter', 'write'), validate(createBannerSchema, 'body'), async (req, res, next) => {
  try {
    const companyId = req.user!.companyId
    const [banner] = await db
      .insert(lcBanners)
      .values({ ...req.body, companyId })
      .returning()
    res.status(201).json(createSuccessResponse(banner))
  } catch (err) {
    next(err)
  }
})

router.patch('/banners/:id', requirePermission('learningCenter', 'write'), validate(lcIdParamSchema, 'params'), validate(updateBannerSchema, 'body'), async (req, res, next) => {
  try {
    const companyId = req.user!.companyId
    const [updated] = await db
      .update(lcBanners)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(eq(lcBanners.id, req.params.id), eq(lcBanners.companyId, companyId)))
      .returning()
    if (!updated) {
      return res.status(404).json({ success: false, error: { code: 'RES_3001', message: 'Banner not found' } })
    }
    res.json(createSuccessResponse(updated))
  } catch (err) {
    next(err)
  }
})

router.delete('/banners/:id', requirePermission('learningCenter', 'admin'), validate(lcIdParamSchema, 'params'), async (req, res, next) => {
  try {
    const companyId = req.user!.companyId
    const [deleted] = await db
      .delete(lcBanners)
      .where(and(eq(lcBanners.id, req.params.id), eq(lcBanners.companyId, companyId)))
      .returning()
    if (!deleted) {
      return res.status(404).json({ success: false, error: { code: 'RES_3001', message: 'Banner not found' } })
    }
    res.json(createSuccessResponse({ id: deleted.id }))
  } catch (err) {
    next(err)
  }
})

// ============ 课程分类 CRUD ============

router.get('/course-categories', requirePermission('learningCenter', 'read'), async (req, res, next) => {
  try {
    const companyId = req.user!.companyId
    const items = await db
      .select()
      .from(lcCourseCategories)
      .where(eq(lcCourseCategories.companyId, companyId))
      .orderBy(asc(lcCourseCategories.order), desc(lcCourseCategories.createdAt))
    res.json(createSuccessResponse(items))
  } catch (err) {
    next(err)
  }
})

router.post('/course-categories', requirePermission('learningCenter', 'write'), validate(createCourseCategorySchema, 'body'), async (req, res, next) => {
  try {
    const companyId = req.user!.companyId
    const [category] = await db
      .insert(lcCourseCategories)
      .values({ ...req.body, companyId })
      .returning()
    res.status(201).json(createSuccessResponse(category))
  } catch (err) {
    next(err)
  }
})

router.patch('/course-categories/:id', requirePermission('learningCenter', 'write'), validate(lcIdParamSchema, 'params'), validate(updateCourseCategorySchema, 'body'), async (req, res, next) => {
  try {
    const companyId = req.user!.companyId
    const [updated] = await db
      .update(lcCourseCategories)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(eq(lcCourseCategories.id, req.params.id), eq(lcCourseCategories.companyId, companyId)))
      .returning()
    if (!updated) {
      return res.status(404).json({ success: false, error: { code: 'RES_3001', message: 'Course category not found' } })
    }
    res.json(createSuccessResponse(updated))
  } catch (err) {
    next(err)
  }
})

router.delete('/course-categories/:id', requirePermission('learningCenter', 'admin'), validate(lcIdParamSchema, 'params'), async (req, res, next) => {
  try {
    const companyId = req.user!.companyId
    // 查询该分类下的课程数量（用于前端确认提示）
    const courseCount = await db
      .select({ value: count() })
      .from(lcCourses)
      .where(and(eq(lcCourses.categoryId, req.params.id), eq(lcCourses.companyId, companyId)))
    const [deleted] = await db
      .delete(lcCourseCategories)
      .where(and(eq(lcCourseCategories.id, req.params.id), eq(lcCourseCategories.companyId, companyId)))
      .returning()
    if (!deleted) {
      return res.status(404).json({ success: false, error: { code: 'RES_3001', message: 'Course category not found' } })
    }
    res.json(createSuccessResponse({ id: deleted.id, affectedCourses: courseCount[0]?.value ?? 0 }))
  } catch (err) {
    next(err)
  }
})

// ============ 课程 CRUD ============

router.get('/courses', requirePermission('learningCenter', 'read'), validate(courseQuerySchema, 'query'), async (req, res, next) => {
  try {
    const companyId = req.user!.companyId
    const { page, pageSize, categoryId, uncategorized } = req.query as any
    const conditions = [eq(lcCourses.companyId, companyId)]
    if (categoryId) {
      conditions.push(eq(lcCourses.categoryId, categoryId))
    }
    if (uncategorized) {
      conditions.push(isNull(lcCourses.categoryId))
    }

    const [items, total] = await Promise.all([
      db
        .select()
        .from(lcCourses)
        .where(and(...conditions))
        .orderBy(asc(lcCourses.order), desc(lcCourses.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ value: count() }).from(lcCourses).where(and(...conditions))
    ])

    res.json(createSuccessResponse(items, createPagination(total[0]?.value ?? 0, { page, pageSize })))
  } catch (err) {
    next(err)
  }
})

router.post('/courses', requirePermission('learningCenter', 'write'), validate(createCourseSchema, 'body'), async (req, res, next) => {
  try {
    const companyId = req.user!.companyId
    const [course] = await db
      .insert(lcCourses)
      .values({ ...req.body, companyId })
      .returning()
    res.status(201).json(createSuccessResponse(course))
  } catch (err) {
    next(err)
  }
})

router.patch('/courses/:id', requirePermission('learningCenter', 'write'), validate(lcIdParamSchema, 'params'), validate(updateCourseSchema, 'body'), async (req, res, next) => {
  try {
    const companyId = req.user!.companyId
    const [updated] = await db
      .update(lcCourses)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(eq(lcCourses.id, req.params.id), eq(lcCourses.companyId, companyId)))
      .returning()
    if (!updated) {
      return res.status(404).json({ success: false, error: { code: 'RES_3001', message: 'Course not found' } })
    }
    res.json(createSuccessResponse(updated))
  } catch (err) {
    next(err)
  }
})

router.delete('/courses/:id', requirePermission('learningCenter', 'admin'), validate(lcIdParamSchema, 'params'), async (req, res, next) => {
  try {
    const companyId = req.user!.companyId
    const [deleted] = await db
      .delete(lcCourses)
      .where(and(eq(lcCourses.id, req.params.id), eq(lcCourses.companyId, companyId)))
      .returning()
    if (!deleted) {
      return res.status(404).json({ success: false, error: { code: 'RES_3001', message: 'Course not found' } })
    }
    res.json(createSuccessResponse({ id: deleted.id }))
  } catch (err) {
    next(err)
  }
})

// ============ 文档分类 CRUD ============

router.get('/document-categories', requirePermission('learningCenter', 'read'), async (req, res, next) => {
  try {
    const companyId = req.user!.companyId
    const items = await db
      .select()
      .from(lcDocumentCategories)
      .where(eq(lcDocumentCategories.companyId, companyId))
      .orderBy(asc(lcDocumentCategories.order), desc(lcDocumentCategories.createdAt))
    res.json(createSuccessResponse(items))
  } catch (err) {
    next(err)
  }
})

router.post('/document-categories', requirePermission('learningCenter', 'write'), validate(createDocumentCategorySchema, 'body'), async (req, res, next) => {
  try {
    const companyId = req.user!.companyId
    const [category] = await db
      .insert(lcDocumentCategories)
      .values({ ...req.body, companyId })
      .returning()
    res.status(201).json(createSuccessResponse(category))
  } catch (err) {
    next(err)
  }
})

router.patch('/document-categories/:id', requirePermission('learningCenter', 'write'), validate(lcIdParamSchema, 'params'), validate(updateDocumentCategorySchema, 'body'), async (req, res, next) => {
  try {
    const companyId = req.user!.companyId
    const [updated] = await db
      .update(lcDocumentCategories)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(eq(lcDocumentCategories.id, req.params.id), eq(lcDocumentCategories.companyId, companyId)))
      .returning()
    if (!updated) {
      return res.status(404).json({ success: false, error: { code: 'RES_3001', message: 'Document category not found' } })
    }
    res.json(createSuccessResponse(updated))
  } catch (err) {
    next(err)
  }
})

router.delete('/document-categories/:id', requirePermission('learningCenter', 'admin'), validate(lcIdParamSchema, 'params'), async (req, res, next) => {
  try {
    const companyId = req.user!.companyId
    const docCount = await db
      .select({ value: count() })
      .from(lcDocuments)
      .where(and(eq(lcDocuments.categoryId, req.params.id), eq(lcDocuments.companyId, companyId)))
    const [deleted] = await db
      .delete(lcDocumentCategories)
      .where(and(eq(lcDocumentCategories.id, req.params.id), eq(lcDocumentCategories.companyId, companyId)))
      .returning()
    if (!deleted) {
      return res.status(404).json({ success: false, error: { code: 'RES_3001', message: 'Document category not found' } })
    }
    res.json(createSuccessResponse({ id: deleted.id, affectedDocuments: docCount[0]?.value ?? 0 }))
  } catch (err) {
    next(err)
  }
})

// ============ 文档 CRUD ============

router.get('/documents', requirePermission('learningCenter', 'read'), validate(documentQuerySchema, 'query'), async (req, res, next) => {
  try {
    const companyId = req.user!.companyId
    const { page, pageSize, categoryId, uncategorized } = req.query as any
    const conditions = [eq(lcDocuments.companyId, companyId)]
    if (categoryId) {
      conditions.push(eq(lcDocuments.categoryId, categoryId))
    }
    if (uncategorized) {
      conditions.push(isNull(lcDocuments.categoryId))
    }

    const [items, total] = await Promise.all([
      db
        .select()
        .from(lcDocuments)
        .where(and(...conditions))
        .orderBy(asc(lcDocuments.order), desc(lcDocuments.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ value: count() }).from(lcDocuments).where(and(...conditions))
    ])

    res.json(createSuccessResponse(items, createPagination(total[0]?.value ?? 0, { page, pageSize })))
  } catch (err) {
    next(err)
  }
})

router.post('/documents', requirePermission('learningCenter', 'write'), validate(createDocumentSchema, 'body'), async (req, res, next) => {
  try {
    const companyId = req.user!.companyId
    const [document] = await db
      .insert(lcDocuments)
      .values({ ...req.body, companyId })
      .returning()
    res.status(201).json(createSuccessResponse(document))
  } catch (err) {
    next(err)
  }
})

router.patch('/documents/:id', requirePermission('learningCenter', 'write'), validate(lcIdParamSchema, 'params'), validate(updateDocumentSchema, 'body'), async (req, res, next) => {
  try {
    const companyId = req.user!.companyId
    const [updated] = await db
      .update(lcDocuments)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(eq(lcDocuments.id, req.params.id), eq(lcDocuments.companyId, companyId)))
      .returning()
    if (!updated) {
      return res.status(404).json({ success: false, error: { code: 'RES_3001', message: 'Document not found' } })
    }
    res.json(createSuccessResponse(updated))
  } catch (err) {
    next(err)
  }
})

router.delete('/documents/:id', requirePermission('learningCenter', 'admin'), validate(lcIdParamSchema, 'params'), async (req, res, next) => {
  try {
    const companyId = req.user!.companyId
    const [deleted] = await db
      .delete(lcDocuments)
      .where(and(eq(lcDocuments.id, req.params.id), eq(lcDocuments.companyId, companyId)))
      .returning()
    if (!deleted) {
      return res.status(404).json({ success: false, error: { code: 'RES_3001', message: 'Document not found' } })
    }
    res.json(createSuccessResponse({ id: deleted.id }))
  } catch (err) {
    next(err)
  }
})

// ============ 热搜要闻 CRUD ============

router.get('/hot-items', requirePermission('learningCenter', 'read'), validate(lcPaginationSchema, 'query'), async (req, res, next) => {
  try {
    const companyId = req.user!.companyId
    const { page, pageSize } = req.query as any

    const [items, total] = await Promise.all([
      db
        .select()
        .from(lcHotItems)
        .where(eq(lcHotItems.companyId, companyId))
        .orderBy(asc(lcHotItems.order), desc(lcHotItems.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ value: count() }).from(lcHotItems).where(eq(lcHotItems.companyId, companyId))
    ])

    res.json(createSuccessResponse(items, createPagination(total[0]?.value ?? 0, { page, pageSize })))
  } catch (err) {
    next(err)
  }
})

router.post('/hot-items', requirePermission('learningCenter', 'write'), validate(createHotItemSchema, 'body'), async (req, res, next) => {
  try {
    const companyId = req.user!.companyId
    const [item] = await db
      .insert(lcHotItems)
      .values({ ...req.body, companyId })
      .returning()
    res.status(201).json(createSuccessResponse(item))
  } catch (err) {
    next(err)
  }
})

router.patch('/hot-items/:id', requirePermission('learningCenter', 'write'), validate(lcIdParamSchema, 'params'), validate(updateHotItemSchema, 'body'), async (req, res, next) => {
  try {
    const companyId = req.user!.companyId
    const [updated] = await db
      .update(lcHotItems)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(eq(lcHotItems.id, req.params.id), eq(lcHotItems.companyId, companyId)))
      .returning()
    if (!updated) {
      return res.status(404).json({ success: false, error: { code: 'RES_3001', message: 'Hot item not found' } })
    }
    res.json(createSuccessResponse(updated))
  } catch (err) {
    next(err)
  }
})

router.delete('/hot-items/:id', requirePermission('learningCenter', 'admin'), validate(lcIdParamSchema, 'params'), async (req, res, next) => {
  try {
    const companyId = req.user!.companyId
    const [deleted] = await db
      .delete(lcHotItems)
      .where(and(eq(lcHotItems.id, req.params.id), eq(lcHotItems.companyId, companyId)))
      .returning()
    if (!deleted) {
      return res.status(404).json({ success: false, error: { code: 'RES_3001', message: 'Hot item not found' } })
    }
    res.json(createSuccessResponse({ id: deleted.id }))
  } catch (err) {
    next(err)
  }
})

export default router
```

**Step 2: 注册路由**

在 `packages/server/src/routes/index.ts` 第 12 行后添加 import，第 27 行后添加 router.use：

```typescript
// L12 后添加：
import learningCenterRoutes from './learning-center'

// L27 router.use('/settings', clientSettingsRoutes) 后添加：
router.use('/learning-center', learningCenterRoutes)
```

**Step 3: 运行类型检查**

Run: `cd /Users/yadea/Documents/pythonWorkSpace/cherry-studio && pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/server/src/routes/learning-center.ts packages/server/src/routes/index.ts
git commit --signoff -m "feat: add learning center API routes with client aggregation and CRUD"
```

---

## Task 7: Admin 面板 — API 服务 + 路由注册 + 侧边栏

**Files:**
- Create: `packages/admin/src/services/learningCenterApi.ts`
- Modify: `packages/admin/src/App.tsx` (L14: import + L43: Route)
- Modify: `packages/admin/src/components/Layout.tsx` (L4: icon import + L77: menuItem)
- Modify: `packages/admin/src/pages/Roles.tsx` (L18-62: permissionCategories)

**Step 1: 创建 Admin API 服务**

```typescript
// packages/admin/src/services/learningCenterApi.ts
import { api } from './api'

export const learningCenterApi = {
  // Banner
  listBanners: (params?: any) => api.get('/learning-center/banners', { params }),
  createBanner: (data: any) => api.post('/learning-center/banners', data),
  updateBanner: (id: string, data: any) => api.patch(`/learning-center/banners/${id}`, data),
  deleteBanner: (id: string) => api.delete(`/learning-center/banners/${id}`),

  // 课程分类
  listCourseCategories: () => api.get('/learning-center/course-categories'),
  createCourseCategory: (data: any) => api.post('/learning-center/course-categories', data),
  updateCourseCategory: (id: string, data: any) => api.patch(`/learning-center/course-categories/${id}`, data),
  deleteCourseCategory: (id: string) => api.delete(`/learning-center/course-categories/${id}`),

  // 课程
  listCourses: (params?: any) => api.get('/learning-center/courses', { params }),
  createCourse: (data: any) => api.post('/learning-center/courses', data),
  updateCourse: (id: string, data: any) => api.patch(`/learning-center/courses/${id}`, data),
  deleteCourse: (id: string) => api.delete(`/learning-center/courses/${id}`),

  // 文档分类
  listDocumentCategories: () => api.get('/learning-center/document-categories'),
  createDocumentCategory: (data: any) => api.post('/learning-center/document-categories', data),
  updateDocumentCategory: (id: string, data: any) => api.patch(`/learning-center/document-categories/${id}`, data),
  deleteDocumentCategory: (id: string) => api.delete(`/learning-center/document-categories/${id}`),

  // 文档
  listDocuments: (params?: any) => api.get('/learning-center/documents', { params }),
  createDocument: (data: any) => api.post('/learning-center/documents', data),
  updateDocument: (id: string, data: any) => api.patch(`/learning-center/documents/${id}`, data),
  deleteDocument: (id: string) => api.delete(`/learning-center/documents/${id}`),

  // 热搜
  listHotItems: (params?: any) => api.get('/learning-center/hot-items', { params }),
  createHotItem: (data: any) => api.post('/learning-center/hot-items', data),
  updateHotItem: (id: string, data: any) => api.patch(`/learning-center/hot-items/${id}`, data),
  deleteHotItem: (id: string) => api.delete(`/learning-center/hot-items/${id}`)
}
```

**Step 2: 修复 Roles.tsx permissionCategories（补齐 assistantPresets + 新增 learningCenter）**

在 `packages/admin/src/pages/Roles.tsx` 第 62 行 `]` 前，添加缺失的 `assistantPresets` 和新的 `learningCenter`：

```typescript
  // 在 system 条目（第 59-61 行 } ）后添加：
  {
    key: 'assistantPresets',
    label: '助手预设',
    options: [
      { value: 'read', label: '查看' },
      { value: 'write', label: '编辑' },
      { value: 'admin', label: '管理' }
    ]
  },
  {
    key: 'learningCenter',
    label: '学习中心',
    options: [
      { value: 'read', label: '查看' },
      { value: 'write', label: '编辑' },
      { value: 'admin', label: '管理' }
    ]
  }
```

**Step 3: 注册 Admin 路由**

在 `packages/admin/src/App.tsx` 添加：

```typescript
// L14（Backups import 后）添加：
import LearningCenter from './pages/LearningCenter'

// L43（backups Route 后）添加：
<Route path="learning-center" element={<LearningCenter />} />
```

**Step 4: 添加侧边栏菜单**

在 `packages/admin/src/components/Layout.tsx` 添加：

```typescript
// L5（BookOutlined import 后）添加：
import { ReadOutlined } from '@ant-design/icons'

// L77（assistantPresets 菜单项后，statistics 菜单项前）添加：
if (hasPermission('learningCenter', 'read')) {
  items.push({
    key: '/learning-center',
    icon: <ReadOutlined />,
    label: '学习中心'
  })
}
```

**Step 5: Commit**

```bash
git add packages/admin/src/services/learningCenterApi.ts packages/admin/src/App.tsx packages/admin/src/components/Layout.tsx packages/admin/src/pages/Roles.tsx
git commit --signoff -m "feat: add admin learning center API service, routing, sidebar, and fix Roles.tsx permissions"
```

---

## Task 8: Admin 面板 — 学习中心管理页面

**Files:**
- Create: `packages/admin/src/pages/LearningCenter/index.tsx`
- Create: `packages/admin/src/pages/LearningCenter/BannerManager.tsx`
- Create: `packages/admin/src/pages/LearningCenter/CourseManager.tsx`
- Create: `packages/admin/src/pages/LearningCenter/DocumentManager.tsx`
- Create: `packages/admin/src/pages/LearningCenter/HotItemManager.tsx`

**Step 1: 创建主容器页面**

```typescript
// packages/admin/src/pages/LearningCenter/index.tsx
import { Tabs } from 'antd'

import BannerManager from './BannerManager'
import CourseManager from './CourseManager'
import DocumentManager from './DocumentManager'
import HotItemManager from './HotItemManager'

export default function LearningCenter() {
  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>学习中心管理</h2>
      <Tabs
        defaultActiveKey="banners"
        items={[
          { key: 'banners', label: 'Banner 管理', children: <BannerManager /> },
          { key: 'courses', label: '视频课程', children: <CourseManager /> },
          { key: 'documents', label: '知识文档', children: <DocumentManager /> },
          { key: 'hotItems', label: '热搜要闻', children: <HotItemManager /> }
        ]}
      />
    </div>
  )
}
```

**Step 2: 创建 BannerManager**

创建 `packages/admin/src/pages/LearningCenter/BannerManager.tsx`：
- 表格列：图片预览（Image）、标题、链接、排序（InputNumber）、状态（Switch）、操作（编辑/删除）
- 新增按钮 → Modal 表单（title, imageUrl, linkUrl, linkType, order, isEnabled）
- 参考 `AssistantPresets.tsx` 的 Table + Modal 模式
- 使用 `learningCenterApi.listBanners/createBanner/updateBanner/deleteBanner`

**Step 3: 创建 CourseManager**

创建 `packages/admin/src/pages/LearningCenter/CourseManager.tsx`：
- 左侧：分类列表 + "管理分类" 按钮（弹出 Modal 管理分类的 CRUD）
- 右侧：课程表格（标题、分类、时长、作者、推荐、状态、操作）+ 搜索 + 分页
- 支持按分类筛选 + "未分类" 筛选项
- 删除分类时弹确认框：显示关联课程数

**Step 4: 创建 DocumentManager**

创建 `packages/admin/src/pages/LearningCenter/DocumentManager.tsx`：
- 布局同 CourseManager（左分类 + 右列表）
- 表格列：标题、分类、链接类型、作者、推荐、状态、操作
- 支持分类筛选 + "未分类"

**Step 5: 创建 HotItemManager**

创建 `packages/admin/src/pages/LearningCenter/HotItemManager.tsx`：
- 表格列：标题、链接、标签（Select: 热/新/无）、热度值（InputNumber + "万"后缀）、排序、状态、操作
- 新增/编辑 Modal 表单

**Step 6: 运行类型检查**

Run: `cd /Users/yadea/Documents/pythonWorkSpace/cherry-studio/packages/admin && pnpm typecheck`
Expected: PASS

**Step 7: Commit**

```bash
git add packages/admin/src/pages/LearningCenter/
git commit --signoff -m "feat: add admin learning center management pages (Banner, Course, Document, HotItem)"
```

---

## Task 9: 客户端侧边栏集成 + Store 迁移

**Files:**
- Modify: `src/renderer/src/types/index.ts` (L619-630: SidebarIcon 类型)
- Modify: `src/renderer/src/config/sidebar.ts` (L7-18: DEFAULT_SIDEBAR_ICONS)
- Modify: `src/renderer/src/components/app/Sidebar.tsx` (L135-159: iconMap + pathMap)
- Modify: `src/renderer/src/i18n/label.ts` (L180-191: sidebarIconKeyMap)
- Modify: `src/renderer/src/store/migrate.ts` (L3207: 新增 v196)
- Modify: `src/renderer/src/store/index.ts` (L91: version 195→196)

**Step 1: 更新 SidebarIcon 类型**

在 `src/renderer/src/types/index.ts` 第 629 行 `| 'openclaw'` 后添加：

```typescript
  | 'learning_center'
```

**Step 2: 更新 DEFAULT_SIDEBAR_ICONS**

在 `src/renderer/src/config/sidebar.ts` 第 17 行 `'openclaw'` 后添加：

```typescript
  'learning_center'
```

**Step 3: 更新 Sidebar iconMap + pathMap**

在 `src/renderer/src/components/app/Sidebar.tsx`：

```typescript
// L136 附近的 iconMap，添加 import：
import { GraduationCap } from 'lucide-react'

// iconMap 对象中 openclaw 后添加：
learning_center: <GraduationCap size={22} strokeWidth={1.9} />

// pathMap 对象中 openclaw 后添加：
learning_center: '/learning'
```

**Step 4: 更新 sidebarIconKeyMap**

在 `src/renderer/src/i18n/label.ts` 第 190 行 `openclaw` 后添加：

```typescript
  learning_center: 'learningCenter.title'
```

**Step 5: 添加 store 迁移 v196**

在 `src/renderer/src/store/migrate.ts` 第 3207 行 `}` 前（即 `'195'` 条目闭合大括号后）添加：

```typescript
  '196': (state: RootState) => {
    try {
      if (state.settings && state.settings.sidebarIcons) {
        if (!state.settings.sidebarIcons.visible.includes('learning_center' as any)) {
          state.settings.sidebarIcons.visible = [...state.settings.sidebarIcons.visible, 'learning_center' as any]
        }
      }
      logger.info('migrate 196 success')
      return state
    } catch (error) {
      logger.error('migrate 196 error', error as Error)
      return state
    }
  }
```

**Step 6: 更新 store version**

在 `src/renderer/src/store/index.ts` 第 91 行：

```typescript
version: 196,  // was 195
```

**Step 7: 运行类型检查**

Run: `cd /Users/yadea/Documents/pythonWorkSpace/cherry-studio && pnpm typecheck`
Expected: PASS

**Step 8: Commit**

```bash
git add src/renderer/src/types/index.ts src/renderer/src/config/sidebar.ts src/renderer/src/components/app/Sidebar.tsx src/renderer/src/i18n/label.ts src/renderer/src/store/migrate.ts src/renderer/src/store/index.ts
git commit --signoff -m "feat: add learning center sidebar icon with store migration v196"
```

---

## Task 10: 客户端路由 + EnterpriseApi 扩展

**Files:**
- Modify: `src/renderer/src/Router.tsx` (L23: import + L66: Route)
- Modify: `src/renderer/src/services/EnterpriseApi.ts` (L441: 新增方法)

**Step 1: 注册客户端路由**

在 `src/renderer/src/Router.tsx`：

```typescript
// L23（OpenClawPage import 后）添加：
import LearningCenterPage from './pages/learning/LearningCenterPage'

// L66（openclaw Route 后）添加：
<Route path="/learning" element={<LearningCenterPage />} />
```

**Step 2: 扩展 EnterpriseApi**

在 `src/renderer/src/services/EnterpriseApi.ts` 第 441 行（`getAssistantPresets` 方法后、类闭合 `}` 前）添加：

```typescript
  // 学习中心
  async getLearningCenterData() {
    return this.request<{
      banners: Array<{
        id: string
        title: string
        imageUrl: string
        linkUrl?: string
        linkType?: string
        order: number
      }>
      courseCategories: Array<{
        id: string
        name: string
        order: number
        courses: Array<{
          id: string
          title: string
          description?: string
          coverUrl?: string
          videoUrl: string
          duration: number
          author?: string
          order: number
          isRecommended: boolean
          viewCount: number
        }>
      }>
      documentCategories: Array<{
        id: string
        name: string
        order: number
        documents: Array<{
          id: string
          title: string
          description?: string
          coverUrl?: string
          linkUrl: string
          linkType: string
          author?: string
          order: number
          isRecommended: boolean
          viewCount: number
        }>
      }>
      hotItems: Array<{
        id: string
        title: string
        linkUrl: string
        tag?: string
        heatValue: number
        order: number
      }>
      stats: {
        totalCourses: number
        totalDocuments: number
        totalViews: number
      }
    }>('GET', '/learning-center/client')
  }

  async getHotItemsBatch(excludeIds: string[]) {
    const exclude = excludeIds.join(',')
    return this.request<
      Array<{
        id: string
        title: string
        linkUrl: string
        tag?: string
        heatValue: number
        order: number
      }>
    >('GET', `/learning-center/client/hot-items${exclude ? `?exclude=${exclude}` : ''}`)
  }
```

**Step 3: 运行类型检查**

Run: `cd /Users/yadea/Documents/pythonWorkSpace/cherry-studio && pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/renderer/src/Router.tsx src/renderer/src/services/EnterpriseApi.ts
git commit --signoff -m "feat: add learning center client route and EnterpriseApi methods"
```

---

## Task 11: 客户端页面 — useLearningCenter hook

**Files:**
- Create: `src/renderer/src/pages/learning/hooks/useLearningCenter.ts`

**Step 1: 创建数据获取 hook**

```typescript
// src/renderer/src/pages/learning/hooks/useLearningCenter.ts
import { loggerService } from '@logger'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'

import { enterpriseApi } from '@renderer/services/EnterpriseApi'
import type { RootState } from '@renderer/store'

const logger = loggerService.withContext('useLearningCenter')

interface LcStats {
  totalCourses: number
  totalDocuments: number
  totalViews: number
}

interface LcHotItem {
  id: string
  title: string
  linkUrl: string
  tag?: string
  heatValue: number
  order: number
}

interface LcClientData {
  banners: Array<{
    id: string
    title: string
    imageUrl: string
    linkUrl?: string
    linkType?: string
    order: number
  }>
  courseCategories: Array<{
    id: string
    name: string
    order: number
    courses: Array<{
      id: string
      title: string
      description?: string
      coverUrl?: string
      videoUrl: string
      duration: number
      author?: string
      order: number
      isRecommended: boolean
      viewCount: number
    }>
  }>
  documentCategories: Array<{
    id: string
    name: string
    order: number
    documents: Array<{
      id: string
      title: string
      description?: string
      coverUrl?: string
      linkUrl: string
      linkType: string
      author?: string
      order: number
      isRecommended: boolean
      viewCount: number
    }>
  }>
  hotItems: LcHotItem[]
  stats: LcStats
}

export function useLearningCenter() {
  const [data, setData] = useState<LcClientData | null>(null)
  const [hotItems, setHotItems] = useState<LcHotItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [noMoreHotItems, setNoMoreHotItems] = useState(false)

  const seenHotItemIds = useRef<Set<string>>(new Set())
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  const isEnterpriseMode = useSelector((state: RootState) => !!state.enterprise?.enterpriseServer)

  const loadData = useCallback(async () => {
    if (!isEnterpriseMode) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const response = await enterpriseApi.getLearningCenterData()
      setData(response.data)
      setHotItems(response.data.hotItems)
      // 记录初始热搜 IDs
      const ids = new Set<string>()
      for (const item of response.data.hotItems) {
        ids.add(item.id)
      }
      seenHotItemIds.current = ids
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载学习中心数据失败'
      setError(message)
      logger.error('Failed to load learning center data', { error: message })
    } finally {
      setLoading(false)
    }
  }, [isEnterpriseMode])

  useEffect(() => {
    loadData()
  }, [loadData])

  const refreshHotItems = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(async () => {
      try {
        const excludeIds = Array.from(seenHotItemIds.current)
        const response = await enterpriseApi.getHotItemsBatch(excludeIds)
        const newItems = response.data

        if (newItems.length === 0) {
          setNoMoreHotItems(true)
          return
        }

        setHotItems(newItems)
        for (const item of newItems) {
          seenHotItemIds.current.add(item.id)
        }
        setNoMoreHotItems(false)
      } catch (err) {
        logger.error('Failed to refresh hot items', { error: err instanceof Error ? err.message : 'Unknown' })
      }
    }, 300) // 300ms debounce
  }, [])

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [])

  return {
    data,
    hotItems,
    loading,
    error,
    noMoreHotItems,
    refreshHotItems,
    reload: loadData
  }
}
```

**Step 2: 运行类型检查**

Run: `cd /Users/yadea/Documents/pythonWorkSpace/cherry-studio && pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/renderer/src/pages/learning/hooks/useLearningCenter.ts
git commit --signoff -m "feat: add useLearningCenter data fetching hook"
```

---

## Task 12: 客户端页面 — 学习中心主页面 + 子组件

**Files:**
- Create: `src/renderer/src/pages/learning/LearningCenterPage.tsx`
- Create: `src/renderer/src/pages/learning/components/PromotionBanner.tsx`
- Create: `src/renderer/src/pages/learning/components/CarouselBanner.tsx`
- Create: `src/renderer/src/pages/learning/components/LearningTabs.tsx`
- Create: `src/renderer/src/pages/learning/components/CourseTab.tsx`
- Create: `src/renderer/src/pages/learning/components/CourseCard.tsx`
- Create: `src/renderer/src/pages/learning/components/DocumentTab.tsx`
- Create: `src/renderer/src/pages/learning/components/DocumentCard.tsx`
- Create: `src/renderer/src/pages/learning/components/HotSearchPanel.tsx`

**Step 1: 创建主页面容器**

```typescript
// src/renderer/src/pages/learning/LearningCenterPage.tsx
import { Spin } from 'antd'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'

import CarouselBanner from './components/CarouselBanner'
import HotSearchPanel from './components/HotSearchPanel'
import LearningTabs from './components/LearningTabs'
import PromotionBanner from './components/PromotionBanner'
import { useLearningCenter } from './hooks/useLearningCenter'

const LearningCenterPage: FC = () => {
  const { t } = useTranslation()
  const { data, hotItems, loading, error, noMoreHotItems, refreshHotItems } = useLearningCenter()

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spin size="large" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-red-500">
        {error}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        {t('learningCenter.empty.title')}
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <PromotionBanner stats={data.stats} />
      <CarouselBanner banners={data.banners} />
      <div className="mt-6 flex gap-6">
        <div className="flex-1">
          <LearningTabs
            courseCategories={data.courseCategories}
            documentCategories={data.documentCategories}
          />
        </div>
        <div className="w-80 shrink-0">
          <HotSearchPanel
            items={hotItems}
            onRefresh={refreshHotItems}
            noMore={noMoreHotItems}
          />
        </div>
      </div>
    </div>
  )
}

export default LearningCenterPage
```

**Step 2-8: 创建各子组件**

依次创建以下组件（每个组件参考计划中布局描述）：

- **PromotionBanner.tsx**：渐变背景 + 统计数字（totalCourses, totalDocuments, totalViews）
- **CarouselBanner.tsx**：Ant Design `<Carousel autoplay>` + `banners` 数组渲染，banner 无 linkUrl 时禁用点击
- **LearningTabs.tsx**：`<Tabs>` 切换 CourseTab / DocumentTab
- **CourseTab.tsx**：子分类卡片 + 每个分类下的 CourseCard 列表，空状态提示
- **CourseCard.tsx**：封面图（fallback）、标题（line-clamp-2）、时长格式化（mm:ss）、作者
- **DocumentTab.tsx**：子分类 + DocumentCard 列表
- **DocumentCard.tsx**：封面图（fallback）、标题（line-clamp-2）、链接类型图标、作者
- **HotSearchPanel.tsx**：标题 + "换一批"按钮 + 列表 + tag 标签 + 热度（万）+ "没有更多了"提示

**空值处理要点（所有组件）：**
- `coverUrl` 为 null → 默认占位图 + `<img onError>` fallback
- `duration === 0` → 显示 "00:00" 或隐藏
- `author` 为 null → 隐藏作者行
- `tag` 为 null → 不显示标签
- Banner `linkUrl` 为空 → `cursor: default`，不跳转

**Step 9: 运行类型检查**

Run: `cd /Users/yadea/Documents/pythonWorkSpace/cherry-studio && pnpm typecheck`
Expected: PASS

**Step 10: Commit**

```bash
git add src/renderer/src/pages/learning/
git commit --signoff -m "feat: add learning center page with all sub-components"
```

---

## Task 13: i18n 翻译

**Files:**
- Modify: `src/renderer/src/i18n/locales/en-us.json`
- Modify: `src/renderer/src/i18n/locales/zh-cn.json`

**Step 1: 添加英文翻译 key**

在 `en-us.json` 添加：

```json
"learningCenter.title": "Learning Center",
"learningCenter.promotion.title": "From Beginner to Expert",
"learningCenter.promotion.subtitle": "Master efficient usage tips",
"learningCenter.promotion.viewMore": "View More",
"learningCenter.tabs.courses": "Featured Courses",
"learningCenter.tabs.documents": "Featured Documents",
"learningCenter.hotSearch.title": "Trending Searches",
"learningCenter.hotSearch.refresh": "Refresh",
"learningCenter.hotSearch.noMore": "No more items",
"learningCenter.hotSearch.tagHot": "Hot",
"learningCenter.hotSearch.tagNew": "New",
"learningCenter.stats.courses": " courses",
"learningCenter.stats.documents": " documents",
"learningCenter.stats.views": " views",
"learningCenter.empty.title": "No learning content yet",
"learningCenter.empty.courses": "No courses available",
"learningCenter.empty.documents": "No documents available",
"learningCenter.empty.hotSearch": "No trending searches"
```

**Step 2: 添加中文翻译 key**

在 `zh-cn.json` 添加：

```json
"learningCenter.title": "学习中心",
"learningCenter.promotion.title": "从入门到精通",
"learningCenter.promotion.subtitle": "掌握高效使用秘诀",
"learningCenter.promotion.viewMore": "查看更多",
"learningCenter.tabs.courses": "精选视频课",
"learningCenter.tabs.documents": "精选知识文档",
"learningCenter.hotSearch.title": "大家都在搜",
"learningCenter.hotSearch.refresh": "换一批",
"learningCenter.hotSearch.noMore": "没有更多了",
"learningCenter.hotSearch.tagHot": "热",
"learningCenter.hotSearch.tagNew": "新",
"learningCenter.stats.courses": "门视频课",
"learningCenter.stats.documents": "篇知识文档",
"learningCenter.stats.views": "次学习访问",
"learningCenter.empty.title": "暂无学习内容",
"learningCenter.empty.courses": "暂无课程",
"learningCenter.empty.documents": "暂无文档",
"learningCenter.empty.hotSearch": "暂无热搜"
```

**Step 3: 同步 i18n key**

Run: `cd /Users/yadea/Documents/pythonWorkSpace/cherry-studio && pnpm i18n:sync`
Expected: 新的 key 同步到所有语言文件

**Step 4: Commit**

```bash
git add src/renderer/src/i18n/
git commit --signoff -m "feat: add learning center i18n translations"
```

---

## Task 14: 代码质量验证

**Files:** 无新文件

**Step 1: 运行 lint**

Run: `cd /Users/yadea/Documents/pythonWorkSpace/cherry-studio && pnpm lint`
Expected: PASS（修复任何 lint 问题）

**Step 2: 运行测试**

Run: `cd /Users/yadea/Documents/pythonWorkSpace/cherry-studio && pnpm test`
Expected: PASS

**Step 3: 运行格式化**

Run: `cd /Users/yadea/Documents/pythonWorkSpace/cherry-studio && pnpm format`
Expected: PASS

**Step 4: 运行类型检查**

Run: `cd /Users/yadea/Documents/pythonWorkSpace/cherry-studio && pnpm typecheck`
Expected: PASS

**Step 5: Commit（如有格式化变更）**

```bash
git add -A
git commit --signoff -m "chore: format and lint fixes for learning center feature"
```

---

## 边界值与空值处理规范（参考）

### 数据库层 NULL 约束

| 字段 | 约束 | 原因 |
|------|------|------|
| `lc_banners.title` | `.notNull()` | Banner 标题不应为空 |
| `lc_banners.imageUrl` | `.notNull()` | 无图片的 Banner 无意义 |
| `lc_banners.linkUrl` | 允许 NULL | 纯展示型 Banner 无需跳转 |
| `lc_courses.categoryId` | FK SET NULL | 级联删除风险保护 |
| `lc_courses.videoUrl` | `.notNull()` | 视频课无链接无意义 |
| `lc_courses.duration` | `.notNull().default(0)` | 避免前端 null 判断 |
| `lc_documents.categoryId` | FK SET NULL | 级联删除风险保护 |
| `lc_documents.linkUrl` | `.notNull()` | 文档无链接无意义 |
| `lc_hot_items.linkUrl` | `.notNull()` | 热搜条目无链接无意义 |
| `lc_hot_items.heatValue` | `.notNull().default(0)` | 避免 null 排序问题 |

### API 分页边界

| 场景 | 处理 |
|------|------|
| `page=0` / `page=-1` | Zod `.min(1)` → 400 |
| `pageSize=0` / `pageSize=9999` | Zod `.min(1).max(100)` → 400 |
| 参数缺失 | Zod `.default()` 提供默认值 |
| UUID 格式无效 | Zod `.uuid()` → 400 |

### "换一批"边界

| 场景 | 处理 |
|------|------|
| exclude 为空 | 返回随机 10 条 |
| 所有热搜已排除 | 返回 `[]`，前端显示"没有更多了" |
| 快速连续点击 | 前端 debounce（300ms） |

### 客户端 UI 空值

| 场景 | 处理 |
|------|------|
| `coverUrl` 为 null | 默认占位图 + `onError` fallback |
| `duration === 0` | 显示 "00:00" 或隐藏 |
| `author` 为 null | 隐藏作者行 |
| `tag` 为 null | 不显示标签 badge |
| Banner `linkUrl` 为空 | `cursor: default`，不跳转 |

---

## 完整修改文件清单

### 新建文件（约 18 个）

| # | 文件路径 |
|---|---------|
| 1 | `packages/enterprise-shared/src/types/learning-center.ts` |
| 2 | `packages/enterprise-shared/src/schemas/learning-center.ts` |
| 3 | `packages/server/src/migrations/add-learning-center-permissions.sql` |
| 4 | `packages/server/src/routes/learning-center.ts` |
| 5 | `packages/admin/src/services/learningCenterApi.ts` |
| 6 | `packages/admin/src/pages/LearningCenter/index.tsx` |
| 7 | `packages/admin/src/pages/LearningCenter/BannerManager.tsx` |
| 8 | `packages/admin/src/pages/LearningCenter/CourseManager.tsx` |
| 9 | `packages/admin/src/pages/LearningCenter/DocumentManager.tsx` |
| 10 | `packages/admin/src/pages/LearningCenter/HotItemManager.tsx` |
| 11 | `src/renderer/src/pages/learning/LearningCenterPage.tsx` |
| 12 | `src/renderer/src/pages/learning/hooks/useLearningCenter.ts` |
| 13 | `src/renderer/src/pages/learning/components/PromotionBanner.tsx` |
| 14 | `src/renderer/src/pages/learning/components/CarouselBanner.tsx` |
| 15 | `src/renderer/src/pages/learning/components/LearningTabs.tsx` |
| 16 | `src/renderer/src/pages/learning/components/CourseTab.tsx` |
| 17 | `src/renderer/src/pages/learning/components/CourseCard.tsx` |
| 18 | `src/renderer/src/pages/learning/components/DocumentTab.tsx` |
| 19 | `src/renderer/src/pages/learning/components/DocumentCard.tsx` |
| 20 | `src/renderer/src/pages/learning/components/HotSearchPanel.tsx` |

### 修改文件（约 15 个）

| # | 文件路径 | 修改内容 |
|---|---------|---------|
| 1 | `packages/enterprise-shared/src/types/index.ts` | RolePermissions + LearningCenterPermission |
| 2 | `packages/enterprise-shared/src/index.ts` | 导出 learning-center 类型 |
| 3 | `packages/enterprise-shared/src/constants/index.ts` | API_ROUTES + DEFAULT_ROLE_PERMISSIONS + BANNER_IMAGE_LIMITS |
| 4 | `packages/enterprise-shared/src/schemas/index.ts` | 导出 + rolePermissionsSchema |
| 5 | `packages/server/src/models/schema.ts` | 6 张表 + relations |
| 6 | `packages/server/src/routes/index.ts` | 注册学习中心路由 |
| 7 | `packages/admin/src/App.tsx` | 学习中心路由 |
| 8 | `packages/admin/src/components/Layout.tsx` | 侧边栏菜单 |
| 9 | `packages/admin/src/pages/Roles.tsx` | permissionCategories 修复 |
| 10 | `src/renderer/src/types/index.ts` | SidebarIcon 类型 |
| 11 | `src/renderer/src/config/sidebar.ts` | DEFAULT_SIDEBAR_ICONS |
| 12 | `src/renderer/src/components/app/Sidebar.tsx` | iconMap + pathMap |
| 13 | `src/renderer/src/i18n/label.ts` | sidebarIconKeyMap |
| 14 | `src/renderer/src/store/migrate.ts` | v196 迁移 |
| 15 | `src/renderer/src/store/index.ts` | version 195→196 |
| 16 | `src/renderer/src/Router.tsx` | /learning 路由 |
| 17 | `src/renderer/src/services/EnterpriseApi.ts` | 新增 2 个方法 |
| 18 | `src/renderer/src/i18n/locales/en-us.json` | i18n key |
| 19 | `src/renderer/src/i18n/locales/zh-cn.json` | i18n key |

---

## 验证方案

### 服务端

```bash
cd packages/server
pnpm db:push          # 推送 schema
pnpm dev              # 启动
# curl 验证 CRUD API（空数据/分页边界/UUID 验证/权限验证）
```

### Admin

```bash
cd packages/admin
pnpm dev
# 手动创建 Banner、课程、文档、热搜
# 测试分类删除确认交互
```

### 客户端

```bash
pnpm dev              # Electron
# 1. 侧边栏 → 学习中心图标
# 2. 宣传位统计数据
# 3. 轮播 Banner
# 4. 视频课/文档标签页 + 子分类
# 5. "换一批"热搜
```

### 边界值验证

```bash
# 空数据场景：不创建数据 → 访问客户端页面 → 空状态，无 JS 错误
# 分页边界：page=0 → 400, pageSize=999 → 400
# UUID 验证：/courses/not-uuid → 400
# 换一批边界：全部排除 → []，前端显示"没有更多了"
# 级联删除：删除分类 → 课程 categoryId → NULL
# 权限验证：user 角色 POST → 403
# 跨租户隔离：公司 A token → 公司 B 资源 → 404
```

### 代码质量

```bash
pnpm lint && pnpm test && pnpm format && pnpm typecheck
```

---

## 关键复用

| 现有模块 | 复用方式 |
|---------|---------|
| `assistant-presets.ts` 路由模式 | CRUD API 结构模板 |
| `authenticate` + `requirePermission` 中间件 | 认证 + 权限控制 |
| `validate` 中间件 + Zod Schema | 请求验证 |
| `enterprise-shared` 类型包 | 前后端共享类型 |
| `EnterpriseApi.ts` fetch 封装 | 客户端 API |
| Admin `api.ts` axios 实例 | Admin API 服务 |
| `migrate.ts` v195 (openclaw) | sidebar 迁移模式 |
| `DEFAULT_PAGINATION` 常量 | 分页默认值 |
| `Roles.tsx` permissionCategories | 权限矩阵 UI |
| `Layout.tsx` hasPermission 守卫 | 菜单权限控制 |

---

## 审查修订附录（4 维度 SubAgent 审查结果）

> 以下修订基于 4 个并行 SubAgent 审查（架构、安全、数据库、前端一致性）的综合结果。
> 所有修改需在对应 Task 实施时一并落实，按严重级别排序。

---

### 🔴 CRITICAL — 必须在实施前修正

#### C1: URL XSS 漏洞 — Zod `.url()` 接受 `javascript:` 协议

**影响 Task:** 2（Zod Schema）
**问题:** `z.string().url()` 允许 `javascript:alert(1)` 通过验证。`linkUrl`、`videoUrl`、`imageUrl`、`coverUrl` 等所有 URL 字段均受影响。
**修正:** 在 `packages/enterprise-shared/src/schemas/learning-center.ts` 顶部添加安全 URL 验证器：

```typescript
// 安全 URL 验证器 — 仅允许 http(s) 协议
const safeUrl = z.string().url().refine(
  (url) => /^https?:\/\//i.test(url),
  { message: 'URL must use http or https protocol' }
)
```

替换所有 Schema 中的 `z.string().url()` 为 `safeUrl`：
- `createBannerSchema.imageUrl` → `safeUrl`
- `createBannerSchema.linkUrl` → `safeUrl.optional()`
- `createCourseSchema.coverUrl` → `safeUrl.optional()`
- `createCourseSchema.videoUrl` → `safeUrl`
- `createDocumentSchema.coverUrl` → `safeUrl.optional()`
- `createDocumentSchema.linkUrl` → `safeUrl`
- `createHotItemSchema.linkUrl` → `safeUrl`
- 以及所有对应的 `update*Schema` 同理

#### C2: `createPaginatedResponse` 不存在 ✅ 已修正

**影响 Task:** 6（API 路由）
**问题:** 计划引用 `import { createPaginatedResponse } from '../utils/response'`，但此文件和函数均不存在。
**修正:** 已在本次修订中完成 —— 改为 `import { createSuccessResponse, createPagination } from '@cherry-studio/enterprise-shared'`，分页调用改为 `createSuccessResponse(items, createPagination(total, { page, pageSize }))`。

---

### 🟠 HIGH — 必须在实施中落实

#### H1: 所有路由缺少速率限制

**影响 Task:** 6
**问题:** 现有代码库已有 `apiLimiter`（100/min）和 `strictLimiter`（10/min），但计划未使用任何一个。
**修正:** 在 `learning-center.ts` 路由文件顶部添加：

```typescript
import { apiLimiter, strictLimiter } from '../middleware/rate-limit.middleware'

// 对客户端聚合 API 使用 apiLimiter
router.get('/client', apiLimiter, async (req, res, next) => { ... })
router.get('/client/hot-items', apiLimiter, async (req, res, next) => { ... })

// 对所有写入操作使用 strictLimiter
router.post('/banners', strictLimiter, requirePermission(...), ...)
router.patch('/banners/:id', strictLimiter, requirePermission(...), ...)
router.delete('/banners/:id', strictLimiter, requirePermission(...), ...)
// ... 其余所有 POST/PATCH/DELETE 同理
```

#### H2: 缺少复合索引 — 客户端查询性能

**影响 Task:** 4（数据库层）
**问题:** 客户端 `GET /client` 的 WHERE 条件 `(companyId, isEnabled)` + ORDER BY `(order)` 需要复合索引，单 `companyId` 索引不够。
**修正:** 为 4 张表添加复合索引（替换原单列索引）：

```typescript
// lcBanners — 替换原 lc_banners_company_id_idx
(table) => [
  index('lc_banners_company_enabled_order_idx').on(table.companyId, table.isEnabled, table.order)
]

// lcCourseCategories
(table) => [
  index('lc_course_categories_company_enabled_order_idx').on(table.companyId, table.isEnabled, table.order)
]

// lcDocumentCategories
(table) => [
  index('lc_doc_categories_company_enabled_order_idx').on(table.companyId, table.isEnabled, table.order)
]

// lcHotItems
(table) => [
  index('lc_hot_items_company_enabled_order_idx').on(table.companyId, table.isEnabled, table.order)
]

// lcCourses — 保留 categoryId 索引 + 新增复合索引
(table) => [
  index('lc_courses_company_enabled_order_idx').on(table.companyId, table.isEnabled, table.order),
  index('lc_courses_category_id_idx').on(table.categoryId)
]

// lcDocuments — 同理
(table) => [
  index('lc_documents_company_enabled_order_idx').on(table.companyId, table.isEnabled, table.order),
  index('lc_documents_category_id_idx').on(table.categoryId)
]
```

#### H3: `docViewStats` 未加入 `Promise.all` — 串行查询

**影响 Task:** 6 行 871-877
**问题:** 客户端聚合 API 中 7 个并行查询后又串行执行 `docViewStats`，浪费一次数据库往返。
**修正:** 合并课程和文档的 SUM 查询为一个 SQL，并加入 Promise.all：

```typescript
// 替换原有的两次分开查询（viewStats + docViewStats），合并为一次
// 在 Promise.all 中替换第 7 个查询为：
db.execute(sql`
  SELECT
    COALESCE((SELECT SUM(view_count) FROM lc_courses WHERE company_id = ${companyId} AND is_enabled = true), 0) AS course_views,
    COALESCE((SELECT SUM(view_count) FROM lc_documents WHERE company_id = ${companyId} AND is_enabled = true), 0) AS doc_views
`).then(rows => ({
  courseViews: Number(rows[0]?.course_views ?? 0),
  docViews: Number(rows[0]?.doc_views ?? 0)
}))
```

这样将 8 次查询 → 7 次并行查询，并且消除 `docViewStats` 串行瓶颈。同时移除 L871-877 的 `docViewStats` 额外查询。

#### H4: Banner 上传端点缺失实现

**影响 Task:** 3 + 6
**问题:** `API_ROUTES.LEARNING_CENTER.BANNER_UPLOAD` 已声明路由，但 Task 6 路由文件中未实现上传端点。
**修正:** 在 Task 6 路由文件中添加 Banner 图片上传端点。参考现有 `knowledge-bases.ts` 的文件上传模式：

```typescript
import multer from 'multer'
import { BANNER_IMAGE_LIMITS } from '@cherry-studio/enterprise-shared'

const bannerUpload = multer({
  limits: { fileSize: BANNER_IMAGE_LIMITS.MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (BANNER_IMAGE_LIMITS.ALLOWED_MIME_TYPES.includes(file.mimetype as any)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type'))
    }
  }
})

router.post('/banners/upload',
  strictLimiter,
  requirePermission('learningCenter', 'write'),
  bannerUpload.single('image'),
  async (req, res, next) => {
    try {
      // 保存文件并返回 URL
      // 具体实现参考现有文件上传模式
      const imageUrl = `/uploads/banners/${req.file!.filename}`
      res.json(createSuccessResponse({ imageUrl }))
    } catch (err) {
      next(err)
    }
  }
)
```

#### H5: 客户端聚合 API 缺少 `read` 权限检查

**影响 Task:** 6 行 803
**问题:** `GET /client` 和 `GET /client/hot-items` 仅使用 `authenticate`，未检查 `learningCenter` 的 `read` 权限。若某角色的 `learningCenter` 权限为空数组 `[]`，该用户仍可访问学习中心数据。
**修正:** 评估是否需要添加 `requirePermission('learningCenter', 'read')` 到客户端 API。如果学习中心对所有认证用户开放，则保持现状但添加注释说明设计意图：

```typescript
// 客户端聚合 API — 所有认证用户可访问（无需 learningCenter.read 权限）
// 设计意图：学习中心为全员开放的信息门户
router.get('/client', apiLimiter, async (req, res, next) => { ... })
```

---

### 🟡 MEDIUM — 建议实施中处理

#### M1: `exclude` 参数无最大长度限制

**影响 Task:** 2 行 324-338
**修正:** 在 `hotItemsRefreshQuerySchema` 添加长度校验：

```typescript
export const hotItemsRefreshQuerySchema = z.object({
  exclude: z
    .string()
    .max(740) // 36 chars * 20 items + 20 commas ≈ 740
    .optional()
    .transform((v) => {
      if (!v) return []
      const ids = v.split(',').filter(Boolean)
      if (ids.length > 20) {
        throw new Error('Maximum 20 exclude IDs allowed')
      }
      // ...rest same
    })
})
```

#### M2: `viewCount` 缺少安全递增 API

**影响 Task:** 6
**问题:** `viewCount` 字段仅通过 PATCH 更新，存在并发覆盖风险。
**修正:** 添加原子递增端点：

```typescript
// POST /courses/:id/view — 原子递增浏览计数
router.post('/courses/:id/view', apiLimiter, validate(lcIdParamSchema, 'params'), async (req, res, next) => {
  try {
    const companyId = req.user!.companyId
    const [updated] = await db
      .update(lcCourses)
      .set({ viewCount: sql`${lcCourses.viewCount} + 1` })
      .where(and(eq(lcCourses.id, req.params.id), eq(lcCourses.companyId, companyId)))
      .returning({ viewCount: lcCourses.viewCount })
    if (!updated) {
      return res.status(404).json({ success: false, error: { code: 'RES_3001', message: 'Course not found' } })
    }
    res.json(createSuccessResponse({ viewCount: updated.viewCount }))
  } catch (err) {
    next(err)
  }
})

// POST /documents/:id/view — 原子递增
router.post('/documents/:id/view', apiLimiter, validate(lcIdParamSchema, 'params'), async (req, res, next) => {
  // 同上模式
})
```

#### M3: `linkType` 和 `tag` 缺少数据库级约束

**影响 Task:** 4
**修正:** 使用 Drizzle 的 `check` 约束或 PostgreSQL CHECK：

```typescript
// lcBanners.linkType — 添加 CHECK 约束（可选，Zod 已在应用层校验）
linkType: varchar('link_type', { length: 20 }).default('external'),
// 注意：Drizzle ORM 对 CHECK 约束支持有限，建议通过 SQL 迁移添加：
// ALTER TABLE lc_banners ADD CONSTRAINT lc_banners_link_type_check CHECK (link_type IN ('internal', 'external'));
```

#### M4: SQL 迁移缺少事务包装和 `is_system` 条件

**影响 Task:** 5
**修正:** 完善迁移脚本：

```sql
BEGIN;

-- 为内建角色补充 learningCenter 权限（仅更新 is_system = true 的角色）
UPDATE roles
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),  -- NULL 防御
  '{learningCenter}',
  '["read", "write", "admin"]'::jsonb
)
WHERE permissions->>'learningCenter' IS NULL
  AND is_system = true
  AND name IN ('super_admin', 'admin');

UPDATE roles
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{learningCenter}',
  '["read"]'::jsonb
)
WHERE permissions->>'learningCenter' IS NULL
  AND is_system = true
  AND name IN ('manager', 'user');

-- assistantPresets 补齐（同理添加 is_system 和 COALESCE）
UPDATE roles
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{assistantPresets}',
  '["read", "write", "admin"]'::jsonb
)
WHERE permissions->>'assistantPresets' IS NULL
  AND is_system = true
  AND name IN ('super_admin', 'admin');

COMMIT;
```

#### M5: `companiesRelations` 未更新

**影响 Task:** 4
**问题:** 现有 `companiesRelations` 需添加 6 张新表的 `many` 关系，否则 Drizzle relations 查询无法从 company 端遍历学习中心数据。
**修正:** 在 `schema.ts` 中找到 `companiesRelations` 定义并追加：

```typescript
// 在 companiesRelations 中追加：
lcBanners: many(lcBanners),
lcCourseCategories: many(lcCourseCategories),
lcCourses: many(lcCourses),
lcDocumentCategories: many(lcDocumentCategories),
lcDocuments: many(lcDocuments),
lcHotItems: many(lcHotItems),
```

#### M6: 缺少 `createdBy`/`updatedBy` 审计字段

**影响 Task:** 1 + 4
**问题:** 其他表（如 `knowledge_bases`）具有操作者追踪字段，学习中心表缺失。
**建议:** 在类型和数据库表中添加可选审计字段：

```typescript
// 类型
createdBy?: string   // 操作者 userId
updatedBy?: string

// schema.ts
createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
```

实施时在路由中设置：`.values({ ...req.body, companyId, createdBy: req.user!.id })`。

#### M7: 聚合 API 缺少数量限制

**影响 Task:** 6
**问题:** `GET /client` 聚合 API 返回所有课程和文档，无最大数量限制。若数据量很大会影响响应大小。
**修正:** 在关系查询中添加 `limit`：

```typescript
with: {
  courses: {
    where: eq(lcCourses.isEnabled, true),
    orderBy: [asc(lcCourses.order), desc(lcCourses.createdAt)],
    limit: 50  // 每分类最多展示 50 门课程
  }
}
```

#### M8: 错误消息泄露用户输入

**影响 Task:** 2 行 334
**修正:** 将 `throw new Error(\`Invalid UUID in exclude: \${id}\`)` 改为不含具体值的通用消息：

```typescript
throw new Error('Invalid UUID format in exclude parameter')
```

---

### 🔵 LOW — 可选优化

#### L1: `viewCount` 使用 `integer` 可能溢出

**影响 Task:** 4
**说明:** `integer` 最大值约 21 亿。如果浏览量预期较高，可考虑使用 `bigint`。当前阶段 `integer` 足够，但应在监控中关注。

#### L2: Admin 表格缺少分页

**影响 Task:** 7（Admin 面板）
**说明:** 参考模式 `Roles.tsx` 本身无分页。如果学习中心数据量可能较大（>100 条），Admin 的 Banner/课程/文档/热搜列表应实现分页功能，参考 `assistant-presets.ts` 的前端分页模式。

#### L3: Carousel autoplay 无障碍

**影响 Task:** 12（客户端 UI）
**说明:** 轮播自动播放应提供暂停按钮，遵循 WCAG 2.1 SC 2.2.2。可在 Ant Design Carousel 配置 `autoplay` + 鼠标悬停暂停。

#### L4: Store 迁移向后兼容

**影响 Task:** 10（Redux 迁移 v196）
**说明:** 确保 `v196` 的 `migrateToV196` 函数处理 `sidebar_icons` 不存在的情况（用户从极旧版本升级），参考 `v195` 的 openclaw 迁移模式中的安全检查。

---

### 已修正问题摘要

| # | 严重级别 | 问题 | 影响 Task | 状态 |
|---|---------|------|----------|------|
| C1 | 🔴 CRITICAL | URL XSS（`javascript:` 协议） | 2 | ⏳ 待实施 |
| C2 | 🔴 CRITICAL | `createPaginatedResponse` 不存在 | 6 | ✅ 已修正 |
| H1 | 🟠 HIGH | 缺少速率限制 | 6 | ⏳ 待实施 |
| H2 | 🟠 HIGH | 缺少复合索引 | 4 | ⏳ 待实施 |
| H3 | 🟠 HIGH | `docViewStats` 串行查询 | 6 | ⏳ 待实施 |
| H4 | 🟠 HIGH | Banner 上传端点未实现 | 3+6 | ⏳ 待实施 |
| H5 | 🟠 HIGH | 客户端 API 缺 `read` 权限检查 | 6 | ⏳ 待评估 |
| M1 | 🟡 MEDIUM | `exclude` 无最大长度 | 2 | ⏳ 待实施 |
| M2 | 🟡 MEDIUM | `viewCount` 无安全递增 API | 6 | ⏳ 待实施 |
| M3 | 🟡 MEDIUM | `linkType`/`tag` 无 DB 约束 | 4 | ⏳ 待实施 |
| M4 | 🟡 MEDIUM | SQL 迁移无事务+NULL防御 | 5 | ⏳ 待实施 |
| M5 | 🟡 MEDIUM | `companiesRelations` 未更新 | 4 | ⏳ 待实施 |
| M6 | 🟡 MEDIUM | 缺 `createdBy`/`updatedBy` | 1+4 | ⏳ 待实施 |
| M7 | 🟡 MEDIUM | 聚合 API 无数量限制 | 6 | ⏳ 待实施 |
| M8 | 🟡 MEDIUM | 错误消息泄露输入值 | 2 | ⏳ 待实施 |
| L1 | 🔵 LOW | `viewCount` integer 溢出风险 | 4 | 📝 已记录 |
| L2 | 🔵 LOW | Admin 表格缺分页 | 7 | 📝 已记录 |
| L3 | 🔵 LOW | Carousel 无障碍 | 12 | 📝 已记录 |
| L4 | 🔵 LOW | Store 迁移兼容性 | 10 | 📝 已记录 |

---

### 前端一致性审查结论

**一致性评分：95%**

| 审查维度 | 结果 |
|---------|------|
| Admin Table+Modal CRUD 模式（Roles.tsx） | ✅ 一致 |
| 客户端页面布局（OpenClawPage 参考） | ✅ 一致 |
| Sidebar 集成（iconMap/pathMap/SidebarIcon） | ✅ 一致，行号精确 |
| Store 迁移 v195→196 | ✅ 一致 |
| Router 路由注册 | ✅ 一致 |
| EnterpriseApi 方法风格 | ✅ 一致 |
| i18n key 命名 | ✅ 一致 |
| lucide-react 图标大小(18) | ✅ 一致 |

**风险提示：**
- Admin 分页：Roles.tsx 无分页，但学习中心数据量可能更大，需评估
- Store 迁移：确保 `sidebar_icons` 字段不存在时的 fallback 处理
