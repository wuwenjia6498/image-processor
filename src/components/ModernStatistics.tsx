import React from 'react';
import { BarChart3, CheckCircle, XCircle, Clock, Image, Database, TrendingUp } from 'lucide-react';
import { ProcessedImage } from '../types';
import { Button } from './ui/button';

interface ModernStatisticsProps {
  processedImages: ProcessedImage[];
  onStartProcessing: () => void;
  onViewDatabase: () => void;
}

const ModernStatistics: React.FC<ModernStatisticsProps> = ({ 
  processedImages, 
  onStartProcessing, 
  onViewDatabase 
}) => {
  const successCount = processedImages.filter(img => img.status === 'success').length;
  const errorCount = processedImages.filter(img => img.status === 'error').length;
  const processingCount = processedImages.filter(img => img.status === 'processing').length;
  const totalCount = processedImages.length;

  const stats = [
    {
      label: '总图片数',
      value: totalCount,
      icon: Image,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      label: '处理成功',
      value: successCount,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      label: '处理失败',
      value: errorCount,
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
    },
    {
      label: '处理中',
      value: processingCount,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
    },
  ];

  const successRate = totalCount > 0 ? ((successCount / totalCount) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* 统计卡片网格 */}
      <div className="grid grid-cols-1 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold text-slate-900">
                    {stat.value}
                  </p>
                  <p className="text-sm text-slate-600">
                    {stat.label}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 成功率指示器 */}
      {totalCount > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-slate-900">成功率</span>
            </div>
            <span className="text-2xl font-bold text-green-600">
              {successRate}%
            </span>
          </div>
          
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${successRate}%` }}
            />
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="space-y-3">
        <Button
          onClick={onViewDatabase}
          variant="outline"
          className="w-full flex items-center justify-center space-x-2"
        >
          <Database className="h-4 w-4" />
          <span>查看数据库</span>
        </Button>
        
        <Button
          onClick={onStartProcessing}
          className="w-full flex items-center justify-center space-x-2"
          disabled={processingCount > 0}
        >
          <BarChart3 className="h-4 w-4" />
          <span>
            {processingCount > 0 ? '处理中...' : '开始处理'}
          </span>
        </Button>
      </div>

      {/* 快速统计信息 */}
      {totalCount > 0 && (
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <h4 className="font-medium text-slate-900 mb-3">处理概览</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">已处理图片:</span>
              <span className="font-medium text-slate-900">
                {successCount + errorCount} / {totalCount}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">成功率:</span>
              <span className="font-medium text-green-600">{successRate}%</span>
            </div>
            {errorCount > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600">失败数量:</span>
                <span className="font-medium text-red-600">{errorCount}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModernStatistics; 