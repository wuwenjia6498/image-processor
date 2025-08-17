-- 诊断质量评分算法问题
-- 分析为什么所有图片质量评分都在0.7-0.8区间

-- 1. 分析原始描述数据的分布
SELECT '📊 原始描述长度分布:' as info;
SELECT 
    CASE 
        WHEN LENGTH(original_description) >= 500 THEN '长描述 (500+字符)'
        WHEN LENGTH(original_description) >= 300 THEN '中等描述 (300-500字符)'
        WHEN LENGTH(original_description) >= 150 THEN '短描述 (150-300字符)'
        ELSE '极短描述 (<150字符)'
    END as length_category,
    COUNT(*) as count,
    ROUND(AVG(LENGTH(original_description))::numeric, 1) as avg_length,
    MIN(LENGTH(original_description)) as min_length,
    MAX(LENGTH(original_description)) as max_length
FROM illustrations_optimized 
WHERE original_description IS NOT NULL
GROUP BY 
    CASE 
        WHEN LENGTH(original_description) >= 500 THEN '长描述 (500+字符)'
        WHEN LENGTH(original_description) >= 300 THEN '中等描述 (300-500字符)'
        WHEN LENGTH(original_description) >= 150 THEN '短描述 (150-300字符)'
        ELSE '极短描述 (<150字符)'
    END
ORDER BY avg_length DESC;

-- 2. 分析关键词匹配情况
SELECT '🔍 关键词匹配分析:' as info;
SELECT 
    '颜色相关' as keyword_type,
    COUNT(*) FILTER (WHERE original_description ~* '(颜色|色彩|明亮|温暖|柔和|鲜艳|彩色|色调)') as match_count,
    ROUND((COUNT(*) FILTER (WHERE original_description ~* '(颜色|色彩|明亮|温暖|柔和|鲜艳|彩色|色调)') * 100.0 / COUNT(*))::numeric, 1) as match_percentage
FROM illustrations_optimized 
WHERE original_description IS NOT NULL

UNION ALL

SELECT 
    '情感相关' as keyword_type,
    COUNT(*) FILTER (WHERE original_description ~* '(情感|感受|心情|快乐|温馨|友爱|开心|愉悦|兴奋)') as match_count,
    ROUND((COUNT(*) FILTER (WHERE original_description ~* '(情感|感受|心情|快乐|温馨|友爱|开心|愉悦|兴奋)') * 100.0 / COUNT(*))::numeric, 1) as match_percentage
FROM illustrations_optimized 
WHERE original_description IS NOT NULL

UNION ALL

SELECT 
    '动作相关' as keyword_type,
    COUNT(*) FILTER (WHERE original_description ~* '(动作|行为|活动|玩耍|学习|探索|奔跑|跳跃|互动)') as match_count,
    ROUND((COUNT(*) FILTER (WHERE original_description ~* '(动作|行为|活动|玩耍|学习|探索|奔跑|跳跃|互动)') * 100.0 / COUNT(*))::numeric, 1) as match_percentage
FROM illustrations_optimized 
WHERE original_description IS NOT NULL

UNION ALL

SELECT 
    '教育相关' as keyword_type,
    COUNT(*) FILTER (WHERE original_description ~* '(学习|教育|成长|发展|技能|知识|启发|思考)') as match_count,
    ROUND((COUNT(*) FILTER (WHERE original_description ~* '(学习|教育|成长|发展|技能|知识|启发|思考)') * 100.0 / COUNT(*))::numeric, 1) as match_percentage
FROM illustrations_optimized 
WHERE original_description IS NOT NULL

UNION ALL

SELECT 
    '场景相关' as keyword_type,
    COUNT(*) FILTER (WHERE original_description ~* '(背景|环境|场景|地点|空间|房间|户外|室内)') as match_count,
    ROUND((COUNT(*) FILTER (WHERE original_description ~* '(背景|环境|场景|地点|空间|房间|户外|室内)') * 100.0 / COUNT(*))::numeric, 1) as match_percentage
FROM illustrations_optimized 
WHERE original_description IS NOT NULL;

-- 3. 查看具体的描述样本（高质量和低质量）
SELECT '�� 描述样本分析:' as info;

