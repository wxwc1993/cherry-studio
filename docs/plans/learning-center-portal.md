# 学习中心门户页面 — 实现计划

## Context

雅迪企业版需要一个"学习中心"门户页面，帮助员工集中学习 AI 相关知识。该页面包含宣传位（知识存储量实时统计 + 海报）、3 张轮播 Banner、精选视频课（分入门/进阶/高阶）、精选知识文档（分入门必读/功能实操/高阶进修）、以及"大家都在搜"热搜要闻版块。

**用户确认的决策：**
- 内容来源：管理员在 Admin 后台手动录入
- 宣传位数据：实时统计后台已录入的课程数/文档数
- 热搜要闻：管理员手动维护，标注【热/新】标签
- 入口位置：侧边栏新增图标

---

## Phase 1: 数据库层 — 新增 6 张表

**文件:** `packages/server/src/models/schema.ts`

所有新表遵循现有模式：uuid 主键 + companyId 多租户 + createdAt/updatedAt 时间戳 + companyId 索引。

> ⚠️ **重要变更（补充审查）**：
> - 分类与资源的 FK 使用 `SET NULL` 而非 `CASCADE`（见 [3.7 级联删除策略](#37--级联删除策略--分类与资源)）
> - 部分字段 NULL 约束已修正（见 [3.1 字段 NULL 约束修正](#31-数据库层--字段-null-约束修正)）
> - 排序使用 `ORDER BY order ASC, createdAt DESC` 确保稳定性

### 1.1 `lc_banners` — 轮播 Banner 表

```
{
  id: uuid PK,
  companyId: uuid FK → companies.id (CASCADE),
  title: varchar(200) NOT NULL,       // Banner 标题（不应为空）
  imageUrl: text NOT NULL,             // 图片 URL（OSS，无图片的 Banner 无意义）
  linkUrl: text,                       // 点击跳转链接（允许 NULL，纯展示型 Banner 无需跳转）
  linkType: varchar(20) default 'external',  // 'internal' | 'external'（linkUrl 为空时也应为空）
  order: integer default 0,            // 排序
  isEnabled: boolean default true,
  createdAt, updatedAt
}
// 索引: companyId
```

### 1.2 `lc_course_categories` — 视频课程分类表

```
{
  id: uuid PK,
  companyId: uuid FK → companies.id (CASCADE),
  name: varchar(100) NOT NULL,         // 分类名（入门课程/进阶课程/高阶课程）
  order: integer default 0,
  isEnabled: boolean default true,
  createdAt, updatedAt
}
// 索引: companyId
```

### 1.3 `lc_courses` — 视频课程表

```
{
  id: uuid PK,
  companyId: uuid FK → companies.id (CASCADE),
  categoryId: uuid FK → lc_course_categories.id (SET NULL),  // ⚠️ SET NULL 而非 CASCADE
  title: varchar(300) NOT NULL,        // 课程标题
  description: text,                   // 课程描述（允许 NULL，可选）
  coverUrl: text,                      // 封面图 URL（允许 NULL，无封面时使用默认占位图）
  videoUrl: text NOT NULL,             // 视频链接（不应为空，视频课无链接无意义）
  duration: integer NOT NULL default 0, // 时长（秒，NOT NULL + 默认 0 避免前端 null 判断）
  author: varchar(100),                // 讲师（允许 NULL，可选）
  order: integer default 0,
  isEnabled: boolean default true,
  isRecommended: boolean default false, // 推荐标记
  viewCount: integer default 0,        // 浏览次数
  createdAt, updatedAt
}
// 索引: companyId, categoryId
```

### 1.4 `lc_document_categories` — 文档分类表

```
{
  id: uuid PK,
  companyId: uuid FK → companies.id (CASCADE),
  name: varchar(100) NOT NULL,         // 分类名（入门必读/功能实操/高阶进修）
  order: integer default 0,
  isEnabled: boolean default true,
  createdAt, updatedAt
}
// 索引: companyId
```

### 1.5 `lc_documents` — 知识文档表

```
{
  id: uuid PK,
  companyId: uuid FK → companies.id (CASCADE),
  categoryId: uuid FK → lc_document_categories.id (SET NULL),  // ⚠️ SET NULL 而非 CASCADE
  title: varchar(300) NOT NULL,        // 文档标题
  description: text,                   // 文档描述（允许 NULL，可选）
  coverUrl: text,                      // 封面图 URL（允许 NULL，可选）
  linkUrl: text NOT NULL,              // 文档链接（不应为空，文档无链接无意义）
  linkType: varchar(20) default 'external',  // 'internal' | 'external'
  author: varchar(100),                // 作者（允许 NULL，可选）
  order: integer default 0,
  isEnabled: boolean default true,
  isRecommended: boolean default false, // 推荐标记
  viewCount: integer default 0,        // 浏览次数
  createdAt, updatedAt
}
// 索引: companyId, categoryId
```

### 1.6 `lc_hot_items` — 热搜要闻表

```
{
  id: uuid PK,
  companyId: uuid FK → companies.id (CASCADE),
  title: varchar(300) NOT NULL,        // 要闻标题
  linkUrl: text NOT NULL,              // 跳转链接（不应为空，热搜条目无链接无意义）
  tag: varchar(10),                    // 'hot' | 'new' | null（允许 NULL，部分条目无标签）
  heatValue: integer NOT NULL default 0, // 热度值（万，NOT NULL 避免 null 排序问题）
  order: integer default 0,
  isEnabled: boolean default true,
  createdAt, updatedAt
}
// 索引: companyId
```

### 1.7 Drizzle 关系定义

在 `schema.ts` 末尾补充 `relations()` 定义：课程 ↔ 分类、文档 ↔ 分类。

### 1.8 表名冲突检查 ✅

所有新表名以 `lc_` 前缀开头，不与现有 20+ 张表冲突（companies, departments, roles, users, models, model_permissions, knowledge_bases, kb_permissions, kb_documents, document_chunks, conversations, messages, model_pricing, usage_logs, backups, refresh_tokens, audit_logs, assistant_preset_tags, assistant_presets, assistant_preset_tag_relations）。新增的 relations 定义只涉及新表之间的关系，不影响现有关系。

---

## Phase 2: 共享类型层 + 权限类型 + API 路由常量

**文件:** `packages/enterprise-shared/src/`

### 2.1 新增类型文件 `types/learning-center.ts`

- `LcBanner`, `LcCourseCategory`, `LcCourse`, `LcDocumentCategory`, `LcDocument`, `LcHotItem`
- `LcClientData`（客户端聚合响应类型）
- `LcStats`（宣传位统计数据类型）

### 2.2 新增 Schema 文件 `schemas/learning-center.ts`

- CRUD 操作的 Zod 验证 Schema
- 查询参数 Schema（含分页参数边界验证，见 [3.2 分页参数边界](#32-api-层--分页参数边界)）
- UUID 参数验证 Schema（见 [3.3 UUID 参数验证](#33-uuid-参数验证)）

### 2.3 🔴 更新 `types/index.ts` — 权限类型

**文件:** `packages/enterprise-shared/src/types/index.ts`

`RolePermissions` 接口新增 `learningCenter` 字段。**必须使用 `?:` 可选属性**，保证与旧数据兼容（旧 JWT 中不含此字段不会导致类型错误）：

```typescript
export type LearningCenterPermission = 'read' | 'write' | 'admin'

export interface RolePermissions {
  models: ModelPermission[]
  knowledgeBases: KnowledgeBasePermission[]
  users: UserPermission[]
  statistics: StatisticsPermission[]
  system: SystemPermission[]
  assistantPresets: AssistantPresetPermission[]
  learningCenter?: LearningCenterPermission[]  // ← 必须可选
}
```

### 2.4 🔴 更新 `constants/index.ts` — 默认权限 + API 路由

**文件:** `packages/enterprise-shared/src/constants/index.ts`

#### DEFAULT_ROLE_PERMISSIONS 各角色添加 `learningCenter`

```typescript
const DEFAULT_ROLE_PERMISSIONS = {
  [SYSTEM_ROLES.SUPER_ADMIN]: {
    // ... 现有字段 ...
    learningCenter: ['read', 'write', 'admin']
  },
  [SYSTEM_ROLES.ADMIN]: {
    // ... 现有字段 ...
    learningCenter: ['read', 'write', 'admin']
  },
  [SYSTEM_ROLES.MANAGER]: {
    // ... 现有字段 ...
    learningCenter: ['read']
  },
  [SYSTEM_ROLES.USER]: {
    // ... 现有字段 ...
    learningCenter: ['read']
  }
}
```

#### API_ROUTES 新增学习中心路由常量

```typescript
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

#### Banner 图片上传限制常量（独立于知识库 FILE_LIMITS）

```typescript
export const BANNER_IMAGE_LIMITS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
} as const
```

### 2.5 更新 `index.ts` 导出

---

## Phase 2.5: 🔴 SQL 数据迁移脚本（旧角色权限补充）

**新增步骤** — 已部署实例的角色数据迁移。

### 问题

`DEFAULT_ROLE_PERMISSIONS` 只是种子数据（创建新角色时使用），已存在的角色的 `permissions` JSONB 中没有 `learningCenter` 字段。

### 运行时安全性 ✅

`requirePermission` 中间件中 `!userPermissions || !userPermissions.includes(permission)` 会将 `undefined` 视为无权限，不会崩溃。Admin 的 `hasPermission` 使用 `?.includes() ?? false` 同样安全。

### 但需要迁移

旧角色的管理员将无法访问学习中心管理页面，需要手动到 Roles 页面编辑权限，用户体验不佳。

### 迁移 SQL

```sql
-- 为 super_admin / admin 角色添加完整权限
UPDATE roles
SET permissions = jsonb_set(
  permissions,
  '{learningCenter}',
  '["read", "write", "admin"]'::jsonb
)
WHERE permissions->>'learningCenter' IS NULL
  AND name IN ('super_admin', 'admin');

-- 为 manager 角色添加只读权限
UPDATE roles
SET permissions = jsonb_set(
  permissions,
  '{learningCenter}',
  '["read"]'::jsonb
)
WHERE permissions->>'learningCenter' IS NULL
  AND name = 'manager';

-- 为 user 角色添加只读权限
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

**涉及文件：** 需要新建 Drizzle 迁移文件或在 `db:push` 后手动执行。

---

## Phase 3: 服务端 API 层

**文件:** `packages/server/src/routes/learning-center.ts`（新建）

### 3.1 客户端聚合 API（仅需 `authenticate`，无需 admin 权限）

**`GET /learning-center/client`**

一次性返回所有学习中心数据：

```json
{
  "banners": [],
  "courseCategories": [{ "id": "...", "name": "...", "courses": [] }],
  "documentCategories": [{ "id": "...", "name": "...", "documents": [] }],
  "hotItems": [],
  "stats": {
    "totalCourses": 128,
    "totalDocuments": 356,
    "totalViews": 12800
  }
}
```

- `stats` 通过 SQL COUNT 实时计算
- 仅返回 `isEnabled: true` 的记录
- 按 `order ASC, createdAt DESC` 排序（确保 order 相同时结果稳定）
- **始终返回完整结构，不返回 `null`**（各字段均为空数组或 0，见 [3.4 聚合 API 空数据场景](#34-聚合-api-空数据场景)）

**`GET /learning-center/client/hot-items?exclude=id1,id2`**

- 用于"换一批"功能
- 排除已展示的 ID，随机返回下一批（默认 10 条）
- `exclude` 参数：逗号分隔的 UUID 字符串，服务端 `.split(',')` 解析
- 需 Zod schema 验证（见 [3.3 UUID 参数验证](#33-uuid-参数验证)）
- 边界场景处理见 [3.6 "换一批"边界场景](#36-换一批边界场景)

### 3.2 管理端 CRUD API（需 `requirePermission('learningCenter', 'write/admin')`）

**权限分级：**
- `GET` 列表：`requirePermission('learningCenter', 'read')`
- `POST` / `PATCH`：`requirePermission('learningCenter', 'write')`
- `DELETE`：`requirePermission('learningCenter', 'admin')`

**Banner 管理：**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/learning-center/banners` | 列表（分页） |
| POST | `/learning-center/banners` | 创建 |
| PATCH | `/learning-center/banners/:id` | 更新 |
| DELETE | `/learning-center/banners/:id` | 删除 |
| POST | `/learning-center/banners/upload` | 图片上传（复用 StorageService → OSS，限制见 [3.10](#310-banner-图片上传边界)） |

**课程分类管理：**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/learning-center/course-categories` | 列表 |
| POST | `/learning-center/course-categories` | 创建 |
| PATCH | `/learning-center/course-categories/:id` | 更新 |
| DELETE | `/learning-center/course-categories/:id` | 删除（SET NULL，见 [3.7](#37--级联删除策略--分类与资源)） |

**课程管理：**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/learning-center/courses` | 列表（分页 + categoryId 过滤 + "未分类"筛选） |
| POST | `/learning-center/courses` | 创建 |
| PATCH | `/learning-center/courses/:id` | 更新 |
| DELETE | `/learning-center/courses/:id` | 删除 |

**文档分类管理：**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/learning-center/document-categories` | 列表 |
| POST | `/learning-center/document-categories` | 创建 |
| PATCH | `/learning-center/document-categories/:id` | 更新 |
| DELETE | `/learning-center/document-categories/:id` | 删除（SET NULL） |

**文档管理：**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/learning-center/documents` | 列表（分页 + categoryId 过滤 + "未分类"筛选） |
| POST | `/learning-center/documents` | 创建 |
| PATCH | `/learning-center/documents/:id` | 更新 |
| DELETE | `/learning-center/documents/:id` | 删除 |

**热搜管理：**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/learning-center/hot-items` | 列表（分页） |
| POST | `/learning-center/hot-items` | 创建 |
| PATCH | `/learning-center/hot-items/:id` | 更新 |
| DELETE | `/learning-center/hot-items/:id` | 删除 |

### 3.3 注册路由

**文件:** `packages/server/src/routes/index.ts`

```typescript
import learningCenterRoutes from './learning-center'
router.use('/learning-center', learningCenterRoutes)
```

新增路由 `/learning-center` 不与任何现有路由冲突。现有路由前缀：`/auth`、`/users`、`/departments`、`/roles`、`/models`、`/knowledge-bases`、`/conversations`、`/statistics`、`/admin`、`/assistant-presets`、`/settings`。

### 3.4 RBAC 权限

在角色权限矩阵中新增 `learningCenter` 类别（见 Phase 2.3-2.4）。

---

## Phase 4: 管理面板（Admin）

**文件:** `packages/admin/src/pages/LearningCenter/`（新建目录）

### 4.1 🔴 修复 Roles.tsx permissionCategories 硬编码遗漏

**文件:** `packages/admin/src/pages/Roles.tsx`

**问题**：第 18-62 行的 `permissionCategories` 数组只包含 5 个类别（`models`、`knowledgeBases`、`users`、`statistics`、`system`），**缺少了已存在的 `assistantPresets`**。这是一个遗留 Bug。

**影响**：`handleSubmit`（第 121-123 行）只遍历 `permissionCategories` 构建 permissions 对象，会丢弃 `assistantPresets` 和将来新增的 `learningCenter` 字段。

**修复方案**：新增 `learningCenter` 时必须一并补齐 `assistantPresets`：

```typescript
const permissionCategories = [
  // ... 现有 5 个保持不变 ...
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
]
```

### 4.2 页面结构

```
pages/LearningCenter/
├── index.tsx              # 主容器（Tabs 切换）
├── BannerManager.tsx      # Banner 管理（表格 + 图片上传 + 排序拖拽）
├── CourseManager.tsx       # 课程管理（左侧分类树 + 右侧课程表格）
├── DocumentManager.tsx     # 文档管理（左侧分类树 + 右侧文档表格）
├── HotItemManager.tsx      # 热搜管理（表格 + 标签选择）
└── components/
    ├── BannerFormModal.tsx
    ├── CourseFormModal.tsx
    ├── DocumentFormModal.tsx
    ├── HotItemFormModal.tsx
    └── CategoryManager.tsx   # 分类管理弹窗（课程和文档共用）
```

### 4.3 Tabs 布局（参考截图设计）

`[Banner 管理]` | `[视频课程]` | `[知识文档]` | `[热搜要闻]`

- **Banner 管理**：表格展示（图片预览、标题、链接、排序、状态开关），支持图片上传到 OSS
- **视频课程**：左侧分类列表 + "管理分类"按钮，右侧课程卡片/表格 + 搜索 + 分页 + "未分类"筛选
- **知识文档**：左侧分类列表 + "管理分类"按钮，右侧文档表格 + 搜索 + 分页 + "未分类"筛选
- **热搜要闻**：表格展示（标题、链接、标签[热/新]选择、热度值、排序、状态开关）

### 4.4 API 服务

**文件:** `packages/admin/src/services/learningCenterApi.ts`（新建）

### 4.5 路由注册

- **文件:** `packages/admin/src/App.tsx` — 添加 `/learning-center` 路由 + `import LearningCenter`
- **文件:** `packages/admin/src/components/Layout.tsx` — 侧边栏 `menuItems` 添加学习中心入口（需 `hasPermission('learningCenter', 'read')` 守卫）

### 4.6 分类删除确认流程

删除分类时的交互流程：
1. 管理员点击删除分类
2. 前端查询该分类下的课程/文档数量
3. 弹窗确认："该分类下有 N 门课程/N 篇文档，删除分类后这些内容将变为"未分类"，确认删除？"
4. 确认后删除分类，关联的 `categoryId` 自动设为 NULL
5. 管理端列表支持按"未分类"筛选（`categoryId IS NULL`），便于管理员重新归类

---

## Phase 5: 客户端页面（Electron Renderer）

### 5.1 侧边栏集成

需要修改的文件（共 5 处）：

| 文件 | 修改内容 |
|------|---------|
| `src/renderer/src/types/index.ts` L619 | `SidebarIcon` 类型新增 `'learning_center'` |
| `src/renderer/src/config/sidebar.ts` L7 | `DEFAULT_SIDEBAR_ICONS` 数组新增 `'learning_center'` |
| `src/renderer/src/components/app/Sidebar.tsx` L135 | `iconMap` 新增 `learning_center: <GraduationCap />` |
| `src/renderer/src/components/app/Sidebar.tsx` L148 | `pathMap` 新增 `learning_center: '/learning'` |
| `src/renderer/src/i18n/label.ts` | `getSidebarIconLabel` 新增标签翻译 |

> ✅ `iconMap` 和 `pathMap` 是对象字面量，新增属性不影响现有键。`DEFAULT_SIDEBAR_ICONS` 数组追加不影响现有元素。新路由 `/learning` 不与现有路由冲突。

### 5.2 🔴 Redux persist 侧边栏迁移（version 196）

**问题**：当前 store 版本为 195（在 `src/renderer/src/store/index.ts` 第 91 行）。已有用户的 `sidebarIcons.visible` 数组不包含 `learning_center`，新图标不会自动出现。

**参考**：version 195 为 `openclaw` 做了同样的迁移（`migrate.ts` 第 3193-3207 行）。

**修复方案：**

**文件 1:** `src/renderer/src/store/migrate.ts` — 新增 version 196 迁移：

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

**文件 2:** `src/renderer/src/store/index.ts` — version 195 → 196：

```typescript
version: 196,  // was 195
```

> **注意**：`migrate.ts` 文件头部标注了 `@deprecated` 和 v2 重构冻结警告，但现有版本（如 195 添加 openclaw）仍在活跃添加迁移。此处属于必要变更，应继续沿用现有模式。

### 5.3 路由注册

**文件:** `src/renderer/src/Router.tsx`

```tsx
import LearningCenterPage from './pages/learning/LearningCenterPage'
// 在 AuthGuard 内添加:
<Route path="/learning" element={<LearningCenterPage />} />
```

### 5.4 页面组件树

```
pages/learning/
├── LearningCenterPage.tsx          # 主页面容器
├── components/
│   ├── PromotionBanner.tsx         # 顶部宣传位（统计数据 + 海报背景）
│   ├── CarouselBanner.tsx          # 轮播 Banner（3张，Ant Design Carousel）
│   ├── LearningTabs.tsx            # 主体标签页容器
│   ├── CourseTab.tsx               # 精选视频课标签页
│   ├── CourseCard.tsx              # 单个课程卡片（封面+标题+时长+作者）
│   ├── DocumentTab.tsx             # 精选知识文档标签页
│   ├── DocumentCard.tsx            # 单个文档卡片
│   └── HotSearchPanel.tsx          # 右侧热搜面板（大家都在搜）
└── hooks/
    └── useLearningCenter.ts        # 数据获取 hook
```

### 5.5 页面布局（参考截图）

```
┌───────────────────────────────────────────────────────────┐
│  PromotionBanner（渐变背景 + 统计数字 + "查看更多"按钮）     │
│  已收录 XX 门视频课  |  XX 篇知识文档  |  XX 次学习访问      │
├───────────────────────────────────────────────────────────┤
│  CarouselBanner（3张轮播图：AIDI圈、雅迪学院 等）           │
├───────────────────────────────────┬───────────────────────┤
│  LearningTabs                    │  HotSearchPanel       │
│  ┌─────────────────────────────┐ │  大家都在搜    换一批  │
│  │ [精选视频课] [精选知识文档]   │ │  ──────────────────── │
│  │ 入门课程 | 进阶课程 | 高阶课程│ │  • 条目1    377万 [热]│
│  │ ┌──────┐ ┌──────┐ ┌──────┐ │ │  • 条目2    402万 [新]│
│  │ │封面图│ │封面图│ │封面图│ │ │  • 条目3    371万 [热]│
│  │ │标题  │ │标题  │ │标题  │ │ │  • ...               │
│  │ │时长  │ │时长  │ │时长  │ │ │                      │
│  │ └──────┘ └──────┘ └──────┘ │ │                      │
│  └─────────────────────────────┘ │                      │
└──────────────────────────────────┴───────────────────────┘
```

### 5.6 API 服务扩展

**文件:** `src/renderer/src/services/EnterpriseApi.ts`

新增方法：

```typescript
getLearningCenterData(): Promise<LcClientData>
// → GET /learning-center/client

getHotItemsBatch(excludeIds: string[]): Promise<LcHotItem[]>
// → GET /learning-center/client/hot-items?exclude=...
```

> ✅ 新增方法不修改现有方法或构造函数。

### 5.7 useLearningCenter hook 关键要点

- 需处理 `enterpriseApi` 尚未初始化（`enterpriseServer` 为 null）的情况
- 需检查用户是否处于企业模式（`isEnterpriseMode`），非企业模式下不应加载数据
- "换一批"按钮需 debounce（300ms），防止快速连续点击导致并发请求

### 5.8 i18n 翻译

**文件:** `src/renderer/src/i18n/locales/en-us.json` 及 `zh-cn.json`

新增 key：

```json
{
  "learningCenter.title": "学习中心",
  "learningCenter.promotion.title": "从入门到精通",
  "learningCenter.promotion.subtitle": "掌握高效使用秘诀",
  "learningCenter.promotion.viewMore": "查看更多",
  "learningCenter.tabs.courses": "精选视频课",
  "learningCenter.tabs.documents": "精选知识文档",
  "learningCenter.courses.beginner": "入门课程",
  "learningCenter.courses.intermediate": "进阶课程",
  "learningCenter.courses.advanced": "高阶课程",
  "learningCenter.documents.mustRead": "入门必读",
  "learningCenter.documents.practical": "功能实操",
  "learningCenter.documents.advanced": "高阶进修",
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
  "learningCenter.empty.hotSearch": "暂无热搜",
  "learningCenter.category.uncategorized": "未分类",
  "learningCenter.admin.deleteCategory.confirm": "该分类下有 {count} 项内容，删除分类后这些内容将变为\"未分类\"，确认删除？"
}
```

---

## 边界值与空值处理规范

### 3.1 数据库层 — 字段 NULL 约束修正

> 已整合到 Phase 1 各表定义中。

汇总表：

| 字段 | 原计划 | 修正 | 原因 |
|------|--------|------|------|
| `lc_banners.title` | varchar(200) | `.notNull()` | Banner 标题不应为空 |
| `lc_banners.imageUrl` | text | `.notNull()` | 无图片的 Banner 无意义 |
| `lc_banners.linkUrl` | text | 允许 NULL | 纯展示型 Banner 无需跳转 |
| `lc_banners.linkType` | varchar(20) | 默认 `'external'`，允许 NULL | linkUrl 为空时 linkType 也应为空 |
| `lc_courses.categoryId` | FK CASCADE | **SET NULL** | 级联删除风险 |
| `lc_courses.description` | text | 允许 NULL | 描述为可选 |
| `lc_courses.coverUrl` | text | 允许 NULL | 无封面时使用默认占位图 |
| `lc_courses.videoUrl` | text | `.notNull()` | 视频课无链接无意义 |
| `lc_courses.duration` | integer | `.notNull().default(0)` | 避免前端 null 判断 |
| `lc_courses.author` | varchar(100) | 允许 NULL | 讲师信息可选 |
| `lc_documents.categoryId` | FK CASCADE | **SET NULL** | 级联删除风险 |
| `lc_documents.coverUrl` | text | 允许 NULL | 文档封面可选 |
| `lc_documents.linkUrl` | text | `.notNull()` | 文档无链接无意义 |
| `lc_documents.author` | varchar(100) | 允许 NULL | 作者信息可选 |
| `lc_hot_items.linkUrl` | text | `.notNull()` | 热搜条目无链接无意义 |
| `lc_hot_items.tag` | varchar(10) | 允许 NULL | 部分条目无标签 |
| `lc_hot_items.heatValue` | integer | `.notNull().default(0)` | 避免 null 排序问题 |

### 3.2 API 层 — 分页参数边界

Zod Schema 约束（参考现有 `DEFAULT_PAGINATION` 常量）：

```typescript
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
})
```

| 场景 | 处理 |
|------|------|
| `page=0` | Zod `.min(1)` 拒绝，返回 400 |
| `page=-1` | Zod `.min(1)` 拒绝，返回 400 |
| `pageSize=0` | Zod `.min(1)` 拒绝，返回 400 |
| `pageSize=9999` | Zod `.max(100)` 拒绝，返回 400 |
| 参数缺失 | Zod `.default()` 提供默认值 |
| `page=NaN` | `z.coerce.number()` 失败，返回 400 |

### 3.3 UUID 参数验证

所有 `:id` 路由参数需验证 UUID 格式：

```typescript
const idParamSchema = z.object({
  id: z.string().uuid('无效的 ID 格式')
})

// 路由中使用
router.patch('/:id', validate(idParamSchema, 'params'), ...)
```

`exclude` 参数中的每个 ID 也需验证：

```typescript
const hotItemsQuerySchema = z.object({
  exclude: z.string().optional().transform(v => {
    if (!v) return []
    const ids = v.split(',').filter(Boolean)
    ids.forEach(id => {
      if (!z.string().uuid().safeParse(id).success) {
        throw new Error(`Invalid UUID in exclude: ${id}`)
      }
    })
    return ids
  })
})
```

### 3.4 聚合 API 空数据场景

| 场景 | 返回值 | 前端处理 |
|------|--------|---------|
| 无任何 Banner | `banners: []` | CarouselBanner 组件隐藏或显示默认占位 |
| 无课程分类 | `courseCategories: []` | CourseTab 显示空状态提示 |
| 分类下无课程 | `courseCategories: [{ courses: [] }]` | 对应分类下显示"暂无课程" |
| 无文档分类 | `documentCategories: []` | DocumentTab 显示空状态提示 |
| 无热搜条目 | `hotItems: []` | HotSearchPanel 显示"暂无热搜" |
| 全部数据为空 | 各字段均为空数组，`stats` 均为 0 | 整体空状态页面 |

聚合 API 始终返回完整结构：

```typescript
res.json(createSuccessResponse({
  banners: banners ?? [],
  courseCategories: courseCategories ?? [],
  documentCategories: documentCategories ?? [],
  hotItems: hotItems ?? [],
  stats: {
    totalCourses: totalCourses ?? 0,
    totalDocuments: totalDocuments ?? 0,
    totalViews: totalViews ?? 0
  }
}))
```

### 3.5 客户端 UI 空值/无效值处理

| 场景 | 处理方案 |
|------|---------|
| `coverUrl` 为 null/undefined | 显示默认占位图（通用灰色卡片） |
| `coverUrl` 图片加载失败 | `<img onError>` 切换为默认占位图 |
| `duration` 为 0 | 显示 "00:00" 或隐藏时长标签 |
| `author` 为 null | 隐藏作者行或显示"未知" |
| `description` 为 null | 隐藏描述区域 |
| `heatValue` 为 0 | 显示 "0" 而非隐藏 |
| `tag` 为 null | 不显示标签 badge |
| Banner `linkUrl` 为空 | 禁用点击事件（`cursor: default`，无跳转） |
| 课程/文档标题截断 | CSS `text-overflow: ellipsis`，`line-clamp: 2` |

### 3.6 "换一批"边界场景

| 场景 | 处理 |
|------|------|
| `exclude` 为空字符串 | 返回随机 10 条（不过滤） |
| 所有热搜都已排除 | 返回空数组 `[]`，前端显示"没有更多了" |
| 热搜总数 < 10 | 返回所有条目（自然 LIMIT 截断） |
| exclude 中有无效 UUID | Zod 验证拒绝，返回 400 |
| 快速连续点击 | 前端 debounce（300ms），防止并发请求 |

### 3.7 🔴 级联删除策略 — 分类与资源

**问题**：原计划使用 `CASCADE` 删除，删除分类时会连带删除所有关联课程/文档。这对管理员来说可能是灾难性的误操作。

**方案**：改为 `SET NULL` + 前端确认：

```typescript
// schema.ts
categoryId: uuid('category_id')
  .references(() => lcCourseCategories.id, { onDelete: 'set null' })
```

删除流程见 Phase 4.6。

前端适配：
- `CourseManager.tsx` 的分类筛选增加"未分类"选项（`categoryId IS NULL`）
- 聚合 API 中 `categoryId IS NULL` 的资源可选择不展示或归入"其他"分类

### 3.8 并发编辑

**评估**：当前系统（Users、AssistantPresets 等）均未实现乐观锁。学习中心作为内容管理功能，并发编辑概率低。

**决策**：v1 不做特殊处理（与现有功能保持一致），后写者覆盖前写者。

### 3.9 排序字段冲突

多条记录 `order` 值相同时，SQL 排序使用 `ORDER BY order ASC, createdAt DESC`（order 相同时按创建时间倒序），确保结果稳定。

### 3.10 Banner 图片上传边界

| 场景 | 处理 |
|------|------|
| 文件大小超限 | multer `limits.fileSize`（5MB） |
| 文件类型不合法 | multer `fileFilter` 只允许 `image/jpeg, image/png, image/webp, image/gif` |
| OSS 上传失败 | 捕获异常，返回 500，前端提示"上传失败，请重试" |
| 文件名含特殊字符 | `sanitizeFilename()` 清理（复用现有工具函数） |

---

## 调用链完整性审查

### 客户端页面数据加载链路 ✅

```
用户点击侧边栏 "learning_center" 图标
  → Sidebar.tsx pathMap['learning_center'] = '/learning'
  → Router.tsx <Route path="/learning" element={<LearningCenterPage />} />
  → LearningCenterPage.tsx 挂载
  → useLearningCenter() hook → useEffect → enterpriseApi.getLearningCenterData()
  → EnterpriseApi.ts → GET ${enterpriseServer}/api/v1/learning-center/client
     headers: { Authorization: `Bearer ${accessToken}` }
  → Server routes/index.ts → router.use('/learning-center', learningCenterRoutes)
  → learning-center.ts → router.get('/client', authenticate, async handler)
     authenticate: 验证 JWT → req.user = { sub, companyId, permissions, ... }
     无需 requirePermission（所有已认证用户可访问）
  → handler: 查询 6 张表（WHERE companyId = req.user.companyId AND isEnabled = true）
  → 返回 LcClientData JSON → enterpriseApi 解析 → useLearningCenter state 更新 → UI 渲染
```

⚠️ **需补充**：`useLearningCenter` hook 需处理 `enterpriseApi` 未初始化和非企业模式场景。

### "换一批"热搜链路 ✅

```
用户点击 HotSearchPanel 的"换一批"按钮
  → debounce(300ms) → enterpriseApi.getHotItemsBatch(currentDisplayedIds)
  → GET ${enterpriseServer}/api/v1/learning-center/client/hot-items?exclude=id1,id2,id3
  → Server: authenticate → handler
  → handler: WHERE companyId = ? AND isEnabled = true AND id NOT IN (excludeIds) ORDER BY random() LIMIT 10
  → 返回 LcHotItem[] → 替换当前展示列表
```

### Admin CRUD 链路 ✅

```
Admin CourseManager.tsx
  → learningCenterApi.createCourse(formData)
  → axios.post('/learning-center/courses', formData)  (拦截器自动添加 Authorization)
  → Server: authenticate → requirePermission('learningCenter', 'write') → validate(createCourseSchema)
  → handler: INSERT INTO lc_courses VALUES (..., companyId = req.user.companyId)
  → 返回 201 + 新建课程数据
```

### Admin 路由与菜单链路

```
Admin Layout.tsx menuItems
  → hasPermission('learningCenter', 'read') → 显示菜单项
     ⚠️ 旧角色 permissions 中无 learningCenter → 返回 false → 菜单不显示
     → 需执行 Phase 2.5 的 SQL 迁移脚本
  → 菜单点击 → navigate('/learning-center')
  → App.tsx <Route path="learning-center" element={<LearningCenter />} />
  → LearningCenter/index.tsx → Tabs 渲染 4 个子组件
```

**关键**：如不执行 Phase 2.5 的迁移脚本，旧管理员将看不到学习中心菜单。

---

## 实施顺序

| 步骤 | 范围 | 预计文件数 | 备注 |
|------|------|-----------|------|
| 1 | 数据库 schema + Drizzle 迁移 | 1-2 | 注意 `SET NULL` 策略、`NOT NULL` 约束 |
| 2 | 共享类型 + Zod Schema + 权限类型 + API 路由常量 | 3-4 | 含 `RolePermissions`、`API_ROUTES`、`DEFAULT_ROLE_PERMISSIONS`、`BANNER_IMAGE_LIMITS` |
| **2.5** | **SQL 数据迁移脚本（旧角色权限补充）** | **1** | **🔴 新增步骤** |
| 3 | 服务端路由（管理端 CRUD + 客户端聚合） | 1-2 | 空值处理、分页验证、UUID 验证 |
| 4 | Admin 管理面板 | 8-10 | 含 **Roles.tsx permissionCategories 修复**、Layout.tsx 菜单、App.tsx 路由 |
| 5 | 客户端侧边栏 + 路由 + **store 迁移 (v196)** | 5-6 | 含 `migrate.ts` + `index.ts` version |
| 6 | 客户端学习中心页面组件 | 8-10 | 空状态、错误处理、图片 fallback、debounce |
| 7 | i18n 翻译 | 2-3 | 含空状态/管理端提示文案 |
| 8 | 验证 + 代码质量 | - | lint / test / format / typecheck |

**总计约 30-40 个文件**

---

## 完整修改文件清单

### 🔴 补充审查新增的必须修改文件

| 文件 | 修改内容 | 优先级 |
|------|---------|--------|
| `packages/admin/src/pages/Roles.tsx` | 补充 `assistantPresets` + `learningCenter` 到 permissionCategories | 🔴 高 |
| `packages/enterprise-shared/src/constants/index.ts` | `DEFAULT_ROLE_PERMISSIONS` 各角色添加 `learningCenter`；`API_ROUTES` 添加路由常量；`BANNER_IMAGE_LIMITS` | 🔴 高 |
| `packages/enterprise-shared/src/types/index.ts` | `RolePermissions` 接口新增 `learningCenter?: LearningCenterPermission[]`（**必须可选**） | 🔴 高 |
| `src/renderer/src/store/migrate.ts` | 新增 version 196 迁移（添加 learning_center 到 sidebarIcons） | 🔴 高 |
| `src/renderer/src/store/index.ts` | version 195 → 196 | 🔴 高 |
| SQL 迁移脚本（或 seed 脚本） | 为已有角色补充 learningCenter 权限 | 🔴 高 |
| `packages/admin/src/components/Layout.tsx` | 侧边栏 menuItems 添加学习中心入口 | 🟡 中 |
| `packages/admin/src/App.tsx` | 添加 `/learning-center` 路由 | 🟡 中 |

### 原计划已列出的文件

| 文件 | 修改内容 |
|------|---------|
| `packages/server/src/models/schema.ts` | 新增 6 张 `lc_*` 表 + relations |
| `packages/server/src/routes/learning-center.ts` | 新建 — CRUD + 聚合 API |
| `packages/server/src/routes/index.ts` | 注册 `/learning-center` 路由 |
| `packages/enterprise-shared/src/types/learning-center.ts` | 新建 — 学习中心类型 |
| `packages/enterprise-shared/src/schemas/learning-center.ts` | 新建 — Zod Schema |
| `packages/admin/src/pages/LearningCenter/` | 新建目录 — 6-8 个文件 |
| `packages/admin/src/services/learningCenterApi.ts` | 新建 — Admin API 服务 |
| `src/renderer/src/types/index.ts` | SidebarIcon 类型 |
| `src/renderer/src/config/sidebar.ts` | DEFAULT_SIDEBAR_ICONS |
| `src/renderer/src/components/app/Sidebar.tsx` | iconMap + pathMap |
| `src/renderer/src/i18n/label.ts` | getSidebarIconLabel |
| `src/renderer/src/Router.tsx` | `/learning` 路由 |
| `src/renderer/src/pages/learning/` | 新建目录 — 8-10 个文件 |
| `src/renderer/src/services/EnterpriseApi.ts` | 新增 2 个方法 |
| `src/renderer/src/i18n/locales/en-us.json` | i18n key |
| `src/renderer/src/i18n/locales/zh-cn.json` | i18n key |

---

## 验证方案

### 服务端验证

```bash
cd packages/server
pnpm db:push          # 推送 schema 变更
pnpm dev              # 启动服务端
# 使用 curl/Postman 测试 CRUD API
```

### Admin 验证

```bash
cd packages/admin
pnpm dev              # 启动管理面板
# 手动创建 Banner、课程、文档、热搜数据
```

### 客户端验证

```bash
pnpm dev              # Electron 开发模式
# 1. 确认侧边栏出现"学习中心"图标
# 2. 点击进入页面，确认宣传位统计数据正确
# 3. 确认轮播 Banner 正常滚动
# 4. 切换视频课/文档标签页，确认子分类和内容正确
# 5. 测试"换一批"热搜刷新功能
```

### 边界值验证用例

```bash
# 1. 空数据场景 — 不创建任何数据，直接访问客户端页面
# 预期：页面显示空状态，无 JS 错误

# 2. 分页边界
curl -X GET "/api/v1/learning-center/courses?page=0"        # 预期 400
curl -X GET "/api/v1/learning-center/courses?pageSize=999"   # 预期 400
curl -X GET "/api/v1/learning-center/courses?page=99999"     # 预期 200 + 空列表

# 3. UUID 验证
curl -X PATCH "/api/v1/learning-center/courses/not-a-uuid"   # 预期 400
curl -X PATCH "/api/v1/learning-center/courses/$(uuidgen)"   # 预期 404（不存在）

# 4. 换一批边界
curl -X GET "/api/v1/learning-center/client/hot-items?exclude="  # 预期 200 + 随机列表
curl -X GET "/api/v1/learning-center/client/hot-items?exclude=invalid"  # 预期 400

# 5. 级联删除验证
# 创建分类 → 在分类下创建课程 → 删除分类 → 检查课程的 categoryId 变为 NULL

# 6. 权限验证
# 用 user 角色（只有 read）尝试 POST/PATCH/DELETE → 预期 403

# 7. 跨租户隔离
# 用公司 A 的 token 访问公司 B 的资源 → 预期 404（not found）
```

### 代码质量

```bash
pnpm lint             # lint 检查
pnpm test             # 运行测试
pnpm format           # 格式化
pnpm typecheck        # 类型检查
```

---

## 关键复用

| 现有模块 | 复用方式 |
|---------|---------|
| `assistant-presets.ts` 路由 | CRUD API 模式模板 |
| StorageService (OSS) | Banner 图片上传 |
| `authenticate` + `requirePermission` 中间件 | 权限控制 |
| `validate` 中间件 + Zod Schema | 请求验证（含 UUID 参数验证） |
| `enterprise-shared` 类型包 | 前后端类型共享 |
| `EnterpriseApi.ts` fetch 封装 | 客户端 API 调用 |
| `AssistantPresets/` Admin 页面 | 管理面板 UI 模式 |
| Ant Design Carousel, Tabs, Tag 组件 | 客户端 UI |
| `DEFAULT_PAGINATION` 常量 | 分页参数默认值 |
| multer + `sanitizeFilename()` | 图片上传处理 |
| migrate.ts v195 (openclaw) | sidebar 图标迁移模式参考 |
