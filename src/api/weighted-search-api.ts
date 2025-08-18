/**
 * 加权语义搜索 API
 * 提供前端调用加权搜索函数的接口
 */

import { supabase } from '../lib/supabase';
import { 
  recordSearchUsage, 
  assessResultQuality, 
  recommendOptimalWeights, 
  getSearchLevelInfo,
  SearchLevel 
} from './search-quality-monitor';

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
  // 📚 阅读方法 · 智慧启迪 - 分享读书干货、交流阅读感悟的阅读教育类文字
  reading_wisdom: {
    philosophy: 0.15,        // 核心理念与人生主题: 15%
    action_process: 0.05,    // 行动过程与成长: 5%
    interpersonal_roles: 0.10, // 人际角色与情感连接: 10%
    edu_value: 0.40,         // 阅读带来的价值: 40% (核心)
    learning_strategy: 0.30, // 阅读中的学习方法: 30% (核心)
    creative_play: 0.00,     // 创意表现与想象力: 0%
    scene_visuals: 0.00      // 场景氛围与画面元素: 0%
  },
  
  // 💡 哲理心语 · 成长感悟 - 富含人生哲理、关于个人成长和心态调整的句子
  philosophy_growth: {
    philosophy: 0.50,        // 核心理念与人生主题: 50% (绝对核心)
    action_process: 0.20,    // 行动过程与成长: 20%
    interpersonal_roles: 0.10, // 人际角色与情感连接: 10%
    edu_value: 0.00,         // 阅读带来的价值: 0%
    learning_strategy: 0.00, // 阅读中的学习方法: 0%
    creative_play: 0.05,     // 创意表现与想象力: 5%
    scene_visuals: 0.15      // 场景氛围与画面元素: 15%
  },
  
  // ❤️ 亲子时光 · 温馨陪伴 - 强调亲子关系、家庭温暖和情感安全感的文案
  family_warmth: {
    philosophy: 0.20,        // 核心理念与人生主题: 20%
    action_process: 0.05,    // 行动过程与成长: 5%
    interpersonal_roles: 0.50, // 人际角色与情感连接: 50% (绝对核心)
    edu_value: 0.00,         // 阅读带来的价值: 0%
    learning_strategy: 0.00, // 阅读中的学习方法: 0%
    creative_play: 0.00,     // 创意表现与想象力: 0%
    scene_visuals: 0.25      // 场景氛围与画面元素: 25%
  },
  
  // 🌿 自然序曲 · 四季诗篇 - 描写季节变化、自然风光和节日节气的文案
  nature_seasons: {
    philosophy: 0.15,        // 核心理念与人生主题: 15%
    action_process: 0.10,    // 行动过程与成长: 10%
    interpersonal_roles: 0.05, // 人际角色与情感连接: 5%
    edu_value: 0.00,         // 阅读带来的价值: 0%
    learning_strategy: 0.00, // 阅读中的学习方法: 0%
    creative_play: 0.10,     // 创意表现与想象力: 10%
    scene_visuals: 0.60      // 场景氛围与画面元素: 60% (绝对核心)
  },
  
  // ✨ 幻想乐园 · 创意无限 - 鼓励想象力、创造力和趣味玩法的文案
  creative_fantasy: {
    philosophy: 0.00,        // 核心理念与人生主题: 0%
    action_process: 0.20,    // 行动过程与成长: 20%
    interpersonal_roles: 0.05, // 人际角色与情感连接: 5%
    edu_value: 0.00,         // 阅读带来的价值: 0%
    learning_strategy: 0.15, // 阅读中的学习方法: 15%
    creative_play: 0.50,     // 创意表现与想象力: 50% (绝对核心)
    scene_visuals: 0.10      // 场景氛围与画面元素: 10%
  },

  // 🎛️ 自定义 - 用户完全自定义权重配置
  custom: {
    philosophy: 0.14,        // 核心理念与人生主题: 14% (平均分配)
    action_process: 0.14,    // 行动过程与成长: 14%
    interpersonal_roles: 0.14, // 人际角色与情感连接: 14%
    edu_value: 0.14,         // 阅读带来的价值: 14%
    learning_strategy: 0.14, // 阅读中的学习方法: 14%
    creative_play: 0.15,     // 创意表现与想象力: 15%
    scene_visuals: 0.15      // 场景氛围与画面元素: 15%
  }
} as const;

/**
 * 执行加权语义搜索（带超时和降级处理）
 * @param queryEmbedding 查询向量 (1536维)
 * @param weights 权重配置对象
 * @param matchCount 返回结果数量
 * @param usePremiumFirst 是否优先使用精选集（300张高质量图片）
 * @returns 搜索结果数组
 */
