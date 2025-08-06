import React, { useState, useCallback } from 'react';
import ImageUploader from './ImageUploader';
import ProcessingStatus from './ProcessingStatus';
import Statistics from './Statistics';
import DatabaseViewer from './DatabaseViewer';
import { ProcessedImage } from '../types';
import { uploadImages } from '../api/imageProcessor';
import { matchIllustrationsToText, TextContent, IllustrationMatch } from '../api/illustration-api';
import '../styles/UnifiedWorkspace.css';

interface UnifiedWorkspaceProps {
  // 可以添加其他props
}

const UnifiedWorkspace: React.FC<UnifiedWorkspaceProps> = () => {
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

  // 图片上传处理
  const handleImagesUploaded = useCallback(async (images: File[]) => {
    console.log('上传的图片:', images);
    
    setIsProcessing(true);
    setProgress(0);
    setCurrentStatus('开始处理图片...');
    
    try {
      const results = await uploadImages(images);
      
      // 模拟进度更新
      for (let i = 0; i <= 100; i += 20) {
        setProgress(i);
        setCurrentStatus(`正在处理图片... ${i}%`);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      setProgress(100);
      setCurrentStatus('处理完成！');
      setProcessedImages(prev => [...prev, ...results]);
      
      const successCount = results.filter(r => r.status === 'success').length;
      const errorCount = results.filter(r => r.status === 'error').length;
      
      setTimeout(() => {
        setCurrentStatus(`✅ 成功处理 ${successCount} 张图片${errorCount > 0 ? `，${errorCount} 张失败` : ''}`);
      }, 500);
      
    } catch (error) {
      console.error('处理图片时发生错误:', error);
      setCurrentStatus('❌ 处理失败，请重试');
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
      }, 2000);
    }
  }, []);

  // 生成匹配原因的函数
  const generateMatchReason = useCallback((match: IllustrationMatch, textContent: string, index: number) => {
    const similarity = match.similarity;
    const similarityPercent = (similarity * 100).toFixed(1);
    
    // 分析文案和图片描述的关键词
    const inputWords = textContent.toLowerCase().split(/\s+|，|。|、/).filter(word => word.length > 1);
    const descWords = match.description.toLowerCase().split(/\s+|，|。|、/).filter(word => word.length > 1);
    
    // 找到共同的关键词
    const commonWords = inputWords.filter(word => 
      descWords.some(descWord => descWord.includes(word) || word.includes(descWord))
    );
    
    // 分析场景匹配
    const sceneKeywords = {
      '夜晚': ['夜晚', '星空', '月亮', '黑暗', '夜景', '暮色', '黄昏'],
      '室内': ['房间', '房子', '室内', '窗前', '窗户', '家', '屋子'],
      '室外': ['森林', '花园', '公园', '街道', '户外', '自然', '草地'],
      '动物': ['兔子', '小熊', '动物', '小鸟', '蝴蝶', '猫', '狗'],
      '人物': ['小女孩', '男孩', '孩子', '大人', '父母', '朋友'],
      '天气': ['下雨', '下雪', '阳光', '温暖', '寒冷', '天气'],
      '情感': ['温馨', '快乐', '友善', '温暖', '安静', '热闹']
    };
    
    // 分析匹配的场景类型
    const matchedScenes = [];
    for (const [scene, keywords] of Object.entries(sceneKeywords)) {
      const hasInputScene = keywords.some(keyword => 
        inputWords.some(word => word.includes(keyword) || keyword.includes(word))
      );
      const hasDescScene = keywords.some(keyword => 
        descWords.some(word => word.includes(keyword) || keyword.includes(word))
      );
      
      if (hasInputScene && hasDescScene) {
        matchedScenes.push(scene);
      }
    }
    
    // 生成具体的匹配原因
    let reason = '';
    let confidence = '';
    
    if (similarity >= 0.4) {
      confidence = '高度匹配';
      if (matchedScenes.length >= 2) {
        reason = `场景高度匹配：${matchedScenes.slice(0, 2).join('、')}场景完全吻合`;
      } else if (commonWords.length >= 3) {
        reason = `关键词高度匹配：找到${commonWords.length}个共同关键词`;
      } else {
        reason = '语义相似度极高，内容主题高度相关';
      }
    } else if (similarity >= 0.3) {
      confidence = '较好匹配';
      if (matchedScenes.length >= 1) {
        reason = `场景匹配：${matchedScenes[0]}场景相符`;
      } else if (commonWords.length >= 2) {
        reason = `关键词匹配：${commonWords.slice(0, 2).join('、')}等关键词相符`;
      } else {
        reason = '语义关联较强，内容主题相关';
      }
    } else if (similarity >= 0.2) {
      confidence = '一般匹配';
      if (commonWords.length >= 1) {
        reason = `部分关键词匹配：${commonWords[0]}等关键词相关`;
      } else {
        reason = '语义相似度一般，存在部分内容关联';
      }
    } else {
      confidence = '弱匹配';
      reason = '语义相似度较低，但仍在相关范围内';
    }
    
    // 添加具体的匹配细节
    if (commonWords.length > 0) {
      reason += `（共同元素：${commonWords.slice(0, 3).join('、')}）`;
    }
    
    // 添加场景分析
    if (matchedScenes.length > 0) {
      reason += `，场景类型：${matchedScenes.join('、')}`;
    }
    
    return {
      confidence,
      reason,
      similarity: similarityPercent,
      rank: index + 1,
      commonWords,
      matchedScenes
    };
  }, []);

  // 文案匹配处理（真实API版本）
  const handleTextMatch = useCallback(async () => {
    if (!textContent.trim()) {
      setMatchError('请输入文案内容');
      return;
    }

    setIsMatching(true);
    setMatchError(null);
    setMatchResults([]);

    try {
      console.log('开始真实API匹配...');
      
      const content: TextContent = {
        content: textContent.trim()
      };
      
      const results = await matchIllustrationsToText(content, 5);
      console.log('API返回结果:', results);
      
      setMatchResults(results);
      
      if (results.length === 0) {
        setMatchError('没有找到匹配的插图，请尝试其他文案内容');
      } else {
        console.log(`成功匹配到 ${results.length} 个结果`);
      }
      
    } catch (error) {
      console.error('文案匹配失败:', error);
      setMatchError(`匹配失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsMatching(false);
    }
  }, [textContent]);

  // 数据库查看器控制
  const handleViewDatabase = useCallback(() => {
    setIsDatabaseViewerOpen(true);
  }, []);

  const handleCloseDatabaseViewer = useCallback(() => {
    setIsDatabaseViewerOpen(false);
  }, []);

  return (
    <div className="unified-workspace">
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/logo-1.jpg" alt="Logo" style={{ height: '48px', width: '48px', borderRadius: '8px' }} />
          <h1>文图匹配工作台</h1>
        </div>
        <p>图片上传及与文图智能匹配系统</p>
      </div>

      {/* 标签页导航 */}
      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'match' ? 'active' : ''}`}
          onClick={() => setActiveTab('match')}
        >
          🔍 文案匹配插图
        </button>
        <button 
          className={`tab-button ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          📤 图片上传处理
        </button>
        <button 
          className="tab-button database-button"
          onClick={handleViewDatabase}
        >
          📋 查看数据库
        </button>
      </div>

      {/* 文案匹配标签页 */}
      {activeTab === 'match' && (
        <div className="tab-content match-tab">
          <div className="section-header">
            <h2>🔍 文案匹配插图</h2>
            <p>输入文案内容，系统将基于语义相似度为您匹配最合适的插图</p>
          </div>

          <div className="text-input-section">
            <div className="input-group">
              <label htmlFor="text-content">文案内容：</label>
              <textarea
                id="text-content"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="请输入您的文案内容，例如：小兔子在森林里遇到了一只友善的小熊，它们一起在花丛中玩耍..."
                rows={4}
                className="text-input"
              />
            </div>
            
            <button 
              onClick={handleTextMatch}
              disabled={isMatching || !textContent.trim()}
              className="match-button"
            >
              {isMatching ? '🔄 匹配中...' : '🔍 匹配插图'}
            </button>
          </div>

          {matchError && (
            <div className="error-message">
              ❌ {matchError}
            </div>
          )}

          {isMatching && (
            <div className="matching-status">
              🔄 正在分析文案语义，搜索匹配的插图...
            </div>
          )}

          {matchResults.length > 0 && (
            <div className="match-results">
              <h3>匹配结果 ({matchResults.length} 个)</h3>
              <div className="results-grid">
                {matchResults.map((match, index) => {
                  const matchReason = generateMatchReason(match, textContent, index);
                  
                  return (
                  <div key={match.id} className="match-item">
                    <div className="match-header">
                      <span className="match-rank">#{index + 1}</span>
                      <span className="similarity-score">
                        相似度: {(match.similarity * 100).toFixed(1)}%
                      </span>
                      <span className={`confidence-badge confidence-${matchReason.confidence === '高度匹配' ? 'high' : 
                        matchReason.confidence === '较好匹配' ? 'good' : 
                        matchReason.confidence === '一般匹配' ? 'medium' : 'low'}`}>
                        {matchReason.confidence}
                      </span>
                    </div>
                    
                    {/* 匹配原因显示 */}
                    <div className="match-reason">
                      <div className="reason-icon">🎯</div>
                      <div className="reason-text">
                        <strong>匹配原因：</strong>{matchReason.reason}
                      </div>
                    </div>
                    
                    {match.imageUrl && (
                      <div className="match-image">
                        <img 
                          src={match.imageUrl} 
                          alt={match.filename}
                          onError={(e) => {
                            console.error('图片加载失败:', match.imageUrl);
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                          onLoad={() => {
                            console.log('图片加载成功:', match.imageUrl);
                          }}
                        />
                      </div>
                    )}
                    
                    <div className="match-info">
                      <div className="filename">{match.filename}</div>
                      <div className="book-title">📖 {match.bookTitle}</div>
                      <div className="description-container">
                        <div className="description">
                          {expandedDescriptions.has(match.id) 
                            ? match.description
                            : match.description.length > 100 
                              ? `${match.description.substring(0, 100)}...`
                              : match.description
                          }
                        </div>
                        {match.description.length > 100 && (
                          <button 
                            className="expand-button"
                            onClick={() => toggleDescription(match.id)}
                          >
                            {expandedDescriptions.has(match.id) ? '收起' : '展开更多'}
                          </button>
                        )}
                      </div>
                      
                      {match.metadata.bookTheme && (
                        <div className="theme">🎭 主题: {match.metadata.bookTheme}</div>
                      )}
                      
                      {match.metadata.keywords && match.metadata.keywords.length > 0 && (
                        <div className="keywords">
                          🏷️ 关键词: {match.metadata.keywords.join(', ')}
                        </div>
                      )}
                    </div>
                    
                    {match.imageUrl && (
                      <a 
                        href={match.imageUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="view-full-button"
                      >
                        🔍 查看原图
                      </a>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 图片上传标签页 */}
      {activeTab === 'upload' && (
        <div className="tab-content upload-tab">
          <div className="section-header">
            <h2>📤 图片上传与处理</h2>
            <p>上传绘本插图，系统将自动生成AI描述并存储到数据库</p>
          </div>

          <ImageUploader onImagesUploaded={handleImagesUploaded} />

          {isProcessing && (
            <ProcessingStatus 
              progress={progress} 
              status={currentStatus} 
            />
          )}

          {processedImages.length > 0 && (
            <Statistics 
              processedImages={processedImages}
              onStartProcessing={() => {}}
              onViewDatabase={handleViewDatabase}
            />
          )}
        </div>
      )}

      {/* 数据库查看器 */}
      <DatabaseViewer 
        isOpen={isDatabaseViewerOpen}
        onClose={handleCloseDatabaseViewer}
      />
    </div>
  );
};

export default UnifiedWorkspace; 