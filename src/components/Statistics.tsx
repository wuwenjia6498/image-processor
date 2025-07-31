import React from 'react';
import { ProcessedImage } from '../types';

interface StatisticsProps {
  processedImages: ProcessedImage[];
  onStartProcessing: () => void;
  onViewDatabase: () => void;
}

const Statistics: React.FC<StatisticsProps> = ({ 
  processedImages, 
  onStartProcessing, 
  onViewDatabase 
}) => {
  const successCount = processedImages.filter(img => img.status === 'success').length;
  const errorCount = processedImages.filter(img => img.status === 'error').length;
  const processingCount = processedImages.filter(img => img.status === 'processing').length;

  return (
    <div className="status-section">
      <h2>📊 处理统计</h2>
      
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-number">{processedImages.length}</div>
          <div className="stat-label">总图片数</div>
        </div>
        <div className="stat-card">
          <div className="stat-number" style={{ color: '#10b981' }}>{successCount}</div>
          <div className="stat-label">处理成功</div>
        </div>
        <div className="stat-card">
          <div className="stat-number" style={{ color: '#ef4444' }}>{errorCount}</div>
          <div className="stat-label">处理失败</div>
        </div>
        <div className="stat-card">
          <div className="stat-number" style={{ color: '#f59e0b' }}>{processingCount}</div>
          <div className="stat-label">处理中</div>
        </div>
      </div>
      
      <div style={{ marginTop: '30px', display: 'flex', gap: '15px', justifyContent: 'center' }}>
        <button className="button" onClick={onStartProcessing}>
          🚀 开始处理
        </button>
        <button className="button button-secondary" onClick={onViewDatabase}>
          📋 查看数据库
        </button>
      </div>
      
      {processedImages.length > 0 && (
        <div style={{ marginTop: '30px' }}>
          <h3>最近处理的图片</h3>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {processedImages.slice(-5).map((image) => (
              <div key={image.id} className="status-item">
                <div className={`status-icon status-${image.status}`}>
                  {image.status === 'success' ? '✅' : 
                   image.status === 'error' ? '❌' : '⏳'}
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontWeight: 'bold', color: '#374151' }}>
                    {image.filename}
                  </div>
                  <div style={{ fontSize: '0.9em', color: '#6b7280' }}>
                    {image.bookTitle} - {image.ageOrientation}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Statistics; 