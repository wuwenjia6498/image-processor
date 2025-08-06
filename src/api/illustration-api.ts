import { supabase } from '../lib/supabase';
import { vectorizeText, getVectorDimension } from './vectorization-proxy';

export interface IllustrationMatch {
  id: string;
  filename: string;
  bookTitle: string;
  description: string;
  imageUrl: string;
  similarity: number;
  metadata: {
    bookTheme?: string;
    keywords?: string[];
  };
}

export interface TextContent {
  content: string;
  theme?: string;
  keywords?: string[];
}

/**
 * 将文案内容转换为向量
 * ✅ 已修复：现在使用安全的向量化代理服务
 */
export async function textToVector(text: string): Promise<number[]> {
  console.log('📝 使用安全向量化代理服务处理文案...');
  return vectorizeText(text);
}

/**
 * 简单的余弦相似度计算
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    return 0;
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 模拟Pinecone查询（在浏览器环境中）
 * 使用数据库中存储的真实向量数据进行相似度计算
 */
async function mockPineconeQuery(vector: number[], topK: number = 10): Promise<any[]> {
  try {
    console.log('🔍 执行真实向量相似度搜索...');
    
    // 从数据库获取所有图片记录（包含向量数据）
    const { data: records, error } = await supabase
      .from('illustrations_optimized')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`数据库查询失败: ${error.message}`);
    }

    if (!records || records.length === 0) {
      return [];
    }

    // 使用真实的图片向量计算相似度
    const results = records
      .filter(record => record.vector_embedding && record.vector_embedding.length > 0) // 只处理有向量数据的记录
      .map(record => {
        // 使用数据库中存储的真实向量
        const imageVector = record.vector_embedding;
        
        // 计算余弦相似度
        const similarity = cosineSimilarity(vector, imageVector);
        
        return {
          id: record.id,
          score: similarity,
          metadata: {
            filename: record.filename,
            book_title: record.book_title,
            description: record.ai_description,
            image_url: record.image_url
          }
        };
      });

    // 按相似度排序并返回前topK个结果
    results.sort((a, b) => (b.score || 0) - (a.score || 0));
    const topResults = results.slice(0, topK);
    
    console.log(`📊 相似度范围: ${Math.min(...topResults.map(r => r.score)).toFixed(3)} - ${Math.max(...topResults.map(r => r.score)).toFixed(3)}`);
    
    return topResults;
    
  } catch (error) {
    console.error('向量相似度搜索失败:', error);
    return [];
  }
}

/**
 * 核心API：根据文案内容智能匹配插图
 * @param textContent 文案内容和要求
 * @param topK 返回结果数量，默认10
 * @returns 匹配的插图列表
 */
export async function matchIllustrationsToText(
  textContent: TextContent,
  topK: number = 10
): Promise<IllustrationMatch[]> {
  try {
    // 1. 将文案转换为向量
    console.log('🔄 将文案转换为1536维向量...');
    const textVector = await textToVector(textContent.content);
    
    // 验证向量维度
    const expectedDim = getVectorDimension();
    if (textVector.length !== expectedDim) {
      throw new Error(`向量维度不匹配: 期望${expectedDim}维，实际${textVector.length}维`);
    }
    
    // 2. 执行查询（使用模拟查询）
    console.log('🔍 执行语义相似度搜索...');
    const queryResponse = await mockPineconeQuery(textVector, topK);
    
    // 3. 处理搜索结果
    const matches: IllustrationMatch[] = queryResponse.map(match => ({
      id: match.id,
      filename: String(match.metadata?.filename || ''),
      bookTitle: String(match.metadata?.book_title || ''),
      description: String(match.metadata?.description || ''),
      imageUrl: String(match.metadata?.image_url || ''),
      similarity: match.score || 0,
      metadata: {
        bookTheme: match.metadata?.book_theme ? String(match.metadata.book_theme) : undefined,
        keywords: Array.isArray(match.metadata?.keywords) ? match.metadata.keywords.map(String) : []
      }
    }));
    
    console.log(`✅ 找到 ${matches.length} 个匹配的插图（基于语义相似度）`);
    return matches;
    
  } catch (error) {
    console.error('插图匹配失败:', error);
    throw new Error('插图匹配失败');
  }
}

/**
 * 基于关键词的插图搜索
 * @param keywords 关键词数组
 * @param topK 返回结果数量
 * @returns 匹配的插图列表
 */
export async function searchIllustrationsByKeywords(
  keywords: string[],
  topK: number = 10
): Promise<IllustrationMatch[]> {
  try {
    // 1. 将关键词组合成搜索文本
    const searchText = keywords.join(' ');
    const searchVector = await textToVector(searchText);
    
    // 2. 执行搜索
    const queryResponse = await mockPineconeQuery(searchVector, topK);
    
    // 3. 处理结果
    const matches: IllustrationMatch[] = queryResponse.map(match => ({
      id: match.id,
      filename: String(match.metadata?.filename || ''),
      bookTitle: String(match.metadata?.book_title || ''),
      description: String(match.metadata?.description || ''),
      imageUrl: String(match.metadata?.image_url || ''),
      similarity: match.score || 0,
      metadata: {
        bookTheme: match.metadata?.book_theme ? String(match.metadata.book_theme) : undefined,
        keywords: Array.isArray(match.metadata?.keywords) ? match.metadata.keywords.map(String) : []
      }
    }));
    
    return matches;
    
  } catch (error) {
    console.error('关键词搜索失败:', error);
    throw new Error('关键词搜索失败');
  }
}

/**
 * 获取插图详情
 * @param illustrationId 插图ID
 * @returns 插图详细信息
 */
export async function getIllustrationDetails(illustrationId: string): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('illustrations_optimized')
      .select('*')
      .eq('id', illustrationId)
      .single();
      
    if (error) {
      throw new Error(`获取插图详情失败: ${error.message}`);
    }
    
    return data;
  } catch (error) {
    console.error('获取插图详情失败:', error);
    throw error;
  }
}

/**
 * 批量获取推荐插图
 * @param textContents 多个文案内容
 * @param topKPerText 每个文案返回的插图数量
 * @returns 所有匹配结果
 */
export async function batchMatchIllustrations(
  textContents: TextContent[],
  topKPerText: number = 5
): Promise<{ [index: number]: IllustrationMatch[] }> {
  const results: { [index: number]: IllustrationMatch[] } = {};
  
  for (let i = 0; i < textContents.length; i++) {
    try {
      console.log(`📦 处理第${i+1}/${textContents.length}个文案...`);
      results[i] = await matchIllustrationsToText(textContents[i], topKPerText);
    } catch (error) {
      console.error(`处理第${i+1}个文案失败:`, error);
      results[i] = [];
    }
  }
  
  return results;
} 