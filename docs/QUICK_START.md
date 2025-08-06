# 🚀 快速开始指南

本指南将帮助您快速理解和使用图片描述与匹配功能，实现文案自动匹配插图的效果。

## 📖 核心概念

### 什么是图片描述与匹配？

这是一个基于AI的智能系统，能够：
- 📝 **理解文案内容**：分析您的文字内容，提取关键信息
- 🎨 **匹配合适插图**：从插图库中找到最符合文案意境的图片
- 🎯 **精准筛选**：根据年龄段、内容类型等条件精确匹配
- ⚡ **实时响应**：快速返回匹配结果，支持批量处理

### 应用场景

- 📚 **内容创作**：为文章、故事自动配图
- 🎓 **教育材料**：为教学内容匹配合适的插图
- 📱 **应用开发**：为App内容自动推荐配图
- 🌐 **网站建设**：为网页内容智能配图

## 🛠 5分钟快速体验

### 步骤1：安装依赖

```bash
npm install express cors @types/express @types/cors
```

### 步骤2：配置环境变量

复制 `.env.local.example` 为 `.env.local` 并填入您的API密钥：

```bash
cp .env.local.example .env.local
```

编辑 `.env.local`：
```bash
OPENAI_API_KEY="your_openai_api_key"
PINECONE_API_KEY="your_pinecone_api_key" 
PINECONE_INDEX_NAME="your_index_name"
SUPABASE_URL="your_supabase_url"
SUPABASE_SERVICE_ROLE_KEY="your_supabase_key"
```

### 步骤3：启动服务

```bash
npm run start-illustration-service
```

服务将在 http://localhost:3001 启动

### 步骤4：测试API

使用curl测试匹配功能：

```bash
curl -X POST http://localhost:3001/api/match-illustrations \
  -H "Content-Type: application/json" \
  -d '{
    "content": "小兔子在森林里遇到了一只友善的小熊，它们一起在花丛中玩耍",
    "targetAge": "3-6岁",
    "contentType": "睡前故事",
    "topK": 5
  }'
```

### 步骤5：查看结果

您将收到类似这样的响应：

```json
{
  "success": true,
  "data": [
    {
      "id": "img_001",
      "filename": "rabbit_bear_forest.jpg",
      "bookTitle": "森林里的友谊",
      "description": "画面中小兔子和小熊在阳光斑驳的森林中快乐玩耍...",
      "imageUrl": "https://storage.url/rabbit_bear_forest.jpg",
      "similarity": 0.95,
      "metadata": {
        "ageOrientation": "3-6岁",
        "textTypeFit": "睡前故事",
        "bookTheme": "友谊与成长"
      }
    }
  ],
  "count": 1,
  "message": "成功找到1个匹配的插图"
}
```

## 💡 使用示例

### JavaScript/TypeScript 客户端

```typescript
// 使用客户端SDK
import { IllustrationClient } from './examples/illustration-client-example';

const client = new IllustrationClient('http://localhost:3001');

// 匹配插图
const matches = await client.matchIllustrations({
  content: '您的文案内容',
  targetAge: '3-6岁',
  contentType: '睡前故事'
}, 10);

console.log('匹配结果:', matches);
```

### Python 客户端

```python
import requests

def match_illustrations(content, target_age=None, content_type=None, top_k=10):
    url = "http://localhost:3001/api/match-illustrations"
    data = {
        "content": content,
        "targetAge": target_age,
        "contentType": content_type,
        "topK": top_k
    }
    
    response = requests.post(url, json=data)
    return response.json()

# 使用示例
result = match_illustrations(
    content="小兔子在森林里遇到了一只友善的小熊",
    target_age="3-6岁",
    content_type="睡前故事"
)
print(result)
```

### PHP 客户端

