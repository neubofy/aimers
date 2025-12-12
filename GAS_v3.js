// ==========================================
// AIMERS OS - BACKEND v3 (LIVE MENTOR & NOTIFICATIONS)
// ==========================================
// Copy this ENTIRE file and paste it into your Google Apps Script editor.
// It includes all previous functionality PLUS the new Context & Notification system.
// ==========================================

// CONFIGURATION
const SHEET_ID = '185LMWyfq-qSfwvRZANYT2Z-aWTyrzKyYFsgYl7mQxLI';
const SHEET_NAME = 'Timelog';
const TIMER_SHEET_NAME = 'TimerState_v2';
const RESPONSES_SHEET_NAME = 'Form Responses 1';
const API_SECRET = 'aimers2025';

// ==========================================
// DO POST (API GATEWAY)
// ==========================================
function doPost(e) {
    const lock = LockService.getScriptLock();
    try { lock.waitLock(10000); } catch (e) { return json({ error: "Server Busy" }); }

    try {
        // 1. Authenticate
        if (!e.parameter.key || e.parameter.key !== API_SECRET) return json({ error: "Wrong Password" });

        // 2. Route Request
        const action = e.parameter.action;
        const p = e.parameter;
        let out = {};

        // Standard Timer Actions
        if (action === 'getState') out = getTimerState_v2();
        else if (action === 'start') out = startTimer_v2(p.category, p.target);
        else if (action === 'pause') out = pauseTimer_v2(p.minutes, p.seconds);
        else if (action === 'resume') out = resumeTimer_v2();
        else if (action === 'startFromCalendar') out = startSessionFromCalendar_v2(p.query);
        else if (action === 'stop') out = stopTimerAndLog_v2();
        else if (action === 'reset') out = resetTimer_v2();
        else if (action === 'add') out = addManualSession_v2(Number(p.minutes), p.category);

        // Data Readers
        else if (action === 'today') out = getTodaySessions_v2();
        else if (action === 'tasks') out = getEnhancedTasks_v2();
        else if (action === 'completeTask') out = completeTask_v2(p.id, p.listId);
        else if (action === 'dashboard') out = getDashboardData_v2();
        else if (action === 'scheduleToday') out = getTodayStudyEvents_v2();

        // NEW: UNIFIED CONTEXT FOR AGENT (Mentor Mode)
        else if (action === 'getAgentContext') out = getUnifiedAgentContext();

        return json(out);
    } catch (err) {
        return json({ error: err.toString() });
    } finally { lock.releaseLock(); }
}

function json(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }

// ==========================================
// MENTOR & NOTIFICATION SYSTEM (NEW)
// ==========================================
function getUnifiedAgentContext() {
    // 1. Fetch ALL data efficiently
    // Note: In GAS, we want to minimize individual Spreadsheet calls.
    // Ideally, we'd batch these, but for now we reuse existing robust functions.

    const timer = getTimerState_v2();
    const todaySessions = getTodaySessions_v2();
    const dashboard = getDashboardData_v2(); // Includes XP, Level, History
    const tasks = getEnhancedTasks_v2(); // Includes Overdue/Today/Upcoming
    const schedule = getTodayStudyEvents_v2(); // Includes Google Calendar status

    // 2. Synthesize "Notifications" (The "Live" Aspect)
    const notifications = generateNotifications(timer, todaySessions, dashboard, tasks, schedule);

    // 3. Return One Mega-Object
    return {
        timestamp: Date.now(),
        timer: timer,
        stats: {
            xp: dashboard.stats.totalXP,
            level: dashboard.stats.level,
            streak: dashboard.stats.streak,
            planned_minutes: dashboard.stats.plannedMinutes,
            actual_today_minutes: todaySessions.reduce((sum, s) => sum + s.minutes, 0),
            prediction: dashboard.prediction
        },
        schedule: schedule.map(s => ({
            title: s.title,
            start: s.startIso,
            status: s.status,
            gap_status: s.isSuggested ? "needs_attention" : "ok"
        })),
        tasks: {
            urgent: tasks.filter(t => t.dueStr && t.dueStr <= getTodayStr() && t.status !== 'completed').length,
            list: tasks.slice(0, 10) // Send top 10 relevant tasks to save bandwidth
        },
        notifications: notifications // The Agent should "speak" these
    };
}

