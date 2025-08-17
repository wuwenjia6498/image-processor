-- 步骤1: 创建向量索引
-- 在 Supabase SQL 编辑器中执行此脚本

-- 为 theme_philosophy_embedding 创建索引
CREATE INDEX IF NOT EXISTS idx_theme_philosophy_embedding_hnsw 
ON illustrations_optimized 
USING hnsw (theme_philosophy_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 为 action_process_embedding 创建索引
CREATE INDEX IF NOT EXISTS idx_action_process_embedding_hnsw 
ON illustrations_optimized 
USING hnsw (action_process_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 为 interpersonal_roles_embedding 创建索引
CREATE INDEX IF NOT EXISTS idx_interpersonal_roles_embedding_hnsw 
ON illustrations_optimized 
USING hnsw (interpersonal_roles_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 为 edu_value_embedding 创建索引
CREATE INDEX IF NOT EXISTS idx_edu_value_embedding_hnsw 
ON illustrations_optimized 
USING hnsw (edu_value_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 为 learning_strategy_embedding 创建索引
CREATE INDEX IF NOT EXISTS idx_learning_strategy_embedding_hnsw 
ON illustrations_optimized 
USING hnsw (learning_strategy_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 为 creative_play_embedding 创建索引
CREATE INDEX IF NOT EXISTS idx_creative_play_embedding_hnsw 
ON illustrations_optimized 
USING hnsw (creative_play_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 为 scene_visuals_embedding 创建索引
CREATE INDEX IF NOT EXISTS idx_scene_visuals_embedding_hnsw 
ON illustrations_optimized 
USING hnsw (scene_visuals_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 检查索引创建状态
SELECT 
    schemaname, 
    tablename, 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'illustrations_optimized' 
AND indexname LIKE '%embedding%'
ORDER BY indexname;