-- 最高质量样本
WITH quality_samples AS (
    SELECT 
        book_title,
        filename,
        LENGTH(original_description) as desc_length,
        LEFT(original_description, 100) as desc_sample,
        -- 当前质量评分计算
        (
            LEAST(LENGTH(original_description) / 400.0, 1.0) * 0.35 +
            (
                CASE WHEN original_description ~* '(颜色|色彩|明亮|温暖|柔和|鲜艳|彩色|色调)' THEN 0.15 ELSE 0 END +
                CASE WHEN original_description ~* '(情感|感受|心情|快乐|温馨|友爱|开心|愉悦|兴奋)' THEN 0.15 ELSE 0 END +
                CASE WHEN original_description ~* '(动作|行为|活动|玩耍|学习|探索|奔跑|跳跃|互动)' THEN 0.1 ELSE 0 END
            ) * 0.4 +
            CASE WHEN original_description ~* '(学习|教育|成长|发展|技能|知识|启发|思考)' THEN 0.15 ELSE 0 END +
            CASE WHEN original_description ~* '(背景|环境|场景|地点|空间|房间|户外|室内)' THEN 0.1 ELSE 0 END
        ) as current_quality_score
    FROM illustrations_optimized 
    WHERE original_description IS NOT NULL
    ORDER BY current_quality_score DESC
)
SELECT '最高质量样本:' as sample_type, book_title, filename, desc_length, 
       ROUND(current_quality_score::numeric, 3) as quality_score, desc_sample
FROM quality_samples 
LIMIT 5;

-- 最低质量样本
WITH quality_samples AS (
    SELECT 
        book_title,
        filename,
        LENGTH(original_description) as desc_length,
        LEFT(original_description, 100) as desc_sample,
        -- 当前质量评分计算
        (
            LEAST(LENGTH(original_description) / 400.0, 1.0) * 0.35 +
            (
                CASE WHEN original_description ~* '(颜色|色彩|明亮|温暖|柔和|鲜艳|彩色|色调)' THEN 0.15 ELSE 0 END +
                CASE WHEN original_description ~* '(情感|感受|心情|快乐|温馨|友爱|开心|愉悦|兴奋)' THEN 0.15 ELSE 0 END +
                CASE WHEN original_description ~* '(动作|行为|活动|玩耍|学习|探索|奔跑|跳跃|互动)' THEN 0.1 ELSE 0 END
            ) * 0.4 +
            CASE WHEN original_description ~* '(学习|教育|成长|发展|技能|知识|启发|思考)' THEN 0.15 ELSE 0 END +
            CASE WHEN original_description ~* '(背景|环境|场景|地点|空间|房间|户外|室内)' THEN 0.1 ELSE 0 END
        ) as current_quality_score
    FROM illustrations_optimized 
    WHERE original_description IS NOT NULL
    ORDER BY current_quality_score ASC
)
SELECT '最低质量样本:' as sample_type, book_title, filename, desc_length, 
       ROUND(current_quality_score::numeric, 3) as quality_score, desc_sample
FROM quality_samples 
LIMIT 5;

-- 4. 分析质量评分的实际分布范围
SELECT '📈 实际质量评分分布:' as info;
WITH score_analysis AS (
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
    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY quality_score)::numeric, 3) as q1_score,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY quality_score)::numeric, 3) as median_score,
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY quality_score)::numeric, 3) as q3_score
FROM score_analysis;

-- 5. 建议的改进评分算法
SELECT '💡 建议改进方案:' as info;
SELECT '
改进建议：

1. 扩大评分范围：当前评分过于集中在0.7-0.8，需要增加区分度
   - 调整长度权重：从 /400 改为 /300，让长描述得分更高
   - 增加关键词种类和权重

2. 关键词优化：根据实际匹配率调整
   - 如果某类关键词匹配率很低，说明需要扩充词库
   - 如果某类关键词匹配率很高，说明区分度不够

3. 引入更多维度：
   - 句子复杂度（逗号、句号数量）
   - 形容词密度
   - 专业词汇比例

4. 动态阈值：基于实际分布设置质量等级阈值
' as suggestions; 