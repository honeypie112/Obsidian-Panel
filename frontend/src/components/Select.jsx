import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { clsx } from 'clsx';  
const Select = ({ value, onChange, options, label, disabled = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);
    const selectedOption = options.find(opt => opt.value === value) || options[0];
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    const handleSelect = (val) => {
        if (!disabled) {
            onChange(val);
            setIsOpen(false);
        }
    };
    return (
        <div className="relative" ref={containerRef}>
            {label && <label className="block text-sm font-medium text-obsidian-muted mb-2">{label}</label>}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full flex items-center justify-between bg-black/20 border ${isOpen ? 'border-obsidian-accent ring-1 ring-obsidian-accent' : 'border-obsidian-border'} text-white rounded-lg p-3 transition-all hover:bg-black/30 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed`}
            >
                <span className="truncate">{selectedOption?.label || value}</span>
                <ChevronDown size={16} className={`text-obsidian-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            { }
            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-[#1a1a1a] border border-obsidian-border rounded-lg shadow-xl shadow-black/50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top">
                    <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => handleSelect(option.value)}
                                className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${option.value === value
                                        ? 'bg-obsidian-accent/10 text-obsidian-accent'
                                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                                    }`}
                            >
                                <span className="truncate text-left">{option.label}</span>
                                {option.value === value && <Check size={14} />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
export default Select;
