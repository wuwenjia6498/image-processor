-- 调整精选集筛选策略：更注重质量优先
-- 重新筛选300张图片，提高质量权重

-- 1. 创建调整后的筛选函数
CREATE OR REPLACE FUNCTION select_premium_illustrations_quality_first(target_count INT DEFAULT 300)
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
    
    -- 动态计算描述长度阈值（降低阈值，包含更多候选）
    SELECT PERCENTILE_CONT(0.6) WITHIN GROUP (ORDER BY LENGTH(original_description)) 
    INTO description_length_threshold
    FROM illustrations_optimized 
    WHERE original_description IS NOT NULL;
    
    RAISE NOTICE '📏 描述长度阈值: % 字符', description_length_threshold;
    
    -- 质量优先的筛选策略
    WITH quality_scored AS (
        SELECT *,
            -- 增强质量评分：更注重内容质量
            (
                -- 描述长度权重 (35%) - 略微降低
                LEAST(LENGTH(original_description) / 400.0, 1.0) * 0.35 +
                -- 内容丰富度权重 (40%) - 提高权重
                (
                    CASE 
                        WHEN original_description ~* '(颜色|色彩|明亮|温暖|柔和|鲜艳|彩色|色调)' THEN 0.15 ELSE 0 END +
                    CASE 
                        WHEN original_description ~* '(情感|感受|心情|快乐|温馨|友爱|开心|愉悦|兴奋)' THEN 0.15 ELSE 0 END +
                    CASE 
                        WHEN original_description ~* '(动作|行为|活动|玩耍|学习|探索|奔跑|跳跃|互动)' THEN 0.1 ELSE 0 END
                ) * 0.4 +
                -- 教育价值权重 (15%) - 保持
                CASE 
                    WHEN original_description ~* '(学习|教育|成长|发展|技能|知识|启发|思考)' THEN 0.15 ELSE 0 END +
                -- 场景丰富度权重 (10%) - 保持
                CASE 
                    WHEN original_description ~* '(背景|环境|场景|地点|空间|房间|户外|室内)' THEN 0.1 ELSE 0 END
            ) as quality_score,
            
            -- 多样性评分：适度放宽，允许质量高的书籍多选
            ROW_NUMBER() OVER (PARTITION BY book_title ORDER BY LENGTH(original_description) DESC) as book_rank
        FROM illustrations_optimized 
        WHERE original_description IS NOT NULL 
            AND LENGTH(original_description) >= description_length_threshold
    ),
    
    -- 分层抽样：质量优先，但保持基本多样性
    diversified_selection AS (
        SELECT *,
            -- 调整多样性评分：质量高的可以多选
            CASE 
                WHEN book_rank <= 5 THEN 1.0   -- 每本书前5张
                WHEN book_rank <= 8 THEN 0.8   -- 每本书6-8张
                WHEN book_rank <= 12 THEN 0.6  -- 每本书9-12张
                ELSE 0.4  -- 其他
            END as diversity_score
        FROM quality_scored
        WHERE book_rank <= 15  -- 每本书最多15张候选
    ),
    
    -- 质量优先的综合评分
    final_ranking AS (
        SELECT *,
            -- 提高质量权重：80%质量 + 20%多样性
            (quality_score * 0.8 + diversity_score * 0.2) as final_score,
            CASE 
                WHEN quality_score >= 0.7 THEN '高质量描述'      -- 降低阈值
                WHEN quality_score >= 0.5 THEN '中等质量描述'
                WHEN diversity_score >= 0.8 THEN '多样性补充'
                WHEN LENGTH(original_description) >= description_length_threshold * 1.3 THEN '详细描述'
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
    
    RAISE NOTICE '✅ 质量优先精选完成: % 张图片，覆盖 % 本书', selected_count, books_covered;
    RAISE NOTICE '📊 平均质量评分: %', ROUND(avg_quality_score::numeric, 3);
END;
$$;

-- 2. 执行质量优先的精选
SELECT '🎯 开始质量优先精选...' as info;
SELECT * FROM select_premium_illustrations_quality_first(300);

-- 3. 显示新的精选结果统计
SELECT '📊 质量优先精选结果统计:' as info;
SELECT 
    COUNT(*) as total_selected,
    COUNT(DISTINCT book_title) as books_covered,
    AVG(quality_score) as avg_quality,
    COUNT(*) FILTER (WHERE selection_reason = '高质量描述') as high_quality_count,
    COUNT(*) FILTER (WHERE selection_reason = '中等质量描述') as medium_quality_count,
    COUNT(*) FILTER (WHERE selection_reason = '多样性补充') as diversity_count,
    COUNT(*) FILTER (WHERE selection_reason = '详细描述') as detailed_count
FROM illustrations_premium;

-- 4. 显示各书籍分布（现在应该更有差异）
SELECT '📚 质量优先各书籍精选分布:' as info;
SELECT 
    book_title,
    COUNT(*) as selected_count,
    ROUND(AVG(quality_score)::numeric, 3) as avg_quality,
    string_agg(DISTINCT selection_reason, ', ') as reasons
FROM illustrations_premium 
GROUP BY book_title 
ORDER BY AVG(quality_score) DESC, selected_count DESC
LIMIT 15;

-- 5. 显示质量评分分布
SELECT '📈 质量评分分布:' as info;
SELECT 
    CASE 
        WHEN quality_score >= 0.9 THEN '优秀 (0.9+)'
        WHEN quality_score >= 0.8 THEN '良好 (0.8-0.9)'
        WHEN quality_score >= 0.7 THEN '中等 (0.7-0.8)'
        WHEN quality_score >= 0.6 THEN '一般 (0.6-0.7)'
        ELSE '待改进 (<0.6)'
    END as quality_level,
    COUNT(*) as count,
    ROUND((COUNT(*) * 100.0 / 300)::numeric, 1) as percentage
FROM illustrations_premium
GROUP BY 
    CASE 
        WHEN quality_score >= 0.9 THEN '优秀 (0.9+)'
        WHEN quality_score >= 0.8 THEN '良好 (0.8-0.9)'
        WHEN quality_score >= 0.7 THEN '中等 (0.7-0.8)'
        WHEN quality_score >= 0.6 THEN '一般 (0.6-0.7)'
        ELSE '待改进 (<0.6)'
    END
ORDER BY quality_level DESC;

-- 添加注释
COMMENT ON FUNCTION select_premium_illustrations_quality_first(INT) IS 
'质量优先的精选图片筛选：
- 质量权重80%，多样性权重20%
- 降低高质量描述阈值到0.7
- 增强内容丰富度评分权重
- 允许高质量书籍选择更多图片
- 提供更详细的质量分级'; 