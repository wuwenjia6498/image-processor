# 图片描述与匹配功能集成指南

本指南将详细说明如何将当前的图片描述功能集成到其他项目中，实现文案生成后自动匹配合适插图的功能。

## 🎯 功能概述

当前系统提供以下核心功能：

1. **智能图片描述生成**：使用OpenAI GPT-4 Vision API自动生成图片的详细描述
2. **语义搜索匹配**：基于Pinecone向量数据库的语义相似度搜索
3. **多维度过滤**：支持按年龄段、内容类型、主题等条件筛选
4. **批量处理**：支持批量文案的插图匹配

## 📋 集成方案

### 方案一：API服务集成（推荐）

适用于跨项目、跨语言的集成场景。

#### 1. 启动图片匹配服务

```bash
# 安装依赖
npm install express cors @types/express @types/cors

# 添加启动脚本到package.json
"scripts": {
  "start-illustration-service": "tsx src/server/illustration-server.ts"
}

# 启动服务
npm run start-illustration-service
```

服务将在 `http://localhost:3001` 启动，提供以下API接口：

#### 2. API接口文档

##### POST /api/match-illustrations
根据文案内容智能匹配插图

**请求体：**
```json
{
  "content": "小兔子在森林里遇到了一只友善的小熊...",
  "targetAge": "3-6岁",
  "contentType": "睡前故事",
  "keywords": ["小兔子", "小熊", "森林"],
  "topK": 10
}
```

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": "img_001",
      "filename": "rabbit_bear_forest.jpg",
      "bookTitle": "森林里的友谊",
      "description": "画面中小兔子和小熊在阳光斑驳的森林中...",
      "imageUrl": "https://your-storage.com/images/rabbit_bear_forest.jpg",
      "similarity": 0.95,
      "metadata": {
        "ageOrientation": "3-6岁",
        "textTypeFit": "睡前故事",
        "bookTheme": "友谊与成长",
        "keywords": ["小兔子", "小熊", "森林", "友谊"]
      }
    }
  ],
  "count": 1,
  "message": "成功找到1个匹配的插图"
}
```

##### POST /api/search-by-keywords
基于关键词搜索插图

**请求体：**
```json
{
  "keywords": ["动物", "友谊", "森林"],
  "targetAge": "3-6岁",
  "contentType": "睡前故事",
  "topK": 5
}
```

##### POST /api/batch-match
批量匹配多个文案

**请求体：**
```json
{
  "textContents": [
    {
      "content": "第一个文案内容...",
      "targetAge": "3-6岁",
      "contentType": "睡前故事"
    },
    {
      "content": "第二个文案内容...",
      "targetAge": "6-12岁",
      "contentType": "冒险故事"
    }
  ],
  "topKPerText": 5
}
```

##### GET /api/illustration/:id
获取特定插图的详细信息

#### 3. 客户端SDK使用

```typescript
import { IllustrationClient } from './path/to/illustration-client';

// 初始化客户端
const client = new IllustrationClient('http://localhost:3001');

// 匹配插图
const matches = await client.matchIllustrations({
  content: '您的文案内容',
  targetAge: '3-6岁',
  contentType: '睡前故事'
}, 10);

console.log('匹配到的插图:', matches);
```

### 方案二：直接模块集成

适用于Node.js项目的直接集成。

#### 1. 复制核心文件

将以下文件复制到您的项目中：
- `src/api/illustration-api.ts` - 核心API函数
- `src/services/enhanced-ai-service.ts` - AI服务
- `src/services/cloud-ai-service.ts` - 云端AI服务

#### 2. 安装依赖

```bash
npm install @pinecone-database/pinecone openai @supabase/supabase-js
```

#### 3. 配置环境变量

```bash
# OpenAI API配置
OPENAI_API_KEY="your_openai_api_key"
OPENAI_BASE_URL="https://api.openai.com/v1"  # 可选

