/**
 * 加权语义搜索 API
 * 提供前端调用加权搜索函数的接口
 */

import { supabase } from '../lib/supabase';

// 权重配置接口
export interface SearchWeights {
  philosophy?: number;
  action_process?: number;
  interpersonal_roles?: number;
  edu_value?: number;
  learning_strategy?: number;
  creative_play?: number;
  scene_visuals?: number;
}

// 搜索结果接口（适配 illustrations_optimized 表结构）
export interface WeightedSearchResult {
  id: string;  // 改为 string 类型，匹配实际表结构
  title: string;
  image_url: string;
  original_description: string;
  theme_philosophy: string;
  action_process: string;
  interpersonal_roles: string;
  edu_value: string;
  learning_strategy: string;
  creative_play: string;
  scene_visuals: string;
  final_score: number;
}

// 预定义的权重配置模板
export const WEIGHT_PRESETS = {
  // 均衡搜索 - 所有维度平等权重
  balanced: {
    philosophy: 0.14,
    action_process: 0.14,
    interpersonal_roles: 0.14,
    edu_value: 0.14,
    learning_strategy: 0.14,
    creative_play: 0.15,
    scene_visuals: 0.15
  },
  
  // 教育导向 - 重点关注教育价值和学习策略
  educational: {
    philosophy: 0.2,
    action_process: 0.1,
    interpersonal_roles: 0.1,
    edu_value: 0.4,
    learning_strategy: 0.15,
    creative_play: 0.03,
    scene_visuals: 0.02
  },
  
  // 创意导向 - 重点关注创意和游戏化元素
  creative: {
    philosophy: 0.1,
    action_process: 0.15,
    interpersonal_roles: 0.1,
    edu_value: 0.1,
    learning_strategy: 0.1,
    creative_play: 0.4,
    scene_visuals: 0.05
  },
  
  // 行为流程导向 - 重点关注具体行动和过程
  process_focused: {
    philosophy: 0.05,
    action_process: 0.5,
    interpersonal_roles: 0.1,
    edu_value: 0.15,
    learning_strategy: 0.15,
    creative_play: 0.03,
    scene_visuals: 0.02
  },
  
  // 社交互动导向 - 重点关注人际关系和角色
  social: {
    philosophy: 0.15,
    action_process: 0.1,
    interpersonal_roles: 0.4,
    edu_value: 0.15,
    learning_strategy: 0.1,
    creative_play: 0.05,
    scene_visuals: 0.05
  },
  
  // 视觉设计导向 - 重点关注视觉效果和场景
  visual: {
    philosophy: 0.1,
    action_process: 0.1,
    interpersonal_roles: 0.1,
    edu_value: 0.1,
    learning_strategy: 0.1,
    creative_play: 0.1,
    scene_visuals: 0.4
  }
} as const;

/**
 * 执行加权语义搜索（带超时和降级处理）
 * @param queryEmbedding 查询向量 (1536维)
 * @param weights 权重配置对象
 * @param matchCount 返回结果数量
 * @returns 搜索结果数组
 */
export async function performWeightedSearch(
  queryEmbedding: number[],
  weights: SearchWeights = WEIGHT_PRESETS.balanced,
  matchCount: number = 20
): Promise<WeightedSearchResult[]> {
  try {
    // 验证输入参数
    if (!queryEmbedding || queryEmbedding.length !== 1536) {
      throw new Error('查询向量必须是1536维的数组');
    }
    
    if (matchCount <= 0 || matchCount > 100) {
      throw new Error('返回数量必须在1-100之间');
    }
    
    // 规范化权重（确保总和接近1）
    const normalizedWeights = normalizeWeights(weights);
    
    // 创建超时Promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('搜索请求超时 (30秒)'));
      }, 30000); // 30秒超时
    });
    
    try {
      console.log('🔍 尝试使用优化版加权搜索...');
      
      // 首先尝试优化版本的搜索函数
      const optimizedSearchPromise = supabase.rpc('weighted_semantic_search_optimized', {
        query_embedding: `[${queryEmbedding.join(',')}]`,
        weights: normalizedWeights,
        match_count: matchCount,
        similarity_threshold: 0.1 // 相似度阈值
      });
      
      const { data, error } = await Promise.race([optimizedSearchPromise, timeoutPromise]);
      
      if (error) {
        throw error;
      }
      
      console.log('✅ 优化版搜索成功，返回结果数量:', data?.length || 0);
      return data || [];
      
    } catch (optimizedError) {
      console.warn('⚠️ 优化版搜索失败，尝试降级到简化版本:', optimizedError);
      
      try {
        // 降级到简化版本
        const simpleSearchPromise = supabase.rpc('weighted_semantic_search_simple', {
          query_embedding: `[${queryEmbedding.join(',')}]`,
          weights: normalizedWeights,
          match_count: matchCount
        });
        
        const { data: simpleData, error: simpleError } = await Promise.race([
          simpleSearchPromise, 
          timeoutPromise
        ]);
        
        if (simpleError) {
          throw simpleError;
        }
        
        console.log('✅ 简化版搜索成功，返回结果数量:', simpleData?.length || 0);
        return simpleData || [];
        
      } catch (simpleError) {
        console.warn('⚠️ 简化版搜索也失败，尝试使用原始搜索函数:', simpleError);
        
        // 最后降级到原始版本
        const originalSearchPromise = supabase.rpc('weighted_semantic_search', {
          query_embedding: `[${queryEmbedding.join(',')}]`,
          weights: normalizedWeights,
          match_count: matchCount
        });
        
        const { data: originalData, error: originalError } = await Promise.race([
          originalSearchPromise,
          timeoutPromise
        ]);
        
        if (originalError) {
          throw originalError;
        }
        
        console.log('✅ 原始搜索成功，返回结果数量:', originalData?.length || 0);
        return originalData || [];
      }
    }
    
  } catch (error) {
    console.error('🚫 所有搜索方法都失败了:', error);
    
    // 提供更友好的错误信息
    let errorMessage = '搜索失败';
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('超时')) {
        errorMessage = '搜索请求超时，请稍后重试或减少搜索结果数量';
      } else if (error.message.includes('statement timeout')) {
        errorMessage = '数据库查询超时，正在优化性能，请稍后重试';
      } else if (error.message.includes('connection')) {
        errorMessage = '网络连接问题，请检查网络后重试';
      } else {
        errorMessage = `搜索失败: ${error.message}`;
      }
    }
    
    throw new Error(errorMessage);
  }
}

