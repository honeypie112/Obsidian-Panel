import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { FolderOpen, File, Upload, Download, Edit, Trash2, PackageOpen } from 'lucide-react';
import axios from 'axios';
import './FileManager.css';

const FileManager = () => {
    const { selectedServer } = useOutletContext();
    const { success, error } = useToast();
    const [files, setFiles] = useState([]);
    const [currentPath, setCurrentPath] = useState('/');
    const [uploading, setUploading] = useState(false);
    const [downloadingJar, setDownloadingJar] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [editModal, setEditModal] = useState({ open: false, file: null, content: '' });

    useEffect(() => {
        if (selectedServer) {
            fetchFiles();
        }
    }, [selectedServer, currentPath]);

    const fetchFiles = async () => {
        try {
            const response = await axios.get(`/api/files/${selectedServer._id}`, {
                params: { path: currentPath },
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
            });
            setFiles(response.data.files || []);
        } catch (error) {
            console.error('Failed to fetch files:', error);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        setUploadProgress(0);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', currentPath);

        try {
            await axios.post(`/api/files/${selectedServer._id}/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(percentCompleted);
                },
            });
            fetchFiles();
            // Reset file input
            e.target.value = '';
        } catch (err) {
            console.error('Upload failed:', err);
            error('Upload failed: ' + (err.response?.data?.error || err.message));
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    const handleDownload = async (filePath) => {
        try {
            const response = await axios.get(`/api/files/${selectedServer._id}/download`, {
                params: { path: filePath },
                responseType: 'blob',
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filePath.split('/').pop());
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Download failed:', err);
            error('Failed to download file');
        }
    };

    const handleDelete = async (filePath) => {
        if (!confirm('Are you sure you want to delete this file?')) return;

        try {
            await axios.delete(`/api/files/${selectedServer._id}/delete`, {
                params: { path: filePath },
            });
            success('File deleted successfully');
            fetchFiles();
        } catch (err) {
            console.error('Delete failed:', err);
            error('Failed to delete file');
        }
    };

    const formatSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const handleEdit = async (filePath) => {
        try {
            const response = await axios.get(`/api/files/${selectedServer._id}/read`, {
                params: { path: filePath },
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
            });

            setEditModal({
                open: true,
                file: filePath,
                content: response.data.content,
            });
        } catch (err) {
            console.error('Failed to read file:', err);
            error('Failed to open file for editing');
        }
    };

    const handleSaveEdit = async () => {
        try {
            await axios.put(`/api/files/${selectedServer._id}/edit`, {
                path: editModal.file,
                content: editModal.content,
            }, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
            });

            setEditModal({ open: false, file: null, content: '' });
            success('File saved successfully');
            fetchFiles();
        } catch (err) {
            console.error('Failed to save file:', err);
            error('Failed to save file');
        }
    };

    const handleExtract = async (filePath) => {
        if (!confirm('Extract this ZIP file here?')) return;

        try {
            const response = await axios.post(`/api/files/${selectedServer._id}/extract`, {
                path: filePath,
            }, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
            });

            success(response.data.message);
            fetchFiles(); // Refresh file list
        } catch (err) {
            console.error('Extract failed:', err);
            error(err.response?.data?.error || 'Failed to extract ZIP file');
        }
    };

    const handleDownloadServerJar = async () => {
        if (!confirm(`Download PurpurMC ${selectedServer.version} server JAR?`)) return;

        setDownloadingJar(true);
        try {
            const response = await axios.post(`/api/servers/${selectedServer._id}/download-jar`);
            success(response.data.message);
            fetchFiles(); // Refresh file list
        } catch (err) {
            console.error('Download JAR failed:', err);
            error(err.response?.data?.error || 'Failed to download server JAR');
        } finally {
            setDownloadingJar(false);
        }
    };

    if (!selectedServer) {
        return (
            <div className="no-server">
                <h2>No Server Selected</h2>
                <p>Please select a server to manage files</p>
            </div>
        );
    }

    return (
        <div className="file-manager-page">
            <div className="file-manager-header">
                <div>
                    <h1>File Manager</h1>
                    <p className="page-subtitle">Upload, download, and manage server files</p>
                </div>

                <label className="upload-btn">
                    <Upload size={18} />
                    Upload File
                    <input
                        type="file"
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                        disabled={uploading}
                    />
                </label>

                <button
                    className="download-jar-btn"
                    onClick={handleDownloadServerJar}
                    disabled={downloadingJar || selectedServer.status !== 'offline'}
                    title={selectedServer.status !== 'offline' ? 'Stop server first' : `Download PurpurMC ${selectedServer.version}`}
                >
                    <PackageOpen size={18} />
                    {downloadingJar ? 'Downloading...' : 'Download Server JAR'}
                </button>
            </div>

            <div className="file-manager-container card">
                <div className="file-list">
                    {files.length === 0 ? (
                        <div className="files-empty">
                            <FolderOpen size={48} />
                            <p>No files found</p>
                            <p className="empty-hint">Upload files or start the server to generate files</p>
                        </div>
                    ) : (
                        <table className="files-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Size</th>
                                    <th>Modified</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {files.map((file, index) => (
                                    <tr key={index}>
                                        <td>
                                            <div className="file-name">
                                                {file.isDirectory ? (
                                                    <FolderOpen size={18} className="file-icon folder" />
                                                ) : (
                                                    <File size={18} className="file-icon" />
                                                )}
                                                <span>{file.name}</span>
                                            </div>
                                        </td>
                                        <td>{file.isDirectory ? '-' : formatSize(file.size)}</td>
                                        <td>{new Date(file.modified).toLocaleDateString()}</td>
                                        <td>
                                            <div className="file-actions">
                                                {!file.isDirectory && (
                                                    <>
                                                        <button
                                                            className="action-btn"
                                                            onClick={() => handleDownload(file.path)}
                                                            title="Download"
                                                        >
                                                            <Download size={16} />
                                                        </button>
                                                        <button
                                                            className="action-btn"
                                                            onClick={() => handleEdit(file.path)}
                                                            title="Edit"
                                                        >
                                                            <Edit size={16} />
                                                        </button>
                                                    </>
                                                )}
                                                {!file.isDirectory && file.name.toLowerCase().endsWith('.zip') && (
                                                    <button
                                                        className="action-btn extract"
                                                        onClick={() => handleExtract(file.path)}
                                                        title="Extract ZIP"
                                                    >
                                                        📦
                                                    </button>
                                                )}
                                                <button
                                                    className="action-btn delete"
                                                    onClick={() => handleDelete(file.path)}
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Upload Progress */}
                {uploading && (
                    <div className="upload-progress-container">
                        <div className="upload-progress-bar">
                            <div
                                className="upload-progress-fill"
                                style={{ width: `${uploadProgress}%` }}
                            />
                        </div>
                        <span className="upload-progress-text">{uploadProgress}%</span>
                    </div>
                )}
            </div>

            {/* Edit File Modal */}
            {editModal.open && (
                <div className="modal-overlay" onClick={() => setEditModal({ open: false, file: null, content: '' })}>
                    <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="edit-modal-header">
                            <h3>Edit File: {editModal.file?.split('/').pop()}</h3>
                            <button onClick={() => setEditModal({ open: false, file: null, content: '' })}>×</button>
                        </div>
                        <textarea
                            className="edit-modal-textarea"
                            value={editModal.content}
                            onChange={(e) => setEditModal({ ...editModal, content: e.target.value })}
                        />
                        <div className="edit-modal-actions">
                            <button onClick={() => setEditModal({ open: false, file: null, content: '' })} className="cancel-btn">
                                Cancel
                            </button>
                            <button onClick={handleSaveEdit} className="save-btn">
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FileManager;
