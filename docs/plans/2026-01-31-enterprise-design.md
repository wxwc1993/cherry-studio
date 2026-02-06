# Cherry Studio 企业版设计方案

## 概述

将 Cherry Studio 从个人版桌面应用改造为企业版产品，包含：
- 企业版 Electron 客户端
- 企业后台服务（Node.js + Express）
- Web 管理后台（React + Ant Design Pro）

## 需求总结

| 维度 | 选择 |
|-----|------|
| 部署模式 | 混合模式（客户端 + 后台服务器） |
| 技术栈 | Node.js + Express |
| 员工管理 | 角色权限 + 部门层级 + 飞书 OAuth |
| 模型访问 | 统一 Key + 白名单 + 配额 + 私有模型 |
| 共享知识库 | 细粒度权限 + 编辑者/查看者 + 集中存储 |
| 数据备份 | 完整业务数据，每日增量 + 每周全量 |
| 管理后台 | 独立 Web 后台 + 客户端管理员模式 |
| 客户端改造 | 最小改动 + 企业 UI 增强 |
| 部署方式 | 企业私有化部署（Docker） |

---

## 1. 系统架构

```
┌─────────────────┐         ┌─────────────────────────────────┐
│  企业版客户端    │  HTTPS  │        企业后台服务器             │
│  (Electron)     │◄───────►│  ┌─────────────────────────────┐ │
│                 │         │  │  Express API Server         │ │
│  - 飞书登录     │         │  │  - /auth    认证服务         │ │
│  - 对话界面     │         │  │  - /models  模型代理         │ │
│  - 知识库检索   │         │  │  - /kb      知识库服务       │ │
│  - 用量查看     │         │  │  - /admin   管理接口         │ │
│                 │         │  │  - /metrics 监控指标         │ │
└─────────────────┘         │  └─────────────────────────────┘ │
                            │  ┌─────────────────────────────┐ │
┌─────────────────┐         │  │  LiteLLM Proxy (Python)     │ │
│  Web 管理后台   │  HTTPS  │  │  - 多供应商适配              │ │
│  (React SPA)    │◄───────►│  │  - 负载均衡                 │ │
│                 │         │  └─────────────────────────────┘ │
│  - 用户管理     │         │  ┌─────────────────────────────┐ │
│  - 模型配置     │         │  │  PostgreSQL + pgvector       │ │
│  - 知识库管理   │         │  │  - 用户/部门/角色           │ │
│  - 数据统计     │         │  │  - 知识库向量索引 (pgvector) │ │
│  - 用户API Key  │         │  │  - 用量统计                 │ │
└─────────────────┘         │  └─────────────────────────────┘ │
                            │  ┌─────────────────────────────┐ │
┌─────────────────┐         │  │  阿里云 OSS                  │ │
│  监控系统       │  HTTPS  │  │  - 知识库原始文件            │ │
│  - Prometheus   │◄───────►│  │  - 备份文件                 │ │
│  - Grafana      │         │  └─────────────────────────────┘ │
│  - AlertManager │         │                                   │
└─────────────────┘         │                                   │
                            └─────────────────────────────────┘
```

---

## 2. 数据模型

### 核心实体

| 表名 | 用途 | 关键字段 |
|-----|------|---------|
| `companies` | 企业信息 | id, name, feishu_app_id, settings |
| `departments` | 部门层级 | id, company_id, parent_id, name |
| `users` | 用户账号 | id, feishu_user_id, dept_id, role_id |
| `roles` | 角色定义 | id, name, permissions (JSON) |
| `models` | 模型配置 | id, provider, name, api_key, quota |
| `model_permissions` | 模型权限 | model_id, dept_id, role_id |
| `knowledge_bases` | 知识库 | id, name, owner_dept_id, visibility |
| `kb_permissions` | 知识库权限 | kb_id, target_type, target_id, level |
| `kb_documents` | 知识库文档 | id, kb_id, file_path, status, checksum |
| `document_chunks` | 文档向量分块 | id, document_id, content, embedding (vector), chunk_index, checksum |
| `conversations` | 对话记录 | id, user_id, model_id, created_at |
| `messages` | 消息内容 | id, conversation_id, role, content |
| `usage_logs` | 用量日志 | id, user_id, model_id, tokens, cost |
| `user_api_keys` | 用户级 API Key | id, user_id, provider, encrypted_key, is_active |

### 新增表结构

```sql
-- 用户级 API Key
CREATE TABLE user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,        -- openai, anthropic, azure, gemini, ollama
  encrypted_key TEXT NOT NULL,          -- AES-256-GCM 加密
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- 文档分块（含向量和 checksum）
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES kb_documents(id) ON DELETE CASCADE,
  knowledge_base_id UUID REFERENCES knowledge_bases(id),
  content TEXT NOT NULL,
  embedding vector(1536),  -- OpenAI text-embedding-3-small 维度
  chunk_index INTEGER NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_embedding CHECK (vector_dims(embedding) = 1536)
);

-- 更新 kb_documents 表增加 checksum 字段
ALTER TABLE kb_documents ADD COLUMN checksum VARCHAR(64);
```

### 权限模型

```typescript
// 角色权限
{
  "models": ["read", "use"],
  "knowledge_bases": ["read", "write", "admin"],
  "users": ["read"],
  "statistics": ["read"]
}

// 知识库权限级别
enum KBPermissionLevel {
  VIEWER = "viewer",
  EDITOR = "editor",
  ADMIN = "admin"
}
```

---

## 3. API 设计

```
/api/v1/
├── /auth                    # 认证服务
│   ├── POST /feishu/login
│   ├── POST /refresh
│   └── POST /logout
│
├── /users                   # 用户管理
├── /departments             # 部门管理
├── /models                  # 模型服务
│   ├── GET    /             # 可用模型列表
│   ├── POST   /:id/chat     # 对话代理
│   └── GET    /:id/usage    # 用量统计
│
├── /knowledge-bases         # 知识库服务
│   ├── POST   /:id/documents
│   ├── POST   /:id/search
│   └── PATCH  /:id/permissions
│
├── /conversations           # 对话管理
├── /statistics              # 统计分析
└── /admin                   # 系统管理
    ├── POST   /backup
    └── POST   /restore
```

---

## 4. 客户端改造

### 新增文件

```
src/renderer/src/
├── pages/login/FeishuLogin.tsx
├── pages/settings/EnterprisePanel.tsx
├── components/DepartmentSwitcher/
├── components/UsagePanel/
├── store/auth.ts
├── store/enterprise.ts
├── services/AuthService.ts
├── services/EnterpriseApi.ts
├── hooks/useAuth.ts
└── hooks/usePermission.ts
```

### 改造文件

- `src/renderer/src/store/llm.ts` - 从服务端获取模型
- `src/renderer/src/services/ApiService.ts` - 指向企业服务器
- `src/main/config.ts` - 企业服务器配置

### 移除功能

- 本地 API Key 配置
- 本地知识库存储
- 本地对话历史（改为服务端同步）

---

## 5. Web 管理后台

### 技术栈

- React + TypeScript
- Ant Design Pro
- Zustand
- Vite

### 页面

- `/dashboard` - 仪表盘
- `/users` - 用户管理
- `/departments` - 部门管理
- `/roles` - 角色权限
- `/models` - 模型管理
- `/knowledge-bases` - 知识库管理
- `/statistics` - 数据统计
- `/backup` - 备份管理
- `/settings` - 系统设置

---

## 6. 部署方案

### Docker Compose

```yaml
services:
  api:
    image: cherry-studio-enterprise/api:latest
    ports: ["3000:3000"]
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_SECRET=${JWT_SECRET}
      - FEISHU_APP_ID=${FEISHU_APP_ID}
      - FEISHU_APP_SECRET=${FEISHU_APP_SECRET}
      - STORAGE_TYPE=aliyun-oss
      - OSS_REGION=${OSS_REGION}
      - OSS_ACCESS_KEY_ID=${OSS_ACCESS_KEY_ID}
      - OSS_ACCESS_KEY_SECRET=${OSS_ACCESS_KEY_SECRET}
      - OSS_BUCKET=${OSS_BUCKET}
      - FEISHU_ALERT_WEBHOOK=${FEISHU_ALERT_WEBHOOK}
      - FEISHU_ALERT_ENABLED=${FEISHU_ALERT_ENABLED:-false}

  admin:
    image: cherry-studio-enterprise/admin:latest
    ports: ["3001:80"]

  litellm:
    image: ghcr.io/berriai/litellm:main-latest
    ports: ["4000:4000"]
    volumes:
      - ./litellm/config.yaml:/app/config.yaml
    command: ["--config", "/app/config.yaml"]

  postgres:
    image: pgvector/pgvector:pg17
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: cherry_enterprise
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine

  prometheus:
    image: prom/prometheus:latest
    ports: ["9090:9090"]
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./prometheus/rules.yml:/etc/prometheus/rules.yml

  grafana:
    image: grafana/grafana:latest
    ports: ["3002:3000"]
    volumes:
      - ./grafana/dashboards:/var/lib/grafana/dashboards

  alertmanager:
    image: prom/alertmanager:latest
    ports: ["9093:9093"]
    volumes:
      - ./alertmanager/alertmanager.yml:/etc/alertmanager/alertmanager.yml

volumes:
  postgres_data:
```

### 备份策略

- 每日 02:00 增量备份（保留 7 天）
- 每周日 03:00 全量备份（保留 4 周）
- 每月 1 日归档备份（保留 12 个月）
- 备份存储：阿里云 OSS（加密存储）

---

## 7. 项目结构

```
cherry-studio/
├── src/                          # 企业版 Electron 客户端
├── packages/
│   ├── shared/                   # 共享代码（类型、Schema、工具）
│   ├── server/                   # 企业后台服务
│   └── admin/                    # Web 管理后台
├── docker/                       # Docker 部署配置
├── docs/enterprise/              # 企业版文档
└── pnpm-workspace.yaml
```

---

## 8. 实施计划

| 阶段 | 内容 | 产出 |
|-----|------|------|
| Phase 1 | 基础框架搭建 | Monorepo 结构、shared 包、基础 Server |
| Phase 2 | 认证与用户系统 | 飞书 OAuth、用户/部门/角色管理 |
| Phase 3 | 模型管理 | 统一 API Key、模型代理、配额系统 |
| Phase 4 | 知识库迁移 | 服务端知识库、权限控制、检索 API |
| Phase 5 | 客户端改造 | 登录流程、企业模式、移除本地存储 |
| Phase 6 | 管理后台 | Web 管理界面全部功能 |
| Phase 7 | 备份与运维 | 备份系统、监控、日志 |
| Phase 8 | 测试与文档 | 集成测试、部署文档、用户手册 |

---

## 9. 验证方案

### 开发环境验证

```bash
# 启动后台服务
cd packages/server && pnpm dev

# 启动管理后台
cd packages/admin && pnpm dev

# 启动客户端
pnpm dev
```

### 功能验证清单

