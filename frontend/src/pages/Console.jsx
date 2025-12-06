import React, { useState, useEffect, useRef } from 'react';
import { mockApi } from '../utils/mockApi';
import { Terminal as TerminalIcon, Send } from 'lucide-react';

const Console = () => {
    const [logs, setLogs] = useState([]);
    const [command, setCommand] = useState('');
    const logsEndRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // Initial connection message
        setLogs(['[System] Connecting to server console...']);
        setIsConnected(true);

        const unsubscribe = mockApi.subscribeToConsole((newLog) => {
            setLogs((prev) => [...prev, newLog].slice(-100)); // Keep last 100 lines
        });

        return () => {
            unsubscribe();
            setIsConnected(false);
        };
    }, []);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const handleSendCommand = (e) => {
        e.preventDefault();
        if (!command.trim()) return;

        // Add user command to logs
        const timestamp = new Date().toLocaleTimeString();
        setLogs((prev) => [...prev, `> ${command}`]);

        // Process mock commands
        if (command.startsWith('op ')) {
            const player = command.split(' ')[1];
            setTimeout(() => {
                setLogs((prev) => [...prev, `[${timestamp}] [Server thread/INFO]: Made ${player} a server operator`]);
            }, 500);
        } else if (command === 'stop') {
            setTimeout(() => {
                setLogs((prev) => [...prev, `[${timestamp}] [Server thread/INFO]: Stopping the server`]);
                setLogs((prev) => [...prev, `[${timestamp}] [Server thread/INFO]: Saving chunks for level 'ServerLevel'...`]);
            }, 500);
        } else {
            setTimeout(() => {
                setLogs((prev) => [...prev, `[${timestamp}] [Server thread/INFO]: Unknown command. Type "help" for help.`]);
            }, 500);
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
                    <div key={index} className="break-words">
                        {log.startsWith('>') ? (
                            <span className="text-obsidian-accent">{log}</span>
                        ) : log.includes('INFO') ? (
                            <span className="text-blue-300">{log}</span>
                        ) : log.includes('WARN') ? (
                            <span className="text-yellow-300">{log}</span>
                        ) : log.includes('ERROR') ? (
                            <span className="text-red-400">{log}</span>
                        ) : (
                            <span className="text-gray-300">{log}</span>
                        )}
                    </div>
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
