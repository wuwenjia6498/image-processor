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
      .filter(record => record.original_embedding && record.original_embedding.length > 0) // 只处理有向量数据的记录
      .map(record => {
        // 使用数据库中存储的真实向量
        const imageVector = record.original_embedding;
        
        // 计算余弦相似度
        // 确保向量是数字数组格式
        const queryVector = Array.isArray(vector) ? vector : Array.from(vector);
        
        // 处理VECTOR类型字符串 - Supabase返回的VECTOR类型是字符串格式
        let imageVectorArray: number[];
        if (typeof imageVector === 'string') {
          // 解析字符串格式的向量: "[0.1,0.2,0.3,...]"
          try {
            imageVectorArray = JSON.parse(imageVector);
          } catch (error) {
            console.error('向量字符串解析失败:', error, imageVector.substring(0, 100));
            return { id: record.id, score: 0, metadata: { filename: record.filename, book_title: record.book_title, description: record.original_description, image_url: record.image_url } };
          }
        } else if (Array.isArray(imageVector)) {
          imageVectorArray = imageVector;
        } else {
          imageVectorArray = Array.from(imageVector);
        }
        
        const similarity = cosineSimilarity(queryVector, imageVectorArray);
        
        // 向量处理验证
        if (queryVector.length !== imageVectorArray.length) {
          console.warn(`⚠️ 向量维度不匹配: 查询向量${queryVector.length}维 vs 图片向量${imageVectorArray.length}维`);
        }
        
        return {
          id: record.id,
          score: similarity,
          metadata: {
            filename: record.filename,
            book_title: record.book_title,
            description: record.original_description,
            image_url: record.image_url
          }
        };
      });

    // 过滤掉无效的相似度值（NaN, Infinity等）
    const validResults = results.filter(r => 
      r.score !== null && 
      r.score !== undefined && 
      !isNaN(r.score) && 
      isFinite(r.score)
    );
    
    // 按相似度排序并返回前topK个结果
    validResults.sort((a, b) => (b.score || 0) - (a.score || 0));
    const topResults = validResults.slice(0, topK);
    
    if (topResults.length > 0) {
      const scores = topResults.map(r => r.score);
      console.log(`📊 相似度范围: ${Math.min(...scores).toFixed(3)} - ${Math.max(...scores).toFixed(3)}`);
    } else {
      console.log('📊 没有找到有效的相似度匹配结果');
    }
    
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