-- 删除 age_orientation 和 text_type_fit 字段的SQL迁移脚本
-- 执行此脚本将从 illustrations_optimized 表中删除这两个字段

-- 1. 删除相关的索引
DROP INDEX IF EXISTS idx_illustrations_optimized_age_orientation;
DROP INDEX IF EXISTS idx_illustrations_optimized_text_type_fit;

-- 2. 删除字段
ALTER TABLE illustrations_optimized DROP COLUMN IF EXISTS age_orientation;
ALTER TABLE illustrations_optimized DROP COLUMN IF EXISTS text_type_fit;

-- 3. 验证字段已删除
-- 可以通过以下查询验证字段是否已成功删除：
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'illustrations_optimized' 
-- AND column_name IN ('age_orientation', 'text_type_fit');

-- 4. 更新表注释（移除相关字段的注释）
COMMENT ON TABLE illustrations_optimized IS '优化后的插画数据表，主要依赖GPT-4V的AI描述，已移除age_orientation和text_type_fit字段';

-- 执行完成后的表结构将包含以下字段：
-- - id (TEXT PRIMARY KEY)
-- - filename (TEXT NOT NULL)
-- - book_title (TEXT NOT NULL)
-- - image_url (TEXT NOT NULL)
-- - ai_description (TEXT)
-- - vector_embedding (FLOAT[])
-- - created_at (TIMESTAMP WITH TIME ZONE)
-- - updated_at (TIMESTAMP WITH TIME ZONE) 