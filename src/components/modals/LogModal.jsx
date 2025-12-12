import React from 'react';

export default function LogModal({ todayLog }) {
    const totalMinutes = todayLog.reduce((acc, curr) => acc + curr.minutes, 0);

    return (
        <div className="log-container">
            {/* Header Summary */}
            <div className="log-summary-card">
                <div className="summary-title">TOTAL FOCUS TODAY</div>
                <div className="summary-value">{totalMinutes}<span className="unit">m</span></div>
                <div className="summary-sub">{todayLog.length} Sessions Completed</div>
            </div>

            {/* Scrollable List */}
            <div className="log-list">
                {todayLog.length === 0 ? (
                    <div className="empty-log">No sessions recorded yet today.</div>
                ) : (
                    todayLog.map((s, i) => (
                        <div key={i} className="log-item">
                            <div className="log-icon">
                                {s.category === 'Study' ? '📚' : (s.category === 'Focus' ? '🎯' : '📝')}
                            </div>
                            <div className="log-details">
                                <div className="log-cat">{s.category}</div>
                                <div className="log-time-bar">
                                    <div className="log-fill" style={{ width: `${Math.min(100, (s.minutes / 60) * 100)}%` }}></div>
                                </div>
                            </div>
                            <div className="log-mins">{s.minutes}m</div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
