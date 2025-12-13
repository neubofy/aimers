const API_URL = "https://script.google.com/macros/s/AKfycbzrgtW_KFHNclLYIAQbzfqNigclvuUW7OEyOKpY3KZFURQKlgL3b9YNciExObr32igITg/exec";

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
