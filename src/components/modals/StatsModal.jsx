import React from 'react';
import ChartComponent from '../ChartComponent';

export default function StatsModal({ dash }) {
    return (
        <div className="stats-container">
            {/* HERO XP CARD */}
            <div className="xp-hero-card">
                <div className="xp-ring">
                    <div className="xp-value">{dash.stats.totalXP}</div>
                    <div className="xp-label">LIFETIME XP</div>
                </div>
                <div className="xp-prediction">
                    <span className="pred-label">PROJECTED TODAY</span>
                    <span className="pred-val">+{dash.prediction.xp} XP</span>
                </div>
            </div>

            {/* QUICK STATS GRID */}
            <div className="stats-grid">
                <div className="stat-box level">
                    <div className="stat-icon">⚡</div>
                    <div className="stat-info">
                        <span className="stat-num">{dash.stats.level}</span>
                        <span className="stat-desc">LEVEL</span>
                    </div>
                </div>
                <div className="stat-box streak">
                    <div className="stat-icon">🔥</div>
                    <div className="stat-info">
                        <span className="stat-num">{dash.stats.streak}</span>
                        <span className="stat-desc">DAY STREAK</span>
                    </div>
                </div>
                <div className="stat-box focus">
                    <div className="stat-icon">🧠</div>
                    <div className="stat-info">
                        <span className="stat-num">{dash.prediction.breakdown.study || 0}</span>
                        <span className="stat-desc">FOCUS XP</span>
                    </div>
                </div>
            </div>

            {/* PREDICTION BREAKDOWN */}
            <div className="prediction-detail">
                <div className="pred-row">
                    <span>Task Completion</span>
                    <span className="pred-right">+{dash.prediction.breakdown.task || 0} XP</span>
                </div>
                <div className="pred-row">
                    <span>Bonus / Other</span>
                    <span className="pred-right" style={{ color: '#ffd93d' }}>+{dash.prediction.breakdown.bonus || 0} XP</span>
                </div>
            </div>

            {/* CHART SECTION */}
            <div className="chart-container">
                <div className="chart-header">PERFORMANCE HISTORY</div>
                <div style={{ height: 180, width: '100%' }}>
                    <ChartComponent data={dash.history} />
                </div>
            </div>
        </div>
    );
}
