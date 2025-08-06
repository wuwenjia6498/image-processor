import React, { useState, useCallback } from 'react';
import { Upload, Image, Database, BarChart3, Search, Loader2, CheckCircle, AlertCircle, TrendingUp, FileText, Calendar } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import ModernImageUploader from './ModernImageUploader';
import ModernDatabaseViewer from './ModernDatabaseViewer';
import ModernProcessingStatus from './ModernProcessingStatus';
import ModernStatistics from './ModernStatistics';
import { ProcessedImage } from '../types';
import { uploadImages, ProcessedImage as APIProcessedImage } from '../api/imageProcessor';
import { matchIllustrationsToText, TextContent, IllustrationMatch } from '../api/illustration-api';
import { cn } from '../lib/utils';

interface ModernWorkspaceProps {
  // 可以添加其他props
}

const ModernWorkspace: React.FC<ModernWorkspaceProps> = () => {
  // 图片上传相关状态
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
  const [activeTab, setActiveTab] = useState<'upload' | 'match'>('match');
  const [isDatabaseViewerOpen, setIsDatabaseViewerOpen] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());

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

  // 转换API返回的ProcessedImage到组件需要的类型
  const convertAPIProcessedImage = (apiImage: APIProcessedImage): ProcessedImage => {
    return {
      id: apiImage.id,
      filename: apiImage.filename,
      bookTitle: apiImage.bookTitle,
      aiDescription: apiImage.aiDescription,
      ageOrientation: '全年龄', // 默认值
      textTypeFit: '适合', // 默认值
      bookTheme: apiImage.bookTheme,
      keywords: [], // 默认值
      status: apiImage.status,
      imageUrl: apiImage.imageUrl,
    };
  };

  // 图片上传处理
  const handleImagesUploaded = useCallback(async (images: File[]) => {
    console.log('上传的图片:', images);
    
    setIsProcessing(true);
    setProgress(0);
    setCurrentStatus('开始处理图片...');
    
    try {
      const result = await uploadImages(images);
      
      // 转换API返回的类型到组件需要的类型
      const convertedImages = result.map(convertAPIProcessedImage);
      setProcessedImages(convertedImages);
      setCurrentStatus('处理完成!');
    } catch (error) {
      console.error('处理图片时出错:', error);
      setCurrentStatus('处理失败: ' + (error as Error).message);
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
      setMatchResults(results);
    } catch (error) {
      console.error('匹配文案时出错:', error);
      setMatchError('匹配失败: ' + (error as Error).message);
    } finally {
      setIsMatching(false);
    }
  }, [textContent]);

  // 模拟开始处理函数
  const handleStartProcessing = useCallback(() => {
    // 这里可以添加开始处理的逻辑
    console.log('开始处理...');
  }, []);

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
                <p className="text-sm text-slate-600">图片上传及与文图智能匹配系统</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDatabaseViewerOpen(true)}
                className="flex items-center space-x-2"
              >
                <Database className="h-4 w-4" />
                <span>数据库</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Statistics */}
          <aside className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5" />
                  <span>统计信息</span>
                </CardTitle>
                <CardDescription>系统处理统计</CardDescription>
              </CardHeader>
              <CardContent>
                <ModernStatistics 
                  processedImages={processedImages}
                  onStartProcessing={handleStartProcessing}
                  onViewDatabase={() => setIsDatabaseViewerOpen(true)}
                />
              </CardContent>
            </Card>
          </aside>

          {/* Main Content Area */}
          <section className="lg:col-span-3">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'upload' | 'match')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="match" className="flex items-center space-x-2">
                  <Search className="h-4 w-4" />
                  <span>文案匹配</span>
                </TabsTrigger>
                <TabsTrigger value="upload" className="flex items-center space-x-2">
                  <Upload className="h-4 w-4" />
                  <span>图片上传</span>
                </TabsTrigger>
              </TabsList>

              {/* 文案匹配标签页 */}
              <TabsContent value="match" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>文案匹配</CardTitle>
                    <CardDescription>
                      输入文案内容，系统将为您推荐最匹配的插图
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

                {matchResults.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>匹配结果</CardTitle>
                      <CardDescription>
                        找到 {matchResults.length} 个匹配的插图
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4">
                        {matchResults.map((match, index) => (
                          <div
                            key={`${match.filename}-${index}`}
                            className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                          >
                            <div className="flex justify-between items-start mb-3">
                              <h4 className="font-semibold text-slate-900">{match.filename}</h4>
                              <div className="flex items-center space-x-2">
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                  相似度: {(match.similarity * 100).toFixed(1)}%
                                </span>
                                {match.bookTitle && (
                                  <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                                    {match.bookTitle}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {match.description && (
                              <div className="mb-3">
                                <p className="text-sm text-slate-600 line-clamp-3">
                                  {expandedDescriptions.has(`${match.filename}-${index}`)
                                    ? match.description
                                    : `${match.description.substring(0, 150)}${match.description.length > 150 ? '...' : ''}`
                                  }
                                </p>
                                {match.description.length > 150 && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleDescription(`${match.filename}-${index}`)}
                                    className="mt-2 p-0 h-auto text-blue-600 hover:text-blue-800"
                                  >
                                    {expandedDescriptions.has(`${match.filename}-${index}`) ? '收起' : '展开'}
                                  </Button>
                                )}
                              </div>
                            )}
                            
                            {match.imageUrl && (
                              <div className="flex justify-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  asChild
                                >
                                  <a
                                    href={match.imageUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center space-x-2"
                                  >
                                    <Image className="h-4 w-4" />
                                    <span>查看图片</span>
                                  </a>
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* 图片上传标签页 */}
              <TabsContent value="upload" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>上传图片</CardTitle>
                    <CardDescription>
                      选择要处理的图片文件，系统将自动提取特征并生成描述
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ModernImageUploader onImagesUploaded={handleImagesUploaded} />
                  </CardContent>
                </Card>

                {(isProcessing || processedImages.length > 0) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        {isProcessing ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        )}
                        <span>处理状态</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ModernProcessingStatus
                        isProcessing={isProcessing}
                        progress={progress}
                        status={currentStatus}
                      />
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              © 2025 文图匹配工作台. 图片上传及与文图智能匹配系统
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

export default ModernWorkspace; 