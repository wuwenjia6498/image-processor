-- 调试数据库字段内容
-- 检查illustrations_optimized表中的实际数据

-- 1. 检查表结构
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'illustrations_optimized'
AND column_name IN ('filename', 'original_description', 'ai_description', 'image_url')
ORDER BY column_name;

-- 2. 查看前3条记录的关键字段内容
SELECT 
    id,
    filename,
    CASE 
        WHEN LENGTH(original_description) > 100 THEN LEFT(original_description, 100) || '...'
        ELSE original_description 
    END as original_description_sample,
    CASE 
        WHEN LENGTH(image_url) > 100 THEN LEFT(image_url, 100) || '...'
        ELSE image_url 
    END as image_url_sample,
    LENGTH(original_description) as desc_length,
    LENGTH(image_url) as url_length,
    -- 检查内容特征
    CASE 
        WHEN original_description LIKE 'https://%' THEN 'URL_LIKE'
        WHEN original_description LIKE '%描述%' OR original_description LIKE '%图片%' THEN 'DESC_LIKE'
        ELSE 'OTHER'
    END as desc_type,
    CASE 
        WHEN image_url LIKE 'https://%' THEN 'URL_LIKE'
        WHEN image_url LIKE '%描述%' OR image_url LIKE '%图片%' THEN 'DESC_LIKE'
        ELSE 'OTHER'
    END as url_type
FROM illustrations_optimized
ORDER BY id
LIMIT 3;

-- 3. 检查字段内容分布
SELECT 
    '字段内容分析' as analysis_type,
    COUNT(*) as total_records,
    COUNT(CASE WHEN original_description LIKE 'https://%' THEN 1 END) as desc_as_url_count,
    COUNT(CASE WHEN image_url LIKE 'https://%' THEN 1 END) as url_as_url_count,
    COUNT(CASE WHEN LENGTH(original_description) > LENGTH(image_url) THEN 1 END) as desc_longer_than_url
FROM illustrations_optimized;

-- 4. 检查是否存在ai_description字段
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'illustrations_optimized' 
            AND column_name = 'ai_description'
        ) THEN 'ai_description字段存在'
        ELSE 'ai_description字段不存在'
    END as ai_description_status; 