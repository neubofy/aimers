/**
 * Aimers OS - Smart Agent Service (Token Optimized)
 */

const AI_MODEL = "openai/gpt-oss-120b"; // Reverted to user preference
// const AI_MODEL = "llama3-70b-8192";

// COMPRESSED SYSTEM PROMPT
const SYSTEM_PROMPT = `You are AIMERS OS, the central nervous system of this user's productivity.
You have FULL CONTROL. You see what they see.

### STATE & CONTEXT
{{CONTEXT}}

### TOOLS (Execute by outputting JSON)
- **Timer**:
  - {"t":"start", "cat":"Subject", "min":60} -> Start new session.
  - {"t":"stop"} -> Stop current.
  - {"t":"pause"} -> Pause.
  - {"t":"resume"} -> Resume.
  - {"t":"reset"} -> Reset timer.
- **Data**:
  - {"t":"log", "cat":"Reading", "min":30} -> Manually log past work.
  - {"t":"complete", "id":"TASK_ID", "lid":"LIST_ID"} -> Check off task.
  - {"t":"nav", "v":"stats|tasks|plan|log|mentor"} -> Switch screen.

### INSTRUCTIONS
1. **Analyze Context**: Look at the Timer Status, Schedule, and Tasks below.
2. **Intent Matching**:
   - "Start Physics" -> Check if Physics is in schedule? usage start tool.
   - "I'm done" -> stop tool.

   - "Check reading task" -> LOOK at [TASKS] list below. Find "Reading" (fuzzy match). Get ID "123". -> {"t":"complete", "id":"123", "lid":"..."}
   - NEVER ask user for Task ID. ALWAYS find it in [TASKS].
   - "Stop and mark math done" -> {"t":"stop"} {"t":"complete","id":"...",...}
3. **Response**: Brief, high-impact text.
4. **JSON**: STRICTLY at end of message. Can output MULTIPLE JSON blocks for multi-step actions.
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

    formatData(d) {
        // DENSE REPRESENTATION
        const { st = {}, tasks = [], schedule = [], todayLog = [], dash = { stats: {}, prediction: { breakdown: {} } } } = d || {};

        return `
[TIMER]: ${st.running ? 'RUNNING' : (st.paused ? 'PAUSED' : 'STOPPED')} | Cat: ${st.category || '-'} | Tgt: ${st.target}m
[STATS]: Lvl ${dash.stats.level} | Streak ${dash.stats.streak} | XP ${dash.stats.totalXP} | Pred ${dash.prediction.xp} (S:${dash.prediction.breakdown.study}/T:${dash.prediction.breakdown.task})
[LOGS]: ${todayLog.map(l => `${l.category}(${l.minutes}m)`).join(', ') || 'None'}
[SCHED]: ${schedule.map(s => `"${s.title}"(${s.startIso}, ${s.minutes}m, ${s.status})`).join(' | ') || 'None'}
[TASKS]:
${tasks.filter(t => t.status !== 'completed').map(t => `- "${t.title}" (ID: "${t.id}", ListID: "${t.listId}")`).join('\n') || "(No pending tasks)"}
`;
    }
}
