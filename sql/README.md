# SQL 脚本说明

本目录包含系统的核心 SQL 脚本文件。

## 核心功能脚本

### 1. `optimize_weighted_search_performance.sql`
- **用途**: 创建加权搜索的核心数据库函数和索引
- **功能**: 
  - 创建性能优化的索引
  - 定义多维度加权搜索函数
  - 设置搜索质量监控
- **执行时机**: 系统初始化时执行一次

### 2. `fix_field_mapping_swap.sql` 
- **用途**: 修复字段映射问题
- **功能**:
  - 更新所有搜索函数的字段映射
  - 确保 image_url 和 original_description 字段正确对应
- **执行时机**: 发现字段映射错误时执行

### 3. `init_download_library.sql`
- **用途**: 初始化下载记录功能
- **功能**:
  - 创建 material_library 表
  - 创建下载统计函数
  - 设置相关触发器
- **执行时机**: 启用下载记录功能时执行一次

## 维护脚本

### 4. `cleanup_download_library.sql`
- **用途**: 清理下载记录测试数据
- **功能**: 清空 material_library 表中的测试记录
- **执行时机**: 需要清理测试数据时执行

## 执行顺序

如果是全新部署，建议按以下顺序执行：

1. `optimize_weighted_search_performance.sql` - 创建核心搜索功能
2. `init_download_library.sql` - 启用下载记录功能
3. `fix_field_mapping_swap.sql` - 确保字段映射正确（如果需要）

## 注意事项

- 所有脚本都应在 Supabase 控制台的 SQL 编辑器中执行
- 执行前请备份重要数据
- 如有疑问，请查看各脚本文件内的详细注释 