import React from 'react';
import { Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { cn } from '../lib/utils';

interface ModernProcessingStatusProps {
  progress: number;
  status: string;
  isProcessing?: boolean;
}

const ModernProcessingStatus: React.FC<ModernProcessingStatusProps> = ({ 
  progress, 
  status, 
  isProcessing = false 
}) => {
  const getStatusIcon = () => {
    if (isProcessing) {
      return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
    } else if (progress === 100) {
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    } else if (status.includes('失败') || status.includes('错误')) {
      return <AlertCircle className="h-5 w-5 text-red-600" />;
    } else {
      return <Clock className="h-5 w-5 text-slate-600" />;
    }
  };

  const getStatusColor = () => {
    if (isProcessing) {
      return 'text-blue-700';
    } else if (progress === 100) {
      return 'text-green-700';
    } else if (status.includes('失败') || status.includes('错误')) {
      return 'text-red-700';
    } else {
      return 'text-slate-700';
    }
  };

  const getProgressBarColor = () => {
    if (status.includes('失败') || status.includes('错误')) {
      return 'bg-red-500';
    } else if (progress === 100) {
      return 'bg-green-500';
    } else {
      return 'bg-blue-500';
    }
  };

  return (
    <div className="space-y-4">
      {/* 状态信息 */}
      <div className="flex items-center space-x-3">
        {getStatusIcon()}
        <div className="flex-1">
          <p className={cn("font-medium", getStatusColor())}>
            {status}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {isProcessing ? '正在处理中，请稍候...' : '处理状态更新'}
          </p>
        </div>
      </div>

      {/* 进度条 */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-slate-700">处理进度</span>
          <span className="text-sm text-slate-600">{progress}%</span>
        </div>
        
        <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300 ease-out",
              getProgressBarColor()
            )}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      </div>

      {/* 进度详情 */}
      <div className="grid grid-cols-3 gap-4 pt-2">
        <div className="text-center">
          <div className="text-lg font-semibold text-slate-900">
            {Math.round(progress)}%
          </div>
          <div className="text-xs text-slate-500">完成度</div>
        </div>
        
        <div className="text-center">
          <div className={cn(
            "text-lg font-semibold",
            isProcessing ? "text-blue-600" : "text-slate-900"
          )}>
            {isProcessing ? '处理中' : '已完成'}
          </div>
          <div className="text-xs text-slate-500">状态</div>
        </div>
        
        <div className="text-center">
          <div className="text-lg font-semibold text-slate-900">
            {progress === 100 ? '✓' : '⏳'}
          </div>
          <div className="text-xs text-slate-500">结果</div>
        </div>
      </div>
    </div>
  );
};

export default ModernProcessingStatus; 