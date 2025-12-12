const API_URL = "https://script.google.com/macros/s/AKfycbylrUYq6rdjmPAVNylynMCcdpAmUgSV7mXXz-0OsZ4SygkxvU-zrcFsWK6ROcMn2ksSxA/exec";

export const callApi = async (action, p = {}) => {
    const k = localStorage.getItem("aimers_key");
    if (!k) throw new Error("NO_KEY");
    const params = new URLSearchParams({ action, key: k, ...p });
    const res = await fetch(API_URL, { method: "POST", body: params });
    const j = await res.json();
    if (j.error) throw new Error(j.error);
    return j;
};
