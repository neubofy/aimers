const API_URL = "https://script.google.com/macros/s/AKfycbzrgtW_KFHNclLYIAQbzfqNigclvuUW7OEyOKpY3KZFURQKlgL3b9YNciExObr32igITg/exec";

export const callApi = async (action, p = {}) => {
    const k = localStorage.getItem("aimers_key");
    if (!k) throw new Error("NO_KEY");
    const params = new URLSearchParams({ action, key: k, ...p });
    const res = await fetch(API_URL, { method: "POST", body: params });
    const j = await res.json();
    if (j.error) throw new Error(j.error);
    return j;
};
