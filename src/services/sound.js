export const Sound = {
    ctx: null,
    init: () => {
        if (!Sound.ctx) Sound.ctx = new (window.AudioContext || window.webkitAudioContext)();
    },
    play: (type) => {
        if (!Sound.ctx) Sound.init();
        if (Sound.ctx.state === 'suspended') Sound.ctx.resume();
        const t = Sound.ctx.currentTime;
        const osc = Sound.ctx.createOscillator();
        const gain = Sound.ctx.createGain();
        osc.connect(gain);
        gain.connect(Sound.ctx.destination);

        if (type === 'click') {
            osc.frequency.setValueAtTime(800, t);
            osc.frequency.exponentialRampToValueAtTime(1200, t + 0.05);
            gain.gain.setValueAtTime(0.1, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
            osc.start(t);
            osc.stop(t + 0.05);
        } else if (type === 'start') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(220, t);
            osc.frequency.exponentialRampToValueAtTime(660, t + 0.4);
            gain.gain.setValueAtTime(0.1, t);
            gain.gain.linearRampToValueAtTime(0, t + 0.4);
            osc.start(t);
            osc.stop(t + 0.4);
        }
    }
};
