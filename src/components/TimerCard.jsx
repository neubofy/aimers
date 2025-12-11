import React from 'react';
import { formatTime } from '../utils/time';

export default function TimerCard({ st, sync, elapsed, pauseLeft, act, onPop, isPopped, addMins, setAddMins, openStartModal, targetTime, onLogout }) {
    const maxTime = st.target || targetTime || 120;
    const safeElapsed = Math.max(0, elapsed);
    const pct = (!st.running && !st.paused) ? 0 : (st.paused ? (pauseLeft / 120) * 100 : Math.min(100, (safeElapsed / (maxTime * 60)) * 100));
    const deg = (!st.running && !st.paused) ? 0 : (st.paused ? 0 : (safeElapsed / (maxTime * 60)) * 360);

    const bubbles = Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bubble" style={{ left: `${20 + i * 15}%`, animationDelay: `${i * 0.5}s` }}></div>
    ));

    return (
        <div className="glass-card">
            {!isPopped && (
                <div className="header-row">
                    <button className="logout-btn" onClick={onLogout}><i className="fas fa-power-off"></i></button>
                    <span style={{ fontSize: "0.8rem", fontWeight: "bold", letterSpacing: 1 }}>AIMERS OS</span>
                    <button onClick={onPop} style={{ background: "none", border: "none", color: "#fff", fontSize: "1.2rem", cursor: "pointer" }}>⤢</button>
                </div>
            )}

            <div className={`timer-wrapper ${st.running && !st.paused ? 'running' : ''} ${st.paused ? 'paused' : ''}`}>
                <div className="pulse-ring"></div>
                <div className="pulse-ring"></div>
                <div className="needle-ring">
                    <div className="needle" style={{ transform: `rotate(${deg}deg)`, opacity: (!st.running && !st.paused) ? 1 : (st.paused ? 0 : 1) }}></div>
                </div>
                <div className="liquid-mask">
                    <div className={`liquid ${st.paused ? 'paused-liquid' : ''}`} style={{ height: `${pct}%` }}>
                        {st.running && !st.paused && bubbles}
                    </div>
                    <div className="timer-content">
                        <div className="time-display">
                            {(!st.running && !st.paused) ? "00:00" : (st.paused ? pauseLeft + "s" : formatTime(safeElapsed))}
                        </div>
                        <div className="status-label">{st.paused ? "PAUSED" : (st.running ? st.category : "READY")}</div>
                    </div>
                </div>
            </div>

            <div className="btn-group">
                {!st.running && !st.paused ?
                    <button className="btn btn-main" onClick={openStartModal}>START FOCUS</button> :
                    (st.paused ?
                        <>
                            <button key="r" className="btn btn-main" onClick={() => act("resume")}>RESUME</button>
                            <button key="res" className="btn btn-reset" onClick={() => act("reset")}>RESET</button>
                            <button key="s" className="btn btn-stop" onClick={() => act("stop")}>STOP</button>
                        </> :
                        <>
                            <button key="p" className="btn" onClick={() => act("pause")}>PAUSE</button>
                            <button key="s" className="btn btn-stop" onClick={() => act("stop")}>STOP</button>
                        </>
                    )
                }
            </div>

            {!isPopped && (
                <div className="add-row">
                    <input className="add-input" type="number" placeholder="Manual Mins..." value={addMins} onChange={e => setAddMins(e.target.value)} />
                    <button className="btn" style={{ background: "#fff", color: "#000", padding: "0 15px" }} onClick={() => { if (addMins) { act("add", { minutes: addMins }); setAddMins(""); } }}>+</button>
                </div>
            )}
        </div>
    );
}
