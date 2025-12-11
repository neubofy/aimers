export function formatTime(s) {
    const m = Math.floor(s / 60);
    const sc = s % 60;
    return (m < 10 ? "0" + m : m) + ":" + (sc < 10 ? "0" + sc : sc);
}
