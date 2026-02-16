const MAX_VIEW_EVENTS = 50;
let viewEvents = [];
let maxEvents = MAX_VIEW_EVENTS;
let tabFilter = null;
let realtimeEnabled = true;
let debugEnabled = false;
let port = null;

const BUILD_FLAGS = window.ATOM_BUILD_FLAGS || { DEBUG: false };
const BUILD_DEBUG_ENABLED = !!BUILD_FLAGS.DEBUG;

const elLatest = document.getElementById("latest");
const elHistory = document.getElementById("history-list");
const elHistoryCount = document.getElementById("history-count");
const elToggle = document.getElementById("toggle-realtime");
const elRefresh = document.getElementById("btn-refresh");
const elClear = document.getElementById("btn-clear");
const elTabInput = document.getElementById("tab-id");
const elLoadTab = document.getElementById("btn-load-tab");
const elStatus = document.getElementById("debug-status");

function setStatus(text) {
    if (!elStatus) return;
    elStatus.textContent = text || "";
}

function setControlsDisabled(disabled) {
    const controls = [elToggle, elRefresh, elClear, elTabInput, elLoadTab];
    controls.forEach((el) => {
        if (!el) return;
        el.disabled = !!disabled;
    });
}

function formatTime(ts) {
    if (!ts) return "-";
    return new Date(ts).toLocaleTimeString();
}

function formatNumber(value) {
    if (typeof value !== "number") return "-";
    return value.toFixed(3);
}

function renderLatest() {
    if (!elLatest) return;
    if (!viewEvents.length) {
        elLatest.textContent = "No events yet.";
        return;
    }
    const latest = viewEvents[0];
    elLatest.textContent = JSON.stringify(latest, null, 2);
}

function renderHistory() {
    if (!elHistory) return;
    elHistory.textContent = "";
    const count = viewEvents.length;
    if (elHistoryCount) {
        elHistoryCount.textContent = `${count} events`;
    }
    if (!count) return;

    viewEvents.forEach((evt) => {
        const item = document.createElement("li");
        item.className = "history-item";

        const main = document.createElement("div");
        main.className = "history-main";

        const title = document.createElement("div");
        title.className = "history-title-line";
        const label = `${evt.kind || "unknown"} • ${evt.label || "unknown"}`;
        title.textContent = label;

        const badge = document.createElement("span");
        badge.className = `badge ${evt.usedAI ? "badge-ai" : "badge-fallback"}`;
        badge.textContent = evt.usedAI ? "AI" : "fallback";

        title.appendChild(badge);

        const time = document.createElement("div");
        time.className = "history-time";
        time.textContent = formatTime(evt.ts);

        main.appendChild(title);
        main.appendChild(time);

        const sub = document.createElement("div");
        sub.className = "history-sub";
        const parts = [];
        if (typeof evt.tabId === "number") parts.push(`tab:${evt.tabId}`);
        if (evt.confidence != null) parts.push(`confidence:${formatNumber(evt.confidence)}`);
        if (evt.minConfidence != null) parts.push(`threshold:${formatNumber(evt.minConfidence)}`);
        if (evt.reason) parts.push(`reason:${evt.reason}`);
        if (evt.latencyMs != null) parts.push(`latency:${Math.round(evt.latencyMs)}ms`);
        sub.textContent = parts.join(" • ");

        item.appendChild(main);
        item.appendChild(sub);
        elHistory.appendChild(item);
    });
}

function renderAll() {
    renderLatest();
    renderHistory();
}

function applySnapshot(events) {
    const list = Array.isArray(events) ? events : [];
    viewEvents = list.slice(-maxEvents).reverse();
    renderAll();
}

function pushEvent(evt) {
    viewEvents.unshift(evt);
    if (viewEvents.length > maxEvents) {
        viewEvents = viewEvents.slice(0, maxEvents);
    }
    renderAll();
}

function matchFilter(evt) {
    if (tabFilter == null) return true;
    return evt?.tabId === tabFilter;
}

function disconnectPort() {
    if (port) {
        try {
            port.disconnect();
        } catch (_) { }
        port = null;
    }
}

function connectPort() {
    if (!BUILD_DEBUG_ENABLED) return;
    if (!realtimeEnabled) return;
    if (port) return;
    try {
        port = chrome.runtime.connect({ name: "ATOM_DEBUG_PORT" });
        port.onMessage.addListener((msg) => {
            if (!msg) return;
            if (msg.type === "ATOM_DEBUG_SNAPSHOT") {
                const events = msg.payload?.events || [];
                const filtered = tabFilter == null ? events : events.filter(matchFilter);
                applySnapshot(filtered);
                return;
            }
            if (msg.type === "ATOM_DEBUG_EVENT") {
                const evt = msg.payload;
                if (matchFilter(evt)) pushEvent(evt);
            }
        });
        port.onDisconnect.addListener(() => {
            port = null;
        });
    } catch (e) {
        port = null;
    }
}

async function fetchState() {
    if (!BUILD_DEBUG_ENABLED) {
        setStatus("Dev panel disabled in public builds.");
        return;
    }
    const resp = await chrome.runtime.sendMessage({
        type: "ATOM_DEBUG_GET_STATE",
        tabId: tabFilter
    });
    if (!resp) return;
    debugEnabled = !!resp.enabled;
    maxEvents = resp.maxEvents || MAX_VIEW_EVENTS;
    const source = tabFilter == null ? resp.events : resp.tabEvents;
    applySnapshot(source);
    setStatus(debugEnabled ? "" : "Debug mode is OFF");
}

function parseTabIdInput() {
    const raw = elTabInput?.value?.trim();
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
}

function setTabFilter(next) {
    tabFilter = next;
}

if (elToggle) {
    elToggle.checked = true;
    elToggle.addEventListener("change", async () => {
        realtimeEnabled = !!elToggle.checked;
        if (realtimeEnabled) connectPort();
        else disconnectPort();
    });
}

if (elRefresh) {
    elRefresh.addEventListener("click", () => {
        fetchState();
    });
}

if (elClear) {
    elClear.addEventListener("click", () => {
        viewEvents = [];
        renderAll();
    });
}

if (elLoadTab) {
    elLoadTab.addEventListener("click", () => {
        const next = parseTabIdInput();
        setTabFilter(next);
        fetchState();
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    if (!BUILD_DEBUG_ENABLED) {
        setControlsDisabled(true);
        setStatus("Dev panel disabled in public builds.");
        return;
    }
    const debugState = await chrome.storage.local.get(['debug_mode']);
    if (!debugState.debug_mode) {
        setStatus("Debug mode is OFF. Enable it in Settings.");
    }
    await fetchState();
    if (debugState.debug_mode) {
        connectPort();
    }
});