function generateNotifications(timer, sessions, dash, tasks, schedule) {
    const alerts = [];
    const now = new Date();

    // A. Timer Alerts
    if (timer.running) {
        const elapsed = (Date.now() - timer.startTime) / 60000;
        if (elapsed > 50 && elapsed < 55) alerts.push({ type: "info", msg: "You've been focused for 50 mins. Take a break soon?" });
        if (elapsed > 90) alerts.push({ type: "warning", msg: "Long session detected (>90m). Diminishing returns warning." });
    }

    // B. Schedule Alerts (Upcoming Events)
    const nextEvent = schedule.find(s => s.status === 'upcoming');
    if (nextEvent) {
        // We don't have exact "minutes until" in the schedule object easily available without parsing, 
        // but let's approximate or just rely on the Agent to calculate.
        // simpler: if it's suggested to start.
        if (nextEvent.isSuggested) alerts.push({ type: "action", msg: `Scheduled session '${nextEvent.title}' is coming/active. Start now?` });
    }

    // C. Goal Alerts
    const totalMins = sessions.reduce((sum, s) => sum + s.minutes, 0);
    const goal = dash.stats.plannedMinutes || 300; // Default 5h if missing
    if (totalMins >= goal && totalMins < goal + 30) {
        alerts.push({ type: "success", msg: "Daily Goal Reached! Great job." });
    } else if (totalMins < goal && (goal - totalMins) < 60 && now.getHours() > 20) {
        alerts.push({ type: "motivation", msg: "You are close to your goal. Just one more hour!" });
    }

    // D. Task Alerts
    const overdueCount = tasks.filter(t => t.dueStr && t.dueStr < getTodayStr()).length;
    if (overdueCount > 0) alerts.push({ type: "warning", msg: `You have ${overdueCount} overdue tasks.` });

    return alerts;
}

// ==========================================
// TIMER CORE FUNCTIONS (Unchanged)
// ==========================================
function getTimerState_v2() {
    const sheet = getTimerSheet_v2();
    const data = sheet.getRange(2, 1, 1, 8).getValues()[0];
    const now = Date.now();

    if (data[3] === 'yes' && data[5] && now >= data[5]) {
        stopTimerAndLog_v2();
        return getTimerState_v2();
    }

    return {
        running: data[0] === 'running',
        startTime: data[1] ? Number(data[1]) : null,
        category: data[6] || 'Focus',
        target: data[7] ? Number(data[7]) : 120,
        paused: data[3] === 'yes',
        pauseStart: data[4] ? Number(data[4]) : null,
        pauseExpiry: data[5] ? Number(data[5]) : null
    };
}

function startTimer_v2(cat, target) {
    const sheet = getTimerSheet_v2();
    const currentState = sheet.getRange(2, 1).getValue();
    if (currentState === 'running') return { error: "SESSION_ACTIVE", ...getTimerState_v2() };

    const now = Date.now();
    sheet.getRange(2, 1, 1, 8).setValues([['running', String(now), String(now), '', '', '', cat || 'Focus', target || 120]]);
    return getTimerState_v2();
}

function pauseTimer_v2(mins, secs) {
    const sheet = getTimerSheet_v2(); const now = Date.now();
    let dur = 120000;
    if (secs) dur = Number(secs) * 1000;
    else if (mins) dur = Number(mins) * 60000;

    sheet.getRange(2, 4, 1, 3).setValues([['yes', String(now), String(now + dur)]]);
    return getTimerState_v2();
}

function resumeTimer_v2() {
    const sheet = getTimerSheet_v2();
    const data = sheet.getRange(2, 1, 1, 8).getValues()[0];
    const now = Date.now();

    // Resetting incorrectly? Fix logic:
    // We must shift the START TIME forward by the duration of the pause.
    // data[1] = startTime, data[4] = pauseStart
    if (data[3] === 'yes' && data[4]) {
        const pauseStart = Number(data[4]);
        const start = Number(data[1]);
        const pausedDuration = now - pauseStart;
        const newStart = start + pausedDuration;

        // Update: State=Running, Start=NewStart, OriginalLogTime(Keep), Paused=No, PStart="", PExp=""
        // Note: keeping data[2] (Last) untouched or updating it isn't critical for elapsed calc but good for logs.
        sheet.getRange(2, 1, 1, 6).setValues([['running', String(newStart), data[2], '', '', '']]);
    } else {
        // Fallback: Just ensure running status
        sheet.getRange(2, 1).setValue('running');
    }
    return getTimerState_v2();
}

