# 数据库查询超时问题解决方案

## 问题概述

在使用加权语义搜索功能时，你遇到了以下错误：

```
Error: 搜索失败: canceling statement due to statement timeout
ixdlwnzktpkhwaxeddzh.supabase.co/rest/v1/rpc/weighted_semantic_search:1 Failed to load resource: the server responded with a status of 500
```

这些错误表明数据库查询执行时间过长，超过了预设的超时限制。

## 根本原因

1. **复杂的向量计算**：加权搜索需要计算7个不同维度的向量相似度
2. **缺少向量索引**：向量字段可能没有适当的 HNSW 索引
3. **大数据量处理**：表中数据较多时，全表扫描会很慢
4. **没有超时处理**：前端缺少合适的超时和降级机制

## 解决方案

### 1. 数据库性能优化

#### 步骤 1: 执行性能优化 SQL
在 Supabase SQL 编辑器中执行以下文件：
```sql
-- 执行这个文件来优化数据库性能
sql/optimize_weighted_search_performance.sql
```

这个脚本会：
- 为所有向量字段创建 HNSW 索引
- 创建优化版本的搜索函数
- 创建简化版本的备用搜索函数
- 添加性能监控视图

#### 步骤 2: 验证索引创建
```sql
-- 检查索引是否创建成功
SELECT schemaname, tablename, indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'illustrations_optimized' 
AND indexname LIKE '%embedding%';
```

#### 步骤 3: 检查数据统计
```sql
-- 查看数据统计
SELECT * FROM weighted_search_performance_stats;
```

### 2. 前端优化

前端代码已经更新，包含以下改进：

#### 超时处理
- 设置 30 秒前端超时
- 设置 35 秒 HTTP 请求超时

#### 降级机制
1. **优先尝试**：`weighted_semantic_search_optimized` (优化版)
2. **第一降级**：`weighted_semantic_search_simple` (简化版)
3. **最后降级**：`weighted_semantic_search` (原始版)

#### 错误信息改进
- 提供更友好的用户错误提示
- 区分不同类型的错误（超时、网络、数据库）

### 3. 使用建议

#### 搜索参数优化
```typescript
// 推荐的搜索参数
const searchParams = {
  matchCount: 10,        // 减少返回结果数量
  similarityThreshold: 0.2  // 提高相似度阈值
};
```

#### 权重配置优化
```typescript
// 使用预设模板，避免过于复杂的权重配置
const weights = WEIGHT_PRESETS.educational; // 而不是自定义复杂权重
```

## 监控和调试

### 查看搜索性能
```sql
-- 测试搜索函数性能
EXPLAIN ANALYZE 
SELECT * FROM weighted_semantic_search_optimized(
    (SELECT theme_philosophy_embedding FROM illustrations_optimized WHERE theme_philosophy_embedding IS NOT NULL LIMIT 1),
    '{"philosophy": 0.3, "creative_play": 0.3, "edu_value": 0.4}'::jsonb,
    10,
    0.2
);
```

### 检查数据库连接
```sql
-- 查看当前活动连接
SELECT count(*) as active_connections 
FROM pg_stat_activity 
WHERE state = 'active';

-- 查看长时间运行的查询
SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
FROM pg_stat_activity 
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';
```

## 应急处理

如果问题仍然存在，可以临时使用以下应急方案：

### 方案 1: 降低搜索复杂度
```typescript
// 临时使用简化搜索
const results = await supabase.rpc('weighted_semantic_search_simple', {
  query_embedding: `[${queryEmbedding.join(',')}]`,
  weights: WEIGHT_PRESETS.balanced,
  match_count: 5  // 进一步减少结果数量
});
```

### 方案 2: 使用传统搜索
```typescript
// 完全降级到传统匹配
const content = { content: textContent, theme: '通用', keywords: [] };
const results = await matchIllustrationsToText(content);
```

## 预防措施

1. **定期维护**：定期更新数据库统计信息和重建索引
2. **监控性能**：设置数据库性能监控告警
3. **数据清理**：定期清理无用或重复的向量数据
4. **分批处理**：对于大量数据操作，使用分批处理

## 联系支持

如果问题持续存在，请提供以下信息：
- 错误日志的完整内容
- 数据库中的记录数量
- 搜索时使用的参数
- 网络环境信息

---

**更新时间**: 2025-01-14
**版本**: 1.0
**状态**: 生效中
