import React, { useState, useCallback } from 'react';
import { Upload, Image, Database, BarChart3, Search, Loader2, CheckCircle, AlertCircle, TrendingUp, Download, Eye, Brain, Target, ChevronDown, ChevronUp, Sliders, RotateCcw, Zap } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import ModernImageUploader from './ModernImageUploader';
import ModernDatabaseViewer from './ModernDatabaseViewer';
import { ProcessedImage } from '../types';
import { uploadImages, ProcessedImage as APIProcessedImage } from '../api/imageProcessor';
import { matchIllustrationsToText, TextContent, IllustrationMatch } from '../api/illustration-api';
import { performWeightedSearch, SearchWeights, WeightedSearchResult, WEIGHT_PRESETS } from '../api/weighted-search-api';
import { vectorizeText } from '../api/vectorization-proxy';
import { cn } from '../lib/utils';

interface OptimizedWorkspaceProps {
  // 可以添加其他props
}

const OptimizedWorkspace: React.FC<OptimizedWorkspaceProps> = () => {
  // 插图上传相关状态
  const [processedImages, setProcessedImages] = useState<ProcessedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStatus, setCurrentStatus] = useState('');
  
  // 文案匹配相关状态
  const [textContent, setTextContent] = useState('');
  const [matchResults, setMatchResults] = useState<IllustrationMatch[]>([]);
  const [isMatching, setIsMatching] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  
  // 加权搜索相关状态
  const [useWeightedSearch, setUseWeightedSearch] = useState(false);
  const [weightedResults, setWeightedResults] = useState<WeightedSearchResult[]>([]);
  const [searchWeights, setSearchWeights] = useState<SearchWeights>(WEIGHT_PRESETS.reading_wisdom);
  const [showWeightSettings, setShowWeightSettings] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<keyof typeof WEIGHT_PRESETS>('reading_wisdom');
  
  // 界面控制状态
  const [activeTab, setActiveTab] = useState<'upload' | 'match' | 'gallery'>('match');
  const [isDatabaseViewerOpen, setIsDatabaseViewerOpen] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [expandedImages, setExpandedImages] = useState<Set<string>>(new Set());
  const [expandedMatchingLogic, setExpandedMatchingLogic] = useState<Set<string>>(new Set());
  
  // 添加详细的处理状态
  const [processingDetails, setProcessingDetails] = useState<{
    currentIndex: number;
    totalCount: number;
    currentFile: string;
    completedFiles: Array<{name: string; status: 'processing' | 'completed' | 'error'; error?: string}>;
    isProcessing: boolean;
    isCompleted: boolean;
  }>({
    currentIndex: 0,
    totalCount: 0,
    currentFile: '',
    completedFiles: [],
    isProcessing: false,
    isCompleted: false
  });

  // 切换描述展开状态
  const toggleDescription = useCallback((matchId: string) => {
    setExpandedDescriptions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(matchId)) {
        newSet.delete(matchId);
      } else {
        newSet.add(matchId);
      }
      return newSet;
    });
  }, []);

  // 切换插图展开状态
  const toggleImageExpanded = useCallback((matchId: string) => {
    setExpandedImages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(matchId)) {
        newSet.delete(matchId);
      } else {
        newSet.add(matchId);
      }
      return newSet;
    });
  }, []);

  // 切换匹配逻辑展开状态
  const toggleMatchingLogic = useCallback((matchId: string) => {
    setExpandedMatchingLogic(prev => {
      const newSet = new Set(prev);
      if (newSet.has(matchId)) {
        newSet.delete(matchId);
      } else {
        newSet.add(matchId);
      }
      return newSet;
    });
  }, []);

  // 转换API返回的ProcessedImage到组件需要的类型
  const convertAPIProcessedImage = (apiImage: APIProcessedImage): ProcessedImage => {
    return {
      id: apiImage.id,
      filename: apiImage.filename,
      bookTitle: apiImage.bookTitle,
      aiDescription: apiImage.aiDescription,
      ageOrientation: '全年龄',
      textTypeFit: '适合',
      bookTheme: apiImage.bookTheme,
      keywords: [],
      status: apiImage.status,
      imageUrl: apiImage.imageUrl,
    };
  };

  // 插图上传处理
  const handleImagesUploaded = useCallback(async (images: File[]) => {
    console.log('上传的插图:', images);
    
    setIsProcessing(true);
    setProgress(0);
    setCurrentStatus('准备处理插图...');
    
    // 初始化处理详情
    setProcessingDetails({
      currentIndex: 0,
      totalCount: images.length,
      currentFile: '',
      completedFiles: [],
      isProcessing: true,
      isCompleted: false
    });
    
    try {
      // 使用带进度回调的uploadImages
      const result = await uploadImages(images, (progressInfo) => {
        // 实时更新进度
        const progressPercent = Math.round((progressInfo.current / progressInfo.total) * 100);
        setProgress(progressPercent);
        
        if (progressInfo.status === 'processing') {
          setCurrentStatus(`正在处理: ${progressInfo.currentFile}`);
        }
        
        // 更新处理详情
        setProcessingDetails(prev => {
          const newCompletedFiles = [...prev.completedFiles];
          const existingIndex = newCompletedFiles.findIndex(f => f.name === progressInfo.currentFile);
          
          if (progressInfo.status === 'processing') {
            if (existingIndex === -1) {
              newCompletedFiles.push({
                name: progressInfo.currentFile,
                status: 'processing'
              });
            } else {
              newCompletedFiles[existingIndex] = {
                name: progressInfo.currentFile,
                status: 'processing'
              };
            }
          } else if (progressInfo.status === 'completed' || progressInfo.status === 'error') {
            if (existingIndex === -1) {
              newCompletedFiles.push({
                name: progressInfo.currentFile,
                status: progressInfo.status,
                error: progressInfo.error
              });
            } else {
              newCompletedFiles[existingIndex] = {
                name: progressInfo.currentFile,
                status: progressInfo.status,
                error: progressInfo.error
              };
            }
          }
          
          return {
            ...prev,
            currentIndex: progressInfo.current,
            currentFile: progressInfo.currentFile,
            completedFiles: newCompletedFiles
          };
        });
      });
      
      const convertedImages = result.map(convertAPIProcessedImage);
      setProcessedImages(convertedImages);
      
      // 统计处理结果
      const successCount = result.filter(img => img.status === 'success').length;
      const errorCount = result.filter(img => img.status === 'error').length;
      
      setProgress(100);
      setCurrentStatus('处理完成');
      
      // 标记为完成状态
      setProcessingDetails(prev => ({
        ...prev,
        isProcessing: false,
        isCompleted: true
      }));
      
    } catch (error) {
      console.error('处理插图时出错:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      
      // 根据错误类型提供更具体的提示
      if (errorMessage.includes('net::ERR_CONNECTION_RESET')) {
        setCurrentStatus('网络连接中断，请检查网络后重试');
      } else if (errorMessage.includes('Failed to fetch')) {
        setCurrentStatus('网络请求失败，请稍后重试');
      } else if (errorMessage.includes('timeout')) {
        setCurrentStatus('请求超时，请检查网络连接');
      } else {
        setCurrentStatus(`处理失败: ${errorMessage}`);
      }
      
      setProcessingDetails(prev => ({
        ...prev,
        isProcessing: false,
        isCompleted: true
      }));
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // 文案匹配处理
  const handleTextMatch = useCallback(async () => {
    if (!textContent.trim()) {
      setMatchError('请输入要匹配的文案内容');
      return;
    }

    setIsMatching(true);
    setMatchError(null);
    setMatchResults([]);
    setWeightedResults([]);

    try {
      if (useWeightedSearch) {
        // 使用加权搜索
        console.log('🔍 执行加权语义搜索...');
        const queryVector = await vectorizeText(textContent);
        const results = await performWeightedSearch(queryVector, searchWeights, 10, textContent, true); // 明确启用精选集搜索
        console.log('✅ 加权搜索完成，返回', results?.length || 0, '个结果');
        setWeightedResults(results);
      } else {
        // 使用传统搜索
        console.log('🔍 执行传统语义搜索...');
        const content: TextContent = {
          content: textContent,
          theme: '通用',
          keywords: []
        };

        const results = await matchIllustrationsToText(content);
        console.log('✅ 传统搜索完成，返回', results?.length || 0, '个结果');
        // 只取前5个匹配度最高的结果
        setMatchResults(results.slice(0, 5));
      }
    } catch (error) {
      console.error('匹配文案时出错:', error);
      setMatchError('匹配失败: ' + (error as Error).message);
    } finally {
      setIsMatching(false);
    }
  }, [textContent, useWeightedSearch, searchWeights]);

  // 权重更新处理
  const handleWeightChange = useCallback((dimension: keyof SearchWeights, value: number) => {
    setSearchWeights(prev => ({
      ...prev,
      [dimension]: value / 100 // 转换为0-1范围
    }));
    setSelectedPreset('custom'); // 手动调整后切换到自定义模式
  }, []);

  // 预设模板选择
  const handlePresetChange = useCallback((preset: keyof typeof WEIGHT_PRESETS) => {
    setSelectedPreset(preset);
    setSearchWeights(WEIGHT_PRESETS[preset]);
  }, []);

  // 重置权重（如果是自定义模式则重置为平衡分配，否则重置为当前选择的模板）
  const resetWeights = useCallback(() => {
    if (selectedPreset === 'custom') {
      setSearchWeights(WEIGHT_PRESETS.custom);
    } else {
      setSearchWeights(WEIGHT_PRESETS[selectedPreset]);
    }
  }, [selectedPreset]);

  // 下载插图
  const handleDownloadImage = useCallback(async (imageUrl: string, filename: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('下载插图失败:', error);
    }
  }, []);

  // 获取匹配逻辑说明 - 个性化版本
  const getMatchingLogic = (match: IllustrationMatch, textContent: string) => {
    const similarity = (match.similarity * 100).toFixed(1);
    const logicPoints = [];

    // 1. 核心匹配原因（根据相似度和内容特征个性化）
    const getMatchReason = () => {
      if (match.similarity > 0.8) {
        return {
          icon: '🎯',
          title: `高度语义匹配 (${similarity}%)`,
          detail: `插图内容与文案在核心概念上高度一致，是理想的视觉表达选择。`
        };
      } else if (match.similarity > 0.6) {
        return {
          icon: '✅',
          title: `良好语义关联 (${similarity}%)`,
          detail: `插图与文案在主题或情感表达上有明显共同点，能很好地支撑内容。`
        };
      } else if (match.similarity > 0.4) {
        return {
          icon: '🔍',
          title: `中等语义关联 (${similarity}%)`,
          detail: `插图与文案存在一定关联性，可能在某些特定角度产生共鸣。`
        };
      } else {
        return {
          icon: '💡',
          title: `潜在创意关联 (${similarity}%)`,
          detail: `通过深度语义分析发现的创意关联，可能带来意想不到的视觉效果。`
        };
      }
    };
    logicPoints.push(getMatchReason());

    // 2. 关键词匹配分析（个性化描述）
    const textWords = textContent.toLowerCase().split(/[\s，。！？、]+/).filter(word => word.length > 1);
    const descWords = match.description.toLowerCase().split(/[\s，。！？、]+/).filter(word => word.length > 1);
    const commonWords = textWords.filter(word => 
      descWords.some(descWord => descWord.includes(word) || word.includes(descWord))
    ).slice(0, 5);
    
    if (commonWords.length > 3) {
      logicPoints.push({
        icon: '🔤',
        title: `强关键词匹配`,
        detail: `发现 ${commonWords.length} 个共同关键词：${commonWords.join('、')}，直接体现内容关联。`
      });
    } else if (commonWords.length > 0) {
      logicPoints.push({
        icon: '🔍',
        title: `关键词呼应`,
        detail: `共同关键词：${commonWords.join('、')}，为匹配提供语言层面支撑。`
      });
    }

    // 3. 内容特征分析（基于描述长度和复杂度）
    const descLength = match.description.length;
    if (descLength > 300) {
      logicPoints.push({
        icon: '📝',
        title: `丰富内容描述`,
        detail: `插图具有详细的场景描述（${descLength}字），提供了丰富的匹配维度。`
      });
    } else if (descLength > 150) {
      logicPoints.push({
        icon: '📄',
        title: `完整内容描述`,
        detail: `插图描述涵盖了主要视觉元素，为匹配提供充分信息。`
      });
    }

    // 4. 情感色彩快速分析
    const textLower = textContent.toLowerCase();
    const descLower = match.description.toLowerCase();
    const emotionKeywords = {
      positive: ['温馨', '快乐', '美好', '幸福', '开心', '甜蜜', '温暖'],
      peaceful: ['宁静', '平静', '安详', '静谧', '悠闲', '轻松'],
      dynamic: ['活跃', '生动', '热闹', '充满活力', '激动', '兴奋']
    };
    
    for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
      const matchCount = keywords.filter(word => textLower.includes(word) || descLower.includes(word)).length;
      if (matchCount > 0) {
        const emotionLabels = {
          positive: { icon: '😊', label: '积极温馨', desc: '传达积极正面的情感氛围' },
          peaceful: { icon: '🕊️', label: '宁静祥和', desc: '营造平静舒缓的感受' },
          dynamic: { icon: '⚡', label: '活力动感', desc: '展现生动活跃的特质' }
        };
        const info = emotionLabels[emotion as keyof typeof emotionLabels];
        logicPoints.push({
          icon: info.icon,
          title: `${info.label}情感匹配`,
          detail: `文案与插图都${info.desc}，情感基调一致。`
        });
        break; // 只显示第一个匹配的情感类型
      }
    }

    // 5. 来源信息（如果有）
    if (match.bookTitle) {
      logicPoints.push({
        icon: '📚',
        title: `来源：${match.bookTitle}`,
        detail: `原始出处提供了完整的主题背景和创作语境。`
      });
    }

    return logicPoints;
  };



  // 获取当前任务状态信息
  const getCurrentTaskInfo = () => {
    if (isProcessing) {
      // 正在处理插图时，显示当前任务信息
      return `正在处理插图 (${processingDetails.totalCount} 张)...`;
    } else if (isMatching) {
      // 正在匹配文案时，显示匹配状态
      return '正在分析文案语义并匹配最佳插图...';
    } else if (processingDetails.completedFiles.length > 0) {
      // 处理完成后，显示统计信息
      const successCount = processingDetails.completedFiles.filter(f => f.status === 'completed').length;
      const errorCount = processingDetails.completedFiles.filter(f => f.status === 'error').length;
      const total = processingDetails.completedFiles.length;
      
      if (errorCount === 0) {
        return `处理完成！成功处理 ${successCount} 张插图`;
      } else if (successCount === 0) {
        return `处理失败！${errorCount} 张插图处理失败`;
      } else {
        return `部分完成：${successCount} 张成功，${errorCount} 张失败`;
      }
    } else if (processedImages.length > 0) {
      // 兼容旧的状态显示
      const successCount = processedImages.filter(img => img.status === 'success').length;
      const successRate = ((successCount / processedImages.length) * 100).toFixed(1);
      return `已处理 ${processedImages.length} 张插图，成功率 ${successRate}%`;
    }
    return null;
  };

  // 获取状态图标和颜色
  const getStatusIcon = () => {
    if (isProcessing) {
      return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
    } else if (progress === 100 && processedImages.length > 0) {
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    } else if (currentStatus.includes('失败') || currentStatus.includes('错误')) {
      return <AlertCircle className="h-5 w-5 text-red-600" />;
    }
    return null;
  };

  const getProgressBarColor = () => {
    if (currentStatus.includes('失败') || currentStatus.includes('错误')) {
      return 'bg-red-500';
    } else if (progress === 100) {
      return 'bg-green-500';
    } else {
      return 'bg-blue-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img src="/logo-1.jpg" alt="Logo" className="h-12 w-12 rounded-lg" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">文图匹配工作台</h1>
                <p className="text-sm text-slate-600">插图上传及与文图智能匹配系统</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('./search-guide.html', '_blank')}
                className="flex items-center space-x-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
              >
                <Brain className="h-4 w-4" />
                <span>使用指南</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* 全局状态栏 */}
        {(isProcessing || isMatching || processedImages.length > 0) && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getStatusIcon()}
                  <div>
                    <p className="font-medium text-slate-900">
                      {getCurrentTaskInfo() || '就绪'}
                    </p>
                  </div>
                </div>
                
                {(isProcessing || isMatching) && (
                  <div className="flex items-center space-x-4">
                    <div className="w-32 bg-slate-200 rounded-full h-2">
                      <div
                        className={cn("h-2 rounded-full transition-all duration-300", getProgressBarColor())}
                        style={{ width: `${isProcessing ? progress : isMatching ? 50 : 0}%` }}
                      />
                    </div>
                    <span className="text-sm text-slate-600 min-w-[3rem]">
                      {isProcessing ? `${progress}%` : isMatching ? '匹配中' : ''}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 主要功能区域 */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'upload' | 'match' | 'gallery')}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="match" className="flex items-center space-x-2">
              <Search className="h-4 w-4" />
              <span>文图匹配</span>
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center space-x-2">
              <Upload className="h-4 w-4" />
              <span>添加插图</span>
            </TabsTrigger>
            <TabsTrigger value="gallery" className="flex items-center space-x-2">
              <Image className="h-4 w-4" />
              <span>插图库</span>
            </TabsTrigger>
          </TabsList>

          {/* 文案匹配标签页 */}
          <TabsContent value="match">
            <div className="space-y-6">
              {/* 匹配输入区域 */}
              <Card>
                <CardHeader>
                  <CardTitle>文图匹配</CardTitle>
                  <CardDescription>
                    输入文案内容，系统将为您推荐匹配度最高的5张插图
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label htmlFor="text-content" className="block text-sm font-medium text-slate-700 mb-2">
                      文案内容
                    </label>
                    <textarea
                      id="text-content"
                      rows={6}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="请输入要匹配插图的文案内容..."
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                    />
                  </div>

                  {/* 搜索模式切换 */}
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="weighted-search"
                          checked={useWeightedSearch}
                          onChange={(e) => setUseWeightedSearch(e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="weighted-search" className="text-sm font-medium text-slate-700">
                          启用多维度加权搜索
                        </label>
                      </div>
                      <div className="flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-md">
                        <Zap className="h-3 w-3" />
                        <span className="text-xs font-medium">7维度权重分析</span>
                      </div>
                    </div>
                  </div>

                  {/* 多维度加权搜索设置区域 */}
                  {useWeightedSearch && (
                    <>
                      {/* 快速预设模板选择 */}
                      <Card className="border-blue-200 bg-blue-50">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg flex items-center space-x-2">
                            <Zap className="h-5 w-5 text-blue-600" />
                            <span>快速预设模板</span>
                          </CardTitle>
                          <CardDescription>
                            选择适合您文案类型的预设模板，一键应用最佳权重配置
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 gap-3">
                            {Object.entries(WEIGHT_PRESETS).map(([key, preset]) => {
                              const presetInfo = {
                                reading_wisdom: { 
                                  label: '📚 阅读方法与教育理念', 
                                  desc: '关于如何阅读、亲子共读的技巧以及阅读对成长的重要性。'
                                },
                                philosophy_growth: { 
                                  label: '💡 人生哲理与情感感悟', 
                                  desc: '充满哲思和温暖力量的句子，关于成长、心态和生活智慧。'
                                },
                                family_warmth: { 
                                  label: '❤️ 亲子关系与家庭教育', 
                                  desc: '聚焦于父母与孩子之间的情感连接、安全感和言传身教。'
                                },
                                nature_seasons: { 
                                  label: '🌿 季节与自然氛围', 
                                  desc: '如立夏、春分、秋日等节气，以及对自然景色的描绘。'
                                },
                                creative_fantasy: { 
                                  label: '✨ 想象力与创意启发', 
                                  desc: '鼓励孩子发挥想象和创造力的内容。'
                                },
                                custom: { 
                                  label: '🎛️ 自定义配置', 
                                  desc: '从平衡的权重分配开始，完全自由地调整各维度权重。'
                                }
                              };
                              const info = presetInfo[key as keyof typeof presetInfo];
                              return (
                                <Button
                                  key={key}
                                  variant={selectedPreset === key ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => handlePresetChange(key as keyof typeof WEIGHT_PRESETS)}
                                  className="text-left h-auto p-3 flex flex-col items-start space-y-2"
                                >
                                  <div className="font-medium text-sm leading-tight">
                                    {info.label}
                                  </div>
                                  <div className={`text-xs leading-relaxed ${selectedPreset === key ? 'text-white/80' : 'text-slate-500'}`}>
                                    {info.desc}
                                  </div>
                                </Button>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>

                      {/* 高级自定义权重设置 */}
                      <Card className="border-slate-200">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Sliders className="h-5 w-5 text-slate-600" />
                              <CardTitle className="text-lg">高级自定义</CardTitle>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowWeightSettings(!showWeightSettings)}
                              className="flex items-center space-x-2"
                            >
                              <span className="text-sm">{showWeightSettings ? '收起微调' : '微调权重'}</span>
                              {showWeightSettings ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          <CardDescription>
                            基于选择的模板进行精细调整，或完全自定义权重配置
                          </CardDescription>
                        </CardHeader>
                        {showWeightSettings && (
                          <CardContent className="pt-0">
                            <div className="flex items-center justify-between mb-4">
                              <span className="text-sm text-slate-600">当前模板：{
                                selectedPreset === 'reading_wisdom' ? '📚 阅读方法与教育理念' :
                                selectedPreset === 'philosophy_growth' ? '💡 人生哲理与情感感悟' :
                                selectedPreset === 'family_warmth' ? '❤️ 亲子关系与家庭教育' :
                                selectedPreset === 'nature_seasons' ? '🌿 季节与自然氛围' :
                                selectedPreset === 'creative_fantasy' ? '✨ 想象力与创意启发' :
                                selectedPreset === 'custom' ? '🎛️ 自定义配置' : '未知'
                              }</span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={resetWeights}
                                className="flex items-center space-x-2"
                              >
                                <RotateCcw className="h-4 w-4" />
                                <span>重置</span>
                              </Button>
                            </div>

                            {/* 权重滑块 */}
                            <div className="space-y-3">
                              <label className="block text-sm font-medium text-slate-700">
                                主题维度权重 (总和自动归一化)
                              </label>
                          <div className="grid gap-3">
                            {[
                              { 
                                key: 'philosophy', 
                                label: '核心理念与人生主题', 
                                icon: '🧠',
                                description: '分析画面传递的静态价值观、人生态度、世界观等。例如：对美的看法、生活的意义、幸福的定义。'
                              },
                              { 
                                key: 'action_process', 
                                label: '行动过程与成长', 
                                icon: '🚀',
                                description: '分析画面中角色的动态行为。描述他们正在做什么、经历什么挑战、如何克服，以及这个过程带来的成长。例如：探索、坚持、犯错、努力。'
                              },
                              { 
                                key: 'interpersonal_roles', 
                                label: '人际角色与情感连接', 
                                icon: '👥',
                                description: '分析画面中人物之间的关系和情感。是亲子、师生还是朋友？他们之间的互动是关爱、支持、引导还是陪伴？'
                              },
                              { 
                                key: 'edu_value', 
                                label: '阅读带来的价值', 
                                icon: '📚',
                                description: '思考这本书能带给孩子的宏观教育意义。它如何塑造品格、拓宽视野、培养审美？'
                              },
                              { 
                                key: 'learning_strategy', 
                                label: '阅读中的学习方法', 
                                icon: '💡',
                                description: '分析画面中是否展现或暗示了具体的学习方法。例如：观察、提问、对比、输出、角色扮演等。'
                              },
                              { 
                                key: 'creative_play', 
                                label: '创意表现与想象力', 
                                icon: '🎨',
                                description: '分析画面中的游戏、幻想、角色扮演等元素。它如何激发孩子的创造力和想象力？'
                              },
                              { 
                                key: 'scene_visuals', 
                                label: '场景氛围与画面元素', 
                                icon: '🌅',
                                description: '描述画面的物理信息。包括场景（室内/外）、季节、天气、光线、色彩运用、艺术风格以及营造出的整体氛围（温馨、宁静、热闹、神秘等）。'
                              }
                            ]
                            .sort((a, b) => {
                              // 按权重值从大到小排序
                              const valueA = searchWeights[a.key as keyof SearchWeights] || 0;
                              const valueB = searchWeights[b.key as keyof SearchWeights] || 0;
                              return valueB - valueA;
                            })
                            .map(({ key, label, icon, description }) => {
                              const value = Math.round((searchWeights[key as keyof SearchWeights] || 0) * 100);
                              return (
                                <div key={key} className="space-y-2.5 p-3 bg-white rounded-lg border border-slate-200">
                                  <div className="flex items-center justify-between">
                                    <label className="text-base font-bold text-slate-700 flex items-center space-x-2">
                                      <span>{icon}</span>
                                      <span>{label}</span>
                                    </label>
                                    <span className="text-sm font-medium text-blue-600 min-w-[3rem] text-right">
                                      {value}%
                                    </span>
                                  </div>
                                  
                                  {/* 维度说明 */}
                                  <div className="text-sm text-slate-500 leading-snug">
                                    {description}
                                  </div>
                                  
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={value}
                                    onChange={(e) => handleWeightChange(key as keyof SearchWeights, parseInt(e.target.value))}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                                    style={{
                                      background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${value}%, #e5e7eb ${value}%, #e5e7eb 100%)`
                                    }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>

                          {/* 权重总和显示 */}
                          <div className="text-xs text-slate-500 text-center p-2 bg-white rounded border">
                            权重总和: {Math.round(Object.values(searchWeights).reduce((sum, weight) => sum + (weight || 0), 0) * 100)}% 
                            {Math.abs(Object.values(searchWeights).reduce((sum, weight) => sum + (weight || 0), 0) - 1) > 0.05 && 
                              <span className="text-amber-600 ml-2">(将自动归一化)</span>
                            }
                          </div>
                        </CardContent>
                        )}
                      </Card>
                    </>
                  )}

                  <Button
                    onClick={handleTextMatch}
                    disabled={isMatching || !textContent.trim()}
                    className="w-full"
                  >
                    {isMatching ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {useWeightedSearch ? '多维度加权搜索中...' : '语义相似度搜索中...'}
                      </>
                    ) : (
                      <>
                        {useWeightedSearch ? (
                          <>
                            <Zap className="mr-2 h-4 w-4" />
                            开始多维度加权搜索
                          </>
                        ) : (
                          <>
                            <Search className="mr-2 h-4 w-4" />
                            开始语义相似度搜索
                          </>
                        )}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* 错误提示 */}
              {matchError && (
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="pt-6">
                    <div className="flex items-center space-x-2 text-red-600">
                      <AlertCircle className="h-5 w-5" />
                      <span>{matchError}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 匹配结果 */}
              {(matchResults.length > 0 || weightedResults.length > 0) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Target className="h-5 w-5" />
                      <span>匹配结果</span>
                    </CardTitle>
                    <CardDescription>
                      {useWeightedSearch 
                        ? `找到 ${weightedResults.length} 个加权搜索结果 (按综合得分排序)`
                        : `找到 ${matchResults.length} 个最佳匹配的插图 (按匹配度排序)`
                      }
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {(useWeightedSearch ? weightedResults : matchResults).map((result, index) => {
                        // 统一结果格式
                        const match = useWeightedSearch 
                          ? {
                              id: result.id,  // 已经是 string 类型
                              filename: result.title || `插图_${result.id}`,
                              bookTitle: '', // 加权搜索结果中暂无书名
                              // 修复：API返回的数据字段位置颠倒了
                              description: result.image_url || '暂无描述',  // 实际包含描述文字
                              imageUrl: result.original_description || '',  // 实际包含图片URL
                              similarity: result.final_score || 0,
                              metadata: {
                                bookTheme: result.theme_philosophy || '',
                                keywords: []
                              }
                            }
                          : result as IllustrationMatch;
                        

                        const matchId = `${match.filename}-${index}`;
                        const isDescExpanded = expandedDescriptions.has(matchId);
                        const isImageExpanded = expandedImages.has(matchId);
                        const isMatchingLogicExpanded = expandedMatchingLogic.has(matchId);
                        const matchingLogic = getMatchingLogic(match, textContent);
                        
                        return (
                          <Card key={matchId} className="border-l-4 border-l-blue-500">
                            <CardContent className="pt-6">
                              <div className="space-y-4">
                                {/* 排名和基本信息 */}
                                <div className="flex items-start justify-between">
                                  <div className="space-y-2">
                                    <div className="flex items-center space-x-3">
                                      <span className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 rounded-full text-sm font-bold">
                                        #{index + 1}
                                      </span>
                                      <div>
                                        <h4 className="font-semibold text-slate-900 text-lg">{match.filename}</h4>
                                        {match.bookTitle && (
                                          <p className="text-sm text-slate-600">📚 来源：{match.bookTitle}</p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <span className={cn(
                                        "px-3 py-1 text-sm rounded-full font-medium",
                                        match.similarity > 0.8 ? "bg-green-100 text-green-800" :
                                        match.similarity > 0.6 ? "bg-blue-100 text-blue-800" :
                                        "bg-yellow-100 text-yellow-800"
                                      )}>
                                        {useWeightedSearch ? '综合得分' : '匹配度'}: {(match.similarity * 100).toFixed(1)}%
                                      </span>
                                      {useWeightedSearch && (
                                        <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
                                          <Zap className="inline h-3 w-3 mr-1" />
                                          加权搜索
                                        </span>
                                      )}
                                    </div>


                                  </div>
                                </div>



                                {/* AI描述 */}
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <h5 className="font-medium text-slate-900">插图描述</h5>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => toggleDescription(matchId)}
                                      className="text-blue-600 hover:text-blue-800"
                                    >
                                      {isDescExpanded ? '收起描述' : '展开完整描述'}
                                    </Button>
                                  </div>
                                  <div className="bg-slate-50 rounded-lg p-4">
                                                                         <div className="text-sm text-slate-700 leading-relaxed space-y-2">
                                       {(() => {
                                         const fullText = match.description;
                                         const shouldTruncate = !isDescExpanded && fullText.length > 300;
                                         const displayText = shouldTruncate ? fullText.substring(0, 300) + '...' : fullText;
                                         
                                         // 按自然段落分割文本（保持与数据库original_description一致的格式）
                                         const paragraphs = displayText
                                           .split(/\n\s*\n/)  // 按双换行分段
                                           .filter(p => p.trim().length > 0)
                                           .map(p => p.trim().replace(/\n/g, ' '));  // 段内换行转为空格
                                         
                                         // 如果没有段落分割，尝试按句号分段（每段不超过200字符）
                                         if (paragraphs.length === 1 && paragraphs[0].length > 200) {
                                           const sentences = paragraphs[0].split(/[。！？]/);
                                           const newParagraphs = [];
                                           let currentParagraph = '';
                                           
                                           sentences.forEach((sentence, idx) => {
                                             if (sentence.trim()) {
                                               const punct = idx < sentences.length - 1 && sentences[idx + 1] ? 
                                                 (paragraphs[0].charAt(paragraphs[0].indexOf(sentence) + sentence.length)) : '';
                                               currentParagraph += sentence.trim() + (punct.match(/[。！？]/) ? punct : '');
                                               
                                               // 每段控制在200字符左右
                                               if (currentParagraph.length > 200 || idx === sentences.length - 1) {
                                                 if (currentParagraph.trim()) {
                                                   newParagraphs.push(currentParagraph.trim());
                                                   currentParagraph = '';
                                                 }
                                               }
                                             }
                                           });
                                           
                                           return newParagraphs.map((paragraph, index) => (
                                             <p key={index} className="mb-2 last:mb-0">
                                               {paragraph}
                                             </p>
                                           ));
                                         }
                                         
                                         // 正常段落显示
                                         return paragraphs.map((paragraph, index) => (
                                           <p key={index} className="mb-2 last:mb-0">
                                             {paragraph}
                                           </p>
                                         ));
                                       })()}
                                     </div>
                                  </div>
                                </div>

                                {/* 图片预览和操作 */}
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <h5 className="font-medium text-slate-900">图片预览</h5>
                                    {match.imageUrl && (
                                      <div className="flex items-center space-x-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => toggleImageExpanded(matchId)}
                                          className="flex items-center space-x-2"
                                        >
                                          <Eye className="h-4 w-4" />
                                          <span>{isImageExpanded ? '收起' : '查看大图'}</span>
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleDownloadImage(match.imageUrl!, match.filename)}
                                          className="flex items-center space-x-2"
                                        >
                                          <Download className="h-4 w-4" />
                                          <span>下载</span>
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* 图片显示区域 */}
                                  <div className="flex justify-center">
                                    {match.imageUrl ? (
                                      <img
                                        src={match.imageUrl}
                                        alt={match.filename}
                                        className={cn(
                                          "rounded-lg shadow-md transition-all duration-300 cursor-pointer",
                                          isImageExpanded ? "max-w-full max-h-96" : "max-w-xs max-h-48"
                                        )}
                                        onClick={() => toggleImageExpanded(matchId)}
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          target.style.display = 'none';
                                          // 显示错误占位符
                                          const parent = target.parentElement;
                                          if (parent && !parent.querySelector('.image-error-placeholder')) {
                                            const placeholder = document.createElement('div');
                                            placeholder.className = 'image-error-placeholder flex items-center justify-center bg-gray-100 rounded-lg p-8 text-gray-500 border-2 border-dashed border-gray-300 max-w-xs max-h-48';
                                            placeholder.innerHTML = '<div class="text-center"><div class="text-2xl mb-2">🖼️</div><div class="font-medium">图片加载失败</div><div class="text-xs mt-1 text-gray-400">请稍后重试</div></div>';
                                            parent.appendChild(placeholder);
                                          }
                                        }}
                                        onLoad={() => {
                                          // 图片加载成功
                                        }}
                                      />
                                    ) : (
                                      <div className="flex items-center justify-center bg-gray-100 rounded-lg p-8 text-gray-500 border-2 border-dashed border-gray-300 max-w-xs max-h-48">
                                        <div className="text-center">
                                          <div className="text-2xl mb-2">🖼️</div>
                                          <div className="font-medium">暂无图片</div>
                                          <div className="text-xs mt-1 text-gray-400">该记录未包含图片链接</div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* 图片处理标签页 */}
          <TabsContent value="upload">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>上传插图</CardTitle>
                  <CardDescription>
                    选择要处理的插图文件，系统将自动提取特征并生成描述
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ModernImageUploader onImagesUploaded={handleImagesUploaded} />
                </CardContent>
              </Card>

              {/* 处理结果详情 */}
              {processingDetails.isCompleted && processingDetails.completedFiles.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <BarChart3 className="h-5 w-5" />
                      <span>处理结果汇总</span>
                    </CardTitle>
                    <CardDescription>
                      共处理 {processingDetails.completedFiles.length} 张插图
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* 统计概览 */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-green-50 rounded-lg p-4">
                          <div className="flex items-center space-x-2">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            <span className="font-medium text-green-900">处理成功</span>
                          </div>
                          <div className="text-2xl font-bold text-green-600 mt-2">
                            {processingDetails.completedFiles.filter(f => f.status === 'completed').length}
                          </div>
                        </div>
                        
                        <div className="bg-red-50 rounded-lg p-4">
                          <div className="flex items-center space-x-2">
                            <AlertCircle className="h-5 w-5 text-red-600" />
                            <span className="font-medium text-red-900">处理失败</span>
                          </div>
                          <div className="text-2xl font-bold text-red-600 mt-2">
                            {processingDetails.completedFiles.filter(f => f.status === 'error').length}
                          </div>
                        </div>
                        
                        <div className="bg-blue-50 rounded-lg p-4">
                          <div className="flex items-center space-x-2">
                            <TrendingUp className="h-5 w-5 text-blue-600" />
                            <span className="font-medium text-blue-900">成功率</span>
                          </div>
                          <div className="text-2xl font-bold text-blue-600 mt-2">
                            {((processingDetails.completedFiles.filter(f => f.status === 'completed').length / processingDetails.completedFiles.length) * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>

                      {/* 失败文件列表（如果有的话） */}
                      {processingDetails.completedFiles.filter(f => f.status === 'error').length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-medium text-slate-900">失败文件列表</h4>
                          <div className="max-h-40 overflow-y-auto space-y-2">
                            {processingDetails.completedFiles
                              .filter(f => f.status === 'error')
                              .map((file, index) => (
                                <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                      <AlertCircle className="h-4 w-4 text-red-600" />
                                      <span className="text-sm font-medium text-slate-900">
                                        {file.name}
                                      </span>
                                    </div>
                                    <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded-full font-medium">
                                      处理失败
                                    </span>
                                  </div>
                                  {file.error && (
                                    <div className="text-xs text-red-600 mt-2">
                                      错误: {file.error}
                                    </div>
                                  )}
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 实时处理状态（处理中时显示） */}
              {processingDetails.isProcessing && processingDetails.completedFiles.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>实时处理状态</span>
                    </CardTitle>
                    <CardDescription>
                      正在处理第 {processingDetails.currentIndex} / {processingDetails.totalCount} 张插图
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* 当前处理文件 */}
                      {processingDetails.currentFile && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="flex items-center space-x-3">
                            <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                            <span className="text-sm font-medium text-slate-900">
                              正在处理: {processingDetails.currentFile}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* 最近完成的文件（最多显示5个） */}
                      <div className="space-y-2">
                        <h4 className="font-medium text-slate-900">最近完成</h4>
                        <div className="space-y-2">
                          {processingDetails.completedFiles
                            .slice(-5)
                            .map((file, index) => (
                              <div key={index} className={cn(
                                "flex items-center justify-between p-2 rounded-lg border",
                                file.status === 'completed' ? "bg-green-50 border-green-200" : 
                                file.status === 'processing' ? "bg-yellow-50 border-yellow-200" :
                                "bg-red-50 border-red-200"
                              )}>
                                <div className="flex items-center space-x-3">
                                  {file.status === 'completed' ? (
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                  ) : file.status === 'processing' ? (
                                    <Loader2 className="h-4 w-4 text-yellow-600 animate-spin" />
                                  ) : (
                                    <AlertCircle className="h-4 w-4 text-red-600" />
                                  )}
                                  <span className="text-sm text-slate-900 truncate max-w-xs">
                                    {file.name}
                                  </span>
                                </div>
                                <span className={cn(
                                  "text-xs px-2 py-1 rounded-full font-medium",
                                  file.status === 'completed' 
                                    ? "bg-green-100 text-green-800" 
                                    : file.status === 'processing'
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-red-100 text-red-800"
                                )}>
                                  {file.status === 'completed' ? '完成' : 
                                   file.status === 'processing' ? '处理中' : '失败'}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* 插图库标签页 */}
          <TabsContent value="gallery">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>插图库</CardTitle>
                  <CardDescription>
                    浏览系统中所有已处理并匹配的插图
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <Image className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 mb-2">插图库</h3>
                    <p className="text-slate-600 mb-4">查看所有已上传和处理的插图</p>
                    <Button
                      onClick={() => setIsDatabaseViewerOpen(true)}
                      className="flex items-center space-x-2 mx-auto"
                    >
                      <Database className="h-4 w-4" />
                      <span>打开插图库</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              © 2025 文图匹配工作台. 插图上传及与文图智能匹配系统
            </p>
            <div className="flex items-center space-x-4 text-sm text-slate-600">
              <img src="/logo-0.jpg" alt="Logo" className="h-12 w-auto" />
            </div>
          </div>
        </div>
      </footer>

      {/* Database Viewer Modal */}
      {isDatabaseViewerOpen && (
        <ModernDatabaseViewer 
          isOpen={isDatabaseViewerOpen}
          onClose={() => setIsDatabaseViewerOpen(false)} 
        />
      )}
    </div>
  );
};

export default OptimizedWorkspace; 