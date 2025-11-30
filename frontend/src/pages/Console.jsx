import React, { useEffect, useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { Send, Sparkles } from 'lucide-react';
import axios from 'axios';
import { io } from 'socket.io-client';
import './Console.css';

const Console = () => {
    const { selectedServer } = useOutletContext();
    const { error } = useToast();
    const [consoleLines, setConsoleLines] = useState([]);
    const [command, setCommand] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const consoleEndRef = useRef(null);

    useEffect(() => {
        if (!selectedServer) return;

        // Connect to Socket.IO (use same origin in production, localhost:3000 in dev)
        const socketUrl = process.env.NODE_ENV === 'production'
            ? window.location.origin
            : 'http://localhost:3000';

        const socket = io(socketUrl, {
            transports: ['websocket', 'polling'], // Try websocket first, fallback to polling
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        socket.on('connect', () => {
            console.log('✅ Socket.IO connected');
            setIsConnected(true);
            socket.emit('joinServer', selectedServer._id);
        });

        socket.on('console', ({ type, data }) => {
            const lines = data.split('\n').filter(line => line.trim());
            setConsoleLines(prev => [...prev, ...lines.map(line => ({ type, text: line }))].slice(-200));
        });

        socket.on('disconnect', () => {
            console.log('❌ Socket.IO disconnected');
            setIsConnected(false);
        });

        socket.on('connect_error', (error) => {
            console.error('Socket.IO connection error:', error);
            setIsConnected(false);
        });

        return () => {
            socket.emit('leaveServer', selectedServer._id);
            socket.disconnect();
        };
    }, [selectedServer?._id]);

    useEffect(() => {
        consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [consoleLines]);

    const handleSendCommand = async (e) => {
        e.preventDefault();
        if (!command.trim() || !selectedServer) return;

        try {
            const response = await fetch(`/api/servers/${selectedServer._id}/command`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({ command }),
            });

            if (response.ok) {
                setConsoleLines(prev => [...prev, { type: 'input', text: `> ${command}` }]);
                setCommand('');
            }
        } catch (error) {
            console.error('Failed to send command:', error);
        }
    };

    const handleAIAssist = async () => {
        if (!command.trim() || !selectedServer) return;

        setAiLoading(true);
        try {
            const response = await axios.post('/api/ai/generate-command', {
                prompt: command,
                serverId: selectedServer._id,
            });

            // Set the generated command in the input
            setCommand(response.data.command);
        } catch (err) {
            console.error('AI assist failed:', err);
            error(err.response?.data?.error || 'AI assist failed. Please try again.');
        } finally {
            setAiLoading(false);
        }
    };

    if (!selectedServer) {
        return (
            <div className="no-server">
                <h2>No Server Selected</h2>
                <p>Please select a server to view console</p>
            </div>
        );
    }

    // Custom ANSI to HTML parser
    const parseAnsi = (text) => {
        if (!text) return null;

        // Basic color map
        const colors = {
            30: 'black', 31: 'red', 32: 'green', 33: 'yellow',
            34: 'blue', 35: 'magenta', 36: 'cyan', 37: 'white',
            90: 'gray', 91: 'lightred', 92: 'lightgreen', 93: 'lightyellow',
            94: 'lightblue', 95: 'lightmagenta', 96: 'lightcyan', 97: 'white'
        };

        // Split by ANSI escape codes
        const parts = text.split(/(\u001b\[\d+(?:;\d+)*m)/g);

        let currentColor = null;
        let isBold = false;

        return parts.map((part, index) => {
            if (part.startsWith('\u001b[')) {
                // Parse codes
                const codes = part.match(/\d+/g);
                if (codes) {
                    codes.forEach(code => {
                        const c = parseInt(code);
                        if (c === 0) {
                            currentColor = null;
                            isBold = false;
                        } else if (c === 1) {
                            isBold = true;
                        } else if (colors[c]) {
                            currentColor = colors[c];
                        }
                    });
                }
                return null;
            }

            if (!part) return null;

            return (
                <span
                    key={index}
                    style={{
                        color: currentColor ? `var(--console-${currentColor})` : 'inherit',
                        fontWeight: isBold ? 'bold' : 'normal'
                    }}
                >
                    {part}
                </span>
            );
        });
    };

    return (
        <div className="console-page">
            <div className="console-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1>Server Console</h1>
                        <p className="server-name">{selectedServer.name}</p>
                    </div>
                    <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
                        <div className="status-dot"></div>
                        {isConnected ? 'Connected' : 'Disconnected'}
                    </div>
                </div>
            </div>

            <div className="console-window">
                <div className="console-output">
                    {consoleLines.length === 0 ? (
                        <div className="console-empty">
                            <p>Waiting for logs...</p>
                        </div>
                    ) : (
                        consoleLines.map((line, index) => (
                            <div key={index} className={`console-line ${line.type}`}>
                                <span className="timestamp">
                                    {new Date().toLocaleTimeString()}
                                </span>
                                <span className="content">
                                    {parseAnsi(line.text)}
                                </span>
                            </div>
                        ))
                    )}
                    <div ref={consoleEndRef} />
                </div>

                <form onSubmit={handleSendCommand} className="console-input-area">
                    <div className="input-wrapper">
                        <input
                            type="text"
                            value={command}
                            onChange={(e) => setCommand(e.target.value)}
                            placeholder="Type a command..."
                            autoFocus
                            disabled={selectedServer.status !== 'online'}
                        />
                        <button
                            type="button"
                            className={`ai-btn ${aiLoading ? 'loading' : ''}`}
                            onClick={handleAIAssist}
                            title="Ask AI to generate command"
                            disabled={aiLoading || selectedServer.status !== 'online'}
                        >
                            <Sparkles size={18} />
                        </button>
                    </div>
                    <button type="submit" className="send-btn" disabled={selectedServer.status !== 'online'}>
                        <Send size={18} />
                        Send
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Console;
