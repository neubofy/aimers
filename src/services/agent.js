/**
 * Aimers OS - Smart Agent Service (Token Optimized & Robust Parsing)
 */


const AI_MODEL = "openai/gpt-oss-120b"; // Reverted to User Request (120B)
// const AI_MODEL = "llama3-8b-8192";


// TOOL OMNI-AGENT SYSTEM PROMPT
const SYSTEM_PROMPT = `You are AIMERS OS, an advanced, autonomous productivity agent.
Your goal is to BE HELPFUL and TAKE ACTION. Do not be passive.

### VITAL PROTOCOL
1. **NO DATA? READ IT.** You start with NO context. Read 'timer' or 'everything' first.
2. **SINGLE SESSION ONLY**: **NEVER** start a new timer if one is already "RUNNING" or "PAUSED". You MUST ask the user to "stop" or "reset" the current one first.
3. **USE "EVERYTHING"**: For general queries, read 'everything'.
4. **EXACT TITLES**: Use exact schedule titles for 'start' commands.

### TOOLS (JSON format)
- **Read Data**:
  - {"t":"read", "k":"timer"} -> Activity, Duration, Status.
  - {"t":"read", "k":"tasks"} -> Full Task List (Active & Done).
  - {"t":"read", "k":"schedule"} -> Calendar Events (Title, Time, Duration, DoneMins).
  - {"t":"read", "k":"stats"} -> XP, Level, History.
  - {"t":"read", "k":"logs"} -> Work Logs.
  - {"t":"read", "k":"everything"} -> **GET ALL DATA** (Recommended for complex queries).

- **Actions**:
  - {"t":"start", "cat":"Subject", "min":60} -> Start Timer. (Use EXACT schedule title for 'cat' if applicable).
  - {"t":"stop"} / {"t":"pause"} / {"t":"resume"} -> Timer Controls.
  - {"t":"log", "cat":"Subject", "min":30} -> Log past session.
  - {"t":"complete", "id":"TASK_ID", "lid":"LIST_ID"} -> Mark Task Done.
  - {"t":"nav", "v":"view_name"} -> Switch View (Use when context implies it).

### SCENARIO LOGIC
- **"Start studying math"** -> {"t":"start", "cat":"Math", "min":60} (Generic)
- **"Start my 9am session"** -> {"t":"read", "k":"schedule"} -> [Found "Deep Work: Coding"] -> {"t":"start", "cat":"Deep Work: Coding", "min":90} (Exact Match)
- **"What's next?"** -> {"t":"read", "k":"schedule"} AND {"t":"read", "k":"tasks"}
- **"How am I doing?"** -> {"t":"read", "k":"stats"}

### OUTPUT FORMAT
- Reply comfortably as a human.
- END with JSON commands.
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
    async chat(userText, depth = 0) {
        if (!this.apiKey) return { text: "API Key missing.", command: null };

        // Safety Break: Prevent infinite loops if AI keeps asking for data
        if (depth > 5) {
            return { text: "I'm having trouble retrieving that. Let's try again.", command: null };
        }

        // Add User Message only on first call
        if (depth === 0) {
            this.history.push({ role: 'user', content: userText });
        }

        // Prepare Conversation (Context Optimized: System + Last 5)
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...this.history.slice(-5)
        ];

        try {
            const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({ model: AI_MODEL, messages: messages, temperature: 0.2, max_tokens: 1000 })
            });

            const resJson = await res.json();
            if (resJson.error) throw new Error(resJson.error.message);

            const aiContent = resJson.choices[0]?.message?.content || "";
            let displayText = aiContent;
            let commands = [];

            // --- ROBUST COMMAND PARSING ---
            const rawMatches = [...aiContent.matchAll(/\{[\s\S]*?\}/g)];
            if (rawMatches.length > 0) {
                commands = rawMatches
                    .map(m => { try { return JSON.parse(m[0]); } catch (e) { return null; } })
                    .filter(c => c && c.t);

                rawMatches.forEach(m => {
                    try { if (JSON.parse(m[0]).t) displayText = displayText.replace(m[0], ""); } catch (e) { }
                });
            }

            // CLEANUP: AGGRESSIVE REMOVAL of any remaining JSON-like structures at the end
            displayText = displayText.replace(/\{[\s\S]*?\}/g, "").trim();

            // INTERNAL LOOP: Handle "read" commands immediately
            const readCmds = commands.filter(c => c.t === 'read');
            const actionCmds = commands.filter(c => c.t !== 'read');

            // If AI wants to read data, we fetch it and RECURSE SILENTLY
            if (readCmds.length > 0) {
                const data = this.contextProvider(); // Get fresh state
                let observations = [];

                for (const rc of readCmds) {
                    const val = this.fetchDataSubset(data, rc.k);
                    observations.push(`[DATA: ${rc.k.toUpperCase()}]\n${JSON.stringify(val, null, 2)}`);
                }

                this.history.push({ role: 'assistant', content: aiContent });
                this.history.push({ role: 'system', content: observations.join("\n\n") + "\n\n[SYSTEM: Data retrieved. Perform actions or answer now.]" });

                return this.chat("", depth + 1);
            }

            // FINAL RESPONSE
            if (depth === 0) {
                this.history.push({ role: 'assistant', content: aiContent });
                this.saveMemory();
            } else {
                this.history.push({ role: 'assistant', content: aiContent });
                this.saveMemory();
            }

            return { text: displayText, commands: actionCmds };

        } catch (e) {
            return { text: `Error: ${e.message}`, command: null };
        }
    }

    // SLICED DATA ACCESS (Token Efficient)
    fetchDataSubset(d, key) {
        const { st = {}, tasks = [], schedule = [], todayLog = [], dash = { stats: {}, prediction: {}, history: [] } } = d || {};

        // EVERYTHING OPTION
        if (key === 'everything' || key === 'all') {
            return {
                timer: { status: st.running ? 'RUNNING' : 'STOPPED', activity: st.category, duration: st.target, elapsed: st.startTime ? Math.floor((Date.now() - st.startTime) / 1000) : 0 },
                stats: { level: dash.stats.level, xp: dash.stats.totalXP, streak: dash.stats.streak, graph: dash.history },
                tasks: tasks.map(t => ({ id: t.id, title: t.title, status: t.status, list: t.listId, due: t.dueTime })),
                schedule: schedule.map(s => ({ title: s.title, time: s.startIso, duration: s.minutes, done: s.doneMins, status: s.status })),
                logs: todayLog
            };
        }

        if (key === 'timer') return { status: st.running ? 'RUNNING' : 'STOPPED', activity: st.category, duration: st.target, elapsed: st.startTime ? Math.floor((Date.now() - st.startTime) / 1000) : 0 };

        if (key === 'stats') {
            return {
                level: dash.stats.level,
                streak: dash.stats.streak,
                xp: dash.stats.totalXP,
                breakdown: dash.prediction.breakdown,
                history_7_days: dash.history || []
            };
        }

        if (key === 'schedule') {
            return schedule.map(s => ({
                title: s.title,
                time: s.startIso,
                duration: s.minutes,
                done: s.doneMins,
                status: s.status, // 'past', 'active', 'upcoming'
                is_completed: s.doneMins >= s.minutes
            }));
        }

        if (key === 'tasks') {
            return tasks.map(t => ({
                id: t.id,
                title: t.title,
                status: t.status,
                list_id: t.listId,
                due: t.dueTime
            }));
        }

        if (key === 'logs') return todayLog.map(l => ({ category: l.category, minutes: l.minutes }));

        return { error: "Unknown data key" };
    }
}
