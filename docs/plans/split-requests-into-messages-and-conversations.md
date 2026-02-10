# 将统计"请求数"拆分为"消息数"和"对话数" — 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将企业版统计系统中所有"请求数"指标拆分为"消息数"（行数）和"对话数"（`COUNT(DISTINCT conversation_id)`），覆盖服务端 API、Admin 管理面板、客户端 EnterprisePanel 三端。

**Architecture:** 纯读取逻辑变更，不涉及数据写入路径。服务端 SQL 查询新增 `COUNT(DISTINCT conversation_id)` 聚合，响应体字段从 `requests` 替换为 `messages` + `conversations`。前端三端同步更新类型定义、数据消费、图表渲染。新增复合索引优化查询性能。

**Tech Stack:** Express 5 + Drizzle ORM + PostgreSQL（服务端）、React 18 + Ant Design + ECharts（Admin）、React 19 + Electron（客户端）、Vitest（测试）

> **验证状态**：已通过三端源码全量交叉验证（2024-02），所有行号、字段名、调用链均已确认。

---

## Context

企业版统计系统（仪表盘 + 数据统计页 + 客户端面板）当前仅展示"请求数"（`count(*)`），无法区分消息粒度和对话粒度。`usage_logs` 表已有 `conversation_id` 字段（schema.ts L343）且客户端已传递，但统计端点从未利用该字段。

本方案将所有统计中的 `requests` 拆分为 `messages`（消息数 = 行数）和 `conversations`（对话数 = `COUNT(DISTINCT conversation_id)`），覆盖**服务端 API、Admin 管理面板、客户端 EnterprisePanel** 三端。

### 关键决策

| 决策项 | 选择 |
|--------|------|
| 客户端 EnterprisePanel | 保持 2x2 四卡，仅将「请求数」替换为「消息数」 |
| 向后兼容 | 不兼容旧 `requests` 字段，三端同时发版（内部测试阶段，无外部用户） |
| Admin 图表 | 消息数柱状图 + 对话数折线 + Token 折线（双 Y 轴），**不使用堆叠柱状图** |
| NULL conversationId | 标准 `count(distinct conversation_id)`，NULL 不计入（全新数据库，无历史 NULL 数据） |
| 索引策略 | 复合索引 `(company_id, created_at, conversation_id)` 覆盖最常见查询模式 |
| /overview 冗余查询 | 移除独立的 `totalConversations` 子查询（L70-74），改用 `usage.total.conversations` |
| OverviewTab 图表 | 四系列：消息柱 + 对话折线 + Token 折线 + 费用折线（双 Y 轴） |
| 统计端点测试 | 新增 Mock DB 单元测试，验证响应结构正确性 |

---

## 三端调用链完整映射（验证结果）

以下矩阵列出所有 `requests` 字段的**精确使用点**，确认三端对应关系完整无遗漏：

### 服务端 → Admin 前端映射（32 处变更点）

| # | 服务端位置 | 字段 | Admin 消费方 | Admin 位置 |
|---|-----------|------|-------------|-----------|
| 1 | statistics.ts L79 `requests: count(*)` (todayUsage) | `usage.today.requests` | Dashboard.tsx 顶部卡片 | L256 `overview?.usage.today.requests` |
| 2 | statistics.ts L89 `requests: count(*)` (monthUsage) | `usage.month.requests` | Dashboard.tsx 本月统计 | L297 `overview?.usage.month.requests` |
| 3 | statistics.ts L99 `requests: count(*)` (totalUsage) | `usage.total.requests` | — | 当前未消费（新增 conversations 后被 L303 使用） |
| 4 | statistics.ts L70-74 `totalConversations` 子查询 | `conversations` (顶层) | Dashboard.tsx 本月统计 | L303 `overview?.conversations` (**Bug: 标题"请求总数"**) |
| 5 | statistics.ts L180 `requests: count(*)` (/usage) | `requests` | OverviewTab.tsx | L15 reduce, L37 chart data |
| 6 | statistics.ts L213 response mapping (/usage) | `requests` | OverviewTab.tsx | L24 legend, L30 yAxis, L35 series name, L60 card |
| 7 | statistics.ts L246 `requests: count(*)` (/models) | `requests` | ModelTab.tsx | L33 pie value, L85 table column |
| 8 | statistics.ts L280 response mapping (/models) | `requests` | ModelTab.tsx | L107 Card title "模型请求分布" |
| 9 | statistics.ts L324 `requests: count(*)` (/users) | `requests` | UserTab.tsx | L15 table column |
| 10 | statistics.ts L344 response mapping (/users) | `requests` | UserTab.tsx | L15 sorter `a.requests - b.requests` |
| 11 | statistics.ts L477 `requests: count(*)` (/departments) | `requests` | DepartmentTab.tsx | L47 sort, L64 chart data, L80 table |
| 12 | statistics.ts L498 response mapping (/departments) | `requests` | DepartmentTab.tsx | L50,57,62 legends/yAxis/series |
| 13 | statistics.ts L533 `requests: count(*)` (/assistant-presets) | `requests` | PresetTab.tsx | L34 pie value, L62 table, L105 list |
| 14 | statistics.ts L569 response mapping (/presets) | `requests` | PresetTab.tsx | L62 sorter |

### 服务端 → Dashboard 额外映射

| # | 服务端 | Dashboard 位置 | 用途 |
|---|--------|---------------|------|
| 15 | /usage → `requests` | L103 legend `['请求数', 'Token 数']` | 图表 legend |
| 16 | /usage → `requests` | L110 yAxis name `'请求数'` | Y 轴名 |
| 17 | /usage → `requests` | L115 series name `'请求数'` | 系列名 |
| 18 | /usage → `requests` | L117 `d.requests` | 柱状图数据 |
| 19 | /departments → `requests` | L173 `d.requests` | 部门 Top5 柱状图 |
| 20 | /departments → `requests` | L315 Card title `"部门 Top 5 (请求量)"` | 卡片标题 |
| 21 | /models → `requests` | L216 `m.requests` | 模型饼图数据 |
| 22 | /presets → `requests` | L373 `{item.requests} 次` | 预设列表文案 |

### 服务端 → 客户端 EnterprisePanel 映射

| # | 服务端 | EnterprisePanel 位置 | 用途 |
|---|--------|---------------------|------|
| 23 | /overview → `usage.today.requests` | L38 `today?: { requests?: number }` | 类型声明 |
| 24 | /overview → `usage.today.requests` | L43 `data.usage?.today?.requests` | 数据映射 |
| 25 | /overview → `usage.month.requests` | L39 `month?: { requests?: number }` | 类型声明 |
| 26 | /overview → `usage.month.requests` | L45 `data.usage?.month?.requests` | 数据映射 |
| 27 | — | L11 `todayRequests: number` | 接口字段 |
| 28 | — | L13 `monthRequests: number` | 接口字段 |
| 29 | — | L141 `stats.todayRequests` | 渲染值 |
| 30 | — | L142 `t('...todayRequests')` | i18n key |
| 31 | — | L149 `stats.monthRequests` | 渲染值 |
| 32 | — | L150 `t('...monthRequests')` | i18n key |

