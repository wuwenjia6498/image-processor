import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Search, RefreshCw, Database, Calendar, FileText, Image, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { fetchDatabaseRecordsPaginated, getDatabaseStats, DatabaseRecord, PaginatedResult } from '../api/supabaseClient';
import { cn } from '../lib/utils';

interface ModernDatabaseViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

const ModernDatabaseViewer: React.FC<ModernDatabaseViewerProps> = ({ isOpen, onClose }) => {
  const [records, setRecords] = useState<DatabaseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20); // 每页显示20条记录
  const [pagination, setPagination] = useState<PaginatedResult<DatabaseRecord> | null>(null);
  const [stats, setStats] = useState<{ total: number; recentCount: number } | null>(null);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [imageLoadStates, setImageLoadStates] = useState<Record<string, 'loading' | 'loaded' | 'error'>>({});

  // 防抖搜索
  const debouncedSearch = useCallback((term: string) => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    const timeout = setTimeout(() => {
      setCurrentPage(1); // 重置到第一页
      loadDatabaseRecords(1, term);
    }, 500);
    
    setSearchTimeout(timeout);
  }, [searchTimeout]);

  // 加载数据库记录
  const loadDatabaseRecords = useCallback(async (page: number = 1, search: string = searchTerm) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await fetchDatabaseRecordsPaginated({
        page,
        pageSize,
        searchTerm: search
      });
      
      setRecords(result.data);
      setPagination(result);
      
      // 如果是第一页，同时加载统计信息
      if (page === 1) {
        try {
          const statsData = await getDatabaseStats();
          setStats(statsData);
        } catch (statsError) {
          console.warn('获取统计信息失败:', statsError);
        }
      }
    } catch (err) {
      setError('获取数据库记录失败，请检查网络连接');
      console.error('获取数据库记录失败:', err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, pageSize]);

  // 处理搜索输入
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    debouncedSearch(value);
  };

  // 处理分页
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    loadDatabaseRecords(page);
  };

  // 图片加载处理
  const handleImageLoad = (id: string) => {
    setImageLoadStates(prev => ({ ...prev, [id]: 'loaded' }));
  };

  const handleImageError = (id: string) => {
    setImageLoadStates(prev => ({ ...prev, [id]: 'error' }));
  };

  // 初始化图片加载状态
  useEffect(() => {
    const newImageStates: Record<string, 'loading' | 'loaded' | 'error'> = {};
    records.forEach(record => {
      newImageStates[record.id] = 'loading';
    });
    setImageLoadStates(newImageStates);
  }, [records]);

  // 组件打开时加载数据
  useEffect(() => {
    if (isOpen) {
      loadDatabaseRecords(1);
    }
  }, [isOpen, loadDatabaseRecords]);

  // 清理搜索超时
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-6xl max-h-[90vh] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center space-x-2">
            <Database className="h-5 w-5 text-blue-600" />
            <CardTitle>数据库记录</CardTitle>
            {stats && (
              <div className="text-sm text-muted-foreground ml-4">
                总计: {stats.total} 条 | 最近7天: {stats.recentCount} 条
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadDatabaseRecords(currentPage)}
              disabled={loading}
              className="flex items-center space-x-2"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              <span>{loading ? '刷新中...' : '刷新'}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden flex flex-col space-y-4">
          {/* 搜索区域 */}
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索文件名、书名或AI描述..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="pl-10"
              />
            </div>
            <div className="text-sm text-muted-foreground whitespace-nowrap">
              {pagination ? `第 ${pagination.page}/${pagination.totalPages} 页，共 ${pagination.total} 条记录` : '加载中...'}
            </div>
          </div>

          {/* 内容区域 */}
          <div className="flex-1 overflow-auto">
            {loading && records.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-3" />
                <span>正在加载数据...</span>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12 text-red-600">
                <span>{error}</span>
              </div>
            ) : records.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <span>暂无数据</span>
              </div>
            ) : (
              <div className="space-y-4">
                {records.map((record) => (
                  <Card key={record.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        {/* 文件名和书名 */}
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <FileText className="h-4 w-4 text-blue-600" />
                              <span className="font-semibold text-slate-900">
                                {record.filename}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                              <span>📖</span>
                              <span>{record.book_title}</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {new Date(record.created_at).toLocaleDateString('zh-CN')}
                            </span>
                          </div>
                        </div>

                        {/* AI描述 */}
                        <div className="text-sm text-slate-700 leading-relaxed">
                          {record.ai_description.length > 200 
                            ? `${record.ai_description.substring(0, 200)}...`
                            : record.ai_description
                          }
                        </div>

                        {/* 图片预览 */}
                        {record.image_url && (
                          <div className="relative w-32 h-24 bg-gray-100 rounded-lg overflow-hidden">
                            {imageLoadStates[record.id] === 'loading' && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                              </div>
                            )}
                            {imageLoadStates[record.id] === 'error' && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <Image className="h-6 w-6 text-gray-400" />
                              </div>
                            )}
                            <img
                              src={record.image_url}
                              alt={record.filename}
                              className={cn(
                                "w-full h-full object-cover transition-opacity duration-300",
                                imageLoadStates[record.id] === 'loaded' ? 'opacity-100' : 'opacity-0'
                              )}
                              onLoad={() => handleImageLoad(record.id)}
                              onError={() => handleImageError(record.id)}
                              loading="lazy"
                            />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* 分页控件 */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                显示第 {(pagination.page - 1) * pageSize + 1} - {Math.min(pagination.page * pageSize, pagination.total)} 条
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4" />
                  上一页
                </Button>
                <div className="text-sm text-muted-foreground">
                  {currentPage} / {pagination.totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= pagination.totalPages || loading}
                >
                  下一页
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ModernDatabaseViewer; 