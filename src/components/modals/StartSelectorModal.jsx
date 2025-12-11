import React, { useState } from 'react';

export default function StartSelectorModal({ bestSuggestion, act, customTarget, setCustomTarget }) {
    return (
        <div>
            {bestSuggestion ? (
                <div>
                    <div style={{ fontSize: "0.7rem", color: "#00f2fe", fontWeight: 800, marginBottom: 10 }}>RECOMMENDED NOW</div>
                    <button className="start-opt-btn suggested" style={{ width: "100%" }} onClick={() => act('start', { category: bestSuggestion.title, target: bestSuggestion.minutes })}>
                        <div className="list-title">{bestSuggestion.title}</div>
                        <div className="list-sub">{bestSuggestion.minutes} mins • {bestSuggestion.startIso}</div>
                    </button>
                </div>
            ) : (
                <div style={{ opacity: 0.5, textAlign: "center", marginBottom: 20 }}>No scheduled sessions nearby.</div>
            )}

            <div style={{ marginTop: 20 }}>
                <input className="custom-time-input" type="number" value={customTarget} onChange={e => setCustomTarget(e.target.value)} placeholder="Minutes (e.g. 120)" />
                <button className="btn btn-main" style={{ width: "100%", justifyContent: "center" }} onClick={() => act('start', { category: 'Custom Focus', target: customTarget })}>START CUSTOM</button>
            </div>
        </div>
    );
}
