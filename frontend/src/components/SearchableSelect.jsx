import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import clsx from 'clsx';

const SearchableSelect = ({ options, value, onChange, placeholder = "Select version...", disabled = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef(null);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const safeOptions = Array.isArray(options) ? options : [];
    const filteredOptions = safeOptions.filter(opt =>
        opt.label && opt.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const selectedOption = safeOptions.find(opt => opt.value === value);

    return (
        <div className="relative" ref={containerRef}>
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={clsx(
                    "w-full bg-obsidian-bg border border-obsidian-border rounded-lg px-4 py-2.5 text-white flex justify-between items-center cursor-pointer transition-colors",
                    disabled ? "opacity-50 cursor-not-allowed" : "hover:border-obsidian-accent focus:border-obsidian-accent",
                    isOpen && "border-obsidian-accent ring-1 ring-obsidian-accent"
                )}
            >
                <span className={clsx(!selectedOption && "text-obsidian-muted")}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown size={16} className={clsx("text-obsidian-muted transition-transform", isOpen && "rotate-180")} />
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-obsidian-surface border border-obsidian-border rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <div className="p-2 border-b border-obsidian-border/50 sticky top-0 bg-obsidian-surface">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-obsidian-muted" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search..."
                                className="w-full bg-obsidian-bg/50 border border-obsidian-border rounded-md pl-8 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-obsidian-accent"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt) => (
                                <div
                                    key={opt.value}
                                    onClick={() => {
                                        onChange(opt.value);
                                        setIsOpen(false);
                                        setSearchTerm('');
                                    }}
                                    className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-white/5 cursor-pointer group"
                                >
                                    <span className="text-white group-hover:text-obsidian-accent transition-colors">{opt.label}</span>
                                    {value === opt.value && <Check size={14} className="text-obsidian-accent" />}
                                </div>
                            ))
                        ) : (
                            <div className="px-3 py-4 text-center text-sm text-obsidian-muted">
                                {/* Creatable Logic */}
                                {searchTerm && (
                                    <button
                                        onClick={() => {
                                            onChange(searchTerm); // Pass raw string
                                            setIsOpen(false);
                                            setSearchTerm('');
                                        }}
                                        className="text-obsidian-accent hover:underline"
                                    >
                                        Use "{searchTerm}"
                                    </button>
                                )}
                                {!searchTerm && "No options found"}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