### 服务端独立端点（无前端消费方）

| 端点 | 位置 | 说明 |
|------|------|------|
| models.ts `GET /:id/usage` | L522, L531, L540 (SQL) + L551, L556, L561 (response) | `modelsApi.getUsage` (api.ts L123) 存在但 Admin 前端**无调用方**。仍需修改保持 API 一致性 |

### Admin 类型层（中间桥接）

| 类型文件 | 接口 | `requests` 字段位置 |
|----------|------|-------------------|
| types.ts | `UsageData` | L5 |
| types.ts | `ModelUsage` | L14 |
| types.ts | `UserUsage` | L24 |
| types.ts | `DepartmentUsage` | L34 |
| types.ts | `PresetUsage` | L44 |
| Dashboard.tsx | `OverviewData` | L13 (conversations 顶层), L15-17 (requests in usage) |
| Dashboard.tsx | `UsageTrend` | L23 |
| Dashboard.tsx | `DepartmentStat` | L31 |
| Dashboard.tsx | `PresetStat` | L41 |
| Dashboard.tsx | `ModelStat` | L50 |
| enterprise-shared | `UsageSummary` | L259 (`totalRequests`) |

### i18n 键映射

| 键 | en-us.json L | zh-cn.json L | zh-tw.json L |
|----|-------------|-------------|-------------|
| `settings.enterprise.stats.todayRequests` | 4211 | 4211 | 4211 |
| `settings.enterprise.stats.monthRequests` | 4209 | 4209 | 4209 |

> **验证结论**：三端调用链完整，共 32 处 `requests` 相关代码需修改，无遗漏。

---

## 变更范围总览

| 层级 | 文件 | 变更数 |
|------|------|--------|
| DB 索引 | `packages/server/src/models/schema.ts` | +1 index |
| 服务端 | `packages/server/src/routes/statistics.ts` | 7 端点 ×2（SQL+response）+ 1 导出 |
| 服务端 | `packages/server/src/routes/models.ts` | 3 SQL + 3 response |
| 共享类型 | `packages/enterprise-shared/src/types/index.ts` | 1 接口 |
| Admin 类型 | `packages/admin/src/pages/statistics/types.ts` | 5 接口 |
| Admin | `packages/admin/src/pages/Dashboard.tsx` | 5 接口 + 4 图表 + 4 卡片/文案 |
| Admin | `packages/admin/src/pages/statistics/OverviewTab.tsx` | 1 reduce + 3→4 卡 + 图表重构 |
| Admin | `packages/admin/src/pages/statistics/DepartmentTab.tsx` | 1 sort + 图表 + 表格 |
| Admin | `packages/admin/src/pages/statistics/ModelTab.tsx` | 饼图 + 表格 + Card title |
| Admin | `packages/admin/src/pages/statistics/UserTab.tsx` | 表格列 |
| Admin | `packages/admin/src/pages/statistics/PresetTab.tsx` | 列表 + 饼图 + 表格 |
| Admin | `packages/admin/src/pages/Statistics.tsx` | 删除 5 行 DEBUG 日志 |
| 客户端 | `src/renderer/src/pages/settings/EnterprisePanel.tsx` | 接口 + 映射 + 渲染（6 处） |
| i18n | 3 个 locales 文件 + 机器翻译同步 | 2 键 × 3 文件 |
| 测试 | 2 个新建测试文件 | 8 个端点覆盖 |

### 明确不修改的关联功能

| 功能 | 文件 | 原因 |
|------|------|------|
| 配额系统 `checkQuota()` | models.ts ~L460 | 基于 `sum(total_tokens)` 计量，不涉及 requests |
| 速率限制 | `rate-limit.middleware.ts` | 基于请求频率的内存计数器，与统计无关 |
| Prometheus 指标 | `metrics/index.ts` | `http_requests_total` 是 HTTP 层计数器 |
| `recordUsage()` 写入逻辑 | models.ts ~L879 | 每次请求插入一行 usageLogs，写入路径不变 |
| conversationId 上报链路 | 客户端 | `topicId → conversationId` 映射不变 |
| 配额告警 | `quota-alert.service.ts` | 基于 token 用量百分比 |
| 助手预设热度分 | `assistant-presets.ts GET /client` | `count(*)` 用于热度计算（使用次数），语义正确 |
| `modelsApi.getUsage` 前端消费 | `admin/src/services/api.ts` L123 | 存在但无调用方，是死代码 |

---

## 实施步骤（Bite-sized，每步 2-5 分钟）

### Phase 1: 数据层（DB + 共享类型）

#### Step 1.1: 新增复合索引

**文件**: `packages/server/src/models/schema.ts` L353-359

在 `usageLogs` 表的索引数组末尾（L358 `assistantPresetId` 索引之后）新增：

```typescript
// 当前 L353-359:
(table) => [
  index('usage_logs_company_id_idx').on(table.companyId),
  index('usage_logs_user_id_idx').on(table.userId),
  index('usage_logs_model_id_idx').on(table.modelId),
  index('usage_logs_created_at_idx').on(table.createdAt),
  index('usage_logs_assistant_preset_id_idx').on(table.assistantPresetId)
]

// 修改为:
(table) => [
  index('usage_logs_company_id_idx').on(table.companyId),
  index('usage_logs_user_id_idx').on(table.userId),
  index('usage_logs_model_id_idx').on(table.modelId),
  index('usage_logs_created_at_idx').on(table.createdAt),
  index('usage_logs_assistant_preset_id_idx').on(table.assistantPresetId),
  index('usage_logs_company_created_conversation_idx').on(table.companyId, table.createdAt, table.conversationId)
]
```

**执行迁移**：
```bash
cd packages/server && pnpm agents:generate && pnpm agents:push
```

> 原因：统计查询典型模式 `WHERE company_id = ? AND created_at >= ?` + `COUNT(DISTINCT conversation_id)`，复合索引可 Index Only Scan。

#### Step 1.2: 更新共享类型

**文件**: `packages/enterprise-shared/src/types/index.ts` L252-263

```typescript
// 当前 L252-263:
export interface UsageSummary {
  period: 'daily' | 'weekly' | 'monthly'
  date: Date
  companyId: string
  userId?: string
  modelId?: string
  departmentId?: string
  totalRequests: number
  totalTokens: number
  totalCost: number
  averageLatency: number
}

// 修改为:
export interface UsageSummary {
  period: 'daily' | 'weekly' | 'monthly'
  date: Date
  companyId: string
  userId?: string
  modelId?: string
  departmentId?: string
  totalMessages: number
  totalConversations: number
  totalTokens: number
  totalCost: number
  averageLatency: number
}
```

**验证**：`cd packages/enterprise-shared && npx tsc --noEmit`

---

### Phase 2: 服务端 statistics.ts（7 个端点）

#### Step 2.1: 新增公共 SQL 表达式

**文件**: `packages/server/src/routes/statistics.ts` L33 之后

