import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
const ToastContext = createContext();
// eslint-disable-next-line react-refresh/only-export-components
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
        success: <CheckCircle className="text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]" size={20} />,
        error: <AlertCircle className="text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]" size={20} />,
        warning: <AlertTriangle className="text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" size={20} />,
        info: <Info className="text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]" size={20} />
    };

    // Gradients for the left border/glow
    const gradients = {
        success: 'from-green-500/80 to-green-500/0',
        error: 'from-red-500/80 to-red-500/0',
        warning: 'from-yellow-500/80 to-yellow-500/0',
        info: 'from-blue-500/80 to-blue-500/0'
    };

    const gradient = gradients[type] || gradients.info;

    return (
        <div className="pointer-events-auto relative flex items-center w-80 p-4 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl bg-obsidian-surface/80 border border-white/10 animate-in slide-in-from-right-full fade-in duration-300 overflow-hidden group">
            <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${gradient}`}></div>
            <div className={`absolute inset-0 bg-gradient-to-r ${gradient} opacity-5 group-hover:opacity-10 transition-opacity`}></div>

            <div className="mr-3 shrink-0 relative z-10 transition-transform group-hover:scale-110 duration-200">
                {icons[type] || icons.info}
            </div>
            <p className="text-sm font-medium text-white flex-1 relative z-10 drop-shadow-sm">{message}</p>
            <button
                onClick={onClose}
                className="ml-3 text-white/40 hover:text-white transition-all hover:rotate-90 duration-200 relative z-10"
            >
                <X size={16} />
            </button>
        </div>
    );
};
