import React, { useEffect, useRef } from 'react';
import FormattedText from '../FormattedText';

export default function MentorModal({
    groqKey, chatHistory, aiThinking, listening, msgInput,
    setMsgInput, saveGroqKey, clearChat, resetGroqKey,
    toggleVoice, sendToMentor, syncData
}) {
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [chatHistory]);

    return (
        <div className="gen-ai-container">
            {!groqKey ? (
                <div className="key-entry-overlay">
                    <div className="key-card glass-card">
                        <h3>INITIALIZE AI CORE</h3>
                        <p>Enter your Groq API Key to activate the neural link.</p>
                        <input
                            type="password"
                            className="modern-input"
                            placeholder="gsk_..."
                            onChange={e => { if (e.target.value.startsWith('gsk_')) saveGroqKey(e.target.value); }}
                        />
                    </div>
                </div>
            ) : (
                <>
                    <div className="gen-ai-header">
                        <span className="model-tag">GPT-OSS-120B</span>
                        <div className="ai-actions">
                            <button className="icon-action" onClick={syncData} title="Sync Context"><i className="fas fa-sync-alt"></i></button>
                            <button className="icon-action" onClick={clearChat} title="Clear Memory"><i className="fas fa-trash-alt"></i></button>
                            <button className="icon-action" onClick={resetGroqKey} title="Reset Key"><i className="fas fa-key"></i></button>
                        </div>
                    </div>

                    <div className="gen-ai-scroll" ref={scrollRef}>
                        {chatHistory.length === 0 && (
                            <div className="empty-state">
                                <div className="ai-avatar-large">🤖</div>
                                <h2>How can I assist you today?</h2>
                            </div>
                        )}
                        {chatHistory.map((m, i) => (
                            <div key={i} className={`msg-row ${m.role}`}>
                                {m.role !== 'user' && <div className="msg-avatar">{m.role === 'system' ? '⚙️' : '🤖'}</div>}
                                <div className="msg-bubble">
                                    <FormattedText text={m.content} />
                                </div>
                            </div>
                        ))}
                        {aiThinking && (
                            <div className="msg-row assistant">
                                <div className="msg-avatar">🤖</div>
                                <div className="msg-bubble thinking">
                                    <div className="dot-pulse"></div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="gen-ai-input-area">
                        <div className="input-pill">
                            <button className={`voice-trigger ${listening ? 'active' : ''}`} onClick={toggleVoice}>
                                <i className="fas fa-microphone"></i>
                            </button>
                            <input
                                className="magic-input"
                                autoFocus
                                placeholder="Message Aimers AI..."
                                value={msgInput}
                                onChange={e => setMsgInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') sendToMentor(); }}
                            />
                            <button className="send-trigger" onClick={() => sendToMentor()}>
                                <i className="fas fa-paper-plane"></i>
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
