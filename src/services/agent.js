/**
 * Aimers OS - Smart Agent Service (Token Optimized)
 */

const AI_MODEL = "openai/gpt-oss-120b"; // Reverted to user preference
// const AI_MODEL = "llama3-70b-8192";

// COMPRESSED SYSTEM PROMPT
// COMPRESSED SYSTEM PROMPT
const SYSTEM_PROMPT = `You are AIMERS OS, the central nervous system of this user's productivity.
You have GOD-MODE ACCESS. You see EVERYTHING the user sees and more.

### STATE & CONTEXT (JSON)
{{CONTEXT}}

### YOUR CAPABILITIES
1. **READ EVERYTHING**: The JSON above contains ALL pending tasks, ALL completed tasks today, full schedule, logs, and real-time stats.
2. **FIND ANYTHING**: If user asks "Did I finish math?", SEARCH the 'all_tasks' list or 'work_logs_today'.
3. **CONTROL**: You can Start/Stop timers, Log work, and Mark tasks complete.

### TOOLS (Output JSON at end of response)
- **Timer**:
  - {"t":"start", "cat":"Subject", "min":60} -> Start session.
  - {"t":"stop"} -> Stop.
  - {"t":"pause"} / {"t":"resume"} / {"t":"reset"}
- **Data**:
  - {"t":"log", "cat":"Reading", "min":30} -> Log past work.
  - {"t":"complete", "id":"TASK_ID", "lid":"LIST_ID"} -> Mark task done.
  - {"t":"nav", "v":"stats|tasks|plan|log|mentor"} -> Switch View.

### INSTRUCTIONS
1. **Analyze Context First**: Always read the JSON state before answering.
2. **Be Specific**: If asked about a task, quote its exact status from the data.
3. **Response Style**: Concise, high-impact, robotic but helpful.
4. **JSON Output**: STRICTLY at the very end.
`;

export class Agent {
    constructor(apiKey, contextProvider) {
        this.apiKey = apiKey;
        this.contextProvider = contextProvider;
        // Industry Standard: Local Persistence for Session Memory
        const saved = localStorage.getItem("aimers_memory");
        this.history = saved ? JSON.parse(saved) : [{ role: 'system', content: 'SYSTEM ONLINE' }];
    }

    saveMemory() {
        // Sliding Window: Keep last 15 messages to manage context window
        if (this.history.length > 15) {
            this.history = this.history.slice(-15);
        }
        localStorage.setItem("aimers_memory", JSON.stringify(this.history));
    }

    updateKey(key) { this.apiKey = key; }

    async chat(userText) {
        if (!this.apiKey) return { text: "API Key missing.", command: null };

        // 1. Get Fresh Data
        const data = this.contextProvider();

        // 2. Format Context (Dense & Smart)
        const contextStr = this.formatData(data);
        const finalPrompt = SYSTEM_PROMPT.replace('{{CONTEXT}}', contextStr);

        // 3. Prepare Request (Keep history short)
        const messages = [
            { role: 'system', content: finalPrompt },
            ...this.history.slice(-6),
            { role: 'user', content: userText }
        ];

        try {
            const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: AI_MODEL,
                    messages: messages,
                    temperature: 0.3, // Lower temp for precise tool usage
                    max_tokens: 500
                })
            });

            const resJson = await res.json();
            if (resJson.error) throw new Error(resJson.error.message);

            const aiContent = resJson.choices[0]?.message?.content || "";

            // 4. Extraction Logic (Regex)
            // 4. Extraction Logic (Regex Global)
            let commands = [];
            let displayText = aiContent;

            // Regex to find ALL JSON blocks matching the compressed format
            const cmdMatches = [...aiContent.matchAll(/\{"t":.*?\}/g)];

            if (cmdMatches.length > 0) {
                try {
                    commands = cmdMatches.map(m => JSON.parse(m[0]));
                    // Remove all commands from display text
                    cmdMatches.forEach(m => { displayText = displayText.replace(m[0], ""); });
                    displayText = displayText.trim();
                } catch (e) { console.error("JSON Parse Error", e); }
            } else {
                // Fallback for standard JSON
                const stdMatch = aiContent.match(/\{[\s\S]*?\}/);
                if (stdMatch) {
                    try { commands = [JSON.parse(stdMatch[0])]; displayText = aiContent.replace(stdMatch[0], '').trim(); } catch (e) { }
                }
            }

            this.history.push({ role: 'user', content: userText });
            this.history.push({ role: 'assistant', content: aiContent });
            this.saveMemory();

            return { text: displayText, commands };

        } catch (e) {
            return { text: `Error: ${e.message}`, command: null };
        }
    }

    // FULL CONTEXT - "GOD MODE"
    formatData(d) {
        const { st = {}, tasks = [], schedule = [], todayLog = [], dash = { stats: {}, prediction: { breakdown: {} }, history: [] } } = d || {};
        const now = new Date();

        // Structured Context Object for maximum clarity
        const contextObj = {
            meta: {
                time: now.toLocaleTimeString(),
                date: now.toLocaleDateString(),
                weekday: now.toLocaleDateString('en-US', { weekday: 'long' })
            },
            timer: {
                status: st.running ? 'RUNNING' : (st.paused ? 'PAUSED' : 'STOPPED'),
                activity: st.category || 'None',
                duration_target: st.target,
                elapsed: st.startTime ? Math.floor((Date.now() - st.startTime) / 1000) : 0
            },
            stats: {
                level: dash.stats.level,
                streak: dash.stats.streak,
                total_xp: dash.stats.totalXP,
                today_prediction_xp: dash.prediction.xp,
                xp_breakdown: dash.prediction.breakdown
            },
            schedule_today: schedule.map(s => ({
                title: s.title,
                time: s.startIso,
                duration: s.minutes,
                status: s.status, // upcoming, active, completed
                is_done: s.doneMins >= s.minutes
            })),
            work_logs_today: todayLog.map(l => ({
                category: l.category,
                minutes: l.minutes,
                timestamp: l.timestamp // if available
            })),
            all_tasks: tasks.map(t => ({
                id: t.id,
                title: t.title,
                status: t.status, // completed or active
                due: t.dueTime || 'No Due Time',
                list_id: t.listId,
                completed_today: t.completedToday
            }))
        };

        return JSON.stringify(contextObj, null, 2);
    }
}

