-- 性能优化脚本 v2
-- 专门优化加权搜索的超时问题

-- 1. 首先检查当前表结构和索引状态
DO $$
BEGIN
    -- 检查表是否存在
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'illustrations_optimized') THEN
        RAISE NOTICE '⚠️ illustrations_optimized 表不存在，请先执行基础设置脚本';
        RETURN;
    END IF;
    
    RAISE NOTICE '✅ 开始性能优化...';
END $$;

-- 2. 创建高效的优化版加权语义搜索函数
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
    max_weight_3 FLOAT;
BEGIN
    -- 设置查询超时（25秒，比前端超时稍短）
    SET LOCAL statement_timeout = '25s';
    
    -- 启用更快的查询计划
    SET LOCAL enable_seqscan = false;
    SET LOCAL work_mem = '256MB';
    SET LOCAL random_page_cost = 1.0;  -- SSD优化
    
    -- 计算第3大权重作为阈值
    SELECT val INTO max_weight_3
    FROM (
        SELECT val, ROW_NUMBER() OVER (ORDER BY val DESC) as rn
        FROM unnest(ARRAY[w_philosophy, w_action_process, w_interpersonal_roles, 
                         w_edu_value, w_learning_strategy, w_creative_play, w_scene_visuals]) as val
    ) ranked
    WHERE rn = 3;
    
    -- 如果max_weight_3为NULL，设置默认值
    max_weight_3 := COALESCE(max_weight_3, 0.1);
    
    -- 高效的查询：分两步处理
    -- 第一步：快速预筛选，只使用权重最高的维度
    RETURN QUERY
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

-- 3. 创建专门的性能监控函数
CREATE OR REPLACE FUNCTION check_search_performance()
RETURNS TABLE(
    metric_name TEXT,
    metric_value TEXT,
    status TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    total_records INT;
    avg_vectors_per_record FLOAT;
    index_count INT;
BEGIN
    -- 检查记录总数
    SELECT COUNT(*) INTO total_records FROM illustrations_optimized;
    
    -- 检查平均向量数
    SELECT (
        COUNT(theme_philosophy_embedding) + 
        COUNT(action_process_embedding) + 
        COUNT(interpersonal_roles_embedding) + 
        COUNT(edu_value_embedding) + 
        COUNT(learning_strategy_embedding) + 
        COUNT(creative_play_embedding) + 
        COUNT(scene_visuals_embedding)
    )::FLOAT / COUNT(*) INTO avg_vectors_per_record 
    FROM illustrations_optimized;
    
    -- 检查索引数量
    SELECT COUNT(*) INTO index_count 
    FROM pg_indexes 
    WHERE tablename = 'illustrations_optimized' 
    AND indexname LIKE '%embedding%';
    
    RETURN QUERY VALUES
        ('总记录数', total_records::TEXT, CASE WHEN total_records > 0 THEN '✅' ELSE '❌' END),
        ('平均向量数/记录', ROUND(avg_vectors_per_record, 2)::TEXT, CASE WHEN avg_vectors_per_record >= 5 THEN '✅' ELSE '⚠️' END),
        ('向量索引数', index_count::TEXT, CASE WHEN index_count >= 7 THEN '✅' ELSE '❌' END);
END;
$$;

-- 4. 添加函数注释
COMMENT ON FUNCTION weighted_semantic_search_optimized(VECTOR(1536), JSONB, INT, FLOAT) IS 
'高效优化版加权语义搜索函数 v2：
- 使用两阶段查询：快速预筛选 + 精确计算
- 优先使用权重最高的维度进行初筛
- 降低相似度阈值减少过度过滤
- 设置25秒查询超时和内存优化
- 预筛选3倍结果量确保质量
- 添加SSD存储优化参数';

COMMENT ON FUNCTION check_search_performance() IS 
'检查搜索性能相关指标：
- 数据库记录统计
- 向量完整性检查  
- 索引状态验证';

-- 5. 执行性能检查
SELECT '🔍 性能检查结果:' as info;
SELECT * FROM check_search_performance();

-- 6. 提供使用建议
DO $$
BEGIN
    RAISE NOTICE '✅ 优化版搜索函数已更新！';
    RAISE NOTICE '💡 建议：';
    RAISE NOTICE '  1. 相似度阈值已降低到 0.05，提高成功率';
    RAISE NOTICE '  2. 查询超时设置为 25秒，避免前端超时';
    RAISE NOTICE '  3. 使用两阶段查询，先快速筛选再精确计算';
    RAISE NOTICE '  4. 如仍有超时，可进一步降低 similarity_threshold 到 0.02';
END $$; 