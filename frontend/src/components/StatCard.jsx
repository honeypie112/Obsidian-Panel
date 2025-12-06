import React from 'react';
import clsx from 'clsx';

const StatCard = ({ title, value, subtext, icon: Icon, color = 'blue' }) => {
    const colorStyles = {
        blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
        green: 'text-green-400 bg-green-500/10 border-green-500/20',
        orange: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    };

    return (
        <div className="bg-obsidian-surface border border-obsidian-border rounded-xl p-6 flex items-start justify-between hover:border-obsidian-accent/30 transition-colors">
            <div>
                <p className="text-obsidian-muted text-xs font-medium uppercase tracking-wider mb-1">{title}</p>
                <h3 className="text-2xl font-bold text-white">{value}</h3>
                {subtext && <p className="text-xs text-obsidian-muted mt-1">{subtext}</p>}
            </div>
            <div className={clsx("p-3 rounded-lg border", colorStyles[color])}>
                <Icon size={24} />
            </div>
        </div>
    );
};

export default StatCard;