/**
 * 使用预设权重模板进行搜索
 * @param queryEmbedding 查询向量
 * @param preset 预设模板名称
 * @param matchCount 返回结果数量
 * @returns 搜索结果数组
 */
export async function searchWithPreset(
  queryEmbedding: number[],
  preset: keyof typeof WEIGHT_PRESETS,
  matchCount: number = 20
): Promise<WeightedSearchResult[]> {
  const weights = WEIGHT_PRESETS[preset];
  return performWeightedSearch(queryEmbedding, weights, matchCount);
}

/**
 * 规范化权重配置
 * 确保所有权重值合理且总和接近1
 * @param weights 原始权重配置
 * @returns 规范化后的权重配置
 */
function normalizeWeights(weights: SearchWeights): SearchWeights {
  const defaultWeights = WEIGHT_PRESETS.balanced;
  
  // 填充缺失的权重值
  const completeWeights = {
    philosophy: weights.philosophy ?? defaultWeights.philosophy,
    action_process: weights.action_process ?? defaultWeights.action_process,
    interpersonal_roles: weights.interpersonal_roles ?? defaultWeights.interpersonal_roles,
    edu_value: weights.edu_value ?? defaultWeights.edu_value,
    learning_strategy: weights.learning_strategy ?? defaultWeights.learning_strategy,
    creative_play: weights.creative_play ?? defaultWeights.creative_play,
    scene_visuals: weights.scene_visuals ?? defaultWeights.scene_visuals
  };
  
  // 计算总和
  const totalWeight = Object.values(completeWeights).reduce((sum, weight) => sum + weight, 0);
  
  // 如果总和偏差太大，进行归一化
  if (Math.abs(totalWeight - 1.0) > 0.1) {
    const normalizedWeights: SearchWeights = {};
    Object.entries(completeWeights).forEach(([key, value]) => {
      normalizedWeights[key as keyof SearchWeights] = value / totalWeight;
    });
    return normalizedWeights;
  }
  
  return completeWeights;
}

/**
 * 批量搜索 - 使用多个权重配置进行搜索并合并结果
 * @param queryEmbedding 查询向量
 * @param weightConfigs 多个权重配置
 * @param matchCount 每个配置返回的结果数量
 * @returns 合并去重后的搜索结果
 */
export async function batchWeightedSearch(
  queryEmbedding: number[],
  weightConfigs: SearchWeights[],
  matchCount: number = 10
): Promise<WeightedSearchResult[]> {
  try {
    // 并发执行多个搜索
    const searchPromises = weightConfigs.map(weights => 
      performWeightedSearch(queryEmbedding, weights, matchCount)
    );
    
    const results = await Promise.all(searchPromises);
    
    // 合并结果并去重
    const mergedResults = new Map<number, WeightedSearchResult>();
    
    results.forEach(resultSet => {
      resultSet.forEach(item => {
        const existingItem = mergedResults.get(item.id);
        // 保留得分更高的结果
        if (!existingItem || item.final_score > existingItem.final_score) {
          mergedResults.set(item.id, item);
        }
      });
    });
    
    // 按得分排序返回
    return Array.from(mergedResults.values())
      .sort((a, b) => b.final_score - a.final_score);
      
  } catch (error) {
    console.error('批量加权搜索失败:', error);
    throw error;
  }
}

/**
 * 获取搜索结果的统计信息
 * @param results 搜索结果数组
 * @returns 统计信息对象
 */
export function getSearchStats(results: WeightedSearchResult[]) {
  if (!results.length) {
    return {
      count: 0,
      minScore: 0,
      maxScore: 0,
      avgScore: 0,
      scoreRange: 0
    };
  }
  
  const scores = results.map(r => r.final_score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  
  return {
    count: results.length,
    minScore: parseFloat(minScore.toFixed(4)),
    maxScore: parseFloat(maxScore.toFixed(4)),
    avgScore: parseFloat(avgScore.toFixed(4)),
    scoreRange: parseFloat((maxScore - minScore).toFixed(4))
  };
}