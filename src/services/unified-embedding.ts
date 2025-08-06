import { OpenAI } from 'openai';

// 浏览器环境下的配置
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY!,
  baseURL: import.meta.env.VITE_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL,
  dangerouslyAllowBrowser: true // 允许在浏览器中使用（注意安全风险）
});

/**
 * 统一的文本向量化服务
 * 确保图片描述和文案使用相同的embedding模型和维度
 */
export class UnifiedEmbeddingService {
  private static readonly MODEL = 'text-embedding-3-small';
  private static readonly DIMENSION = 1536;

  /**
   * 将文本转换为向量
   * @param text 文本内容
   * @returns 1536维向量
   */
  static async textToVector(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: this.MODEL,
        input: text,
      });
      
      const vector = response.data[0].embedding;
      
      // 验证维度
      if (vector.length !== this.DIMENSION) {
        throw new Error(`向量维度不匹配，期望${this.DIMENSION}，实际${vector.length}`);
      }
      
      console.log(`✅ 向量化完成: ${vector.length}维`);
      return vector;
    } catch (error) {
      console.error('文本向量化失败:', error);
      throw new Error('文本向量化失败');
    }
  }

  /**
   * 将图片描述转换为向量
   * @param imageDescription AI生成的图片描述
   * @returns 1536维向量
   */
  static async imageDescriptionToVector(imageDescription: string): Promise<number[]> {
    console.log('🖼️ 图片描述向量化:', imageDescription.substring(0, 50) + '...');
    // 使用相同的向量化方法确保维度一致
    return UnifiedEmbeddingService.textToVector(imageDescription);
  }

  /**
   * 将文案转换为向量
   * @param textContent 文案内容
   * @returns 1536维向量
   */
  static async contentToVector(textContent: string): Promise<number[]> {
    console.log('📝 文案向量化:', textContent.substring(0, 50) + '...');
    return UnifiedEmbeddingService.textToVector(textContent);
  }

  /**
   * 获取向量维度
   */
  static getDimension(): number {
    return UnifiedEmbeddingService.DIMENSION;
  }

  /**
   * 获取使用的模型名称
   */
  static getModel(): string {
    return UnifiedEmbeddingService.MODEL;
  }

  /**
   * 批量向量化
   * @param texts 文本数组
   * @returns 向量数组
   */
  static async batchTextToVector(texts: string[]): Promise<number[][]> {
    const vectors: number[][] = [];
    
    // 分批处理避免API限制
    const batchSize = 10;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      console.log(`📦 批量处理 ${i + 1}-${Math.min(i + batchSize, texts.length)}/${texts.length}`);
      
      const batchVectors = await Promise.all(
        batch.map(text => UnifiedEmbeddingService.textToVector(text))
      );
      vectors.push(...batchVectors);
      
      // 添加延迟避免API限制
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return vectors;
  }

  /**
   * 验证向量是否有效
   * @param vector 向量数组
   * @returns 是否有效
   */
  static validateVector(vector: number[]): boolean {
    return Array.isArray(vector) && 
           vector.length === this.DIMENSION && 
           vector.every(val => typeof val === 'number' && !isNaN(val));
  }

  /**
   * 生成模拟向量（用于测试）
   * @returns 1536维模拟向量
   */
  static generateMockVector(): number[] {
    return Array.from({ length: this.DIMENSION }, () => Math.random() * 2 - 1);
  }
}

// 导出便捷函数
export const textToVector = UnifiedEmbeddingService.textToVector;
export const imageDescriptionToVector = UnifiedEmbeddingService.imageDescriptionToVector;
export const contentToVector = UnifiedEmbeddingService.contentToVector;
export const batchTextToVector = UnifiedEmbeddingService.batchTextToVector;
export const getDimension = UnifiedEmbeddingService.getDimension;
export const getModel = UnifiedEmbeddingService.getModel; 