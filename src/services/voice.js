export const Voice = {
    synth: window.speechSynthesis,
    rec: window.webkitSpeechRecognition ? new window.webkitSpeechRecognition() : null,
    speak: (text) => {
        if (!Voice.synth) return;
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.1; u.pitch = 1;
        Voice.synth.speak(u);
    }
};
