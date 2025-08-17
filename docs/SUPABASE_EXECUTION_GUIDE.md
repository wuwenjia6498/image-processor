# Supabase SQL 执行指南

## 🚀 快速修复数据库超时问题

按照以下步骤在 Supabase SQL 编辑器中执行优化脚本：

### 📍 访问 SQL 编辑器
1. 打开 [Supabase Dashboard](https://app.supabase.com)
2. 选择你的项目
3. 点击左侧菜单的 "SQL Editor"

### 📋 执行步骤

#### 步骤 1: 创建向量索引 (必须执行)
```sql
-- 复制并粘贴 sql/step1_create_indexes.sql 的全部内容
-- 这将为所有向量字段创建高性能索引
```

**执行文件**: `sql/step1_create_indexes.sql`
**预计时间**: 2-5分钟
**作用**: 大幅提升向量搜索性能

#### 步骤 2: 创建优化搜索函数 (必须执行)
```sql
-- 复制并粘贴 sql/step2_create_optimized_function.sql 的全部内容
-- 这将创建性能优化的搜索函数
```

**执行文件**: `sql/step2_create_optimized_function.sql`
**预计时间**: 30秒
**作用**: 创建优化版搜索函数，支持超时控制

#### 步骤 3: 创建备用搜索函数 (推荐执行)
```sql
-- 复制并粘贴 sql/step3_create_simple_function.sql 的全部内容
-- 这将创建简化版备用搜索函数
```

**执行文件**: `sql/step3_create_simple_function.sql`
**预计时间**: 30秒
**作用**: 创建备用搜索函数，确保功能可用性

#### 步骤 4: 创建监控视图 (可选执行)
```sql
-- 复制并粘贴 sql/step4_create_monitoring.sql 的全部内容
-- 这将创建性能监控视图并检查执行结果
```

**执行文件**: `sql/step4_create_monitoring.sql`
**预计时间**: 30秒
**作用**: 监控数据库状态和验证优化效果

### ✅ 验证执行结果

执行完成后，你应该看到：

1. **索引创建成功**:
   ```sql
   SELECT COUNT(*) as index_count 
   FROM pg_indexes 
   WHERE tablename = 'illustrations_optimized' 
   AND indexname LIKE '%embedding%';
   -- 应该返回 7 个索引
   ```

2. **函数创建成功**:
   ```sql
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_name LIKE 'weighted_semantic_search%';
   -- 应该返回 3 个函数
   ```

### 🎯 预期效果

优化完成后：
- ✅ 搜索时间从 30+ 秒降低到 5-10 秒
- ✅ 超时错误大幅减少
- ✅ 自动降级确保功能可用性
- ✅ 更友好的错误提示

### 🆘 如果遇到问题

#### 问题1: 索引创建失败
```sql
-- 检查是否缺少 vector 扩展
CREATE EXTENSION IF NOT EXISTS vector;
```

#### 问题2: 权限不足
```sql
-- 确保你有创建索引和函数的权限
-- 联系 Supabase 项目管理员
```

#### 问题3: 表不存在
```sql
-- 检查表名是否正确
SELECT tablename FROM pg_tables WHERE tablename LIKE '%illustration%';
```

### 📊 监控和调试

执行优化后，可以使用以下查询监控性能：

```sql
-- 查看数据统计
SELECT * FROM weighted_search_performance_stats;

-- 测试搜索性能（需要真实向量数据）
EXPLAIN ANALYZE 
SELECT * FROM weighted_semantic_search_optimized(
    (SELECT theme_philosophy_embedding FROM illustrations_optimized WHERE theme_philosophy_embedding IS NOT NULL LIMIT 1),
    '{"philosophy": 0.3, "creative_play": 0.3, "edu_value": 0.4}'::jsonb,
    10,
    0.2
);
```

---

**重要提示**: 
- 每个步骤都需要在 Supabase SQL 编辑器中单独执行
- 不要使用 `\i` 命令，直接复制粘贴 SQL 内容
- 如果某个步骤失败，可以重复执行（脚本具有幂等性）

**执行顺序很重要**: 必须按 步骤1 → 步骤2 → 步骤3 → 步骤4 的顺序执行
