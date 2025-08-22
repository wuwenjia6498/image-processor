import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Search, RefreshCw, Database, Calendar, FileText, Image, ChevronLeft, ChevronRight, Loader2, Download, Maximize2, ChevronDown, ChevronUp, Trash2, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { fetchDatabaseRecordsPaginated, getDatabaseStats, deleteDatabaseRecord, DatabaseRecord, PaginatedResult } from '../api/supabaseClient';
import { cn } from '../lib/utils';
import { recordImageDownload } from '../api/download-library-api';

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
  const [searchInput, setSearchInput] = useState(''); // 新增：搜索输入框的值
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [selectedImage, setSelectedImage] = useState<{ url: string; filename: string; bookTitle?: string; description?: string } | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<string | null>(null); // 正在删除的记录ID
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null); // 确认删除的记录ID

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
      setError('获取插图数据库条目失败，请检查网络连接');
      console.error('获取数据库记录失败:', err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, pageSize]);

  // 执行搜索
  const performSearch = useCallback(() => {
    setSearchTerm(searchInput);
    setCurrentPage(1); // 重置到第一页
    loadDatabaseRecords(1, searchInput);
  }, [searchInput, loadDatabaseRecords]);

  // 处理搜索输入
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  };

  // 处理搜索按钮点击
  const handleSearchClick = () => {
    performSearch();
  };

  // 处理回车键搜索
  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  };

  // 处理分页
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    loadDatabaseRecords(page);
  };

  // 处理描述展开/收起
  const toggleDescription = (id: string) => {
    setExpandedDescriptions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // 处理插图点击
  const handleImageClick = (url: string, filename: string, bookTitle?: string, description?: string) => {
    setSelectedImage({ url, filename, bookTitle, description });
  };

  // 关闭插图放大
  const closeImageModal = () => {
    setSelectedImage(null);
  };

  // 下载插图
  const downloadImage = async (url: string, filename: string, bookTitle?: string, description?: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      // 记录下载
      await recordImageDownload(filename, url, bookTitle, description);
    } catch (error) {
      console.error('下载插图失败:', error);
    }
  };

  // 处理删除确认
  const handleDeleteConfirm = (id: string) => {
    setDeleteConfirmId(id);
  };

  // 取消删除确认
  const handleDeleteCancel = () => {
    setDeleteConfirmId(null);
  };

  // 执行删除操作
  const handleDeleteRecord = async (id: string) => {
    setDeletingRecord(id);
    setDeleteConfirmId(null);
    
    try {
      await deleteDatabaseRecord(id);
      
      // 从当前记录列表中移除被删除的记录
      setRecords(prev => prev.filter(record => record.id !== id));
      
      // 重新加载当前页面的数据（如果当前页面没有数据了，回到上一页）
      if (records.length === 1 && currentPage > 1) {
        handlePageChange(currentPage - 1);
      } else {
        loadDatabaseRecords(currentPage, searchTerm);
      }
      
      // 重新加载统计信息
      try {
        const statsData = await getDatabaseStats();
        setStats(statsData);
      } catch (statsError) {
        console.warn('更新统计信息失败:', statsError);
      }
      
    } catch (error) {
      console.error('删除记录失败:', error);
      alert('删除失败: ' + (error as Error).message);
    } finally {
      setDeletingRecord(null);
    }
  };

  // 组件打开时加载数据
  useEffect(() => {
    if (isOpen) {
      loadDatabaseRecords(1);
    }
  }, [isOpen, loadDatabaseRecords]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-6xl max-h-[90vh] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center space-x-2">
            <Database className="h-5 w-5 text-blue-600" />
            <CardTitle>插图数据库条目</CardTitle>
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
                value={searchInput}
                onChange={handleSearchChange}
                onKeyPress={handleSearchKeyPress}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSearchClick}
              disabled={loading}
              className="flex items-center space-x-2"
            >
              <Search className="h-4 w-4" />
              <span>{loading ? '搜索中...' : '搜索'}</span>
            </Button>
            <div className="text-sm text-muted-foreground whitespace-nowrap">
              {pagination ? `第 ${pagination.page}/${pagination.totalPages} 页，共 ${pagination.total} 条插图条目` : '加载中...'}
            </div>
          </div>

          {/* 内容区域 */}
          <div className="flex-1 overflow-auto">
            {loading && records.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-3" />
                <span>正在加载插图数据...</span>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12 text-red-600">
                <span>{error}</span>
              </div>
            ) : records.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <span>暂无插图数据</span>
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
                            {/* 删除按钮 */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteConfirm(record.id)}
                              disabled={deletingRecord === record.id}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                              title="删除此记录"
                            >
                              {deletingRecord === record.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* AI描述 */}
                        <div className="bg-slate-50 rounded-lg p-4">
                          <div className="text-sm text-slate-700 leading-relaxed">
                            <div className="space-y-2">
                              <div className="whitespace-pre-line prose prose-sm max-w-none">
                                {expandedDescriptions.has(record.id) 
                                                          ? record.original_description
                        : record.original_description.length > 200
                        ? `${record.original_description.substring(0, 200)}...`
                        : record.original_description
                                }
                              </div>
                              {record.original_description.length > 200 && (
                                <button 
                                  onClick={() => toggleDescription(record.id)}
                                  className="text-blue-600 hover:text-blue-800 text-sm flex items-center space-x-1 transition-colors mt-2"
                                >
                                  {expandedDescriptions.has(record.id) ? (
                                    <>
                                      <ChevronUp className="h-3 w-3" />
                                      <span>收起</span>
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="h-3 w-3" />
                                      <span>展开更多</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 插图预览 */}
                        {record.image_url && (
                          <div className="relative w-32 h-24 bg-gray-100 rounded-lg overflow-hidden group">
                            <img
                              src={record.image_url}
                              alt={record.filename}
                              className="w-full h-full object-cover cursor-pointer transition-transform duration-200 group-hover:scale-105"
                              loading="lazy"
                              onClick={() => handleImageClick(record.image_url!, record.filename, record.book_title, record.original_description)}
                              onError={(e) => {
                                // 插图加载失败时隐藏插图
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                            {/* 插图操作按钮 */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <div className="flex space-x-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-8 w-8 p-0 bg-white/90 hover:bg-white"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleImageClick(record.image_url!, record.filename, record.book_title, record.original_description);
                                  }}
                                >
                                  <Maximize2 className="h-4 w-4 text-gray-700" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-8 w-8 p-0 bg-white/90 hover:bg-white"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    downloadImage(record.image_url!, record.filename, record.book_title, record.original_description);
                                  }}
                                >
                                  <Download className="h-4 w-4 text-gray-700" />
                                </Button>
                              </div>
                            </div>
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
                显示第 {(pagination.page - 1) * pageSize + 1} - {Math.min(pagination.page * pageSize, pagination.total)} 条插图条目
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

      {/* 插图放大模态框 */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-lg overflow-hidden">
            {/* 模态框头部 */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center space-x-2">
                <Image className="h-5 w-5 text-blue-600" />
                <span className="font-semibold text-slate-900">{selectedImage.filename}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadImage(selectedImage.url, selectedImage.filename, selectedImage.bookTitle, selectedImage.description)}
                  className="flex items-center space-x-2"
                >
                  <Download className="h-4 w-4" />
                  <span>下载</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeImageModal}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* 插图内容 */}
            <div className="p-4">
              <img
                src={selectedImage.url}
                alt={selectedImage.filename}
                className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* 删除确认对话框 */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-red-600">
                <Trash2 className="h-5 w-5" />
                <span>确认删除</span>
              </CardTitle>
              <CardDescription>
                您确定要删除这条插图数据库条目吗？此操作不可撤销，将同时删除数据库记录和对应的图片文件。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center space-x-2 text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">警告</span>
                </div>
                <p className="text-sm text-red-600 mt-1">
                  删除后将无法恢复，请谨慎操作。
                </p>
              </div>
              <div className="flex items-center justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={handleDeleteCancel}
                  disabled={deletingRecord === deleteConfirmId}
                >
                  取消
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDeleteRecord(deleteConfirmId)}
                  disabled={deletingRecord === deleteConfirmId}
                  className="flex items-center space-x-2"
                >
                  {deletingRecord === deleteConfirmId ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>删除中...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      <span>确认删除</span>
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ModernDatabaseViewer; 