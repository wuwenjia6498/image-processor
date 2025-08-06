/**
 * 图片匹配客户端SDK使用示例
 * 展示如何在其他项目中集成图片匹配功能
 */

// 方式1: 直接导入API函数（适用于同一个项目内）
import { 
  matchIllustrationsToText, 
  searchIllustrationsByKeywords,
  TextContent,
  IllustrationMatch
} from '../src/api/illustration-api';

// 方式2: HTTP客户端SDK（适用于跨项目调用）
class IllustrationClient {
  private baseUrl: string;
  
  constructor(baseUrl: string = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }

  /**
   * 根据文案内容匹配插图
   */
  async matchIllustrations(textContent: TextContent, topK: number = 10): Promise<IllustrationMatch[]> {
    const response = await fetch(`${this.baseUrl}/api/match-illustrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...textContent, topK })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || '匹配失败');
    }

    return result.data;
  }

  /**
   * 基于关键词搜索插图
   */
  async searchByKeywords(
    keywords: string[], 
    targetAge?: string, 
    contentType?: string, 
    topK: number = 10
  ): Promise<IllustrationMatch[]> {
    const response = await fetch(`${this.baseUrl}/api/search-by-keywords`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ keywords, targetAge, contentType, topK })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || '搜索失败');
    }

    return result.data;
  }

  /**
   * 批量匹配插图
   */
  async batchMatch(textContents: TextContent[], topKPerText: number = 5): Promise<{ [index: number]: IllustrationMatch[] }> {
    const response = await fetch(`${this.baseUrl}/api/batch-match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ textContents, topKPerText })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || '批量匹配失败');
    }

    return result.data;
  }

  /**
   * 获取插图详情
   */
  async getIllustrationDetails(id: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/illustration/${id}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || '获取详情失败');
    }

    return result.data;
  }
}

// 使用示例
async function demonstrateUsage() {
  console.log('🎯 图片匹配功能使用示例\n');

  // 初始化客户端
  const client = new IllustrationClient('http://localhost:3001');

  try {
    // 示例1: 根据文案内容匹配插图
    console.log('📝 示例1: 根据文案内容匹配插图');
    const textContent: TextContent = {
      content: '小兔子在森林里遇到了一只友善的小熊，它们一起在花丛中玩耍，阳光透过树叶洒在它们身上，整个画面充满了温馨和快乐的氛围。',
      targetAge: '3-6岁',
      contentType: '睡前故事',
      keywords: ['小兔子', '小熊', '森林', '友谊', '温馨']
    };

    const matches = await client.matchIllustrations(textContent, 5);
    console.log(`✅ 找到 ${matches.length} 个匹配的插图:`);
    matches.forEach((match, index) => {
      console.log(`  ${index + 1}. ${match.bookTitle} - ${match.filename}`);
      console.log(`     相似度: ${(match.similarity * 100).toFixed(1)}%`);
      console.log(`     描述: ${match.description.substring(0, 100)}...`);
      console.log(`     年龄定向: ${match.metadata.ageOrientation}`);
      console.log(`     内容类型: ${match.metadata.textTypeFit}\n`);
    });

    // 示例2: 基于关键词搜索插图
    console.log('🔍 示例2: 基于关键词搜索插图');
    const keywordMatches = await client.searchByKeywords(
      ['动物', '友谊', '森林'], 
      '3-6岁', 
      '睡前故事', 
      3
    );
    console.log(`✅ 找到 ${keywordMatches.length} 个关键词匹配的插图:`);
    keywordMatches.forEach((match, index) => {
      console.log(`  ${index + 1}. ${match.bookTitle} - 相似度: ${(match.similarity * 100).toFixed(1)}%`);
    });

    // 示例3: 批量匹配多个文案
    console.log('\n📚 示例3: 批量匹配多个文案');
    const multipleTexts: TextContent[] = [
      {
        content: '勇敢的小王子踏上了寻找星星的旅程',
        targetAge: '6-12岁',
        contentType: '冒险故事'
      },
      {
        content: '花园里的蝴蝶们在花朵间翩翩起舞',
        targetAge: '3-6岁',
        contentType: '自然科普'
      }
    ];

    const batchResults = await client.batchMatch(multipleTexts, 3);
    console.log(`✅ 批量处理了 ${Object.keys(batchResults).length} 个文案:`);
    Object.entries(batchResults).forEach(([index, matches]) => {
      console.log(`  文案${parseInt(index) + 1}: 找到 ${matches.length} 个匹配插图`);
    });

  } catch (error) {
    console.error('❌ 演示过程中出错:', error);
  }
}

// 实际项目集成示例
class ContentGenerator {
  private illustrationClient: IllustrationClient;

  constructor(illustrationServiceUrl: string) {
    this.illustrationClient = new IllustrationClient(illustrationServiceUrl);
  }

  /**
   * 生成文案并自动匹配插图
   * 这是您在其他项目中可能需要的核心功能
   */
  async generateContentWithIllustrations(
    textContent: string,
    targetAge?: string,
    contentType?: string
  ): Promise<{
    content: string;
    illustrations: IllustrationMatch[];
    bestMatch?: IllustrationMatch;
  }> {
    try {
      // 1. 分析文案，提取关键词（这里简化处理）
      const keywords = this.extractKeywords(textContent);
      
      // 2. 构建搜索条件
      const searchCriteria: TextContent = {
        content: textContent,
        targetAge,
        contentType,
        keywords
      };

      // 3. 匹配插图
      const illustrations = await this.illustrationClient.matchIllustrations(searchCriteria, 10);
      
      // 4. 选择最佳匹配（相似度最高的）
      const bestMatch = illustrations.length > 0 ? illustrations[0] : undefined;

      console.log(`🎨 为文案匹配到 ${illustrations.length} 个插图，最佳匹配相似度: ${bestMatch ? (bestMatch.similarity * 100).toFixed(1) + '%' : '无'}`);

      return {
        content: textContent,
        illustrations,
        bestMatch
      };

    } catch (error) {
      console.error('生成内容时出错:', error);
      return {
        content: textContent,
        illustrations: [],
        bestMatch: undefined
      };
    }
  }

  /**
   * 简单的关键词提取（实际项目中可能需要更复杂的NLP处理）
   */
  private extractKeywords(text: string): string[] {
    // 这里是一个简化的关键词提取示例
    // 实际项目中您可能会使用更复杂的NLP库
    const commonWords = ['的', '了', '在', '是', '和', '与', '或', '但', '然而', '因为', '所以'];
    const words = text.split(/[\s，。！？；：、]+/).filter(word => 
      word.length > 1 && !commonWords.includes(word)
    );
    return words.slice(0, 5); // 返回前5个关键词
  }
}

// 导出供其他项目使用
export { IllustrationClient, ContentGenerator };

// 如果直接运行此文件，执行演示
if (require.main === module) {
  demonstrateUsage().catch(console.error);
} 