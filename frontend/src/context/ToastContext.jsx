import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
const ToastContext = createContext();
export const useToast = () => useContext(ToastContext);
export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const showToast = useCallback((message, type = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => removeToast(id), 5000);
    }, [removeToast]);
    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-3 pointer-events-none">
                {toasts.map(toast => (
                    <ToastItem key={toast.id} {...toast} onClose={() => removeToast(toast.id)} />
                ))}
            </div>
        </ToastContext.Provider>
    );
};
const ToastItem = ({ message, type, onClose }) => {
    const icons = {
        success: <CheckCircle className="text-green-400" size={20} />,
        error: <AlertCircle className="text-red-400" size={20} />,
        warning: <AlertTriangle className="text-yellow-400" size={20} />,
        info: <Info className="text-blue-400" size={20} />
    };
    const borders = {
        success: 'border-green-500/20 bg-green-500/10',
        error: 'border-red-500/20 bg-red-500/10',
        warning: 'border-yellow-500/20 bg-yellow-500/10',
        info: 'border-obsidian-border bg-obsidian-surface'
    };
    return (
        <div className={`pointer-events-auto flex items-center w-80 p-4 rounded-xl border shadow-lg backdrop-blur-md animate-in slide-in-from-right-full fade-in duration-300 ${borders[type] || borders.info}`}>
            <div className="mr-3 shrink-0">
                {icons[type] || icons.info}
            </div>
            <p className="text-sm font-medium text-white flex-1">{message}</p>
            <button onClick={onClose} className="ml-3 text-white/50 hover:text-white transition-colors">
                <X size={16} />
            </button>
        </div>
    );
};
