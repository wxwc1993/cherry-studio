# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 核心原则

- **问答全程使用中文进行**
- **禁止 `console.log`**：所有日志必须通过 `loggerService` 输出并附带上下文（见日志章节）。
- **先提议再执行**：修改代码前先说明方案，等待用户确认后再动手。
- **完成前必须检查**：任务完成前必须依次执行 `pnpm lint`、`pnpm test`、`pnpm format` 并全部通过。
- **规范化提交**：使用 `feat:`、`fix:`、`refactor:`、`docs:`、`test:`、`chore:`、`perf:` 前缀，提交时需签名 `--signoff`。
- **禁止修改 Redux/IndexedDB 数据模型**：v2.0.0 发布前冻结（详见 PR 模板注释）。

## 开发命令

```bash
pnpm install                # 安装依赖（需要 Node >= 22，pnpm 10.27.0）
pnpm dev                    # Electron 开发模式（支持热重载）
pnpm debug                  # 调试模式（用 chrome://inspect 连接）
pnpm build:check            # 提交前必须执行：lint + test

# 测试
pnpm test                   # 运行全部测试（Vitest）
pnpm test:main              # 仅主进程测试
pnpm test:renderer          # 仅渲染进程测试
pnpm test:aicore            # 仅 AI Core 包测试
pnpm test:coverage          # 带覆盖率报告的测试
pnpm test:watch             # 监听模式
pnpm test:e2e               # Playwright 端到端测试

# 代码质量
pnpm lint                   # oxlint --fix + eslint --fix + typecheck + i18n:check + format:check
pnpm format                 # Biome 格式化 + lint --write
pnpm typecheck              # TypeScript 类型检查（通过 tsgo 同时检查 node 和 web 目标）

# 国际化
pnpm i18n:sync              # 从基准语言（en-us）同步翻译 key
pnpm i18n:check             # 校验翻译文件
pnpm i18n:translate         # 使用 AI 自动翻译
pnpm i18n:hardcoded:strict  # 检查硬编码 UI 字符串（CI 使用）

# 数据库（Drizzle - agents）
pnpm agents:generate        # 生成 Drizzle 迁移
pnpm agents:push            # 推送 schema 变更
pnpm agents:studio          # 打开 Drizzle Studio
```

**常见修复顺序：**
- i18n 排序错误 → 先执行 `pnpm i18n:sync`，再执行 `pnpm build:check`
- 格式化错误 → 先执行 `pnpm format`，再执行 `pnpm build:check`

## 项目架构

### Electron 三进程模型

```
┌─────────────────────────────────────────────────────┐
│  主进程 Main Process（src/main/）                    │
│  Node.js 后端：服务、IPC 处理、系统集成              │
│  入口：src/main/index.ts → src/main/ipc.ts          │
├─────────────────────────────────────────────────────┤
│  预加载 Preload（src/preload/index.ts）              │
│  通过 contextBridge 暴露类型安全的 IPC 桥接          │
│  集成 OpenTelemetry 链路追踪                         │
├─────────────────────────────────────────────────────┤
│  渲染进程 Renderer（src/renderer/）                  │
│  React 19 + Redux Toolkit + Ant Design + Tailwind   │
│  入口：src/renderer/src/App.tsx                     │
└─────────────────────────────────────────────────────┘
```

**IPC 通信流程**：渲染进程调用 `window.api.*` → 预加载脚本 `ipcRenderer.invoke(IpcChannel.*)` → 主进程 `ipcMain.handle()`（注册在 `src/main/ipc.ts`）。通道枚举定义在 `packages/shared/IpcChannel.ts`。

### 主进程服务（`src/main/services/`）

47 个服务，关键服务包括：MCPService（MCP 服务器生命周期管理，支持 stdio/SSE/HTTP 传输和 OAuth 认证）、KnowledgeService（基于 LibSqlDb 的 RAG 向量检索）、WindowService、FileStorage、BackupService、UpdateService、TranslateService、LlmService、AssistantService、SettingsService。

