import React, { useEffect, useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Send, Sparkles } from 'lucide-react';
import axios from 'axios';
import { io } from 'socket.io-client';
import './Console.css';

const Console = () => {
    const { selectedServer } = useOutletContext();
    const [consoleLines, setConsoleLines] = useState([]);
    const [command, setCommand] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const consoleEndRef = useRef(null);

    useEffect(() => {
        if (!selectedServer) return;

        // Connect to Socket.IO (use same origin in production, localhost:3000 in dev)
        const socketUrl = process.env.NODE_ENV === 'production'
            ? window.location.origin
            : 'http://localhost:3000';

        const socket = io(socketUrl);

        socket.on('connect', () => {
            console.log('✅ Socket.IO connected');
            socket.emit('joinServer', selectedServer._id);
        });

        socket.on('console', ({ type, data }) => {
            console.log('📝 Received console data:', type, data.substring(0, 100));
            const lines = data.split('\n').filter(line => line.trim());
            setConsoleLines(prev => [...prev, ...lines.map(line => ({ type, text: line }))].slice(-200));
        });

        socket.on('disconnect', () => {
            console.log('❌ Socket.IO disconnected');
        });

        socket.on('connect_error', (error) => {
            console.error('Socket.IO connection error:', error);
        });

        return () => {
            socket.emit('leaveServer', selectedServer._id);
            socket.disconnect();
        };
    }, [selectedServer]);

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
        } catch (error) {
            console.error('AI assist failed:', error);
            alert(error.response?.data?.error || 'AI assist failed. Please try again.');
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

    return (
        <div className="console-page">
            <div className="console-header">
                <h1>Server Console</h1>
                <p className="page-subtitle">Real-time server logs and command execution</p>
            </div>

            <div className="console-container card">
                <div className="console-output">
                    {consoleLines.length === 0 ? (
                        <div className="console-empty">
                            <p>Waiting for server output...</p>
                            <p className="console-hint">Start the server to see logs here</p>
                        </div>
                    ) : (
                        consoleLines.map((line, index) => (
                            <div
                                key={index}
                                className={`console-line console-${line.type}`}
                            >
                                <span className="console-prefix">{line.type === 'input' ? '$' : '>'}</span>
                                <span className="console-text">{line.text}</span>
                            </div>
                        ))
                    )}
                    <div ref={consoleEndRef} />
                </div>

                <form className="console-input-container" onSubmit={handleSendCommand}>
                    <div className="console-input-wrapper">
                        <span className="input-prefix">$</span>
                        <input
                            type="text"
                            className="console-input"
                            placeholder="Type a command or ask AI to write one..."
                            value={command}
                            onChange={(e) => setCommand(e.target.value)}
                            disabled={selectedServer.status !== 'online'}
                        />
                    </div>

                    <div className="console-actions">
                        <button
                            type="button"
                            className="ai-assist-btn"
                            onClick={handleAIAssist}
                            disabled={!command.trim() || selectedServer.status !== 'online' || aiLoading}
                        >
                            <Sparkles size={16} />
                            {aiLoading ? 'Generating...' : 'AI Assist'}
                        </button>

                        <button
                            type="submit"
                            className="send-btn"
                            disabled={!command.trim() || selectedServer.status !== 'online'}
                        >
                            <Send size={16} />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Console;
