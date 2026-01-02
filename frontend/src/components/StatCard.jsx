import React from 'react';

// eslint-disable-next-line no-unused-vars
const StatCard = ({ title, value, subtext, icon: Icon, color }) => {
    return (
        <div className="glass-card rounded-xl p-6 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
            <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
                <Icon size={64} />
            </div>

            <div className="flex items-start justify-between relative z-10">
                <div>
                    <p className="text-obsidian-muted text-sm font-medium uppercase tracking-wider">{title}</p>
                    <h3 className="text-2xl font-bold text-white mt-1 group-hover:bg-clip-text group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-gray-300 transition-all">
                        {value}
                    </h3>
                    {subtext && <p className="text-xs text-obsidian-muted mt-1 opacity-70">{subtext}</p>}
                </div>
                <div className={`p-3 rounded-lg bg-white/5 border border-white/10 ${color.replace('text-', 'text-')} shadow-lg backdrop-blur-md`}>
                    <Icon size={24} className={color} />
                </div>
            </div>
        </div>
    );
};
export default StatCard;