- [ ] 飞书 OAuth 登录流程
- [ ] 用户/部门/角色 CRUD
- [ ] 模型代理调用
- [ ] 知识库上传和检索
- [ ] 权限控制生效
- [ ] 用量统计准确
- [ ] 备份/恢复流程
- [ ] 客户端与服务端通信

---

## 10. 安全机制

### 10.1 API Key 加密存储

企业模型 API Key 的安全存储方案：

```typescript
// packages/server/src/services/crypto.service.ts
interface EncryptionConfig {
  algorithm: 'aes-256-gcm';
  keyDerivation: 'pbkdf2';
  iterations: 100000;
  saltLength: 32;
  ivLength: 16;
  tagLength: 16;
}

// 密钥管理策略
interface KeyManagement {
  // 主密钥来源（优先级从高到低）
  sources: [
    'ENCRYPTION_KEY 环境变量',
    'HashiCorp Vault (可选)',
    'AWS KMS / 阿里云 KMS (可选)'
  ];
  // 密钥轮换
  rotation: {
    period: '90 days';
    gracePeriod: '7 days';  // 新旧密钥共存期
    reEncryptOnRotation: true;
  };
}

// 加密存储结构
interface EncryptedApiKey {
  id: string;
  provider: string;
  encrypted_key: string;     // Base64(IV + CipherText + AuthTag)
  key_version: number;       // 用于密钥轮换
  created_at: Date;
  last_rotated_at: Date;
}
```

**实现要点：**
- 每个 API Key 使用独立 IV
- AuthTag 用于验证密文完整性
- 密钥轮换时自动重新加密所有 Key
- 禁止在日志中输出明文 Key

### 10.2 JWT Token 管理

```typescript
// Token 配置
interface TokenConfig {
  accessToken: {
    expiresIn: '15m';
    algorithm: 'RS256';
  };
  refreshToken: {
    expiresIn: '7d';
    algorithm: 'RS256';
    rotateOnUse: true;  // 使用后立即轮换
  };
}

// Token 吊销机制
interface TokenRevocation {
  // Redis 存储已吊销的 Token
  storage: 'redis';
  keyPattern: 'revoked:token:{jti}';
  ttl: 'token 原有效期';

  // 吊销场景
  scenarios: [
    '用户主动登出',
    '密码变更',
    '管理员强制下线',
    '检测到异常登录'
  ];
}

// 并发登录控制
interface ConcurrentLoginPolicy {
  maxDevices: 5;                    // 最多同时登录设备
  strategy: 'kick_oldest';          // 超限时踢出最老会话
  deviceTracking: {
    fields: ['user_agent', 'ip', 'device_id'];
    trustDevice: '30 days';         // 可信设备记忆
  };
}

// Refresh Token 竞态处理
interface RefreshRaceCondition {
  // 问题：多个请求同时刷新
  solution: 'token_family';
  implementation: {
    // 每个 refresh token 属于一个 family
    familyId: 'uuid';
    // 同一 family 的 token 只能使用一次
    oneTimeUse: true;
    // 检测到重用时，吊销整个 family
    reuseDetection: 'revoke_family';
  };
}
```

### 10.3 速率限制

```typescript
// packages/server/src/middleware/rate-limit.middleware.ts
interface RateLimitConfig {
  // 全局限制
  global: {
    windowMs: 60000;           // 1 分钟窗口
    maxRequests: 1000;         // 每分钟 1000 请求
  };

  // IP 级限制
  ip: {
    windowMs: 60000;
    maxRequests: 100;
    blockDuration: 300000;     // 超限后封锁 5 分钟
  };

  // 用户级限制
  user: {
    windowMs: 60000;
    maxRequests: 200;
    burstAllowance: 50;        // 允许短时突发
  };

  // 端点特定限制
  endpoints: {
    '/auth/login': { windowMs: 300000, maxRequests: 5 };        // 防暴力破解
    '/models/:id/chat': { windowMs: 60000, maxRequests: 30 };   // 模型调用
    '/knowledge-bases/:id/upload': { windowMs: 3600000, maxRequests: 100 };
  };
}

// 限流响应
interface RateLimitResponse {
  statusCode: 429;
  headers: {
    'X-RateLimit-Limit': number;
    'X-RateLimit-Remaining': number;
    'X-RateLimit-Reset': number;      // Unix timestamp
    'Retry-After': number;            // 秒
  };
  body: {
    error: 'RATE_LIMIT_EXCEEDED';
    message: string;
    retryAfter: number;
  };
}
```

### 10.4 敏感数据处理

```typescript
// 日志脱敏规则
interface LogSanitization {
  patterns: [
    { field: 'password', action: '***REDACTED***' },
    { field: 'api_key', action: '前4后4保留，中间*' },
    { field: 'access_token', action: '仅保留前8字符' },
    { field: 'email', action: '部分隐藏：u***@example.com' },
    { field: 'phone', action: '部分隐藏：138****1234' }
  ];

  // 自动检测并脱敏
  autoDetect: {
    jwtPattern: /eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*/g;
    apiKeyPattern: /sk-[A-Za-z0-9]{32,}/g;
  };
}

// 传输安全
interface TransportSecurity {
  tls: {
    minVersion: 'TLSv1.2';
    preferredVersion: 'TLSv1.3';
    cipherSuites: 'ECDHE-RSA-AES256-GCM-SHA384:...';
  };

  headers: {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains';
    'X-Content-Type-Options': 'nosniff';
    'X-Frame-Options': 'DENY';
    'Content-Security-Policy': "default-src 'self'";
  };
}

// 数据销毁策略
interface DataDestruction {
  // 用户删除后的数据处理
  userDeletion: {
    conversations: 'soft_delete, 30天后硬删除';
    usageLogs: '匿名化保留用于统计';
    personalInfo: '立即硬删除';
  };

  // 安全删除
  secureDelete: {
    method: '覆写后删除';
    verification: '删除后校验不可恢复';
  };
}
```

---

## 11. 错误处理与边界情况

### 11.1 错误恢复策略

```typescript
// 重试逻辑
interface RetryStrategy {
  // 可重试错误类型
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    '502 Bad Gateway',
    '503 Service Unavailable',
    '504 Gateway Timeout',
    'RATE_LIMIT_EXCEEDED'
  ];

  // 退避策略
  backoff: {
    type: 'exponential';
    initialDelay: 1000;       // 1秒
    maxDelay: 30000;          // 最大30秒
    multiplier: 2;
    jitter: true;             // 添加随机抖动
  };

  maxRetries: 3;
}

// 超时配置
interface TimeoutConfig {
  api: {
    default: 30000;           // 30秒
    upload: 300000;           // 5分钟
    modelChat: 120000;        // 2分钟
    embedding: 60000;         // 1分钟
  };

  // 超时后处理
  onTimeout: {
    cancelRequest: true;
    logEvent: true;
    notifyUser: true;
    fallback: 'optional';     // 可选降级
  };
}

// 补偿机制（用于分布式事务）
interface CompensationMechanism {
  // 场景：知识库文档处理失败
  knowledgeBaseUpload: {
    steps: [
      '1. 上传文件到 MinIO',
      '2. 创建文档记录',
      '3. 提交 Embedding 任务',
      '4. 更新知识库状态'
    ];
    compensation: [
      '4失败 → 标记任务失败，等待重试',
      '3失败 → 删除文档记录，删除文件',
      '2失败 → 删除文件'
    ];
  };
}
```

### 11.2 并发与一致性

```typescript
// 多设备会话同步
interface SessionSync {
  // 乐观锁
  optimisticLock: {
    field: 'version';
    conflictResolution: 'last_write_wins';
  };

  // 消息顺序保证
  messageOrdering: {
    sequenceNumber: true;          // 每条消息有序列号
    gapDetection: true;            // 检测消息缺失
    reorderBuffer: 5000;           // 5秒缓冲等待乱序消息
  };
}

// 队列机制
interface QueueMechanism {
  // Embedding 任务队列
  embeddingQueue: {
    name: 'embedding:tasks';
    maxConcurrency: 10;
    priorityLevels: ['high', 'normal', 'low'];
    deadLetterQueue: 'embedding:failed';
    maxRetries: 3;
  };

  // 去重
  deduplication: {
    window: 300000;                // 5分钟内相同任务去重
    idempotencyKey: 'hash(file_id + version)';
  };
}

// 冲突解决
interface ConflictResolution {
  // 知识库同时编辑
  knowledgeBase: {
    detection: 'version_mismatch';
    strategies: ['merge', 'overwrite', 'reject'];
    default: 'reject_with_notification';
  };

  // 配置同时修改
  configuration: {
    adminPriority: true;           // 管理员优先
    auditLog: true;                // 记录所有变更
  };
}
```

### 11.3 配额管理

```typescript
// 配额预警机制
interface QuotaWarning {
  thresholds: [
    { percent: 80, action: 'notify_user' },
    { percent: 95, action: 'notify_user_and_admin' },
    { percent: 100, action: 'block_and_notify' }
  ];

  notification: {
    channels: ['in_app', 'email', 'feishu_bot'];
    template: 'quota_warning';
    frequency: 'once_per_threshold';
  };
}

// 降级策略
interface QuotaDegradation {
  // 配额耗尽时
  onExhausted: {
    // 选项 1：完全阻止
    block: true;
    // 选项 2：降级到低成本模型
    fallbackModel: 'gpt-3.5-turbo';
    // 选项 3：借用部门额度
    borrowFromDepartment: true;
  };

  // 借用规则
  borrowing: {
    maxBorrowPercent: 20;          // 最多借用部门额度的 20%
    approvalRequired: false;
    autoRepay: true;               // 下月自动归还
  };
}

// 实时配额检查
interface QuotaCheck {
  // 请求前检查
  preCheck: {
    estimateTokens: true;          // 预估消耗
    reserveQuota: true;            // 预留额度
    reserveTimeout: 300000;        // 预留 5 分钟
  };

  // 请求后结算
  postSettle: {
    releaseUnused: true;           // 释放未用预留
    recordActual: true;            // 记录实际消耗
  };
}
```

### 11.6 配额与成本系统实现

#### 配额检查流程

```
请求 → 预估 Token → 检查配额 → 调用模型 → 记录用量 → 更新配额
                      ↓ 配额不足
                    返回 429 (完全阻止)
```

#### 成本计算服务

```typescript
// packages/server/src/services/cost.service.ts
interface ModelPricing {
  inputTokenPrice: number;   // 每 1K token 价格（美元）
  outputTokenPrice: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  'gpt-4-turbo': { inputTokenPrice: 0.01, outputTokenPrice: 0.03 },
  'gpt-4o': { inputTokenPrice: 0.005, outputTokenPrice: 0.015 },
  'gpt-3.5-turbo': { inputTokenPrice: 0.0005, outputTokenPrice: 0.0015 },
  'claude-3-opus': { inputTokenPrice: 0.015, outputTokenPrice: 0.075 },
  'claude-3-sonnet': { inputTokenPrice: 0.003, outputTokenPrice: 0.015 },
};

export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  return (inputTokens / 1000) * pricing.inputTokenPrice +
         (outputTokens / 1000) * pricing.outputTokenPrice;
}
```