function stopTimerAndLog_v2() {
    const sheet = getTimerSheet_v2(); const data = sheet.getRange(2, 1, 1, 7).getValues()[0];
    if (data[0] !== 'running') return { success: false };

    let start = Number(data[1]); let paused = data[3] === 'yes'; let pStart = data[4] ? Number(data[4]) : null;
    let end = paused && pStart ? pStart : Date.now(); let mins = Math.floor((end - start) / 60000);

    if (mins > 0) logSession_v2(mins, data[6] || 'Focus', 'timer');
    sheet.getRange(2, 1, 1, 8).setValues([['stopped', '', '', '', '', '', '', '']]);
    return { success: true, minutesLogged: mins };
}

function resetTimer_v2() {
    const sheet = getTimerSheet_v2();
    sheet.getRange(2, 1, 1, 8).setValues([['stopped', '', '', '', '', '', '', '']]);
    return { success: true };
}

// NEW: Start Session from Best Calendar Match
function startSessionFromCalendar_v2(query) {
    if (!query) return { error: "Query missing" };

    // 1. Get Today's Events
    const events = getTodayStudyEvents_v2(); // Re-use existing reader

    // 2. Find Best Match
    const q = query.toLowerCase().trim();
    // Prioritize exact(ish) starts, then partial includes
    let match = events.find(e => e.title.toLowerCase() === q);
    if (!match) match = events.find(e => e.title.toLowerCase().includes(q) && e.status !== 'past');
    if (!match) match = events.find(e => e.title.toLowerCase().includes(q)); // Fallback to past events if needed

    if (!match) return { error: "No matching calendar event found for '" + query + "'" };

    // 3. Start Timer with EXACT Calendar Data
    // Calculate remaining duration if it's active
    let target = match.minutes;
    // Optional: could adjust target if event is half-over, but full duration is safer for "logging as complete" logic

    return startTimer_v2(match.title, target);
}

// ==========================================
// LOGGING SYSTEM
// ==========================================
function logSession_v2(minutes, category, type) {
    const sheet = getSheet_v2();
    const today = getTodayStr();
    const lastRow = sheet.getLastRow();
    let rowIndex = -1;

    if (lastRow > 1) {
        const lastDateVal = sheet.getRange(lastRow, 1).getValue();
        if (normalizeDate(lastDateVal) === today) rowIndex = lastRow;
    }

    if (rowIndex === -1) {
        let manual = (type === 'manual') ? String(minutes) : "";
        let timer = (type === 'timer') ? String(minutes) : "";
        sheet.appendRow([today, String(minutes), manual, timer, category, category]);
    } else {
        let range = sheet.getRange(rowIndex, 1, 1, 6); let vals = range.getValues()[0];
        let currentTotal = String(vals[1]); let currentManual = String(vals[2]); let currentTimer = String(vals[3]);
        let currentUnique = String(vals[4]); let currentChron = String(vals[5]);

        let newTotal = currentTotal ? currentTotal + "+" + minutes : String(minutes);
        if (type === 'manual') currentManual = currentManual ? currentManual + "+" + minutes : String(minutes);
        else currentTimer = currentTimer ? currentTimer + "+" + minutes : String(minutes);
        if (category && !currentUnique.includes(category)) currentUnique = currentUnique ? currentUnique + "," + category : category;

        // Strict Append for Chronological Log
        let newChron = currentChron ? currentChron + "," + category : category;

        sheet.getRange(rowIndex, 2, 1, 5).setValues([[newTotal, currentManual, currentTimer, currentUnique, newChron]]);
    }
}

function addManualSession_v2(mins, cat) {
    if (mins > 0) { logSession_v2(mins, cat || "Manual", 'manual'); return { success: true }; }
    return { success: false };
}

// ==========================================
// DATA READERS
// ==========================================
function getTodaySessions_v2() {
    const sheet = getSheet_v2();
    const data = sheet.getDataRange().getValues();
    const today = getTodayStr();
    const res = [];

    for (let i = 1; i < data.length; i++) {
        if (normalizeDate(data[i][0]) === today) {
            let minStr = String(data[i][1]);
            let nameStr = String(data[i][5]);

            if (minStr && nameStr) {
                let mins = minStr.split('+');
                let names = nameStr.split(',').map(n => n.trim());
                for (let k = 0; k < Math.min(mins.length, names.length); k++) {
                    res.push({
                        minutes: Number(mins[k]),
                        category: names[k]
                    });
                }
            }
        }
    }
    return res;
}

