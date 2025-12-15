import React, { useState } from 'react';
import { Play, Square, RotateCw } from 'lucide-react';
import clsx from 'clsx';
const PowerControls = ({ status, onStart, onStop, onRestart }) => {
    const [loading, setLoading] = useState(false);
    const handleAction = async (action, callback) => {
        setLoading(true);
        await callback();
        setLoading(false);
    };
    const isOnline = status === 'online';
    const isOffline = status === 'offline';
    return (
        <div className="flex space-x-2">
            <button
                onClick={() => handleAction('start', onStart)}
                disabled={!isOffline || loading}
                className={clsx(
                    "flex-1 flex items-center justify-center px-4 py-3 rounded-lg font-medium transition-all",
                    isOffline
                        ? "bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20"
                        : "bg-obsidian-surface border border-obsidian-border text-obsidian-muted opacity-50 cursor-not-allowed"
                )}
            >
                <Play size={18} className="mr-2 fill-current" />
                Start
            </button>
            <button
                onClick={() => handleAction('restart', onRestart)}
                disabled={!isOnline || loading}
                className={clsx(
                    "flex-1 flex items-center justify-center px-4 py-3 rounded-lg font-medium transition-all",
                    isOnline
                        ? "bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                        : "bg-obsidian-surface border border-obsidian-border text-obsidian-muted opacity-50 cursor-not-allowed"
                )}
            >
                <RotateCw size={18} className="mr-2" />
                Restart
            </button>
            <button
                onClick={() => handleAction('stop', onStop)}
                disabled={!isOnline || loading}
                className={clsx(
                    "flex-1 flex items-center justify-center px-4 py-3 rounded-lg font-medium transition-all",
                    isOnline
                        ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20"
                        : "bg-obsidian-surface border border-obsidian-border text-obsidian-muted opacity-50 cursor-not-allowed"
                )}
            >
                <Square size={18} className="mr-2 fill-current" />
                Stop
            </button>
        </div>
    );
};
export default PowerControls;
