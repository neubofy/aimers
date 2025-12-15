function doPost(e) {
    // Action "run_nightly" requires password param
    if (e.parameter.action === 'run_nightly') {
        const password = e.parameter.password;
        let force = false;

        if (password === 'Run') {
            force = false;
        } else if (password === 'ADVANCE_RUN') {
            force = true;
        } else {
            return ContentService.createTextOutput(JSON.stringify({
                status: "error", error: "Invalid Password"
            })).setMimeType(ContentService.MimeType.JSON);
        }

        const result = pawanwashudev(force);
        return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    }
}

function pawanwashudev(force = false) {
    const now = new Date();
    const hour = now.getHours();
    const minutes = now.getMinutes();

    // 1. CHECKS: Run if time matches OR if forced.
    // Allowed window is 11:00 PM to 11:59 PM
    if (force === true || (hour === 23)) {

        try {
            // 2. DUPLICATION CHECK
            // Open the Sheet and check the Last Row Key
            const ss = SpreadsheetApp.openById("185LMWyfq-qSfwvRZANYT2Z-aWTyrzKyYFsgYl7mQxLI");
            const sheet = ss.getSheetByName("Form Responses 1");

            if (sheet) {
                const lastRow = sheet.getLastRow();
                if (lastRow > 1) {
                    const lastDateVal = sheet.getRange(lastRow, 1).getValue(); // Column A: Timestamp
                    const lastDate = new Date(lastDateVal);

                    // Compare Date Strings (YYYY-MM-DD)
                    const t1 = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd");
                    const t2 = Utilities.formatDate(lastDate, Session.getScriptTimeZone(), "yyyy-MM-dd");

                    // If today matches the last entry date, WE ALREADY RAN TODAY.
                    // If force=true, we SKIP this check and run again.
                    // If force=false, we STOP here.
                    if (t1 === t2 && !force) {
                        Logger.log("⚠️ Skipped: Nightly Routine already ran for today (" + t1 + ")");
                        return { status: "skipped", reason: "Already ran today" };
                    }
                }
            }

            Logger.log("🚀 Starting Nightly Protocol...");

            // Step 1–5
            copySequentialTimelogToFormResponses();
            updateTaskStatsSimple();
            processReflectionAndFillColumns();
            processStudyPlanWithGroq();
            nfcalculation();

            Utilities.sleep(10000);
            fillGeminiColumns();

            // Step 7–11
            createSimpleNextDayDoc();
            generateTodayFeedbackPDF();
            createEventsFromPlan();
            sendSummaryEmail();
            syncFromSheetTrigger();

            Logger.log("✅ All functions executed successfully.");
            return { status: "success" };

        } catch (err) {
            Logger.log("❌ Error during execution: " + err);
            return { status: "error", error: err.toString() };
        }

    } else {
        Logger.log(`⏱️ Skipped: Not 11 PM window. Now = ${hour}:${minutes}`);
        return { status: "skipped", reason: "Time mismatch (Window: 11:00 PM - 11:59 PM)" };
    }
}