```php
<?php
function matchIllustrations($content, $targetAge = null, $contentType = null, $topK = 10) {
    $url = 'http://localhost:3001/api/match-illustrations';
    $data = [
        'content' => $content,
        'targetAge' => $targetAge,
        'contentType' => $contentType,
        'topK' => $topK
    ];
    
    $options = [
        'http' => [
            'header' => "Content-type: application/json\r\n",
            'method' => 'POST',
            'content' => json_encode($data)
        ]
    ];
    
    $context = stream_context_create($options);
    $result = file_get_contents($url, false, $context);
    return json_decode($result, true);
}

// 使用示例
$result = matchIllustrations(
    "小兔子在森林里遇到了一只友善的小熊",
    "3-6岁",
    "睡前故事"
);
print_r($result);
?>
```

## 🎯 核心API

### 1. 智能匹配插图
**POST** `/api/match-illustrations`

根据文案内容智能匹配最合适的插图。

### 2. 关键词搜索
**POST** `/api/search-by-keywords`

基于关键词列表搜索相关插图。

### 3. 批量匹配
**POST** `/api/batch-match`

一次性为多个文案匹配插图，提高处理效率。

### 4. 获取详情
**GET** `/api/illustration/:id`

获取特定插图的详细信息。

## 🔧 高级配置

### 自定义匹配策略

```typescript
// 高相似度优先
const highQualityMatches = await client.matchIllustrations({
  content: textContent,
  targetAge: '3-6岁'
}, 3); // 只要前3个最匹配的

// 多样化结果
const diverseMatches = await client.matchIllustrations({
  content: textContent,
  targetAge: '3-6岁'
}, 15); // 获取更多选择
```

### 结合其他服务

```typescript
class SmartContentGenerator {
  async createIllustratedArticle(title: string, content: string) {
    // 1. 生成或优化内容
    const optimizedContent = await this.optimizeContent(content);
    
    // 2. 匹配插图
    const illustrations = await this.illustrationClient.matchIllustrations({
      content: optimizedContent,
      targetAge: '6-12岁'
    }, 5);
    
    // 3. 选择最佳插图
    const bestMatch = illustrations[0];
    
    // 4. 生成最终文章
    return {
      title,
      content: optimizedContent,
      coverImage: bestMatch?.imageUrl,
      illustrations: illustrations.slice(1, 4) // 其他备选插图
    };
  }
}
```

## 📊 性能优化建议

### 1. 缓存策略
```typescript
const cache = new Map();

async function cachedMatch(content: string) {
  if (cache.has(content)) {
    return cache.get(content);
  }
  
  const result = await client.matchIllustrations({ content });
  cache.set(content, result);
  return result;
}
```

### 2. 批量处理
```typescript
// 推荐：批量处理多个文案
const results = await client.batchMatch([
  { content: "文案1" },
  { content: "文案2" },
  { content: "文案3" }
], 3);

// 不推荐：逐个处理
// for (const content of contents) {
//   await client.matchIllustrations({ content });
// }
```

### 3. 异步处理
```typescript
// 对于非实时需求，可以异步处理
async function processContentAsync(contents: string[]) {
  const promises = contents.map(content => 
    client.matchIllustrations({ content })
  );
  
  return Promise.all(promises);
}
```

## 🚨 常见问题

### Q: 为什么搜索结果为空？
A: 检查以下几点：
- 确认Pinecone索引中有数据
- 检查过滤条件是否过于严格
- 尝试简化搜索内容

### Q: 相似度很低怎么办？
A: 优化建议：
- 使用更具体、描述性的文案
- 添加相关关键词
- 调整目标年龄和内容类型

### Q: API调用失败？
A: 检查步骤：
- 验证环境变量配置
- 确认API密钥有效
- 检查网络连接

## 🎉 下一步

现在您已经掌握了基础用法，可以：

1. 📖 查看 [完整集成指南](./INTEGRATION_GUIDE.md)
2. 🔧 了解 [高级配置选项](./ADVANCED_CONFIGURATION.md)
3. 💡 参考 [最佳实践案例](./BEST_PRACTICES.md)
4. 🐛 遇到问题？查看 [故障排除指南](./TROUBLESHOOTING.md)

---

**💬 需要帮助？**
- 查看项目文档
- 提交GitHub Issue
- 联系技术支持团队 