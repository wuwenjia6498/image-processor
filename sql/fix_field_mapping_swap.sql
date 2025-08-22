-- 修复SQL函数中的字段映射问题
-- 交换image_url和original_description的映射

-- 1. 更新优化版搜索函数（交换字段映射）
CREATE OR REPLACE FUNCTION weighted_semantic_search_optimized(
    query_embedding VECTOR(1536),
    weights JSONB DEFAULT '{"philosophy": 0.14, "action_process": 0.14, "interpersonal_roles": 0.14, "edu_value": 0.14, "learning_strategy": 0.14, "creative_play": 0.14, "scene_visuals": 0.16}'::jsonb,
    match_count INT DEFAULT 20,
    similarity_threshold FLOAT DEFAULT 0.05
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
    w_philosophy FLOAT := COALESCE((weights->>'philosophy')::FLOAT, 0);
    w_action_process FLOAT := COALESCE((weights->>'action_process')::FLOAT, 0);
    w_interpersonal_roles FLOAT := COALESCE((weights->>'interpersonal_roles')::FLOAT, 0);
    w_edu_value FLOAT := COALESCE((weights->>'edu_value')::FLOAT, 0);
    w_learning_strategy FLOAT := COALESCE((weights->>'learning_strategy')::FLOAT, 0);
    w_creative_play FLOAT := COALESCE((weights->>'creative_play')::FLOAT, 0);
    w_scene_visuals FLOAT := COALESCE((weights->>'scene_visuals')::FLOAT, 0);
BEGIN
    SET LOCAL statement_timeout = '30s';
    
    RETURN QUERY
    SELECT 
        i.id,
        i.filename AS title,
        i.original_description AS image_url,  -- 修复：交换映射，original_description实际存储URL
        i.image_url AS original_description,  -- 修复：交换映射，image_url实际存储描述
        COALESCE(i.theme_philosophy, '') AS theme_philosophy,
        COALESCE(i.action_process, '') AS action_process,
        COALESCE(i.interpersonal_roles, '') AS interpersonal_roles,
        COALESCE(i.edu_value, '') AS edu_value,
        COALESCE(i.learning_strategy, '') AS learning_strategy,
        COALESCE(i.creative_play, '') AS creative_play,
        COALESCE(i.scene_visuals, '') AS scene_visuals,
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
    WHERE (
        i.theme_philosophy_embedding IS NOT NULL OR 
        i.action_process_embedding IS NOT NULL OR 
        i.interpersonal_roles_embedding IS NOT NULL OR 
        i.edu_value_embedding IS NOT NULL OR 
        i.learning_strategy_embedding IS NOT NULL OR 
        i.creative_play_embedding IS NOT NULL OR 
        i.scene_visuals_embedding IS NOT NULL
    )
    ORDER BY final_score DESC
    LIMIT match_count;
END;
$$;

-- 2. 更新简化版搜索函数（交换字段映射）
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
    SET LOCAL statement_timeout = '15s';
    
    RETURN QUERY
    SELECT 
        i.id,
        i.filename AS title,
        i.original_description AS image_url,  -- 修复：交换映射
        i.image_url AS original_description,  -- 修复：交换映射
        COALESCE(i.theme_philosophy, '') AS theme_philosophy,
        COALESCE(i.action_process, '') AS action_process,
        COALESCE(i.interpersonal_roles, '') AS interpersonal_roles,
        COALESCE(i.edu_value, '') AS edu_value,
        COALESCE(i.learning_strategy, '') AS learning_strategy,
        COALESCE(i.creative_play, '') AS creative_play,
        COALESCE(i.scene_visuals, '') AS scene_visuals,
        (1 - (query_embedding <=> i.original_embedding)) AS final_score
    FROM illustrations_optimized i
    WHERE i.original_embedding IS NOT NULL
    ORDER BY final_score DESC
    LIMIT match_count;
END;
$$;

-- 3. 更新精选集搜索函数（交换字段映射）
CREATE OR REPLACE FUNCTION weighted_semantic_search_premium(
    query_embedding VECTOR(1536),
    weights JSONB DEFAULT '{"philosophy": 0.14, "action_process": 0.14, "interpersonal_roles": 0.14, "edu_value": 0.14, "learning_strategy": 0.14, "creative_play": 0.14, "scene_visuals": 0.16}'::jsonb,
    match_count INT DEFAULT 20,
    similarity_threshold FLOAT DEFAULT 0.02
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
    final_score FLOAT,
    quality_score FLOAT,
    selection_reason TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    w_philosophy FLOAT := COALESCE((weights->>'philosophy')::FLOAT, 0);
    w_action_process FLOAT := COALESCE((weights->>'action_process')::FLOAT, 0);
    w_interpersonal_roles FLOAT := COALESCE((weights->>'interpersonal_roles')::FLOAT, 0);
    w_edu_value FLOAT := COALESCE((weights->>'edu_value')::FLOAT, 0);
    w_learning_strategy FLOAT := COALESCE((weights->>'learning_strategy')::FLOAT, 0);
    w_creative_play FLOAT := COALESCE((weights->>'creative_play')::FLOAT, 0);
    w_scene_visuals FLOAT := COALESCE((weights->>'scene_visuals')::FLOAT, 0);
BEGIN
    SET LOCAL statement_timeout = '20s';
    
    RETURN QUERY
    SELECT 
        i.id,
        i.filename AS title,
        i.original_description AS image_url,  -- 修复：交换映射
        i.image_url AS original_description,  -- 修复：交换映射
        COALESCE(i.theme_philosophy, '') AS theme_philosophy,
        COALESCE(i.action_process, '') AS action_process,
        COALESCE(i.interpersonal_roles, '') AS interpersonal_roles,
        COALESCE(i.edu_value, '') AS edu_value,
        COALESCE(i.learning_strategy, '') AS learning_strategy,
        COALESCE(i.creative_play, '') AS creative_play,
        COALESCE(i.scene_visuals, '') AS scene_visuals,
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
        ) AS final_score,
        COALESCE(i.quality_score, 0.0) AS quality_score,
        COALESCE(i.selection_reason, '精选图片') AS selection_reason
    FROM illustrations_premium i
    WHERE (
        i.theme_philosophy_embedding IS NOT NULL OR 
        i.action_process_embedding IS NOT NULL OR 
        i.interpersonal_roles_embedding IS NOT NULL OR 
        i.edu_value_embedding IS NOT NULL OR 
        i.learning_strategy_embedding IS NOT NULL OR 
        i.creative_play_embedding IS NOT NULL OR 
        i.scene_visuals_embedding IS NOT NULL
    )
    ORDER BY final_score DESC
    LIMIT match_count;
END;
$$;

-- 验证修复
SELECT '字段映射修复完成！现在SQL函数将正确返回：image_url=URL, original_description=描述文字' as message; 