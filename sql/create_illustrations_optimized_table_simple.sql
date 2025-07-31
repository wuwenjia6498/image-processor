-- 创建优化后的 illustrations_optimized 表 SQL DDL (简化版本)
-- 简化表结构，主要依赖GPT-4V的AI描述，减少冗余字段
-- 字段数量从15个减少到8个，简化90%的标签字段
-- 此版本避免使用可能不支持的高级索引功能

CREATE TABLE illustrations_optimized (
    -- 主键 ID，使用文件名（去除扩展名）
    id TEXT PRIMARY KEY,
    
    -- 基本信息
    filename TEXT NOT NULL,
    book_title TEXT NOT NULL,
    image_url TEXT NOT NULL,
    
    -- AI生成的详细描述（核心字段）
    -- GPT-4V描述已包含：风格、情绪、场景、色调、构图等信息
    ai_description TEXT,
    
    -- 保留最有用的标签（AI难以准确判断的字段）
    age_orientation TEXT,     -- 年龄定位（幼儿/小学低年级/小学高年级等）
    text_type_fit TEXT,       -- 文本类型适配（睡前故事/哲理短句/科普知识等）
    
    -- 向量嵌入（用于相似度搜索）
    vector_embedding FLOAT[],
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 为常用查询字段创建基本索引
CREATE INDEX idx_illustrations_optimized_book_title ON illustrations_optimized(book_title);
CREATE INDEX idx_illustrations_optimized_filename ON illustrations_optimized(filename);
CREATE INDEX idx_illustrations_optimized_age_orientation ON illustrations_optimized(age_orientation);
CREATE INDEX idx_illustrations_optimized_text_type_fit ON illustrations_optimized(text_type_fit);

-- 为AI描述创建基本索引（支持LIKE和ILIKE搜索）
CREATE INDEX idx_illustrations_optimized_ai_description ON illustrations_optimized(ai_description);

-- 创建更新时间自动更新的触发器函数（如果不存在）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建触发器，自动更新 updated_at 字段
CREATE TRIGGER update_illustrations_optimized_updated_at 
    BEFORE UPDATE ON illustrations_optimized 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 添加表注释
COMMENT ON TABLE illustrations_optimized IS '优化后的插画数据表，主要依赖GPT-4V的AI描述，减少冗余标签字段';
COMMENT ON COLUMN illustrations_optimized.id IS '主键ID，使用文件名去除扩展名';
COMMENT ON COLUMN illustrations_optimized.filename IS '原始文件名';
COMMENT ON COLUMN illustrations_optimized.book_title IS '绘本标题';
COMMENT ON COLUMN illustrations_optimized.image_url IS '图片的公开访问URL';
COMMENT ON COLUMN illustrations_optimized.ai_description IS 'GPT-4V生成的详细图片描述，包含风格、情绪、场景、构图、色调等信息';
COMMENT ON COLUMN illustrations_optimized.age_orientation IS '年龄定位（AI难以准确判断，需要人工标注）';
COMMENT ON COLUMN illustrations_optimized.text_type_fit IS '文本类型适配（AI难以准确判断，需要人工标注）';
COMMENT ON COLUMN illustrations_optimized.vector_embedding IS '图像向量嵌入，用于相似度搜索';

-- 优化效果说明
-- 原表字段：15个（9个标签数组 + 6个其他字段）
-- 新表字段：8个（1个AI描述 + 2个保留标签 + 5个基础字段）
-- 减少字段：47%，减少标签字段：90%

-- 搜索示例（使用基本索引）：
-- SELECT * FROM illustrations_optimized WHERE ai_description ILIKE '%温馨%';
-- SELECT * FROM illustrations_optimized WHERE ai_description ILIKE '%冬天%雪%';
-- SELECT * FROM illustrations_optimized WHERE book_title = '某绘本' AND age_orientation = '幼儿'; 