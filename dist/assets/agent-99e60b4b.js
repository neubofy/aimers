const S="openai/gpt-oss-120b",u=`You are AIMERS OS, the central nervous system of this user's productivity.
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
`;class T{constructor(o,a){this.apiKey=o,this.contextProvider=a;const r=localStorage.getItem("aimers_memory");this.history=r?JSON.parse(r):[{role:"system",content:"SYSTEM ONLINE"}]}saveMemory(){this.history.length>15&&(this.history=this.history.slice(-15)),localStorage.setItem("aimers_memory",JSON.stringify(this.history))}updateKey(o){this.apiKey=o}async chat(o){var e,t;if(!this.apiKey)return{text:"API Key missing.",command:null};const a=this.contextProvider(),r=this.formatData(a),c=[{role:"system",content:u.replace("{{CONTEXT}}",r)},...this.history.slice(-6),{role:"user",content:o}];try{const m=await(await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${this.apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model:S,messages:c,temperature:.3,max_tokens:500})})).json();if(m.error)throw new Error(m.error.message);const n=((t=(e=m.choices[0])==null?void 0:e.message)==null?void 0:t.content)||"";let h=[],i=n;const l=[...n.matchAll(/\{"t":.*?\}/g)];if(l.length>0)try{h=l.map(s=>JSON.parse(s[0])),l.forEach(s=>{i=i.replace(s[0],"")}),i=i.trim()}catch(s){console.error("JSON Parse Error",s)}else{const s=n.match(/\{[\s\S]*?\}/);if(s)try{h=[JSON.parse(s[0])],i=n.replace(s[0],"").trim()}catch{}}return this.history.push({role:"user",content:o}),this.history.push({role:"assistant",content:n}),this.saveMemory(),{text:i,commands:h}}catch(d){return{text:`Error: ${d.message}`,command:null}}}formatData(o){const{st:a={},tasks:r=[],schedule:p=[],todayLog:c=[],dash:e={stats:{},prediction:{breakdown:{}}}}=o||{};return`
[TIMER]: ${a.running?"RUNNING":a.paused?"PAUSED":"STOPPED"} | Cat: ${a.category||"-"} | Tgt: ${a.target}m
[STATS]: Lvl ${e.stats.level} | Streak ${e.stats.streak} | XP ${e.stats.totalXP} | Pred ${e.prediction.xp} (S:${e.prediction.breakdown.study}/T:${e.prediction.breakdown.task})
[LOGS]: ${c.map(t=>`${t.category}(${t.minutes}m)`).join(", ")||"None"}
[SCHED]: ${p.map(t=>`"${t.title}"(${t.startIso}, ${t.minutes}m, ${t.status})`).join(" | ")||"None"}
[TASKS]:
${r.filter(t=>t.status!=="completed").map(t=>`- "${t.title}" (ID: "${t.id}", ListID: "${t.listId}")`).join(`
`)||"(No pending tasks)"}
`}}export{T as Agent};
