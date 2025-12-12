/**
 * Aimers OS - Smart Agent Service (Token Optimized & Robust Parsing)
 */

import { callApi } from "./api"; // Import API for Live Backend Access

const AI_MODEL = "openai/gpt-oss-120b";

// TOOL OMNI-AGENT SYSTEM PROMPT
const SYSTEM_PROMPT = `You are AIMERS OS, the ultimate productivity intelligence.

### DATA ACCESS GUIDE (You have FULL ACCESS to this OS)
- **"live"**: **GLOBAL STATE**. Fetches complete app context (Status, Active Timer, Notifications). Use for "Status", "Overview".
- **"stats"**: Returns XP, Level, Streak. Use for "XP", "Level".
- **"history"**: **DEEP DIVE**. Fetches detailed 7-day performance history and TODAY's full plan from the backend. Use for "Weekly report", "How did I do this week?", "What was my plan?".
- **"tasks"**: Returns Task List. Use for "What tasks?", "Check tasks".
- **"schedule"**: Returns Calendar. Use for "What's next?", "Schedule".
- **"logs"**: Returns Today's Sessions. Use for "What did I do today?".
- **"timer"**: Returns Timer State.

### VITAL PROTOCOL
1. **CHECK LIVE CONTEXT**: If the user asks "What should I do?" or "Status", READ "live" first.
2. **NO AUTO-EXECUTION**: NEVER output a command (start/stop/complete) *unless* the user explicitly asked for it or agreed to your suggestion.
   - *Bad*: User asks "What's next?", you see Math. Output \`{"t":"start"}\`. (WRONG - User didn't agree).
   - *Good*: User asks "What's next?", you say "Math is next. Start now?", User says "Yes". Output \`{"t":"start"}\`. (CORRECT).
3. **TRUST THE DATA**: If 'actual_today_minutes' is 50, say "50 minutes".
4. **SINGLE SESSION**: If Timer is RUNNING, do NOT start a new one. Ask to stop first.

### SCENARIO LOGIC
- **"What's up?"** -> {"t":"read", "k":"live"} -> Check notifications/alerts.
- **"How much XP?"** -> {"t":"read", "k":"stats"}
- **"Start math"** -> {"t":"start", "cat":"Math", "min":60}
- **"Take a 5 min break"** -> {"t":"pause", "min":5} (Default 'min' is 2 if not specified)
- **"Resume session"** -> {"t":"resume"} (Resumes timer from pause)
- **"Reset timer"** -> {"t":"reset"} (Resets session completely)
- **"Take 30 sec break"** -> {"t":"pause", "sec":30}
- **"Start Pomodoro"** -> {"t":"start", "cat":"Focus", "min":25} (Wait for user to finish) -> (Then user asks for break) -> {"t":"pause", "min":5}
- **"Start History from calendar"** -> {"t":"cal_start", "q":"History"} (Backend finds "Study History Ch5" and starts it)
- **"Start next session"** -> {"t":"read", "k":"schedule"} -> (Then if "Math" is next) -> {"t":"cal_start", "q":"Math"}

### OUTPUT FORMAT
- Reply comfortably as a human mentor.
- **IMPORTANT**: If multiple actions, output multiple JSON blocks.
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
        if (depth > 5) return { text: "I'm having trouble retrieving that. Let's try again.", command: null };

        if (depth === 0) this.history.push({ role: 'user', content: userText });

        const nowIST = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "full", timeStyle: "medium" });
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT + `\n\n[CURRENT TIME (IST): ${nowIST}]` },
            ...this.history.slice(-5)
        ];

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

                        // GRANULAR API FETCHING
                        switch (rc.k) {
                            case 'live': endpoint = "getAgentContext"; break;
                            case 'stats': endpoint = "dashboard"; break;
                            case 'tasks': endpoint = "tasks"; break;
                            case 'schedule': endpoint = "scheduleToday"; break;
                            case 'logs': endpoint = "today"; break;
                            case 'history': endpoint = "getHistoryContext"; break;
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
                        }

                    } catch (e) {
                        observations.push(`[ERROR FETCHING ${rc.k}]: ${e.message}`);
                    }
                }

                this.history.push({ role: 'assistant', content: aiContent });
                this.history.push({ role: 'system', content: observations.join("\n\n") + "\n\n[SYSTEM: Data retrieved. Perform actions or answer now.]" });

                return this.chat("", depth + 1);
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
}
