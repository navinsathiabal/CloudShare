import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, CheckCircle, Copy, Link as LinkIcon, LogOut, Clock, ExternalLink } from 'lucide-react';
import './index.css';

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [historyFiles, setHistoryFiles] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileUrl, setFileUrl] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const fileInputRef = useRef(null);
  const API_ENDPOINT = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_ENDPOINT}/files`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistoryFiles(res.data.files);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const onFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = async (file) => {
    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('token');

    try {
      const response = await axios.post(`${API_ENDPOINT}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
        },
      });

      setFileUrl(response.data.url);
      setFileName(response.data.fileName);
      fetchHistory();
    } catch (err) {
      console.error('Upload Error:', err);
      setError('An error occurred during upload. Check backend connection and S3 config.');
    } finally {
      setIsUploading(false);
    }
  };

  const copyToClipboard = (url) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetUpload = () => {
    setFileUrl(null);
    setFileName(null);
    setError(null);
    setUploadProgress(0);
    if(fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="app-container dashboard-layout">
      <div className="shell-header">
        <div className="shell-brand">
          <div className="shell-title">CloudShare</div>
          <div className="shell-subtitle">Secure file transfer console</div>
        </div>
        <div className="shell-actions">
          <div className="shell-user">
            <span className="shell-user-label">User</span>
            <span className="shell-user-name">{user?.username || 'Operator'}</span>
          </div>
          <button className="copy-btn shell-logout" onClick={handleLogout} style={{ border: 'none', display: 'flex', gap: '8px' }}>
            <LogOut size={18} /> Logout
          </button>
        </div>
      </div>

      <div className="shell-body">
        <div className="panel panel-main">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Upload</h2>
              <p className="panel-subtitle">Drag, drop, and secure files for sharing.</p>
            </div>
            <span className="panel-meta">{isUploading ? 'Transferring' : 'Ready'}</span>
          </div>

          {(!isUploading && !fileUrl) && (
            <div
              className={`dropzone ${isDragging ? 'active' : ''}`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current.click()}
            >
              <UploadCloud size={64} className="dropzone-icon" />
              <h3>Drag & Drop your file here</h3>
              <p>Upload images, documents, or media (Max 50MB)</p>
              <button className="browse-btn gradient-button">Browse Files</button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={onFileSelect}
                className="file-input"
              />
            </div>
          )}

          {isUploading && (
            <div className="uploading-state">
              <div className="spinner"></div>
              <h3>Uploading...</h3>
              <p>{uploadProgress}% completed</p>
            </div>
          )}

          {fileUrl && (
            <div className="success-state">
              <CheckCircle size={64} className="success-icon" />
              <h3>Upload Successful!</h3>
              <p>Your file <strong>{fileName}</strong> is now securely stored.</p>
              
              <div className="url-container">
                <LinkIcon size={20} color="var(--text-muted)" style={{ marginLeft: '10px' }} />
                <input type="text" readOnly value={fileUrl} className="url-input" />
                <button 
                  className={`copy-btn ${copied ? 'copied' : ''}`} 
                  onClick={() => copyToClipboard(fileUrl)}
                  title="Copy to clipboard"
                >
                  <Copy size={20} />
                </button>
              </div>

              <button className="reset-btn gradient-button" onClick={resetUpload}>
                Upload Another File
              </button>
            </div>
          )}
          {error && <div className="error-message">{error}</div>}
        </div>

        <div className="panel panel-side">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">History</h2>
              <p className="panel-subtitle">Your recent uploads and links.</p>
            </div>
            <span className="panel-meta">{historyFiles.length} items</span>
          </div>

          <div className="history-tab">
            {loadingHistory ? (
              <p style={{textAlign: 'center', marginTop: '2rem'}}>Loading history...</p>
            ) : historyFiles.length === 0 ? (
              <p style={{textAlign: 'center', marginTop: '2rem', color: 'var(--text-muted)'}}>No files uploaded yet.</p>
            ) : (
              <ul className="history-list">
                {historyFiles.map((f, i) => (
                  <li key={i} className="history-item">
                    <div className="history-details">
                      <span className="history-filename">{f.file_name}</span>
                      <span className="history-date">{new Date(f.created_at).toLocaleString()}</span>
                    </div>
                    <div className="history-actions">
                      <a href={f.file_url} target="_blank" rel="noreferrer" className="action-btn">
                        <ExternalLink size={18} />
                      </a>
                      <button className="action-btn" onClick={() => copyToClipboard(f.file_url)} title="Copy URL">
                         <Copy size={18} />
                       </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
