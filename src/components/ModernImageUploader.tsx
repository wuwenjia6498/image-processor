import React, { useRef, useState, useCallback } from 'react';
import { Upload, Image, X, FileImage, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

interface ModernImageUploaderProps {
  onImagesUploaded: (images: File[]) => void;
}

const ModernImageUploader: React.FC<ModernImageUploaderProps> = ({ onImagesUploaded }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showAllFiles, setShowAllFiles] = useState(false);

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;
    
    const imageFiles = Array.from(files).filter(file => 
      file.type.startsWith('image/')
    );
    
    setSelectedFiles(imageFiles);
    onImagesUploaded(imageFiles);
  }, [onImagesUploaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
  }, [handleFileSelect]);

  const removeFile = useCallback((index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    onImagesUploaded(newFiles);
  }, [selectedFiles, onImagesUploaded]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 计算要显示的文件
  const displayFiles = showAllFiles ? selectedFiles : selectedFiles.slice(0, 5);
  const hasMoreFiles = selectedFiles.length > 5;

  return (
    <div className="space-y-4">
      {/* 拖拽上传区域 */}
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 cursor-pointer",
          isDragOver 
            ? "border-blue-500 bg-blue-50 scale-105" 
            : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleInputChange}
          className="hidden"
        />
        
        <div className="flex flex-col items-center space-y-4">
          <div className={cn(
            "p-4 rounded-full transition-colors",
            isDragOver ? "bg-blue-100" : "bg-slate-100"
          )}>
            <Upload className={cn(
              "h-8 w-8 transition-colors",
              isDragOver ? "text-blue-600" : "text-slate-600"
            )} />
          </div>
          
          <div className="space-y-2">
            <p className="text-lg font-medium text-slate-900">
              {isDragOver ? "释放文件以上传" : "拖拽插图到此处"}
            </p>
            <p className="text-sm text-slate-600">
              或者 <span className="text-blue-600 font-medium">点击选择文件</span>
            </p>
            <p className="text-xs text-slate-500">
              支持 JPG、PNG、GIF 等插图格式，最大 10MB
            </p>
          </div>
        </div>
      </div>

      {/* 已选择的文件列表 */}
      {selectedFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-slate-900">
              已选择 {selectedFiles.length} 个文件
              {hasMoreFiles && !showAllFiles && (
                <span className="text-sm text-slate-500 ml-2">
                  (显示前 5 个)
                </span>
              )}
            </h4>
            <div className="flex items-center space-x-2">
              {hasMoreFiles && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllFiles(!showAllFiles)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  {showAllFiles ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      收起
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      展开更多
                    </>
                  )}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedFiles([]);
                  onImagesUploaded([]);
                  setShowAllFiles(false);
                }}
              >
                <X className="h-4 w-4 mr-1" />
                清空
              </Button>
            </div>
          </div>
          
          <div className="grid gap-3">
            {displayFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-md">
                    <FileImage className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  className="text-slate-400 hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* 显示更多文件的提示 */}
          {hasMoreFiles && !showAllFiles && (
            <div className="text-center py-2">
              <p className="text-sm text-slate-500">
                还有 {selectedFiles.length - 5} 个文件未显示
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ModernImageUploader; 