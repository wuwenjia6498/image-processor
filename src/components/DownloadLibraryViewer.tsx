import React, { useState, useEffect, useCallback } from 'react';
import { 
  Image, 
  Download, 
  Search, 
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Clock
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { 
  DownloadedIllustration, 
  DownloadLibraryStats,
  getDownloadedIllustrations,
  getDownloadLibraryStats,
  deleteDownloadedIllustration
} from '../api/download-library-api';
import { cn } from '../lib/utils';

interface DownloadLibraryViewerProps {
  onImageSelect?: (image: DownloadedIllustration) => void;
}

const DownloadLibraryViewer: React.FC<DownloadLibraryViewerProps> = ({ onImageSelect }) => {
  const [images, setImages] = useState<DownloadedIllustration[]>([]);
  const [stats, setStats] = useState<DownloadLibraryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 搜索状态
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [itemsPerPage] = useState(20);
  
  // 图片查看状态
  const [selectedImage, setSelectedImage] = useState<DownloadedIllustration | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  
  // 删除确认状态
  const [deletingImage, setDeletingImage] = useState<DownloadedIllustration | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const offset = (currentPage - 1) * itemsPerPage;
      
      const [imagesResult, statsResult] = await Promise.all([
        getDownloadedIllustrations(itemsPerPage, offset, undefined, searchQuery),
        getDownloadLibraryStats()
      ]);
      
      if (imagesResult.error) {
        throw new Error(imagesResult.error);
      }
      
      setImages(imagesResult.data);
      setTotalCount(imagesResult.total || 0);
      
      if (statsResult.data) {
        setStats(statsResult.data);
      }
      
    } catch (err) {
      console.error('加载下载库数据失败:', err);
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchQuery]);

  // 初始加载和依赖更新时重新加载
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 搜索变化时重置页码
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // 处理图片点击
  const handleImageClick = (image: DownloadedIllustration) => {
    setSelectedImage(image);
    setShowImageModal(true);
    if (onImageSelect) {
      onImageSelect(image);
    }
  };

  // 关闭图片模态框
  const closeImageModal = () => {
    setShowImageModal(false);
    setSelectedImage(null);
  };

  // 下载图片
  const downloadImage = async (imageUrl: string, filename: string, event?: React.MouseEvent) => {
    // 阻止事件冒泡，避免触发行点击
    if (event) {
      event.stopPropagation();
    }
    
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
      console.error('下载图片失败:', error);
    }
  };

  // 开始删除图片
  const startDeleteImage = (image: DownloadedIllustration, event?: React.MouseEvent) => {
    // 阻止事件冒泡，避免触发行点击
    if (event) {
      event.stopPropagation();
    }
    
    setDeletingImage(image);
    setShowDeleteDialog(true);
  };

  // 确认删除
  const confirmDelete = async () => {
    if (!deletingImage) return;
    
    try {
      const result = await deleteDownloadedIllustration(deletingImage.id);
      if (result.success) {
        setShowDeleteDialog(false);
        setDeletingImage(null);
        await loadData();
      } else {
        console.error('删除失败:', result.error);
      }
    } catch (error) {
      console.error('删除图片失败:', error);
    }
  };

  // 计算总页数
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">加载下载库...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <div className="text-red-600 mb-4">❌ {error}</div>
        <Button onClick={loadData} variant="outline">
          重试
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 统计信息和搜索栏合并 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between space-x-4">
            {/* 统计信息 */}
            {stats && (
              <div className="flex items-center space-x-2">
                <Download className="h-4 w-4 text-blue-600" />
                <div>
                  <span className="text-lg font-bold">{stats.total_materials}</span>
                  <span className="text-xs text-slate-600 ml-1">总下载数</span>
                </div>
              </div>
            )}
            
            {/* 搜索框 */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="搜索图片名称或描述..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 图片列表 */}
      {images.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center py-8">
              <Image className="h-10 w-10 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-600 mb-1">
                暂无下载记录
              </h3>
              <p className="text-sm text-slate-500">
                开始下载插图后，它们会出现在这里
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {images.map((image) => (
            <Card 
              key={image.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleImageClick(image)}
            >
              <CardContent className="p-3">
                <div className="flex items-center space-x-3">
                  {/* 图片缩略图 */}
                  <div className="relative w-12 h-12 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                    <img
                      src={image.image_url}
                      alt={image.filename}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  {/* 图片信息 */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-slate-900 truncate text-sm">
                      {image.filename}
                    </h3>
                    <div className="flex items-center text-xs text-slate-500 space-x-3 mt-1">
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>{image.download_count}次</span>
                      </div>
                      <span>{new Date(image.download_date).toLocaleDateString('zh-CN')}</span>
                    </div>
                  </div>
                  
                  {/* 操作按钮 */}
                  <div className="flex items-center space-x-1 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => downloadImage(image.image_url, image.filename, e)}
                      className="h-7 w-7 p-0"
                      title="下载"
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => startDeleteImage(image, e)}
                      className="h-7 w-7 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                      title="删除"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 分页控件 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="h-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center space-x-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const page = i + Math.max(1, currentPage - 2);
              if (page > totalPages) return null;
              
              return (
                <Button
                  key={page}
                  variant={currentPage === page ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  className="h-8 w-8"
                >
                  {page}
                </Button>
              );
            })}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="h-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* 图片查看模态框 */}
      {selectedImage && (
        <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
          <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center space-x-2">
                  <Image className="h-5 w-5 text-blue-600" />
                  <span>{selectedImage.filename}</span>
                </DialogTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeImageModal}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="space-y-4">
                <img
                  src={selectedImage.image_url}
                  alt={selectedImage.filename}
                  className="w-full h-auto max-h-[50vh] object-contain rounded-lg"
                />
                
                {selectedImage.original_description && (
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <h4 className="font-medium mb-3 text-slate-900">图片描述：</h4>
                    <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line max-w-none">
                      {selectedImage.original_description}
                    </div>
                  </div>
                )}
                
                <div className="text-sm text-slate-500 border-t pt-3">
                  下载 {selectedImage.download_count} 次 • {new Date(selectedImage.download_date).toLocaleDateString('zh-CN')}
                </div>
              </div>
            </div>
            
            <DialogFooter className="flex-shrink-0 mt-4">
              <Button
                variant="outline"
                onClick={() => downloadImage(selectedImage.image_url, selectedImage.filename)}
              >
                <Download className="h-4 w-4 mr-2" />
                下载
              </Button>
              <Button onClick={closeImageModal}>
                关闭
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* 删除确认对话框 */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除这张图片的下载记录吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          
          {deletingImage && (
            <div className="flex items-center space-x-4 p-4 bg-slate-50 rounded-lg">
              <img
                src={deletingImage.image_url}
                alt={deletingImage.filename}
                className="w-16 h-16 object-cover rounded"
              />
              <div>
                <p className="font-medium">{deletingImage.filename}</p>
                <p className="text-sm text-slate-600">
                  下载 {deletingImage.download_count} 次
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DownloadLibraryViewer; 