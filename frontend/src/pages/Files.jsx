import React, { useState, useEffect, useRef } from 'react';
import { serverApi } from '../api/server';
import { Folder, FileText, ChevronRight, Home, Download, Trash2, FileCode, FileJson, FileImage, Upload, Save, X, Archive, CheckSquare, Check } from 'lucide-react';
import clsx from 'clsx';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';
const FileManager = () => {
    const [files, setFiles] = useState([]);
    const [currentPath, setCurrentPath] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreateFileOpen, setIsCreateFileOpen] = useState(false);
    const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    const [itemToDelete, setItemToDelete] = useState(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editorFile, setEditorFile] = useState(null);
    const [editorContent, setEditorContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef(null);
    const { showToast } = useToast();
    useEffect(() => {
        loadFiles();
    }, [currentPath]);
    const loadFiles = async () => {
        setLoading(true);
        try {
            const data = await serverApi.getFiles(currentPath);
            setFiles(data);
        } catch (err) {
            console.error(err);
            showToast('Failed to load files', 'error');
            setFiles([]);
        } finally {
            setLoading(false);
        }
    };
    const handleNavigate = (folderName) => {
        setCurrentPath([...currentPath, folderName]);
    };
    const handleBreadcrumbClick = (index) => {
        if (index === -1) {
            setCurrentPath([]);
        } else {
            setCurrentPath(currentPath.slice(0, index + 1));
        }
    };
    const handleHome = () => setCurrentPath([]);
    const handleExtract = async (file) => {
        setLoading(true);
        try {
            await serverApi.extractFile(currentPath, file.name);
            showToast(`Extracted ${file.name}`, 'success');
            await loadFiles();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };
    const getFileIcon = (name, type) => {
        if (type === 'folder') return <Folder className="text-obsidian-accent fill-obsidian-accent/20" size={24} />;
        if (name.endsWith('.json')) return <FileJson className="text-yellow-400" size={24} />;
        if (name.endsWith('.zip') || name.endsWith('.tar.gz')) return <Archive className="text-orange-400" size={24} />;
        if (name.endsWith('.log') || name.endsWith('.txt')) return <FileText className="text-gray-400" size={24} />;
        if (name.endsWith('.properties') || name.endsWith('.yml') || name.endsWith('.yaml')) return <FileCode className="text-blue-400" size={24} />;
        if (name.endsWith('.png') || name.endsWith('.jpg')) return <FileImage className="text-purple-400" size={24} />;
        return <FileText className="text-gray-400" size={24} />;
    };
    const handleCreateFolder = async () => {
        if (!newItemName) return;
        setLoading(true);
        try {
            await serverApi.createFile(currentPath, newItemName, 'folder');
            await loadFiles();
            showToast(`Folder "${newItemName}" created`, 'success');
            setIsCreateFolderOpen(false);
            setNewItemName('');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };
    const handleCreateFile = async () => {
        if (!newItemName) return;
        setLoading(true);
        try {
            await serverApi.createFile(currentPath, newItemName, 'file');
            await loadFiles();
            showToast(`File "${newItemName}" created`, 'success');
            setIsCreateFileOpen(false);
            setNewItemName('');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };
    const handleDelete = async () => {
        if (!itemToDelete) return;
        setLoading(true);
        try {
            await serverApi.deleteFile(currentPath, itemToDelete);
            await loadFiles();
            showToast(`${itemToDelete} deleted`, 'success');
            setIsDeleteOpen(false);
            setItemToDelete(null);
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };
    const confirmDelete = (name) => {
        setItemToDelete(name);
        setIsDeleteOpen(true);
    };
    const triggerUpload = () => {
        fileInputRef.current?.click();
    };
    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLoading(true);
        try {
            await serverApi.uploadFile(currentPath, file);
            showToast('File uploaded successfully', 'success');
            await loadFiles();
        } catch (err) {
            console.error(err);
            showToast('Upload failed: ' + err.message, 'error');
        } finally {
            setLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };
    const handleFileClick = async (file) => {
        if (file.type === 'folder') {
            handleNavigate(file.name);
            return;
        }
        const isEditable = /\.(txt|log|properties|json|yml|yaml|md|js|xml)$/i.test(file.name);
        if (!isEditable) {
            showToast('This file type is not editable', 'error');
            return;
        }
        setLoading(true);
        try {
            const path = [...currentPath, file.name];
            const data = await serverApi.readFile(path);
            setEditorFile({ name: file.name, path });
            setEditorContent(data.content);
            setIsEditorOpen(true);
        } catch (err) {
            showToast('Failed to read file: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };
    const handleSaveFile = async () => {
        if (!editorFile) return;
        setIsSaving(true);
        try {
            await serverApi.saveFile(editorFile.path, editorContent);
            showToast('File saved successfully', 'success');
            setIsEditorOpen(false);
            setEditorFile(null);
            loadFiles();  
        } catch (err) {
            showToast('Failed to save: ' + err.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };
    const [selectedFiles, setSelectedFiles] = useState(new Set());
    const [isSelectMode, setIsSelectMode] = useState(false);
    useEffect(() => {
        setSelectedFiles(new Set());
    }, [currentPath]);
    const toggleSelectMode = () => {
        setIsSelectMode(prev => {
            if (prev) setSelectedFiles(new Set());  
            return !prev;
        });
    };
    const handleSelect = (file, e) => {
        e.stopPropagation();
        const newSet = new Set(selectedFiles);
        if (newSet.has(file.name)) {
            newSet.delete(file.name);
        } else {
            newSet.add(file.name);
        }
        setSelectedFiles(newSet);
    };
    const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
    const handleBulkDelete = () => {
        if (selectedFiles.size === 0) return;
        setIsBulkDeleteOpen(true);
    };
    const executeBulkDelete = async () => {
        setIsBulkDeleteOpen(false);
        setLoading(true);
        let successCount = 0;
        let failCount = 0;
        for (const fileName of selectedFiles) {
            try {
                await serverApi.deleteFile(currentPath, fileName);
                successCount++;
            } catch (err) {
                console.error(err);
                failCount++;
            }
        }
        if (successCount > 0) showToast(`Deleted ${successCount} items`, 'success');
        if (failCount > 0) showToast(`Failed to delete ${failCount} items`, 'error');
        setSelectedFiles(new Set());
        await loadFiles();
        setLoading(false);
    };
    const handleDownload = async (file) => {
        setLoading(true);
        try {
            const blob = await serverApi.downloadFile(currentPath, file.name);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showToast(`Downloaded ${file.name}`, 'success');
        } catch (err) {
            showToast('Download failed: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };
    const [isDragging, setIsDragging] = useState(false);
    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };
    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };
    const handleDrop = async (e) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;
        setLoading(true);
        let successCount = 0;
        let failCount = 0;
        for (const file of files) {
            try {
                await serverApi.uploadFile(currentPath, file);
                successCount++;
            } catch (err) {
                console.error(err);
                failCount++;
            }
        }
        if (successCount > 0) showToast(`Uploaded ${successCount} file${successCount > 1 ? 's' : ''}`, 'success');
        if (failCount > 0) showToast(`Failed to upload ${failCount} file${failCount > 1 ? 's' : ''}`, 'error');
        await loadFiles();
        setLoading(false);
    };
    return (
        <div
            className="bg-obsidian-surface border border-obsidian-border rounded-xl overflow-hidden flex flex-col h-[calc(100vh-8rem)] relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {isDragging && (
                <div className="absolute inset-0 z-50 bg-obsidian-accent/20 backdrop-blur-sm border-2 border-dashed border-obsidian-accent flex items-center justify-center pointer-events-none">
                    <div className="text-center text-obsidian-accent animate-pulse">
                        <Upload size={48} className="mx-auto mb-2" />
                        <h3 className="text-xl font-bold">Drop files to upload</h3>
                    </div>
                </div>
            )}
            { }
            <div className="p-4 border-b border-obsidian-border flex items-center justify-between bg-obsidian-surface/50 backdrop-blur">
                <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => handleBreadcrumbClick(-1)}
                        className="p-1.5 rounded-md hover:bg-white/5 text-obsidian-muted hover:text-white transition-colors"
                    >
                        <Home size={18} />
                    </button>
                    {currentPath.map((folder, index) => (
                        <React.Fragment key={index}>
                            <ChevronRight size={16} className="text-obsidian-border flex-shrink-0" />
                            <button
                                onClick={() => handleBreadcrumbClick(index)}
                                className="px-2 py-1 rounded-md hover:bg-white/5 text-sm font-medium text-white transition-colors whitespace-nowrap"
                            >
                                {folder}
                            </button>
                        </React.Fragment>
                    ))}
                </div>
                <div className="flex items-center space-x-2">
                    {selectedFiles.size > 0 && (
                        <button
                            onClick={handleBulkDelete}
                            className="flex items-center px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors text-sm font-medium animate-in fade-in slide-in-from-top-2"
                        >
                            <Trash2 size={16} className="mr-2" /> Delete ({selectedFiles.size})
                        </button>
                    )}
                    <button
                        onClick={toggleSelectMode}
                        className={clsx(
                            "flex items-center px-3 py-1.5 border rounded-lg transition-colors text-sm font-medium",
                            isSelectMode
                                ? "bg-obsidian-accent text-white border-obsidian-accent"
                                : "bg-obsidian-surface hover:bg-white/5 border-obsidian-border text-white"
                        )}
                        title="Toggle Selection Mode"
                    >
                        <CheckSquare size={16} className="mr-2" /> Select
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleUpload}
                    />
                    <button
                        onClick={triggerUpload}
                        className="flex items-center px-3 py-1.5 bg-obsidian-surface hover:bg-white/5 border border-obsidian-border text-white rounded-lg transition-colors text-sm font-medium"
                        title="Upload File"
                    >
                        <Upload size={16} className="mr-2" /> Upload
                    </button>
                    <button
                        onClick={() => setIsCreateFileOpen(true)}
                        className="flex items-center px-3 py-1.5 bg-obsidian-accent/10 text-obsidian-accent hover:bg-obsidian-accent/20 rounded-lg transition-colors text-sm font-medium"
                    >
                        <FileText size={16} className="mr-2" /> New File
                    </button>
                    <button
                        onClick={() => setIsCreateFolderOpen(true)}
                        className="flex items-center px-3 py-1.5 bg-obsidian-accent/10 text-obsidian-accent hover:bg-obsidian-accent/20 rounded-lg transition-colors text-sm font-medium"
                    >
                        <Folder size={16} className="mr-2" /> New Folder
                    </button>
                </div>
            </div>
            { }
            <div className="flex-1 overflow-y-auto p-2">
                {loading ? (
                    <div className="flex items-center justify-center h-full text-obsidian-muted">Loading files...</div>
                ) : files.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-obsidian-muted">
                        <Folder size={48} className="mb-2 opacity-20" />
                        <p>This folder is empty</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {files.map((file, index) => {
                            const isArchive = file.name.endsWith('.zip') || file.name.endsWith('.tar.gz');
                            const isSelected = selectedFiles.has(file.name);
                            return (
                                <div
                                    key={index}
                                    className={clsx(
                                        "group flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer select-none",
                                        isSelected
                                            ? "bg-obsidian-accent/10 border-obsidian-accent"
                                            : "border-transparent hover:bg-white/5 hover:border-obsidian-border",
                                        file.type === 'folder' ? "hover:shadow-lg hover:shadow-black/20" : ""
                                    )}
                                    onClick={() => handleFileClick(file)}
                                >
                                    <div className="flex items-center flex-1 min-w-0">
                                        {isSelectMode && (
                                            <div className="mr-3 flex-shrink-0" onClick={(e) => handleSelect(file, e)}>
                                                <div className={clsx(
                                                    "w-5 h-5 rounded border flex items-center justify-center transition-all cursor-pointer",
                                                    isSelected
                                                        ? "bg-obsidian-accent border-obsidian-accent shadow-[0_0_10px_rgba(139,92,246,0.3)]"
                                                        : "border-obsidian-muted hover:border-obsidian-accent bg-black/20"
                                                )}>
                                                    {isSelected && <Check size={12} className="text-white stroke-[3]" />}
                                                </div>
                                            </div>
                                        )}
                                        <div className="mr-3 flex-shrink-0 transition-transform group-hover:scale-110">
                                            {getFileIcon(file.name, file.type)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className={clsx("text-sm font-medium truncate group-hover:text-white", isSelected ? "text-white" : "text-gray-200")}>{file.name}</p>
                                            <p className="text-xs text-obsidian-muted">{file.size}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-all space-x-1">
                                        {file.type !== 'folder' && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDownload(file); }}
                                                className="p-1.5 text-obsidian-muted hover:text-blue-400 hover:bg-blue-500/10 rounded-md"
                                                title="Download"
                                            >
                                                <Download size={16} />
                                            </button>
                                        )}
                                        {isArchive && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleExtract(file); }}
                                                className="p-1.5 text-obsidian-muted hover:text-orange-400 hover:bg-orange-500/10 rounded-md"
                                                title="Extract"
                                            >
                                                <Archive size={16} />
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); confirmDelete(file.name); }}
                                            className="p-1.5 text-obsidian-muted hover:text-red-400 hover:bg-red-500/10 rounded-md"
                                            title="Delete"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            { }
            {isEditorOpen && (
                <div className="fixed inset-0 z-50 bg-obsidian-bg/95 flex flex-col animate-in fade-in duration-200">
                    <div className="h-14 border-b border-obsidian-border flex items-center justify-between px-6 bg-obsidian-surface">
                        <div className="flex items-center">
                            <FileCode className="text-obsidian-accent mr-3" size={20} />
                            <span className="font-bold text-white">{editorFile?.name}</span>
                        </div>
                        <div className="flex items-center space-x-3">
                            <button
                                onClick={() => { setIsEditorOpen(false); setEditorFile(null); }}
                                className="px-4 py-1.5 text-obsidian-muted hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveFile}
                                disabled={isSaving}
                                className="px-4 py-1.5 bg-obsidian-accent hover:bg-obsidian-accent-hover text-white rounded-lg flex items-center disabled:opacity-50"
                            >
                                <Save size={16} className="mr-2" />
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 p-4 overflow-hidden">
                        <textarea
                            className="w-full h-full bg-black/50 border border-obsidian-border rounded-lg p-4 font-mono text-sm text-gray-300 focus:outline-none focus:border-obsidian-accent resize-none custom-scrollbar"
                            value={editorContent}
                            onChange={(e) => setEditorContent(e.target.value)}
                            spellCheck={false}
                        />
                    </div>
                </div>
            )}
            { }
            <Modal
                isOpen={isCreateFileOpen}
                onClose={() => setIsCreateFileOpen(false)}
                title="Create New File"
                footer={
                    <>
                        <button onClick={() => setIsCreateFileOpen(false)} className="px-4 py-2 text-obsidian-muted hover:text-white transition-colors">Cancel</button>
                        <button onClick={handleCreateFile} className="px-4 py-2 bg-obsidian-accent hover:bg-obsidian-accent-hover text-white rounded-lg">Create</button>
                    </>
                }
            >
                <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Enter file name (e.g. config.yml)"
                    className="w-full bg-obsidian-bg border border-obsidian-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-obsidian-accent"
                    autoFocus
                />
            </Modal>
            <Modal
                isOpen={isCreateFolderOpen}
                onClose={() => setIsCreateFolderOpen(false)}
                title="Create New Folder"
                footer={
                    <>
                        <button onClick={() => setIsCreateFolderOpen(false)} className="px-4 py-2 text-obsidian-muted hover:text-white transition-colors">Cancel</button>
                        <button onClick={handleCreateFolder} className="px-4 py-2 bg-obsidian-accent hover:bg-obsidian-accent-hover text-white rounded-lg">Create</button>
                    </>
                }
            >
                <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Enter folder name"
                    className="w-full bg-obsidian-bg border border-obsidian-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-obsidian-accent"
                    autoFocus
                />
            </Modal>
            <Modal
                isOpen={isDeleteOpen}
                onClose={() => setIsDeleteOpen(false)}
                title="Confirm Deletion"
                footer={
                    <>
                        <button onClick={() => setIsDeleteOpen(false)} className="px-4 py-2 text-obsidian-muted hover:text-white transition-colors">Cancel</button>
                        <button onClick={handleDelete} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg">Delete</button>
                    </>
                }
            >
                <p>Are you sure you want to delete <span className="font-bold text-white">{itemToDelete}</span>? This action cannot be undone.</p>
            </Modal>
            { }
            <Modal
                isOpen={isBulkDeleteOpen}
                onClose={() => setIsBulkDeleteOpen(false)}
                title="Confirm Bulk Deletion"
                footer={
                    <>
                        <button onClick={() => setIsBulkDeleteOpen(false)} className="px-4 py-2 text-obsidian-muted hover:text-white transition-colors">Cancel</button>
                        <button onClick={executeBulkDelete} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg">Delete {selectedFiles.size} Items</button>
                    </>
                }
            >
                <div className="text-gray-300">
                    <p className="mb-2">Are you sure you want to delete these <span className="font-bold text-white">{selectedFiles.size}</span> items?</p>
                    <ul className="list-disc list-inside text-sm text-obsidian-muted max-h-32 overflow-y-auto custom-scrollbar">
                        {Array.from(selectedFiles).slice(0, 5).map(name => (
                            <li key={name}>{name}</li>
                        ))}
                        {selectedFiles.size > 5 && <li>...and {selectedFiles.size - 5} more</li>}
                    </ul>
                    <p className="mt-2 text-red-400 text-sm">This action cannot be undone.</p>
                </div>
            </Modal>
        </div>
    );
};
export default FileManager;