function getTodayStudyEvents_v2() {
    const tz = getUserTZ();
    const cal = CalendarApp.getDefaultCalendar();
    const today = new Date();
    const now = new Date();
    const loggedSessions = getTodaySessions_v2();

    return cal.getEventsForDay(today)
        .filter(e => {
            const t = (e.getTitle() || '').toLowerCase();
            return t.includes('study') || t.includes('focus') || t.includes('read') || t.includes('learn');
        })
        .map(e => {
            const start = e.getStartTime();
            const end = e.getEndTime();
            const title = e.getTitle().trim();
            const totalMins = Math.max(1, Math.round((end - start) / 60000));

            const matchedSessions = loggedSessions.filter(s => {
                const logName = s.category.toLowerCase();
                const calName = title.toLowerCase();
                return logName.includes(calName) || calName.includes(logName);
            });

            const doneMins = matchedSessions.reduce((sum, s) => sum + s.minutes, 0);
            const percent = Math.min(100, Math.round((doneMins / totalMins) * 100));

            const diffStart = (start - now) / 60000;
            const diffEnd = (end - now) / 60000;

            let status = "upcoming";
            if (diffStart <= 0 && diffEnd >= 0) status = "active";
            else if (diffEnd < 0) status = "past";

            const isSuggested = (status === "active" || (status === "upcoming" && diffStart <= 30)) && percent < 90;

            return {
                id: e.getId(), title: title, startIso: Utilities.formatDate(start, tz, "HH:mm"),
                endIso: Utilities.formatDate(end, tz, "HH:mm"), minutes: totalMins, doneMins: doneMins,
                percent: percent, status: status, isSuggested: isSuggested
            };
        });
}

function getDashboardData_v2() {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let responsesSheet = ss.getSheetByName(RESPONSES_SHEET_NAME);

    let gamifiedData = { totalXP: 0, level: 0, streak: 0, plannedMinutes: 0 };

    if (responsesSheet) {
        const lastRow = responsesSheet.getLastRow();
        if (lastRow > 1) {
            const xpValues = responsesSheet.getRange(lastRow, 15, 1, 3).getValues()[0];
            const planValue = responsesSheet.getRange(lastRow, 7).getValue();

            gamifiedData.totalXP = Number(xpValues[0]) || 0;
            gamifiedData.level = Number(xpValues[1]) || 0;
            gamifiedData.streak = Number(xpValues[2]) || 0;
            gamifiedData.plannedMinutes = Number(planValue) || 0;
        }
    }

    const timeSheet = getSheet_v2(); const timeData = timeSheet.getDataRange().getValues();
    const days = []; const todayDate = new Date();
    for (let i = 6; i >= 0; i--) { const d = new Date(todayDate); d.setDate(d.getDate() - i); days.push(Utilities.formatDate(d, getUserTZ(), "yyyy-MM-dd")); }

    const historyTotals = {}; days.forEach(d => historyTotals[d] = 0);
    for (let i = 1; i < timeData.length; i++) {
        const dateStr = normalizeDate(timeData[i][0]);
        if (historyTotals[dateStr] !== undefined) {
            let valStr = String(timeData[i][1]); let rowSum = 0;
            if (valStr) valStr.split('+').forEach(part => rowSum += Number(part) || 0);
            historyTotals[dateStr] += rowSum;
        }
    }

    const todaySessions = getTodaySessions_v2();
    const tasks = getEnhancedTasks_v2();
    const tasksDone = tasks.filter(t => t.status === 'completed' && t.completedToday).length;
    const tasksPlanned = tasks.filter(t => t.status === 'completed' && t.completedToday || (t.status === 'needsAction' && t.dueStr === getTodayStr())).length;

    const segments = todaySessions.map(s => s.minutes);
    const totalMinutes = segments.reduce((a, b) => a + b, 0);
    const xpTime = Math.floor(totalMinutes / 30) * 30;
    let xpRate = 1;
    const PLANNED_TIME = 510; const ratio = xpTime / PLANNED_TIME;
    if (ratio < 0.9) xpRate = 0.5; else if (ratio < 1.0) xpRate = 1; else if (ratio < 1.1) xpRate = 3; else xpRate = 5;

    const studyXP = Math.round(xpTime * xpRate);
    const taskXP = (tasksDone * 100) - ((tasksPlanned - tasksDone) * 100);
    let bonusXP = 0;
    segments.forEach(mins => { if (mins >= 300) bonusXP += 1000; else if (mins >= 240) bonusXP += 500; else if (mins >= 180) bonusXP += 250; else if (mins >= 120) bonusXP += 150; });

    return {
        stats: gamifiedData,
        history: days.map(d => ({ date: d, total: historyTotals[d] })),
        prediction: { xp: studyXP + taskXP + bonusXP, breakdown: { study: studyXP, task: taskXP, bonus: bonusXP } }
    };
}

