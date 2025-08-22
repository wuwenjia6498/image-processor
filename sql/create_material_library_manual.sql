-- 创建 material_library 表的SQL脚本
-- 请在Supabase控制台的SQL编辑器中执行此脚本

-- 创建 material_library 表
CREATE TABLE IF NOT EXISTS material_library (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    filename TEXT NOT NULL,
    book_title TEXT,
    image_url TEXT NOT NULL,
    original_description TEXT,
    download_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    download_count INTEGER DEFAULT 1,
    last_used_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tags TEXT[] DEFAULT '{}',
    category TEXT DEFAULT '未分类',
    file_size BIGINT,
    file_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_material_library_filename ON material_library(filename);
CREATE INDEX IF NOT EXISTS idx_material_library_image_url ON material_library(image_url);
CREATE INDEX IF NOT EXISTS idx_material_library_category ON material_library(category);
CREATE UNIQUE INDEX IF NOT EXISTS idx_material_library_unique_filename ON material_library(filename);

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- 创建触发器
DROP TRIGGER IF EXISTS update_material_library_updated_at ON material_library;
CREATE TRIGGER update_material_library_updated_at
    BEFORE UPDATE ON material_library
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 创建统计函数
CREATE OR REPLACE FUNCTION get_material_library_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_materials', COUNT(*),
        'total_size_mb', COALESCE(SUM(file_size), 0) / (1024.0 * 1024.0),
        'recent_downloads', COUNT(*) FILTER (WHERE download_date >= NOW() - INTERVAL '7 days'),
        'categories', (
            SELECT json_object_agg(category, count)
            FROM (
                SELECT COALESCE(category, '未分类') as category, COUNT(*) as count
                FROM material_library
                GROUP BY category
            ) cat_counts
        )
    ) INTO result
    FROM material_library;
    
    RETURN result;
END;
$$ LANGUAGE 'plpgsql';

-- 验证表创建
SELECT 'material_library表创建成功!' as message; 