```typescript
// 当前 L33:
const costCnySql = sql<number>`sum(CASE WHEN ${usageLogs.currency} = 'USD' THEN ${usageLogs.cost} * 7 ELSE ${usageLogs.cost} END)`

// L33 之后新增:
const conversationCountSql = sql<number>`count(distinct ${usageLogs.conversationId})`.mapWith(Number)
```

#### Step 2.2: GET /overview — 删除冗余子查询 + 修改 SQL

**文件**: `packages/server/src/routes/statistics.ts` L50-105

**2.2a** 删除 `totalConversations` 变量及其子查询（L50 解构 + L70-74 查询体）：

```typescript
// 当前 L50:
const [totalUsers, activeUsers, totalModels, totalConversations, todayUsage, monthUsage, totalUsage] =

// 改为:
const [totalUsers, activeUsers, totalModels, todayUsage, monthUsage, totalUsage] =
```

删除 L70-74 整段：
```typescript
// 删除这 5 行:
// 请求总数（替代原来查空的 conversations 表）
db
  .select({ count: sql<number>`count(*)` })
  .from(usageLogs)
  .where(eq(usageLogs.companyId, companyId)),
```

**2.2b** 修改 todayUsage (L78-81)、monthUsage (L88-91)、totalUsage (L98-101) 的 select：

```typescript
// 3 处相同模式，当前:
.select({
  requests: sql<number>`count(*)`,
  tokens: sql<number>`sum(total_tokens)`,
  cost: costCnySql
})

// 全部改为:
.select({
  messages: sql<number>`count(*)`.mapWith(Number),
  conversations: conversationCountSql,
  tokens: sql<number>`sum(total_tokens)`,
  cost: costCnySql
})
```

#### Step 2.3: GET /overview — 修改响应体

**文件**: `packages/server/src/routes/statistics.ts` L107-133

```typescript
// 当前 L107-133:
res.json(
  createSuccessResponse({
    users: {
      total: Number(totalUsers[0].count),
      active: Number(activeUsers[0].count)
    },
    models: Number(totalModels[0].count),
    conversations: Number(totalConversations[0].count),
    usage: {
      today: {
        requests: Number(todayUsage[0].requests || 0),
        tokens: Number(todayUsage[0].tokens || 0),
        cost: Number(todayUsage[0].cost || 0)
      },
      month: {
        requests: Number(monthUsage[0].requests || 0),
        tokens: Number(monthUsage[0].tokens || 0),
        cost: Number(monthUsage[0].cost || 0)
      },
      total: {
        requests: Number(totalUsage[0].requests || 0),
        tokens: Number(totalUsage[0].tokens || 0),
        cost: Number(totalUsage[0].cost || 0)
      }
    }
  })
)

// 改为:
res.json(
  createSuccessResponse({
    users: {
      total: Number(totalUsers[0].count),
      active: Number(activeUsers[0].count)
    },
    models: Number(totalModels[0].count),
    usage: {
      today: {
        messages: Number(todayUsage[0].messages || 0),
        conversations: Number(todayUsage[0].conversations || 0),
        tokens: Number(todayUsage[0].tokens || 0),
        cost: Number(todayUsage[0].cost || 0)
      },
      month: {
        messages: Number(monthUsage[0].messages || 0),
        conversations: Number(monthUsage[0].conversations || 0),
        tokens: Number(monthUsage[0].tokens || 0),
        cost: Number(monthUsage[0].cost || 0)
      },
      total: {
        messages: Number(totalUsage[0].messages || 0),
        conversations: Number(totalUsage[0].conversations || 0),
        tokens: Number(totalUsage[0].tokens || 0),
        cost: Number(totalUsage[0].cost || 0)
      }
    }
  })
)
```

#### Step 2.4: GET /usage — SQL + 响应

**文件**: `packages/server/src/routes/statistics.ts`

**SQL** (L178-184):
```typescript
// 当前:
.select({
  date: sql<string>`${sql.raw(groupByClause)}::date`,
  requests: sql<number>`count(*)`,
  tokens: sql<number>`sum(${usageLogs.totalTokens})`,
  cost: costCnySql,
  avgLatency: sql<number>`avg(${usageLogs.duration})`
})

// 改为:
.select({
  date: sql<string>`${sql.raw(groupByClause)}::date`,
  messages: sql<number>`count(*)`.mapWith(Number),
  conversations: conversationCountSql,
  tokens: sql<number>`sum(${usageLogs.totalTokens})`,
  cost: costCnySql,
  avgLatency: sql<number>`avg(${usageLogs.duration})`
})
```

**响应映射** (L211-217):
```typescript
// 当前:
result.map((r: any) => ({
  date: r.date,
  requests: Number(r.requests),
  tokens: Number(r.tokens || 0),
  cost: Number(r.cost || 0),
  avgLatency: Math.round(Number(r.avgLatency || 0))
}))

// 改为:
result.map((r: any) => ({
  date: r.date,
  messages: Number(r.messages),
  conversations: Number(r.conversations || 0),
  tokens: Number(r.tokens || 0),
  cost: Number(r.cost || 0),
  avgLatency: Math.round(Number(r.avgLatency || 0))
}))
```

#### Step 2.5: GET /models — SQL + 响应

**文件**: `packages/server/src/routes/statistics.ts`

**SQL** (L243-249):
```typescript
// 当前:
.select({
  modelId: usageLogs.modelId,
  modelName: sql<string>`COALESCE(${models.displayName}, '已删除模型')`,
  requests: sql<number>`count(*)`,
  tokens: sql<number>`sum(${usageLogs.totalTokens})`,
  cost: costCnySql,
  avgLatency: sql<number>`avg(${usageLogs.duration})`
})

// 改为:
.select({
  modelId: usageLogs.modelId,
  modelName: sql<string>`COALESCE(${models.displayName}, '已删除模型')`,
  messages: sql<number>`count(*)`.mapWith(Number),
  conversations: conversationCountSql,
  tokens: sql<number>`sum(${usageLogs.totalTokens})`,
  cost: costCnySql,
  avgLatency: sql<number>`avg(${usageLogs.duration})`
})
```

**响应映射** (L277-284):
```typescript
// 当前:
result.map((r: any) => ({
  modelId: r.modelId,
  modelName: r.modelName ?? '已删除模型',
  requests: Number(r.requests),
  tokens: Number(r.tokens || 0),
  cost: Number(r.cost || 0),
  avgLatency: Math.round(Number(r.avgLatency || 0))
}))

// 改为:
result.map((r: any) => ({
  modelId: r.modelId,
  modelName: r.modelName ?? '已删除模型',
  messages: Number(r.messages),
  conversations: Number(r.conversations || 0),
  tokens: Number(r.tokens || 0),
  cost: Number(r.cost || 0),
  avgLatency: Math.round(Number(r.avgLatency || 0))
}))
```

#### Step 2.6: GET /users — SQL + 响应

**文件**: `packages/server/src/routes/statistics.ts`

