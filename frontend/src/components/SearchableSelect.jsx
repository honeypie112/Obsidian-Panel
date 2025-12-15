import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import clsx from 'clsx';
const SearchableSelect = ({ options, value, onChange, placeholder = "Select...", disabled = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const safeOptions = Array.isArray(options) ? options : [];
    const selectedOption = safeOptions.find(opt => opt.value === value);
    useEffect(() => {
        const newLabel = selectedOption ? selectedOption.label : (value || '');
        if (inputValue !== newLabel) {
            setInputValue(newLabel);
        }
    }, [value, selectedOption]);
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    const filteredOptions = safeOptions.filter(opt =>
        (opt.label && opt.label.toLowerCase().includes(inputValue.toLowerCase())) ||
        (opt.value && opt.value.toString().toLowerCase().includes(inputValue.toLowerCase()))
    );
    const handleInputChange = (e) => {
        const newVal = e.target.value;
        setInputValue(newVal);
        onChange(newVal);
        setIsOpen(true);
    };
    const handleOptionSelect = (opt) => {
        onChange(opt.value);
        setInputValue(opt.label);
        setIsOpen(false);
    };
    return (
        <div className="relative" ref={containerRef}>
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onClick={() => !disabled && setIsOpen(true)}
                    onFocus={() => !disabled && setIsOpen(true)}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={clsx(
                        "w-full bg-obsidian-bg border border-obsidian-border rounded-lg px-4 py-2.5 text-white pr-10 focus:outline-none transition-colors",
                        disabled ? "opacity-50 cursor-not-allowed" : "hover:border-obsidian-accent focus:border-obsidian-accent focus:ring-1 focus:ring-obsidian-accent"
                    )}
                />
                <button
                    type="button"
                    onClick={() => {
                        if (disabled) return;
                        if (isOpen) {
                            setIsOpen(false);
                        } else {
                            setIsOpen(true);
                            inputRef.current?.focus();
                        }
                    }}
                    className="absolute right-0 top-0 h-full px-3 text-obsidian-muted hover:text-white transition-colors flex items-center"
                >
                    <ChevronDown size={16} className={clsx("transition-transform", isOpen && "rotate-180")} />
                </button>
            </div>
            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-obsidian-surface border border-obsidian-border rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt) => (
                                <div
                                    key={opt.value}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        handleOptionSelect(opt);
                                    }}
                                    className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-white/5 cursor-pointer group"
                                >
                                    <span className="text-white group-hover:text-obsidian-accent transition-colors">{opt.label}</span>
                                    {value === opt.value && <Check size={14} className="text-obsidian-accent" />}
                                </div>
                            ))
                        ) : (
                            <div className="px-3 py-4 text-center text-sm text-obsidian-muted">
                                {inputValue ? (
                                    <span className="text-obsidian-accent">Use "{inputValue}"</span>
                                ) : (
                                    "Start typing..."
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
export default SearchableSelect;
