import React, { useState, useEffect, useRef } from 'react';
import { useServer } from '../context/ServerContext';
import { serverApi } from '../api/server';
import { Terminal as TerminalIcon, Send } from 'lucide-react';
import Convert from 'ansi-to-html';
import { useAuth } from '../context/AuthContext';

const Console = () => {
    const { user } = useAuth();
    const canExecute = user?.role === 'admin' || user?.permissions?.includes('console.command');

    const [logs, setLogs] = useState([]);
    const [command, setCommand] = useState('');
    const logsEndRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);
    const { socket } = useServer();

    const converter = React.useMemo(() => {
        return new Convert({
            fg: '#e5e7eb',
            bg: '#000000',
            newline: true,
            escapeXML: true
        });
    }, []);

    useEffect(() => {
        if (!socket) return;
        setIsConnected(true);
        socket.emit('request_log_history');
        socket.on('log_history', (data) => {
            console.log("RAW log_history data:", data);

            let history = [];
            if (Array.isArray(data)) {
                // Check if it's a tuple wrapped in array (common in rust socketioxide sometimes)
                if (data.length === 1 && Array.isArray(data[0])) {
                    history = data[0];
                } else {
                    history = data;
                }
            } else if (data && typeof data === 'object' && data[0]) {
                history = Array.from(data);
            }

            console.log("Processed history length:", history.length);

            const limitedHistory = (history || []).slice(-300);
            const filteredHistory = limitedHistory.filter(log => typeof log === 'string' && !log.includes('[System] Connection established'));
            setLogs(filteredHistory);
        });
        socket.on('console_log', (log) => {
            if (!log.includes('[System] Connection established')) {
                setLogs(prev => [...prev.slice(-299), log]);
            }
        });
        return () => {
            setIsConnected(false);
            socket.off('console_log');
            socket.off('log_history');
        };
    }, [socket]);
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);
    const handleSendCommand = async (e) => {
        e.preventDefault();
        if (!command.trim()) return;
        try {
            await serverApi.sendCommand(command);
        } catch (err) {
            setLogs(prev => [...prev, `[System] Error sending command: ${err.message}`]);
        }
        setCommand('');
    };
    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col glass-panel rounded-2xl overflow-hidden shadow-2xl relative animate-fade-in border border-white/5">
            {/* Terminal Glow Effect */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-obsidian-accent/5 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="bg-black/40 backdrop-blur-md border-b border-white/5 px-6 py-3 flex items-center justify-between z-10">
                <div className="flex items-center space-x-3 text-obsidian-muted">
                    <div className="p-2 bg-white/5 rounded-lg text-white">
                        <TerminalIcon size={18} />
                    </div>
                    <span className="text-sm font-semibold tracking-wide text-white uppercase opacity-80">Server Console</span>
                </div>
                <div className="flex items-center space-x-3 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                    <span className={`w-2.5 h-2.5 rounded-full shadow-[0_0_8px] ${isConnected ? 'bg-green-500 shadow-green-500/50 animate-pulse' : 'bg-red-500 shadow-red-500/50'
                        }`}></span>
                    <span className="text-xs font-medium text-white/80">{isConnected ? 'LIVE CONNECTION' : 'DISCONNECTED'}</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 font-mono text-sm space-y-1 custom-scrollbar bg-black/20 backdrop-blur-sm z-0">
                {logs.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-obsidian-muted opacity-30">
                        <TerminalIcon size={48} className="mb-4" />
                        <p>Waiting for logs...</p>
                    </div>
                )}
                {logs.map((log, index) => (
                    <div key={index} className="break-words leading-relaxed animate-fade-in" dangerouslySetInnerHTML={{ __html: converter.toHtml(typeof log === 'string' ? log : JSON.stringify(log)) }} />
                ))}
                <div ref={logsEndRef} />
            </div>

            {/* Command Input - only visible/enabled if has console.command permission */}
            {canExecute ? (
                <form onSubmit={handleSendCommand} className="bg-black/40 p-4 border-t border-white/5 flex items-center relative z-20 backdrop-blur-md">
                    <span className="text-obsidian-accent px-3 font-mono text-lg font-bold animate-pulse">{'>'}</span>
                    <input
                        type="text"
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        className="flex-1 bg-transparent border-none focus:ring-0 text-white font-mono text-sm placeholder-white/20 py-2"
                        placeholder="Type server command..."
                    />
                    <button
                        type="submit"
                        disabled={!command.trim()}
                        className="p-3 text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-all disabled:opacity-30 hover:scale-105 active:scale-95"
                    >
                        <Send size={18} />
                    </button>
                </form>
            ) : (
                <div className="bg-black/40 p-4 border-t border-white/5 flex items-center justify-center relative z-20 backdrop-blur-md">
                    <span className="text-obsidian-muted text-sm font-mono flex items-center gap-2">
                        <TerminalIcon size={14} /> Read-only mode (No execute permission)
                    </span>
                </div>
            )}
        </div>
    );
};
export default Console;
