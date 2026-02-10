-- ============================================================
-- 数据迁移脚本：统一企业为 yadea
--
-- 背景：开发者登录和飞书登录分别创建了两个企业
--   - 'Cherry Studio Enterprise'（种子脚本创建）
--   - 'Development Company'（开发者登录创建）
-- 需要将所有数据合并到一个统一的 'yadea' 企业下。
--
-- 用法：
--   1. 备份数据库
--   2. 连接到数据库后执行本脚本
--   3. 验证结果
--
-- 注意：请先备份数据库！此脚本不可逆。
-- ============================================================

BEGIN;

-- ──────────────────────────────────────────────
-- 步骤 1：确定目标企业（最早创建的企业）并重命名为 yadea
-- ──────────────────────────────────────────────

-- 取最早创建的企业作为目标企业
DO $$
DECLARE
  v_target_id UUID;
  v_target_name TEXT;
  v_source_id UUID;
  v_source_name TEXT;
  v_target_dept_id UUID;
  v_target_role_id UUID;
  v_migrated_users INT := 0;
  v_migrated_usage INT := 0;
  v_migrated_audit INT := 0;
BEGIN
  -- 找到目标企业（最早创建的）
  SELECT id, name INTO v_target_id, v_target_name
  FROM companies
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_target_id IS NULL THEN
    RAISE NOTICE 'No companies found, nothing to migrate.';
    RETURN;
  END IF;

  RAISE NOTICE 'Target company: id=%, name=%', v_target_id, v_target_name;

  -- 将目标企业重命名为 yadea（如果不是的话）
  IF v_target_name <> 'yadea' THEN
    UPDATE companies SET name = 'yadea', updated_at = NOW() WHERE id = v_target_id;
    RAISE NOTICE 'Renamed target company from "%" to "yadea"', v_target_name;
  END IF;

  -- 获取目标企业下的默认部门
  SELECT id INTO v_target_dept_id
  FROM departments
  WHERE company_id = v_target_id
  ORDER BY created_at ASC
  LIMIT 1;

  -- 获取目标企业下的 Super Admin 角色
  SELECT id INTO v_target_role_id
  FROM roles
  WHERE company_id = v_target_id AND name = 'Super Admin'
  LIMIT 1;

  IF v_target_dept_id IS NULL THEN
    RAISE NOTICE 'WARNING: No department found in target company, users cannot be migrated';
    RETURN;
  END IF;

  IF v_target_role_id IS NULL THEN
    RAISE NOTICE 'WARNING: No Super Admin role found in target company, users cannot be migrated';
    RETURN;
  END IF;

  RAISE NOTICE 'Target dept=%, Target role=%', v_target_dept_id, v_target_role_id;

  -- ──────────────────────────────────────────────
  -- 步骤 2：迁移其他企业的数据到目标企业
  -- ──────────────────────────────────────────────

  -- 遍历所有非目标企业
  FOR v_source_id, v_source_name IN
    SELECT id, name FROM companies WHERE id <> v_target_id
  LOOP
    RAISE NOTICE 'Migrating data from company "%" (id=%)', v_source_name, v_source_id;

    -- 迁移用户：更新 company_id, department_id, role_id
    UPDATE users
    SET
      company_id = v_target_id,
      department_id = v_target_dept_id,
      role_id = v_target_role_id,
      updated_at = NOW()
    WHERE company_id = v_source_id;

    GET DIAGNOSTICS v_migrated_users = ROW_COUNT;
    RAISE NOTICE '  Migrated % users', v_migrated_users;

    -- 迁移 usage_logs
    UPDATE usage_logs
    SET company_id = v_target_id
    WHERE company_id = v_source_id;

    GET DIAGNOSTICS v_migrated_usage = ROW_COUNT;
    RAISE NOTICE '  Migrated % usage_logs', v_migrated_usage;

    -- 迁移 audit_logs
    UPDATE audit_logs
    SET company_id = v_target_id
    WHERE company_id = v_source_id;

    GET DIAGNOSTICS v_migrated_audit = ROW_COUNT;
    RAISE NOTICE '  Migrated % audit_logs', v_migrated_audit;

    -- 迁移 models
    UPDATE models
    SET company_id = v_target_id
    WHERE company_id = v_source_id;

    -- 迁移 knowledge_bases
    UPDATE knowledge_bases
    SET company_id = v_target_id
    WHERE company_id = v_source_id;

    -- 迁移 backups
    UPDATE backups
    SET company_id = v_target_id
    WHERE company_id = v_source_id;

    -- 迁移 assistant_presets
    UPDATE assistant_presets
    SET company_id = v_target_id
    WHERE company_id = v_source_id;

    -- 迁移 assistant_preset_tags
    UPDATE assistant_preset_tags
    SET company_id = v_target_id
    WHERE company_id = v_source_id;

    -- 删除源企业的空部门和角色（用户已迁走）
    DELETE FROM departments WHERE company_id = v_source_id;
    DELETE FROM roles WHERE company_id = v_source_id;

    -- 删除源企业
    DELETE FROM companies WHERE id = v_source_id;
    RAISE NOTICE '  Deleted source company "%"', v_source_name;
  END LOOP;

  RAISE NOTICE 'Migration complete! All data now under yadea company (id=%)', v_target_id;
END;
$$;

-- ──────────────────────────────────────────────
-- 步骤 3：验证结果
-- ──────────────────────────────────────────────

-- 应该只有一个企业 yadea
SELECT id, name, created_at FROM companies;

-- 所有用户应该属于 yadea 企业
SELECT u.id, u.name, u.email, c.name AS company_name
FROM users u
JOIN companies c ON u.company_id = c.id;

COMMIT;