# Pinecone配置
PINECONE_API_KEY="your_pinecone_api_key"
PINECONE_INDEX_NAME="your_index_name"

# Supabase配置
SUPABASE_URL="your_supabase_url"
SUPABASE_SERVICE_ROLE_KEY="your_supabase_key"
```

#### 4. 直接使用

```typescript
import { matchIllustrationsToText, TextContent } from './api/illustration-api';

const textContent: TextContent = {
  content: '您的文案内容',
  targetAge: '3-6岁',
  contentType: '睡前故事',
  keywords: ['关键词1', '关键词2']
};

const matches = await matchIllustrationsToText(textContent, 10);
```

## 🚀 实际项目集成示例

### 示例1：内容管理系统集成

```typescript
class ContentManagementSystem {
  private illustrationClient: IllustrationClient;

  constructor() {
    this.illustrationClient = new IllustrationClient('http://localhost:3001');
  }

  /**
   * 创建带插图的文章
   */
  async createArticleWithIllustrations(
    title: string,
    content: string,
    targetAge: string,
    contentType: string
  ) {
    // 1. 保存文章基本信息
    const article = await this.saveArticle({ title, content, targetAge, contentType });

    // 2. 匹配插图
    const illustrations = await this.illustrationClient.matchIllustrations({
      content,
      targetAge,
      contentType
    }, 5);

    // 3. 选择最佳插图
    const bestIllustration = illustrations[0];
    if (bestIllustration) {
      await this.attachIllustrationToArticle(article.id, bestIllustration);
    }

    return {
      article,
      illustrations,
      bestIllustration
    };
  }

  private async saveArticle(data: any) {
    // 您的文章保存逻辑
    return { id: 'article_123', ...data };
  }

  private async attachIllustrationToArticle(articleId: string, illustration: any) {
    // 您的插图关联逻辑
    console.log(`为文章 ${articleId} 添加插图: ${illustration.filename}`);
  }
}
```

### 示例2：自动化内容生成

```typescript
class AutoContentGenerator {
  private illustrationClient: IllustrationClient;

  constructor() {
    this.illustrationClient = new IllustrationClient('http://localhost:3001');
  }

  /**
   * 根据主题自动生成带插图的内容
   */
  async generateIllustratedContent(theme: string, targetAge: string) {
    // 1. 生成文案（这里简化，实际可能调用GPT等）
    const content = await this.generateTextContent(theme, targetAge);

    // 2. 匹配插图
    const illustrations = await this.illustrationClient.matchIllustrations({
      content,
      targetAge,
      theme
    }, 3);

    // 3. 组合结果
    return {
      content,
      illustrations,
      recommendedIllustration: illustrations[0]
    };
  }

  private async generateTextContent(theme: string, targetAge: string): Promise<string> {
    // 您的文案生成逻辑
    return `基于主题"${theme}"为${targetAge}儿童生成的故事内容...`;
  }
}
```

### 示例3：React组件集成

```tsx
import React, { useState, useEffect } from 'react';
import { IllustrationClient, IllustrationMatch } from './utils/illustration-client';

