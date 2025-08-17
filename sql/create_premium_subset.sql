-- 创建精选子集：从3000张图片中智能筛选300张高质量图片
-- 用于优先进行7维度向量化处理

-- 1. 创建精选图片表
CREATE TABLE IF NOT EXISTS illustrations_premium (
    LIKE illustrations_optimized INCLUDING ALL
);

-- 添加筛选标记字段
ALTER TABLE illustrations_premium 
ADD COLUMN IF NOT EXISTS selection_reason TEXT,
ADD COLUMN IF NOT EXISTS quality_score FLOAT,
ADD COLUMN IF NOT EXISTS diversity_score FLOAT;

-- 2. 创建智能筛选函数
CREATE OR REPLACE FUNCTION select_premium_illustrations(target_count INT DEFAULT 300)
RETURNS TABLE(
    selected_count INT,
    avg_quality_score FLOAT,
    selection_summary TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    total_available INT;
    description_length_threshold INT;
    books_covered INT;
BEGIN
    -- 检查可用数据
    SELECT COUNT(*) INTO total_available 
    FROM illustrations_optimized 
    WHERE original_description IS NOT NULL AND LENGTH(original_description) > 50;
    
    RAISE NOTICE '📊 可用图片总数: %', total_available;
    
    -- 清空精选表
    TRUNCATE illustrations_premium;
    
    -- 动态计算描述长度阈值（选择描述较长的图片，通常质量更高）
    SELECT PERCENTILE_CONT(0.7) WITHIN GROUP (ORDER BY LENGTH(original_description)) 
    INTO description_length_threshold
    FROM illustrations_optimized 
    WHERE original_description IS NOT NULL;
    
    RAISE NOTICE '📏 描述长度阈值: % 字符', description_length_threshold;
    
    -- 多维度筛选策略
    WITH quality_scored AS (
        SELECT *,
            -- 质量评分：基于描述长度、内容丰富度
            (
                -- 描述长度权重 (40%)
                LEAST(LENGTH(original_description) / 500.0, 1.0) * 0.4 +
                -- 内容丰富度权重 (30%) - 包含更多描述性词汇
                (
                    CASE 
                        WHEN original_description ~* '(颜色|色彩|明亮|温暖|柔和|鲜艳)' THEN 0.1 ELSE 0 END +
                    CASE 
                        WHEN original_description ~* '(情感|感受|心情|快乐|温馨|友爱)' THEN 0.1 ELSE 0 END +
                    CASE 
                        WHEN original_description ~* '(动作|行为|活动|玩耍|学习|探索)' THEN 0.1 ELSE 0 END
                ) * 0.3 +
                -- 教育价值权重 (20%)
                CASE 
                    WHEN original_description ~* '(学习|教育|成长|发展|技能|知识)' THEN 0.2 ELSE 0 END +
                -- 场景丰富度权重 (10%)
                CASE 
                    WHEN original_description ~* '(背景|环境|场景|地点|空间)' THEN 0.1 ELSE 0 END
            ) as quality_score,
            
            -- 多样性评分：确保不同书籍、不同主题的均衡分布
            ROW_NUMBER() OVER (PARTITION BY book_title ORDER BY LENGTH(original_description) DESC) as book_rank
        FROM illustrations_optimized 
        WHERE original_description IS NOT NULL 
            AND LENGTH(original_description) >= description_length_threshold
    ),
    
    -- 分层抽样：每本书最多选择一定数量，确保多样性
    diversified_selection AS (
        SELECT *,
            -- 多样性评分
            CASE 
                WHEN book_rank <= 3 THEN 1.0  -- 每本书前3张
                WHEN book_rank <= 6 THEN 0.8  -- 每本书4-6张
                ELSE 0.5  -- 其他
            END as diversity_score
        FROM quality_scored
        WHERE book_rank <= 10  -- 每本书最多10张候选
    ),
    
    -- 综合评分排序
    final_ranking AS (
        SELECT *,
            (quality_score * 0.7 + diversity_score * 0.3) as final_score,
            CASE 
                WHEN quality_score >= 0.8 THEN '高质量描述'
                WHEN diversity_score >= 0.8 THEN '多样性补充'
                WHEN LENGTH(original_description) >= description_length_threshold * 1.5 THEN '详细描述'
                ELSE '综合评估'
            END as selection_reason
        FROM diversified_selection
    )
    
    -- 插入精选结果
    INSERT INTO illustrations_premium 
    SELECT 
        id, filename, book_title, original_description, image_url, created_at, updated_at,
        theme_philosophy, action_process, interpersonal_roles, 
        edu_value, learning_strategy, creative_play, scene_visuals,
        theme_philosophy_embedding, action_process_embedding, 
        interpersonal_roles_embedding, edu_value_embedding,
        learning_strategy_embedding, creative_play_embedding, 
        scene_visuals_embedding, original_embedding,
        selection_reason, quality_score, diversity_score
    FROM final_ranking
    ORDER BY final_score DESC
    LIMIT target_count;
    
    -- 统计结果
    SELECT COUNT(*) INTO selected_count FROM illustrations_premium;
    
    SELECT AVG(quality_score) INTO avg_quality_score FROM illustrations_premium;
    
    SELECT COUNT(DISTINCT book_title) INTO books_covered FROM illustrations_premium;
    
    -- 返回统计信息
    RETURN QUERY SELECT 
        selected_count,
        avg_quality_score,
        FORMAT('已选择 %s 张图片，覆盖 %s 本书籍，平均质量评分: %s', 
               selected_count, books_covered, ROUND(avg_quality_score::numeric, 3));
    
    RAISE NOTICE '✅ 精选完成: % 张图片，覆盖 % 本书', selected_count, books_covered;
    RAISE NOTICE '📊 平均质量评分: %', ROUND(avg_quality_score::numeric, 3);
END;
$$;

-- 3. 创建精选表的向量索引（为后续7维度处理优化）
CREATE INDEX IF NOT EXISTS idx_premium_theme_philosophy_embedding 
ON illustrations_premium USING ivfflat (theme_philosophy_embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_premium_action_process_embedding 
ON illustrations_premium USING ivfflat (action_process_embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_premium_interpersonal_roles_embedding 
ON illustrations_premium USING ivfflat (interpersonal_roles_embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_premium_edu_value_embedding 
ON illustrations_premium USING ivfflat (edu_value_embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_premium_learning_strategy_embedding 
ON illustrations_premium USING ivfflat (learning_strategy_embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_premium_creative_play_embedding 
ON illustrations_premium USING ivfflat (creative_play_embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_premium_scene_visuals_embedding 
ON illustrations_premium USING ivfflat (scene_visuals_embedding vector_cosine_ops);

-- 4. 创建针对精选集的优化搜索函数
CREATE OR REPLACE FUNCTION weighted_semantic_search_premium(
    query_embedding VECTOR(1536),
    weights JSONB DEFAULT '{"philosophy": 0.14, "action_process": 0.14, "interpersonal_roles": 0.14, "edu_value": 0.14, "learning_strategy": 0.14, "creative_play": 0.14, "scene_visuals": 0.16}'::jsonb,
    match_count INT DEFAULT 20,
    similarity_threshold FLOAT DEFAULT 0.02  -- 更低阈值，因为数据量小
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
    -- 精选集查询超时可以更短
    SET LOCAL statement_timeout = '10s';
    SET LOCAL work_mem = '128MB';
    
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
        -- 7维度加权计算
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
        i.quality_score,
        i.selection_reason
    FROM illustrations_premium i
    WHERE 
        -- 确保至少有一个向量
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

-- 5. 执行精选操作
SELECT '🎯 开始精选高质量图片...' as info;
SELECT * FROM select_premium_illustrations(300);

-- 6. 显示精选结果统计
SELECT '📊 精选结果统计:' as info;
SELECT 
    COUNT(*) as total_selected,
    COUNT(DISTINCT book_title) as books_covered,
    AVG(quality_score) as avg_quality,
    COUNT(*) FILTER (WHERE selection_reason = '高质量描述') as high_quality_count,
    COUNT(*) FILTER (WHERE selection_reason = '多样性补充') as diversity_count
FROM illustrations_premium;

-- 7. 显示各书籍分布
SELECT '📚 各书籍精选分布:' as info;
SELECT 
    book_title,
    COUNT(*) as selected_count,
    AVG(quality_score) as avg_quality,
    string_agg(DISTINCT selection_reason, ', ') as reasons
FROM illustrations_premium 
GROUP BY book_title 
ORDER BY selected_count DESC, avg_quality DESC
LIMIT 10;

-- 添加注释
COMMENT ON FUNCTION select_premium_illustrations(INT) IS 
'智能筛选精选图片集合：
- 基于描述质量、内容丰富度、教育价值多维度评分
- 确保不同书籍的均衡分布
- 优先选择高质量、详细的描述内容
- 为7维度向量化处理提供优质数据源';

COMMENT ON FUNCTION weighted_semantic_search_premium(VECTOR(1536), JSONB, INT, FLOAT) IS 
'精选集专用加权搜索函数：
- 针对300张精选图片优化
- 10秒超时，快速响应
- 返回质量评分和筛选原因
- 充分利用7维度向量数据'; 