**SQL** (L320-327):
```typescript
// 当前:
.select({
  userId: usageLogs.userId,
  userName: users.name,
  departmentName: departments.name,
  requests: sql<number>`count(*)`,
  tokens: sql<number>`sum(${usageLogs.totalTokens})`,
  cost: costCnySql
})

// 改为:
.select({
  userId: usageLogs.userId,
  userName: users.name,
  departmentName: departments.name,
  messages: sql<number>`count(*)`.mapWith(Number),
  conversations: conversationCountSql,
  tokens: sql<number>`sum(${usageLogs.totalTokens})`,
  cost: costCnySql
})
```

**响应映射** (L340-347):
```typescript
// 当前:
result.map((r) => ({
  userId: r.userId,
  userName: r.userName ?? '未知用户',
  department: r.departmentName ?? '未分配部门',
  requests: Number(r.requests),
  tokens: Number(r.tokens || 0),
  cost: Number(r.cost || 0)
}))

// 改为:
result.map((r) => ({
  userId: r.userId,
  userName: r.userName ?? '未知用户',
  department: r.departmentName ?? '未分配部门',
  messages: Number(r.messages),
  conversations: Number(r.conversations || 0),
  tokens: Number(r.tokens || 0),
  cost: Number(r.cost || 0)
}))
```

#### Step 2.7: GET /departments — SQL + 响应

**文件**: `packages/server/src/routes/statistics.ts`

**SQL** (L472-480):
```typescript
// 当前:
.select({
  departmentId: departments.id,
  departmentName: departments.name,
  path: departments.path,
  parentId: departments.parentId,
  requests: sql<number>`count(*)`,
  tokens: sql<number>`sum(${usageLogs.totalTokens})`,
  cost: costCnySql,
  userCount: sql<number>`count(distinct ${usageLogs.userId})`
})

// 改为:
.select({
  departmentId: departments.id,
  departmentName: departments.name,
  path: departments.path,
  parentId: departments.parentId,
  messages: sql<number>`count(*)`.mapWith(Number),
  conversations: conversationCountSql,
  tokens: sql<number>`sum(${usageLogs.totalTokens})`,
  cost: costCnySql,
  userCount: sql<number>`count(distinct ${usageLogs.userId})`
})
```

**响应映射** (L493-502):
```typescript
// 当前:
result.map((r) => ({
  departmentId: r.departmentId,
  departmentName: r.departmentName,
  path: r.path,
  parentId: r.parentId,
  requests: Number(r.requests),
  tokens: Number(r.tokens || 0),
  cost: Number(r.cost || 0),
  userCount: Number(r.userCount)
}))

// 改为:
result.map((r) => ({
  departmentId: r.departmentId,
  departmentName: r.departmentName,
  path: r.path,
  parentId: r.parentId,
  messages: Number(r.messages),
  conversations: Number(r.conversations || 0),
  tokens: Number(r.tokens || 0),
  cost: Number(r.cost || 0),
  userCount: Number(r.userCount)
}))
```

#### Step 2.8: GET /assistant-presets — SQL + 响应

**文件**: `packages/server/src/routes/statistics.ts`

**SQL** (L529-536):
```typescript
// 当前:
.select({
  presetId: usageLogs.assistantPresetId,
  presetName: assistantPresets.name,
  emoji: assistantPresets.emoji,
  requests: sql<number>`count(*)`,
  tokens: sql<number>`sum(${usageLogs.totalTokens})`,
  cost: costCnySql,
  uniqueUsers: sql<number>`count(distinct ${usageLogs.userId})`
})

// 改为:
.select({
  presetId: usageLogs.assistantPresetId,
  presetName: assistantPresets.name,
  emoji: assistantPresets.emoji,
  messages: sql<number>`count(*)`.mapWith(Number),
  conversations: conversationCountSql,
  tokens: sql<number>`sum(${usageLogs.totalTokens})`,
  cost: costCnySql,
  uniqueUsers: sql<number>`count(distinct ${usageLogs.userId})`
})
```

**响应映射** (L565-573):
```typescript
// 当前:
result.map((r: any) => ({
  presetId: r.presetId,
  presetName: r.presetName ?? '已删除预设',
  emoji: r.emoji,
  requests: Number(r.requests),
  tokens: Number(r.tokens || 0),
  cost: Number(r.cost || 0),
  uniqueUsers: Number(r.uniqueUsers)
}))

// 改为:
result.map((r: any) => ({
  presetId: r.presetId,
  presetName: r.presetName ?? '已删除预设',
  emoji: r.emoji,
  messages: Number(r.messages),
  conversations: Number(r.conversations || 0),
  tokens: Number(r.tokens || 0),
  cost: Number(r.cost || 0),
  uniqueUsers: Number(r.uniqueUsers)
}))
```

#### Step 2.9: GET /export — 新增 Conversation ID 列

**文件**: `packages/server/src/routes/statistics.ts`

**select 新增字段** (L385-396，在 `duration: usageLogs.duration` 之后):
```typescript
// 当前 L384-396:
const result = await db
  .select({
    date: usageLogs.createdAt,
    userName: users.name,
    userEmail: users.email,
    departmentName: departments.name,
    modelName: models.displayName,
    inputTokens: usageLogs.inputTokens,
    outputTokens: usageLogs.outputTokens,
    totalTokens: usageLogs.totalTokens,
    cost: sql<number>`CASE WHEN ${usageLogs.currency} = 'USD' THEN ${usageLogs.cost} * 7 ELSE ${usageLogs.cost} END`,
    duration: usageLogs.duration
  })

// 改为:
const result = await db
  .select({
    date: usageLogs.createdAt,
    userName: users.name,
    userEmail: users.email,
    departmentName: departments.name,
    modelName: models.displayName,
    inputTokens: usageLogs.inputTokens,
    outputTokens: usageLogs.outputTokens,
    totalTokens: usageLogs.totalTokens,
    cost: sql<number>`CASE WHEN ${usageLogs.currency} = 'USD' THEN ${usageLogs.cost} * 7 ELSE ${usageLogs.cost} END`,
    duration: usageLogs.duration,
    conversationId: usageLogs.conversationId
  })
```

**headers** (L405-416):
```typescript
// 当前:
const headers = [
  'Date', 'User', 'Email', 'Department', 'Model',
  'Input Tokens', 'Output Tokens', 'Total Tokens', 'Cost', 'Duration (ms)'
]

// 改为:
const headers = [
  'Date', 'User', 'Email', 'Department', 'Model',
  'Input Tokens', 'Output Tokens', 'Total Tokens', 'Cost', 'Duration (ms)',
  'Conversation ID'
]
```

**rows** (L417-428，在 `r.duration` 之后):
```typescript
// 当前:
const rows = result.map((r) => [
  r.date.toISOString(),
  r.userName ?? '',
  r.userEmail ?? '',
  r.departmentName ?? '',
  r.modelName ?? '',
  r.inputTokens,
  r.outputTokens,
  r.totalTokens,
  r.cost.toFixed(6),
  r.duration
])

// 改为:
const rows = result.map((r) => [
  r.date.toISOString(),
  r.userName ?? '',
  r.userEmail ?? '',
  r.departmentName ?? '',
  r.modelName ?? '',
  r.inputTokens,
  r.outputTokens,
  r.totalTokens,
  r.cost.toFixed(6),
  r.duration,
  r.conversationId ?? ''
])
```

