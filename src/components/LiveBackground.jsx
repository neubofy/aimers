import React, { useState, useEffect } from 'react';

export default function LiveBackground() {
    const [stars, setStars] = useState([]);
    useEffect(() => {
        const s = [];
        for (let i = 0; i < 30; i++)
            s.push({ top: Math.random() * 100 + '%', left: Math.random() * 100 + '%', animDelay: Math.random() * 5 + 's' });
        setStars(s);
    }, []);

    return (
        <div className="space-bg">
            <div className="nebula"></div>
            {stars.map((st, i) => (
                <div key={i} className="stars" style={{ top: st.top, left: st.left, animationDelay: st.animDelay }}></div>
            ))}
        </div>
    );
}
