import { normalizeString } from "./types.js";

export function resolveNotebookUrl(notebookRef, baseUrl) {
    const ref = normalizeString(notebookRef);
    const base = normalizeString(baseUrl) || "https://notebooklm.google.com";
    if (!ref) return base;
    if (ref.startsWith("http://") || ref.startsWith("https://")) return ref;
    if (/^[A-Za-z0-9_-]{10,}$/.test(ref)) {
        return `${base.replace(/\/$/, "")}/notebook/${ref}`;
    }
    return base;
}

export async function openNotebookTab(tabsApi, notebookUrl) {
    if (!tabsApi || !notebookUrl) return null;
    try {
        return await tabsApi.create({ url: notebookUrl });
    } catch {
        return null;
    }
}