### AI Core — 双层架构

**新架构**（`packages/aiCore/`，发布为 `@cherrystudio/ai-core`）：
基于 Vercel AI SDK（`@ai-sdk/*`），采用 Models → Runtime → Plugins → Middleware → Providers 分层设计。12 个基础 Provider（openai、anthropic、google、xai、azure、deepseek、openrouter、cherryin 等），通过注册表管理，支持动态扩展。详见 `packages/aiCore/AI_SDK_ARCHITECTURE.md`。

**旧架构**（`src/renderer/src/aiCore/`，迁移中）：
- `middleware/` — 功能中间件（AiSdkMiddlewareBuilder、anthropicCache、toolChoice、noThink、qwenThinking 等 8 个）
- `legacy/clients/` — SDK 适配层（OpenAI、Gemini、Anthropic、AWS 等按 Provider 组织）
- `legacy/middleware/` — 旧版中间件（逐步迁移至 packages/aiCore）
- `plugins/`、`prepareParams/`、`tools/`、`trace/`、`types/` — 其他辅助模块
- 设计文档：`src/renderer/src/aiCore/AI_CORE_DESIGN.md`

### 状态管理

Redux Toolkit 位于 `src/renderer/src/store/`，包含 27 个 slice。通过 `redux-persist` 持久化到 localStorage。

**非持久化 slice**（blacklist）：`runtime`、`messages`、`messageBlocks`、`tabs`、`toolPermissions`。

**跨窗口同步 slice**（StoreSyncService）：`assistants`、`settings`、`llm`、`selectionStore`、`note`。

持久化版本号：当前 v195，迁移逻辑在 store 配置中。

### 存储层

| 层级 | 技术方案 | 用途 |
|------|---------|------|
| 应用状态 | Redux → localStorage（redux-persist） | UI 状态、设置、助手、模型配置 |
| 应用配置 | electron-store | 主进程持久化配置 |
| Agents 数据库 | SQLite（drizzle-orm + @libsql/client） | Agent/MCP 数据 |
| 知识库向量 | LibSqlDb | RAG 向量嵌入 |
| 文件 | 文件系统（`<userData>/Data/`） | 上传文件、导出 |
| 日志 | Winston 按日轮转 | `<userData>/logs/` |

### 渲染进程页面路由（`src/renderer/src/Router.tsx`）

主要路由：`/`（聊天）、`/settings/*`（设置）、`/store`（助手预设）、`/paintings/*`（图像生成）、`/translate`（翻译）、`/files`（文件）、`/notes`（笔记）、`/knowledge`（知识库）、`/apps`（小程序）、`/code`（代码工具）、`/launchpad`、`/login/enterprise`（企业登录）。

## 工作区包（`packages/`）

| 包名 | 导入别名 | 用途 |
|------|---------|------|
| `aiCore` | `@cherrystudio/ai-core` | AI 中间件管线（已发布 npm 包） |
| `ai-sdk-provider` | `@cherrystudio/ai-sdk-provider` | 自定义 AI SDK Provider（已发布 npm 包） |
| `extension-table-plus` | `@cherrystudio/extension-table-plus` | 表格渲染扩展（已发布 npm 包） |
| `enterprise-shared` | `@cherry-studio/enterprise-shared` | 企业版功能类型（已发布 npm 包） |
| `server` | `@cherry-studio/server` | 企业版后端（Express 5 + PostgreSQL + pgvector），详见 `packages/server/CLAUDE.md` |
| `admin` | `@cherry-studio/admin` | 企业版管理面板（React 18 + Ant Design Pro + ECharts），详见 `packages/admin/CLAUDE.md` |
| `shared` | `@shared/*`（路径别名） | IpcChannel 枚举、常量、Provider 配置、类型（非 npm 包） |
| `mcp-trace` | `@mcp-trace/*`（路径别名） | MCP 的 OpenTelemetry 链路追踪（非 npm 包） |

