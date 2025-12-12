import React, { useState, useEffect } from 'react';

export default function LiveBackground() {
    const [particles, setParticles] = useState([]);
    useEffect(() => {
        const p = [];
        for (let i = 0; i < 40; i++) {
            p.push({
                top: Math.random() * 100 + '%',
                left: Math.random() * 100 + '%',
                size: Math.random() * 3 + 1 + 'px',
                duration: Math.random() * 20 + 10 + 's',
                delay: Math.random() * -20 + 's'
            });
        }
        setParticles(p);
    }, []);

    return (
        <div className="space-bg">
            <div className="overlay-gradient"></div>
            {particles.map((p, i) => (
                <div key={i} className="gold-particle" style={{
                    top: p.top,
                    left: p.left,
                    width: p.size,
                    height: p.size,
                    animationDuration: p.duration,
                    animationDelay: p.delay
                }}></div>
            ))}
        </div>
    );
}