function getEnhancedTasks_v2() {
    const tz = getUserTZ(); const now = new Date(); const todayStr = Utilities.formatDate(now, tz, "yyyy-MM-dd");
    const STUDY_LIST_ID = "MTE1NTg0NzcxMDQ3Mjc2NjU1NDc6MDow";
    let LIFESTYLE_LIST_ID = null;
    try { const allLists = Tasks.Tasklists.list().items; const found = allLists.find(l => l.title === "Lifestyle"); if (found) LIFESTYLE_LIST_ID = found.id; } catch (e) { }

    let allTasks = [];
    const fetchAndFormat = (listId, category) => {
        if (!listId) return [];
        try {
            const apiResult = Tasks.Tasks.list(listId, { showCompleted: true, showHidden: true });
            return (apiResult.items || []).map(t => {
                const d = t.due ? new Date(t.due) : null; const c = t.completed ? new Date(t.completed) : null;
                const compStr = c ? Utilities.formatDate(c, tz, "yyyy-MM-dd") : null;
                return {
                    id: t.id, listId: listId, category: category, title: t.title, status: t.status, notes: t.notes || "",
                    dueStr: d ? Utilities.formatDate(d, tz, "yyyy-MM-dd") : null, compStr: compStr, completedToday: compStr === todayStr,
                    dueTime: (t.due && !t.due.includes("T00:00:00")) ? Utilities.formatDate(d, tz, "HH:mm") : null
                };
            }).filter(t => (t.status === 'needsAction') || (t.status === 'completed' && t.completedToday));
        } catch (e) { return []; }
    };
    allTasks = allTasks.concat(fetchAndFormat(STUDY_LIST_ID, "Study"));
    if (LIFESTYLE_LIST_ID) allTasks = allTasks.concat(fetchAndFormat(LIFESTYLE_LIST_ID, "Lifestyle"));
    return allTasks;
}

function completeTask_v2(taskId, listId) {
    try { if (!listId) throw new Error("List ID missing"); let t = Tasks.Tasks.get(listId, taskId); t.status = 'completed'; Tasks.Tasks.update(t, listId, taskId); return { success: true }; } catch (e) { return { error: e.toString() }; }
}

// ==========================================
// HELPERS
// ==========================================
function getSheet_v2() { const ss = SpreadsheetApp.openById(SHEET_ID); let s = ss.getSheetByName(SHEET_NAME); if (!s) { s = ss.insertSheet(SHEET_NAME); s.appendRow(['Date', 'History', 'Manual Log', 'Timer Log', 'Categories', 'Chronological Log']); } return s; }
function getTimerSheet_v2() { const ss = SpreadsheetApp.openById(SHEET_ID); let s = ss.getSheetByName(TIMER_SHEET_NAME); if (!s) { s = ss.insertSheet(TIMER_SHEET_NAME); s.appendRow(['State', 'Start', 'Last', 'Paused', 'PStart', 'PExp', 'Category', 'Target']); s.getRange(2, 1, 1, 8).setValues([['stopped', '', '', '', '', '', '', '']]); } else if (s.getLastColumn() < 8) { s.getRange(1, 8).setValue("Target"); } return s; }
function getTodayStr() { return Utilities.formatDate(new Date(), getUserTZ(), "yyyy-MM-dd"); }
function getUserTZ() { return Session.getScriptTimeZone() || 'Asia/Kolkata'; }
function normalizeDate(c) { try { if (typeof c === 'number') return Utilities.formatDate(new Date(Math.round((c - 25569) * 864e5)), getUserTZ(), "yyyy-MM-dd"); var d = new Date(c); return !isNaN(d) ? Utilities.formatDate(d, getUserTZ(), "yyyy-MM-dd") : String(c).trim(); } catch (e) { return String(c).trim(); } }