**验证**：`cd packages/server && npx tsc --noEmit`

---

### Phase 3: 服务端 models.ts

#### Step 3.1: GET /:id/usage — 3 个 SQL + 响应体

**文件**: `packages/server/src/routes/models.ts` L519-566

**3 个 select 语句**（L521-524, L530-533, L539-542）全部从：
```typescript
.select({
  requests: sql<number>`count(*)`,
  tokens: sql<number>`sum(total_tokens)`,
  cost: costCnySql
})
```
改为：
```typescript
.select({
  messages: sql<number>`count(*)`.mapWith(Number),
  conversations: sql<number>`count(distinct ${usageLogs.conversationId})`.mapWith(Number),
  tokens: sql<number>`sum(total_tokens)`,
  cost: costCnySql
})
```

> 注意：需在文件顶部确认 `usageLogs` 已 import。当前 models.ts 已 import `usageLogs`。

**响应体** (L548-565)：
```typescript
// 当前:
res.json(
  createSuccessResponse({
    daily: {
      requests: Number(dailyStats[0].requests || 0),
      tokens: Number(dailyStats[0].tokens || 0),
      cost: Number(dailyStats[0].cost || 0)
    },
    monthly: {
      requests: Number(monthlyStats[0].requests || 0),
      tokens: Number(monthlyStats[0].tokens || 0),
      cost: Number(monthlyStats[0].cost || 0)
    },
    total: {
      requests: Number(totalStats[0].requests || 0),
      tokens: Number(totalStats[0].tokens || 0),
      cost: Number(totalStats[0].cost || 0)
    }
  })
)

// 改为:
res.json(
  createSuccessResponse({
    daily: {
      messages: Number(dailyStats[0].messages || 0),
      conversations: Number(dailyStats[0].conversations || 0),
      tokens: Number(dailyStats[0].tokens || 0),
      cost: Number(dailyStats[0].cost || 0)
    },
    monthly: {
      messages: Number(monthlyStats[0].messages || 0),
      conversations: Number(monthlyStats[0].conversations || 0),
      tokens: Number(monthlyStats[0].tokens || 0),
      cost: Number(monthlyStats[0].cost || 0)
    },
    total: {
      messages: Number(totalStats[0].messages || 0),
      conversations: Number(totalStats[0].conversations || 0),
      tokens: Number(totalStats[0].tokens || 0),
      cost: Number(totalStats[0].cost || 0)
    }
  })
)
```

**验证**：`cd packages/server && npx tsc --noEmit`

---

### Phase 4: Admin 类型定义

#### Step 4.1: statistics/types.ts — 5 个接口

**文件**: `packages/admin/src/pages/statistics/types.ts` 全文替换为：

```typescript
import type { Dayjs } from 'dayjs'

export interface UsageData {
  date: string
  messages: number
  conversations: number
  tokens: number
  cost: number
  avgLatency?: number
}

export interface ModelUsage {
  modelId: string | null
  modelName: string
  messages: number
  conversations: number
  tokens: number
  cost: number
  avgLatency?: number
}

export interface UserUsage {
  userId: string
  userName: string
  department: string
  messages: number
  conversations: number
  tokens: number
  cost: number
}

export interface DepartmentUsage {
  departmentId: string
  departmentName: string
  path: string
  parentId: string | null
  messages: number
  conversations: number
  tokens: number
  cost: number
  userCount: number
}

export interface PresetUsage {
  presetId: string
  presetName: string
  emoji: string | null
  messages: number
  conversations: number
  tokens: number
  cost: number
  uniqueUsers: number
}

export interface FilterModel {
  id: string
  displayName: string
}

export interface FilterDepartment {
  id: string
  name: string
}

export interface StatisticsFilterParams {
  startDate: string
  endDate: string
  modelId?: string
  departmentId?: string
  assistantPresetId?: string
  groupBy: 'day' | 'week' | 'month'
}

export interface StatisticsFilters {
  dateRange: [Dayjs, Dayjs]
  modelId: string | null
  departmentId: string | null
  groupBy: 'day' | 'week' | 'month'
}
```

---

### Phase 5: Admin Dashboard

#### Step 5.1: Dashboard 接口更新

**文件**: `packages/admin/src/pages/Dashboard.tsx` L10-53

5 个接口全部更新。完整替换 L10-53：

```typescript
interface OverviewData {
  users: { total: number; active: number }
  models: number
  usage: {
    today: { messages: number; conversations: number; tokens: number; cost: number }
    month: { messages: number; conversations: number; tokens: number; cost: number }
    total: { messages: number; conversations: number; tokens: number; cost: number }
  }
}

interface UsageTrend {
  date: string
  messages: number
  conversations: number
  tokens: number
  cost: number
}

interface DepartmentStat {
  departmentId: string
  departmentName: string
  messages: number
  tokens: number
  cost: number
  userCount: number
}

interface PresetStat {
  presetId: string
  presetName: string
  emoji: string | null
  messages: number
  tokens: number
  cost: number
  uniqueUsers: number
}

interface ModelStat {
  modelId: string | null
  modelName: string
  messages: number
  tokens: number
  cost: number
}
```

> 注意：`OverviewData.conversations`（顶层字段）已删除，对应服务端 Step 2.2a。

#### Step 5.2: Dashboard 使用趋势图重构

**文件**: `packages/admin/src/pages/Dashboard.tsx` L98-152

```typescript
// 完整替换 usageChartOption:
const usageChartOption = {
  tooltip: {
    trigger: 'axis'
  },
  legend: {
    data: ['消息数', '对话数', 'Token 数']
  },
  xAxis: {
    type: 'category',
    data: usageTrend.map((d) => d.date)
  },
  yAxis: [
    { type: 'value', name: '消息数 / 对话数' },
    { type: 'value', name: 'Token 数' }
  ],
  series: [
    {
      name: '消息数',
      type: 'bar',
      data: usageTrend.map((d) => d.messages),
      itemStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: '#6366f1' },
            { offset: 1, color: 'rgba(99,102,241,0.2)' }
          ]
        }
      }
    },
    {
      name: '对话数',
      type: 'line',
      data: usageTrend.map((d) => d.conversations),
      itemStyle: { color: '#06b6d4' },
      lineStyle: { color: '#06b6d4' }
    },
    {
      name: 'Token 数',
      type: 'line',
      yAxisIndex: 1,
      data: usageTrend.map((d) => d.tokens),
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(6,182,212,0.3)' },
            { offset: 1, color: 'rgba(6,182,212,0.02)' }
          ]
        }
      }
    }
  ]
}
```

#### Step 5.3: Dashboard 部门 Top5 柱状图

**文件**: `packages/admin/src/pages/Dashboard.tsx` L154-197

仅修改 L173 `d.requests` → `d.messages`：
```typescript
data: [...topDepartments].reverse().map((d) => d.messages),
```

#### Step 5.4: Dashboard 模型饼图

