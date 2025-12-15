import React, { useState } from 'react';
import { callMasterWebhook } from '../../services/api';

export default function MasterRunModal({ onClose }) {
    const [input, setInput] = useState("");
    const [status, setStatus] = useState("idle"); // idle, running, success, skipped, error
    const [forceMode, setForceMode] = useState(false);
    const [msg, setMsg] = useState("");

    // The requiredInput logic is being removed as per the instruction to pass input directly as password.
    // const requiredInput = forceMode ? "ADVANCE_RUN" : "Run";

    const handleRun = async () => {
        if (!input) return; // Basic empty check

        setStatus("running");
        try {
            // Pass the input directly as password to the backend
            const res = await callMasterWebhook(input);

            if (res.success) {
                if (res.status === "skipped") {
                    setStatus("skipped");
                    setMsg(res.reason || "Script already ran today.");
                } else {
                    setStatus("success");
                    setMsg("Execution Complete!");
                }
                setTimeout(onClose, 3000); // Give user time to read
            } else {
                setStatus("error");
                setMsg("Execution Failed: " + (res.error || "Unknown Error"));
            }
        } catch (e) {
            setStatus("error");
            setMsg("Network Error: " + e.message);
        }
    };

    return (
        <div className="glass-card" style={{ padding: '30px', textAlign: 'center', maxWidth: '400px', margin: '0 auto' }}>
            <h2 style={{ color: '#ff4d4d', marginBottom: '10px' }}>⚠️ Nightly Protocol</h2>
            {!forceMode && (
                <p style={{ color: '#aaa', marginBottom: '20px', fontSize: '0.9rem' }}>
                    Runs the master script (Feedback, Plan, Email).<br />
                    Safe Mode: Checks if already ran today.
                </p>
            )}
            {forceMode && (
                <p style={{ color: '#ff4757', marginBottom: '20px', fontSize: '0.9rem', border: '1px solid #ff4757', padding: '10px', borderRadius: '8px' }}>
                    <strong>ADVANCED: FORCE MODE ON</strong><br />
                    This will bypass the daily duplication check and run anyway.
                </p>
            )}

            {status === 'running' ? (
                <div style={{ padding: '20px' }}>
                    <div className="spinner"></div>
                    <p style={{ marginTop: '10px', color: '#00f2fe' }}>Executing Master Script...</p>
                </div>
            ) : (status === 'success' || status === 'skipped') ? (
                <div style={{ color: status === 'success' ? '#00ff88' : '#f9ca24', fontSize: '1.2rem', padding: '20px' }}>
                    <i className={`fas fa-${status === 'success' ? 'check-circle' : 'exclamation-circle'}`}></i> {msg}
                </div>
            ) : status === 'error' ? (
                <div style={{ color: '#ff4757', padding: '20px' }}>
                    <i className="fas fa-times-circle"></i> {msg}
                </div>
            ) : (
                <>
                    <input
                        type="text"
                        placeholder="Enter Confirmation Code"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        style={{
                            width: '100%', padding: '12px', borderRadius: '8px',
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)',
                            color: '#fff', textAlign: 'center', fontSize: '1.2rem', marginBottom: '15px'
                        }}
                    />

                    <div style={{ marginBottom: '20px', textAlign: 'left', background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.9rem', color: '#ccc' }}>
                            <input
                                type="checkbox"
                                checked={forceMode}
                                onChange={(e) => { setForceMode(e.target.checked); setInput(""); }} // Clear input on toggle
                            />
                            Advanced: Force Run (Ignore Checks)
                        </label>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button className="btn" onClick={onClose} style={{ flex: 1, background: 'rgba(255,255,255,0.1)' }}>CANCEL</button>
                        <button
                            className="btn"
                            onClick={handleRun}
                            disabled={!input}
                            style={{
                                flex: 2,
                                background: input ? (forceMode ? '#ff4757' : 'linear-gradient(45deg, #ff4d4d, #f9cb28)') : '#333',
                                opacity: input ? 1 : 0.5,
                                color: '#000', fontWeight: 'bold'
                            }}
                        >
                            {forceMode ? "FORCE EXECUTE" : "RUN PROTOCOL"}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
