import React, { useState, useRef, useCallback } from 'react';
import ImageUploader from './components/ImageUploader';
import ProcessingStatus from './components/ProcessingStatus';
import Statistics from './components/Statistics';
import DatabaseViewer from './components/DatabaseViewer';
import { ProcessedImage } from './types';
import { uploadImages } from './api/imageProcessor';

function App() {
  const [processedImages, setProcessedImages] = useState<ProcessedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStatus, setCurrentStatus] = useState('');
  const [isDatabaseViewerOpen, setIsDatabaseViewerOpen] = useState(false);

  const handleImagesUploaded = useCallback(async (images: File[]) => {
    console.log('上传的图片:', images);
    
    setIsProcessing(true);
    setProgress(0);
    setCurrentStatus('开始处理图片...');
    
    try {
      // 使用真实的API调用
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
      
      // 显示成功消息
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

  const handleStartProcessing = useCallback(() => {
    // 这里可以调用实际的图片处理API
    console.log('开始处理图片...');
  }, []);

  const handleViewDatabase = useCallback(() => {
    setIsDatabaseViewerOpen(true);
  }, []);

  const handleCloseDatabaseViewer = useCallback(() => {
    setIsDatabaseViewerOpen(false);
  }, []);

  return (
    <div className="container">
      <div className="header">
        <h1>🎨 图片处理器 - 增强版AI描述生成</h1>
        <p>上传绘本插图，自动生成包含主题信息的增强版AI描述</p>
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
          onStartProcessing={handleStartProcessing}
          onViewDatabase={handleViewDatabase}
        />
      )}

      <DatabaseViewer 
        isOpen={isDatabaseViewerOpen}
        onClose={handleCloseDatabaseViewer}
      />
    </div>
  );
}

export default App; 