## 路径别名

**主进程**（`tsconfig.node.json`）：
- `@main/*` → `src/main/*`
- `@logger` → `src/main/services/LoggerService`
- `@shared/*` → `packages/shared/*`
- `@types` → `src/renderer/src/types/index.ts`
- `@mcp-trace/*` → `packages/mcp-trace/*`

**渲染进程**（`tsconfig.web.json`）：
- `@renderer/*` → `src/renderer/src/*`
- `@logger` → `src/renderer/src/services/LoggerService`（注意：与主进程指向不同路径）
- `@shared/*` → `packages/shared/*`
- `@types` → `src/renderer/src/types/index.ts`
- `@mcp-trace/*` → `packages/mcp-trace/*`
- `@cherrystudio/ai-core` → `packages/aiCore/src/index.ts`
- `@cherrystudio/ai-core/*` → `packages/aiCore/src/*`
- `@cherrystudio/ai-core/provider` → `packages/aiCore/src/core/providers/index.ts`
- `@cherrystudio/ai-core/built-in/plugins` → `packages/aiCore/src/core/plugins/built-in/index.ts`
- `@cherrystudio/ai-sdk-provider` → `packages/ai-sdk-provider/src/index.ts`
- `@cherrystudio/extension-table-plus` → `packages/extension-table-plus/src/index.ts`
- `@cherry-studio/enterprise-shared` → `packages/enterprise-shared/src/index.ts`

## 日志

```typescript
import { loggerService } from '@logger'
const logger = loggerService.withContext('ModuleName')
logger.info('message', { context })
// 渲染进程需先调用 loggerService.initWindowSource('windowName')
```

底层使用 Winston + 按日轮转。开发环境级别：`silly`，生产环境级别：`info`。可通过 `CSLOGGER_MAIN_LEVEL` 环境变量覆盖。

## 国际化工作流

基准语言：`src/renderer/src/i18n/locales/en-us.json`。人工翻译：`zh-cn`、`zh-tw`。机器翻译文件在 `src/renderer/src/i18n/translate/`。

工作流：编辑 `en-us.json` → `pnpm i18n:sync`（同步 key，新增标记为 `[to be translated]`）→ `pnpm i18n:translate`（AI 自动翻译）。

ESLint 规则强制要求：`t()` 函数中禁止使用模板字符串。

## 样式

Tailwind CSS 4 + Ant Design 5。使用 `cn()` 工具函数（clsx + tailwind-merge）进行条件类名拼接。Biome 通过 `useSortedClasses` 规则自动排序 Tailwind 类名（指定 `cn` 函数）。

自定义 CSS 在 `src/renderer/src/assets/styles/`（动画、Markdown 渲染、滚动条、响应式断点、颜色体系）。

## 代码质量工具链

- **Oxlint** → 快速第一轮 lint（`--fix`）
- **ESLint** → React、Hooks、导入排序（`simple-import-sort`）、未使用导入（`unused-imports`）、i18n 检查
- **Biome** → 格式化（120 字符行宽、2 空格缩进、单引号、无尾逗号、按需分号、`bracketSameLine: true`）+ Tailwind 类名排序
- **TypeScript** → 通过 `tsgo` 严格类型检查（同时检查 `tsconfig.node.json` 和 `tsconfig.web.json`）

## CI 流水线（`.github/workflows/ci.yml`）

PR 触发（目标分支 `main`、`develop`、`v2`），依次检查：lint → format → typecheck → i18n:check → i18n:hardcoded:strict → test。

## Pull Request 工作流

1. 创建 PR 前必须先阅读 `.github/pull_request_template.md`
2. PR body 必须包含模板中的**所有章节**（What、Why、Breaking changes、Special notes、Checklist、Release note）
3. 不可跳过任何章节 — 不适用的标注 N/A
4. Redux/IndexedDB 数据模型变更的功能 PR 在 v2.0.0 前不被接受
