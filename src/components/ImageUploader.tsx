import React, { useRef, useState, useCallback } from 'react';

interface ImageUploaderProps {
  onImagesUploaded: (images: File[]) => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImagesUploaded }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

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

  return (
    <div className="upload-section">
      <h2>📁 上传图片</h2>
      <p>拖拽图片到下方区域，或点击选择文件</p>
      
      <div
        className={`upload-area ${isDragOver ? 'dragover' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <div className="upload-icon">📸</div>
        <div className="upload-text">选择图片文件</div>
        <div className="upload-hint">支持 JPG、PNG、GIF 等格式</div>
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleInputChange}
        style={{ display: 'none' }}
      />
      
      {selectedFiles.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h3>已选择的文件 ({selectedFiles.length}):</h3>
          <ul style={{ textAlign: 'left', maxHeight: '200px', overflowY: 'auto' }}>
            {selectedFiles.map((file, index) => (
              <li key={index} style={{ margin: '5px 0', color: '#6b7280' }}>
                {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ImageUploader; 