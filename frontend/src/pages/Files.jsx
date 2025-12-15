import React, { useState, useEffect } from 'react';
import { mockApi } from '../utils/mockApi';
import { Folder, FileText, ChevronRight, Home, Download, Trash2, FileCode, FileJson, FileImage } from 'lucide-react';
import clsx from 'clsx';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';

const FileManager = () => {
    const [files, setFiles] = useState([]);
    const [currentPath, setCurrentPath] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [isCreateFileOpen, setIsCreateFileOpen] = useState(false);
    const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    const [itemToDelete, setItemToDelete] = useState(null);

    const { showToast } = useToast();

    useEffect(() => {
        loadFiles();
    }, [currentPath]);

    const loadFiles = async () => {
        setLoading(true);
        // In a real app, we'd pass the path string. Here we mock it.
        const root = await mockApi.getFiles();
        let currentDir = root;

        for (const folderName of currentPath) {
            if (currentDir.children) {
                const found = currentDir.children.find(c => c.name === folderName && c.type === 'folder');
                if (found) currentDir = found;
            }
        }

        setFiles(currentDir.children || []);
        setLoading(false);
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

    const getFileIcon = (name, type) => {
        if (type === 'folder') return <Folder className="text-obsidian-accent fill-obsidian-accent/20" size={24} />;
        if (name.endsWith('.json')) return <FileJson className="text-yellow-400" size={24} />;
        if (name.endsWith('.log') || name.endsWith('.txt')) return <FileText className="text-gray-400" size={24} />;
        if (name.endsWith('.properties')) return <FileCode className="text-blue-400" size={24} />;
        if (name.endsWith('.png')) return <FileImage className="text-purple-400" size={24} />;
        return <FileText className="text-gray-400" size={24} />;
    };

    const handleCreateFolder = async () => {
        if (!newItemName) return;
        setLoading(true);
        try {
            await mockApi.createFile(currentPath, newItemName, 'folder');
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
            await mockApi.createFile(currentPath, newItemName, 'file');
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
            await mockApi.deleteFile(currentPath, itemToDelete);
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

    return (
        <div className="bg-obsidian-surface border border-obsidian-border rounded-xl overflow-hidden flex flex-col h-[calc(100vh-8rem)]">
            {/* Breadcrumbs & Actions */}
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

            {/* File List */}
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
                        {files.map((file, index) => (
                            <div
                                key={index}
                                className={clsx(
                                    "group flex items-center justify-between p-3 rounded-lg border border-transparent hover:bg-white/5 hover:border-obsidian-border transition-all cursor-pointer select-none",
                                    file.type === 'folder' ? "hover:shadow-lg hover:shadow-black/20" : ""
                                )}
                            >
                                <div
                                    className="flex items-center flex-1 min-w-0"
                                    onClick={() => file.type === 'folder' && handleNavigate(file.name)}
                                >
                                    <div className="mr-3 flex-shrink-0 transition-transform group-hover:scale-110">
                                        {getFileIcon(file.name, file.type)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-gray-200 truncate group-hover:text-white">{file.name}</p>
                                        <p className="text-xs text-obsidian-muted">{file.size}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); confirmDelete(file.name); }}
                                    className="p-1.5 text-obsidian-muted hover:text-red-400 hover:bg-red-500/10 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                                    title="Delete"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modals */}
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
        </div>
    );
};

export default FileManager;
