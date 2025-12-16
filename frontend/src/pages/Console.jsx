import React, { useState, useEffect, useRef } from 'react';
import { useServer } from '../context/ServerContext';
import { serverApi } from '../api/server';
import { Terminal as TerminalIcon, Send } from 'lucide-react';
import Convert from 'ansi-to-html';

const Console = () => {
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
        socket.on('log_history', (history) => {
            const limitedHistory = (history || []).slice(-300);
            setLogs(limitedHistory);
            setLogs(prev => [...prev, '[System] Connection established.']);
        });
        socket.on('console_log', (log) => {
            setLogs(prev => [...prev.slice(-299), log]);
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
        <div className="h-[calc(100vh-8rem)] flex flex-col bg-black rounded-xl border border-obsidian-border overflow-hidden shadow-2xl">
            <div className="bg-obsidian-surface border-b border-obsidian-border px-4 py-2 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-obsidian-muted">
                    <TerminalIcon size={16} />
                    <span className="text-sm font-medium">Server Console</span>
                </div>
                <div className="flex items-center space-x-2">
                    <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    <span className="text-xs text-obsidian-muted">{isConnected ? 'Connected' : 'Disconnected'}</span>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-1 custom-scrollbar">
                {logs.map((log, index) => (
                    <div key={index} className="break-words" dangerouslySetInnerHTML={{ __html: converter.toHtml(log) }} />
                ))}
                <div ref={logsEndRef} />
            </div>
            <form onSubmit={handleSendCommand} className="bg-obsidian-surface p-2 border-t border-obsidian-border flex items-center">
                <span className="text-obsidian-accent px-2 font-mono">{'>'}</span>
                <input
                    type="text"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    className="flex-1 bg-transparent border-none focus:ring-0 text-white font-mono text-sm placeholder-obsidian-muted"
                    placeholder="Type a command..."
                />
                <button
                    type="submit"
                    disabled={!command.trim()}
                    className="p-2 text-obsidian-muted hover:text-white transition-colors disabled:opacity-50"
                >
                    <Send size={16} />
                </button>
            </form>
        </div>
    );
};
export default Console;
