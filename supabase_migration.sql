-- Supabase 数据表结构迁移脚本
-- 表名：illustrations_optimized
-- 目标：将单一描述字段扩展为7个主题字段，每个字段配备对应的向量列

-- 第零步：启用pgvector扩展（如果尚未启用）
CREATE EXTENSION IF NOT EXISTS vector;

BEGIN;

-- 第一步：重命名现有字段
-- 将 ai_description 重命名为 original_description
ALTER TABLE illustrations_optimized 
RENAME COLUMN ai_description TO original_description;

-- 将 vector_embedding 重命名为 original_embedding  
ALTER TABLE illustrations_optimized 
RENAME COLUMN vector_embedding TO original_embedding;

-- 第二步：添加新的主题描述字段（TEXT类型）
-- 主题哲学
ALTER TABLE illustrations_optimized 
ADD COLUMN theme_philosophy TEXT;

-- 行动过程
ALTER TABLE illustrations_optimized 
ADD COLUMN action_process TEXT;

-- 人际角色
ALTER TABLE illustrations_optimized 
ADD COLUMN interpersonal_roles TEXT;

-- 教育价值
ALTER TABLE illustrations_optimized 
ADD COLUMN edu_value TEXT;

-- 学习策略
ALTER TABLE illustrations_optimized 
ADD COLUMN learning_strategy TEXT;

-- 创意游戏
ALTER TABLE illustrations_optimized 
ADD COLUMN creative_play TEXT;

-- 场景视觉
ALTER TABLE illustrations_optimized 
ADD COLUMN scene_visuals TEXT;

-- 第三步：添加新的向量嵌入字段（VECTOR(1536)类型）
-- 主题哲学向量
ALTER TABLE illustrations_optimized 
ADD COLUMN theme_philosophy_embedding VECTOR(1536);

-- 行动过程向量
ALTER TABLE illustrations_optimized 
ADD COLUMN action_process_embedding VECTOR(1536);

-- 人际角色向量
ALTER TABLE illustrations_optimized 
ADD COLUMN interpersonal_roles_embedding VECTOR(1536);

-- 教育价值向量
ALTER TABLE illustrations_optimized 
ADD COLUMN edu_value_embedding VECTOR(1536);

-- 学习策略向量
ALTER TABLE illustrations_optimized 
ADD COLUMN learning_strategy_embedding VECTOR(1536);

-- 创意游戏向量
ALTER TABLE illustrations_optimized 
ADD COLUMN creative_play_embedding VECTOR(1536);

-- 场景视觉向量
ALTER TABLE illustrations_optimized 
ADD COLUMN scene_visuals_embedding VECTOR(1536);

-- 第四步：更新 updated_at 字段为当前时间戳
UPDATE illustrations_optimized 
SET updated_at = NOW();

-- 第五步：添加字段注释以便后续维护
COMMENT ON COLUMN illustrations_optimized.original_description IS '原始AI生成的描述（从ai_description重命名而来）';
COMMENT ON COLUMN illustrations_optimized.original_embedding IS '原始描述对应的向量嵌入（从vector_embedding重命名而来）';

COMMENT ON COLUMN illustrations_optimized.theme_philosophy IS '主题哲学：插图传达的核心理念和价值观';
COMMENT ON COLUMN illustrations_optimized.action_process IS '行动过程：插图中展示的具体行为和流程';
COMMENT ON COLUMN illustrations_optimized.interpersonal_roles IS '人际角色：插图中人物的社会角色和关系';
COMMENT ON COLUMN illustrations_optimized.edu_value IS '教育价值：插图的教育意义和学习目标';
COMMENT ON COLUMN illustrations_optimized.learning_strategy IS '学习策略：插图体现的学习方法和技巧';
COMMENT ON COLUMN illustrations_optimized.creative_play IS '创意游戏：插图中的创造性和游戏化元素';
COMMENT ON COLUMN illustrations_optimized.scene_visuals IS '场景视觉：插图的视觉元素和场景描述';

COMMENT ON COLUMN illustrations_optimized.theme_philosophy_embedding IS '主题哲学的向量嵌入';
COMMENT ON COLUMN illustrations_optimized.action_process_embedding IS '行动过程的向量嵌入';
COMMENT ON COLUMN illustrations_optimized.interpersonal_roles_embedding IS '人际角色的向量嵌入';
COMMENT ON COLUMN illustrations_optimized.edu_value_embedding IS '教育价值的向量嵌入';
COMMENT ON COLUMN illustrations_optimized.learning_strategy_embedding IS '学习策略的向量嵌入';
COMMENT ON COLUMN illustrations_optimized.creative_play_embedding IS '创意游戏的向量嵌入';
COMMENT ON COLUMN illustrations_optimized.scene_visuals_embedding IS '场景视觉的向量嵌入';

COMMIT;

-- 迁移完成后的表结构验证查询
-- 可以运行以下查询来验证迁移是否成功
/*
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'illustrations_optimized' 
ORDER BY ordinal_position;
*/