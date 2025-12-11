import React from 'react';

export default function LogModal({ todayLog }) {
    return (
        <>
            {todayLog.map((s, i) => (
                <div key={i} className="list-item">
                    <div className="list-title">{s.category}</div>
                    <div className="list-sub" style={{ color: "#4facfe", fontWeight: 700, fontSize: "1rem" }}>{s.minutes}m</div>
                </div>
            ))}
        </>
    );
}
