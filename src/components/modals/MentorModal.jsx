import React, { useEffect, useRef } from 'react';
import FormattedText from '../FormattedText';

export default function MentorModal({
    groqKey, chatHistory, aiThinking, listening, msgInput,
    setMsgInput, saveGroqKey, clearChat, resetGroqKey,
    toggleVoice, sendToMentor
}) {
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [chatHistory]);

    return (
        <div className="terminal-window">
            {groqKey && (
                <div className="chat-toolbar">
                    <button className="mini-btn" onClick={clearChat}>CLEAR</button>
                    <button className="mini-btn" onClick={resetGroqKey}>RESET KEY</button>
                </div>
            )}
            {!groqKey && (
                <div>
                    <div className="chat-bubble sys">SECURITY ALERT: Enter Groq API Key to enable AI Core.</div>
                    <input className="term-input" style={{ border: "1px solid #333", padding: 10, marginTop: 10, width: "100%" }} placeholder="gsk_..." onChange={e => saveGroqKey(e.target.value)} />
                </div>
            )}
            <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingTop: 30 }}>
                {chatHistory.map((m, i) => (
                    <div key={i} className={`chat-bubble ${m.role === 'user' ? 'user' : (m.role === 'system' ? 'sys' : 'ai')}`}>
                        <FormattedText text={m.content} />
                    </div>
                ))}
                {aiThinking && <div className="chat-bubble ai"><span className="tag running">PROCESSING...</span></div>}
            </div>
            {groqKey && (
                <div className="term-input-row">
                    <button className={`mic-btn ${listening ? 'listening' : ''}`} onClick={toggleVoice}><i className="fas fa-microphone"></i></button>
                    <input
                        className="term-input" autoFocus placeholder="Ask AI or give command..."
                        value={msgInput} onChange={e => setMsgInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') sendToMentor(); }}
                    />
                    <button className="send-btn" onClick={() => sendToMentor()}>➤</button>
                </div>
            )}
        </div>
    );
}
