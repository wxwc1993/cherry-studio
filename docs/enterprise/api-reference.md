# Cherry Studio 企业版 API 参考

## 基础信息

- 基础路径: `/api/v1`
- 认证方式: Bearer Token (JWT)
- 内容类型: `application/json`

## 认证

### 飞书登录

**POST** `/auth/feishu/login`

使用飞书 OAuth code 换取访问令牌。

请求体:
```json
{
  "code": "string"
}
```

响应:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "string",
      "email": "string",
      "role": { "id": "uuid", "name": "string", "permissions": {} },
      "department": { "id": "uuid", "name": "string" }
    },
    "accessToken": "string",
    "refreshToken": "string"
  }
}
```

### 刷新令牌

**POST** `/auth/refresh`

请求体:
```json
{
  "refreshToken": "string"
}
```

### 登出

**POST** `/auth/logout`

需要认证。

### 获取当前用户

**GET** `/auth/me`

需要认证。

---

## 用户管理

### 获取用户列表

**GET** `/users`

查询参数:
- `page`: 页码 (默认 1)
- `pageSize`: 每页数量 (默认 20)
- `departmentId`: 按部门过滤

需要权限: `users:read`

### 创建用户

**POST** `/users`

请求体:
```json
{
  "email": "string",
  "name": "string",
  "departmentId": "uuid",
  "roleId": "uuid",
  "feishuUserId": "string (可选)"
}
```

需要权限: `users:write`

### 更新用户

**PATCH** `/users/:id`

请求体:
```json
{
  "name": "string (可选)",
  "departmentId": "uuid (可选)",
  "roleId": "uuid (可选)",
  "status": "active | inactive | suspended (可选)"
}
```

需要权限: `users:write`

### 删除用户

**DELETE** `/users/:id`

需要权限: `users:admin`

---

## 部门管理

### 获取部门树

**GET** `/departments/tree`

返回嵌套的部门树结构。

### 创建部门

**POST** `/departments`

请求体:
```json
{
  "name": "string",
  "parentId": "uuid (可选)",
  "order": 0
}
```

需要权限: `users:admin`

### 更新部门

**PATCH** `/departments/:id`

### 删除部门

**DELETE** `/departments/:id`

需要权限: `users:admin`

---

## 角色管理

### 获取角色列表

**GET** `/roles`

需要权限: `users:read`

### 创建角色

**POST** `/roles`

请求体:
```json
{
  "name": "string",
  "description": "string (可选)",
  "permissions": {
    "models": ["read", "use"],
    "knowledgeBases": ["read", "write", "admin"],
    "users": ["read", "write", "admin"],
    "statistics": ["read", "export"],
    "system": ["backup", "restore", "settings"]
  }
}
```

需要权限: `users:admin`

### 更新角色

**PATCH** `/roles/:id`

系统角色不可修改。

### 删除角色

**DELETE** `/roles/:id`

系统角色不可删除。

---

## 模型管理

### 获取可用模型

**GET** `/models`

返回当前用户有权限使用的模型列表。

### 对话 API

**POST** `/models/:id/chat`

请求体:
```json
{
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "stream": true,
  "knowledgeBaseIds": ["uuid (可选)"],
  "config": {
    "maxTokens": 4096,
    "temperature": 0.7
  }
}
```

流式响应: SSE 格式

### 获取模型用量

**GET** `/models/:id/usage`

需要权限: `models:read`

---

## 知识库

### 获取知识库列表

**GET** `/knowledge-bases`

### 创建知识库

**POST** `/knowledge-bases`

请求体:
```json
{
  "name": "string",
  "description": "string (可选)",
  "visibility": "private | department | company",
  "config": {
    "embeddingModel": "text-embedding-ada-002",
    "chunkSize": 1000,
    "chunkOverlap": 200
  }
}
```

需要权限: `knowledgeBases:write`

### 上传文档

**POST** `/knowledge-bases/:id/documents`

Content-Type: `multipart/form-data`

支持格式: PDF, DOCX, TXT, MD

### 搜索知识库

**POST** `/knowledge-bases/:id/search`

请求体:
```json
{
  "query": "string",
  "topK": 10,
  "scoreThreshold": 0.7
}
```

### 更新权限

**PATCH** `/knowledge-bases/:id/permissions`

请求体:
```json
{
  "targetType": "department | role | user",
  "targetId": "uuid",
  "level": "viewer | editor | admin"
}
```

需要权限: `knowledgeBases:admin`

---

## 对话历史

### 获取对话列表

**GET** `/conversations`

查询参数:
- `page`: 页码
- `pageSize`: 每页数量

### 获取对话详情

**GET** `/conversations/:id`

包含消息列表。

### 创建对话

**POST** `/conversations`

请求体:
```json
{
  "title": "string",
  "modelId": "uuid"
}
```

### 删除对话

**DELETE** `/conversations/:id`

---

## 统计分析

### 概览统计

**GET** `/statistics/overview`

需要权限: `statistics:read`

### 用量统计

**GET** `/statistics/usage`

查询参数:
- `startDate`: 开始日期 (YYYY-MM-DD)
- `endDate`: 结束日期
- `groupBy`: day | week | month
- `modelId`: 按模型过滤
- `departmentId`: 按部门过滤

### 导出统计

**GET** `/statistics/export`

返回 CSV 文件。

需要权限: `statistics:export`

---

## 系统管理

### 健康检查

**GET** `/admin/health`

### 获取备份列表

**GET** `/admin/backups`

需要权限: `system:backup`

### 创建备份

**POST** `/admin/backup`

请求体:
```json
{
  "type": "full | incremental",
  "includeConversations": true,
  "includeKnowledgeBases": true
}
```

需要权限: `system:backup`

### 恢复备份

**POST** `/admin/restore`

请求体:
```json
{
  "backupId": "uuid",
  "restoreConversations": true,
  "restoreKnowledgeBases": true
}
```

需要权限: `system:restore`

### 获取系统设置

**GET** `/admin/settings`

需要权限: `system:settings`

### 更新系统设置

**PATCH** `/admin/settings`

需要权限: `system:settings`

---

## 错误响应

所有错误响应格式:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

常见错误码:

| 错误码 | HTTP 状态 | 说明 |
|-------|----------|-----|
| UNAUTHORIZED | 401 | 未认证 |
| TOKEN_EXPIRED | 401 | Token 过期 |
| FORBIDDEN | 403 | 无权限 |
| NOT_FOUND | 404 | 资源不存在 |
| VALIDATION_ERROR | 400 | 请求参数错误 |
| QUOTA_EXCEEDED | 429 | 配额超限 |
| INTERNAL_ERROR | 500 | 服务器错误 |
