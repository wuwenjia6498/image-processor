-- 将 original_embedding 从 FLOAT[] 转换为 VECTOR(1536) 类型

-- 第一步：添加新的VECTOR类型列
ALTER TABLE illustrations_optimized 
ADD COLUMN original_embedding_vector VECTOR(1536);

-- 第二步：将数据从FLOAT[]转换到VECTOR
UPDATE illustrations_optimized 
SET original_embedding_vector = original_embedding::VECTOR(1536)
WHERE original_embedding IS NOT NULL;

-- 第三步：删除旧的FLOAT[]列
ALTER TABLE illustrations_optimized 
DROP COLUMN original_embedding;

-- 第四步：将新列重命名为原来的名字
ALTER TABLE illustrations_optimized 
RENAME COLUMN original_embedding_vector TO original_embedding;

-- 第五步：为新的向量列创建索引以提高搜索性能
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_original_embedding_hnsw
ON illustrations_optimized 
USING hnsw (original_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);