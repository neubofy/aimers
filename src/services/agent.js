/**
 * Aimers OS - Smart Agent Service (Token Optimized & Robust Parsing)
 */

import { callApi } from "./api"; // Import API for Live Backend Access

const AI_MODEL = "openai/gpt-oss-120b";

// TOOL OMNI-AGENT SYSTEM PROMPT
const SYSTEM_PROMPT = `You are AIMERS OS, the ultimate productivity intelligence.

### EXPERT CLOCK MANAGEMENT PROTOCOL (CRITICAL)
You are the **MASTER** of the Timer. You have direct control over the backend tools.
1. **CHECK STATE FIRST**: Always READ 'timer' or 'live' before ordering a command.
2. **STARTING (start)**: 
   - **Syntax**: {"t":"start", "cat":"Subject", "min":N}
   - *Example*: "Start Chemistry for 90 mins" -> {"t":"start", "cat":"Chemistry", "min":90}
   - *Rule*: If RUNNING, ask to STOP first.
   - *Rule*: If PAUSED, ask to RESUME or RESET.
3. **PAUSING (pause)**:
   - **Syntax**: {"t":"pause", "min":N, "sec":S}
   - *Example*: "Take 5 min break" -> {"t":"pause", "min":5}
   - *Example*: "Pause for 30 seconds" -> {"t":"pause", "min":0, "sec":30}
   - *Rule*: Only valid if RUNNING.
4. **RESUMING (resume)**:
   - **Syntax**: {"t":"resume"}
   - *Rule*: Only valid if PAUSED.
5. **STOPPING (stop)**:
   - **Syntax**: {"t":"stop"}
   - *Effect*: Ends session and SAVES log to database. Use when task is DONE.
6. **RESETTING (reset)**:
   - **Syntax**: {"t":"reset"}
   - *Effect*: Cancels session, NO log saved. Use for mistakes.
7. **MANUAL LOG (add)**:
   - **Syntax**: {"t":"add", "cat":"Subject", "min":N}
   - *Effect*: Adds a past session directly to logs without running timer.
8. **COMPLETING TASKS (completeTask)**:
   - **Syntax**: {"t":"completeTask", "id":"TASK_ID", "listId":"LIST_ID"}
   - *Effect*: Marks a Google Task as completed.
   - *Workflow*: User says "I finished Math HW" -> You READ "tasks" -> Find matching ID -> Output Command.

### DATA ACCESS GUIDE
- **"live"**: **GLOBAL STATE**. Status, Active Timer, Notifications.
- **"stats"**: XP, Level, Streak.
- **"history"**: 7-day performance & Today's Plan.
- **"tasks"**: Task List.
- **"schedule"**: Calendar Events.
- **"logs"**: Today's Sessions.
- **"timer"**: Detailed Timer State.
- **"prediction"**: XP Breakdown & Forecast.
- **"journal"**: Personal Reflections (Motivation/Planning).

### INTENT CLASSIFICATION (STRICT)
**PROTOCOL**: First, silently analyze if the user wants to ACTION (Change State) or KNOW (Read Data).
1. **COMMANDS** (State Change):
   - Keywords: "Start", "Begin", "Track", "Log", "Resume", "Stop".
   - *Action*: Use 'start', 'add', 'stop' tools.
   - *Example*: "Start Physics" -> {"t":"start", "cat":"Physics", "min":90}

2. **QUERIES** (Data Retrieval):
   - Keywords: "How is", "Show", "Analyze", "What", "Summarize".
   - *Action*: Use 'read' tools. **NEVER START A TIMER**.
   - *Example*: "Analyze my Physics performance" -> {"t":"read", "k":"history"} (NO START COMMAND)
   - *Example*: "I have a problem with Physics" -> {"t":"read", "k":"stats"} or just advice.

### SCENARIO LOGIC
- **"Status"** -> {"t":"read", "k":"live"} -> Analyze active timer/alerts.
- **"Start math"** -> {"t":"start", "cat":"Math", "min":60}
- **"How is my Math?"** -> {"t":"read", "k":"stats"} (Just Read)
- **"Take a 5 min break"** -> {"t":"pause", "min":5}
- **"I'm back"** / **"Continue"** -> {"t":"resume"}
- **"Finish this"** / **"Done"** -> {"t":"stop"}
- **"Cancel this"** / **"Mistake"** -> {"t":"reset"}
- **"I studied Physics for 2 hours earlier"** -> {"t":"add", "cat":"Physics", "min":120}
- **"Start History from calendar"** -> {"t":"cal_start", "q":"History"}
- **"Mark Math HW as done"** -> {"t":"read", "k":"tasks"} -> (Find ID) -> {"t":"completeTask", "id":"...", "listId":"..."}

### OUTPUT FORMAT
- **STRUCTURE**: Use Markdown. Use '###' for headers, '-' for lists, '**' for emphasis.
- **TONE**: Helpful, Mentor-like.
- **LOGIC**: If multiple actions, output multiple JSON blocks.
- **END**: Always END with the JSON command(s).
`;

