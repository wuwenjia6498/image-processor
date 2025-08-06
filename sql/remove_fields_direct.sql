-- 直接在Supabase SQL编辑器中执行此脚本来删除字段
-- 请复制此脚本到Supabase Dashboard > SQL Editor中执行

-- 1. 删除相关索引
DROP INDEX IF EXISTS idx_illustrations_optimized_age_orientation;
DROP INDEX IF EXISTS idx_illustrations_optimized_text_type_fit;

-- 2. 删除字段
ALTER TABLE illustrations_optimized DROP COLUMN IF EXISTS age_orientation;
ALTER TABLE illustrations_optimized DROP COLUMN IF EXISTS text_type_fit;

-- 3. 验证删除结果
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'illustrations_optimized' 
ORDER BY ordinal_position;

-- 4. 更新表注释
COMMENT ON TABLE illustrations_optimized IS '优化后的插画数据表，主要依赖GPT-4V的AI描述，已移除age_orientation和text_type_fit字段'; 