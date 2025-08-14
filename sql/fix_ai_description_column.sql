-- 修复 illustrations_optimized 表中缺失的 ai_description 字段
-- 这个脚本会安全地添加缺失的字段，如果字段已存在则跳过

-- 检查并添加 ai_description 字段
DO $$
BEGIN
    -- 检查 ai_description 字段是否存在
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'illustrations_optimized' 
        AND column_name = 'ai_description'
    ) THEN
        -- 添加 ai_description 字段
        ALTER TABLE illustrations_optimized 
        ADD COLUMN ai_description TEXT;
        
        -- 添加字段注释
        COMMENT ON COLUMN illustrations_optimized.ai_description IS 'GPT-4V生成的详细图片描述，包含风格、情绪、场景、构图、色调等信息';
        
        RAISE NOTICE '✅ ai_description 字段已添加';
    ELSE
        RAISE NOTICE '✅ ai_description 字段已存在';
    END IF;
END $$;

-- 检查并添加 ai_description 字段的索引
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE tablename = 'illustrations_optimized' 
        AND indexname = 'idx_illustrations_optimized_ai_description'
    ) THEN
        CREATE INDEX idx_illustrations_optimized_ai_description ON illustrations_optimized(ai_description);
        RAISE NOTICE '✅ ai_description 索引已创建';
    ELSE
        RAISE NOTICE '✅ ai_description 索引已存在';
    END IF;
END $$;

-- 检查其他可能缺失的字段
DO $$
BEGIN
    -- 检查 age_orientation 字段
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'illustrations_optimized' 
        AND column_name = 'age_orientation'
    ) THEN
        ALTER TABLE illustrations_optimized 
        ADD COLUMN age_orientation TEXT;
        COMMENT ON COLUMN illustrations_optimized.age_orientation IS '年龄定位（AI难以准确判断，需要人工标注）';
        RAISE NOTICE '✅ age_orientation 字段已添加';
    END IF;
    
    -- 检查 text_type_fit 字段
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'illustrations_optimized' 
        AND column_name = 'text_type_fit'
    ) THEN
        ALTER TABLE illustrations_optimized 
        ADD COLUMN text_type_fit TEXT;
        COMMENT ON COLUMN illustrations_optimized.text_type_fit IS '文本类型适配（AI难以准确判断，需要人工标注）';
        RAISE NOTICE '✅ text_type_fit 字段已添加';
    END IF;
END $$;

-- 显示当前表结构
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'illustrations_optimized' 
ORDER BY ordinal_position;