/**
 * 搜索质量监控和优化模块
 * 负责监控降级使用情况、评估匹配质量、提供优化建议
 */

import { WeightedSearchResult, SearchWeights, WEIGHT_PRESETS } from './weighted-search-api';

// 搜索级别枚举
export type SearchLevel = 'optimized' | 'simple' | 'original' | 'failed';

// 质量评估结果接口
export interface QualityAssessment {
  avgScore: number;
  minScore: number;
  maxScore: number;
  scoreDistribution: {
    excellent: number;  // > 0.8
    good: number;       // 0.6 - 0.8
    fair: number;       // 0.4 - 0.6
    poor: number;       // < 0.4
  };
  diversityIndex: number;  // 结果多样性指数
  qualityGrade: 'A' | 'B' | 'C' | 'D';
}

// 搜索统计数据
export interface SearchStats {
  totalSearches: number;
  levelUsage: Record<SearchLevel, number>;
  avgResponseTime: Record<SearchLevel, number>;
  successRate: Record<SearchLevel, number>;
  qualityScores: Record<SearchLevel, QualityAssessment>;
}

// 全局统计数据
let searchStats: SearchStats = {
  totalSearches: 0,
  levelUsage: { optimized: 0, simple: 0, original: 0, failed: 0 },
  avgResponseTime: { optimized: 0, simple: 0, original: 0, failed: 0 },
  successRate: { optimized: 0, simple: 0, original: 0, failed: 0 },
  qualityScores: { optimized: {} as QualityAssessment, simple: {} as QualityAssessment, original: {} as QualityAssessment, failed: {} as QualityAssessment }
};

/**
 * 记录搜索使用情况
 */
export function recordSearchUsage(level: SearchLevel, responseTime: number, success: boolean) {
  searchStats.totalSearches++;
  searchStats.levelUsage[level]++;
  
  // 更新平均响应时间
  const currentAvg = searchStats.avgResponseTime[level];
  const currentCount = searchStats.levelUsage[level];
  searchStats.avgResponseTime[level] = (currentAvg * (currentCount - 1) + responseTime) / currentCount;
  
  // 更新成功率
  const currentSuccessCount = Math.floor(searchStats.successRate[level] * (currentCount - 1));
  const newSuccessCount = success ? currentSuccessCount + 1 : currentSuccessCount;
  searchStats.successRate[level] = newSuccessCount / currentCount;
  
  console.log(`📊 搜索统计更新 - 级别: ${level}, 响应时间: ${responseTime}ms, 成功: ${success}`);
}

/**
 * 评估搜索结果质量
 */
export function assessResultQuality(results: WeightedSearchResult[], queryText: string): QualityAssessment {
  if (!results || results.length === 0) {
    return {
      avgScore: 0,
      minScore: 0,
      maxScore: 0,
      scoreDistribution: { excellent: 0, good: 0, fair: 0, poor: 0 },
      diversityIndex: 0,
      qualityGrade: 'D'
    };
  }

  const scores = results.map(r => r.final_score);
  const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);

  // 计算得分分布
  const scoreDistribution = {
    excellent: scores.filter(s => s > 0.8).length,
    good: scores.filter(s => s > 0.6 && s <= 0.8).length,
    fair: scores.filter(s => s > 0.4 && s <= 0.6).length,
    poor: scores.filter(s => s <= 0.4).length
  };

  // 计算多样性指数（基于描述的词汇多样性）
  const diversityIndex = calculateDiversityIndex(results);

  // 确定质量等级
  let qualityGrade: 'A' | 'B' | 'C' | 'D';
  if (avgScore > 0.8 && diversityIndex > 0.7) {
    qualityGrade = 'A';
  } else if (avgScore > 0.6 && diversityIndex > 0.5) {
    qualityGrade = 'B';
  } else if (avgScore > 0.4 && diversityIndex > 0.3) {
    qualityGrade = 'C';
  } else {
    qualityGrade = 'D';
  }

  return {
    avgScore: parseFloat(avgScore.toFixed(4)),
    minScore: parseFloat(minScore.toFixed(4)),
    maxScore: parseFloat(maxScore.toFixed(4)),
    scoreDistribution,
    diversityIndex: parseFloat(diversityIndex.toFixed(4)),
    qualityGrade
  };
}

/**
 * 计算结果多样性指数
 */
