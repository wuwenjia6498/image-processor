-- 使用改进质量评分算法重新创建精选集
-- 完全基于内容质量，不依赖字数长度

-- 1. 重新筛选精选集
CREATE OR REPLACE FUNCTION select_premium_with_improved_scoring(target_count INT DEFAULT 300)
RETURNS TABLE(
    selected_count INT,
    avg_quality_score FLOAT,
    selection_summary TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    total_available INT;
    books_covered INT;
BEGIN
    -- 检查可用数据
    SELECT COUNT(*) INTO total_available 
    FROM illustrations_optimized 
    WHERE original_description IS NOT NULL AND LENGTH(original_description) > 50;
    
    RAISE NOTICE '📊 可用图片总数: %', total_available;
    
    -- 清空精选表
    TRUNCATE illustrations_premium;
    
    -- 使用改进的质量评分进行筛选
    WITH improved_quality_scored AS (
        SELECT *,
            -- 改进的质量评分算法
            (
                -- 视觉描述丰富度 (30%)
                (
                    CASE WHEN original_description ~* '(红色|蓝色|绿色|黄色|紫色|橙色|粉色|白色|黑色|灰色)' THEN 0.08 ELSE 0 END +
                    CASE WHEN original_description ~* '(明亮|暗淡|鲜艳|柔和|温暖|冷色|亮丽|深色|浅色)' THEN 0.06 ELSE 0 END +
                    CASE WHEN original_description ~* '(光线|阳光|阴影|灯光|月光|星光|闪闪发光)' THEN 0.06 ELSE 0 END +
                    CASE WHEN original_description ~* '(大小|高低|粗细|长短|宽窄|厚薄)' THEN 0.05 ELSE 0 END +
                    CASE WHEN original_description ~* '(圆形|方形|三角|椭圆|弯曲|直线|形状)' THEN 0.05 ELSE 0 END
                ) * 0.3 +
                
                -- 情感表达深度 (25%)
                (
                    CASE WHEN original_description ~* '(开心|快乐|高兴|兴奋|愉悦|欢乐|喜悦)' THEN 0.08 ELSE 0 END +
                    CASE WHEN original_description ~* '(温馨|温暖|舒适|安全|放松|宁静|平静)' THEN 0.08 ELSE 0 END +
                    CASE WHEN original_description ~* '(惊讶|好奇|疑惑|思考|专注|认真)' THEN 0.06 ELSE 0 END +
                    CASE WHEN original_description ~* '(友爱|关爱|互助|分享|合作|陪伴)' THEN 0.03 ELSE 0 END
                ) * 0.25 +
                
                -- 动作行为多样性 (20%)
                (
                    CASE WHEN original_description ~* '(跑步|走路|跳跃|爬行|飞翔|游泳|骑行)' THEN 0.07 ELSE 0 END +
                    CASE WHEN original_description ~* '(玩耍|游戏|探索|发现|寻找|观察)' THEN 0.06 ELSE 0 END +
                    CASE WHEN original_description ~* '(拥抱|握手|亲吻|拍手|挥手|指向)' THEN 0.04 ELSE 0 END +
                    CASE WHEN original_description ~* '(说话|唱歌|笑声|呼喊|窃窃私语)' THEN 0.03 ELSE 0 END
                ) * 0.2 +
                
                -- 场景环境丰富度 (15%)
                (
                    CASE WHEN original_description ~* '(森林|海洋|山川|草原|花园|公园|城市)' THEN 0.05 ELSE 0 END +
                    CASE WHEN original_description ~* '(房间|客厅|卧室|厨房|学校|图书馆)' THEN 0.04 ELSE 0 END +
                    CASE WHEN original_description ~* '(天空|云朵|太阳|月亮|星星|彩虹)' THEN 0.03 ELSE 0 END +
                    CASE WHEN original_description ~* '(树木|花朵|草地|石头|河流|小路)' THEN 0.03 ELSE 0 END
                ) * 0.15 +
                
                -- 教育启发价值 (10%)
                (
                    CASE WHEN original_description ~* '(学习|知识|技能|成长|进步|提高)' THEN 0.04 ELSE 0 END +
                    CASE WHEN original_description ~* '(思考|理解|发现|创造|想象|创新)' THEN 0.03 ELSE 0 END +
                    CASE WHEN original_description ~* '(问题|解决|方法|尝试|努力|坚持)' THEN 0.03 ELSE 0 END
                ) * 0.1
            ) as improved_quality_score,
            
            -- 多样性评分：确保不同书籍的均衡分布
            ROW_NUMBER() OVER (PARTITION BY book_title ORDER BY 
                (
                    -- 使用相同的改进评分算法排序
                    (
                        CASE WHEN original_description ~* '(红色|蓝色|绿色|黄色|紫色|橙色|粉色|白色|黑色|灰色)' THEN 0.08 ELSE 0 END +
                        CASE WHEN original_description ~* '(明亮|暗淡|鲜艳|柔和|温暖|冷色|亮丽|深色|浅色)' THEN 0.06 ELSE 0 END +
                        CASE WHEN original_description ~* '(光线|阳光|阴影|灯光|月光|星光|闪闪发光)' THEN 0.06 ELSE 0 END +
                        CASE WHEN original_description ~* '(大小|高低|粗细|长短|宽窄|厚薄)' THEN 0.05 ELSE 0 END +
                        CASE WHEN original_description ~* '(圆形|方形|三角|椭圆|弯曲|直线|形状)' THEN 0.05 ELSE 0 END
                    ) * 0.3 +
                    (
                        CASE WHEN original_description ~* '(开心|快乐|高兴|兴奋|愉悦|欢乐|喜悦)' THEN 0.08 ELSE 0 END +
                        CASE WHEN original_description ~* '(温馨|温暖|舒适|安全|放松|宁静|平静)' THEN 0.08 ELSE 0 END +
                        CASE WHEN original_description ~* '(惊讶|好奇|疑惑|思考|专注|认真)' THEN 0.06 ELSE 0 END +
                        CASE WHEN original_description ~* '(友爱|关爱|互助|分享|合作|陪伴)' THEN 0.03 ELSE 0 END
                    ) * 0.25 +
                    (
                        CASE WHEN original_description ~* '(跑步|走路|跳跃|爬行|飞翔|游泳|骑行)' THEN 0.07 ELSE 0 END +
                        CASE WHEN original_description ~* '(玩耍|游戏|探索|发现|寻找|观察)' THEN 0.06 ELSE 0 END +
                        CASE WHEN original_description ~* '(拥抱|握手|亲吻|拍手|挥手|指向)' THEN 0.04 ELSE 0 END +
                        CASE WHEN original_description ~* '(说话|唱歌|笑声|呼喊|窃窃私语)' THEN 0.03 ELSE 0 END
                    ) * 0.2 +
                    (
                        CASE WHEN original_description ~* '(森林|海洋|山川|草原|花园|公园|城市)' THEN 0.05 ELSE 0 END +
                        CASE WHEN original_description ~* '(房间|客厅|卧室|厨房|学校|图书馆)' THEN 0.04 ELSE 0 END +
                        CASE WHEN original_description ~* '(天空|云朵|太阳|月亮|星星|彩虹)' THEN 0.03 ELSE 0 END +
                        CASE WHEN original_description ~* '(树木|花朵|草地|石头|河流|小路)' THEN 0.03 ELSE 0 END
                    ) * 0.15 +
                    (
                        CASE WHEN original_description ~* '(学习|知识|技能|成长|进步|提高)' THEN 0.04 ELSE 0 END +
                        CASE WHEN original_description ~* '(思考|理解|发现|创造|想象|创新)' THEN 0.03 ELSE 0 END +
                        CASE WHEN original_description ~* '(问题|解决|方法|尝试|努力|坚持)' THEN 0.03 ELSE 0 END
                    ) * 0.1
                ) DESC
            ) as book_rank
        FROM illustrations_optimized 
        WHERE original_description IS NOT NULL 
            AND LENGTH(original_description) > 50
    ),
    
    -- 分层抽样：质量优先，但保持基本多样性
    diversified_selection AS (
        SELECT *,
            -- 多样性评分
            CASE 
                WHEN book_rank <= 8 THEN 1.0   -- 每本书前8张
                WHEN book_rank <= 15 THEN 0.8  -- 每本书9-15张
                WHEN book_rank <= 25 THEN 0.6  -- 每本书16-25张
                ELSE 0.4  -- 其他
            END as diversity_score
        FROM improved_quality_scored
        WHERE book_rank <= 30  -- 每本书最多30张候选
    ),
    
    -- 最终排序
    final_ranking AS (
        SELECT *,
            -- 质量优先：85%质量 + 15%多样性
            (improved_quality_score * 0.85 + diversity_score * 0.15) as final_score,
            CASE 
                WHEN improved_quality_score >= 0.15 THEN '优秀质量'
                WHEN improved_quality_score >= 0.12 THEN '良好质量'
                WHEN improved_quality_score >= 0.09 THEN '中等质量'
                WHEN diversity_score >= 0.8 THEN '多样性补充'
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
        selection_reason, improved_quality_score, diversity_score
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
    
    RAISE NOTICE '✅ 改进算法精选完成: % 张图片，覆盖 % 本书', selected_count, books_covered;
    RAISE NOTICE '📊 平均质量评分: %', ROUND(avg_quality_score::numeric, 3);
END;
$$;

-- 2. 执行改进算法的精选
SELECT '🎯 使用改进算法重新筛选精选集...' as info;
SELECT * FROM select_premium_with_improved_scoring(300);

-- 3. 显示新精选集的质量分布
SELECT '📊 改进算法精选集质量分布:' as info;
SELECT 
    CASE 
        WHEN quality_score >= 0.15 THEN '优秀 (0.15+)'
        WHEN quality_score >= 0.12 THEN '良好 (0.12-0.15)'
        WHEN quality_score >= 0.09 THEN '中等 (0.09-0.12)'
        WHEN quality_score >= 0.06 THEN '一般 (0.06-0.09)'
        ELSE '待改进 (<0.06)'
    END as quality_level,
    COUNT(*) as count,
    ROUND((COUNT(*) * 100.0 / 300)::numeric, 1) as percentage
FROM illustrations_premium
GROUP BY 
    CASE 
        WHEN quality_score >= 0.15 THEN '优秀 (0.15+)'
        WHEN quality_score >= 0.12 THEN '良好 (0.12-0.15)'
        WHEN quality_score >= 0.09 THEN '中等 (0.09-0.12)'
        WHEN quality_score >= 0.06 THEN '一般 (0.06-0.09)'
        ELSE '待改进 (<0.06)'
    END
ORDER BY count DESC;

-- 4. 显示各书籍分布（现在应该有明显差异）
SELECT '📚 各书籍精选分布（按质量排序）:' as info;
SELECT 
    book_title,
    COUNT(*) as selected_count,
    ROUND(AVG(quality_score)::numeric, 3) as avg_quality,
    ROUND(MIN(quality_score)::numeric, 3) as min_quality,
    ROUND(MAX(quality_score)::numeric, 3) as max_quality,
    string_agg(DISTINCT selection_reason, ', ') as reasons
FROM illustrations_premium 
GROUP BY book_title 
ORDER BY AVG(quality_score) DESC, selected_count DESC
LIMIT 15;

-- 添加注释
COMMENT ON FUNCTION select_premium_with_improved_scoring(INT) IS 
'改进算法的精选图片筛选：
- 完全基于内容质量，不依赖字数长度
- 5维度质量评分：视觉30% + 情感25% + 动作20% + 场景15% + 教育10%
- 质量权重85%，多样性权重15%
- 每本书最多30张候选，确保高质量图片优先
- 提供真正有区分度的质量评分'; 