#### 配额阻止策略（完全阻止）

```typescript
// packages/server/src/middleware/quota-check.middleware.ts
export async function checkQuota(req: Request, res: Response, next: NextFunction) {
  const userId = req.user.id;
  const model = req.body.model;

  const quota = await quotaService.getUserQuota(userId, model);
  const estimatedTokens = Math.ceil(JSON.stringify(req.body.messages).length / 4);

  if (quota.remaining < estimatedTokens) {
    throw new QuotaExceededError('配额不足，请联系管理员增加配额');
  }

  next();
}
```

#### 预警机制（飞书通知）

```typescript
// packages/server/src/services/quota-alert.service.ts
const THRESHOLDS = [
  { percent: 80, notifyUser: true, notifyAdmin: false },
  { percent: 95, notifyUser: true, notifyAdmin: true },
  { percent: 100, notifyUser: true, notifyAdmin: true }
];

export async function checkAndNotifyQuota(userId: string, usedPercent: number) {
  for (const threshold of THRESHOLDS.reverse()) {
    if (usedPercent >= threshold.percent) {
      if (threshold.notifyUser) {
        await feishuAlertService.sendToUser(userId,
          `您的 AI 配额已使用 ${usedPercent.toFixed(1)}%，请注意用量`);
      }
      if (threshold.notifyAdmin) {
        await feishuAlertService.sendToAdmin(
          `用户 ${userId} 配额已使用 ${usedPercent.toFixed(1)}%`);
      }
      break;
    }
  }
}
```

### 11.4 大规模操作

```typescript
// 批量导入
interface BatchImport {
  users: {
    maxBatchSize: 1000;
    format: ['csv', 'xlsx'];
    validation: 'row_by_row';
    onError: 'skip_and_report';    // 跳过错误行，继续处理

    // 进度反馈
    progress: {
      reportInterval: 100;         // 每 100 条报告一次
      websocket: true;             // WebSocket 实时推送
    };
  };

  // 知识库批量上传
  documents: {
    maxFiles: 100;
    maxTotalSize: '1GB';
    parallelUploads: 5;
    queueProcessing: true;
  };
}

// 大文件分片
interface LargeFileHandling {
  chunkSize: '10MB';
  maxFileSize: '500MB';

  upload: {
    protocol: 'multipart/form-data';
    resumable: true;               // 支持断点续传
    checksumVerify: 'md5';
  };

  processing: {
    streamParsing: true;           // 流式解析
    memoryLimit: '512MB';
    tempStorage: '/tmp/uploads';
  };
}

// 批量文档处理
interface BatchDocumentProcessing {
  // 分批策略
  batching: {
    size: 50;                      // 每批 50 个文档
    interval: 1000;                // 批次间隔 1 秒
  };

  // 资源控制
  resources: {
    maxConcurrentEmbeddings: 10;
    cpuThrottle: 80;               // CPU 使用率上限
    memoryThrottle: 70;            // 内存使用率上限
  };
}
```

### 11.5 用户生命周期

```typescript
// 离职数据处理
interface OffboardingDataPolicy {
  // 数据归属转移
  dataTransfer: {
    conversations: 'transfer_to_manager_or_archive';
    createdKnowledgeBases: 'transfer_ownership';
    personalFiles: 'delete_after_30_days';
  };

  // 访问权限
  accessRevocation: {
    immediate: ['login', 'api_access'];
    gracePeriod: ['data_export'];    // 允许导出个人数据
    gracePeriodDays: 7;
  };

  // 审计
  audit: {
    logAllActions: true;
    retainLogs: '2 years';
  };
}

// 部门迁移
interface DepartmentMigration {
  // 权限继承
  permissionInheritance: {
    option1: 'inherit_new_department';   // 继承新部门权限
    option2: 'keep_original';            // 保留原权限
    option3: 'merge';                    // 合并
  };

  // 数据处理
  data: {
    conversations: 'migrate_with_user';
    departmentKBAccess: 'recalculate';   // 重新计算访问权限
  };

  // 通知
  notification: {
    notifyUser: true;
    notifyOldManager: true;
    notifyNewManager: true;
  };
}
```

---

## 12. 客户端改造详细设计

### 12.1 双模式架构

```typescript
// src/renderer/src/config/mode.ts
type AppMode = 'personal' | 'enterprise';

interface ModeConfig {
  personal: {
    storage: 'local';
    auth: 'none';
    features: ['local_api_keys', 'local_kb', 'local_history'];
  };
  enterprise: {
    storage: 'remote';
    auth: 'feishu_oauth';
    features: ['unified_api', 'shared_kb', 'synced_history'];
  };
}

// 模式切换流程
interface ModeSwitchFlow {
  personalToEnterprise: [
    '1. 显示企业版登录入口',
    '2. 完成飞书 OAuth 认证',
    '3. 询问是否迁移本地数据到企业版',
    '4. 如选择迁移，上传本地对话和知识库',
    '5. 切换到企业模式，隐藏本地配置'
  ];

  enterpriseToPersonal: [
    '1. 确认退出企业版',
    '2. 清除本地企业缓存',
    '3. 询问是否导出企业数据到本地',
    '4. 切换到个人模式，恢复本地配置'
  ];

  dataIsolation: {
    localData: 'localStorage, IndexedDB';
    enterpriseData: 'separate namespace: enterprise_*';
    noCrossContamination: true;
  };
}

// UI 适配
interface UIAdaptation {
  // 条件渲染
  conditionalComponents: {
    'ApiKeySettings': { show: 'personal', hide: 'enterprise' },
    'LocalKnowledgeBase': { show: 'personal', hide: 'enterprise' },
    'FeishuLogin': { show: 'enterprise', hide: 'personal' },
    'UsagePanel': { show: 'enterprise', hide: 'personal' },
    'DepartmentSwitcher': { show: 'enterprise', hide: 'personal' }
  };

  // 菜单差异
  menuDiff: {
    enterprise: ['+用量统计', '+企业知识库', '-API Key 配置'],
    personal: ['+本地备份', '+导入导出', '-企业设置']
  };
}
```

### 12.2 离线模式（暂不支持）

> **注意**：当前版本企业版必须联网使用，离线模式将在后续版本迭代中实现。

企业版要求：
- 客户端必须能够连接到企业后台服务器
- 断网时显示"网络连接中断"提示
- 不缓存对话历史到本地（安全考虑）

```typescript
// 网络状态检测
interface NetworkStatus {
  // 检测方式
  detection: {
    interval: 5000;                // 5秒检测一次
    endpoints: ['/health'];
    timeout: 3000;
  };

  // 断网处理
  onDisconnect: {
    showWarning: true;
    disableChat: true;
    message: '网络连接中断，请检查网络后重试';
  };
}
```

### 12.3 数据同步

```typescript
// 对话历史同步
interface ConversationSync {
  // 全量同步（首次登录/长时间离线）
  fullSync: {
    trigger: ['first_login', 'offline > 7 days'];
    pagination: { pageSize: 100 };
    priority: 'recent_first';
  };

  // 增量同步
  incrementalSync: {
    trigger: 'app_focus | timer_30s';
    method: 'since_last_sync_timestamp';
    payload: ['new_messages', 'updated_conversations', 'deleted_ids'];
  };

  // 本地缓存管理
  localCache: {
    maxConversations: 500;
    maxMessagesPerConversation: 1000;
    expirationDays: 30;
    pruneStrategy: 'oldest_accessed_first';
  };
}

// WebSocket 实时同步
interface RealtimeSync {
  connection: {
    url: 'wss://api.company.com/ws';
    reconnect: {
      maxAttempts: 10;
      backoff: 'exponential';
    };
  };

  events: {
    // 接收事件
    receive: [
      'conversation.message.new',
      'conversation.updated',
      'conversation.deleted',
      'knowledgebase.updated',
      'quota.warning',
      'config.changed',
      'session.kicked'
    ];

    // 发送事件
    send: [
      'typing.start',
      'typing.stop',
      'message.read'
    ];
  };
}
```

### 12.4 配置下发

```typescript
// 配置下发机制
interface ConfigPush {
  // 配置类型
  configs: {
    modelList: {
      refreshInterval: 300000;     // 5分钟
      forceUpdate: true;
    };
    permissions: {
      refreshInterval: 60000;      // 1分钟
      forceUpdate: true;
    };
    uiSettings: {
      refreshInterval: 3600000;    // 1小时
      forceUpdate: false;
    };
    featureFlags: {
      refreshInterval: 300000;
      forceUpdate: true;
    };
  };

  // 推送渠道
  pushChannels: ['websocket', 'polling_fallback'];
}

// 强制更新策略
interface ForceUpdateStrategy {
  // 客户端版本检查
  versionCheck: {
    minSupportedVersion: '2.0.0';
    recommendedVersion: '2.1.0';
    checkInterval: 86400000;       // 24小时
  };

  // 强制更新行为
  forceUpdateBehavior: {
    belowMinVersion: 'block_usage_show_update_dialog';
    belowRecommended: 'show_update_banner';
  };

  // 配置变更响应
  configChangeResponse: {
    modelListChange: 'refresh_ui';
    permissionChange: 'refresh_and_recheck_access';
    criticalSecurityUpdate: 'force_logout_and_update';
  };
}
```

---

## 13. 模型代理详细设计 - LiteLLM 集成方案

### 13.1 架构设计

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  Express Server │─────►│  LiteLLM Proxy  │─────►│  各 LLM 供应商   │
│  (Node.js)      │ HTTP │  (Python)       │      │                 │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

**支持的供应商**：
- OpenAI（GPT-4, GPT-4o, GPT-3.5）
- Anthropic（Claude-3 系列）
- Azure OpenAI
- Google Gemini
- 本地部署（Ollama, vLLM）

### 13.2 用户级 API Key 架构

**Key 优先级**：用户级 → 企业级兜底

```typescript
// packages/server/src/services/api-key.service.ts
async function getApiKey(userId: string, provider: string): Promise<string> {
  // 1. 用户级 Key
  const userKey = await db.query.userApiKeys.findFirst({
    where: and(
      eq(userApiKeys.userId, userId),
      eq(userApiKeys.provider, provider),
      eq(userApiKeys.isActive, true)
    )
  });
  if (userKey) return cryptoService.decrypt(userKey.encryptedKey);

  // 2. 企业级 Key（兜底）
  const companyModel = await db.query.models.findFirst({
    where: eq(models.provider, provider)
  });
  if (companyModel?.apiKey) return cryptoService.decrypt(companyModel.apiKey);

  throw new AppError('NO_API_KEY_CONFIGURED', `No API Key for provider: ${provider}`);
}
```

### 13.3 LiteLLM 配置

