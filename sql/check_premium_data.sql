-- 检查精选集数据完整性
-- 诊断插图描述和图片显示问题

-- 1. 检查精选集表是否存在数据
SELECT '📊 精选集基本信息:' as info;
SELECT 
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE original_description IS NOT NULL) as has_description,
    COUNT(*) FILTER (WHERE image_url IS NOT NULL) as has_image_url,
    COUNT(*) FILTER (WHERE filename IS NOT NULL) as has_filename
FROM illustrations_premium;

-- 2. 检查前几条记录的关键字段
SELECT '🔍 精选集前5条记录检查:' as info;
SELECT 
    id,
    filename,
    book_title,
    CASE 
        WHEN original_description IS NULL THEN '❌ NULL'
        WHEN LENGTH(original_description) = 0 THEN '❌ 空字符串'
        ELSE '✅ 有描述 (' || LENGTH(original_description) || '字符)'
    END as description_status,
    CASE 
        WHEN image_url IS NULL THEN '❌ NULL'
        WHEN LENGTH(image_url) = 0 THEN '❌ 空字符串'
        ELSE '✅ 有URL'
    END as url_status,
    LEFT(image_url, 50) as url_preview
FROM illustrations_premium 
ORDER BY id 
LIMIT 5;

-- 3. 检查搜索函数返回的字段结构
SELECT '🔧 搜索函数字段检查:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'illustrations_premium'
    AND column_name IN ('id', 'filename', 'original_description', 'image_url', 'book_title')
ORDER BY column_name;

-- 4. 测试精选集搜索函数
SELECT '🧪 测试精选集搜索函数:' as info;
-- 创建一个测试向量（全零向量）
WITH test_vector AS (
    SELECT array_fill(0.0, ARRAY[1536]) as test_embedding
)
SELECT 
    id,
    title,
    image_url,
    original_description,
    final_score
FROM weighted_semantic_search_premium(
    (SELECT test_embedding FROM test_vector)::vector(1536),
    '{"philosophy": 0.14, "action_process": 0.14, "interpersonal_roles": 0.14, "edu_value": 0.14, "learning_strategy": 0.14, "creative_play": 0.14, "scene_visuals": 0.16}'::jsonb,
    3,
    0.0
)
LIMIT 3; 