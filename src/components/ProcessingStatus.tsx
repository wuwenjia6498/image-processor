import React from 'react';

interface ProcessingStatusProps {
  progress: number;
  status: string;
}

const ProcessingStatus: React.FC<ProcessingStatusProps> = ({ progress, status }) => {
  return (
    <div className="progress-section">
      <h2>🔄 处理进度</h2>
      <p>{status}</p>
      
      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ width: `${progress}%` }}
        />
      </div>
      
      <div style={{ textAlign: 'center', color: '#6b7280' }}>
        {progress}% 完成
      </div>
    </div>
  );
};

export default ProcessingStatus; 