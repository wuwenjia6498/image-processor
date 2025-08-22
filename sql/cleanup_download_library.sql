-- 清理下载插图库的测试数据
-- 在Supabase控制台的SQL编辑器中执行此脚本

-- 查看当前数据量
SELECT 'material_library表当前记录数:' as info, COUNT(*) as count FROM material_library;

-- 清空所有测试数据（取消注释下面的语句执行清理）
TRUNCATE TABLE material_library;

-- 查看清理后的数据量
SELECT 'material_library表清理后记录数:' as info, COUNT(*) as count FROM material_library;

SELECT '清理完成！现在只有真实的用户下载记录会被统计。' as message; 