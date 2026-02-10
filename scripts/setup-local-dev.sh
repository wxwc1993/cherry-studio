#!/bin/bash

# Cherry Studio 企业版本地开发环境配置脚本
# 用于配置 PostgreSQL + pgvector 和 Redis

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查命令是否存在
check_command() {
    if command -v "$1" &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# 检查操作系统
check_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
    else
        log_error "Unsupported operating system: $OSTYPE"
        exit 1
    fi
    log_info "Detected OS: $OS"
}

# 检查 Homebrew (macOS)
check_homebrew() {
    if [[ "$OS" == "macos" ]]; then
        if ! check_command brew; then
            log_error "Homebrew is not installed. Please install it first:"
            echo "  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
            exit 1
        fi
        log_info "Homebrew is installed"
    fi
}

# 安装 PostgreSQL
install_postgresql() {
    log_info "Checking PostgreSQL..."

    if check_command psql; then
        PG_VERSION=$(psql --version | head -1)
        log_info "PostgreSQL is already installed: $PG_VERSION"
    else
        log_info "Installing PostgreSQL..."
        if [[ "$OS" == "macos" ]]; then
            brew install postgresql@16
            brew link postgresql@16 --force
        else
            sudo apt-get update
            sudo apt-get install -y postgresql-16 postgresql-contrib-16
        fi
    fi
}

# 启动 PostgreSQL
start_postgresql() {
    log_info "Starting PostgreSQL..."
    if [[ "$OS" == "macos" ]]; then
        brew services start postgresql@16 || true
    else
        sudo systemctl start postgresql
    fi

    # 等待服务启动
    sleep 2

    # 检查服务状态
    if pg_isready -q; then
        log_info "PostgreSQL is running"
    else
        log_error "PostgreSQL failed to start"
        exit 1
    fi
}

# 安装 pgvector 扩展
install_pgvector() {
    log_info "Checking pgvector extension..."

    if [[ "$OS" == "macos" ]]; then
        # 检查是否已安装
        if brew list pgvector &>/dev/null; then
            log_info "pgvector is already installed via Homebrew"
        else
            log_info "Installing pgvector..."
            brew install pgvector
        fi
    else
        # Linux - 从源码编译
        if ! psql -d postgres -c "SELECT * FROM pg_available_extensions WHERE name = 'vector';" | grep -q vector; then
            log_info "Installing pgvector from source..."
            cd /tmp
            git clone --branch v0.6.0 https://github.com/pgvector/pgvector.git
            cd pgvector
            make
            sudo make install
            cd ..
            rm -rf pgvector
        fi
    fi
}

# 创建数据库
create_database() {
    DB_NAME="${1:-cherry_enterprise}"
    log_info "Creating database: $DB_NAME"

    # 检查数据库是否已存在
    if psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
        log_info "Database $DB_NAME already exists"
    else
        createdb "$DB_NAME"
        log_info "Database $DB_NAME created"
    fi

    # 启用 pgvector 扩展
    log_info "Enabling pgvector extension..."
    psql "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null || true

    # 验证扩展
    if psql "$DB_NAME" -c "SELECT '[1,2,3]'::vector;" &>/dev/null; then
        log_info "pgvector extension is working"
    else
        log_error "pgvector extension failed to load"
        exit 1
    fi
}

# 安装 Redis
install_redis() {
    log_info "Checking Redis..."

    if check_command redis-cli; then
        REDIS_VERSION=$(redis-cli --version | head -1)
        log_info "Redis is already installed: $REDIS_VERSION"
    else
        log_info "Installing Redis..."
        if [[ "$OS" == "macos" ]]; then
            brew install redis
        else
            sudo apt-get install -y redis-server
        fi
    fi
}

# 启动 Redis
start_redis() {
    log_info "Starting Redis..."
    if [[ "$OS" == "macos" ]]; then
        brew services start redis || true
    else
        sudo systemctl start redis
    fi

    # 等待服务启动
    sleep 2

    # 检查服务状态
    if redis-cli ping | grep -q PONG; then
        log_info "Redis is running"
    else
        log_error "Redis failed to start"
        exit 1
    fi
}

# 创建 .env.local 模板
create_env_template() {
    ENV_FILE="packages/server/.env.local"

    if [[ -f "$ENV_FILE" ]]; then
        log_warn ".env.local already exists, skipping..."
        return
    fi

    log_info "Creating .env.local template..."

    cat > "$ENV_FILE" << 'EOF'
# 数据库
DATABASE_URL=postgresql://localhost:5432/cherry_enterprise

# Redis
REDIS_URL=redis://localhost:6379

# 阿里云 OSS
OSS_REGION=oss-cn-hangzhou
OSS_ACCESS_KEY_ID=your-access-key-id
OSS_ACCESS_KEY_SECRET=your-access-key-secret
OSS_BUCKET=cherry-studio-dev

# 存储类型
STORAGE_TYPE=aliyun-oss

# 加密密钥（至少 16 个字符）
ENCRYPTION_KEY=your-32-char-encryption-key-here

# 飞书 OAuth
FEISHU_APP_ID=your-feishu-app-id
FEISHU_APP_SECRET=your-feishu-app-secret
FEISHU_REDIRECT_URI=http://localhost:3000/api/v1/auth/feishu/callback

# JWT 配置
JWT_SECRET=your-jwt-secret-key-here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# OpenAI (用于 Embedding)
OPENAI_API_KEY=sk-your-openai-api-key

# 服务端口
PORT=3000

# 日志级别
LOG_LEVEL=debug

# 备份临时目录
BACKUP_TEMP_DIR=/tmp/cherry-studio-backups
EOF

    log_info "Created $ENV_FILE - please update with your actual values"
}

# 验证环境
verify_environment() {
    log_info "Verifying environment..."

    echo ""
    echo "=== Environment Verification ==="
    echo ""

    # PostgreSQL
    echo -n "PostgreSQL: "
    if pg_isready -q; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}FAILED${NC}"
    fi

    # pgvector
    echo -n "pgvector:   "
    if psql cherry_enterprise -c "SELECT '[1,2,3]'::vector;" &>/dev/null; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}FAILED${NC}"
    fi

    # Redis
    echo -n "Redis:      "
    if redis-cli ping | grep -q PONG; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}FAILED${NC}"
    fi

    echo ""
    echo "=== Next Steps ==="
    echo ""
    echo "1. Update packages/server/.env.local with your actual values"
    echo "2. Run database migrations:"
    echo "   cd packages/server && pnpm db:migrate"
    echo "3. Start the server:"
    echo "   cd packages/server && pnpm dev"
    echo "4. Start the admin dashboard:"
    echo "   cd packages/admin && pnpm dev"
    echo ""
}

# 主函数
main() {
    echo ""
    echo "========================================"
    echo "Cherry Studio Enterprise - Local Setup"
    echo "========================================"
    echo ""

    # 检查操作系统
    check_os

    # macOS 需要 Homebrew
    if [[ "$OS" == "macos" ]]; then
        check_homebrew
    fi

    # 安装和配置 PostgreSQL
    install_postgresql
    start_postgresql
    install_pgvector
    create_database "cherry_enterprise"

    # 安装和配置 Redis
    install_redis
    start_redis

    # 创建环境配置模板
    create_env_template

    # 验证环境
    verify_environment

    log_info "Setup completed successfully!"
}

# 运行主函数
main "$@"
