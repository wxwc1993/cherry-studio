# Server — 企业版后端服务

## 技术栈

Express 5 + Drizzle ORM + PostgreSQL（pgvector）+ Redis（BullMQ）+ Pino 日志 + Prometheus 监控

## 核心功能

- 多租户组织管理（企业 → 部门树 → 用户）
- RBAC 权限控制（角色 + 细粒度权限矩阵）
- AI 模型配置管理（多 Provider、定价历史、配额预警）
- 知识库 RAG（pgvector 向量检索、PDF/Word 文档解析分块）
- 飞书集成（OAuth 登录、AlertManager Webhook 告警）
- 数据库定时备份 + OSS 存储
- 用量统计与审计日志

## 数据库

PostgreSQL + pgvector（20 张表），schema 定义在 `src/models/schema.ts`。

核心表：companies、departments、users、roles、models、model_permissions、model_pricing、knowledge_bases、kb_documents、document_chunks（含 vector 1536 维 embedding）、conversations、messages、usage_logs、audit_logs、backups、refresh_tokens、assistant_presets 等。

## API 路由

所有端点挂载于 `/api/v1` 前缀（定义在 `src/routes/`）：

| 路由 | 功能 |
|------|------|
| `/auth` | 认证（飞书 OAuth、开发者登录、Token 刷新） |
| `/users` | 用户 CRUD |
| `/departments` | 部门树 CRUD |
| `/roles` | 角色权限 CRUD |
| `/models` | AI 模型配置、定价、远程拉取 |
| `/knowledge-bases` | 知识库 CRUD + 文档上传 |
| `/conversations` | 对话管理 |
| `/statistics` | 用量统计（多维度聚合） |
| `/admin` | 后台设置、备份/恢复 |
| `/assistant-presets` | 助手预设 + 标签管理 |

特殊端点：`GET /health`（健康检查）、`GET /metrics`（Prometheus）、`POST /webhooks/alertmanager`（飞书告警）。

## 认证与权限

- JWT 双 Token：accessToken（1h）+ refreshToken（7d）
- RBAC：`roles.permissions`（JSONB）存储细粒度权限
- 中间件：`requirePermission(category, permission)`

## 开发命令

```bash
pnpm dev           # 热重载开发（默认 http://localhost:3000）
pnpm build         # tsup 构建
pnpm start         # 生产启动
pnpm test          # Vitest 测试
pnpm db:generate   # 生成 Drizzle 迁移
pnpm db:push       # 推送 schema 变更（开发环境）
pnpm db:migrate    # 执行迁移（生产环境）
pnpm db:seed       # 运行种子脚本
pnpm db:studio     # Drizzle Studio 可视化
```

## 环境配置

复制 `.env.example` → `.env`，关键变量：

| 变量组 | 说明 |
|--------|------|
| `DB_*` | PostgreSQL 连接（HOST、PORT、USER、PASSWORD、NAME） |
| `REDIS_*` | Redis（任务队列、缓存） |
| `JWT_SECRET` | JWT 签名密钥（生产环境必须修改） |
| `ENCRYPTION_KEY` | AES-256-GCM 加密密钥（32 字符） |
| `FEISHU_APP_ID` / `FEISHU_APP_SECRET` | 飞书 OAuth |
| `RATE_LIMIT_*` | 速率限制 |
| `LOG_LEVEL` | 日志级别 |