```yaml
# docker/litellm/config.yaml
model_list:
  - model_name: gpt-4-turbo
    litellm_params:
      model: openai/gpt-4-turbo
      api_key: os.environ/OPENAI_API_KEY

  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY

  - model_name: claude-3-opus
    litellm_params:
      model: anthropic/claude-3-opus-20240229
      api_key: os.environ/ANTHROPIC_API_KEY

  - model_name: claude-3-sonnet
    litellm_params:
      model: anthropic/claude-3-sonnet-20240229
      api_key: os.environ/ANTHROPIC_API_KEY

  - model_name: gemini-pro
    litellm_params:
      model: gemini/gemini-pro
      api_key: os.environ/GEMINI_API_KEY

litellm_settings:
  drop_params: true
  set_verbose: false

router_settings:
  routing_strategy: simple-shuffle  # 负载均衡
  num_retries: 3
  retry_after: 1
```

### 13.4 Express 适配层

```typescript
// packages/server/src/services/model-proxy.service.ts
export class ModelProxyService {
  private litellmBaseUrl = process.env.LITELLM_URL || 'http://litellm:4000';

  async chat(userId: string, request: ChatRequest): Promise<ReadableStream> {
    const apiKey = await apiKeyService.getApiKey(userId, request.provider);

    const response = await fetch(`${this.litellmBaseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        stream: true
      })
    });

    return response.body;
  }
}
```

### 13.5 管理后台 API Key 配置

管理员可为用户配置各供应商的 API Key：

```typescript
// packages/admin/src/pages/Users.tsx - 新增 API Key 管理
interface UserApiKeyForm {
  provider: 'openai' | 'anthropic' | 'azure' | 'gemini' | 'ollama';
  apiKey: string;
}

// API 端点
PUT /api/v1/admin/users/:id/api-keys
{
  "provider": "openai",
  "apiKey": "sk-xxx..."
}
```

### 13.6 私有模型支持

```typescript
// 自部署模型集成
interface PrivateModelIntegration {
  // 支持的部署方式
  deployments: [
    'Ollama (本地)',
    'vLLM (GPU 服务器)',
    'TGI (Text Generation Inference)',
    'OpenAI-compatible API'
  ];

  // 在 LiteLLM 配置中添加
  litellmConfig: {
    model_name: 'internal-llama3-70b';
    litellm_params: {
      model: 'ollama/llama3:70b';
      api_base: 'http://gpu-server:11434';
    };
  };
}
```

---

## 14. 知识库详细设计

### 14.1 Embedding 流水线

```typescript
// 文档解析
interface DocumentParsing {
  // 支持的文件类型
  fileTypes: {
    text: ['txt', 'md', 'json', 'yaml', 'csv'];
    document: ['pdf', 'docx', 'doc', 'pptx', 'xlsx'];
    code: ['py', 'js', 'ts', 'java', 'go', 'rs'];
    web: ['html', 'htm'];
  };

  // 解析器
  parsers: {
    pdf: 'pdf-parse + OCR fallback';
    docx: 'mammoth';
    pptx: 'pptx-parser';
    xlsx: 'xlsx + cell-by-cell extraction';
  };

  // 预处理
  preprocessing: {
    removeHeaders: true;
    removeFooters: true;
    extractTables: true;
    extractImages: 'optional (with description)';
  };
}

// 分块策略
interface ChunkingStrategy {
  // 策略类型
  strategies: {
    fixedSize: {
      chunkSize: 500;              // tokens
      overlap: 50;                 // tokens
    };
    semantic: {
      method: 'sentence_boundary';
      maxChunkSize: 1000;
      minChunkSize: 100;
    };
    hybrid: {
      primary: 'semantic';
      fallback: 'fixed_size';
    };
  };

  // 元数据附加
  chunkMetadata: {
    source: 'file_path';
    pageNumber: 'if applicable';
    position: 'start_char, end_char';
    headings: 'extracted hierarchy';
  };
}

// Embedding 模型配置
interface EmbeddingModelConfig {
  // 支持的模型
  models: {
    'text-embedding-3-small': {
      dimensions: 1536;
      maxTokens: 8191;
      provider: 'openai';
    };
    'text-embedding-3-large': {
      dimensions: 3072;
      maxTokens: 8191;
      provider: 'openai';
    };
    'bge-large-zh': {
      dimensions: 1024;
      maxTokens: 512;
      provider: 'local';
    };
  };

  // 批处理
  batching: {
    batchSize: 100;                // 每批文本数
    maxBatchTokens: 50000;         // 每批最大 token
  };
}
```

### 14.2 向量索引管理 - pgvector

```sql
-- 启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- document_chunks 表设计
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES kb_documents(id) ON DELETE CASCADE,
  knowledge_base_id UUID REFERENCES knowledge_bases(id),
  content TEXT NOT NULL,
  embedding vector(1536),  -- OpenAI text-embedding-3-small 维度
  chunk_index INTEGER NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),

  -- 向量索引（使用 IVFFlat 或 HNSW）
  CONSTRAINT valid_embedding CHECK (vector_dims(embedding) = 1536)
);

-- 创建向量索引（HNSW 性能更好）
CREATE INDEX ON document_chunks USING hnsw (embedding vector_cosine_ops);

-- 全文搜索索引
ALTER TABLE document_chunks ADD COLUMN tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('chinese', content)) STORED;
CREATE INDEX ON document_chunks USING gin(tsv);
```

### 14.3 混合检索实现

```typescript
// packages/server/src/services/retrieval.service.ts
export class RetrievalService {
  async hybridSearch(kbId: string, query: string, topK: number = 20): Promise<SearchResult[]> {
    // 1. 生成查询向量
    const queryEmbedding = await this.embedService.embed(query);

    // 2. 向量检索
    const vectorResults = await db.execute(sql`
      SELECT id, content, 1 - (embedding <=> ${queryEmbedding}::vector) as score
      FROM document_chunks
      WHERE knowledge_base_id = ${kbId}
      ORDER BY embedding <=> ${queryEmbedding}::vector
      LIMIT ${topK}
    `);

    // 3. 全文检索
    const textResults = await db.execute(sql`
      SELECT id, content, ts_rank(tsv, plainto_tsquery('chinese', ${query})) as score
      FROM document_chunks
      WHERE knowledge_base_id = ${kbId} AND tsv @@ plainto_tsquery('chinese', ${query})
      ORDER BY score DESC
      LIMIT ${topK}
    `);

    // 4. RRF 融合
    return this.reciprocalRankFusion(vectorResults, textResults);
  }

  private reciprocalRankFusion(
    vectorResults: Result[],
    textResults: Result[],
    k = 60
  ): Result[] {
    const scores = new Map<string, { score: number; content: string }>();

    vectorResults.forEach((r, i) => {
      const rrf = 1 / (k + i + 1);
      const existing = scores.get(r.id) || { score: 0, content: r.content };
      scores.set(r.id, { ...existing, score: existing.score + rrf * 0.7 });
    });

    textResults.forEach((r, i) => {
      const rrf = 1 / (k + i + 1);
      const existing = scores.get(r.id) || { score: 0, content: r.content };
      scores.set(r.id, { ...existing, score: existing.score + rrf * 0.3 });
    });

    return [...scores.entries()]
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 20)
      .map(([id, data]) => ({ id, content: data.content, score: data.score }));
  }
}
```

### 14.4 阿里云百炼重排序

```typescript
// packages/server/src/services/rerank.service.ts
export class RerankService {
  private dashscopeApiKey = process.env.DASHSCOPE_API_KEY;

  async rerank(query: string, documents: SearchResult[], topN: number = 5): Promise<SearchResult[]> {
    const response = await fetch(
      'https://dashscope.aliyuncs.com/api/v1/services/rerank/text-rerank/model/gte-rerank',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.dashscopeApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gte-rerank',
          input: {
            query,
            documents: documents.map(d => d.content)
          },
          parameters: { top_n: topN }
        })
      }
    );

    const result = await response.json();
    return result.output.results.map((r: any) => ({
      id: documents[r.index].id,
      content: documents[r.index].content,
      score: r.relevance_score
    }));
  }
}
```

### 14.5 增量更新

```typescript
// packages/server/src/services/document-processor.service.ts
async updateDocument(docId: string, newContent: Buffer): Promise<void> {
  const existingDoc = await db.query.kbDocuments.findFirst({
    where: eq(kbDocuments.id, docId)
  });

  const newChecksum = crypto.createHash('sha256').update(newContent).digest('hex');

  // 内容未变化，跳过
  if (existingDoc.checksum === newChecksum) {
    return;
  }

  // 删除旧 chunks
  await db.delete(documentChunks).where(eq(documentChunks.documentId, docId));

  // 重新处理
  const chunks = await this.chunkDocument(newContent);
  const embeddings = await this.embedService.batchEmbed(chunks);

  // 插入新 chunks
  await db.insert(documentChunks).values(
    chunks.map((chunk, i) => ({
      documentId: docId,
      knowledgeBaseId: existingDoc.knowledgeBaseId,
      content: chunk,
      embedding: embeddings[i],
      chunkIndex: i
    }))
  );

  // 更新 checksum
  await db.update(kbDocuments)
    .set({ checksum: newChecksum, updatedAt: new Date() })
    .where(eq(kbDocuments.id, docId));
}
```

### 14.6 结果缓存

```typescript
// 结果缓存
interface ResultCache {
  // 缓存策略
  strategy: {
    type: 'query_hash';
    ttl: 300000;                   // 5 分钟
    maxSize: 10000;                // 最多缓存条目
  };

  // 缓存键
  cacheKey: 'hash(kb_id + query + params)';

  // 失效条件
  invalidation: [
    'knowledge_base_updated',
    'document_added',
    'document_deleted',
    'manual_clear'
  ];
}
```

### 14.7 异步处理

```typescript
// Redis Queue 设计
interface RedisQueueDesign {
  // 队列结构
  queues: {
    'kb:embedding:high': '高优先级（小文件、重新索引）';
    'kb:embedding:normal': '普通优先级（常规上传）';
    'kb:embedding:low': '低优先级（批量导入）';
    'kb:embedding:failed': '失败队列（死信）';
  };

  // 任务结构
  taskSchema: {
    id: 'uuid';
    type: 'embed | reindex | delete';
    knowledgeBaseId: 'string';
    documentId: 'string';
    priority: 'high | normal | low';
    attempts: 'number';
    createdAt: 'timestamp';
    scheduledAt: 'timestamp';
  };
}

// 任务优先级
interface TaskPriority {
  rules: {
    high: ['file_size < 100KB', 'reindex_single_doc', 'user_waiting'];
    normal: ['regular_upload', 'scheduled_reindex'];
    low: ['batch_import', 'full_kb_reindex'];
  };

  // 优先级调整
  dynamicPriority: {
    aging: true;                   // 老任务提升优先级
    agingInterval: 60000;          // 每分钟检查
    maxBoost: 2;                   // 最多提升 2 级
  };
}