export class Agent {
    constructor(apiKey, contextProvider) {
        this.apiKey = apiKey;
        this.contextProvider = contextProvider;
        const saved = localStorage.getItem("aimers_memory");
        this.history = saved ? JSON.parse(saved) : [{ role: 'system', content: 'SYSTEM ONLINE' }];
    }

    saveMemory() {
        if (this.history.length > 10) this.history = this.history.slice(-10);
        localStorage.setItem("aimers_memory", JSON.stringify(this.history));
    }

    clearMemory() {
        this.history = [{ role: 'system', content: 'SYSTEM ONLINE' }];
        localStorage.removeItem("aimers_memory");
    }

    updateKey(key) { this.apiKey = key; }

    // Multi-Turn Chat Loop
    async chat(userText, depth = 0, onLog = null) {
        if (!this.apiKey) return { text: "API Key missing.", command: null };
        if (depth > 5) return { text: "I'm having trouble retrieving that. Let's try again.", command: null };

        if (depth === 0) this.history.push({ role: 'user', content: userText });

        const nowIST = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "full", timeStyle: "medium" });
        const messages = [
            { role: 'system', content: this.systemPrompt + `\n\n[CURRENT TIME (IST): ${nowIST}]` },
            ...this.history.slice(-5)
        ];

        // Hack to access SYSTEM_PROMPT from class scope if needed, or just use global variable if in same file. 
        // Since SYSTEM_PROMPT is const outside class, we use it directly. 
        // Correcting the message construction:
        messages[0].content = SYSTEM_PROMPT + `\n\n[CURRENT TIME (IST): ${nowIST}]`;

        try {
            const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({ model: AI_MODEL, messages: messages, temperature: 0.2, max_tokens: 1500 })
            });

            const resJson = await res.json();
            if (resJson.error) throw new Error(resJson.error.message);

            const aiContent = resJson.choices[0]?.message?.content || "";
            let displayText = aiContent;
            let commands = [];

            const rawMatches = [...aiContent.matchAll(/\{[\s\S]*?\}/g)];
            if (rawMatches.length > 0) {
                commands = rawMatches
                    .map(m => { try { return JSON.parse(m[0]); } catch (e) { return null; } })
                    .filter(c => c && c.t);

                rawMatches.forEach(m => {
                    try { if (JSON.parse(m[0]).t) displayText = displayText.replace(m[0], ""); } catch (e) { }
                });
            }

            displayText = displayText.replace(/\{[\s\S]*?\}/g, "").trim();

            const readCmds = commands.filter(c => c.t === 'read');
            const actionCmds = commands.filter(c => c.t !== 'read');

            if (readCmds.length > 0) {
                let observations = [];

                for (const rc of readCmds) {
                    try {
                        let data = null;
                        let endpoint = "";

                        // Notify UI
                        if (onLog) onLog(`🔄 Connecting to Neural Core for [${rc.k.toUpperCase()}]...`);

                        // GRANULAR API FETCHING
                        switch (rc.k) {
                            case 'live': endpoint = "getAgentContext"; break;
                            case 'stats': endpoint = "stats_only"; break; // Optimized
                            case 'prediction': endpoint = "prediction_chunk"; break; // New
                            case 'journal': endpoint = "journal_chunk"; break; // New
                            case 'history': endpoint = "history_chunk"; break; // Optimized (Graph)
                            case 'tasks': endpoint = "tasks"; break;
                            case 'schedule': endpoint = "scheduleToday"; break;
                            case 'logs': endpoint = "today"; break;
                            case 'timer': endpoint = "getState"; break;
                            default: endpoint = ""; break;
                        }

                        if (endpoint) {
                            data = await callApi(endpoint);
                            observations.push(`[API DATA: ${rc.k.toUpperCase()}]\n${JSON.stringify(data, null, 2)}`);
                        } else {
                            // Fallback to local state if unknown key (shouldn't happen often)
                            const localData = this.contextProvider();
                            const val = this.fetchDataSubset(localData, rc.k);
                            observations.push(`[LOCAL DATA: ${rc.k.toUpperCase()}]\n${JSON.stringify(val, null, 2)}`);
                            data = val; // Use local data for summary
                        }

                        // Notify Success with DETAILED SUMMARY
                        if (onLog) {
                            const summary = this.summarizeData(rc.k, data);
                            onLog(`✅ ${summary}`);
                        }

                    } catch (e) {
                        if (onLog) onLog(`❌ Error Fetching ${rc.k}: ${e.message}`);
                        observations.push(`[ERROR FETCHING ${rc.k}]: ${e.message}`);
                    }
                }

                this.history.push({ role: 'assistant', content: aiContent });
                this.history.push({ role: 'system', content: observations.join("\n\n") + "\n\n[SYSTEM: Data retrieved. Perform actions or answer now.]" });

                return this.chat("", depth + 1, onLog);
            }

            this.history.push({ role: 'assistant', content: aiContent });
            this.saveMemory();

            return { text: displayText, commands: actionCmds };

        } catch (e) {
            return { text: `Error: ${e.message}`, command: null };
        }
    }

    // Helper for formatting local data if needed (legacy support)
    fetchDataSubset(d, key) {
        if (!d) return {};
        // ... (Existing subset logic if needed, but primary path is now API)
        return { info: "Use specific keys for live data." };
    }

    // Generate Human-Readable Summary of Fetched Data
    summarizeData(key, data) {
        if (!data) return `Fetched ${key.toUpperCase()} (Empty)`;

        try {
            switch (key) {
                case 'tasks':
                    if (Array.isArray(data)) {
                        const pending = data.filter(t => t.status !== 'completed');
                        return `Tasks: ${pending.length} Pending. Top: ${pending.slice(0, 3).map(t => t.title).join(', ')}`;
                    }
                    return "Tasks: Data format unknown";

                case 'schedule':
                    if (Array.isArray(data)) {
                        return `Calendar: ${data.length} Events. Next: ${data[0]?.title || 'None'}`;
                    }
                    return "Calendar: No events found";

                case 'logs':
                case 'today':
                    if (Array.isArray(data)) {
                        const totalMins = data.reduce((a, b) => a + (b.minutes || 0), 0);
                        return `Logs: ${data.length} Sessions (${totalMins}m Total).`;
                    }
                    return "Logs: No data";

                case 'stats':
                case 'dashboard':
                    let statsMsg = `Stats: Lvl ${data.level || '?'}, XP ${data.xp || 0}, Streak ${data.streak || 0}🔥`;
                    return statsMsg;

                case 'journal':
                    // Format Journal Entries
                    if (data.journal && data.journal.length > 0) {
                        return `Journal (Last 7 Days):\n` + data.journal.map(j => `- [${j.date}]: "${j.note.substring(0, 150)}..."`).join('\n');
                    }
                    return "Journal: No recent entries.";

                case 'live':
                    return `Live Context: Timer ${data.timer?.running ? 'RUNNING' : 'STOPPED'} (${data.notifications?.length || 0} Alerts)`;

                case 'history':
                    return `History: 7-Day Performance Loaded.`;

                default:
                    return `Fetched ${key.toUpperCase()} Data.`;
            }
        } catch (e) {
            return `Fetched ${key.toUpperCase()} (Parse Error)`;
        }
    }
}
