import React from 'react';
import ChartComponent from '../ChartComponent';

export default function StatsModal({ dash }) {
    return (
        <div>
            <div className="dash-grid">
                <div className="stat-widget">
                    <div className="stat-val" style={{ color: "#ffd93d" }}>{dash.stats.level}</div>
                    <div style={{ opacity: 0.5, fontSize: "0.7rem" }}>LEVEL</div>
                </div>
                <div className="stat-widget">
                    <div className="stat-val" style={{ color: "#ff4757" }}>{dash.stats.streak}</div>
                    <div style={{ opacity: 0.5, fontSize: "0.7rem" }}>STREAK</div>
                </div>
            </div>
            <div className="stat-widget" style={{ marginBottom: 15 }}>
                <div style={{ opacity: 0.5, fontSize: "0.7rem", letterSpacing: 2 }}>TOTAL XP (LIFETIME)</div>
                <div className="stat-val" style={{ color: "#7000ff", fontSize: "2.5rem" }}>{dash.stats.totalXP}</div>
            </div>
            <div className="stat-widget" style={{ marginBottom: 20, border: "1px solid #4facfe" }}>
                <div style={{ opacity: 0.5, fontSize: "0.7rem", letterSpacing: 2 }}>TODAY'S PREDICTION</div>
                <div className="stat-val" style={{ color: "#4facfe", fontSize: "3rem" }}>{dash.prediction.xp}</div>
                <div style={{ display: "flex", justifyContent: "center", gap: 15, marginTop: 5, opacity: 0.8, fontSize: "0.8rem" }}>
                    <span>📚 {dash.prediction.breakdown.study || 0}</span>
                    <span>✅ {dash.prediction.breakdown.task || 0}</span>
                    <span style={{ color: "#ffd93d" }}>⭐ {dash.prediction.breakdown.bonus || 0}</span>
                </div>
            </div>
            <div style={{ height: 200 }}>
                <ChartComponent data={dash.history} />
            </div>
        </div>
    );
}
