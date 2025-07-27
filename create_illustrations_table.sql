-- 创建 illustrations 表的 SQL DDL
-- 用于存储插画数据，包含AI生成的描述和各种标签信息

CREATE TABLE illustrations (
    -- 主键 ID，使用文件名（去除扩展名）
    id TEXT PRIMARY KEY,
    
    -- 基本信息
    filename TEXT NOT NULL,
    book_title TEXT NOT NULL,
    image_url TEXT NOT NULL,
    ai_description TEXT, -- 对应用户提到的 ai_caption
    
    -- 各种标签字段（使用 TEXT[] 数组类型）
    style_tags TEXT[],
    mood_tags TEXT[],
    composition_tags TEXT[],
    scene_tags TEXT[],
    season_tags TEXT[],
    content_tags TEXT[],
    emotion_tags TEXT[],
    theme_tags TEXT[],
    tone_tags TEXT[],
    book_keywords TEXT[],
    
    -- 文本适配和年龄定位
    text_type_fit TEXT,
    age_orientation TEXT,
    book_theme_summary TEXT,
    
    -- 向量嵌入（用于相似度搜索）
    vector_embedding FLOAT[],
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 为常用查询字段创建索引
CREATE INDEX idx_illustrations_book_title ON illustrations(book_title);
CREATE INDEX idx_illustrations_filename ON illustrations(filename);
CREATE INDEX idx_illustrations_text_type_fit ON illustrations(text_type_fit);
CREATE INDEX idx_illustrations_age_orientation ON illustrations(age_orientation);

-- 为标签字段创建 GIN 索引（用于数组搜索）
CREATE INDEX idx_illustrations_style_tags ON illustrations USING GIN(style_tags);
CREATE INDEX idx_illustrations_mood_tags ON illustrations USING GIN(mood_tags);
CREATE INDEX idx_illustrations_composition_tags ON illustrations USING GIN(composition_tags);
CREATE INDEX idx_illustrations_scene_tags ON illustrations USING GIN(scene_tags);
CREATE INDEX idx_illustrations_season_tags ON illustrations USING GIN(season_tags);
CREATE INDEX idx_illustrations_content_tags ON illustrations USING GIN(content_tags);
CREATE INDEX idx_illustrations_emotion_tags ON illustrations USING GIN(emotion_tags);
CREATE INDEX idx_illustrations_theme_tags ON illustrations USING GIN(theme_tags);
CREATE INDEX idx_illustrations_tone_tags ON illustrations USING GIN(tone_tags);
CREATE INDEX idx_illustrations_book_keywords ON illustrations USING GIN(book_keywords);

-- 创建更新时间自动更新的触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建触发器，自动更新 updated_at 字段
CREATE TRIGGER update_illustrations_updated_at 
    BEFORE UPDATE ON illustrations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 添加表注释
COMMENT ON TABLE illustrations IS '插画数据表，存储绘本插画的元数据、AI描述和标签信息';
COMMENT ON COLUMN illustrations.id IS '主键ID，使用文件名去除扩展名';
COMMENT ON COLUMN illustrations.filename IS '原始文件名';
COMMENT ON COLUMN illustrations.book_title IS '绘本标题';
COMMENT ON COLUMN illustrations.image_url IS '图片的公开访问URL';
COMMENT ON COLUMN illustrations.ai_description IS 'AI生成的图片描述';
COMMENT ON COLUMN illustrations.vector_embedding IS '图像向量嵌入，用于相似度搜索';
COMMENT ON COLUMN illustrations.style_tags IS '风格标签数组';
COMMENT ON COLUMN illustrations.mood_tags IS '情绪标签数组';
COMMENT ON COLUMN illustrations.composition_tags IS '构图标签数组';
COMMENT ON COLUMN illustrations.scene_tags IS '场景标签数组';
COMMENT ON COLUMN illustrations.season_tags IS '季节标签数组';
COMMENT ON COLUMN illustrations.content_tags IS '内容标签数组';
COMMENT ON COLUMN illustrations.emotion_tags IS '情感标签数组';
COMMENT ON COLUMN illustrations.theme_tags IS '主题标签数组';
COMMENT ON COLUMN illustrations.tone_tags IS '色调标签数组';
COMMENT ON COLUMN illustrations.book_keywords IS '绘本关键词数组'; 