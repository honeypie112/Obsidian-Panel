import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
const Modal = ({ isOpen, onClose, title, children, footer }) => {
    const modalRef = useRef(null);
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                ref={modalRef}
                className="bg-obsidian-surface border border-obsidian-border rounded-xl shadow-2xl w-full max-w-md transform transition-all animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-6 border-b border-obsidian-border/50">
                    <h3 className="text-xl font-bold text-white">{title}</h3>
                    <button
                        onClick={onClose}
                        className="text-obsidian-muted hover:text-white transition-colors p-1 hover:bg-white/5 rounded-lg"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6 text-obsidian-muted">
                    {children}
                </div>
                {footer && (
                    <div className="p-6 pt-2 flex justify-end gap-3">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};
export default Modal;
