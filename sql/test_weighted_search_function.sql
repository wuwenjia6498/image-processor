-- 测试加权语义搜索函数
-- 用于验证函数是否正常工作

-- 1. 首先检查表中是否有数据以及向量字段的状态
SELECT 
    COUNT(*) as total_records,
    COUNT(theme_philosophy_embedding) as philosophy_vectors,
    COUNT(action_process_embedding) as action_vectors,
    COUNT(interpersonal_roles_embedding) as interpersonal_vectors,
    COUNT(edu_value_embedding) as edu_vectors,
    COUNT(learning_strategy_embedding) as strategy_vectors,
    COUNT(creative_play_embedding) as creative_vectors,
    COUNT(scene_visuals_embedding) as visual_vectors
FROM illustrations_optimized;

-- 2. 获取一个现有的向量作为测试查询向量
-- 这里我们使用第一条记录的 theme_philosophy_embedding 作为测试
WITH test_vector AS (
    SELECT theme_philosophy_embedding as query_vec
    FROM illustrations_optimized 
    WHERE theme_philosophy_embedding IS NOT NULL 
    LIMIT 1
)
-- 3. 测试基本的加权搜索（使用均衡权重）
SELECT 
    id,
    title,
    final_score,
    -- 显示各个主题的前50个字符以便查看
    LEFT(theme_philosophy, 50) || '...' as philosophy_preview,
    LEFT(action_process, 50) || '...' as action_preview,
    LEFT(edu_value, 50) || '...' as edu_preview
FROM weighted_semantic_search(
    (SELECT query_vec FROM test_vector),
    '{"philosophy": 0.15, "action_process": 0.15, "interpersonal_roles": 0.15, "edu_value": 0.15, "learning_strategy": 0.15, "creative_play": 0.1, "scene_visuals": 0.15}'::jsonb,
    5
);

-- 4. 测试重点关注教育价值的搜索
WITH test_vector AS (
    SELECT theme_philosophy_embedding as query_vec
    FROM illustrations_optimized 
    WHERE theme_philosophy_embedding IS NOT NULL 
    LIMIT 1
)
SELECT 
    id,
    title,
    final_score,
    LEFT(edu_value, 100) || '...' as education_focus
FROM weighted_semantic_search(
    (SELECT query_vec FROM test_vector),
    '{"philosophy": 0.1, "action_process": 0.1, "interpersonal_roles": 0.1, "edu_value": 0.5, "learning_strategy": 0.1, "creative_play": 0.05, "scene_visuals": 0.05}'::jsonb,
    3
);

-- 5. 测试重点关注创意游戏的搜索
WITH test_vector AS (
    SELECT creative_play_embedding as query_vec
    FROM illustrations_optimized 
    WHERE creative_play_embedding IS NOT NULL 
    LIMIT 1
)
SELECT 
    id,
    title,
    final_score,
    LEFT(creative_play, 100) || '...' as creativity_focus
FROM weighted_semantic_search(
    (SELECT query_vec FROM test_vector),
    '{"philosophy": 0.05, "action_process": 0.1, "interpersonal_roles": 0.1, "edu_value": 0.1, "learning_strategy": 0.1, "creative_play": 0.5, "scene_visuals": 0.05}'::jsonb,
    3
);

-- 6. 验证函数返回的得分是否合理（应该在0-1之间）
WITH test_vector AS (
    SELECT theme_philosophy_embedding as query_vec
    FROM illustrations_optimized 
    WHERE theme_philosophy_embedding IS NOT NULL 
    LIMIT 1
)
SELECT 
    MIN(final_score) as min_score,
    MAX(final_score) as max_score,
    AVG(final_score) as avg_score,
    COUNT(*) as result_count
FROM weighted_semantic_search(
    (SELECT query_vec FROM test_vector),
    '{"philosophy": 0.14, "action_process": 0.14, "interpersonal_roles": 0.14, "edu_value": 0.14, "learning_strategy": 0.14, "creative_play": 0.16, "scene_visuals": 0.14}'::jsonb,
    20
);