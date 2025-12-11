/**
 * Aimers OS - Smart Agent Service (Token Optimized & Robust Parsing)
 */


const AI_MODEL = "openai/gpt-oss-120b"; // Reverted to User Request (120B)
// const AI_MODEL = "llama3-8b-8192";


// TOOL OMNI-AGENT SYSTEM PROMPT
const SYSTEM_PROMPT = `You are AIMERS OS, the ultimate productivity intelligence.
Your mission: Be accurate, helpful, and agentic.

### DATA ACCESS GUIDE (What you get from "read" tool)
- **"stats"**: Returns \`actual_today_minutes\` (Total time studied today), \`xp\` (Lifetime), \`streak\`, \`level\`, \`predicted_today\` (XP forecast), and \`history_7_days\`.
- **"tasks"**: Returns ALL tasks (Pending & Completed). Fields: \`id\`, \`title\`, \`status\` ('needsAction' or 'completed'), \`list_id\`, \`due\`.
- **"schedule"**: Returns calendar. Fields: \`title\`, \`time\`, \`duration\` (Planned), \`done\` (Actual completed mins), \`status\` (past/active/upcoming).
- **"logs"**: Returns specific session logs for today: \`category\`, \`minutes\`.
- **"timer"**: Returns \`status\` (RUNNING/PAUSED/STOPPED), \`activity\`, \`target_minutes\`, \`elapsed_seconds\`.
- **"everything"**: Returns **ALL** of the above. Use this for summaries.

### VITAL PROTOCOL
1. **NO DATA? READ IT.** Start with zero knowledge. If asked "How much did I study?", READ 'stats' or 'logs' first.
2. **TRUST THE DATA**: If 'actual_today_minutes' is 50, say "50 minutes". Do not guess.
3. **SINGLE SESSION**: If Timer is RUNNING, do NOT start a new one. Ask to stop first.
4. **EXACT TITLES**: Use exact 'schedule' titles when starting a session.

### SCENARIO LOGIC
- **"How much XP today?"** -> {"t":"read", "k":"stats"} -> Answer using \`actual_today_minutes\` or calculated XP.
- **"What tasks are left?"** -> {"t":"read", "k":"tasks"} -> Filter for 'status' !== 'completed'.
- **"Start math"** -> {"t":"start", "cat":"Math", "min":60}
- **"Reset timer"** -> {"t":"reset"}

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
        const nowIST = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "full", timeStyle: "medium" });
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT + `\n\n[CURRENT TIME (IST): ${nowIST}]` },
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
                stats: {
                    level: dash.stats.level,
                    xp: dash.stats.totalXP,
                    streak: dash.stats.streak,
                    prediction: dash.prediction, /* Explicitly include Prediction {xp, breakdown} */
                    graph: dash.history
                },
                tasks: tasks.map(t => ({ id: t.id, title: t.title, status: t.status, list: t.listId, due: t.dueTime })),
                schedule: schedule.map(s => ({ title: s.title, time: s.startIso, duration: s.minutes, done: s.doneMins, status: s.status })),
                logs: todayLog
            };
        }

        if (key === 'timer') return {
            status: st.running ? 'RUNNING' : (st.paused ? 'PAUSED' : 'STOPPED'),
            activity: st.category,
            target_minutes: st.target,
            elapsed_seconds: st.startTime ? Math.floor((Date.now() - st.startTime) / 1000) : 0
        };

        if (key === 'stats') {
            return {
                level: dash.stats.level,
                streak: dash.stats.streak,
                xp: dash.stats.totalXP,
                predicted_today: dash.prediction ? dash.prediction.xp : 0, /* Added Total Predicted */
                actual_today_minutes: todayLog.reduce((a, b) => a + b.minutes, 0), /* Calculated Truth */
                breakdown: dash.prediction ? dash.prediction.breakdown : {},
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
