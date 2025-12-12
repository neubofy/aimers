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
import MathModal from './components/modals/MathModal';
import { callApi } from './services/api';
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
    const [chatHistory, setChatHistory] = useState(() => {
        const saved = localStorage.getItem("aimers_chat_ui");
        return saved ? JSON.parse(saved) : [{ role: "system", content: "OS Online." }];
    });
    const [aiThinking, setAiThinking] = useState(false);
    const [listening, setListening] = useState(false);

    // Persist Chat History
    useEffect(() => {
        localStorage.setItem("aimers_chat_ui", JSON.stringify(chatHistory));
    }, [chatHistory]);

    // PWA INSTALLATION
    const [installPrompt, setInstallPrompt] = useState(null);
    useEffect(() => {
        const handler = (e) => {
            e.preventDefault();
            setInstallPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);

        // Request Notification Permission
        if ("Notification" in window && Notification.permission !== "granted") {
            Notification.requestPermission();
        }

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!installPrompt) return;
        installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        if (outcome === 'accepted') setInstallPrompt(null);
    };

    const lastSync = useRef(0);

    useEffect(() => {
        if (auth) refreshFull();
        const i = setInterval(() => { if (!document.hidden) refreshState(); if (st.running) refreshFull(); }, 300000);
        return () => clearInterval(i);
    }, [auth]);

    // BROWSER HISTORY & SHORTCUTS
    useEffect(() => {
        if (modal) {
            // Only push if the current history state doesn't match the new modal
            // This prevents pushing a new state when we arrived here via Back/Forward button
            if (window.history.state?.modal !== modal) {
                window.history.pushState({ modal }, "", window.location.pathname);
            }
        }

        const handlePopState = (e) => {
            // Restore modal from history state (or close if null)
            setModal(e.state?.modal || null);
        };

        const handleKeyDown = (e) => {
            if (e.ctrlKey && e.code === 'Space') {
                e.preventDefault();
                setModal('mentor');
                setTimeout(toggleVoice, 300);
            }
        };

        window.addEventListener('popstate', handlePopState);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('popstate', handlePopState);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [modal]);

    // ACTION QUEUE SYSTEM
    const actionQueue = useRef([]);
    const isProcessing = useRef(false);

    const processQueue = async () => {
        if (isProcessing.current || actionQueue.current.length === 0) return;

        isProcessing.current = true;

        while (actionQueue.current.length > 0) {
            const { action, params, resolve, reject } = actionQueue.current.shift();

            try {
                // UI OPTIMISTIC UPDATES (Immediate Feedback)
                // SILENT MODE: No Sound
                if (action !== 'reset') { setSync("active"); /* Sound.play('click'); */ }

                if (action === 'start' && st.running) {
                    alert("Session already active!");
                    // continue to next? or stop? usually stop this specific action
                }
                else if (action === 'start') {
                    setSt({ running: true, paused: false, startTime: Date.now(), category: params.category || 'Focus', target: params.target || 120 });
                    setModal(null);
                }
                else if (action === 'stop') { setSt({ ...st, running: false }); setElapsed(0); }
                else if (action === 'reset') {
                    setSt({ running: false, paused: false, startTime: null, category: 'Focus', target: 120 });
                    setElapsed(0); setPauseLeft(120); setSync("active");
                }
                else if (action === 'pause') {
                    const now = Date.now();
                    const dbo = params.seconds ? params.seconds * 1000 : (params.minutes ? params.minutes * 60000 : 120000);
                    setSt({ ...st, running: true, paused: true, pauseStart: now, pauseExpiry: now + dbo });
                }
                else if (action === 'resume') setSt({ ...st, running: true, paused: false });
                else if (action === 'completeTask') setTasks(prev => prev.map(t => t.id === params.id ? { ...t, status: 'completed' } : t));

                // ACTUAL API SYNC
                const res = await callApi(action, params);

                if (res.error === "SESSION_ACTIVE") {
                    alert("Sync Error: Session already running on another device.");
                    await refreshState();
                } else {
                    if (['stop', 'reset', 'add', 'completeTask'].includes(action)) await refreshFull();
                    else await refreshState();
                }

                resolve(res);

            } catch (e) {
                setSync("");
                console.error("API FAIL:", e);
                reject(e);
            }
        }

        setSync("");
        isProcessing.current = false;
    };

    const act = (a, p = {}) => {
        return new Promise((resolve, reject) => {
            actionQueue.current.push({ action: a, params: p, resolve, reject });
            processQueue();
        });
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
            // Fetch Standard Data + Agent Context (for Notifications)
            const [s, t, d, sch, l, ctx] = await Promise.all([
                callApi("getState"),
                callApi("tasks"),
                callApi("dashboard"),
                callApi("scheduleToday"),
                callApi("today"),
                callApi("getAgentContext")
            ]);

            setSt(s); setTasks(t || []); setDash(d); setSchedule(sch || []); setTodayLog(l || []);
            setSync("");

            // HANDLE NOTIFICATIONS
            if (ctx && ctx.notifications && ctx.notifications.length > 0) {
                ctx.notifications.forEach(n => {
                    // Only notify for action-oriented or high-value alerts to avoid spam
                    // 'motivation' is good too if rigorous.
                    // Prevent duplicate spam? Browser handles some, but we pull every 5m.
                    // Simple check: Notification.permission
                    if ("Notification" in window && Notification.permission === "granted") {
                        if (['action', 'warning', 'success', 'motivation'].includes(n.type)) {
                            new Notification(`AIMERS OS: ${n.type.toUpperCase()}`, {
                                body: n.msg,
                                icon: '/icon-192.png' // Assuming icon exists
                            });
                        }
                    }
                });
            }

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

    // Keep a Ref updated with latest state for the Agent to access "live"
    const stateRef = useRef({ st, tasks, schedule, todayLog, dash });
    useEffect(() => {
        stateRef.current = { st, tasks, schedule, todayLog, dash };
    }, [st, tasks, schedule, todayLog, dash]);

    // Initialize agent on mount or key change
    useEffect(() => {
        const initAgent = async () => {
            const { Agent } = await import('./services/agent');
            // Context Provider now reads from stateRef.current (Fresh Data!)
            agentRef.current = new Agent(groqKey, () => stateRef.current);
        };

        if (!agentRef.current && groqKey) {
            initAgent();
        } else if (agentRef.current) {
            agentRef.current.updateKey(groqKey);
        }
    }, [groqKey]);

    // EARLY EXIT GUARD
    // EARLY EXIT GUARD
    const handleStopRequest = async () => {
        // Strict guard: applies if session exists (running or paused)
        if (st.running) {
            const targetMins = st.target && st.target > 0 ? st.target : 120;
            const targetSeconds = targetMins * 60;

            // Check if elapsed < target
            // Note: 'elapsed' in state might reset on pause? Check logic.
            // st.startTime exists.

            // If paused, we need to account for paused duration vs actual progress?
            // Actually, we just care if we reached the goal.
            // But 'elapsed' state logic in App.jsx:
            // if paused, elapsed is not updating? 
            // We should compare 'elapsed' (which is tracked progress) vs target.

            // Safer check:
            if (elapsed < targetSeconds) {
                // Trigger Challenge
                setModal('math-challenge');
                return;
            }
        }
        // Otherwise, normal stop
        await act("stop");
    };

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
        // Handle Response
        if (response.text) {
            // FILTER OUT JSON ARTIFACTS COMPLETELY from user view
            const cleanText = response.text.replace(/```json[\s\S]*?```/g, "").trim();
            if (cleanText) {
                setChatHistory(prev => [...prev, { role: "assistant", content: cleanText }]);
                // SILENT AI: No Voice
                // Voice.speak(cleanText);
            }
        }

        // Execute Commands Silently (No Toast)
        const cmds = response.commands || (response.command ? [response.command] : []);

        if (cmds.length > 0) {
            console.log("Agent Commands:", cmds);

            // OPTIMIZATION: Check for multiple completions and run them in parallel
            const completions = cmds.filter(c => (c.tool || c.t) === "complete");
            const others = cmds.filter(c => (c.tool || c.t) !== "complete");

            // 1. Handle Bulk Completions First (Parallel)
            if (completions.length > 0) {
                setChatHistory(prev => [...prev, { role: "system", content: `> Completing ${completions.length} tasks...` }]);

                // Using Promise.all for speed, skipping 'act' wrapper to avoid multi-refresh
                await Promise.all(completions.map(cmd => callApi("completeTask", { id: cmd.id, listId: cmd.listId || cmd.lid }).catch(e => console.error(e))));

                // Update Local State Optimistically
                setTasks(prev => prev.map(t => {
                    const matched = completions.find(c => c.id === t.id);
                    return matched ? { ...t, status: 'completed' } : t;
                }));

                // Single Sync at the end
                refreshFull();
            }

            // 2. Handle Others Sequentially
            for (const cmd of others) {
                try {
                    const tool = cmd.tool || cmd.t;

                    // Enhanced Logging
                    let logMsg = `> Executing: ${tool}`;
                    if (tool === 'start') logMsg = `> Starting '${cmd.category || cmd.cat || 'Focus'}' (${cmd.minutes || cmd.min || cmd.target || 120}m)`;
                    else if (tool === 'cal_start') logMsg = `> Syncing '${cmd.query || cmd.q}' from Calendar...`;
                    else if (tool === 'stop') logMsg = `> Stopping session & logging time.`;
                    else if (tool === 'pause') {
                        const m = cmd.minutes || cmd.min || 0;
                        const s = cmd.seconds || cmd.sec || 0;
                        logMsg = `> Pausing for ${m > 0 ? m + 'm ' : ''}${s > 0 ? s + 's' : ''}`;
                    }
                    else if (tool === 'resume') logMsg = `> Resuming session...`;
                    else if (tool === 'web_search') logMsg = `> Searching web for '${cmd.query || cmd.q}'...`;
                    else if (tool === 'nav') logMsg = `> Opening ${cmd.view || cmd.v} view`;
                    else if (tool === 'log') logMsg = `> Logging ${cmd.minutes || cmd.min}m to '${cmd.category || cmd.cat}'`;

                    setChatHistory(prev => [...prev, { role: "system", content: logMsg }]);
                    await new Promise(r => setTimeout(r, 500));

                    if (tool === "nav") {
                        let v = (cmd.view || cmd.v || "").toLowerCase();
                        if (v.includes("cal") || v.includes("sched")) v = "plan";
                        setModal(v);
                    }
                    else if (tool === "start") { await act("start", { category: cmd.category || cmd.cat, target: cmd.minutes || cmd.min || cmd.target }); }
                    else if (tool === "cal_start") { await act("startFromCalendar", { query: cmd.query || cmd.q }); }
                    else if (tool === "stop") { await act("stop"); }
                    else if (tool === "pause") { await act("pause", { minutes: cmd.minutes || cmd.min, seconds: cmd.seconds || cmd.sec }); }
                    else if (tool === "resume") {
                        // OPTIMISTIC UPDATE: Shift Start Time locally to avoid jump
                        if (st.pauseStart) {
                            const pauseDuration = Date.now() - st.pauseStart;
                            setSt(prev => ({ ...prev, running: true, paused: false, startTime: prev.startTime + pauseDuration }));
                        }
                        await act("resume");
                    }
                    else if (tool === "reset") { await act("reset"); }
                    else if (tool === "log") { await act("add", { minutes: cmd.minutes || cmd.min, category: cmd.category || cmd.cat }); }
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
    const clearChat = () => {
        setChatHistory([{ role: "system", content: "Chat Cleared." }]);
        if (agentRef.current) agentRef.current.clearMemory();
    };

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

    const goBack = () => window.history.back();

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

            {/* GLOBAL APP HEADER */}
            {!pip && (
                <div className="app-header" style={{
                    position: 'fixed', top: 0, left: 0, right: 0,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '16px 24px', zIndex: 100,
                    background: 'rgba(0, 0, 0, 0.4)',
                    backdropFilter: 'blur(12px)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                    <div className="header-left">
                        <span style={{ fontSize: "1.1rem", fontWeight: 700, letterSpacing: 1, color: '#fff', opacity: 0.9 }}>AIMERS OS</span>
                    </div>

                    <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {/* SYNC BUTTON */}
                        <button className="header-btn gold" onClick={refreshFull} title="Sync">
                            <i className={`fas fa-sync-alt ${sync === 'active' ? 'spin' : ''}`}></i>
                            <span>SYNC</span>
                        </button>

                        {/* PIP BUTTON */}
                        <button className="header-btn" onClick={togglePiP} title="Pop Out">
                            <span>⤢</span>
                            <span>POP OUT</span>
                        </button>

                        {/* LOGOUT BUTTON */}
                        <button className="header-btn danger" onClick={handleLogout} title="Logout">
                            <i className="fas fa-power-off"></i>
                            <span>EXIT</span>
                        </button>
                    </div>
                </div>
            )}

            {pip ? createPortal(
                <TimerCard st={st} sync={sync} elapsed={elapsed} pauseLeft={pauseLeft} act={act} onPop={togglePiP} isPopped={true} openStartModal={() => setModal('start-selector')} onStopRequest={handleStopRequest} />,
                pip.document.body
            ) : (
                <div style={{ marginTop: 60 }}>
                    <TimerCard
                        st={st} sync={sync} elapsed={elapsed} pauseLeft={pauseLeft} act={act}
                        onPop={togglePiP} isPopped={false} addMins={addMins}
                        setAddMins={setAddMins} openStartModal={() => setModal('start-selector')}
                        onLogout={handleLogout}
                        installPrompt={installPrompt} onInstall={handleInstall}
                        onStopRequest={handleStopRequest}
                    />
                </div>
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
                    <div className="app-icon" data-label="AI Mentor" style={{ border: "1px solid #D4AF37", boxShadow: "0 0 10px rgba(212, 175, 55, 0.2)" }} onDoubleClick={handleAiIconDouble} onClick={() => handleTabClick('mentor')}>
                        <div style={{ fontSize: "1.3rem" }}>🤖</div>
                        <div className="icon-val" style={{ color: "#D4AF37" }}>MENTOR</div>
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
                        {modal === 'mentor' && <MentorModal groqKey={groqKey} chatHistory={chatHistory} aiThinking={aiThinking} listening={listening} msgInput={msgInput} setMsgInput={setMsgInput} saveGroqKey={saveGroqKey} clearChat={clearChat} resetGroqKey={resetGroqKey} toggleVoice={toggleVoice} sendToMentor={sendToMentor} syncData={refreshFull} />}
                        {modal === 'start-selector' && <StartSelectorModal bestSuggestion={bestSuggestion} act={act} customTarget={customTarget} setCustomTarget={setCustomTarget} />}
                        {modal === 'plan' && <PlanModal schedule={schedule} st={st} act={act} setModal={setModal} />}
                        {modal === 'stats' && <StatsModal dash={dash} />}
                        {modal === 'tasks' && <TasksModal tasks={tasks} taskTab={taskTab} setTaskTab={setTaskTab} act={act} />}
                        {modal === 'log' && <LogModal todayLog={todayLog} />}
                        {modal === 'math-challenge' && <MathModal onSuccess={() => { setModal(null); act("stop"); }} onCancel={() => setModal(null)} />}
                    </div>
                </div>
            )
            }
        </div >
    );
}

export default App;
