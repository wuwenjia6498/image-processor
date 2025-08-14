-- 诊断搜索问题的SQL查询

-- 1. 检查表是否存在以及基本信息
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE tablename = 'illustrations_optimized';

-- 2. 检查表结构 - 查看所有列
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'illustrations_optimized'
ORDER BY ordinal_position;

-- 3. 检查总记录数
SELECT COUNT(*) as total_records FROM illustrations_optimized;

-- 4. 检查各种向量字段的数据情况
SELECT 
    COUNT(*) as total_records,
    COUNT(vector_embedding) as has_vector_embedding,
    COUNT(theme_philosophy_embedding) as has_philosophy_vectors,
    COUNT(action_process_embedding) as has_action_vectors,
    COUNT(interpersonal_roles_embedding) as has_interpersonal_vectors,
    COUNT(edu_value_embedding) as has_edu_vectors,
    COUNT(learning_strategy_embedding) as has_strategy_vectors,
    COUNT(creative_play_embedding) as has_creative_vectors,
    COUNT(scene_visuals_embedding) as has_visual_vectors
FROM illustrations_optimized;

-- 5. 检查向量维度
SELECT 
    'vector_embedding' as field_name,
    array_length(vector_embedding, 1) as dimension,
    COUNT(*) as count
FROM illustrations_optimized 
WHERE vector_embedding IS NOT NULL
GROUP BY array_length(vector_embedding, 1)

UNION ALL

SELECT 
    'theme_philosophy_embedding' as field_name,
    array_length(theme_philosophy_embedding::float[], 1) as dimension,
    COUNT(*) as count
FROM illustrations_optimized 
WHERE theme_philosophy_embedding IS NOT NULL
GROUP BY array_length(theme_philosophy_embedding::float[], 1);

-- 6. 查看前3条记录的基本信息
SELECT 
    id,
    filename,
    book_title,
    LEFT(COALESCE(original_description, ''), 100) as description_preview,
    CASE 
        WHEN vector_embedding IS NULL THEN 'NULL'
        WHEN array_length(vector_embedding, 1) IS NULL THEN 'EMPTY'
        ELSE array_length(vector_embedding, 1)::TEXT || 'D'
    END as vector_status,
    CASE 
        WHEN theme_philosophy_embedding IS NULL THEN 'NULL'
        ELSE 'EXISTS'
    END as theme_vector_status
FROM illustrations_optimized
ORDER BY created_at DESC
LIMIT 3;

-- 7. 检查是否有任何记录满足搜索条件
SELECT 
    COUNT(*) as records_with_any_vector
FROM illustrations_optimized
WHERE 
    (vector_embedding IS NOT NULL AND array_length(vector_embedding, 1) > 0)
    OR theme_philosophy_embedding IS NOT NULL
    OR action_process_embedding IS NOT NULL
    OR interpersonal_roles_embedding IS NOT NULL
    OR edu_value_embedding IS NOT NULL
    OR learning_strategy_embedding IS NOT NULL
    OR creative_play_embedding IS NOT NULL
    OR scene_visuals_embedding IS NOT NULL;