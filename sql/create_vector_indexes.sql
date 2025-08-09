-- 为向量字段创建 HNSW 索引以提升查询性能
-- HNSW (Hierarchical Navigable Small World) 是专为向量相似度搜索优化的索引类型

-- 注意：创建索引可能需要一些时间，特别是对于大型数据集
-- 建议在低峰期执行这些索引创建操作

BEGIN;

-- 1. 主题哲学向量索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_theme_philosophy_embedding_hnsw 
ON illustrations_optimized 
USING hnsw (theme_philosophy_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 2. 行动过程向量索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_action_process_embedding_hnsw 
ON illustrations_optimized 
USING hnsw (action_process_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 3. 人际角色向量索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interpersonal_roles_embedding_hnsw 
ON illustrations_optimized 
USING hnsw (interpersonal_roles_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 4. 教育价值向量索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edu_value_embedding_hnsw 
ON illustrations_optimized 
USING hnsw (edu_value_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 5. 学习策略向量索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_strategy_embedding_hnsw 
ON illustrations_optimized 
USING hnsw (learning_strategy_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 6. 创意游戏向量索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creative_play_embedding_hnsw 
ON illustrations_optimized 
USING hnsw (creative_play_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 7. 场景视觉向量索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scene_visuals_embedding_hnsw 
ON illustrations_optimized 
USING hnsw (scene_visuals_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

COMMIT;

-- 索引参数说明：
-- m = 16: 每个节点的最大连接数（默认16，范围2-100）
-- ef_construction = 64: 构建时的搜索宽度（默认64，更高值=更好精度但更慢构建）
-- vector_cosine_ops: 使用余弦距离运算符（适合我们的相似度计算）

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