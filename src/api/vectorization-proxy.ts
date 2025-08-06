import { OpenAI } from 'openai';

// 浏览器环境下的配置
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY!,
  baseURL: import.meta.env.VITE_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL,
  dangerouslyAllowBrowser: true // 允许在浏览器中使用（注意安全风险）
});

/**
 * 向量化代理API
 * 通过OpenAI API处理向量化请求
 */

export interface VectorizationRequest {
  text: string;
  model?: string;
}

export interface VectorizationResponse {
  vector: number[];
  dimension: number;
  model: string;
}

/**
 * 通过OpenAI API进行文本向量化
 * @param text 要向量化的文本
 * @param model 使用的模型，默认为text-embedding-3-small
 * @returns 向量化结果
 */
export async function vectorizeText(text: string, model: string = 'text-embedding-3-small'): Promise<number[]> {
  try {
    console.log('📝 向量化文本:', text.substring(0, 50) + '...');
    
    // 使用真实的OpenAI API
    const response = await openai.embeddings.create({
      model: model,
      input: text,
    });
    
    const vector = response.data[0].embedding;
    
    console.log(`✅ 向量化完成: ${vector.length}维`);
    return vector;
    
  } catch (error) {
    console.error('向量化失败:', error);
    throw new Error('向量化失败');
  }
}

/**
 * 批量向量化
 * @param texts 文本数组
 * @param model 使用的模型
 * @returns 向量数组
 */
export async function batchVectorizeTexts(texts: string[], model: string = 'text-embedding-3-small'): Promise<number[][]> {
  const vectors: number[][] = [];
  
  for (let i = 0; i < texts.length; i++) {
    console.log(`📦 批量处理 ${i + 1}/${texts.length}`);
    const vector = await vectorizeText(texts[i], model);
    vectors.push(vector);
    
    // 添加延迟避免API限制
    if (i < texts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  return vectors;
}

/**
 * 获取向量维度
 */
export function getVectorDimension(): number {
  return 1536; // text-embedding-3-small 模型的维度
}

/**
 * 获取默认模型
 */
export function getDefaultModel(): string {
  return 'text-embedding-3-small';
} 