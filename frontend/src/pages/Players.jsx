import React from 'react';
import { useOutletContext } from 'react-router-dom';
import './Players.css';

const Players = () => {
    const { selectedServer } = useOutletContext();

    if (!selectedServer) {
        return (
            <div className="no-server">
                <h2>No Server Selected</h2>
                <p>Please select a server to view players</p>
            </div>
        );
    }

    return (
        <div className="players-page">
            <div className="players-header">
                <h1>Player Management</h1>
                <p className="page-subtitle">View and manage online players</p>
            </div>

            <div className="players-container card">
                <div className="players-empty">
                    <p>No players online</p>
                    <p className="players-hint">Players will appear here when they join the server</p>
                </div>
            </div>
        </div>
    );
};

export default Players;
