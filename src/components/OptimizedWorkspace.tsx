import React, { useState, useCallback } from 'react';
import { Upload, Image, Database, BarChart3, Search, Loader2, CheckCircle, AlertCircle, TrendingUp, Download, Eye, Brain, Target, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import ModernImageUploader from './ModernImageUploader';
import ModernDatabaseViewer from './ModernDatabaseViewer';
import { ProcessedImage } from '../types';
import { uploadImages, ProcessedImage as APIProcessedImage } from '../api/imageProcessor';
import { matchIllustrationsToText, TextContent, IllustrationMatch } from '../api/illustration-api';
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

    try {
      const content: TextContent = {
        content: textContent,
        theme: '通用',
        keywords: []
      };

      const results = await matchIllustrationsToText(content);
      // 只取前5个匹配度最高的结果
      setMatchResults(results.slice(0, 5));
    } catch (error) {
      console.error('匹配文案时出错:', error);
      setMatchError('匹配失败: ' + (error as Error).message);
    } finally {
      setIsMatching(false);
    }
  }, [textContent]);

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

  // 获取匹配逻辑说明
  const getMatchingLogic = (match: IllustrationMatch, textContent: string) => {
    const similarity = (match.similarity * 100).toFixed(1);
    const logicPoints = [];

    // 1. 相似度深度分析
    if (match.similarity > 0.8) {
      logicPoints.push({
        icon: '🎯',
        title: `高度匹配 (${similarity}%)`,
        detail: `相似度评分超过80%，表明插图内容与您的文案在语义层面高度契合。这种匹配度通常意味着插图的主要元素、情感色彩或场景设定与文案描述的核心概念非常接近。`
      });
    } else if (match.similarity > 0.6) {
      logicPoints.push({
        icon: '✅',
        title: `良好匹配 (${similarity}%)`,
        detail: `相似度评分在60-80%区间，说明插图内容与文案具有较强的关联性。虽然不是完美匹配，但在主题、风格或情感表达上存在明显的共同点，能够有效支撑文案内容。`
      });
    } else if (match.similarity > 0.4) {
      logicPoints.push({
        icon: '⚠️',
        title: `一般匹配 (${similarity}%)`,
        detail: `相似度评分在40-60%区间，表明插图与文案存在一定的相关性。可能在某些特定角度（如情感基调、场景氛围或部分关键元素）与文案产生共鸣，但整体匹配度有待提升。`
      });
    } else {
      logicPoints.push({
        icon: '🔍',
        title: `潜在匹配 (${similarity}%)`,
        detail: `相似度评分较低，但系统仍识别出了一些潜在的关联点。这可能源于隐含的语义联系、抽象的概念关联，或是在特定语境下的间接相关性。建议结合具体需求评估使用价值。`
      });
    }

    // 2. 关键词匹配深度分析
    const textWords = textContent.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    const descWords = match.description.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    const commonWords = textWords.filter(word => 
      descWords.some(descWord => descWord.includes(word) || word.includes(descWord))
    );
    
    if (commonWords.length > 3) {
      logicPoints.push({
        icon: '🔍',
        title: `强关键词匹配`,
        detail: `发现 ${commonWords.length} 个共同关键词：${commonWords.slice(0, 5).join('、')}${commonWords.length > 5 ? '等' : ''}。这些词汇的重合表明文案与插图在具体描述对象、场景要素或情感表达上存在直接的语言层面对应关系，增强了匹配的可信度。`
      });
    } else if (commonWords.length > 0) {
      logicPoints.push({
        icon: '🔍',
        title: `关键词呼应`,
        detail: `识别出 ${commonWords.length} 个共同关键词：${commonWords.join('、')}。虽然词汇重合度不高，但这些关键词的出现暗示了文案与插图在某些核心概念上的一致性，为匹配提供了基础的语言学支撑。`
      });
    } else {
      // 进行更深层的语义分析
      const textLength = textContent.length;
      const descLength = match.description.length;
      if (textLength > 50 && descLength > 100) {
        logicPoints.push({
          icon: '🔍',
          title: `深层语义关联`,
          detail: `虽未发现直接的关键词匹配，但基于文本长度和内容丰富度分析，系统通过深度语义理解识别出潜在关联。这种匹配依赖于AI对语言深层含义的理解，可能涉及情感色彩、抽象概念或隐喻表达的相似性。`
        });
      }
    }

    // 3. 主题来源深度分析
    if (match.bookTitle) {
      const bookThemeAnalysis = analyzeBookTheme(match.bookTitle, textContent);
      logicPoints.push({
        icon: '📚',
        title: `主题来源分析`,
        detail: `插图来源于《${match.bookTitle}》。${bookThemeAnalysis} 书籍作为插图的原始语境，为匹配提供了主题层面的背景支撑，有助于理解插图的深层含义和适用场景。`
      });
    }

    // 4. 语义分析技术解释
    const vectorAnalysis = analyzeVectorSimilarity(match.similarity, textContent, match.description);
    logicPoints.push({
      icon: '🧠',
      title: `AI语义分析技术`,
      detail: vectorAnalysis
    });

    // 5. 内容特征深度分析
    if (match.description.length > 200) {
      const contentAnalysis = analyzeContentRichness(match.description, textContent);
      logicPoints.push({
        icon: '📝',
        title: `内容丰富度分析`,
        detail: `插图描述长度为 ${match.description.length} 字，${contentAnalysis} 详细的描述为匹配算法提供了更多维度的分析素材，提高了匹配精度。`
      });
    }

    // 6. 情感色彩分析
    const emotionAnalysis = analyzeEmotionalTone(textContent, match.description);
    if (emotionAnalysis) {
      logicPoints.push({
        icon: '💭',
        title: `情感色彩匹配`,
        detail: emotionAnalysis
      });
    }

    return logicPoints;
  };

  // 分析书籍主题相关性
  const analyzeBookTheme = (bookTitle: string, textContent: string) => {
    const familyKeywords = ['家庭', '亲子', '父母', '孩子', '家人', '温馨', '陪伴'];
    const adventureKeywords = ['探险', '旅行', '发现', '冒险', '探索', '奇幻'];
    const educationKeywords = ['学习', '教育', '成长', '知识', '智慧', '启发'];
    
    const lowerText = textContent.toLowerCase();
    const lowerTitle = bookTitle.toLowerCase();
    
    if (familyKeywords.some(keyword => lowerText.includes(keyword) || lowerTitle.includes(keyword))) {
      return '该书籍主题偏向家庭温情，与文案中体现的人文关怀或情感表达形成呼应。';
    } else if (adventureKeywords.some(keyword => lowerText.includes(keyword) || lowerTitle.includes(keyword))) {
      return '该书籍具有探索冒险色彩，与文案中的动态描述或探索精神产生共鸣。';
    } else if (educationKeywords.some(keyword => lowerText.includes(keyword) || lowerTitle.includes(keyword))) {
      return '该书籍注重教育启发，与文案的知识传递或成长主题相契合。';
    } else {
      return '该书籍为插图提供了特定的文化背景和叙事语境，虽然主题关联度需要进一步评估，但原始出处的完整性有助于理解插图的创作意图。';
    }
  };

  // 分析向量相似度技术细节
  const analyzeVectorSimilarity = (similarity: number, textContent: string, description: string) => {
    const textComplexity = textContent.split(' ').length;
    const descComplexity = description.split(' ').length;
    
    if (similarity > 0.7) {
      return `系统使用高维向量空间模型将文案和插图描述转换为数值向量，通过余弦相似度计算得出 ${(similarity * 100).toFixed(1)}% 的匹配度。这一高分表明两个文本在语义向量空间中距离较近，意味着它们在抽象语义层面具有相似的"语义指纹"。算法考虑了词汇语义、句法结构和语境信息的综合影响。`;
    } else if (similarity > 0.4) {
      return `通过深度学习模型将文本转换为 ${textComplexity > 20 ? '高维' : '标准'}语义向量，计算得出 ${(similarity * 100).toFixed(1)}% 的相似度。这个分数反映了文案与插图描述在语义空间中的相对位置关系。虽然不是完美匹配，但算法识别出了一定程度的语义关联，可能涉及同义词替换、概念层次关系或上下文语境的相似性。`;
    } else {
      return `基于transformer架构的语言模型对文本进行深度语义编码，生成的向量表示捕获了文本的深层语义特征。${(similarity * 100).toFixed(1)}% 的相似度虽然不高，但仍表明在高维语义空间中存在可测量的关联性。这种关联可能源于抽象概念的相似性、隐含语义的呼应，或是在特定语义维度上的局部匹配。`;
    }
  };

  // 分析内容丰富度
  const analyzeContentRichness = (description: string, textContent: string) => {
    const sentences = description.split(/[。！？.!?]/).filter(s => s.trim().length > 0);
    const avgSentenceLength = description.length / sentences.length;
    
    if (sentences.length > 5 && avgSentenceLength > 15) {
      return '属于高质量详细描述，包含丰富的场景细节、人物特征和情感描述。';
    } else if (sentences.length > 3) {
      return '提供了较为完整的场景描述，涵盖了主要的视觉元素和基本情境。';
    } else {
      return '虽然描述相对简洁，但仍包含了关键的识别信息。';
    }
  };

  // 分析情感色彩
  const analyzeEmotionalTone = (textContent: string, description: string) => {
    const positiveWords = ['快乐', '温馨', '美好', '幸福', '愉快', '开心', '欢乐', '甜蜜', '温暖', '舒适'];
    const peacefulWords = ['宁静', '平静', '安详', '祥和', '静谧', '悠闲', '轻松', '舒缓'];
    const dynamicWords = ['活跃', '生动', '热闹', '充满活力', '动感', '激动', '兴奋'];
    
    const textLower = textContent.toLowerCase();
    const descLower = description.toLowerCase();
    
    const positiveCount = positiveWords.filter(word => textLower.includes(word) || descLower.includes(word)).length;
    const peacefulCount = peacefulWords.filter(word => textLower.includes(word) || descLower.includes(word)).length;
    const dynamicCount = dynamicWords.filter(word => textLower.includes(word) || descLower.includes(word)).length;
    
    if (positiveCount > 0) {
      return `文案与插图描述都传达出积极正面的情感色彩，共同营造出温馨愉悦的氛围。这种情感基调的一致性增强了内容的协调性和感染力。`;
    } else if (peacefulCount > 0) {
      return `两者都体现出宁静祥和的情感特质，适合营造平静舒缓的阅读体验。这种情感共鸣有助于创造统一的感受基调。`;
    } else if (dynamicCount > 0) {
      return `文案与插图都展现出活跃生动的特征，能够传递积极向上的能量和动感体验。`;
    } else {
      return null; // 如果没有明显的情感色彩匹配，就不显示这一项
    }
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
                  <Button
                    onClick={handleTextMatch}
                    disabled={isMatching || !textContent.trim()}
                    className="w-full"
                  >
                    {isMatching ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        匹配中...
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        开始匹配
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
              {matchResults.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Target className="h-5 w-5" />
                      <span>匹配结果</span>
                    </CardTitle>
                    <CardDescription>
                      找到 {matchResults.length} 个最佳匹配的插图 (按匹配度排序)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {matchResults.map((match, index) => {
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
                                        匹配度: {(match.similarity * 100).toFixed(1)}%
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* 匹配逻辑说明 */}
                                <div className="bg-blue-50 rounded-lg p-4">
                                  <div 
                                    className="flex items-center justify-between cursor-pointer hover:bg-blue-100 rounded-lg p-2 -m-2 transition-colors"
                                    onClick={() => toggleMatchingLogic(matchId)}
                                  >
                                    <div className="flex items-center space-x-2">
                                      <Brain className="h-4 w-4 text-blue-600" />
                                      <span className="font-medium text-blue-900">匹配逻辑分析</span>
                                      <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                                        {matchingLogic.length} 项分析
                                      </span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <span className="text-xs text-blue-600">
                                        {isMatchingLogicExpanded ? '点击收起' : '点击展开'}
                                      </span>
                                      {isMatchingLogicExpanded ? (
                                        <ChevronUp className="h-4 w-4 text-blue-600" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4 text-blue-600" />
                                      )}
                                    </div>
                                  </div>
                                  
                                  {isMatchingLogicExpanded && (
                                    <div className="space-y-3 mt-3">
                                      {matchingLogic.map((logic, logicIndex) => (
                                        <div key={logicIndex} className="bg-white rounded-lg p-3 border border-blue-100">
                                          <div className="flex items-start space-x-3">
                                            <span className="text-lg flex-shrink-0 mt-0.5">{logic.icon}</span>
                                            <div className="flex-1 min-w-0">
                                              <div className="font-medium text-blue-900 mb-1">
                                                {logic.title}
                                              </div>
                                              <div className="text-sm text-blue-700 leading-relaxed">
                                                {logic.detail}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
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
                                    <p className="text-sm text-slate-700 leading-relaxed">
                                      {isDescExpanded 
                                        ? match.description 
                                        : `${match.description.substring(0, 150)}${match.description.length > 150 ? '...' : ''}`
                                      }
                                    </p>
                                  </div>
                                </div>

                                {/* 图片预览和操作 */}
                                {match.imageUrl && (
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                      <h5 className="font-medium text-slate-900">图片预览</h5>
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
                                    </div>
                                    
                                    {/* 小图预览 */}
                                    <div className="flex justify-center">
                                      <img
                                        src={match.imageUrl}
                                        alt={match.filename}
                                        className={cn(
                                          "rounded-lg shadow-md transition-all duration-300 cursor-pointer",
                                          isImageExpanded ? "max-w-full max-h-96" : "max-w-xs max-h-48"
                                        )}
                                        onClick={() => toggleImageExpanded(matchId)}
                                      />
                                    </div>
                                  </div>
                                )}
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