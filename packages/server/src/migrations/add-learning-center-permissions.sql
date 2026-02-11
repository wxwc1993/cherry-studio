-- 学习中心权限迁移
-- 为已有的系统角色补充 learningCenter 权限字段
-- M4: 包裹在事务中 + 限制 is_system 条件

BEGIN;

-- 为 super_admin / admin 角色补充 learningCenter 完整权限
UPDATE roles
SET permissions = jsonb_set(
  permissions,
  '{learningCenter}',
  '["read", "write", "admin"]'::jsonb
)
WHERE permissions->>'learningCenter' IS NULL
  AND is_system = true
  AND name IN ('super_admin', 'admin');

-- 为 manager 角色补充 learningCenter 只读权限
UPDATE roles
SET permissions = jsonb_set(
  permissions,
  '{learningCenter}',
  '["read"]'::jsonb
)
WHERE permissions->>'learningCenter' IS NULL
  AND is_system = true
  AND name = 'manager';

-- 为 user 角色补充 learningCenter 只读权限
UPDATE roles
SET permissions = jsonb_set(
  permissions,
  '{learningCenter}',
  '["read"]'::jsonb
)
WHERE permissions->>'learningCenter' IS NULL
  AND is_system = true
  AND name = 'user';

-- 同时补齐可能缺失的 assistantPresets（遗留问题）
UPDATE roles
SET permissions = jsonb_set(
  permissions,
  '{assistantPresets}',
  '["read", "write", "admin"]'::jsonb
)
WHERE permissions->>'assistantPresets' IS NULL
  AND is_system = true
  AND name IN ('super_admin', 'admin');

COMMIT;
