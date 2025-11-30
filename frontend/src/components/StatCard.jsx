import React from 'react';
import './StatCard.css';

const StatCard = ({ title, value, subtitle, icon: Icon, color = 'blue', progress }) => {
    return (
        <div className="stat-card">
            <div className="stat-header">
                <div className="stat-title">{title}</div>
                <div className={`stat-icon stat-icon-${color}`}>
                    {Icon && <Icon size={20} />}
                </div>
            </div>

            <div className="stat-value">{value}</div>

            {progress !== undefined && (
                <div className="stat-progress">
                    <div
                        className={`stat-progress-bar stat-progress-${color}`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}

            {subtitle && <div className="stat-subtitle">{subtitle}</div>}
        </div>
    );
};

export default StatCard;
