import React, { useState, useEffect } from 'react';

export default function MathModal({ onSuccess, onCancel }) {
    const [step, setStep] = useState(1);
    const [problem, setProblem] = useState({ q: "", a: 0 });
    const [input, setInput] = useState("");
    const [error, setError] = useState(false);

    useEffect(() => {
        generateProblem(1);
    }, []);

    const generateProblem = (currentStep) => {
        let q = "", a = 0;

        if (currentStep === 1) {
            // Step 1: 3-Digit Sum
            const n1 = Math.floor(Math.random() * 900) + 100;
            const n2 = Math.floor(Math.random() * 900) + 100;
            q = `${n1} + ${n2}`;
            a = n1 + n2;
        } else {
            // Step 2: 2-Digit Multiply
            const n1 = Math.floor(Math.random() * 90) + 10;
            const n2 = Math.floor(Math.random() * 90) + 10;
            q = `${n1} × ${n2}`;
            a = n1 * n2;
        }

        setProblem({ q, a });
        setInput("");
        setError(false);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (parseInt(input) === problem.a) {
            if (step === 1) {
                setStep(2);
                generateProblem(2);
            } else {
                onSuccess();
            }
        } else {
            setError(true);
            setInput("");
            // Generate NEW problem on failing, as requested
            generateProblem(step);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
            <div className="glass-card" style={{ padding: '40px', maxWidth: '400px', width: '100%', border: `1px solid ${step === 1 ? '#ff4757' : '#D4AF37'}` }}>
                <div style={{ fontSize: '3rem', marginBottom: '10px' }}>{step === 1 ? '🔒' : '🔐'}</div>
                <h2 style={{ color: step === 1 ? '#ff4757' : '#D4AF37', marginBottom: '5px', fontSize: '1.5rem' }}>
                    SESSION LOCKED
                </h2>
                <div style={{ color: '#888', fontSize: '0.8rem', letterSpacing: 2, marginBottom: 20 }}>
                    LEVEL {step} / 2
                </div>

                <p style={{ color: '#aaa', marginBottom: '30px' }}>
                    {step === 1 ? "Solve to proceed." : "Final verification required."}
                </p>

                <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#fff', marginBottom: '20px', fontFamily: 'JetBrains Mono' }}>
                    {problem.q}
                </div>

                <form onSubmit={handleSubmit}>
                    <input
                        autoFocus
                        type="number"
                        className="modern-input"
                        style={{ fontSize: '1.5rem', textAlign: 'center', letterSpacing: '2px', marginBottom: '20px', borderColor: error ? 'red' : '' }}
                        placeholder="?"
                        value={input}
                        onChange={e => { setInput(e.target.value); setError(false); }}
                    />

                    <button type="submit" className="plan-start-btn" style={{ background: step === 1 ? '#ff4757' : '#D4AF37', color: step === 1 ? '#fff' : '#000', border: 'none' }}>
                        {step === 1 ? "UNLOCK NEXT" : "EXIT SESSION"}
                    </button>
                    <div style={{ marginTop: '15px', fontSize: '0.8rem', color: '#666', cursor: 'pointer', textDecoration: 'underline' }} onClick={onCancel}>
                        Return to Focus
                    </div>
                </form>
            </div>
        </div>
    );
}
