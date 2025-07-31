import React, { useState, useEffect } from 'react';
import { fetchDatabaseRecords, DatabaseRecord } from '../api/supabaseClient';

interface DatabaseViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

const DatabaseViewer: React.FC<DatabaseViewerProps> = ({ isOpen, onClose }) => {
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
    record.age_orientation.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="database-viewer-overlay">
      <div className="database-viewer-modal">
        <div className="database-viewer-header">
          <h2>📋 数据库记录</h2>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button 
              onClick={loadDatabaseRecords}
              disabled={loading}
              style={{
                padding: '6px 12px',
                background: '#4f46e5',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? '🔄' : '🔄 刷新'}
            </button>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
        </div>
        
        <div className="database-viewer-content">
          <div className="search-section">
            <input
              type="text"
              placeholder="搜索文件名、书名或年龄定位..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <div className="record-count">
              共 {filteredRecords.length} 条记录
            </div>
          </div>
          
          {loading && (
            <div className="loading">🔄 正在加载数据库记录...</div>
          )}
          
          {error && (
            <div className="error">
              ❌ {error}
              <button 
                onClick={loadDatabaseRecords}
                style={{ 
                  marginLeft: '10px', 
                  padding: '5px 10px', 
                  background: '#4f46e5', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px', 
                  cursor: 'pointer' 
                }}
              >
                重试
              </button>
            </div>
          )}
          
          {!loading && !error && (
            <div className="records-list">
              {filteredRecords.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                  {searchTerm ? '没有找到匹配的记录' : '数据库中没有记录'}
                </div>
              ) : (
                filteredRecords.map((record) => (
                  <div key={record.id} className="record-item">
                    <div className="record-header">
                      <div className="record-filename">{record.filename}</div>
                      <div className="record-meta">
                        <span className="age-badge">{record.age_orientation}</span>
                        <span className="type-badge">{record.text_type_fit}</span>
                      </div>
                    </div>
                    
                    <div className="record-book-title">
                      📖 {record.book_title}
                    </div>
                    
                    <div className="record-description">
                      {record.ai_description.length > 200 
                        ? `${record.ai_description.substring(0, 200)}...`
                        : record.ai_description
                      }
                    </div>
                    
                    <div className="record-footer">
                      <span className="record-date">
                        更新: {new Date(record.updated_at).toLocaleString('zh-CN')}
                      </span>
                      {record.image_url && (
                        <a 
                          href={record.image_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="view-image-link"
                        >
                          查看图片
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DatabaseViewer; 