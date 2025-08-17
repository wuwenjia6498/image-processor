-- 创建高效的优化版加权语义搜索函数
CREATE OR REPLACE FUNCTION weighted_semantic_search_optimized(
    query_embedding VECTOR(1536),
    weights JSONB DEFAULT '{"philosophy": 0.14, "action_process": 0.14, "interpersonal_roles": 0.14, "edu_value": 0.14, "learning_strategy": 0.14, "creative_play": 0.14, "scene_visuals": 0.16}'::jsonb,
    match_count INT DEFAULT 20,
    similarity_threshold FLOAT DEFAULT 0.05  -- 降低阈值，减少过滤计算
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
    -- 找出权重最高的前3个维度，重点优化
    max_weight_1 FLOAT;
    max_weight_2 FLOAT;
    max_weight_3 FLOAT;
BEGIN
    -- 设置查询超时（25秒，比前端超时稍短）
    SET LOCAL statement_timeout = '25s';
    
    -- 启用更快的查询计划
    SET LOCAL enable_seqscan = false;
    SET LOCAL work_mem = '256MB';
    
    -- 计算前3个最大权重
    SELECT w1, w2, w3 INTO max_weight_1, max_weight_2, max_weight_3
    FROM (
        SELECT 
            val as weight_val,
            ROW_NUMBER() OVER (ORDER BY val DESC) as rn
        FROM unnest(ARRAY[w_philosophy, w_action_process, w_interpersonal_roles, 
                         w_edu_value, w_learning_strategy, w_creative_play, w_scene_visuals]) as val
    ) ranked
    WHERE rn <= 3;
    
    -- 高效的查询：分两步处理
    -- 第一步：快速预筛选，只使用权重最高的维度
    WITH pre_filtered AS (
        SELECT 
            i.id,
            i.filename,
            i.image_url,
            i.ai_description,
            i.theme_philosophy,
            i.action_process,
            i.interpersonal_roles,
            i.edu_value,
            i.learning_strategy,
            i.creative_play,
            i.scene_visuals,
            -- 使用最高权重维度进行快速筛选
            GREATEST(
                CASE WHEN i.theme_philosophy_embedding IS NOT NULL AND w_philosophy >= max_weight_3
                     THEN (1 - (query_embedding <=> i.theme_philosophy_embedding)) * w_philosophy 
                     ELSE 0 END,
                CASE WHEN i.action_process_embedding IS NOT NULL AND w_action_process >= max_weight_3
                     THEN (1 - (query_embedding <=> i.action_process_embedding)) * w_action_process 
                     ELSE 0 END,
                CASE WHEN i.interpersonal_roles_embedding IS NOT NULL AND w_interpersonal_roles >= max_weight_3
                     THEN (1 - (query_embedding <=> i.interpersonal_roles_embedding)) * w_interpersonal_roles 
                     ELSE 0 END,
                CASE WHEN i.edu_value_embedding IS NOT NULL AND w_edu_value >= max_weight_3
                     THEN (1 - (query_embedding <=> i.edu_value_embedding)) * w_edu_value 
                     ELSE 0 END,
                CASE WHEN i.learning_strategy_embedding IS NOT NULL AND w_learning_strategy >= max_weight_3
                     THEN (1 - (query_embedding <=> i.learning_strategy_embedding)) * w_learning_strategy 
                     ELSE 0 END,
                CASE WHEN i.creative_play_embedding IS NOT NULL AND w_creative_play >= max_weight_3
                     THEN (1 - (query_embedding <=> i.creative_play_embedding)) * w_creative_play 
                     ELSE 0 END,
                CASE WHEN i.scene_visuals_embedding IS NOT NULL AND w_scene_visuals >= max_weight_3
                     THEN (1 - (query_embedding <=> i.scene_visuals_embedding)) * w_scene_visuals 
                     ELSE 0 END
            ) as quick_score,
            -- 完整的加权相似度计算（只对预筛选结果计算）
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
            ) as full_score
        FROM illustrations_optimized i
        WHERE 
            -- 只筛选有足够向量数据的记录
            (i.theme_philosophy_embedding IS NOT NULL OR 
             i.action_process_embedding IS NOT NULL OR 
             i.interpersonal_roles_embedding IS NOT NULL OR 
             i.edu_value_embedding IS NOT NULL OR 
             i.learning_strategy_embedding IS NOT NULL OR 
             i.creative_play_embedding IS NOT NULL OR 
             i.scene_visuals_embedding IS NOT NULL)
        ORDER BY quick_score DESC
        LIMIT match_count * 3  -- 预筛选更多结果，然后精确计算
    )
    
    -- 第二步：返回最终结果
    RETURN QUERY
    SELECT 
        pre_filtered.id,
        pre_filtered.filename AS title,
        pre_filtered.image_url,
        pre_filtered.ai_description AS original_description,
        COALESCE(pre_filtered.theme_philosophy, '') AS theme_philosophy,
        COALESCE(pre_filtered.action_process, '') AS action_process,
        COALESCE(pre_filtered.interpersonal_roles, '') AS interpersonal_roles,
        COALESCE(pre_filtered.edu_value, '') AS edu_value,
        COALESCE(pre_filtered.learning_strategy, '') AS learning_strategy,
        COALESCE(pre_filtered.creative_play, '') AS creative_play,
        COALESCE(pre_filtered.scene_visuals, '') AS scene_visuals,
        pre_filtered.full_score AS final_score
    FROM pre_filtered
    WHERE pre_filtered.full_score > similarity_threshold
    ORDER BY pre_filtered.full_score DESC
    LIMIT match_count;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION weighted_semantic_search_optimized(VECTOR(1536), JSONB, INT, FLOAT) IS 
'高效优化版加权语义搜索函数：
- 使用两阶段查询：快速预筛选 + 精确计算
- 优先使用权重最高的维度进行初筛
- 降低相似度阈值减少过度过滤
- 设置25秒查询超时和内存优化
- 预筛选3倍结果量确保质量';
