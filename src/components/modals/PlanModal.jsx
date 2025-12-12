import React from 'react';

export default function PlanModal({ schedule, st, act, setModal }) {
    if (schedule.length === 0) {
        return <div style={{ opacity: 0.6, fontSize: "0.9rem", textAlign: "center", padding: 20 }}>No events found.</div>;
    }

    return (
        <div className="plan-timeline">
            {schedule.map((ev, i) => {
                const isRunning = st.running && st.category === ev.title;
                const safePercent = (ev.percent < 5 && !isRunning) ? 0 : ev.percent;
                const safeDone = (ev.doneMins < 5 && !isRunning) ? 0 : ev.doneMins;
                const isDone = safePercent >= 100;

                return (
                    <div key={i} className={`plan-card ${isRunning ? 'active' : ''} ${isDone ? 'completed' : ''}`}>
                        <div className="plan-time">
                            <span>{ev.startIso}</span>
                            <div className="time-dot"></div>
                            <div className="time-line"></div>
                        </div>

                        <div className="plan-content">
                            <div className="plan-header">
                                <h3 className="plan-title">{ev.title}</h3>
                                {isRunning && <span className="tag running-pulse">ACTIVE</span>}
                                {isDone && <span className="tag done-badge">DONE</span>}
                            </div>

                            <div className="plan-progress-container">
                                <div className="plan-bar-bg">
                                    <div className="plan-bar-fill" style={{ width: `${Math.max(0, safePercent)}%` }}></div>
                                </div>
                                <span className="plan-stats">{safeDone}/{ev.minutes}m</span>
                            </div>

                            <div className="plan-actions">
                                {!isRunning && !isDone && !st.running && (
                                    <button className="plan-start-btn" onClick={() => { act("start", { category: ev.title, target: ev.minutes }); setModal(null); }}>
                                        START SESSION
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
