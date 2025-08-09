# 🎯 加权语义搜索功能使用指南

## 概述

`weighted_semantic_search` 函数是一个高级的多维度语义搜索工具，基于7个主题向量字段进行加权相似度计算，为你的插图数据库提供精准的个性化搜索体验。

## 🔧 函数签名

```sql
weighted_semantic_search(
    query_embedding VECTOR(1536),  -- 查询向量
    weights JSONB,                 -- 权重配置
    match_count INT                -- 返回记录数
)
```

## 📊 7个主题维度

| 字段名 | 中文名称 | 描述 | 权重建议 |
|--------|----------|------|----------|
| `philosophy` | 主题哲学 | 插图传达的核心理念和价值观 | 0.1-0.3 |
| `action_process` | 行动过程 | 插图中展示的具体行为和流程 | 0.1-0.3 |
| `interpersonal_roles` | 人际角色 | 插图中人物的社会角色和关系 | 0.1-0.2 |
| `edu_value` | 教育价值 | 插图的教育意义和学习目标 | 0.1-0.4 |
| `learning_strategy` | 学习策略 | 插图体现的学习方法和技巧 | 0.1-0.3 |
| `creative_play` | 创意游戏 | 插图中的创造性和游戏化元素 | 0.05-0.3 |
| `scene_visuals` | 场景视觉 | 插图的视觉元素和场景描述 | 0.1-0.2 |

## 🎨 使用场景与权重配置

### 1. 教育内容搜索
**适用场景**: 寻找具有强教育价值的插图
```sql
SELECT * FROM weighted_semantic_search(
    your_query_vector,
    '{"philosophy": 0.2, "action_process": 0.1, "interpersonal_roles": 0.1, "edu_value": 0.4, "learning_strategy": 0.15, "creative_play": 0.03, "scene_visuals": 0.02}'::jsonb,
    10
);
```

### 2. 创意灵感搜索  
**适用场景**: 寻找富有创意和游戏化元素的插图
```sql
SELECT * FROM weighted_semantic_search(
    your_query_vector,
    '{"philosophy": 0.1, "action_process": 0.15, "interpersonal_roles": 0.1, "edu_value": 0.1, "learning_strategy": 0.1, "creative_play": 0.4, "scene_visuals": 0.05}'::jsonb,
    15
);
```

### 3. 行为流程搜索
**适用场景**: 寻找展示具体操作步骤的插图
```sql
SELECT * FROM weighted_semantic_search(
    your_query_vector,
    '{"philosophy": 0.05, "action_process": 0.5, "interpersonal_roles": 0.1, "edu_value": 0.15, "learning_strategy": 0.15, "creative_play": 0.03, "scene_visuals": 0.02}'::jsonb,
    8
);
```

### 4. 社交互动搜索
**适用场景**: 寻找强调人际关系和角色的插图
```sql
SELECT * FROM weighted_semantic_search(
    your_query_vector,
    '{"philosophy": 0.15, "action_process": 0.1, "interpersonal_roles": 0.4, "edu_value": 0.15, "learning_strategy": 0.1, "creative_play": 0.05, "scene_visuals": 0.05}'::jsonb,
    12
);
```

### 5. 视觉设计搜索
**适用场景**: 重点关注视觉效果和场景构成
```sql
SELECT * FROM weighted_semantic_search(
    your_query_vector,
    '{"philosophy": 0.1, "action_process": 0.1, "interpersonal_roles": 0.1, "edu_value": 0.1, "learning_strategy": 0.1, "creative_play": 0.1, "scene_visuals": 0.4}'::jsonb,
    20
);
```

## 🚀 实际使用示例

### 基础测试查询
```sql
-- 使用现有记录的向量进行测试
WITH test_query AS (
    SELECT theme_philosophy_embedding as query_vec
    FROM illustrations_optimized 
    WHERE theme_philosophy_embedding IS NOT NULL 
    LIMIT 1
)
SELECT 
    id,
    title,
    final_score,
    LEFT(theme_philosophy, 80) || '...' as philosophy_snippet
FROM weighted_semantic_search(
    (SELECT query_vec FROM test_query),
    '{"philosophy": 0.25, "action_process": 0.15, "interpersonal_roles": 0.1, "edu_value": 0.2, "learning_strategy": 0.15, "creative_play": 0.1, "scene_visuals": 0.05}'::jsonb,
    5
);
```

### 性能分析查询
```sql
-- 分析搜索结果的得分分布
WITH search_results AS (
    SELECT final_score
    FROM weighted_semantic_search(
        your_query_vector,
        your_weights,
        50
    )
)
SELECT 
    MIN(final_score) as min_score,
    MAX(final_score) as max_score,
    AVG(final_score) as avg_score,
    STDDEV(final_score) as score_stddev,
    COUNT(*) as total_results
FROM search_results;
```

## ⚡ 性能优化

### 1. 创建向量索引
运行 `sql/create_vector_indexes.sql` 中的索引创建脚本：
```sql
-- 这将为所有7个向量字段创建 HNSW 索引
-- 大幅提升搜索性能（特别是大数据集）
```

### 2. 查询优化技巧
- **限制结果数量**: 使用合适的 `match_count` 值
- **权重归一化**: 确保所有权重值加起来接近1.0
- **缓存常用查询**: 对频繁使用的权重配置进行结果缓存

## 🎯 权重调优建议

### 权重分配原则
1. **总和控制**: 所有权重之和建议在 0.8-1.2 之间
2. **主次分明**: 主要关注的维度权重 > 0.2，次要维度 < 0.1
3. **均衡考虑**: 避免单一维度权重过高（> 0.6）

### A/B测试模板
```sql
-- 方案A: 教育导向
SET @weights_edu = '{"philosophy": 0.2, "action_process": 0.1, "interpersonal_roles": 0.1, "edu_value": 0.4, "learning_strategy": 0.15, "creative_play": 0.03, "scene_visuals": 0.02}';

-- 方案B: 创意导向  
SET @weights_creative = '{"philosophy": 0.1, "action_process": 0.15, "interpersonal_roles": 0.1, "edu_value": 0.1, "learning_strategy": 0.1, "creative_play": 0.4, "scene_visuals": 0.05}';

-- 比较两种方案的结果差异
```

## 🔍 故障排除

### 常见问题

**Q: 函数返回空结果**
```sql
-- 检查数据完整性
SELECT COUNT(*) as total,
       COUNT(theme_philosophy_embedding) as has_vectors
FROM illustrations_optimized;
```

**Q: 搜索结果得分异常**
```sql
-- 验证权重配置
SELECT 
    (weights->>'philosophy')::FLOAT + 
    (weights->>'action_process')::FLOAT + 
    -- ... 其他字段
    as weight_sum
FROM (SELECT '{"philosophy": 0.3, ...}'::jsonb as weights) t;
```

**Q: 查询性能慢**
- 确保已创建向量索引
- 减少 `match_count` 参数
- 检查数据库资源使用情况

## 📈 监控与分析

### 使用统计查询
```sql
-- 分析最常用的权重模式
-- 监控查询性能
-- 跟踪用户搜索行为
```

---

## 🎉 总结

`weighted_semantic_search` 函数为你的插图数据库提供了强大的多维度搜索能力。通过合理配置权重，你可以：

- 🎯 **精准定位**: 根据具体需求调整搜索重点
- 🚀 **高效检索**: 基于向量相似度的快速搜索
- 🔧 **灵活配置**: 支持动态权重调整
- 📊 **量化结果**: 提供可比较的相似度得分

开始使用这个强大的搜索工具，为你的用户提供更智能、更精准的内容发现体验吧！