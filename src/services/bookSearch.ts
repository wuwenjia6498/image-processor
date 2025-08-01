import dotenv from 'dotenv';

// 配置 dotenv 以加载根目录下的 .env.local 文件
dotenv.config({ path: '.env.local' });

interface SearchResult {
  title: string;
  snippet: string;
  link: string;
}

interface BookInfo {
  title: string;
  summary: string;
  theme: string;
  targetAudience: string;
  author: string;
  reviews: string[];
}

/**
 * 使用Serper API搜索绘本信息
 */
export async function searchBookInfo(bookTitle: string): Promise<SearchResult[]> {
  try {
    console.log(`🔍 正在搜索绘本《${bookTitle}》的信息...`);
    
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.SERPER_API_KEY!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: `${bookTitle} 绘本 简介 主题 内容 作者 评价`,
        num: 10,
        gl: 'cn',
        hl: 'zh-cn',
        type: 'search'
      })
    });

    if (!response.ok) {
      throw new Error(`Serper API 请求失败: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.organic && Array.isArray(data.organic)) {
      const results = data.organic.map((result: any) => ({
        title: result.title || '',
        snippet: result.snippet || '',
        link: result.link || ''
      }));
      
      console.log(`✅ 搜索完成，找到 ${results.length} 条结果`);
      return results;
    } else {
      console.log('⚠️ 未找到搜索结果');
      return [];
    }
  } catch (error) {
    console.error(`❌ 搜索绘本信息失败: ${error instanceof Error ? error.message : '未知错误'}`);
    return [];
  }
}

/**
 * 从搜索结果中提取绘本信息
 */
export function extractBookInfo(searchResults: SearchResult[]): BookInfo {
  const bookInfo: BookInfo = {
    title: '',
    summary: '',
    theme: '',
    targetAudience: '',
    author: '',
    reviews: []
  };

  if (searchResults.length === 0) {
    return bookInfo;
  }

  // 合并所有搜索结果
  const allText = searchResults.map(result => `${result.title} ${result.snippet}`).join(' ');

  // 提取作者信息
  const authorMatch = allText.match(/作者[：:]\s*([^，。\s]+)/);
  if (authorMatch) {
    bookInfo.author = authorMatch[1];
  }

  // 提取目标读者信息
  const audienceMatch = allText.match(/(适合|适合年龄|目标读者)[：:]\s*([^，。\s]+)/);
  if (audienceMatch) {
    bookInfo.targetAudience = audienceMatch[2];
  }

  // 提取主题信息
  const themeMatch = allText.match(/(主题|主旨|寓意)[：:]\s*([^，。\s]+)/);
  if (themeMatch) {
    bookInfo.theme = themeMatch[2];
  }

  // 提取评价信息
  searchResults.forEach(result => {
    if (result.snippet.includes('评价') || result.snippet.includes('推荐') || result.snippet.includes('好评')) {
      bookInfo.reviews.push(result.snippet);
    }
  });

  // 生成摘要
  bookInfo.summary = searchResults.slice(0, 3).map(result => result.snippet).join(' ');

  return bookInfo;
}

/**
 * 构建增强的提示词
 */
export function buildEnhancedPrompt(bookTitle: string, searchResults: SearchResult[]): string {
  if (searchResults.length === 0) {
    return `请为这本绘本《${bookTitle}》的插图生成一个详细的中文描述，包括画面内容、风格特点、情感氛围等。`;
  }

  const bookInfo = extractBookInfo(searchResults);
  
  // 构建搜索结果摘要
  const searchSummary = searchResults
    .slice(0, 5)
    .map((result, index) => `${index + 1}. ${result.title}: ${result.snippet}`)
    .join('\n\n');

  return `基于以下网络搜索结果，分析这本绘本《${bookTitle}》：

${searchSummary}

${bookInfo.author ? `作者信息：${bookInfo.author}` : ''}
${bookInfo.targetAudience ? `目标读者：${bookInfo.targetAudience}` : ''}
${bookInfo.theme ? `主题：${bookInfo.theme}` : ''}

请基于以上真实信息，分析这张插图并生成详细的中文描述，包括：
1. 画面内容与绘本故事情节的对应关系
2. 艺术风格与绘本整体特色的呼应
3. 情感氛围与绘本主题的契合度
4. 插图在绘本中的作用和意义
5. 对目标读者的教育价值和启发意义

请确保描述准确、详细，并充分体现绘本的真实主旨和艺术特色。`;
} 