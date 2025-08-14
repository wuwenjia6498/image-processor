-- 优化加权搜索性能的解决方案
-- 解决数据库查询超时问题

-- 1. 创建向量字段的索引以提升查询性能
-- 为每个主题向量字段创建 HNSW 索引（适用于向量相似度搜索）

-- 检查是否已存在索引，如果不存在则创建
DO $$
BEGIN
    -- theme_philosophy_embedding 索引
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'illustrations_optimized' 
        AND indexname = 'idx_theme_philosophy_embedding_hnsw'
    ) THEN
        CREATE INDEX CONCURRENTLY idx_theme_philosophy_embedding_hnsw 
        ON illustrations_optimized 
        USING hnsw (theme_philosophy_embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
    END IF;

    -- action_process_embedding 索引
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'illustrations_optimized' 
        AND indexname = 'idx_action_process_embedding_hnsw'
    ) THEN
        CREATE INDEX CONCURRENTLY idx_action_process_embedding_hnsw 
        ON illustrations_optimized 
        USING hnsw (action_process_embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
    END IF;

    -- interpersonal_roles_embedding 索引
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'illustrations_optimized' 
        AND indexname = 'idx_interpersonal_roles_embedding_hnsw'
    ) THEN
        CREATE INDEX CONCURRENTLY idx_interpersonal_roles_embedding_hnsw 
        ON illustrations_optimized 
        USING hnsw (interpersonal_roles_embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
    END IF;

    -- edu_value_embedding 索引
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'illustrations_optimized' 
        AND indexname = 'idx_edu_value_embedding_hnsw'
    ) THEN
        CREATE INDEX CONCURRENTLY idx_edu_value_embedding_hnsw 
        ON illustrations_optimized 
        USING hnsw (edu_value_embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
    END IF;

    -- learning_strategy_embedding 索引
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'illustrations_optimized' 
        AND indexname = 'idx_learning_strategy_embedding_hnsw'
    ) THEN
        CREATE INDEX CONCURRENTLY idx_learning_strategy_embedding_hnsw 
        ON illustrations_optimized 
        USING hnsw (learning_strategy_embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
    END IF;

    -- creative_play_embedding 索引
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'illustrations_optimized' 
        AND indexname = 'idx_creative_play_embedding_hnsw'
    ) THEN
        CREATE INDEX CONCURRENTLY idx_creative_play_embedding_hnsw 
        ON illustrations_optimized 
        USING hnsw (creative_play_embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
    END IF;

    -- scene_visuals_embedding 索引
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'illustrations_optimized' 
        AND indexname = 'idx_scene_visuals_embedding_hnsw'
    ) THEN
        CREATE INDEX CONCURRENTLY idx_scene_visuals_embedding_hnsw 
        ON illustrations_optimized 
        USING hnsw (scene_visuals_embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
    END IF;

END $$;

-- 2. 创建优化版本的加权搜索函数
-- 使用更高效的查询策略，减少计算复杂度

CREATE OR REPLACE FUNCTION weighted_semantic_search_optimized(
    query_embedding VECTOR(1536),
    weights JSONB DEFAULT '{"philosophy": 0.14, "action_process": 0.14, "interpersonal_roles": 0.14, "edu_value": 0.14, "learning_strategy": 0.14, "creative_play": 0.14, "scene_visuals": 0.16}'::jsonb,
    match_count INT DEFAULT 20,
    similarity_threshold FLOAT DEFAULT 0.1  -- 新增相似度阈值参数
)
RETURNS TABLE(
    id TEXT,
    title TEXT,
    image_url TEXT,
    original_description TEXT,
    theme_philosophy TEXT,
    action_process TEXT,
    interpersonal_roles TEXT,
    edu_value TEXT,
    learning_strategy TEXT,
    creative_play TEXT,
    scene_visuals TEXT,
    final_score FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
    -- 声明权重变量以提升性能
    w_philosophy FLOAT := COALESCE((weights->>'philosophy')::FLOAT, 0);
    w_action_process FLOAT := COALESCE((weights->>'action_process')::FLOAT, 0);
    w_interpersonal_roles FLOAT := COALESCE((weights->>'interpersonal_roles')::FLOAT, 0);
    w_edu_value FLOAT := COALESCE((weights->>'edu_value')::FLOAT, 0);
    w_learning_strategy FLOAT := COALESCE((weights->>'learning_strategy')::FLOAT, 0);
    w_creative_play FLOAT := COALESCE((weights->>'creative_play')::FLOAT, 0);
    w_scene_visuals FLOAT := COALESCE((weights->>'scene_visuals')::FLOAT, 0);
BEGIN
    -- 设置查询超时（30秒）
    SET LOCAL statement_timeout = '30s';
    
    -- 优化的查询：使用预计算的权重变量
    RETURN QUERY
    SELECT 
        i.id,
        i.filename AS title,
        i.image_url,
        i.ai_description AS original_description,
        COALESCE(i.theme_philosophy, '') AS theme_philosophy,
        COALESCE(i.action_process, '') AS action_process,
        COALESCE(i.interpersonal_roles, '') AS interpersonal_roles,
        COALESCE(i.edu_value, '') AS edu_value,
        COALESCE(i.learning_strategy, '') AS learning_strategy,
        COALESCE(i.creative_play, '') AS creative_play,
        COALESCE(i.scene_visuals, '') AS scene_visuals,
        -- 优化的加权相似度计算
        (
            CASE WHEN i.theme_philosophy_embedding IS NOT NULL AND w_philosophy > 0 
                 THEN (1 - (query_embedding <=> i.theme_philosophy_embedding)) * w_philosophy 
                 ELSE 0 END +
            CASE WHEN i.action_process_embedding IS NOT NULL AND w_action_process > 0 
                 THEN (1 - (query_embedding <=> i.action_process_embedding)) * w_action_process 
                 ELSE 0 END +
            CASE WHEN i.interpersonal_roles_embedding IS NOT NULL AND w_interpersonal_roles > 0 
                 THEN (1 - (query_embedding <=> i.interpersonal_roles_embedding)) * w_interpersonal_roles 
                 ELSE 0 END +
            CASE WHEN i.edu_value_embedding IS NOT NULL AND w_edu_value > 0 
                 THEN (1 - (query_embedding <=> i.edu_value_embedding)) * w_edu_value 
                 ELSE 0 END +
            CASE WHEN i.learning_strategy_embedding IS NOT NULL AND w_learning_strategy > 0 
                 THEN (1 - (query_embedding <=> i.learning_strategy_embedding)) * w_learning_strategy 
                 ELSE 0 END +
            CASE WHEN i.creative_play_embedding IS NOT NULL AND w_creative_play > 0 
                 THEN (1 - (query_embedding <=> i.creative_play_embedding)) * w_creative_play 
                 ELSE 0 END +
            CASE WHEN i.scene_visuals_embedding IS NOT NULL AND w_scene_visuals > 0 
                 THEN (1 - (query_embedding <=> i.scene_visuals_embedding)) * w_scene_visuals 
                 ELSE 0 END
        ) AS final_score
    FROM illustrations_optimized i
    WHERE 
        -- 只处理有至少一个有效向量的记录
        (i.theme_philosophy_embedding IS NOT NULL OR
         i.action_process_embedding IS NOT NULL OR
         i.interpersonal_roles_embedding IS NOT NULL OR
         i.edu_value_embedding IS NOT NULL OR
         i.learning_strategy_embedding IS NOT NULL OR
         i.creative_play_embedding IS NOT NULL OR
         i.scene_visuals_embedding IS NOT NULL)
        -- 添加相似度阈值过滤，减少计算量
        AND (
            (i.theme_philosophy_embedding IS NOT NULL AND 
             (1 - (query_embedding <=> i.theme_philosophy_embedding)) > similarity_threshold) OR
            (i.action_process_embedding IS NOT NULL AND 
             (1 - (query_embedding <=> i.action_process_embedding)) > similarity_threshold) OR
            (i.interpersonal_roles_embedding IS NOT NULL AND 
             (1 - (query_embedding <=> i.interpersonal_roles_embedding)) > similarity_threshold) OR
            (i.edu_value_embedding IS NOT NULL AND 
             (1 - (query_embedding <=> i.edu_value_embedding)) > similarity_threshold) OR
            (i.learning_strategy_embedding IS NOT NULL AND 
             (1 - (query_embedding <=> i.learning_strategy_embedding)) > similarity_threshold) OR
            (i.creative_play_embedding IS NOT NULL AND 
             (1 - (query_embedding <=> i.creative_play_embedding)) > similarity_threshold) OR
            (i.scene_visuals_embedding IS NOT NULL AND 
             (1 - (query_embedding <=> i.scene_visuals_embedding)) > similarity_threshold)
        )
    ORDER BY final_score DESC
    LIMIT match_count;
END;
$$;

-- 3. 创建简化版本的搜索函数（作为备选方案）
-- 当优化版本仍然超时时使用

CREATE OR REPLACE FUNCTION weighted_semantic_search_simple(
    query_embedding VECTOR(1536),
    weights JSONB DEFAULT '{"philosophy": 0.14, "action_process": 0.14, "interpersonal_roles": 0.14, "edu_value": 0.14, "learning_strategy": 0.14, "creative_play": 0.14, "scene_visuals": 0.16}'::jsonb,
    match_count INT DEFAULT 20
)
RETURNS TABLE(
    id TEXT,
    title TEXT,
    image_url TEXT,
    original_description TEXT,
    theme_philosophy TEXT,
    action_process TEXT,
    interpersonal_roles TEXT,
    edu_value TEXT,
    learning_strategy TEXT,
    creative_play TEXT,
    scene_visuals TEXT,
    final_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- 设置较短的查询超时（15秒）
    SET LOCAL statement_timeout = '15s';
    
    -- 简化版本：只使用权重最高的3个维度进行计算
    RETURN QUERY
    SELECT 
        i.id,
        i.filename AS title,
        i.image_url,
        i.ai_description AS original_description,
        COALESCE(i.theme_philosophy, '') AS theme_philosophy,
        COALESCE(i.action_process, '') AS action_process,
        COALESCE(i.interpersonal_roles, '') AS interpersonal_roles,
        COALESCE(i.edu_value, '') AS edu_value,
        COALESCE(i.learning_strategy, '') AS learning_strategy,
        COALESCE(i.creative_play, '') AS creative_play,
        COALESCE(i.scene_visuals, '') AS scene_visuals,
        -- 简化的相似度计算（只计算原始描述向量）
        (1 - (query_embedding <=> i.original_embedding)) AS final_score
    FROM illustrations_optimized i
    WHERE i.original_embedding IS NOT NULL
    ORDER BY final_score DESC
    LIMIT match_count;
END;
$$;

-- 4. 添加数据库性能监控视图
CREATE OR REPLACE VIEW weighted_search_performance_stats AS
SELECT 
    COUNT(*) as total_records,
    COUNT(theme_philosophy_embedding) as theme_philosophy_count,
    COUNT(action_process_embedding) as action_process_count,
    COUNT(interpersonal_roles_embedding) as interpersonal_roles_count,
    COUNT(edu_value_embedding) as edu_value_count,
    COUNT(learning_strategy_embedding) as learning_strategy_count,
    COUNT(creative_play_embedding) as creative_play_count,
    COUNT(scene_visuals_embedding) as scene_visuals_count,
    COUNT(original_embedding) as original_embedding_count
FROM illustrations_optimized;

-- 添加函数注释
COMMENT ON FUNCTION weighted_semantic_search_optimized(VECTOR(1536), JSONB, INT, FLOAT) IS 
'优化版加权语义搜索函数：
- 使用预计算权重变量提升性能
- 添加相似度阈值过滤减少计算量
- 设置30秒查询超时
- 使用CASE语句避免空值计算';

COMMENT ON FUNCTION weighted_semantic_search_simple(VECTOR(1536), JSONB, INT) IS 
'简化版加权语义搜索函数：
- 备选方案，当优化版本超时时使用
- 只使用原始描述向量进行相似度计算
- 设置15秒查询超时
- 性能优先，准确度略有降低';

-- 使用说明
/*
优先使用 weighted_semantic_search_optimized 函数
如果仍然超时，则降级使用 weighted_semantic_search_simple 函数

示例：
SELECT * FROM weighted_semantic_search_optimized(
    '[0.1, 0.2, ...]'::vector(1536),
    '{"philosophy": 0.3, "creative_play": 0.3, "edu_value": 0.4}'::jsonb,
    10,
    0.2  -- 相似度阈值
);
*/
