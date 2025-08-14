-- 调试 illustrations_optimized 表的数据查询

-- 1. 检查表结构
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'illustrations_optimized'
ORDER BY ordinal_position;

-- 2. 检查总记录数
SELECT COUNT(*) as total_records FROM illustrations_optimized;

-- 3. 检查有向量数据的记录数
SELECT COUNT(*) as records_with_vectors 
FROM illustrations_optimized 
WHERE vector_embedding IS NOT NULL 
  AND array_length(vector_embedding, 1) > 0;

-- 3.1 检查主题向量字段的数据情况
SELECT 
  COUNT(theme_philosophy_embedding) as philosophy_vectors,
  COUNT(action_process_embedding) as action_vectors,
  COUNT(interpersonal_roles_embedding) as interpersonal_vectors,
  COUNT(edu_value_embedding) as edu_vectors,
  COUNT(learning_strategy_embedding) as strategy_vectors,
  COUNT(creative_play_embedding) as creative_vectors,
  COUNT(scene_visuals_embedding) as visual_vectors,
  COUNT(*) as total_records
FROM illustrations_optimized;

-- 4. 检查向量维度分布
SELECT 
  array_length(vector_embedding, 1) as vector_dimension,
  COUNT(*) as count
FROM illustrations_optimized 
WHERE vector_embedding IS NOT NULL
GROUP BY array_length(vector_embedding, 1)
ORDER BY vector_dimension;

-- 5. 查看前5条记录的基本信息
SELECT 
  id,
  filename,
  book_title,
  LEFT(ai_description, 100) || '...' as description_preview,
  CASE 
    WHEN vector_embedding IS NULL THEN 'NULL'
    WHEN array_length(vector_embedding, 1) IS NULL THEN 'EMPTY'
    ELSE array_length(vector_embedding, 1)::TEXT
  END as vector_status,
  created_at
FROM illustrations_optimized
ORDER BY created_at DESC
LIMIT 5;

-- 6. 测试向量相似度计算（如果有数据的话）
-- 注意：这个查询需要在有数据的情况下才能运行
/*
WITH sample_vector AS (
  SELECT vector_embedding 
  FROM illustrations_optimized 
  WHERE vector_embedding IS NOT NULL 
  LIMIT 1
)
SELECT 
  i.id,
  i.filename,
  1 - (s.vector_embedding <=> i.vector_embedding::VECTOR) as similarity
FROM illustrations_optimized i
CROSS JOIN sample_vector s
WHERE i.vector_embedding IS NOT NULL
ORDER BY similarity DESC
LIMIT 5;
*/