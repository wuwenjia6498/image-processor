-- 创建高级加权语义搜索函数
-- 函数名：weighted_semantic_search
-- 用途：基于7个主题向量字段进行加权相似度搜索

CREATE OR REPLACE FUNCTION weighted_semantic_search(
    query_embedding VECTOR(1536),
    weights JSONB DEFAULT '{"philosophy": 0.14, "action_process": 0.14, "interpersonal_roles": 0.14, "edu_value": 0.14, "learning_strategy": 0.14, "creative_play": 0.14, "scene_visuals": 0.16}'::jsonb,
    match_count INT DEFAULT 20
)
RETURNS TABLE(
    -- 返回原表所有字段
    id BIGINT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    image_url TEXT,
    title TEXT,
    original_description TEXT,
    original_embedding VECTOR(1536),
    theme_philosophy TEXT,
    action_process TEXT,
    interpersonal_roles TEXT,
    edu_value TEXT,
    learning_strategy TEXT,
    creative_play TEXT,
    scene_visuals TEXT,
    theme_philosophy_embedding VECTOR(1536),
    action_process_embedding VECTOR(1536),
    interpersonal_roles_embedding VECTOR(1536),
    edu_value_embedding VECTOR(1536),
    learning_strategy_embedding VECTOR(1536),
    creative_play_embedding VECTOR(1536),
    scene_visuals_embedding VECTOR(1536),
    -- 新增的最终得分字段
    final_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        i.created_at,
        i.updated_at,
        i.image_url,
        i.title,
        i.original_description,
        i.original_embedding,
        i.theme_philosophy,
        i.action_process,
        i.interpersonal_roles,
        i.edu_value,
        i.learning_strategy,
        i.creative_play,
        i.scene_visuals,
        i.theme_philosophy_embedding,
        i.action_process_embedding,
        i.interpersonal_roles_embedding,
        i.edu_value_embedding,
        i.learning_strategy_embedding,
        i.creative_play_embedding,
        i.scene_visuals_embedding,
        -- 计算加权相似度得分（相似度 = 1 - 距离）
        (
            -- 主题哲学权重计算
            COALESCE((1 - (query_embedding <=> i.theme_philosophy_embedding)) * 
                COALESCE((weights->>'philosophy')::FLOAT, 0), 0) +
            
            -- 行动过程权重计算
            COALESCE((1 - (query_embedding <=> i.action_process_embedding)) * 
                COALESCE((weights->>'action_process')::FLOAT, 0), 0) +
            
            -- 人际角色权重计算
            COALESCE((1 - (query_embedding <=> i.interpersonal_roles_embedding)) * 
                COALESCE((weights->>'interpersonal_roles')::FLOAT, 0), 0) +
            
            -- 教育价值权重计算
            COALESCE((1 - (query_embedding <=> i.edu_value_embedding)) * 
                COALESCE((weights->>'edu_value')::FLOAT, 0), 0) +
            
            -- 学习策略权重计算
            COALESCE((1 - (query_embedding <=> i.learning_strategy_embedding)) * 
                COALESCE((weights->>'learning_strategy')::FLOAT, 0), 0) +
            
            -- 创意游戏权重计算
            COALESCE((1 - (query_embedding <=> i.creative_play_embedding)) * 
                COALESCE((weights->>'creative_play')::FLOAT, 0), 0) +
            
            -- 场景视觉权重计算
            COALESCE((1 - (query_embedding <=> i.scene_visuals_embedding)) * 
                COALESCE((weights->>'scene_visuals')::FLOAT, 0), 0)
        ) AS final_score
    FROM illustrations_optimized i
    WHERE 
        -- 确保所有必要的向量字段都不为空
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

-- 添加函数注释
COMMENT ON FUNCTION weighted_semantic_search(VECTOR(1536), JSONB, INT) IS 
'高级加权语义搜索函数：
- 基于7个主题向量字段进行相似度计算
- 支持自定义权重配置
- 返回加权后的最终得分排序结果
- 使用余弦距离计算相似度（1-距离=相似度）';

-- 使用示例：
/*
-- 1. 基本使用（使用默认权重）
SELECT * FROM weighted_semantic_search(
    '[0.1, 0.2, ...]'::vector(1536),  -- 查询向量
    DEFAULT,                           -- 使用默认权重
    10                                -- 返回前10条记录
);

-- 2. 自定义权重使用
SELECT * FROM weighted_semantic_search(
    '[0.1, 0.2, ...]'::vector(1536),
    '{"philosophy": 0.4, "action_process": 0.2, "interpersonal_roles": 0.1, "edu_value": 0.1, "learning_strategy": 0.1, "creative_play": 0.05, "scene_visuals": 0.05}'::jsonb,
    15
);

-- 3. 只查看得分和标题
SELECT title, final_score 
FROM weighted_semantic_search(
    '[0.1, 0.2, ...]'::vector(1536),
    '{"philosophy": 0.3, "edu_value": 0.3, "learning_strategy": 0.4}'::jsonb,
    5
);
*/