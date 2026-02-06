#!/bin/bash

# Cherry Studio Enterprise Backup Script
# Usage: ./backup.sh [full|incremental]

set -e

BACKUP_TYPE=${1:-full}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
BACKUP_NAME="cherry_studio_${BACKUP_TYPE}_${TIMESTAMP}"

echo "Starting ${BACKUP_TYPE} backup: ${BACKUP_NAME}"

# Create backup directory if not exists
mkdir -p ${BACKUP_DIR}/${BACKUP_NAME}

# Backup PostgreSQL
echo "Backing up PostgreSQL..."
PGPASSWORD="${POSTGRES_PASSWORD:-cherry_password}" pg_dump \
    -h postgres \
    -U "${POSTGRES_USER:-cherry}" \
    -d "${POSTGRES_DB:-cherry_studio}" \
    -F c \
    -f ${BACKUP_DIR}/${BACKUP_NAME}/postgres.dump

# Backup Redis (RDB snapshot)
echo "Backing up Redis..."
redis-cli -h redis BGSAVE
sleep 2
cp /redis-data/dump.rdb ${BACKUP_DIR}/${BACKUP_NAME}/redis.rdb 2>/dev/null || echo "Redis backup skipped (no RDB file)"

# Backup MinIO data
echo "Backing up MinIO..."
if command -v mc &> /dev/null; then
    mc alias set local http://minio:9000 ${MINIO_ACCESS_KEY:-minioadmin} ${MINIO_SECRET_KEY:-minioadmin}
    mc mirror local/cherry-studio ${BACKUP_DIR}/${BACKUP_NAME}/minio/
else
    echo "MinIO client not available, skipping MinIO backup"
fi

# Create archive
echo "Creating archive..."
cd ${BACKUP_DIR}
tar -czf ${BACKUP_NAME}.tar.gz ${BACKUP_NAME}
rm -rf ${BACKUP_NAME}

# Calculate size
BACKUP_SIZE=$(du -h ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz | cut -f1)
echo "Backup completed: ${BACKUP_NAME}.tar.gz (${BACKUP_SIZE})"

# Cleanup old backups based on retention policy
if [ "$BACKUP_TYPE" = "incremental" ]; then
    # Keep last 7 days of incremental backups
    find ${BACKUP_DIR} -name "*_incremental_*.tar.gz" -mtime +7 -delete
    echo "Cleaned up incremental backups older than 7 days"
elif [ "$BACKUP_TYPE" = "full" ]; then
    # Keep last 4 weeks of full backups
    find ${BACKUP_DIR} -name "*_full_*.tar.gz" -mtime +28 -delete
    echo "Cleaned up full backups older than 28 days"
fi

echo "Backup process completed successfully"
