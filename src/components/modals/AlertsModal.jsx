import React from 'react';

export default function AlertsModal({ alerts, onClose, onClear }) {
    if (!alerts || alerts.length === 0) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
                <div style={{ fontSize: '2rem', marginBottom: '10px' }}>✅</div>
                <div>All systems normal. No active alerts.</div>
                <button onClick={onClose} className="btn-text" style={{ marginTop: '20px' }}>Close</button>
            </div>
        );
    }

    return (
        <div className="log-container">
            <div className="log-summary-card" style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e)', borderColor: '#ff4757' }}>
                <div className="summary-title" style={{ color: '#ff4757' }}>ACTIVE ALERTS</div>
                <div className="summary-value">{alerts.length}</div>
                <div className="summary-sub">Requires Attention</div>
            </div>

            <div className="log-list">
                {alerts.map((a, i) => (
                    <div key={i} className="log-item" style={{ borderLeft: `3px solid ${getColor(a.type)} ` }}>
                        <div className="log-icon">
                            {getIcon(a.type)}
                        </div>
                        <div className="log-details">
                            <div className="log-cat" style={{ color: getColor(a.type) }}>{a.type.toUpperCase()}</div>
                            <div style={{ color: '#ddd', fontSize: '0.95rem' }}>{a.msg}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button onClick={onClear} className="plan-start-btn" style={{ background: '#ff4757', border: 'none', flex: 1 }}>
                    Clear All
                </button>
                <button onClick={onClose} className="plan-start-btn" style={{ background: 'transparent', border: '1px solid #444', flex: 1 }}>
                    Close
                </button>
            </div>
        </div>
    );
}

function getColor(type) {
    switch (type) {
        case 'action': return '#ff4757'; // Red
        case 'warning': return '#ffa502'; // Orange
        case 'success': return '#2ed573'; // Green
        case 'motivation': return '#1e90ff'; // Blue
        default: return '#7bed9f';
    }
}

function getIcon(type) {
    switch (type) {
        case 'action': return '🚨';
        case 'warning': return '⚠️';
        case 'success': return '🎉';
        case 'motivation': return '🔥';
        default: return 'ℹ️';
    }
}