// 失败重试
interface FailureRetry {
  policy: {
    maxRetries: 3;
    backoff: [5000, 30000, 120000];  // 5s, 30s, 2min
    retryableErrors: [
      'TIMEOUT',
      'RATE_LIMIT',
      'SERVICE_UNAVAILABLE'
    ];
    nonRetryableErrors: [
      'INVALID_FILE',
      'FILE_NOT_FOUND',
      'PERMISSION_DENIED'
    ];
  };

  // 死信处理
  deadLetter: {
    queue: 'kb:embedding:failed';
    retention: '7 days';
    alertOnFailure: true;
    manualReviewRequired: true;
  };
}
```

### 14.8 文档生命周期

```typescript
// 版本控制
interface DocumentVersioning {
  // 版本策略
  strategy: {
    versionOnUpload: true;
    maxVersions: 10;
    pruneOldVersions: true;
  };

  // 版本信息
  versionInfo: {
    version: 'number';
    uploadedBy: 'user_id';
    uploadedAt: 'timestamp';
    checksum: 'sha256';
    changeNote: 'optional string';
  };

  // 版本操作
  operations: {
    rollback: 'restore_specific_version';
    diff: 'compare_versions';
    history: 'list_all_versions';
  };
}

// 增量更新
interface IncrementalUpdate {
  // 检测变更
  changeDetection: {
    method: 'checksum_comparison';
    granularity: 'chunk_level';
  };

  // 增量处理
  processing: {
    newChunks: 'embed_and_insert';
    modifiedChunks: 'embed_and_update';
    deletedChunks: 'remove_from_index';
    unchangedChunks: 'skip';
  };
}

// 关联关系
interface DocumentRelations {
  // 关系类型
  types: {
    parent_child: '如 PDF 与其页面';
    reference: '文档间引用';
    version: '版本链';
    derived: '如摘要、翻译';
  };

  // 级联操作
  cascadeOperations: {
    deleteParent: 'delete_children';
    updateParent: 'notify_children';
    moveParent: 'move_children';
  };
}
```

---

## 15. 运维与监控

### 15.1 日志规范

```typescript
// 日志级别定义
interface LogLevels {
  ERROR: '系统错误，需要立即关注';
  WARN: '潜在问题，需要观察';
  INFO: '正常业务流程';
  DEBUG: '详细调试信息（生产环境关闭）';
}

// JSON Schema
interface LogEntry {
  timestamp: string;               // ISO 8601
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  service: string;                 // 服务名
  traceId: string;                 // 请求追踪 ID
  spanId: string;                  // 跨度 ID
  userId?: string;                 // 用户 ID（已脱敏）
  action: string;                  // 操作名称
  duration?: number;               // 耗时 (ms)
  status: 'success' | 'failure';
  error?: {
    code: string;
    message: string;
    stack?: string;                // 仅非生产环境
  };
  metadata?: Record<string, any>;  // 额外信息
}

// 采集存储
interface LogCollection {
  // 采集
  collector: {
    agent: 'Filebeat | Fluentd';
    format: 'JSON lines';
    rotation: 'daily, 7 days retention locally';
  };

  // 存储
  storage: {
    shortTerm: 'Elasticsearch (30 days)';
    longTerm: 'S3/MinIO (1 year, compressed)';
  };

  // 查询
  query: {
    interface: 'Kibana | Grafana Loki';
    alertIntegration: true;
  };
}
```

### 15.2 指标监控

```typescript
// 业务指标
interface BusinessMetrics {
  // 用户活跃度
  userMetrics: [
    'daily_active_users',
    'monthly_active_users',
    'sessions_per_user',
    'avg_session_duration'
  ];

  // 模型使用
  modelMetrics: [
    'requests_per_model',
    'tokens_per_model',
    'cost_per_model',
    'error_rate_per_model',
    'avg_latency_per_model'
  ];

  // 知识库
  knowledgeBaseMetrics: [
    'documents_indexed',
    'queries_per_kb',
    'avg_retrieval_latency',
    'retrieval_success_rate'
  ];
}

// 资源指标
interface ResourceMetrics {
  // 系统资源
  system: [
    'cpu_usage_percent',
    'memory_usage_percent',
    'disk_usage_percent',
    'network_io_bytes'
  ];

  // 服务资源
  service: [
    'request_rate',
    'error_rate',
    'p50_latency',
    'p95_latency',
    'p99_latency',
    'active_connections'
  ];

  // 数据库
  database: [
    'query_duration',
    'connection_pool_usage',
    'slow_queries_count',
    'replication_lag'
  ];
}

// Prometheus 暴露
interface PrometheusExposure {
  endpoint: '/metrics';
  format: 'OpenMetrics';

  // 标签规范
  labels: {
    required: ['service', 'environment', 'instance'];
    optional: ['model', 'endpoint', 'user_tier'];
  };
}
```

### 15.3 告警策略

```typescript
// 阈值配置
interface AlertThresholds {
  // 服务健康
  serviceHealth: {
    errorRateHigh: { threshold: 0.05, duration: '5m' };
    latencyHigh: { threshold: 2000, percentile: 'p95', duration: '5m' };
    serviceDown: { threshold: 0, duration: '1m' };
  };

  // 资源
  resources: {
    cpuHigh: { threshold: 85, duration: '10m' };
    memoryHigh: { threshold: 90, duration: '5m' };
    diskHigh: { threshold: 85, duration: '1h' };
  };

  // 业务
  business: {
    quotaExhausted: { threshold: 100, immediate: true };
    embeddingQueueBacklog: { threshold: 1000, duration: '15m' };
    loginFailureSpike: { threshold: 50, window: '5m' };
  };
}

// 通知渠道
interface NotificationChannels {
  channels: {
    feishu: {
      webhook: 'https://open.feishu.cn/...';
      mentionOnCritical: ['@admin1', '@admin2'];
    };
    email: {
      recipients: ['ops@company.com'];
      useForNonUrgent: true;
    };
    sms: {
      recipients: ['13800001111'];
      useForCriticalOnly: true;
    };
    pagerduty: {
      serviceKey: '...';
      useForCriticalOnly: true;
    };
  };
}

// 升级机制
interface EscalationPolicy {
  levels: [
    {
      name: 'L1';
      delay: '0m';
      channels: ['feishu'];
      responders: ['on-call-engineer'];
    },
    {
      name: 'L2';
      delay: '15m';
      channels: ['feishu', 'sms'];
      responders: ['team-lead'];
    },
    {
      name: 'L3';
      delay: '30m';
      channels: ['feishu', 'sms', 'pagerduty'];
      responders: ['engineering-manager'];
    }
  ];

  autoResolve: {
    enabled: true;
    afterDuration: '10m';
  };
}
```

### 15.6 Prometheus 指标实现

```typescript
// packages/server/src/metrics/index.ts
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

export const registry = new Registry();

// 请求指标
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [registry]
});

// Token 用量
export const modelTokensTotal = new Counter({
  name: 'model_tokens_total',
  help: 'Total tokens used',
  labelNames: ['model', 'type'], // type: input/output
  registers: [registry]
});

// 成本统计
export const modelCostTotal = new Counter({
  name: 'model_cost_usd_total',
  help: 'Total cost in USD',
  labelNames: ['model'],
  registers: [registry]
});

// 请求延迟
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'path'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [registry]
});

// 暴露端点
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', registry.contentType);
  res.end(await registry.metrics());
});
```

### 15.7 Grafana Dashboard

```json
// docker/grafana/dashboards/cherry-studio.json
{
  "title": "Cherry Studio Enterprise",
  "panels": [
    {
      "title": "请求速率 (QPS)",
      "type": "graph",
      "targets": [{ "expr": "rate(http_requests_total[5m])" }]
    },
    {
      "title": "Token 用量趋势",
      "type": "graph",
      "targets": [{ "expr": "sum(rate(model_tokens_total[1h])) by (model)" }]
    },
    {
      "title": "每日成本 (USD)",
      "type": "stat",
      "targets": [{ "expr": "sum(increase(model_cost_usd_total[24h]))" }]
    },
    {
      "title": "P95 响应延迟",
      "type": "gauge",
      "targets": [{ "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))" }]
    },
    {
      "title": "错误率",
      "type": "stat",
      "targets": [{ "expr": "rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m])" }]
    }
  ]
}
```

### 15.8 飞书告警 Webhook

```typescript
// packages/server/src/services/feishu-alert.service.ts
interface FeishuAlertConfig {
  webhookUrl: string;
}

export class FeishuAlertService {
  constructor(private config: FeishuAlertConfig) {}

  async send(title: string, content: string, level: 'info' | 'warning' | 'error') {
    const colorMap = { info: 'blue', warning: 'yellow', error: 'red' };

    await fetch(this.config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msg_type: 'interactive',
        card: {
          header: {
            title: { tag: 'plain_text', content: `[${level.toUpperCase()}] ${title}` },
            template: colorMap[level]
          },
          elements: [
            { tag: 'div', text: { tag: 'plain_text', content } }
          ]
        }
      })
    });
  }
}
```

### 15.9 AlertManager 配置

```yaml
# docker/alertmanager/alertmanager.yml
global:
  resolve_timeout: 5m

route:
  receiver: 'feishu-webhook'
  group_by: ['alertname']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h

receivers:
  - name: 'feishu-webhook'
    webhook_configs:
      - url: 'http://api:3000/webhooks/alertmanager'
        send_resolved: true
```

### 15.10 告警规则

```yaml
# docker/prometheus/rules.yml
groups:
  - name: cherry-studio
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "API 错误率超过 5%"

      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "P95 延迟超过 2 秒"

      - alert: QuotaExhausted
        expr: user_quota_remaining == 0
        labels:
          severity: info
        annotations:
          summary: "用户配额耗尽"
```

### 15.4 数据迁移

```typescript
// 个人版迁移到企业版
interface PersonalToEnterpriseMigration {
  // 迁移内容
  migratable: {
    conversations: '完整对话历史';
    knowledgeBases: '知识库文档和索引';
    settings: '用户偏好设置';
  };

  // 迁移流程
  flow: [
    '1. 用户在企业版客户端登录',
    '2. 检测到本地存在个人版数据',
    '3. 弹窗询问是否迁移',
    '4. 用户确认后，打包本地数据',
    '5. 加密上传到企业服务器',
    '6. 服务端解析并导入',
    '7. 验证数据完整性',
    '8. 本地数据标记为已迁移'
  ];

  // 冲突处理
  conflictHandling: {
    duplicateConversation: 'keep_both_with_suffix';
    duplicateKnowledgeBase: 'ask_user';
  };
}

// 企业间数据迁移
interface EnterpriseToEnterpriseMigration {
  // 场景
  scenarios: [
    '企业合并',
    '部门拆分',
    '员工调动'
  ];

  // 导出格式
  exportFormat: {
    type: 'encrypted_archive';
    format: 'zip';
    encryption: 'AES-256-GCM';
    contents: ['data.json', 'files/', 'vectors.bin'];
  };