export async function performWeightedSearch(
  queryEmbedding: number[],
  weights: SearchWeights = WEIGHT_PRESETS.balanced,
  matchCount: number = 20,
  queryText?: string, // 新增查询文本参数，用于质量监控
  usePremiumFirst: boolean = true // 默认优先使用精选集
): Promise<WeightedSearchResult[]> {
  const startTime = Date.now();
  let usedLevel: SearchLevel = 'failed';
  
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
    
    // 如果有查询文本，提供智能权重推荐
    if (queryText) {
      const recommendation = recommendOptimalWeights(queryText);
      console.log(`💡 智能权重推荐: ${recommendation.preset} - ${recommendation.reason}`);
    }
    
    // 创建超时Promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('搜索请求超时 (30秒)'));
      }, 30000); // 30秒超时
    });
    
    // 优先尝试精选集搜索（如果启用）
    if (usePremiumFirst) {
      try {
        console.log('🌟 尝试使用精选集搜索（300张高质量图片）...');
        
        const premiumSearchPromise = supabase.rpc('weighted_semantic_search_premium', {
          query_embedding: queryEmbedding,
          weights: normalizedWeights,
          match_count: matchCount,
          similarity_threshold: 0.02 // 精选集使用更低阈值
        });
        
        const { data: premiumData, error: premiumError } = await Promise.race([
          premiumSearchPromise, 
          timeoutPromise
        ]);
        
        if (!premiumError && premiumData && premiumData.length > 0) {
          console.log('✅ 精选集搜索成功，返回结果数量:', premiumData.length);
          console.log('🔍 精选集第一个结果检查:', {
            id: premiumData[0]?.id,
            title: premiumData[0]?.title,
            has_image_url: !!premiumData[0]?.image_url,
            has_description: !!premiumData[0]?.original_description,
            image_url_preview: premiumData[0]?.image_url?.substring(0, 50) + '...',
            description_preview: premiumData[0]?.original_description?.substring(0, 50) + '...'
          });
          
          usedLevel = 'premium' as SearchLevel;
          
          // 评估结果质量
          if (queryText && premiumData) {
            const quality = assessResultQuality(premiumData, queryText);
            console.log(`📊 搜索质量评估 (精选集): ${quality.qualityGrade} 级 (平均得分: ${quality.avgScore})`);
          }
          
          return premiumData || [];
        } else {
          console.log('⚠️ 精选集搜索无结果或失败，降级到全量搜索');
          if (premiumError) {
            console.log('精选集搜索错误:', premiumError);
          }
        }
      } catch (premiumError) {
        console.log('⚠️ 精选集搜索失败，降级到全量搜索:', premiumError);
      }
    }
    
    try {
      console.log('🔍 尝试使用优化版加权搜索...');
      
      // 首先尝试优化版本的搜索函数
      console.log('🔧 调用优化版函数，参数:', {
        weights: normalizedWeights,
        match_count: matchCount,
        similarity_threshold: 0.05,  // 降低阈值，减少过度过滤
        vector_length: queryEmbedding.length
      });
      
      const optimizedSearchPromise = supabase.rpc('weighted_semantic_search_optimized', {
        query_embedding: queryEmbedding, // 直接传递数组，让Supabase自动转换为vector类型
        weights: normalizedWeights,
        match_count: matchCount,
        similarity_threshold: 0.05 // 降低相似度阈值，提高成功率
      });
      
      const { data, error } = await Promise.race([optimizedSearchPromise, timeoutPromise]);
      
      if (error) {
        throw error;
      }
      
      console.log('✅ 优化版搜索成功，返回结果数量:', data?.length || 0);
      usedLevel = 'optimized';
      
      // 评估结果质量
      if (queryText && data) {
        const quality = assessResultQuality(data, queryText);
        console.log(`📊 搜索质量评估: ${quality.qualityGrade} 级 (平均得分: ${quality.avgScore})`);
      }
      
      return data || [];
      
    } catch (optimizedError) {
      console.warn('⚠️ 优化版搜索失败，尝试降级到简化版本:', optimizedError);
      
      try {
        // 降级到简化版本
        const simpleSearchPromise = supabase.rpc('weighted_semantic_search_simple', {
          query_embedding: queryEmbedding, // 直接传递数组
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
        usedLevel = 'simple';
        
        // 评估结果质量
        if (queryText && simpleData) {
          const quality = assessResultQuality(simpleData, queryText);
          console.log(`📊 搜索质量评估 (简化版): ${quality.qualityGrade} 级 (平均得分: ${quality.avgScore})`);
        }
        
        return simpleData || [];
        
      } catch (simpleError) {
        console.warn('⚠️ 简化版搜索也失败，尝试使用原始搜索函数:', simpleError);
        
        // 最后降级到原始版本
        const originalSearchPromise = supabase.rpc('weighted_semantic_search', {
          query_embedding: queryEmbedding, // 直接传递数组
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
        usedLevel = 'original';
        
        // 评估结果质量
        if (queryText && originalData) {
          const quality = assessResultQuality(originalData, queryText);
          console.log(`📊 搜索质量评估 (原始版): ${quality.qualityGrade} 级 (平均得分: ${quality.avgScore})`);
        }
        
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
  } finally {
    // 记录搜索使用统计
    const responseTime = Date.now() - startTime;
    const success = usedLevel !== 'failed';
    recordSearchUsage(usedLevel, responseTime, success);
  }
}

/**
 * 精选集专用搜索 - 直接使用300张高质量图片
 * @param queryEmbedding 查询向量
 * @param weights 权重配置对象
 * @param matchCount 返回结果数量
 * @returns 精选集搜索结果
 */
export async function searchPremiumCollection(
  queryEmbedding: number[],
  weights: SearchWeights = WEIGHT_PRESETS.balanced,
  matchCount: number = 20
): Promise<WeightedSearchResult[]> {
  console.log('🌟 使用精选集专用搜索...');
  
  const normalizedWeights = normalizeWeights(weights);
  
  const { data, error } = await supabase.rpc('weighted_semantic_search_premium', {
    query_embedding: queryEmbedding,
    weights: normalizedWeights,
    match_count: matchCount,
    similarity_threshold: 0.02
  });
  
  if (error) {
    throw new Error(`精选集搜索失败: ${error.message}`);
  }
  
  console.log('✅ 精选集搜索完成，结果数量:', data?.length || 0);
  return data || [];
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
    const mergedResults = new Map<string, WeightedSearchResult>();
    
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