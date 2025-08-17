-- 步骤4: 创建性能监控视图和测试
-- 在 Supabase SQL 编辑器中执行此脚本

-- 创建数据库性能监控视图
CREATE OR REPLACE VIEW weighted_search_performance_stats AS
SELECT 
    COUNT(*) as total_records,
    COUNT(theme_philosophy_embedding) as theme_philosophy_count,
    COUNT(action_process_embedding) as action_process_count,
    COUNT(interpersonal_roles_embedding) as interpersonal_roles_count,
    COUNT(edu_value_embedding) as edu_value_count,
    COUNT(learning_strategy_embedding) as learning_strategy_count,
    COUNT(creative_play_embedding) as creative_play_count,
    COUNT(scene_visuals_embedding) as scene_visuals_count,
    COUNT(original_embedding) as original_embedding_count
FROM illustrations_optimized;

-- 查看当前数据统计
SELECT * FROM weighted_search_performance_stats;

-- 检查索引状态
SELECT 
    schemaname, 
    tablename, 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'illustrations_optimized' 
AND indexname LIKE '%embedding%'
ORDER BY indexname;

-- 检查函数是否创建成功
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_name LIKE 'weighted_semantic_search%'
ORDER BY routine_name;
