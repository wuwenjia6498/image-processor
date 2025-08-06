import React, { useState, useEffect } from 'react';
import { X, Search, RefreshCw, Database, Calendar, FileText, Image } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { fetchDatabaseRecords, DatabaseRecord } from '../api/supabaseClient';
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

  const loadDatabaseRecords = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await fetchDatabaseRecords();
      setRecords(data);
    } catch (err) {
      setError('获取数据库记录失败，请检查网络连接');
      console.error('获取数据库记录失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDatabaseRecords();
    }
  }, [isOpen]);

  const filteredRecords = records.filter(record =>
    record.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.book_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.ai_description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center space-x-2">
            <Database className="h-5 w-5 text-blue-600" />
            <CardTitle>数据库记录</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadDatabaseRecords}
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
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="text-sm text-muted-foreground whitespace-nowrap">
              共 {filteredRecords.length} 条记录
            </div>
          </div>

          {/* 内容区域 */}
          <div className="flex-1 overflow-auto">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mr-3" />
                <span className="text-muted-foreground">正在加载数据库记录...</span>
              </div>
            )}

            {error && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <span className="text-red-600">❌ {error}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadDatabaseRecords}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      重试
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {!loading && !error && (
              <div className="space-y-4">
                {filteredRecords.length === 0 ? (
                  <Card>
                    <CardContent className="pt-12 pb-12">
                      <div className="text-center text-muted-foreground">
                        <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium mb-2">
                          {searchTerm ? '没有找到匹配的记录' : '数据库中没有记录'}
                        </p>
                        {searchTerm && (
                          <p className="text-sm">
                            尝试使用不同的关键词搜索
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  filteredRecords.map((record) => (
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
                          <div className="bg-slate-50 rounded-lg p-4">
                            <p className="text-sm text-slate-700 leading-relaxed">
                              {record.ai_description.length > 300
                                ? `${record.ai_description.substring(0, 300)}...`
                                : record.ai_description
                              }
                            </p>
                          </div>

                          {/* 操作按钮 */}
                          {record.image_url && (
                            <div className="flex justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                                className="flex items-center space-x-2"
                              >
                                <a
                                  href={record.image_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Image className="h-4 w-4" />
                                  <span>查看图片</span>
                                </a>
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ModernDatabaseViewer; 