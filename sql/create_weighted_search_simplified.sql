-- 简化版加权语义搜索函数
-- 适用于直接在 Supabase SQL 编辑器中运行

CREATE OR REPLACE FUNCTION weighted_semantic_search(
    query_embedding VECTOR(1536),
    weights JSONB,
    match_count INT
)
RETURNS TABLE(
    id BIGINT,
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
        i.title,
        i.image_url,
        i.original_description,
        i.theme_philosophy,
        i.action_process,
        i.interpersonal_roles,
        i.edu_value,
        i.learning_strategy,
        i.creative_play,
        i.scene_visuals,
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
        i.theme_philosophy_embedding IS NOT NULL
        AND i.action_process_embedding IS NOT NULL
        AND i.interpersonal_roles_embedding IS NOT NULL
        AND i.edu_value_embedding IS NOT NULL
        AND i.learning_strategy_embedding IS NOT NULL
        AND i.creative_play_embedding IS NOT NULL
        AND i.scene_visuals_embedding IS NOT NULL
    ORDER BY final_score DESC
    LIMIT match_count;
END;
$$;