function calculateDiversityIndex(results: WeightedSearchResult[]): number {
  if (results.length <= 1) return 0;

  // 提取所有描述的关键词
  const allKeywords = new Set<string>();
  const resultKeywords: Set<string>[] = [];

  results.forEach(result => {
    const keywords = extractKeywords(result.original_description);
    resultKeywords.push(new Set(keywords));
    keywords.forEach(keyword => allKeywords.add(keyword));
  });

  // 计算结果间的相似度
  let totalSimilarity = 0;
  let comparisons = 0;

  for (let i = 0; i < resultKeywords.length; i++) {
    for (let j = i + 1; j < resultKeywords.length; j++) {
      const intersection = new Set([...resultKeywords[i]].filter(x => resultKeywords[j].has(x)));
      const union = new Set([...resultKeywords[i], ...resultKeywords[j]]);
      const similarity = intersection.size / union.size;
      totalSimilarity += similarity;
      comparisons++;
    }
  }

  const avgSimilarity = comparisons > 0 ? totalSimilarity / comparisons : 0;
  return 1 - avgSimilarity; // 多样性 = 1 - 相似度
}

/**
 * 从文本中提取关键词
 */
function extractKeywords(text: string): string[] {
  // 简单的关键词提取（可以后续优化为更复杂的 NLP 处理）
  const stopWords = new Set(['的', '了', '在', '是', '有', '和', '与', '或', '但', '而', '因为', '所以', '如果', '那么', '这个', '那个', '一个', '一些']);
  
  return text
    .toLowerCase()
    .split(/[\s，。！？、；：""''（）【】\[\]]+/)
    .filter(word => word.length > 1 && !stopWords.has(word))
    .slice(0, 20); // 限制关键词数量
}

/**
 * 获取搜索级别信息
 */
export function getSearchLevelInfo(level: SearchLevel) {
  const levelInfo = {
    optimized: {
      icon: '🎯',
      label: '7维度精准匹配',
      description: '使用最高质量的多维度语义分析',
      expectedQuality: 'A-B',
      expectedTime: '5-10秒'
    },
    simple: {
      icon: '⚡',
      label: '快速语义匹配',
      description: '基于核心描述的高效匹配',
      expectedQuality: 'B-C',
      expectedTime: '2-5秒'
    },
    original: {
      icon: '🔧',
      label: '基础匹配模式',
      description: '确保功能可用的兼容模式',
      expectedQuality: 'C-D',
      expectedTime: '10-30秒'
    },
    failed: {
      icon: '❌',
      label: '搜索失败',
      description: '所有搜索方法都无法完成',
      expectedQuality: 'N/A',
      expectedTime: 'N/A'
    }
  };
  return levelInfo[level];
}

/**
 * 智能权重推荐
 */
export function recommendOptimalWeights(queryText: string): { 
  weights: SearchWeights; 
  preset: keyof typeof WEIGHT_PRESETS; 
  reason: string; 
} {
  const text = queryText.toLowerCase();
  
  // 阅读教育相关关键词
  const readingKeywords = ['阅读', '读书', '书籍', '学习', '教育', '知识', '思考', '理解', '启发', '智慧'];
  // 哲理成长相关关键词
  const philosophyKeywords = ['哲理', '人生', '成长', '感悟', '心态', '品格', '修养', '境界', '领悟', '觉醒'];
  // 亲子家庭相关关键词
  const familyKeywords = ['亲子', '家庭', '父母', '孩子', '陪伴', '温暖', '关爱', '依偎', '守护', '温馨'];
  // 自然季节相关关键词
  const natureKeywords = ['自然', '季节', '春夏秋冬', '风景', '花草', '树木', '天空', '阳光', '月亮', '星星'];
  // 创意幻想相关关键词
  const fantasyKeywords = ['想象', '创意', '幻想', '魔法', '奇幻', '梦境', '童话', '神奇', '超现实', '创造'];

  const readingCount = readingKeywords.filter(keyword => text.includes(keyword)).length;
  const philosophyCount = philosophyKeywords.filter(keyword => text.includes(keyword)).length;
  const familyCount = familyKeywords.filter(keyword => text.includes(keyword)).length;
  const natureCount = natureKeywords.filter(keyword => text.includes(keyword)).length;
  const fantasyCount = fantasyKeywords.filter(keyword => text.includes(keyword)).length;

  // 确定最佳预设
  const scores = {
    reading_wisdom: readingCount * 3 + philosophyCount, // 阅读+智慧双重加权
    philosophy_growth: philosophyCount * 3 + readingCount, // 哲理+成长双重加权
    family_warmth: familyCount * 3, // 家庭温暖专项加权
    nature_seasons: natureCount * 3, // 自然季节专项加权
    creative_fantasy: fantasyCount * 3, // 创意幻想专项加权
  };

  const bestPreset = Object.entries(scores).reduce((best, [preset, score]) => 
    score > scores[best] ? preset : best, 'reading_wisdom'
  ) as keyof typeof WEIGHT_PRESETS;

  const reasons = {
    reading_wisdom: `检测到${readingCount}个阅读教育词汇，推荐阅读方法·智慧启迪模板`,
    philosophy_growth: `检测到${philosophyCount}个哲理成长词汇，推荐哲理心语·成长感悟模板`,
    family_warmth: `检测到${familyCount}个亲子家庭词汇，推荐亲子时光·温馨陪伴模板`,
    nature_seasons: `检测到${natureCount}个自然季节词汇，推荐自然序曲·四季诗篇模板`,
    creative_fantasy: `检测到${fantasyCount}个创意幻想词汇，推荐幻想乐园·创意无限模板`
  };

  return {
    weights: WEIGHT_PRESETS[bestPreset],
    preset: bestPreset,
    reason: reasons[bestPreset]
  };
}