**文件**: `packages/admin/src/pages/Dashboard.tsx` L199-230

仅修改 L216 `m.requests` → `m.messages`：
```typescript
data: modelStats.slice(0, 8).map((m) => ({
  name: m.modelName,
  value: m.messages
})),
```

#### Step 5.5: Dashboard 顶部卡片

**文件**: `packages/admin/src/pages/Dashboard.tsx` L254-259

```typescript
// 当前 L254-259:
{
  title: '今日请求',
  value: overview?.usage.today.requests || 0,
  icon: <MessageOutlined />,
  color: STAT_COLORS[2]
},

// 改为:
{
  title: '今日消息',
  value: overview?.usage.today.messages || 0,
  icon: <MessageOutlined />,
  color: STAT_COLORS[2]
},
```

#### Step 5.6: Dashboard 本月统计区域（修正 Bug）

**文件**: `packages/admin/src/pages/Dashboard.tsx` L294-308

```typescript
// 当前 L294-308:
<Card title="本月统计">
  <Row gutter={[16, 16]}>
    <Col span={12}>
      <Statistic title="请求总数" value={overview?.usage.month.requests || 0} />
    </Col>
    <Col span={12}>
      <Statistic title="Token 总数" value={overview?.usage.month.tokens || 0} />
    </Col>
    <Col span={12}>
      <Statistic title="请求总数" value={overview?.conversations || 0} />
    </Col>
    <Col span={12}>
      <Statistic title="总费用" value={overview?.usage.total.cost || 0} precision={2} prefix="¥" />
    </Col>
  </Row>
</Card>

// 改为:
<Card title="本月统计">
  <Row gutter={[16, 16]}>
    <Col span={12}>
      <Statistic title="消息总数" value={overview?.usage.month.messages || 0} />
    </Col>
    <Col span={12}>
      <Statistic title="Token 总数" value={overview?.usage.month.tokens || 0} />
    </Col>
    <Col span={12}>
      <Statistic title="对话总数" value={overview?.usage.total.conversations || 0} />
    </Col>
    <Col span={12}>
      <Statistic title="总费用" value={overview?.usage.total.cost || 0} precision={2} prefix="¥" />
    </Col>
  </Row>
</Card>
```

> **Bug 修正**：L303 原标题"请求总数"但值为 `overview?.conversations`（顶层字段），现改为标题"对话总数"、值 `overview?.usage.total.conversations`（语义正确）。

#### Step 5.7: Dashboard 部门卡片标题 + 预设列表

**文件**: `packages/admin/src/pages/Dashboard.tsx`

L315:
```typescript
// 当前: <Card title="部门 Top 5 (请求量)">
// 改为: <Card title="部门 Top 5 (消息量)">
```

L373:
```typescript
// 当前: {item.requests} 次 · {item.uniqueUsers} 用户
// 改为: {item.messages} 次 · {item.uniqueUsers} 用户
```

---

### Phase 6: Admin Statistics 各 Tab

#### Step 6.1: OverviewTab.tsx — 全文重构

**文件**: `packages/admin/src/pages/statistics/OverviewTab.tsx`（81 行全文替换）

```typescript
import { Card, Col, Row, Statistic } from 'antd'
import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'

import { ECHARTS_THEME_NAME } from '../../theme'
import type { UsageData } from './types'

interface OverviewTabProps {
  loading: boolean
  usageData: UsageData[]
}

export default function OverviewTab({ loading, usageData }: OverviewTabProps) {
  const summary = useMemo(() => {
    const messages = usageData.reduce((sum, d) => sum + d.messages, 0)
    const conversations = usageData.reduce((sum, d) => sum + d.conversations, 0)
    const tokens = usageData.reduce((sum, d) => sum + d.tokens, 0)
    const cost = usageData.reduce((sum, d) => sum + d.cost, 0)
    return { messages, conversations, tokens, cost }
  }, [usageData])

  const usageChartOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis' },
      legend: { data: ['消息数', '对话数', 'Token 数', '费用'] },
      xAxis: {
        type: 'category',
        data: usageData.map((d) => d.date)
      },
      yAxis: [
        { type: 'value', name: '消息数 / 对话数' },
        { type: 'value', name: 'Token / 费用 (¥)' }
      ],
      series: [
        {
          name: '消息数',
          type: 'bar',
          data: usageData.map((d) => d.messages)
        },
        {
          name: '对话数',
          type: 'line',
          data: usageData.map((d) => d.conversations)
        },
        {
          name: 'Token 数',
          type: 'line',
          yAxisIndex: 1,
          data: usageData.map((d) => d.tokens)
        },
        {
          name: '费用',
          type: 'line',
          yAxisIndex: 1,
          data: usageData.map((d) => d.cost)
        }
      ]
    }),
    [usageData]
  )

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic title="总消息数" value={summary.messages} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic title="总对话数" value={summary.conversations} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic title="总 Token 数" value={summary.tokens} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic title="总费用" value={summary.cost} precision={2} prefix="¥" />
          </Card>
        </Col>
      </Row>

      <Card title="使用趋势" loading={loading} style={{ marginTop: 16 }}>
        <ReactECharts theme={ECHARTS_THEME_NAME} option={usageChartOption} style={{ height: 400 }} />
      </Card>
    </div>
  )
}
```

> 变更点：reduce 新增 conversations、3→4 卡（`sm={8}`→`sm={6}`）、图表 4 系列双 Y 轴。

#### Step 6.2: DepartmentTab.tsx — 排序 + 图表 + 表格

**文件**: `packages/admin/src/pages/statistics/DepartmentTab.tsx`

L47 排序：
```typescript
// 当前: const top10 = [...departmentData].sort((a, b) => b.requests - a.requests).slice(0, 10)
// 改为: const top10 = [...departmentData].sort((a, b) => b.messages - a.messages).slice(0, 10)
```

L50 legend：
```typescript
// 当前: legend: { data: ['请求数', 'Token 数'] },
// 改为: legend: { data: ['消息数', 'Token 数'] },
```

L56-58 yAxis：
```typescript
// 当前: { type: 'value', name: '请求数' },
// 改为: { type: 'value', name: '消息数' },
```

L61-65 series：
```typescript
// 当前:
{
  name: '请求数',
  type: 'bar',
  data: top10.map((d) => d.requests),
  barMaxWidth: 32
},

// 改为:
{
  name: '消息数',
  type: 'bar',
  data: top10.map((d) => d.messages),
  barMaxWidth: 32
},
```

L80 表格列 — 拆为两列：
```typescript
// 当前:
{ title: '请求数', dataIndex: 'requests', key: 'requests', sorter: (a, b) => a.requests - b.requests },

// 改为:
{ title: '消息数', dataIndex: 'messages', key: 'messages', sorter: (a, b) => a.messages - b.messages },
{ title: '对话数', dataIndex: 'conversations', key: 'conversations', sorter: (a, b) => a.conversations - b.conversations },
```

#### Step 6.3: ModelTab.tsx — 饼图 + 表格 + 标题

