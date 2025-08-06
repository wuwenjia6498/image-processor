import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { 
  matchIllustrationsToText, 
  searchIllustrationsByKeywords, 
  getIllustrationDetails,
  batchMatchIllustrations,
  TextContent,
  IllustrationMatch
} from '../api/illustration-api';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: false
}));
app.use(express.json({ limit: '10mb' }));

// 添加预检请求处理
app.options('*', cors());

// 添加请求日志中间件
app.use((req, res, next) => {
  console.log(`📥 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log(`📋 Headers:`, req.headers);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`📦 Body:`, JSON.stringify(req.body).substring(0, 200) + '...');
  }
  next();
});

// 添加响应日志中间件
app.use((req, res, next) => {
  const originalSend = res.send;
  res.send = function(data) {
    console.log(`📤 ${new Date().toISOString()} - Response ${res.statusCode} for ${req.method} ${req.path}`);
    return originalSend.call(this, data);
  };
  next();
});

// 根路径 - 提供API文档
app.get('/', (req, res) => {
  res.json({
    service: '图片匹配服务',
    status: 'running',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      matchIllustrations: 'POST /api/match-illustrations',
      searchByKeywords: 'POST /api/search-by-keywords',
      getIllustration: 'GET /api/illustration/:id',
      batchMatch: 'POST /api/batch-match'
    },
    example: {
      url: 'POST /api/match-illustrations',
      body: {
        content: '温馨的家庭场景，父母和孩子一起度过美好时光',
        targetAge: '3-6岁',
        contentType: '睡前故事',
        topK: 5
      }
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '图片匹配服务运行正常' });
});

/**
 * 根据文案内容匹配插图
 * POST /api/match-illustrations
 * Body: {
 *   content: string,
 *   targetAge?: string,
 *   contentType?: string,
 *   theme?: string,
 *   keywords?: string[],
 *   topK?: number
 * }
 */
app.post('/api/match-illustrations', async (req, res) => {
  // 设置响应头，防止连接关闭
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=60, max=1000');
  
  try {
    const { topK = 10, ...textContent }: TextContent & { topK?: number } = req.body;
    
    if (!textContent.content) {
      return res.status(400).json({ 
        success: false,
        error: '缺少必需参数', 
        message: 'content字段是必需的' 
      });
    }

    console.log('🔄 开始处理匹配请求...');
    console.log('📝 文案内容:', textContent.content.substring(0, 50) + '...');
    
    // 设置超时处理
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('请求超时（30秒）')), 30000);
    });
    
    const matchPromise = matchIllustrationsToText(textContent, topK);
    
    console.log('⏳ 执行向量匹配...');
    const matches = await Promise.race([matchPromise, timeoutPromise]) as IllustrationMatch[];
    
    console.log('✅ 匹配完成，找到结果:', matches.length);
    
    const response = {
      success: true,
      data: matches,
      count: matches.length,
      message: `成功找到${matches.length}个匹配的插图`,
      timestamp: new Date().toISOString()
    };
    
    // 确保响应完整发送
    res.status(200).json(response);
    console.log('📤 响应已发送');
    
  } catch (error) {
    console.error('❌ 处理请求时出错:', error);
    
    const errorResponse = {
      success: false,
      error: '插图匹配失败',
      message: error instanceof Error ? error.message : '未知错误',
      timestamp: new Date().toISOString()
    };
    
    res.status(500).json(errorResponse);
    console.log('📤 错误响应已发送');
  }
});

/**
 * 基于关键词搜索插图
 * POST /api/search-by-keywords
 * Body: {
 *   keywords: string[],
 *   targetAge?: string,
 *   contentType?: string,
 *   topK?: number
 * }
 */
app.post('/api/search-by-keywords', async (req, res) => {
  try {
    const { keywords, targetAge, contentType, topK = 10 } = req.body;
    
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({ 
        error: '缺少必需参数', 
        message: 'keywords字段是必需的，且必须是非空数组' 
      });
    }

    console.log('收到关键词搜索请求:', { keywords, targetAge, contentType, topK });
    
    const matches = await searchIllustrationsByKeywords(keywords, targetAge, contentType, topK);
    
    res.json({
      success: true,
      data: matches,
      count: matches.length,
      message: `成功找到${matches.length}个匹配的插图`
    });
    
  } catch (error) {
    console.error('关键词搜索失败:', error);
    res.status(500).json({ 
      success: false,
      error: '关键词搜索失败', 
      message: error instanceof Error ? error.message : '未知错误' 
    });
  }
});

/**
 * 获取插图详情
 * GET /api/illustration/:id
 */
app.get('/api/illustration/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('获取插图详情:', id);
    
    const illustration = await getIllustrationDetails(id);
    
    res.json({
      success: true,
      data: illustration,
      message: '成功获取插图详情'
    });
    
  } catch (error) {
    console.error('获取插图详情失败:', error);
    res.status(500).json({ 
      success: false,
      error: '获取插图详情失败', 
      message: error instanceof Error ? error.message : '未知错误' 
    });
  }
});

/**
 * 批量匹配插图
 * POST /api/batch-match
 * Body: {
 *   textContents: TextContent[],
 *   topKPerText?: number
 * }
 */
app.post('/api/batch-match', async (req, res) => {
  try {
    const { textContents, topKPerText = 5 } = req.body;
    
    if (!textContents || !Array.isArray(textContents) || textContents.length === 0) {
      return res.status(400).json({ 
        error: '缺少必需参数', 
        message: 'textContents字段是必需的，且必须是非空数组' 
      });
    }

    console.log('收到批量匹配请求:', { count: textContents.length, topKPerText });
    
    const results = await batchMatchIllustrations(textContents, topKPerText);
    
    res.json({
      success: true,
      data: results,
      count: Object.keys(results).length,
      message: `成功处理${Object.keys(results).length}个文案的插图匹配`
    });
    
  } catch (error) {
    console.error('批量匹配失败:', error);
    res.status(500).json({ 
      success: false,
      error: '批量匹配失败', 
      message: error instanceof Error ? error.message : '未知错误' 
    });
  }
});

// 错误处理中间件
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('服务器错误:', err);
  res.status(500).json({ 
    success: false,
    error: '服务器内部错误', 
    message: err.message 
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: '接口不存在', 
    message: `未找到路径: ${req.path}` 
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 图片匹配服务启动成功！`);
  console.log(`🌐 服务地址: http://localhost:${PORT}`);
  console.log(`📚 API文档:`);
  console.log(`   POST /api/match-illustrations - 根据文案匹配插图`);
  console.log(`   POST /api/search-by-keywords - 根据关键词搜索插图`);
  console.log(`   GET  /api/illustration/:id - 获取插图详情`);
  console.log(`   POST /api/batch-match - 批量匹配插图`);
  console.log(`   GET  /health - 健康检查`);
});

export default app; 