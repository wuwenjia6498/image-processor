-- 改进的质量评分算法
-- 去除字数权重，专注内容质量和丰富度

-- 1. 测试新的质量评分算法
SELECT '🆕 改进的质量评分算法测试' as info;
WITH improved_scoring AS (
    SELECT 
        book_title,
        filename,
        LENGTH(original_description) as desc_length,
        LEFT(original_description, 100) as desc_sample,
        
        -- 新的质量评分：完全基于内容质量，不考虑长度
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
        
        -- 对比：原始评分算法
        (
            LEAST(LENGTH(original_description) / 400.0, 1.0) * 0.35 +
            (
                CASE WHEN original_description ~* '(颜色|色彩|明亮|温暖|柔和|鲜艳|彩色|色调)' THEN 0.15 ELSE 0 END +
                CASE WHEN original_description ~* '(情感|感受|心情|快乐|温馨|友爱|开心|愉悦|兴奋)' THEN 0.15 ELSE 0 END +
                CASE WHEN original_description ~* '(动作|行为|活动|玩耍|学习|探索|奔跑|跳跃|互动)' THEN 0.1 ELSE 0 END
            ) * 0.4 +
            CASE WHEN original_description ~* '(学习|教育|成长|发展|技能|知识|启发|思考)' THEN 0.15 ELSE 0 END +
            CASE WHEN original_description ~* '(背景|环境|场景|地点|空间|房间|户外|室内)' THEN 0.1 ELSE 0 END
        ) as original_quality_score
        
    FROM illustrations_optimized 
    WHERE original_description IS NOT NULL
)

-- 显示改进前后的评分对比
SELECT 
    COUNT(*) as total_count,
    '原始算法' as algorithm_type,
    ROUND(MIN(original_quality_score)::numeric, 3) as min_score,
    ROUND(MAX(original_quality_score)::numeric, 3) as max_score,
    ROUND(AVG(original_quality_score)::numeric, 3) as avg_score,
    ROUND((MAX(original_quality_score) - MIN(original_quality_score))::numeric, 3) as score_range
FROM improved_scoring

UNION ALL

SELECT 
    COUNT(*) as total_count,
    '改进算法' as algorithm_type,
    ROUND(MIN(improved_quality_score)::numeric, 3) as min_score,
    ROUND(MAX(improved_quality_score)::numeric, 3) as max_score,
    ROUND(AVG(improved_quality_score)::numeric, 3) as avg_score,
    ROUND((MAX(improved_quality_score) - MIN(improved_quality_score))::numeric, 3) as score_range
FROM improved_scoring;

-- 2. 显示改进算法的质量分布
SELECT '📊 改进算法的质量等级分布' as info;
WITH improved_scoring AS (
    SELECT 
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
        ) as improved_quality_score
    FROM illustrations_optimized 
    WHERE original_description IS NOT NULL
)
SELECT 
    CASE 
        WHEN improved_quality_score >= 0.15 THEN '优秀 (0.15+)'
        WHEN improved_quality_score >= 0.12 THEN '良好 (0.12-0.15)'
        WHEN improved_quality_score >= 0.09 THEN '中等 (0.09-0.12)'
        WHEN improved_quality_score >= 0.06 THEN '一般 (0.06-0.09)'
        ELSE '待改进 (<0.06)'
    END as quality_level,
    COUNT(*) as count,
    ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM improved_scoring))::numeric, 1) as percentage
FROM improved_scoring
GROUP BY 
    CASE 
        WHEN improved_quality_score >= 0.15 THEN '优秀 (0.15+)'
        WHEN improved_quality_score >= 0.12 THEN '良好 (0.12-0.15)'
        WHEN improved_quality_score >= 0.09 THEN '中等 (0.09-0.12)'
        WHEN improved_quality_score >= 0.06 THEN '一般 (0.06-0.09)'
        ELSE '待改进 (<0.06)'
    END
ORDER BY count DESC;

-- 3. 显示改进算法下的最高质量样本
SELECT '🏆 改进算法下的最高质量样本' as info;
WITH improved_samples AS (
    SELECT 
        book_title,
        filename,
        LEFT(original_description, 150) as desc_sample,
        (
            -- 使用改进的评分算法
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
        ) as improved_score
    FROM illustrations_optimized 
    WHERE original_description IS NOT NULL
    ORDER BY improved_score DESC
    LIMIT 5
)
SELECT book_title, filename, ROUND(improved_score::numeric, 3) as score, desc_sample
FROM improved_samples; 