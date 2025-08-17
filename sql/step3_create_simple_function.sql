-- 步骤3: 创建简化版搜索函数（备用方案）
-- 在 Supabase SQL 编辑器中执行此脚本

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
    
    -- 简化版本：只使用原始描述向量进行计算
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

-- 添加函数注释
COMMENT ON FUNCTION weighted_semantic_search_simple(VECTOR(1536), JSONB, INT) IS 
'简化版加权语义搜索函数：
- 备选方案，当优化版本超时时使用
- 只使用原始描述向量进行相似度计算
- 设置15秒查询超时
- 性能优先，准确度略有降低';