  // 权限要求
  permissions: {
    export: 'admin';
    import: 'admin';
    crossCompany: 'super_admin_approval';
  };
}
```

### 15.5 灾备恢复

```typescript
// RTO/RPO 目标
interface RecoveryObjectives {
  tier1_critical: {
    rto: '4 hours';                // 恢复时间目标
    rpo: '1 hour';                 // 数据恢复点目标
    services: ['auth', 'model_proxy', 'api_gateway'];
  };
  tier2_important: {
    rto: '8 hours';
    rpo: '4 hours';
    services: ['knowledge_base', 'statistics'];
  };
  tier3_normal: {
    rto: '24 hours';
    rpo: '24 hours';
    services: ['admin_panel', 'backup_service'];
  };
}

// 备份类型
interface BackupTypes {
  // 热备
  hotStandby: {
    database: 'PostgreSQL streaming replication';
    vectorIndex: 'pgvector 随 PostgreSQL 一起复制';
    fileStorage: 'MinIO erasure coding';
    switchoverTime: '< 5 minutes';
  };

  // 冷备（阿里云 OSS）
  coldBackup: {
    frequency: 'daily';
    retention: '30 days';
    storage: '阿里云 OSS';
    encryption: 'AES-256-GCM';
  };
}

// 演练流程
interface DisasterRecoveryDrill {
  // 演练类型
  types: [
    'Tabletop exercise (每季度)',
    'Partial failover (每半年)',
    'Full failover (每年)'
  ];

  // 演练步骤
  steps: [
    '1. 通知相关人员',
    '2. 模拟故障场景',
    '3. 执行切换流程',
    '4. 验证服务可用性',
    '5. 验证数据完整性',
    '6. 切回主站点',
    '7. 复盘总结'
  ];

  // 成功标准
  successCriteria: {
    rtoMet: true;
    rpoMet: true;
    dataIntegrityVerified: true;
    noUnplannedDowntime: true;
  };
}
```

### 15.11 备份系统实现

#### 备份存储：阿里云 OSS

```typescript
// packages/server/src/services/backup.service.ts
import OSS from 'ali-oss';

const ossClient = new OSS({
  region: process.env.OSS_REGION,
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET
});

async function createBackup(type: 'full' | 'incremental'): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup-${type}-${timestamp}.sql.gz`;

  // PostgreSQL 备份
  await execAsync(`pg_dump ${process.env.DATABASE_URL} | gzip > /tmp/${filename}`);

  // AES-256 加密
  await execAsync(`openssl enc -aes-256-cbc -salt -pbkdf2 \
    -in /tmp/${filename} \
    -out /tmp/${filename}.enc \
    -pass pass:${process.env.BACKUP_ENCRYPTION_KEY}`);

  // 上传到 OSS
  await ossClient.put(`backups/db/${filename}.enc`, `/tmp/${filename}.enc`);

  // 记录备份
  await db.insert(backups).values({
    type,
    filename,
    storageLocation: `oss://${process.env.OSS_BUCKET}/backups/db/${filename}.enc`,
    status: 'completed'
  });

  // 清理临时文件
  fs.unlinkSync(`/tmp/${filename}`);
  fs.unlinkSync(`/tmp/${filename}.enc`);

  return filename;
}
```

#### 定时备份任务

```typescript
// packages/server/src/jobs/backup.job.ts
import cron from 'node-cron';

// 每日 02:00 增量备份
cron.schedule('0 2 * * *', async () => {
  await backupService.createBackup('incremental');
});

// 每周日 03:00 全量备份
cron.schedule('0 3 * * 0', async () => {
  await backupService.createBackup('full');
});

// 清理过期备份
cron.schedule('0 4 * * *', async () => {
  await backupService.cleanupExpiredBackups({
    incremental: 7,  // 保留 7 天
    full: 28         // 保留 4 周
  });
});
```

---

## 16. 测试策略

### 16.1 测试分层

```typescript
// 测试金字塔
interface TestPyramid {
  // 单元测试 (70%)
  unit: {
    coverage: '>= 80%';
    tools: ['Vitest', 'Jest'];
    focus: [
      '业务逻辑',
      '工具函数',
      '数据转换',
      '权限计算'
    ];
    mocking: 'external dependencies only';
  };

  // 集成测试 (20%)
  integration: {
    tools: ['Supertest', 'Testcontainers'];
    focus: [
      'API 端点',
      '数据库操作',
      '服务间通信',
      '认证流程'
    ];
    database: 'real PostgreSQL in Docker';
  };

  // E2E 测试 (10%)
  e2e: {
    tools: ['Playwright', 'Cypress'];
    focus: [
      '关键用户流程',
      '跨系统集成',
      '性能基准'
    ];
    environment: 'staging';
  };
}
```

### 16.2 测试环境

```typescript
// 环境配置
interface TestEnvironments {
  development: {
    database: 'local PostgreSQL or Docker';
    vectorDb: 'Milvus standalone';
    externalServices: 'mocked';
    data: 'seed data';
  };

  test: {
    database: 'Docker PostgreSQL (ephemeral)';
    vectorDb: 'Docker Milvus';
    externalServices: 'mocked or sandbox';
    data: 'fixtures';
  };

  staging: {
    database: 'cloud PostgreSQL + pgvector (isolated)';
    externalServices: 'sandbox accounts';
    data: 'anonymized production subset';
  };

  production: {
    database: 'cloud PostgreSQL + pgvector (HA)';
    externalServices: 'production';
    data: 'real data';
  };
}

// CI/CD 集成
interface CICDIntegration {
  pipeline: {
    onPush: ['lint', 'unit_tests', 'build'];
    onPR: ['lint', 'unit_tests', 'integration_tests', 'build'];
    onMerge: ['full_test_suite', 'deploy_staging'];
    onRelease: ['full_test_suite', 'security_scan', 'deploy_production'];
  };

  qualityGates: {
    coverage: '>= 80%';
    securityVulnerabilities: '0 critical, 0 high';
    performanceRegression: '< 10%';
  };
}
```

### 16.3 测试用例

```typescript
// 认证测试
interface AuthTestCases {
  feishuOAuth: [
    '正常登录流程',
    '无效授权码',
    'Token 过期刷新',
    '并发登录限制',
    '强制登出'
  ];

  permission: [
    '角色权限验证',
    '部门权限继承',
    '跨部门访问拒绝',
    '权限变更实时生效'
  ];
}

// 模型代理测试
interface ModelProxyTestCases {
  basic: [
    '正常对话请求',
    '流式响应',
    'Token 计数准确',
    '成本计算正确'
  ];

  edge: [
    '超长输入处理',
    '特殊字符处理',
    '并发请求处理',
    '上游超时处理'
  ];

  error: [
    '无效模型 ID',
    '配额不足',
    'API Key 失效',
    '上游服务不可用'
  ];
}

// 知识库测试
interface KnowledgeBaseTestCases {
  document: [
    '各类型文件上传',
    '大文件分片上传',
    '文档解析正确性',
    '分块策略验证'
  ];

  retrieval: [
    '语义搜索准确性',
    '混合检索效果',
    '权限过滤正确',
    '结果排序合理'
  ];
}
```

### 16.4 CI/CD 集成（80% 覆盖率强制）

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm lint
      - run: pnpm test:coverage
        env:
          DATABASE_URL: postgres://postgres:test@localhost:5432/test

      - name: Check coverage threshold
        run: |
          coverage=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$coverage < 80" | bc -l) )); then
            echo "❌ Coverage $coverage% is below 80% threshold"
            exit 1
          fi
          echo "✅ Coverage $coverage% meets 80% threshold"
```

### 16.5 关键测试用例

```typescript
// packages/server/src/__tests__/quota.service.test.ts
describe('QuotaService', () => {
  it('should calculate cost correctly', () => {
    const cost = costService.calculateCost('gpt-4-turbo', 1000, 500);
    expect(cost).toBeCloseTo(0.01 + 0.015); // $0.025
  });

  it('should throw when quota exceeded', async () => {
    await setUserQuota('user-1', 'gpt-4', 0);
    await expect(quotaService.checkQuota('user-1', 'gpt-4', 100))
      .rejects.toThrow('配额不足');
  });

  it('should send alert at 80% threshold', async () => {
    const sendSpy = vi.spyOn(feishuAlertService, 'send');
    await quotaAlertService.checkAndNotifyQuota('user-1', 82);
    expect(sendSpy).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('82'));
  });
});

// packages/server/src/__tests__/retrieval.service.test.ts
describe('RetrievalService', () => {
  it('should return hybrid search results', async () => {
    const results = await retrievalService.hybridSearch('kb-1', '测试查询', 10);
    expect(results.length).toBeLessThanOrEqual(10);
    expect(results[0]).toHaveProperty('score');
  });

  it('should apply reranking when enabled', async () => {
    const results = await retrievalService.search('kb-1', '测试查询', { rerank: true });
    expect(results.length).toBe(5); // topN = 5
  });
});
```

---

## 17. 实施计划详细分解

### 17.1 Phase 1: 基础框架搭建 (2 周)

| 任务 | 详细内容 | 交付物 | 验收标准 |
|-----|---------|--------|---------|
| 1.1 Monorepo 初始化 | 配置 pnpm workspace，设置 packages 目录结构 | pnpm-workspace.yaml, tsconfig 共享配置 | `pnpm install` 成功 |
| 1.2 Shared 包 | TypeScript 类型定义，Zod Schema，通用工具函数 | @cherry-studio/shared | 类型可在 server/admin/client 导入 |
| 1.3 Server 基础框架 | Express 应用骨架，中间件配置，健康检查端点 | 可运行的 API 服务 | `/health` 返回 200 |
| 1.4 Docker 配置 | Dockerfile，docker-compose.dev.yml | 可启动的开发环境 | `docker-compose up` 成功 |
| 1.5 CI/CD 基础 | GitHub Actions 工作流，lint/test/build | .github/workflows | PR 检查通过 |

**依赖关系：** 1.1 → 1.2 → 1.3，1.4 与 1.3 并行

**风险：** 依赖版本冲突 → 提前锁定关键依赖版本

### 17.2 Phase 2: 认证与用户系统 (3 周)

