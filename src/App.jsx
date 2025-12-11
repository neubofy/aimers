import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import LiveBackground from './components/LiveBackground';
import TimerCard from './components/TimerCard';
import StatsModal from './components/modals/StatsModal';
import TasksModal from './components/modals/TasksModal';
import PlanModal from './components/modals/PlanModal';
import LogModal from './components/modals/LogModal';
import MentorModal from './components/modals/MentorModal';
import StartSelectorModal from './components/modals/StartSelectorModal';
import { callApi } from './services/api';
import { Sound } from './services/sound';
import { Voice } from './services/voice';

const AI_MODEL = "openai/gpt-oss-120b";

function App() {
    const [auth, setAuth] = useState(!!localStorage.getItem("aimers_key"));
    const [groqKey, setGroqKey] = useState(localStorage.getItem("aimers_groq") || "");
    const [st, setSt] = useState({ running: false, startTime: null, paused: false, target: 120 });
    const [dash, setDash] = useState({ stats: { level: 0, streak: 0, totalXP: 0, plannedMinutes: 0 }, prediction: { xp: 0, breakdown: { study: 0, task: 0, bonus: 0 } }, history: [] });
    const [tasks, setTasks] = useState([]);
    const [schedule, setSchedule] = useState([]);
    const [todayLog, setTodayLog] = useState([]);

    const [elapsed, setElapsed] = useState(0);
    const [pauseLeft, setPauseLeft] = useState(120);
    const [modal, setModal] = useState(null);
    const [taskTab, setTaskTab] = useState('Study');
    const [sync, setSync] = useState("");
    const [addMins, setAddMins] = useState("");
    const [pip, setPip] = useState(null);
    const [customTarget, setCustomTarget] = useState(120);
    const [passInput, setPassInput] = useState("");
    const [cmdToast, setCmdToast] = useState("");

    // CHAT & VOICE
    const [msgInput, setMsgInput] = useState("");
    const [chatHistory, setChatHistory] = useState([{ role: "system", content: "OS Online." }]);
    const [aiThinking, setAiThinking] = useState(false);
    const [listening, setListening] = useState(false);

    const lastSync = useRef(0);

    useEffect(() => {
        if (auth) refreshFull();
        const i = setInterval(() => { if (!document.hidden) refreshState(); if (st.running) refreshFull(); }, 300000);
        return () => clearInterval(i);
    }, [auth]);

    // SHORTCUTS
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey && e.code === 'Space') {
                e.preventDefault();
                setModal('mentor');
                setTimeout(toggleVoice, 300);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [listening]);

    const act = async (a, p = {}) => {
        if (['start', 'stop', 'pause', 'add', 'completeTask'].includes(a)) {
            const cmdName = a === 'add' ? 'LOG' : a.toUpperCase();
            const cmdDetail = p.category ? ` ${p.category}` : (p.title ? ` ${p.title}` : '');
            setCmdToast(`CMD: ${cmdName}${cmdDetail}`);
            setTimeout(() => setCmdToast(""), 4000);
        }
        if (a !== 'reset') { setSync("active"); Sound.play('click'); }
        if (a === 'start' && st.running) return alert("Session already active!");
        if (a === 'start') { Sound.play('start'); setSt({ running: true, paused: false, startTime: Date.now(), category: p.category || 'Focus', target: p.target || 120 }); setModal(null); }
        if (a === 'stop') { setSt({ ...st, running: false }); setElapsed(0); }
        if (a === 'reset') { Sound.play('click'); setSt({ running: false, paused: false, startTime: null, category: 'Focus', target: 120 }); setElapsed(0); setPauseLeft(120); setSync("active"); }
        if (a === 'pause') setSt({ ...st, running: true, paused: true, pauseExpiry: Date.now() + 120000 });
        if (a === 'resume') setSt({ ...st, running: true, paused: false });
        if (a === 'completeTask') setTasks(prev => prev.map(t => t.id === p.id ? { ...t, status: 'completed' } : t));

        try {
            const res = await callApi(a, p);
            if (res.error === "SESSION_ACTIVE") { alert("Sync Error: Session already running on another device."); refreshState(); }
            else { if (['stop', 'reset', 'add', 'completeTask'].includes(a)) refreshFull(); else refreshState(); }
        } catch (e) { setSync(""); console.error("API FAIL:", e); }
    };

    useEffect(() => {
        let interval = null;
        if (st.running && !st.paused) {
            if (st.startTime) interval = setInterval(() => { setElapsed(Math.floor((Date.now() - st.startTime) / 1000)); }, 1000);
        } else if (st.paused && st.pauseExpiry) {
            interval = setInterval(() => { setPauseLeft(Math.max(0, Math.floor((st.pauseExpiry - Date.now()) / 1000))); }, 1000);
        } else { setElapsed(0); }
        return () => clearInterval(interval);
    }, [st]);

    const refreshFull = async () => {
        setSync("active"); lastSync.current = Date.now();
        try {
            const [s, t, d, sch, l] = await Promise.all([callApi("getState"), callApi("tasks"), callApi("dashboard"), callApi("scheduleToday"), callApi("today")]);
            setSt(s); setTasks(t || []); setDash(d); setSchedule(sch || []); setTodayLog(l || []);
            setSync("");
        } catch (e) { setSync(""); if (e.message === "NO_KEY" || e.message.includes("Wrong")) handleLogout(); }
    };

    const refreshState = async () => { try { setSt(await callApi("getState")); } catch (e) { } };

    const toggleVoice = () => {
        if (!Voice.rec) return alert("Browser does not support Voice.");
        if (listening) { Voice.rec.stop(); setListening(false); }
        else {
            Voice.rec.start(); setListening(true);
            Voice.rec.onresult = (e) => {
                const text = e.results[0][0].transcript;
                setMsgInput(text);
                sendToMentor(text);
                setListening(false);
            };
            Voice.rec.onerror = () => setListening(false);
        }
    };

    const handleAiIconDouble = () => { setModal('mentor'); setTimeout(toggleVoice, 500); };

    // --- AGENT INTEGRATION ---
    // Initialize Agent ref (persists across renders)
    const agentRef = useRef(null);

    // Initialize agent on mount or key change
    useEffect(() => {
        if (!agentRef.current) {
            import('./services/agent').then(({ Agent }) => {
                agentRef.current = new Agent(groqKey,
                    // Context Provider
                    () => ({ st, tasks, schedule, todayLog, dash }),
                    // Action Handler (not used in Agent class internally yet, but good for future)
                    act
                );
            });
        } else {
            agentRef.current.updateKey(groqKey);
        }
    }, [groqKey, st, tasks, schedule, todayLog, dash]); // Update context refs if needed, or Agent fetches fresh via closure

    const sendToMentor = async (overrideText = null) => {
        const text = overrideText || msgInput;
        if (!text.trim()) return;

        // UI Updates
        setMsgInput("");
        setChatHistory(prev => [...prev, { role: "user", content: text }]);
        setAiThinking(true);

        if (!agentRef.current) {
            setChatHistory(prev => [...prev, { role: "system", content: "Agent initializing..." }]);
            setAiThinking(false);
            return;
        }

        // --- DELEGATE TO AGENT SERVICE ---
        // We pass a fresh context extractor to ensure it reads LATEST state
        agentRef.current.contextProvider = () => ({ st, tasks, schedule, todayLog, dash });

        const response = await agentRef.current.chat(text);

        // Handle Response
        if (response.text) {
            // FILTER OUT JSON ARTIFACTS COMPLETELY from user view
            const cleanText = response.text.replace(/```json[\s\S]*?```/g, "").trim();
            if (cleanText) {
                setChatHistory(prev => [...prev, { role: "assistant", content: cleanText }]);
                Voice.speak(cleanText);
            }
        }

        // Execute Commands Silently (No Toast)
        const cmds = response.commands || (response.command ? [response.command] : []);

        if (cmds.length > 0) {
            console.log("Agent Commands:", cmds);
            for (const cmd of cmds) {
                try {
                    const tool = cmd.tool || cmd.t;

                    // SILENT EXECUTION - No setCmdToast here
                    // Only log to system chat for transparency if needed, or keep it totally hidden
                    setChatHistory(prev => [...prev, {
                        role: "system",
                        content: `> Executing: ${tool}`
                    }]);

                    await new Promise(r => setTimeout(r, 500));

                    if (tool === "nav") {
                        let v = (cmd.view || cmd.v || "").toLowerCase();
                        if (v.includes("cal") || v.includes("sched")) v = "plan";
                        setModal(v);
                    }
                    else if (tool === "start") { await act("start", { category: cmd.category || cmd.cat, target: cmd.minutes || cmd.min || cmd.target }); }
                    else if (tool === "stop") { await act("stop"); }
                    else if (tool === "pause") { await act("pause"); }
                    else if (tool === "resume") { await act("resume"); }
                    else if (tool === "reset") { await act("reset"); }
                    else if (tool === "log") { await act("add", { minutes: cmd.minutes || cmd.min, category: cmd.category || cmd.cat }); }
                    else if (tool === "complete") { await act("completeTask", { id: cmd.id, listId: cmd.listId || cmd.lid }); }
                } catch (e) {
                    setChatHistory(prev => [...prev, { role: "system", content: `Error: ${e.message}` }]);
                }
            }
        }


        setAiThinking(false);
    };

    const handleTabClick = (tab) => { setModal(tab); if (Date.now() - lastSync.current > 60000) refreshFull(); };
    const handleLogout = () => { localStorage.removeItem("aimers_key"); setAuth(false); setPassInput(""); };
    const handleLogin = () => { if (passInput === "aimers2025") { localStorage.setItem("aimers_key", "aimers2025"); setAuth(true); } else { alert("Access Denied"); } };
    const saveGroqKey = (k) => { localStorage.setItem("aimers_groq", k); setGroqKey(k); };
    const resetGroqKey = () => { localStorage.removeItem("aimers_groq"); setGroqKey(""); setChatHistory(p => [...p, { role: "system", content: "KEY RESET." }]); };
    const clearChat = () => { setChatHistory([{ role: "system", content: "Chat Cleared." }]); };

    // KEYBOARD SHORTCUTS
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.altKey) {
                switch (e.key) {
                    case '1': setModal('stats'); break;
                    case '2': setModal('tasks'); break;
                    case '3': setModal('plan'); break;
                    case '4': setModal('log'); break;
                    case '5': setModal('mentor'); break;
                    case 'x': setModal(null); break; // Close
                }
            }
            if (e.key === 'Escape') setModal(null);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const togglePiP = async () => {
        if (pip) { pip.close(); return; }
        if (!window.documentPictureInPicture) return alert("Desktop Chrome Required");
        const w = await window.documentPictureInPicture.requestWindow({ width: 250, height: 250 });
        [...document.styleSheets].forEach(s => w.document.head.append(s.ownerNode.cloneNode(true)));
        w.document.body.className = "pip-mode"; w.addEventListener("pagehide", () => setPip(null)); setPip(w);
    };

    const goBack = () => setModal(null);

    if (!auth) return (
        <div style={{ height: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <LiveBackground />
            <div className="login-container">
                <h1 style={{ fontSize: "2.5rem", fontWeight: 800, letterSpacing: -2 }}>AIMERS OS</h1>
                <input className="login-input" type="password" placeholder="ENTER KEY" value={passInput} onChange={e => setPassInput(e.target.value)} />
                <button className="login-btn" onClick={handleLogin}>INITIALIZE</button>
            </div>
        </div>
    );

    const totalCompleted = tasks.filter(t => t.status === 'completed' && t.completedToday).length;
    const totalTasks = tasks.length;
    const totalPlanMins = dash.stats.plannedMinutes || 0;
    const totalDoneMins = schedule.reduce((a, b) => a + b.doneMins, 0);
    const bestSuggestion = schedule.find(s => s.isSuggested) || schedule.find(s => s.status === 'upcoming');

    return (
        <div className="layout">
            <div className={`loading-line ${sync === 'active' ? 'active' : ''}`}></div>
            <div className={`cmd-toast ${cmdToast ? 'show' : ''}`}>
                <i className="fas fa-terminal cmd-icon"></i> {cmdToast}
            </div>
            <LiveBackground />

            {pip ? createPortal(
                <TimerCard st={st} sync={sync} elapsed={elapsed} pauseLeft={pauseLeft} act={act} onPop={togglePiP} isPopped={true} openStartModal={() => setModal('start-selector')} />,
                pip.document.body
            ) : (
                <TimerCard st={st} sync={sync} elapsed={elapsed} pauseLeft={pauseLeft} act={act} onPop={togglePiP} isPopped={false} addMins={addMins} setAddMins={setAddMins} openStartModal={() => setModal('start-selector')} onLogout={handleLogout} />
            )}

            {!pip && (
                <div className="app-dock">
                    <div className="app-icon" data-label="Stats" onClick={() => handleTabClick('stats')}>
                        <div style={{ fontSize: "1.3rem" }}>⚡</div>
                        <div className="icon-val">Stats</div>
                    </div>
                    <div className="app-icon" data-label="Tasks" onClick={() => handleTabClick('tasks')}>
                        <div style={{ fontSize: "1.3rem" }}>✅</div>
                        <div className="icon-val">{totalCompleted}/{totalTasks}</div>
                    </div>
                    <div className="app-icon" data-label="Plan" onClick={() => handleTabClick('plan')}>
                        <div style={{ fontSize: "1.3rem" }}>📅</div>
                        <div className="icon-val">{totalDoneMins}/{totalPlanMins}m</div>
                    </div>
                    <div className="app-icon" data-label="Log" onClick={() => handleTabClick('log')}>
                        <div style={{ fontSize: "1.3rem" }}>📝</div>
                        <div className="icon-val">{todayLog.reduce((a, b) => a + b.minutes, 0)}m</div>
                    </div>
                    <div className="app-icon" data-label="AI Mentor" style={{ border: "1px solid #00ff41" }} onDoubleClick={handleAiIconDouble} onClick={() => handleTabClick('mentor')}>
                        <div style={{ fontSize: "1.3rem" }}>🧠</div>
                        <div className="icon-val" style={{ color: "#00ff41" }}>AI</div>
                    </div>
                </div>
            )}

            {modal && (
                <div className="page-container glass-page">
                    {/* BACK BUTTON HEADER */}
                    <div className="page-header">
                        <button onClick={goBack} className="back-btn">
                            <i className="fas fa-arrow-left"></i> BACK
                        </button>
                        <h2 className="page-title">
                            {modal === 'start-selector' ? "SELECT ACTIVITY" : modal.toUpperCase()}
                        </h2>
                        <div style={{ width: 60 }}></div> {/* Spacer for center alignment */}
                    </div>

                    <div className="page-content">
                        {modal === 'tasks' && (
                            <div className="tab-row">
                                <button className={`tab-btn ${taskTab === 'Study' ? 'active' : ''}`} onClick={() => setTaskTab('Study')}>Study</button>
                                <button className={`tab-btn ${taskTab === 'Lifestyle' ? 'active' : ''}`} onClick={() => setTaskTab('Lifestyle')}>Lifestyle</button>
                            </div>
                        )}

                        {/* PAGE CONTENT BODY */}
                        {modal === 'mentor' && <MentorModal groqKey={groqKey} chatHistory={chatHistory} aiThinking={aiThinking} listening={listening} msgInput={msgInput} setMsgInput={setMsgInput} saveGroqKey={saveGroqKey} clearChat={clearChat} resetGroqKey={resetGroqKey} toggleVoice={toggleVoice} sendToMentor={sendToMentor} />}
                        {modal === 'start-selector' && <StartSelectorModal bestSuggestion={bestSuggestion} act={act} customTarget={customTarget} setCustomTarget={setCustomTarget} />}
                        {modal === 'plan' && <PlanModal schedule={schedule} st={st} act={act} setModal={setModal} />}
                        {modal === 'stats' && <StatsModal dash={dash} />}
                        {modal === 'tasks' && <TasksModal tasks={tasks} taskTab={taskTab} setTaskTab={setTaskTab} act={act} />}
                        {modal === 'log' && <LogModal todayLog={todayLog} />}
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
