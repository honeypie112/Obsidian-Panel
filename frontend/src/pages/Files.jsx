import React, { useState, useEffect } from 'react';
import { mockApi } from '../utils/mockApi';
import { Folder, FileText, ChevronRight, Home, Download, Trash2, FileCode, FileJson, FileImage } from 'lucide-react';
import clsx from 'clsx';

const FileManager = () => {
    const [files, setFiles] = useState([]);
    const [currentPath, setCurrentPath] = useState([]); // Array of folder names
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadFiles();
    }, [currentPath]);

    const loadFiles = async () => {
        setLoading(true);
        // In a real app, we'd pass the path string. Here we mock it.
        // We'll simulate traversing the mock object based on currentPath
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
        // Navigate to specific depth
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
        const name = prompt("Enter folder name:");
        if (!name) return;
        setLoading(true);
        try {
            await mockApi.createFile(currentPath, name, 'folder');
            await loadFiles();
        } catch (err) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateFile = async () => {
        const name = prompt("Enter file name (e.g., config.yml):");
        if (!name) return;
        setLoading(true);
        try {
            await mockApi.createFile(currentPath, name, 'file');
            await loadFiles();
        } catch (err) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (name) => {
        if (!confirm(`Are you sure you want to delete ${name}?`)) return;
        setLoading(true);
        try {
            await mockApi.deleteFile(currentPath, name);
            await loadFiles();
        } catch (err) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
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
                        onClick={handleCreateFile}
                        className="flex items-center px-3 py-1.5 bg-obsidian-accent/10 text-obsidian-accent hover:bg-obsidian-accent/20 rounded-lg transition-colors text-sm font-medium"
                    >
                        <FileText size={16} className="mr-2" /> New File
                    </button>
                    <button
                        onClick={handleCreateFolder}
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
                                    onClick={(e) => { e.stopPropagation(); handleDelete(file.name); }}
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
        </div>
    );
};

export default FileManager;