| 任务 | 详细内容 | 交付物 | 验收标准 |
|-----|---------|--------|---------|
| 2.1 数据库设计 | PostgreSQL Schema，Prisma 模型 | prisma/schema.prisma | 迁移成功 |
| 2.2 飞书 OAuth | 飞书应用配置，OAuth 流程实现 | /auth/feishu/* API | 可完成登录 |
| 2.3 JWT 服务 | Token 生成/验证/刷新/吊销 | AuthService | Token 流程完整 |
| 2.4 用户 CRUD | 用户创建、查询、更新、删除 | /users API | CRUD 功能正常 |
| 2.5 部门管理 | 部门层级、用户归属 | /departments API | 树形结构正确 |
| 2.6 角色权限 | 角色定义、权限分配、检查中间件 | RBAC 系统 | 权限控制生效 |

**依赖关系：** 2.1 → 2.2 → 2.3 → (2.4, 2.5, 2.6)

**风险：** 飞书 API 变更 → 封装适配层

### 17.3 Phase 3: 模型管理 (2 周)

| 任务 | 详细内容 | 交付物 | 验收标准 |
|-----|---------|--------|---------|
| 3.1 模型配置 | API Key 加密存储，模型元数据管理 | models 表，CryptoService | Key 安全存储 |
| 3.2 代理服务 | 请求路由，API 适配器，SSE 转发 | ModelProxyService | 各供应商调用成功 |
| 3.3 配额系统 | 用量记录，配额检查，预警通知 | QuotaService | 超限阻止请求 |
| 3.4 权限控制 | 模型访问权限按角色/部门控制 | model_permissions 表 | 无权限拒绝访问 |

**依赖关系：** 3.1 → 3.2 → (3.3, 3.4)

**风险：** 供应商 API 差异大 → 完善适配器测试

### 17.4 Phase 4: 知识库迁移 (3 周)

| 任务 | 详细内容 | 交付物 | 验收标准 |
|-----|---------|--------|---------|
| 4.1 pgvector 集成 | 表设计，向量索引管理 | RetrievalService | 向量操作成功 |
| 4.2 文件存储 | MinIO 配置，文件上传/下载 | FileStorageService | 文件 CRUD 正常 |
| 4.3 文档处理 | 解析器，分块策略，Embedding | DocumentProcessor | 文档索引成功 |
| 4.4 检索服务 | 混合检索，重排序，缓存 | RetrievalService | 检索结果准确 |
| 4.5 权限管理 | 知识库访问控制 | kb_permissions 表 | 权限隔离正确 |
| 4.6 异步队列 | Redis Queue，任务处理器 | EmbeddingQueue | 后台处理正常 |

**依赖关系：** (4.1, 4.2) → 4.3 → 4.4 → 4.5，4.6 与 4.3 并行

**风险：** 大文件处理性能 → 分片处理 + 进度反馈

### 17.5 Phase 5: 客户端改造 (2 周)

| 任务 | 详细内容 | 交付物 | 验收标准 |
|-----|---------|--------|---------|
| 5.1 认证模块 | 飞书登录页面，Token 管理 | LoginPage, AuthStore | 登录流程完整 |
| 5.2 模式切换 | 个人版/企业版模式检测与切换 | ModeService | 模式切换正常 |
| 5.3 API 对接 | 替换本地调用为服务端 API | EnterpriseApiService | API 调用成功 |
| 5.4 企业 UI | 用量面板，部门切换器 | EnterpriseComponents | UI 展示正确 |
| 5.5 离线支持 | 本地缓存，同步机制 | OfflineService | 离线可用 |

**依赖关系：** 5.1 → 5.2 → 5.3 → (5.4, 5.5)

**风险：** 破坏个人版功能 → 完整回归测试

### 17.6 Phase 6: 管理后台 (3 周)

| 任务 | 详细内容 | 交付物 | 验收标准 |
|-----|---------|--------|---------|
| 6.1 项目初始化 | Vite + React + Ant Design Pro | packages/admin | 项目启动成功 |
| 6.2 认证对接 | 登录页面，权限路由 | 登录功能 | 管理员可登录 |
| 6.3 用户管理页 | 用户列表，CRUD，批量操作 | /users 页面 | 功能完整 |
| 6.4 模型管理页 | 模型配置，权限分配 | /models 页面 | 功能完整 |
| 6.5 知识库管理 | 知识库列表，文档管理，权限 | /knowledge-bases 页面 | 功能完整 |
| 6.6 统计仪表盘 | 用量统计，成本分析，图表 | /dashboard 页面 | 数据准确 |

**依赖关系：** 6.1 → 6.2 → (6.3, 6.4, 6.5, 6.6)

**风险：** UI/UX 不佳 → 参考成熟后台设计

### 17.7 Phase 7: 备份与运维 (2 周)

| 任务 | 详细内容 | 交付物 | 验收标准 |
|-----|---------|--------|---------|
| 7.1 备份服务 | 定时备份，增量/全量策略 | BackupService | 备份成功 |
| 7.2 恢复流程 | 数据恢复，验证机制 | RestoreService | 恢复成功 |
| 7.3 日志系统 | 结构化日志，采集配置 | 日志管道 | 日志可查询 |
| 7.4 监控集成 | Prometheus 指标，Grafana 看板 | 监控面板 | 指标可视化 |
| 7.5 告警配置 | 告警规则，通知渠道 | 告警系统 | 告警送达 |

**依赖关系：** (7.1, 7.3) → (7.2, 7.4) → 7.5

**风险：** 监控盲区 → 全面 checklist 验收

### 17.8 Phase 8: 测试与文档 (2 周)

| 任务 | 详细内容 | 交付物 | 验收标准 |
|-----|---------|--------|---------|
| 8.1 单元测试 | 核心模块单元测试 | 测试代码 | 覆盖率 >= 80% |
| 8.2 集成测试 | API 端点集成测试 | 测试代码 | 全部通过 |
| 8.3 E2E 测试 | 关键流程 E2E 测试 | Playwright 测试 | 关键路径覆盖 |
| 8.4 部署文档 | 安装、配置、运维指南 | docs/enterprise/ | 可照文档部署 |
| 8.5 用户手册 | 管理员手册、用户手册 | docs/enterprise/ | 覆盖所有功能 |

**依赖关系：** (8.1, 8.2, 8.3) 并行，8.4 和 8.5 并行

**风险：** 文档不完整 → checklist 验收

### 17.9 Phase 9: 监控与告警完善 (1 周)

| 任务 | 详细内容 | 交付物 | 验收标准 |
|-----|---------|--------|---------|
| 9.1 Prometheus 指标 | HTTP 请求、Token 用量、成本统计指标 | metrics/ 模块 | /metrics 端点可访问 |
| 9.2 指标中间件 | 请求计数、延迟采集中间件 | metrics.middleware.ts | 指标自动采集 |
| 9.3 飞书告警服务 | 配额超限、系统错误、备份失败告警 | feishu-alert.service.ts | 告警发送成功 |
| 9.4 配额预警 | 80%/95%/100% 阈值通知 | quota-alert.service.ts | 预警发送成功 |

**依赖关系：** 9.1 → 9.2，9.3 → 9.4

**风险：** 告警过多 → 合理设置阈值和静默规则

### 17.10 Phase 10: 安全增强 (1 周)

| 任务 | 详细内容 | 交付物 | 验收标准 |
|-----|---------|--------|---------|
| 10.1 细粒度速率限制 | 登录、Chat、上传端点限制 | rate-limit.middleware.ts | 超限返回 429 |
| 10.2 审计日志 | 登录、CRUD 操作记录 | audit_logs 表 + API | 日志可查询 |
| 10.3 错误处理增强 | 添加 ForbiddenError | errorHandler.ts | 权限错误正确处理 |
| 10.4 代码清理 | 移除 MinIO 配置，更新 docker-compose | 清理后的代码 | 无 MinIO 依赖 |

**依赖关系：** (10.1, 10.2, 10.3) 并行，10.4 最后执行

**风险：** 速率限制影响正常使用 → 合理设置阈值

---

## 18. Web 管理后台详细设计

### 18.1 页面交互流程

```
登录流程:
┌───────────┐    ┌───────────┐    ┌───────────┐
│  登录页面  │───►│  飞书OAuth │───►│  权限检查  │
└───────────┘    └───────────┘    └─────┬─────┘
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 │                                              │
           ┌─────▼─────┐                                 ┌──────▼──────┐
           │  管理员    │                                 │  非管理员    │
           │  Dashboard │                                 │  拒绝访问    │
           └───────────┘                                 └─────────────┘

用户管理流程:
┌────────────┐    ┌────────────┐    ┌────────────┐
│  用户列表   │───►│  用户详情   │───►│  编辑用户   │
│            │    │            │    │            │
│ - 搜索/筛选 │    │ - 基本信息  │    │ - 角色分配  │
│ - 批量操作  │    │ - 权限概览  │    │ - 部门调整  │
│ - 导入导出  │    │ - 用量统计  │    │ - 配额设置  │
└────────────┘    └────────────┘    └────────────┘
```

### 18.2 状态管理

```typescript
// packages/admin/src/store/index.ts
import { create } from 'zustand';

// 全局状态结构
interface GlobalStore {
  // 认证状态
  auth: {
    user: AdminUser | null;
    token: string | null;
    permissions: string[];
    isAuthenticated: boolean;
  };

  // UI 状态
  ui: {
    sidebarCollapsed: boolean;
    theme: 'light' | 'dark';
    loading: boolean;
    breadcrumbs: Breadcrumb[];
  };

  // 数据缓存
  cache: {
    departments: Department[];
    roles: Role[];
    models: Model[];
    lastFetched: Record<string, number>;
  };
}

// 各模块独立 Store
interface UsersStore {
  users: User[];
  total: number;
  filters: UserFilters;
  selectedIds: string[];
  loading: boolean;

  // Actions
  fetchUsers: (params: FetchParams) => Promise<void>;
  createUser: (data: CreateUserDto) => Promise<void>;
  updateUser: (id: string, data: UpdateUserDto) => Promise<void>;
  deleteUsers: (ids: string[]) => Promise<void>;
  importUsers: (file: File) => Promise<ImportResult>;
  exportUsers: (filters: UserFilters) => Promise<Blob>;
}

interface ModelsStore {
  models: Model[];
  loading: boolean;

  // Actions
  fetchModels: () => Promise<void>;
  createModel: (data: CreateModelDto) => Promise<void>;
  updateModel: (id: string, data: UpdateModelDto) => Promise<void>;
  deleteModel: (id: string) => Promise<void>;
  testConnection: (id: string) => Promise<TestResult>;
}
```

### 18.3 API 对接

```typescript
// packages/admin/src/api/client.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 30000,
});

// 请求拦截器
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token 过期，尝试刷新
      const refreshed = await refreshToken();
      if (refreshed) {
        return apiClient.request(error.config);
      }
      // 刷新失败，登出
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

// API 模块
export const usersApi = {
  list: (params: ListParams) =>
    apiClient.get<PaginatedResponse<User>>('/users', { params }),
  get: (id: string) =>
    apiClient.get<User>(`/users/${id}`),
  create: (data: CreateUserDto) =>
    apiClient.post<User>('/users', data),
  update: (id: string, data: UpdateUserDto) =>
    apiClient.patch<User>(`/users/${id}`, data),
  delete: (id: string) =>
    apiClient.delete(`/users/${id}`),
  batchDelete: (ids: string[]) =>
    apiClient.post('/users/batch-delete', { ids }),
  import: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post<ImportResult>('/users/import', formData);
  },
  export: (filters: UserFilters) =>
    apiClient.get('/users/export', { params: filters, responseType: 'blob' }),
};

export const modelsApi = {
  list: () => apiClient.get<Model[]>('/admin/models'),
  create: (data: CreateModelDto) => apiClient.post<Model>('/admin/models', data),
  update: (id: string, data: UpdateModelDto) => apiClient.patch<Model>(`/admin/models/${id}`, data),
  delete: (id: string) => apiClient.delete(`/admin/models/${id}`),
  testConnection: (id: string) => apiClient.post<TestResult>(`/admin/models/${id}/test`),
  updatePermissions: (id: string, permissions: ModelPermission[]) =>
    apiClient.put(`/admin/models/${id}/permissions`, { permissions }),
};

export const statisticsApi = {
  overview: (range: DateRange) =>
    apiClient.get<OverviewStats>('/statistics/overview', { params: range }),
  userActivity: (range: DateRange) =>
    apiClient.get<UserActivityStats>('/statistics/user-activity', { params: range }),
  modelUsage: (range: DateRange) =>
    apiClient.get<ModelUsageStats>('/statistics/model-usage', { params: range }),
  costAnalysis: (range: DateRange) =>
    apiClient.get<CostAnalysisStats>('/statistics/cost-analysis', { params: range }),
};
```

### 18.4 组件设计

```typescript
// 通用表格组件
interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  loading: boolean;
  pagination: PaginationConfig;
  selection?: {
    selectedIds: string[];
    onSelect: (ids: string[]) => void;
  };
  actions?: {
    label: string;
    onClick: (selectedIds: string[]) => void;
    danger?: boolean;
  }[];
}

// 权限控制组件
interface PermissionGuardProps {
  permission: string | string[];
  fallback?: ReactNode;
  children: ReactNode;
}

function PermissionGuard({ permission, fallback, children }: PermissionGuardProps) {
  const permissions = useAuthStore((s) => s.auth.permissions);
  const required = Array.isArray(permission) ? permission : [permission];
  const hasPermission = required.some((p) => permissions.includes(p));

  if (!hasPermission) {
    return fallback ?? null;
  }
  return <>{children}</>;
}

// 使用示例
<PermissionGuard permission="users:delete">
  <Button danger onClick={handleDelete}>删除</Button>
</PermissionGuard>
```

---

## 附录 A: 术语表

| 术语 | 说明 |
|-----|------|
| RTO | Recovery Time Objective，恢复时间目标 |
| RPO | Recovery Point Objective，数据恢复点目标 |
| SSE | Server-Sent Events，服务器推送事件 |
| mTLS | Mutual TLS，双向 TLS 认证 |
| RBAC | Role-Based Access Control，基于角色的访问控制 |

## 附录 B: 参考资料

- [飞书开放平台文档](https://open.feishu.cn/)
- [Milvus 官方文档](https://milvus.io/docs)
- [Ant Design Pro 文档](https://pro.ant.design/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

---

## 19. 实施状态与待办事项

### 19.1 已完成模块

| 模块 | 完成度 | 说明 |
|------|--------|------|
| packages/server | 94% | 后端 API 服务，缺少部分运维和安全功能 |
| packages/admin | 100% | Web 管理后台 10 个页面全部完成 |
| packages/enterprise-shared | 100% | 共享类型、Schema、工具函数 |
| docker/ | 95% | 需要清理 MinIO，升级 PG 版本 |
| 客户端企业集成 | 100% | 飞书登录、设置面板、API 集成 |
| 文档 | 100% | 部署指南、API 参考 |

### 19.2 已完成功能详情

#### 后端服务 (packages/server)
- ✅ 认证系统 (飞书 OAuth, JWT, Token 刷新)
- ✅ 用户/部门/角色管理 API
- ✅ 模型代理与配额检查
- ✅ 知识库管理与向量检索 (pgvector)
- ✅ 对话历史管理
- ✅ 统计分析 API
- ✅ 备份恢复 (阿里云 OSS)
- ✅ 阿里云 OSS 存储服务
- ✅ 基础速率限制

#### Web 管理后台 (packages/admin)
- ✅ 仪表盘 (Dashboard)
- ✅ 用户管理页面
- ✅ 部门管理页面 (树形结构)
- ✅ 角色权限管理页面
- ✅ 模型管理页面 (7种供应商)
- ✅ 知识库管理页面 (含文档上传)
- ✅ 统计分析页面 (多维可视化)
- ✅ 备份管理页面
- ✅ 系统设置页面 (5个配置模块)
- ✅ 登录页面 (飞书 OAuth)

#### 客户端企业集成
- ✅ 飞书登录页面 (FeishuLogin.tsx)
- ✅ 企业设置面板 (EnterprisePanel.tsx)
- ✅ 企业版 API 客户端 (EnterpriseApi.ts)
- ✅ 企业版状态管理 (enterprise.ts)
- ✅ 认证 Hooks (useEnterpriseAuth.ts)

### 19.3 待实现功能

#### 代码清理 (必须完成)
- [ ] 删除 MinIO 配置 (`packages/server/src/config/index.ts` 第45-53行)
- [ ] 移除 minio 类型 (`packages/server/src/services/storage/storage.interface.ts`)
- [ ] 更新 docker-compose.yml (移除 MinIO 依赖，升级 postgres:17-alpine)

#### P0 优先级 (核心运维)

1. **飞书告警服务**
   - 文件: `packages/server/src/services/feishu-alert.service.ts`
   - 功能: 配额超限通知、系统错误告警、备份失败告警
   - 对接: 飞书群机器人 Webhook
   - 配置项: `FEISHU_ALERT_WEBHOOK`, `FEISHU_ALERT_ENABLED`

2. **Prometheus 指标采集**
   - 目录: `packages/server/src/metrics/`
   - 文件: `index.ts`, `http.metrics.ts`, `model.metrics.ts`
   - 中间件: `packages/server/src/middleware/metrics.middleware.ts`
   - 端点: `GET /metrics`
   - 指标:
     - `cherry_http_requests_total` - HTTP 请求计数
     - `cherry_http_request_duration_seconds` - 请求延迟
     - `cherry_model_tokens_total` - Token 用量
     - `cherry_model_cost_usd_total` - 调用成本
     - `cherry_active_users` - 活跃用户数

3. **细粒度速率限制**
   - 文件: `packages/server/src/middleware/rate-limit.middleware.ts`
   - 端点限制:
     - 登录: 5次/5分钟
     - Chat: 30次/分钟/用户
     - 上传: 100次/小时/用户
   - 应用到: auth.ts, models.ts, knowledge-bases.ts

#### P1 优先级 (功能增强)

4. **配额预警通知**
   - 文件: `packages/server/src/services/quota-alert.service.ts`
   - 阈值: 80%/95%/100%
   - 通知渠道: 飞书消息
   - 集成点: `routes/models.ts` 的 chat 接口

5. **审计日志系统**
   - 数据表: `audit_logs`
   - 字段: userId, action, resource, resourceId, details, ipAddress, userAgent, createdAt
   - 接口: `GET /admin/audit-logs`
   - 记录: 登录、登出、CRUD 操作

6. **错误处理增强**
   - 添加: `ForbiddenError` 到 errorHandler.ts
   - 用于: 权限拒绝场景

7. **知识库检索增强**
   - 位置: `routes/knowledge-bases.ts` 第 229 行 TODO
   - 功能: 多知识库联合检索
   - 可选: 集成百炼重排序 API

#### P2 优先级 (可选增强)

8. **LiteLLM 代理集成**
   - 当前: 简化版直接调用模型 API
   - 目标: 通过 LiteLLM 中间件统一代理
   - 优势: 多供应商适配、负载均衡、故障转移

### 19.4 版本更新

| 组件 | 原版本 | 新版本 | 说明 |
|------|--------|--------|------|
| PostgreSQL | 16 | 17 | 性能提升，pgvector 0.7.0+ 完全兼容 |
| Redis | 7 | 7 | 保持不变 |
| 文件存储 | MinIO | 阿里云 OSS | 统一存储方案 |

### 19.5 本地开发环境配置

```bash
# 1. 安装依赖 (macOS)
brew install postgresql@17 redis pgvector
brew services start postgresql@17
brew services start redis

# 2. 创建数据库
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
createdb cherry_enterprise
psql -d cherry_enterprise -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 3. 配置环境变量
cd packages/server
cp .env.example .env
# 编辑 .env 填入 OSS、飞书等配置

# 4. 运行数据库迁移
pnpm drizzle-kit push

# 5. 启动服务
cd packages/server && pnpm dev   # 后端 :3000
cd packages/admin && pnpm dev    # 前端 :3001
```

### 19.6 新增依赖

```bash
cd packages/server
pnpm add prom-client  # Prometheus 指标采集
```

### 19.7 新增文件清单

| 文件路径 | 说明 | 对应设计章节 |
|----------|------|--------------|
| `packages/server/src/services/feishu-alert.service.ts` | 飞书告警服务 | 15.8-15.10 |
| `packages/server/src/services/quota-alert.service.ts` | 配额预警服务 | 11.3, 11.6 |
| `packages/server/src/metrics/index.ts` | Prometheus 指标定义 | 15.6-15.7 |
| `packages/server/src/middleware/metrics.middleware.ts` | 指标采集中间件 | 15.6 |
| `packages/server/src/middleware/rate-limit.middleware.ts` | 速率限制中间件 | 10.3 |
| `packages/server/src/routes/metrics.ts` | 指标端点 | 15.6 |

### 19.8 修改文件清单

| 文件路径 | 修改内容 |
|----------|----------|
| `packages/server/src/config/index.ts` | 删除 MinIO 配置，添加飞书告警配置 |
| `packages/server/src/services/storage/storage.interface.ts` | 移除 minio 类型 |
| `packages/server/src/services/storage/index.ts` | 删除 MinIO 注释代码 |
| `packages/server/src/middleware/errorHandler.ts` | 添加 ForbiddenError |
| `packages/server/src/index.ts` | 添加 metrics 中间件和路由 |
| `packages/server/src/routes/auth.ts` | 添加登录速率限制 |
| `packages/server/src/routes/models.ts` | 添加聊天速率限制，配额预警 |
| `packages/server/src/routes/knowledge-bases.ts` | 添加上传限制，检索增强 |
| `packages/server/src/routes/admin.ts` | 添加审计日志接口 |
| `packages/server/src/models/schema.ts` | 添加 audit_logs 表 |
| `docker/docker-compose.yml` | 更新 PG 版本，移除 MinIO |

### 19.9 验证清单

**已完成功能验证：**
- [ ] 飞书 OAuth 登录流程
- [ ] 用户/部门/角色 CRUD
- [ ] 模型代理调用
- [ ] 知识库上传和检索
- [ ] 权限控制生效
- [ ] 用量统计准确
- [ ] 备份/恢复流程
- [ ] 客户端与服务端通信

**待实现功能验证：**
- [ ] OSS 存储正常工作（替换 MinIO 后）
- [ ] 飞书告警发送成功
- [ ] Prometheus 指标暴露 (/metrics)
- [ ] 配额预警通知发送
- [ ] 速率限制生效
- [ ] 审计日志记录和查询