**文件**: `packages/admin/src/pages/statistics/ModelTab.tsx`

L33 饼图数据：
```typescript
// 当前: value: m.requests
// 改为: value: m.messages
```

L85 表格列 — 拆为两列：
```typescript
// 当前:
{ title: '请求数', dataIndex: 'requests', key: 'requests', sorter: (a, b) => a.requests - b.requests },

// 改为:
{ title: '消息数', dataIndex: 'messages', key: 'messages', sorter: (a, b) => a.messages - b.messages },
{ title: '对话数', dataIndex: 'conversations', key: 'conversations', sorter: (a, b) => a.conversations - b.conversations },
```

L107:
```typescript
// 当前: <Card title="模型请求分布" loading={loading}>
// 改为: <Card title="模型消息分布" loading={loading}>
```

#### Step 6.4: UserTab.tsx — 表格列

**文件**: `packages/admin/src/pages/statistics/UserTab.tsx`

L15 表格列 — 拆为两列：
```typescript
// 当前:
{ title: '请求数', dataIndex: 'requests', key: 'requests', sorter: (a, b) => a.requests - b.requests },

// 改为:
{ title: '消息数', dataIndex: 'messages', key: 'messages', sorter: (a, b) => a.messages - b.messages },
{ title: '对话数', dataIndex: 'conversations', key: 'conversations', sorter: (a, b) => a.conversations - b.conversations },
```

#### Step 6.5: PresetTab.tsx — 列表 + 饼图 + 表格

**文件**: `packages/admin/src/pages/statistics/PresetTab.tsx`

L34 饼图数据：
```typescript
// 当前: value: p.requests
// 改为: value: p.messages
```

L62 表格列 — 拆为两列：
```typescript
// 当前:
{ title: '请求数', dataIndex: 'requests', key: 'requests', sorter: (a, b) => a.requests - b.requests },

// 改为:
{ title: '消息数', dataIndex: 'messages', key: 'messages', sorter: (a, b) => a.messages - b.messages },
{ title: '对话数', dataIndex: 'conversations', key: 'conversations', sorter: (a, b) => a.conversations - b.conversations },
```

L105 排行列表文案：
```typescript
// 当前: {item.requests} 次 · {item.uniqueUsers} 用户 · {item.tokens} tokens
// 改为: {item.messages} 消息 · {item.conversations} 对话 · {item.uniqueUsers} 用户
```

#### Step 6.6: Statistics.tsx — 清理 DEBUG 日志

**文件**: `packages/admin/src/pages/Statistics.tsx` L78-84

删除以下 5 行（违反 CLAUDE.md 禁止 console.log 规范）：
```typescript
// 删除 L78-84:
// [DEBUG] 调试仪表盘图表无数据问题，调试完成后移除
console.warn('[DEBUG] Statistics params:', params)
console.warn('[DEBUG] usage:', usageRes.data.data?.length, usageRes.data.data?.slice(0, 2))
console.warn('[DEBUG] models:', modelRes.data.data?.length, modelRes.data.data?.slice(0, 2))
console.warn('[DEBUG] users:', userRes.data.data?.length, userRes.data.data?.slice(0, 2))
console.warn('[DEBUG] departments:', deptRes.data.data?.length, deptRes.data.data?.slice(0, 2))
console.warn('[DEBUG] presets:', presetRes.data.data?.length, presetRes.data.data?.slice(0, 2))
```

**验证**：`cd packages/admin && npx tsc --noEmit`

---

### Phase 7: 客户端 EnterprisePanel + i18n

#### Step 7.1: EnterprisePanel 接口 + 映射 + 渲染

**文件**: `src/renderer/src/pages/settings/EnterprisePanel.tsx`

**接口** (L10-15):
```typescript
// 当前:
interface UsageStats {
  todayRequests: number
  todayTokens: number
  monthRequests: number
  monthTokens: number
}

// 改为:
interface UsageStats {
  todayMessages: number
  todayTokens: number
  monthMessages: number
  monthTokens: number
}
```

**数据映射** (L36-47):
```typescript
// 当前:
const data = response.data as {
  usage?: {
    today?: { requests?: number; tokens?: number }
    month?: { requests?: number; tokens?: number }
  }
}
setStats({
  todayRequests: data.usage?.today?.requests || 0,
  todayTokens: data.usage?.today?.tokens || 0,
  monthRequests: data.usage?.month?.requests || 0,
  monthTokens: data.usage?.month?.tokens || 0
})

// 改为:
const data = response.data as {
  usage?: {
    today?: { messages?: number; tokens?: number }
    month?: { messages?: number; tokens?: number }
  }
}
setStats({
  todayMessages: data.usage?.today?.messages || 0,
  todayTokens: data.usage?.today?.tokens || 0,
  monthMessages: data.usage?.month?.messages || 0,
  monthTokens: data.usage?.month?.tokens || 0
})
```

**渲染** (L141-142, L149-150):
```typescript
// L141-142 当前:
<StatValue>{stats.todayRequests}</StatValue>
<StatLabel>{t('settings.enterprise.stats.todayRequests')}</StatLabel>

// 改为:
<StatValue>{stats.todayMessages}</StatValue>
<StatLabel>{t('settings.enterprise.stats.todayMessages')}</StatLabel>

// L149-150 当前:
<StatValue>{stats.monthRequests}</StatValue>
<StatLabel>{t('settings.enterprise.stats.monthRequests')}</StatLabel>

// 改为:
<StatValue>{stats.monthMessages}</StatValue>
<StatLabel>{t('settings.enterprise.stats.monthMessages')}</StatLabel>
```

#### Step 7.2: i18n — en-us.json (基准)

**文件**: `src/renderer/src/i18n/locales/en-us.json` L4208-4212

```json
// 当前:
"stats": {
  "monthRequests": "Monthly Requests",
  "monthTokens": "Monthly Tokens",
  "todayRequests": "Today's Requests",
  "todayTokens": "Today's Tokens"
},

// 改为:
"stats": {
  "monthMessages": "Monthly Messages",
  "monthTokens": "Monthly Tokens",
  "todayMessages": "Today's Messages",
  "todayTokens": "Today's Tokens"
},
```

#### Step 7.3: i18n — zh-cn.json (手动翻译)

**文件**: `src/renderer/src/i18n/locales/zh-cn.json` L4208-4212

```json
// 当前:
"stats": {
  "monthRequests": "本月请求",
  "monthTokens": "本月 Token",
  "todayRequests": "今日请求",
  "todayTokens": "今日 Token"
},

// 改为:
"stats": {
  "monthMessages": "本月消息",
  "monthTokens": "本月 Token",
  "todayMessages": "今日消息",
  "todayTokens": "今日 Token"
},
```

#### Step 7.4: i18n — zh-tw.json (手动翻译)

**文件**: `src/renderer/src/i18n/locales/zh-tw.json` L4208-4212

