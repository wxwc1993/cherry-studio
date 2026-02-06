#!/bin/bash

# Cherry Studio Enterprise Restore Script
# Usage: ./restore.sh <backup_file.tar.gz>

set -e

BACKUP_FILE=$1
BACKUP_DIR="/backups"
TEMP_DIR="/tmp/cherry_restore_$$"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file.tar.gz>"
    echo "Available backups:"
    ls -la ${BACKUP_DIR}/*.tar.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

if [ ! -f "${BACKUP_DIR}/${BACKUP_FILE}" ]; then
    echo "Error: Backup file not found: ${BACKUP_DIR}/${BACKUP_FILE}"
    exit 1
fi

echo "WARNING: This will overwrite all current data!"
echo "Restoring from: ${BACKUP_FILE}"
read -p "Are you sure? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled"
    exit 0
fi

# Create temp directory
mkdir -p ${TEMP_DIR}

# Extract backup
echo "Extracting backup..."
tar -xzf ${BACKUP_DIR}/${BACKUP_FILE} -C ${TEMP_DIR}
BACKUP_NAME=$(ls ${TEMP_DIR})

# Restore PostgreSQL
echo "Restoring PostgreSQL..."
if [ -f "${TEMP_DIR}/${BACKUP_NAME}/postgres.dump" ]; then
    PGPASSWORD="${POSTGRES_PASSWORD:-cherry_password}" pg_restore \
        -h postgres \
        -U "${POSTGRES_USER:-cherry}" \
        -d "${POSTGRES_DB:-cherry_studio}" \
        -c \
        ${TEMP_DIR}/${BACKUP_NAME}/postgres.dump || echo "PostgreSQL restore completed with warnings"
else
    echo "No PostgreSQL backup found, skipping"
fi

# Restore Redis
echo "Restoring Redis..."
if [ -f "${TEMP_DIR}/${BACKUP_NAME}/redis.rdb" ]; then
    redis-cli -h redis SHUTDOWN NOSAVE || true
    cp ${TEMP_DIR}/${BACKUP_NAME}/redis.rdb /redis-data/dump.rdb
    echo "Redis data restored, restart Redis container to apply"
else
    echo "No Redis backup found, skipping"
fi

# Restore MinIO
echo "Restoring MinIO..."
if [ -d "${TEMP_DIR}/${BACKUP_NAME}/minio" ] && command -v mc &> /dev/null; then
    mc alias set local http://minio:9000 ${MINIO_ACCESS_KEY:-minioadmin} ${MINIO_SECRET_KEY:-minioadmin}
    mc mirror ${TEMP_DIR}/${BACKUP_NAME}/minio/ local/cherry-studio/
else
    echo "No MinIO backup found or mc not available, skipping"
fi

# Cleanup
rm -rf ${TEMP_DIR}

echo "Restore completed successfully!"
echo "Please restart the API service to apply changes: docker-compose restart api"
