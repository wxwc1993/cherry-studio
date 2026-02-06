# Cherry Studio 企业版部署指南

## 系统要求

### 硬件要求

| 组件 | 最低配置 | 推荐配置 |
|-----|---------|---------|
| CPU | 4 核 | 8 核+ |
| 内存 | 8GB | 16GB+ |
| 存储 | 50GB SSD | 200GB+ SSD |

### 软件要求

- Docker 20.10+
- Docker Compose 2.0+
- 域名和 SSL 证书（生产环境）

## 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/your-org/cherry-studio.git
cd cherry-studio
```

### 2. 配置环境变量

```bash
cd docker
cp .env.example .env
```

编辑 `.env` 文件，设置以下必要变量：

```bash
# JWT 密钥（必须修改！使用 openssl rand -base64 32 生成）
JWT_SECRET=your-secure-jwt-secret
JWT_REFRESH_SECRET=your-secure-refresh-secret

# 飞书 OAuth 配置
FEISHU_APP_ID=your-feishu-app-id
FEISHU_APP_SECRET=your-feishu-app-secret

# MinIO 存储配置
MINIO_ACCESS_KEY=your-minio-access-key
MINIO_SECRET_KEY=your-minio-secret-key
```

### 3. 启动服务

```bash
docker-compose up -d
```

### 4. 验证部署

```bash
# 检查服务状态
docker-compose ps

# 检查 API 健康状态
curl http://localhost:3000/health
```

## 服务说明

| 服务 | 端口 | 说明 |
|-----|------|-----|
| api | 3000 | 后端 API 服务 |
| admin | 3001 | Web 管理后台 |
| postgres | 5432 | PostgreSQL 数据库 |
| redis | 6379 | Redis 缓存 |
| minio | 9000/9001 | MinIO 对象存储 |
| milvus | 19530 | Milvus 向量数据库 |

## 配置飞书应用

### 1. 创建飞书应用

1. 登录 [飞书开放平台](https://open.feishu.cn/)
2. 创建企业自建应用
3. 获取 App ID 和 App Secret

### 2. 配置权限

在应用权限管理中添加以下权限：

- `contact:user.employee_id:readonly` - 获取用户 ID
- `contact:user.base:readonly` - 获取用户基本信息
- `contact:user.email:readonly` - 获取用户邮箱

### 3. 配置回调地址

在安全设置中添加重定向 URL：

```
https://your-domain.com/api/v1/auth/feishu/callback
```

## 数据库迁移

首次部署时，需要运行数据库迁移：

```bash
docker-compose exec api pnpm drizzle-kit push
```

## 备份与恢复

### 创建备份

```bash
# 进入容器
docker-compose exec api bash

# 运行备份脚本
./scripts/backup.sh full
```

### 恢复备份

```bash
# 进入容器
docker-compose exec api bash

# 运行恢复脚本
./scripts/restore.sh backup_full_20240101_120000.tar.gz
```

### 自动备份

通过 crontab 配置自动备份：

```bash
# 每日 02:00 增量备份
0 2 * * * docker-compose exec -T api ./scripts/backup.sh incremental

# 每周日 03:00 全量备份
0 3 * * 0 docker-compose exec -T api ./scripts/backup.sh full
```

## 生产环境配置

### 使用 Nginx 反向代理

```nginx
server {
    listen 443 ssl http2;
    server_name api.your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl http2;
    server_name admin.your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 数据持久化

确保以下 volumes 挂载到可靠存储：

- `postgres-data` - 数据库数据
- `redis-data` - Redis 数据
- `minio-data` - 文件存储
- `milvus-data` - 向量数据库

## 监控与日志

### 查看日志

```bash
# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f api

# 查看最近 100 行
docker-compose logs --tail=100 api
```

### 健康检查

API 提供健康检查端点：

```bash
curl http://localhost:3000/health
```

## 故障排除

### 服务无法启动

1. 检查端口是否被占用
2. 检查环境变量是否正确配置
3. 查看服务日志

```bash
docker-compose logs api
```

### 数据库连接失败

1. 确认 PostgreSQL 容器运行正常
2. 检查数据库凭据

```bash
docker-compose exec postgres psql -U cherry -d cherry_studio
```

### 飞书登录失败

1. 确认 App ID 和 App Secret 正确
2. 检查回调地址配置
3. 确认应用权限已开通

## 升级指南

### 备份数据

```bash
./scripts/backup.sh full
```

### 拉取最新镜像

```bash
docker-compose pull
```

### 重启服务

```bash
docker-compose up -d
```

### 运行迁移

```bash
docker-compose exec api pnpm drizzle-kit push
```
