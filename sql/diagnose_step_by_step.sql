-- 分步骤诊断质量评分问题
-- 请按顺序逐个执行以下查询

-- 步骤1：检查数据总量
SELECT '步骤1：数据总量检查' as step;
SELECT 
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE original_description IS NOT NULL) as has_description,
    COUNT(*) FILTER (WHERE original_description IS NULL) as no_description,
    ROUND(AVG(LENGTH(original_description))::numeric, 1) as avg_description_length
FROM illustrations_optimized;

-- 步骤2：描述长度分布
SELECT '步骤2：描述长度分布' as step;
SELECT 
    CASE 
        WHEN LENGTH(original_description) >= 500 THEN '长描述(500+)'
        WHEN LENGTH(original_description) >= 300 THEN '中等描述(300-500)'
        WHEN LENGTH(original_description) >= 150 THEN '短描述(150-300)'
        ELSE '极短描述(<150)'
    END as length_category,
    COUNT(*) as count,
    ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM illustrations_optimized WHERE original_description IS NOT NULL))::numeric, 1) as percentage
FROM illustrations_optimized 
WHERE original_description IS NOT NULL
GROUP BY 
    CASE 
        WHEN LENGTH(original_description) >= 500 THEN '长描述(500+)'
        WHEN LENGTH(original_description) >= 300 THEN '中等描述(300-500)'
        WHEN LENGTH(original_description) >= 150 THEN '短描述(150-300)'
        ELSE '极短描述(<150)'
    END
ORDER BY count DESC;

-- 步骤3：关键词匹配率分析
SELECT '步骤3：关键词匹配率' as step;
SELECT 
    '颜色相关' as keyword_type,
    COUNT(*) FILTER (WHERE original_description ~* '(颜色|色彩|明亮|温暖|柔和|鲜艳|彩色|色调)') as match_count,
    ROUND((COUNT(*) FILTER (WHERE original_description ~* '(颜色|色彩|明亮|温暖|柔和|鲜艳|彩色|色调)') * 100.0 / COUNT(*))::numeric, 1) as match_percentage
FROM illustrations_optimized WHERE original_description IS NOT NULL;

-- 步骤4：当前质量评分分布
SELECT '步骤4：当前质量评分分布' as step;
WITH scores AS (
    SELECT 
        (
            LEAST(LENGTH(original_description) / 400.0, 1.0) * 0.35 +
            (
                CASE WHEN original_description ~* '(颜色|色彩|明亮|温暖|柔和|鲜艳|彩色|色调)' THEN 0.15 ELSE 0 END +
                CASE WHEN original_description ~* '(情感|感受|心情|快乐|温馨|友爱|开心|愉悦|兴奋)' THEN 0.15 ELSE 0 END +
                CASE WHEN original_description ~* '(动作|行为|活动|玩耍|学习|探索|奔跑|跳跃|互动)' THEN 0.1 ELSE 0 END
            ) * 0.4 +
            CASE WHEN original_description ~* '(学习|教育|成长|发展|技能|知识|启发|思考)' THEN 0.15 ELSE 0 END +
            CASE WHEN original_description ~* '(背景|环境|场景|地点|空间|房间|户外|室内)' THEN 0.1 ELSE 0 END
        ) as quality_score
    FROM illustrations_optimized 
    WHERE original_description IS NOT NULL
)
SELECT 
    COUNT(*) as total_count,
    ROUND(MIN(quality_score)::numeric, 3) as min_score,
    ROUND(MAX(quality_score)::numeric, 3) as max_score,
    ROUND(AVG(quality_score)::numeric, 3) as avg_score,
    ROUND((MAX(quality_score) - MIN(quality_score))::numeric, 3) as score_range
FROM scores;

-- 步骤5：查看具体样本
SELECT '步骤5：最高质量样本' as step;
WITH quality_samples AS (
    SELECT 
        book_title,
        filename,
        LENGTH(original_description) as desc_length,
        LEFT(original_description, 150) as desc_sample,
        (
            LEAST(LENGTH(original_description) / 400.0, 1.0) * 0.35 +
            (
                CASE WHEN original_description ~* '(颜色|色彩|明亮|温暖|柔和|鲜艳|彩色|色调)' THEN 0.15 ELSE 0 END +
                CASE WHEN original_description ~* '(情感|感受|心情|快乐|温馨|友爱|开心|愉悦|兴奋)' THEN 0.15 ELSE 0 END +
                CASE WHEN original_description ~* '(动作|行为|活动|玩耍|学习|探索|奔跑|跳跃|互动)' THEN 0.1 ELSE 0 END
            ) * 0.4 +
            CASE WHEN original_description ~* '(学习|教育|成长|发展|技能|知识|启发|思考)' THEN 0.15 ELSE 0 END +
            CASE WHEN original_description ~* '(背景|环境|场景|地点|空间|房间|户外|室内)' THEN 0.1 ELSE 0 END
        ) as quality_score
    FROM illustrations_optimized 
    WHERE original_description IS NOT NULL
    ORDER BY quality_score DESC
    LIMIT 3
)
SELECT book_title, filename, desc_length, ROUND(quality_score::numeric, 3) as score, desc_sample
FROM quality_samples; 