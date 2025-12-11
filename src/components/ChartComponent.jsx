import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

export default function ChartComponent({ data }) {
    const chartRef = useRef(null);
    const chartInstance = useRef(null);

    useEffect(() => {
        if (!chartRef.current || !data) return;
        if (chartInstance.current) chartInstance.current.destroy();

        const ctx = chartRef.current.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
        gradient.addColorStop(0, 'rgba(79, 172, 254, 0.5)');
        gradient.addColorStop(1, 'rgba(79, 172, 254, 0)');

        chartInstance.current = new Chart(chartRef.current, {
            type: 'line',
            data: {
                labels: data.map(d => d.date.slice(5)),
                datasets: [{
                    label: 'Minutes',
                    data: data.map(d => d.total),
                    borderColor: '#4facfe',
                    backgroundColor: gradient,
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888' } },
                    x: { grid: { display: false }, ticks: { color: '#888' } }
                }
            }
        });

        return () => { if (chartInstance.current) chartInstance.current.destroy(); };
    }, [data]);

    return <canvas ref={chartRef} />;
}