/**
 * 获取当前搜索统计
 */
export function getSearchStats(): SearchStats {
  return { ...searchStats };
}

/**
 * 重置搜索统计
 */
export function resetSearchStats() {
  searchStats = {
    totalSearches: 0,
    levelUsage: { optimized: 0, simple: 0, original: 0, failed: 0 },
    avgResponseTime: { optimized: 0, simple: 0, original: 0, failed: 0 },
    successRate: { optimized: 0, simple: 0, original: 0, failed: 0 },
    qualityScores: { optimized: {} as QualityAssessment, simple: {} as QualityAssessment, original: {} as QualityAssessment, failed: {} as QualityAssessment }
  };
}

/**
 * 生成质量报告
 */
export function generateQualityReport(): string {
  const stats = getSearchStats();
  const totalSearches = stats.totalSearches;
  
  if (totalSearches === 0) {
    return '暂无搜索数据';
  }

  const optimizedUsage = ((stats.levelUsage.optimized / totalSearches) * 100).toFixed(1);
  const simpleUsage = ((stats.levelUsage.simple / totalSearches) * 100).toFixed(1);
  const originalUsage = ((stats.levelUsage.original / totalSearches) * 100).toFixed(1);
  const failedUsage = ((stats.levelUsage.failed / totalSearches) * 100).toFixed(1);

  return `
📊 搜索质量报告
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
总搜索次数: ${totalSearches}

🎯 搜索级别使用分布:
  • 优化版: ${optimizedUsage}% (${stats.levelUsage.optimized} 次)
  • 简化版: ${simpleUsage}% (${stats.levelUsage.simple} 次)  
  • 原始版: ${originalUsage}% (${stats.levelUsage.original} 次)
  • 失败: ${failedUsage}% (${stats.levelUsage.failed} 次)

⏱️ 平均响应时间:
  • 优化版: ${stats.avgResponseTime.optimized.toFixed(0)}ms
  • 简化版: ${stats.avgResponseTime.simple.toFixed(0)}ms
  • 原始版: ${stats.avgResponseTime.original.toFixed(0)}ms

✅ 成功率:
  • 优化版: ${(stats.successRate.optimized * 100).toFixed(1)}%
  • 简化版: ${(stats.successRate.simple * 100).toFixed(1)}%
  • 原始版: ${(stats.successRate.original * 100).toFixed(1)}%

💡 优化建议:
${generateOptimizationSuggestions(stats)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `.trim();
}

/**
 * 生成优化建议
 */
function generateOptimizationSuggestions(stats: SearchStats): string {
  const suggestions: string[] = [];
  
  if (stats.levelUsage.optimized / stats.totalSearches < 0.5) {
    suggestions.push('• 考虑优化数据库索引，提高优化版搜索成功率');
  }
  
  if (stats.levelUsage.failed / stats.totalSearches > 0.1) {
    suggestions.push('• 失败率较高，建议检查网络连接和数据库配置');
  }
  
  if (stats.avgResponseTime.optimized > 10000) {
    suggestions.push('• 优化版响应时间过长，建议调整相似度阈值');
  }
  
  if (suggestions.length === 0) {
    suggestions.push('• 系统运行良好，继续保持当前配置');
  }
  
  return suggestions.join('\n');
}
