-- 重建加权搜索函数
-- 先删除旧函数，再创建新函数

-- 第一步：删除现有函数
DROP FUNCTION IF EXISTS weighted_semantic_search(vector, jsonb, integer);

-- 第二步：创建新的加权搜索函数
CREATE OR REPLACE FUNCTION weighted_semantic_search(
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
    RETURN QUERY
    SELECT 
        i.id,
        i.filename AS title,
        i.image_url,
        i.original_description AS original_description,
        COALESCE(i.theme_philosophy, '') AS theme_philosophy,
        COALESCE(i.action_process, '') AS action_process,
        COALESCE(i.interpersonal_roles, '') AS interpersonal_roles,
        COALESCE(i.edu_value, '') AS edu_value,
        COALESCE(i.learning_strategy, '') AS learning_strategy,
        COALESCE(i.creative_play, '') AS creative_play,
        COALESCE(i.scene_visuals, '') AS scene_visuals,
        (
            COALESCE((1 - (query_embedding <=> i.theme_philosophy_embedding)) * (weights->>'philosophy')::FLOAT, 0) +
            COALESCE((1 - (query_embedding <=> i.action_process_embedding)) * (weights->>'action_process')::FLOAT, 0) +
            COALESCE((1 - (query_embedding <=> i.interpersonal_roles_embedding)) * (weights->>'interpersonal_roles')::FLOAT, 0) +
            COALESCE((1 - (query_embedding <=> i.edu_value_embedding)) * (weights->>'edu_value')::FLOAT, 0) +
            COALESCE((1 - (query_embedding <=> i.learning_strategy_embedding)) * (weights->>'learning_strategy')::FLOAT, 0) +
            COALESCE((1 - (query_embedding <=> i.creative_play_embedding)) * (weights->>'creative_play')::FLOAT, 0) +
            COALESCE((1 - (query_embedding <=> i.scene_visuals_embedding)) * (weights->>'scene_visuals')::FLOAT, 0)
        ) AS final_score
    FROM illustrations_optimized i
    WHERE 
        (i.theme_philosophy_embedding IS NOT NULL OR
         i.action_process_embedding IS NOT NULL OR
         i.interpersonal_roles_embedding IS NOT NULL OR
         i.edu_value_embedding IS NOT NULL OR
         i.learning_strategy_embedding IS NOT NULL OR
         i.creative_play_embedding IS NOT NULL OR
         i.scene_visuals_embedding IS NOT NULL)
    ORDER BY final_score DESC
    LIMIT match_count;
END;
$$;