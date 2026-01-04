import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';
import clsx from 'clsx';
const DatePicker = ({ value, onChange, placeholder = "Select date" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(new Date());
    const containerRef = useRef(null);
    // Sync viewDate with prop value - this is intentional for controlled component behavior
    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (value) {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                setViewDate(date);
            }
        }
    }, [value]);
    /* eslint-enable react-hooks/set-state-in-effect */
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);
    const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    const generateDays = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const days = daysInMonth(year, month);
        const firstDay = firstDayOfMonth(year, month);
        const dayElements = [];
        for (let i = 0; i < firstDay; i++) {
            dayElements.push(<div key={`empty-${i}`} className="h-8 w-8" />);
        }
        for (let day = 1; day <= days; day++) {
            const currentDate = new Date(year, month, day);
            const isSelected = value && new Date(value).toDateString() === currentDate.toDateString();
            const isToday = new Date().toDateString() === currentDate.toDateString();
            dayElements.push(
                <button
                    key={day}
                    onClick={() => {
                        const offsetDate = new Date(currentDate.getTime() - (currentDate.getTimezoneOffset() * 60000));
                        onChange(offsetDate.toISOString().split('T')[0]);
                        setIsOpen(false);
                    }}
                    className={clsx(
                        "h-8 w-8 rounded-full text-sm flex items-center justify-center transition-colors",
                        isSelected ? "bg-obsidian-accent text-white" : "hover:bg-white/10 text-gray-300",
                        isToday && !isSelected && "border border-obsidian-accent text-obsidian-accent"
                    )}
                >
                    {day}
                </button>
            );
        }
        return dayElements;
    };
    const changeMonth = (offset) => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1));
    };
    return (
        <div className="relative" ref={containerRef}>
            <div
                className="flex items-center bg-obsidian-surface border border-obsidian-border rounded-lg px-3 py-1.5 cursor-pointer hover:border-obsidian-accent/50 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <CalendarIcon size={16} className="text-obsidian-muted mr-2" />
                <span className={clsx("text-sm", value ? "text-white" : "text-obsidian-muted")}>
                    {value ? new Date(value).toLocaleDateString() : placeholder}
                </span>
                {value && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onChange('');
                        }}
                        className="ml-2 p-0.5 rounded-full hover:bg-white/10 text-obsidian-muted hover:text-white transition-colors"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>
            {isOpen && (
                <div className="absolute right-0 mt-2 p-4 bg-obsidian-surface border border-obsidian-border rounded-xl shadow-xl shadow-black/50 z-50 w-64 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={() => changeMonth(-1)}
                            className="p-1 hover:bg-white/5 rounded-lg text-obsidian-muted hover:text-white transition-colors"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="font-medium text-white">
                            {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
                        </span>
                        <button
                            onClick={() => changeMonth(1)}
                            className="p-1 hover:bg-white/5 rounded-lg text-obsidian-muted hover:text-white transition-colors"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center mb-2">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                            <span key={d} className="text-xs text-obsidian-muted font-medium">{d}</span>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {generateDays()}
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/5 text-center">
                        <button
                            onClick={() => {
                                onChange('');
                                setIsOpen(false);
                            }}
                            className="text-xs text-obsidian-muted hover:text-white transition-colors"
                        >
                            Clear Filter
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
export default DatePicker;
