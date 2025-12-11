import React from 'react';

export default function PlanModal({ schedule, st, act, setModal }) {
    if (schedule.length === 0) {
        return <div style={{ opacity: 0.6, fontSize: "0.9rem", textAlign: "center", padding: 20 }}>No events found.</div>;
    }

    return (
        <>
            {schedule.map((ev, i) => {
                const isRunning = st.running && st.category === ev.title;
                const safePercent = (ev.percent < 5 && !isRunning) ? 0 : ev.percent;
                const safeDone = (ev.doneMins < 5 && !isRunning) ? 0 : ev.doneMins;

                return (
                    <div key={i} className="list-item" style={{ border: isRunning ? "1px solid #00f2fe" : "1px solid rgba(255,255,255,0.05)" }}>
                        <div className="list-header">
                            <div className="list-title" style={{ color: isRunning ? "#00f2fe" : "#fff" }}>{ev.title}</div>
                            <span className="list-sub">{ev.startIso}</span>
                        </div>
                        <div className="progress-track">
                            <div className={`progress-fill ${safePercent >= 100 ? 'done' : (isRunning ? 'running' : '')}`} style={{ width: `${Math.max(0, safePercent)}%` }}></div>
                        </div>
                        <div className="list-footer">
                            <div className="list-sub">{safeDone}/{ev.minutes}m ({safePercent}%)</div>
                            {isRunning ?
                                <span className="tag running">RUNNING</span> :
                                (safePercent < 100 ?
                                    (st.running ?
                                        <span style={{ fontSize: "0.7rem", opacity: 0.5 }}>BUSY</span> :
                                        <button className="action-btn start" onClick={() => { act("start", { category: ev.title, target: ev.minutes }); setModal(null); }}>START</button>
                                    ) :
                                    <span style={{ color: "#00E676", fontWeight: 800, fontSize: "0.8rem" }}>DONE</span>
                                )
                            }
                        </div>
                    </div>
                );
            })}
        </>
    );
}