```json
// 当前:
"stats": {
  "monthRequests": "[to be translated]:Monthly Requests",
  "monthTokens": "[to be translated]:Monthly Tokens",
  "todayRequests": "[to be translated]:Today's Requests",
  "todayTokens": "[to be translated]:Today's Tokens"
},

// 改为:
"stats": {
  "monthMessages": "本月訊息",
  "monthTokens": "[to be translated]:Monthly Tokens",
  "todayMessages": "今日訊息",
  "todayTokens": "[to be translated]:Today's Tokens"
},
```

#### Step 7.5: i18n 机器翻译同步

```bash
pnpm i18n:sync       # 同步 key 到其他语言文件（删除旧 key、新增新 key）
pnpm i18n:translate  # AI 自动翻译新增/修改的 key
```

---

### Phase 8: 单元测试

#### Step 8.1: 创建测试目录

```bash
mkdir -p packages/server/src/routes/__tests__
```

#### Step 8.2: statistics.test.ts

**文件**: `packages/server/src/routes/__tests__/statistics.test.ts`（新建）

> 当前 server 包已有测试文件（`src/__tests__/`），但多为 placeholder。本步骤为修改后的统计端点新增结构验证测试。

**测试范围**：

| 端点 | 核心断言 |
|------|---------|
| `GET /overview` | 响应包含 `usage.{today,month,total}.messages` 和 `.conversations`；不包含 `requests`；不包含顶层 `conversations` 字段 |
| `GET /usage` | 每条记录包含 `messages` + `conversations`；不包含 `requests` |
| `GET /models` | 同上 |
| `GET /users` | 同上 |
| `GET /departments` | 同上 |
| `GET /assistant-presets` | 同上 |
| `GET /export` | CSV headers 末尾包含 `Conversation ID` |

**Mock 策略**：

```typescript
// Mock 中间件（跳过认证/鉴权）
vi.mock('../../middleware/auth', () => ({
  authenticate: (_req: any, _res: any, next: any) => {
    _req.user = { companyId: 'test-company-id', id: 'test-user-id' }
    next()
  },
  requirePermission: () => (_req: any, _res: any, next: any) => next()
}))

// Mock Drizzle db（返回固定数据）
vi.mock('../../models', () => {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([/* mock data */])
  }
  return {
    db: mockChain,
    usageLogs: { /* column refs */ },
    users: { /* column refs */ },
    models: { /* column refs */ },
    departments: { /* column refs */ },
    assistantPresets: { /* column refs */ }
  }
})
```

**不在测试范围内**：
- SQL 执行正确性（需集成测试 + 真实 DB）
- 认证/鉴权逻辑（中间件已 Mock）
- 性能基准（需真实环境）

#### Step 8.3: models-usage.test.ts

**文件**: `packages/server/src/routes/__tests__/models-usage.test.ts`（新建）

覆盖 `GET /models/:id/usage`，断言 `daily/monthly/total` 包含 `messages` + `conversations`，不包含 `requests`。Mock 策略同 Step 8.2。

---

### Phase 9: 全量验证

#### Step 9.1: 自动化验证

```bash
pnpm lint                   # oxlint + eslint + typecheck + i18n:check + format:check
pnpm test                   # Vitest 全量测试
pnpm format                 # Biome 格式化
pnpm typecheck              # tsgo 类型检查
pnpm i18n:check             # 翻译文件校验
pnpm i18n:hardcoded:strict  # 硬编码 UI 字符串检查
```

---

## 风险点

### 风险 1: 图表比例失衡 ✅ 已解决

Dashboard 和 OverviewTab 的趋势图中，对话数远小于消息数（1:N 关系）。

**解决方案**：消息数柱状图 + 对话数折线（共享左 Y 轴）+ Token 折线（右 Y 轴）。对话折线即使数值小也能清晰展示趋势。详见 Step 5.2 和 Step 6.1。

### 风险 2: CSV 导出新增列 ⚠️ 低风险

`Conversation ID` 列放在末尾，不影响前 N 列的位置索引解析。且当前处于内部测试阶段，无外部用户依赖 CSV 格式。

### 已降级为备注的原风险项

| 原风险 | 降级原因 |
|--------|---------|
| NULL conversationId 导致对话数偏低 | 全新数据库，无历史数据。`COUNT(DISTINCT)` 自动忽略 NULL，属于合理行为 |
| 三端部署时序 | 内部测试阶段，三端可控同步更新 |
| 索引策略 | 已确认使用复合索引 `(company_id, created_at, conversation_id)` |

---

## 手动验证检查清单

1. **数据库**：`\d usage_logs` 确认 `usage_logs_company_created_conversation_idx` 索引已创建
2. **API 端点**：curl 每个 statistics 端点 + `/models/:id/usage`，确认返回 `messages` + `conversations` 而非 `requests`
3. **Dashboard**：
   - 卡片正确展示"今日消息"（而非"今日请求"）
   - 趋势图渲染消息柱 + 对话折线 + Token 折线（双 Y 轴）
   - `conversations` ≤ `messages`（逻辑正确性）
   - "对话总数"展示正确（取自 `usage.total.conversations`）
4. **统计页**：切换 5 个 Tab，确认表格列名、图表 legend、Card 标题
5. **导出**：下载 CSV 确认末尾含 `Conversation ID` 列
6. **客户端**：Electron app → 设置 → 企业版，确认 4 个统计卡片

### 性能基准

- staging 环境 > 10 万行 usageLogs 测试
- 基准：响应时间不超过当前 2 倍
- 特别关注 `/overview`（3 个并行子查询均新增 `COUNT(DISTINCT)`）

### 回归检查

- [ ] 费用统计（cost）未受影响
- [ ] Token 统计未受影响
- [ ] 配额系统正常（`checkQuota()` 基于 token）
- [ ] 速率限制正常
- [ ] 助手预设热度分正常（`hotScore` 未变）
- [ ] Prometheus 指标正常
- [ ] 数据导出功能正常

---

## 回滚方案

本变更为只读统计逻辑变更，无数据迁移，回滚简单：

| 层级 | 回滚操作 |
|------|---------|
| 代码 | `git revert <commit-sha>` |
| DB 索引 | `DROP INDEX IF EXISTS usage_logs_company_created_conversation_idx;` |
| 数据 | 无需回滚（仅变更读取逻辑） |

---

## 实施顺序总览

| Phase | Steps | 估计时间 | 说明 |
|-------|-------|---------|------|
| Phase 1 | 1.1-1.2 | 5 min | DB 索引 + 共享类型 |
| Phase 2 | 2.1-2.9 | 15 min | 服务端 statistics.ts（7 端点） |
| Phase 3 | 3.1 | 5 min | 服务端 models.ts |
| Phase 4 | 4.1 | 3 min | Admin 类型定义 |
| Phase 5 | 5.1-5.7 | 15 min | Admin Dashboard（接口+图表+卡片） |
| Phase 6 | 6.1-6.6 | 15 min | Admin Statistics 5 Tab + 清理日志 |
| Phase 7 | 7.1-7.5 | 10 min | 客户端 + i18n |
| Phase 8 | 8.1-8.3 | 20 min | 单元测试 |
| Phase 9 | 9.1 | 5 min | 全量验证 |
| **合计** | **30 步** | **~90 min** | |