const ContentEditor: React.FC = () => {
  const [content, setContent] = useState('');
  const [illustrations, setIllustrations] = useState<IllustrationMatch[]>([]);
  const [selectedIllustration, setSelectedIllustration] = useState<IllustrationMatch | null>(null);
  const [loading, setLoading] = useState(false);

  const illustrationClient = new IllustrationClient();

  const handleContentChange = async (newContent: string) => {
    setContent(newContent);
    
    if (newContent.length > 50) { // 内容足够长时才搜索
      setLoading(true);
      try {
        const matches = await illustrationClient.matchIllustrations({
          content: newContent,
          targetAge: '3-6岁',
          contentType: '睡前故事'
        }, 6);
        setIllustrations(matches);
      } catch (error) {
        console.error('搜索插图失败:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="content-editor">
      <div className="editor-panel">
        <textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="输入您的文案内容..."
          className="content-textarea"
        />
      </div>
      
      <div className="illustration-panel">
        <h3>推荐插图</h3>
        {loading && <div>正在搜索匹配的插图...</div>}
        
        <div className="illustration-grid">
          {illustrations.map((illustration) => (
            <div 
              key={illustration.id}
              className={`illustration-item ${selectedIllustration?.id === illustration.id ? 'selected' : ''}`}
              onClick={() => setSelectedIllustration(illustration)}
            >
              <img src={illustration.imageUrl} alt={illustration.description} />
              <div className="illustration-info">
                <div className="similarity">相似度: {(illustration.similarity * 100).toFixed(1)}%</div>
                <div className="book-title">{illustration.bookTitle}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {selectedIllustration && (
        <div className="selected-illustration">
          <h4>已选择插图</h4>
          <img src={selectedIllustration.imageUrl} alt={selectedIllustration.description} />
          <p>{selectedIllustration.description}</p>
        </div>
      )}
    </div>
  );
};

export default ContentEditor;
```

## ⚙️ 配置说明

### 环境变量配置

创建 `.env` 文件并配置以下变量：

```bash
# 必需配置
OPENAI_API_KEY="sk-..."                    # OpenAI API密钥
PINECONE_API_KEY="..."                     # Pinecone API密钥
PINECONE_INDEX_NAME="illustrations"        # Pinecone索引名称
SUPABASE_URL="https://..."                 # Supabase项目URL
SUPABASE_SERVICE_ROLE_KEY="..."            # Supabase服务密钥

# 可选配置
OPENAI_BASE_URL="https://api.openai.com/v1" # OpenAI API基础URL
PORT=3001                                   # 服务端口
USE_CLOUD_AI=true                          # 是否使用云端AI
```

### 数据库结构

确保您的Supabase数据库包含 `illustrations_optimized` 表：

```sql
CREATE TABLE illustrations_optimized (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  book_title TEXT,
  description TEXT,
  image_url TEXT,
  age_orientation TEXT,
  text_type_fit TEXT,
  book_theme TEXT,
  keywords TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Pinecone索引配置

创建Pinecone索引时使用以下配置：
- 维度：1536（与OpenAI text-embedding-3-small兼容）
- 距离度量：cosine
- 云服务商：根据需要选择

## 🔧 故障排除

### 常见问题

1. **API调用失败**
   - 检查环境变量是否正确配置
   - 确认API密钥有效且有足够额度
   - 检查网络连接和代理设置

2. **搜索结果为空**
   - 确认Pinecone索引中有数据
   - 检查过滤条件是否过于严格
   - 尝试调整搜索参数

3. **相似度较低**
   - 优化文案内容的描述性
   - 增加相关关键词
   - 调整搜索策略

### 性能优化

1. **缓存策略**
   ```typescript
   // 实现简单的内存缓存
   const cache = new Map<string, IllustrationMatch[]>();
   
   async function cachedMatchIllustrations(textContent: TextContent, topK: number) {
     const cacheKey = JSON.stringify({ textContent, topK });
     if (cache.has(cacheKey)) {
       return cache.get(cacheKey)!;
     }
     
     const result = await matchIllustrationsToText(textContent, topK);
     cache.set(cacheKey, result);
     return result;
   }
   ```

2. **批量处理**
   - 对于大量文案，使用批量API接口
   - 实现请求队列和限流

3. **异步处理**
   - 将插图匹配作为后台任务处理
   - 使用消息队列系统

## 📞 技术支持

如果在集成过程中遇到问题，请：

1. 检查本文档的故障排除部分
2. 查看项目的GitHub Issues
3. 联系技术支持团队

## 🔄 版本更新

定期检查项目更新，获取最新功能和修复：

```bash
git pull origin main
npm install
npm run build
```

---

**注意**：本集成指南基于当前项目结构编写，如有变动请及时更新文档。 