# Admin — 企业版管理面板

## 技术栈

React 18 + Ant Design 5 + Ant Design Pro Components + Zustand + ECharts + Vite + TypeScript

## 核心页面

| 路由 | 页面 | 功能 |
|------|------|------|
| `/dashboard` | 仪表盘 | 概览统计 |
| `/users` | 用户管理 | 表格 + CRUD |
| `/departments` | 部门管理 | 树结构 CRUD |
| `/roles` | 角色权限 | 权限矩阵配置 |
| `/models` | 模型配置 | Provider、API Key、定价 |
| `/knowledge-bases` | 知识库 | 文档上传、权限 |
| `/statistics` | 统计分析 | 多维度用量图表 |
| `/assistant-presets` | 助手预设 | 模板 + 标签管理 |
| `/backups` | 备份管理 | 下载/恢复 |
| `/settings` | 系统设置 | 全局配置 |

## 认证

JWT 双 Token 机制（accessToken 1h + refreshToken 7d），支持飞书 OAuth 和开发者登录。

权限守卫：`PrivateRoute` 组件检查 `useAuthStore().isAuthenticated`。

## 状态管理

Zustand + persist 中间件（localStorage key: `cherry-studio-admin-auth`）。

## API 服务

`src/services/api.ts` 封装 axios 实例：
- 请求拦截器：自动附加 Authorization 头
- 响应拦截器：401 时自动刷新 Token + 请求重试（带并发队列）

## 开发命令

```bash
pnpm dev           # Vite 开发服务器（默认 http://localhost:5173）
pnpm build         # 生产构建
pnpm preview       # 预览生产构建
pnpm lint          # ESLint 检查
pnpm typecheck     # TypeScript 类型检查
```

## 与 server 联调

- 所有 API 请求发往 server 的 `/api/v1/*` 端点
- 共享类型通过 `@cherry-studio/enterprise-shared` 工作区包提供
- server 的 `CORS_ORIGINS` 需包含 `http://localhost:5173`
