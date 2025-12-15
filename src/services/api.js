const API_URL = "https://script.google.com/macros/s/AKfycbzrgtW_KFHNclLYIAQbzfqNigclvuUW7OEyOKpY3KZFURQKlgL3b9YNciExObr32igITg/exec";
// USER: REPLACE THIS WITH YOUR MASTER SCRIPT WEB APP URL
const MASTER_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzuuUMT5KmMr-NaiiGmvAYwki0Q4bQicjmwfn3HAFeoQnjjmWfYyNA0pb82Q19rAcnB3A/exec";

export const callMasterWebhook = async (password) => {
    if (!MASTER_SCRIPT_URL) return { success: false, error: "Master URL not configured in api.js" };
    try {
        // Send 'run_nightly' action with 'password'
        const params = new URLSearchParams({ action: "run_nightly", password: password, t: Date.now() });
        const res = await fetch(MASTER_SCRIPT_URL, { method: "POST", body: params });
        const j = await res.json();

        if (j.status === "success" || j.result === "success") return { success: true, status: "completed" };
        if (j.status === "skipped") return { success: true, status: "skipped", reason: j.reason };
        if (j.error === "Invalid Password") return { success: false, error: "Invalid Confirmation Code" };

        return { success: false, error: JSON.stringify(j) };
    } catch (e) {
        return { success: false, error: e.message };
    }
};

export const callApi = async (action, p = {}, retries = 3) => {
    const k = localStorage.getItem("aimers_key");
    if (!k) throw new Error("NO_KEY");

    // Add timestamp to prevent caching
    const params = new URLSearchParams({ action, key: k, t: Date.now(), ...p });

    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(API_URL, { method: "POST", body: params });
            const j = await res.json();

            // Retry on Server Busy
            if (j.error === "Server Busy" && i < retries - 1) {
                console.warn(`Server Busy for ${action}. Retrying... (${i + 1}/${retries})`);
                await new Promise(r => setTimeout(r, 2000)); // Wait 2s
                continue;
            }
            if (j.error) throw new Error(j.error);
            return j;
        } catch (e) {
            if (i === retries - 1) throw e;
            await new Promise(r => setTimeout(r, 2000));
        }
    }
};
