Dưới đây là **bản “chỉnh sửa theo SPEC Focus Pomodoro” nhưng đặt đúng vào codebase ATOM v1.5.5 hiện tại** (kiến trúc đang có: `background.js` xử lý pipeline TICK + analytics, `content.js` render overlay/hard-interrupt, `popup.*` hiện chỉ có Safe Zone + menu). Manifest v1.5.5 đã đủ quyền `storage/tabs/scripting/alarms/contextMenus` để làm Pomodoro theo spec. 

Mình sẽ đưa theo kiểu **Trace-to-Code + Patch theo file** để bạn đưa thẳng cho **codex CLI** implement (ít lạc đường, không đụng pipeline hiện tại).

---

## 0) “Fit” vào v1.5.5: quyết định kiến trúc quan trọng

1. **Focus Mode là luồng độc lập**, ưu tiên cao hơn pipeline:

* Khi Focus block đang bật ⇒ **content.js dừng gửi TICK** (tránh pipeline xen ngang / spam).

2. **Storage-first đúng MV3**:

* `atom_focus_state` + `atom_focus_config` đọc/ghi từ `chrome.storage.local` làm source-of-truth.
* Service worker restart ⇒ **recover từ storage + reschedule alarm**.

3. **Attempt tracking đặt ở background** (khuyến nghị trong spec):

* Content chỉ báo “mình đang ở domain bị block” ⇒ background tăng attempt (có cooldown) và trả về escalation.

4. **Micro-closure cho Focus Mode**:

* `MicroClosureRenderer.js` hiện hardcode 2 nút “Snooze/Stop session” → **không khớp** “Quay lại/Allow” của Focus.
* V1.5.5 implement **Micro-closure riêng** ngay trong Focus Block UI (nhẹ nhàng, 2 nút Quay lại/Allow).

---

## 1) Trace-to-Code Index (map yêu cầu → file → điểm chạm)

### A. Background (Pomodoro core + storage + alarms + broadcast)

**File:** `/mnt/data/background.js`

* [NEW] Keys + default config/state helpers
* [NEW] `chrome.alarms.onAlarm` handler cho `ATOM_FOCUS_PHASE_END`
* [NEW] Recovery on startup (service worker wake)
* [NEW] Routes trong `chrome.runtime.onMessage`:

  * `FOCUS_START`, `FOCUS_STOP`, `FOCUS_GET_STATE`, `FOCUS_UPDATE_CONFIG`
  * `FOCUS_REPORT_ATTEMPT`, `FOCUS_ALLOW_TEMP`, `FOCUS_ADD_WHITELIST`
  * `FOCUS_CLOSE_TAB` (phục vụ “Quay lại” khi history không back được)
* [NEW] Broadcast: `ATOM_FOCUS_STATE_UPDATED` tới mọi tab (bỏ qua chrome://…)

### B. Content (Enforcement overlay whitelist-only + escalation micro→hard)

**File:** `/mnt/data/content.js`

* [NEW] `isFocusBlockActive`, `enforceFocusIfNeeded()`, `show/hide FocusBlock`
* [NEW] `chrome.runtime.onMessage.addListener` nhận `ATOM_FOCUS_STATE_UPDATED`
* [MOD] `sendTick()` thêm điều kiện **if focus block active → return**
* [MOD] `closeIntervention()` gọi `enforceFocusIfNeeded()` sau khi hard-interrupt completed/ignored (để “không thả trang”)

### C. Popup UI (Start/Stop, preset, countdown)

**Files:** `/mnt/data/popup.html`, `/mnt/data/popup.js`

* [NEW] “Focus Session” section + preset buttons + custom input + Start/Stop + countdown realtime
* [NEW] Poll mỗi 1s để update countdown dựa trên `phaseEndsAt` (không cần RAM sync)

### D. Styles

**File:** `/mnt/data/styles.css`

* [NEW] CSS cho `#atom-focus-block` (z-index < hard overlay)

---

## 2) Patch đề xuất (codex có thể apply trực tiếp)

> Mình đưa theo dạng “khối code cần chèn” + vị trí tương đối để codex patch vào file lớn dễ hơn.

---

# 2.1) `background.js` – thêm Focus Pomodoro engine

## (1) Thêm constants + default config + helpers

**Chèn gần đầu file (sau các const/let global hiện hữu, ví dụ sau `DEFAULT_WHITELIST`)**

```js
// ===== ATOM FOCUS POMODORO (v1) =====
const FOCUS_CONFIG_KEY = "atom_focus_config";
const FOCUS_STATE_KEY  = "atom_focus_state";
const FOCUS_ALARM_NAME = "ATOM_FOCUS_PHASE_END";

const DEFAULT_FOCUS_CONFIG = {
  workMin: 25,
  breakMin: 5,
  allowSec: 60,
  allowMaxPerWork: 2,
  breakPolicy: "FREE", // v1 default
  escalation: {
    microAt: 2,
    hardAt: 3,
    hardModeCycle: ["BREATH","TAP","STILLNESS"]
  },
  attemptCooldownMs: 8000
};

function normalizeDomainFromUrl(url) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function loadFocusConfig() {
  const data = await chrome.storage.local.get([FOCUS_CONFIG_KEY]);
  const cfg = data[FOCUS_CONFIG_KEY];
  if (!cfg) {
    await chrome.storage.local.set({ [FOCUS_CONFIG_KEY]: DEFAULT_FOCUS_CONFIG });
    return { ...DEFAULT_FOCUS_CONFIG };
  }
  // merge-safe (đỡ vỡ khi update)
  return {
    ...DEFAULT_FOCUS_CONFIG,
    ...cfg,
    escalation: { ...DEFAULT_FOCUS_CONFIG.escalation, ...(cfg.escalation || {}) }
  };
}

async function loadFocusState() {
  const data = await chrome.storage.local.get([FOCUS_STATE_KEY]);
  return data[FOCUS_STATE_KEY] || null;
}

async function saveFocusState(state) {
  await chrome.storage.local.set({ [FOCUS_STATE_KEY]: state });
}

function resetWorkCounters(state) {
  state.attempts = {};
  state.lastAttemptAt = {};
  state.allowUntil = {};
  state.allowUsedCount = 0;
}

function scheduleFocusAlarm(whenMs) {
  chrome.alarms.create(FOCUS_ALARM_NAME, { when: whenMs });
}

async function broadcastFocusState(state) {
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(
    tabs.map(async (t) => {
      if (!t.id || !t.url) return;
      const u = t.url;
      if (u.startsWith("chrome://") || u.startsWith("edge://") || u.startsWith("about:") || u.startsWith("chrome-extension://")) return;
      try {
        await chrome.tabs.sendMessage(t.id, { type: "ATOM_FOCUS_STATE_UPDATED", payload: { atom_focus_state: state } });
      } catch { /* ignore */ }
    })
  );
}

function pickHardMode(config, attempt) {
  const { hardAt, hardModeCycle } = config.escalation;
  const cycle = Array.isArray(hardModeCycle) && hardModeCycle.length ? hardModeCycle : ["BREATH","TAP","STILLNESS"];
  const idx = ((attempt - hardAt) % cycle.length + cycle.length) % cycle.length;
  return cycle[idx];
}
```

## (2) Thêm phase transition + recovery

**Chèn gần khu vực “setup / onInstalled / init” (bất kỳ trước `onMessage` đều OK)**

```js
async function focusHandlePhaseEnd() {
  const cfg = await loadFocusConfig();
  const st = await loadFocusState();
  if (!st?.enabled) return;

  const now = Date.now();
  if (now < st.phaseEndsAt) {
    // alarm lệch → reschedule đúng
    scheduleFocusAlarm(st.phaseEndsAt);
    return;
  }

  const prevPhase = st.phase;
  const nextPhase = prevPhase === "WORK" ? "BREAK" : "WORK";

  st.phase = nextPhase;
  st.phaseStartedAt = now;
  st.phaseEndsAt = now + (nextPhase === "WORK" ? cfg.workMin : cfg.breakMin) * 60 * 1000;
  resetWorkCounters(st);
  st.lastStateUpdatedAt = now;

  await saveFocusState(st);
  scheduleFocusAlarm(st.phaseEndsAt);
  await broadcastFocusState(st);

  // analytics tối thiểu
  chrome.runtime.sendMessage?.({}); // no-op safe in MV3 module (optional)
  // (nếu muốn log chuẩn theo hệ thống hiện có:)
  // enqueueRollupWrite(() => updateDailyRollupFromEvent({timestamp: now, event: `FOCUS_PHASE_${nextPhase}`, mode: "FOCUS", duration_ms: null}));
}

async function focusEnsureRecoveryOnStartup() {
  const st = await loadFocusState();
  if (!st?.enabled) return;

  const now = Date.now();
  if (now >= st.phaseEndsAt) {
    await focusHandlePhaseEnd(); // tự chuyển phase ngay
    return;
  }
  scheduleFocusAlarm(st.phaseEndsAt);
  await broadcastFocusState(st);
}
```

## (3) Đăng ký alarm listener + gọi recovery ngay khi SW chạy

**Chèn ở scope top-level (ngoài onMessage), ví dụ gần các listener khác:**

```js
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== FOCUS_ALARM_NAME) return;
  await focusHandlePhaseEnd();
});

// MV3: service worker wake → recover
focusEnsureRecoveryOnStartup().catch(() => {});
```

## (4) Thêm message routes cho Focus

**Trong `chrome.runtime.onMessage.addListener(...)`**, đặt **TRƯỚC** route `TICK` để ưu tiên:

```js
// ===== ROUTE FOCUS (Pomodoro) =====
if (request.type === "FOCUS_GET_STATE") {
  (async () => {
    const st = await loadFocusState();
    sendResponse({ ok: true, atom_focus_state: st });
  })();
  return true;
}

if (request.type === "FOCUS_START") {
  (async () => {
    const cfg = await loadFocusConfig();
    const now = Date.now();

    // optional override work/break (preset từ popup)
    const workMin = Number(request.payload?.workMin ?? cfg.workMin);
    const breakMin = Number(request.payload?.breakMin ?? cfg.breakMin);

    const nextCfg = { ...cfg, workMin, breakMin };
    await chrome.storage.local.set({ [FOCUS_CONFIG_KEY]: nextCfg });

    const st = {
      enabled: true,
      sessionId: `${now}_${Math.random().toString(16).slice(2)}`,
      phase: "WORK",
      phaseStartedAt: now,
      phaseEndsAt: now + workMin * 60 * 1000,
      attempts: {},
      lastAttemptAt: {},
      allowUntil: {},
      allowUsedCount: 0,
      lastStateUpdatedAt: now
    };

    await saveFocusState(st);
    scheduleFocusAlarm(st.phaseEndsAt);
    await broadcastFocusState(st);

    // log event tối thiểu
    chrome.storage.local.get(['atom_events'], (r) => {
      const cur = r.atom_events || [];
      cur.push({ timestamp: now, event: "FOCUS_START", mode: "FOCUS", context: {} });
      chrome.storage.local.set({ atom_events: cur.slice(-2000) });
    });

    sendResponse({ ok: true, atom_focus_state: st });
  })();
  return true;
}

if (request.type === "FOCUS_STOP") {
  (async () => {
    const st = await loadFocusState();
    const now = Date.now();
    chrome.alarms.clear(FOCUS_ALARM_NAME);

    const next = st ? { ...st, enabled: false, lastStateUpdatedAt: now } : { enabled: false };
    await saveFocusState(next);
    await broadcastFocusState(next);

    chrome.storage.local.get(['atom_events'], (r) => {
      const cur = r.atom_events || [];
      cur.push({ timestamp: now, event: "FOCUS_STOP", mode: "FOCUS", context: {} });
      chrome.storage.local.set({ atom_events: cur.slice(-2000) });
    });

    sendResponse({ ok: true, atom_focus_state: next });
  })();
  return true;
}

if (request.type === "FOCUS_UPDATE_CONFIG") {
  (async () => {
    const cfg = await loadFocusConfig();
    const patch = request.payload || {};
    const next = {
      ...cfg,
      ...patch,
      escalation: { ...cfg.escalation, ...(patch.escalation || {}) }
    };
    await chrome.storage.local.set({ [FOCUS_CONFIG_KEY]: next });
    sendResponse({ ok: true, atom_focus_config: next });
  })();
  return true;
}

if (request.type === "FOCUS_ALLOW_TEMP") {
  (async () => {
    const cfg = await loadFocusConfig();
    const st = await loadFocusState();
    const now = Date.now();
    const domain = (request.payload?.domain || "").toLowerCase();
    const sec = Number(request.payload?.sec ?? cfg.allowSec);

    if (!st?.enabled || st.phase !== "WORK") {
      sendResponse({ ok: false, reason: "NOT_IN_WORK" });
      return;
    }
    if (st.allowUsedCount >= cfg.allowMaxPerWork) {
      sendResponse({ ok: false, reason: "ALLOW_QUOTA_EXCEEDED" });
      return;
    }

    st.allowUntil = st.allowUntil || {};
    st.allowUntil[domain] = now + sec * 1000;
    st.allowUsedCount = (st.allowUsedCount || 0) + 1;
    st.lastStateUpdatedAt = now;

    await saveFocusState(st);
    await broadcastFocusState(st);

    sendResponse({ ok: true, allowUntil: st.allowUntil[domain], allowUsedCount: st.allowUsedCount });
  })();
  return true;
}

if (request.type === "FOCUS_REPORT_ATTEMPT") {
  (async () => {
    const cfg = await loadFocusConfig();
    const st = await loadFocusState();
    const now = Date.now();
    const domain = (request.payload?.domain || "").toLowerCase();

    if (!st?.enabled || st.phase !== "WORK") {
      sendResponse({ ok: false, reason: "NOT_IN_WORK" });
      return;
    }

    // cooldown per-domain
    st.lastAttemptAt = st.lastAttemptAt || {};
    st.attempts = st.attempts || {};
    const lastAt = st.lastAttemptAt[domain] || 0;

    if (now - lastAt < cfg.attemptCooldownMs) {
      const attempt = st.attempts[domain] || 0;
      sendResponse({ ok: true, attempt, escalation: "NONE" });
      return;
    }

    const attempt = (st.attempts[domain] || 0) + 1;
    st.attempts[domain] = attempt;
    st.lastAttemptAt[domain] = now;
    st.lastStateUpdatedAt = now;

    await saveFocusState(st);
    await broadcastFocusState(st);

    let escalation = "NONE";
    let hardMode = null;

    if (attempt >= cfg.escalation.hardAt) {
      escalation = "HARD";
      hardMode = pickHardMode(cfg, attempt);
    } else if (attempt >= cfg.escalation.microAt) {
      escalation = "MICRO";
    }

    sendResponse({ ok: true, attempt, escalation, hardMode });
  })();
  return true;
}

if (request.type === "FOCUS_ADD_WHITELIST") {
  (async () => {
    const domain = (request.payload?.domain || "").toLowerCase().replace(/^www\./, "");
    const { atom_whitelist } = await chrome.storage.local.get(['atom_whitelist']);
    const list = Array.isArray(atom_whitelist) ? atom_whitelist : DEFAULT_WHITELIST;

    if (!list.includes(domain)) {
      await chrome.storage.local.set({ atom_whitelist: [...list, domain] });
    }
    const st = await loadFocusState();
    if (st?.enabled) await broadcastFocusState(st);

    sendResponse({ ok: true });
  })();
  return true;
}

if (request.type === "FOCUS_CLOSE_TAB") {
  const tabId = sender.tab?.id;
  if (tabId) chrome.tabs.remove(tabId);
  sendResponse({ ok: true });
  return true;
}
```

> Lưu ý: các route Focus trên **không đụng** pipeline `handleTick()` hiện hữu trong v1.5.5.

---

# 2.2) `content.js` – enforcement “block thật bằng overlay” + escalation

## (1) Thêm biến Focus + URL watcher

**Chèn gần phần init biến (ngay sau `let isJournalActive...`)**

```js
// ===== ATOM FOCUS (Pomodoro) =====
let isFocusBlockActive = false;
let lastFocusUrl = location.href;
let focusRecheckTimer = null;
let focusAllowTimer = null;

// expose hook để gọi lại sau hard-interrupt
window.__ATOM_FOCUS_ENFORCE__ = (reason) => {
  enforceFocusIfNeeded(reason).catch(() => {});
};
```

## (2) Tạo Focus Block UI trong shadow

**Sau khi bạn append `overlay`, `presenceOrb`, `journalDialog`…** (chỗ nào cũng được miễn là trong `shadow`):

```js
const focusBlock = document.createElement('div');
focusBlock.id = 'atom-focus-block';
focusBlock.classList.add('hidden');
focusBlock.innerHTML = `
  <div class="focus-card">
    <div class="focus-title">Bạn đang trong Focus</div>
    <div class="focus-sub" id="atom-focus-sub">Trang này không nằm trong Safe Zone.</div>
    <div class="focus-timer" id="atom-focus-timer">...</div>

    <div class="focus-actions">
      <button class="focus-btn primary" id="atom-focus-back">Quay lại</button>
      <button class="focus-btn" id="atom-focus-allow-60">Allow 60s</button>
      <button class="focus-btn" id="atom-focus-allow-120">Allow 120s</button>
    </div>

    <div class="focus-actions secondary">
      <button class="focus-btn ghost" id="atom-focus-add-safe">Thêm Safe Zone</button>
    </div>

    <div class="focus-micro hidden" id="atom-focus-micro">
      <div class="focus-micro-text">Mình thấy bạn đang “định quay lại” 🙂 Nhẹ thôi: quay lại Safe Zone, hoặc xin 60s có kiểm soát.</div>
    </div>
  </div>
`;
shadow.appendChild(focusBlock);
```

## (3) CSS cho Focus Block

**Thêm vào `/mnt/data/styles.css`** (cuối file là dễ nhất):

```css
/* ===== ATOM Focus Block (Pomodoro) ===== */
#atom-focus-block {
  position: fixed;
  inset: 0;
  z-index: 2147483646; /* thấp hơn #atom-overlay (hard) */
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(5,5,5,0.78);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  pointer-events: auto;
}

#atom-focus-block.hidden { display: none !important; }

#atom-focus-block .focus-card{
  width: min(520px, calc(100vw - 40px));
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.04);
  border-radius: 20px;
  padding: 18px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.55);
}

#atom-focus-block .focus-title{
  font-size: 16px;
  font-weight: 700;
  color: var(--atom-text);
  margin-bottom: 6px;
}

#atom-focus-block .focus-sub{
  font-size: 13px;
  color: var(--atom-text-muted);
  margin-bottom: 10px;
}

#atom-focus-block .focus-timer{
  font-size: 12px;
  color: var(--atom-text-muted);
  margin-bottom: 14px;
}

#atom-focus-block .focus-actions{
  display:flex;
  gap:10px;
  flex-wrap: wrap;
}

#atom-focus-block .focus-actions.secondary{
  margin-top: 10px;
}

#atom-focus-block .focus-btn{
  cursor: pointer;
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(255,255,255,0.02);
  color: var(--atom-text);
  padding: 10px 12px;
  border-radius: 14px;
  font-weight: 600;
  font-size: 13px;
}

#atom-focus-block .focus-btn.primary{
  background: rgba(16,185,129,0.14);
  border-color: rgba(16,185,129,0.35);
}

#atom-focus-block .focus-btn.ghost{
  background: transparent;
  color: var(--atom-text-muted);
}

#atom-focus-block .focus-micro{
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.03);
  color: var(--atom-text-muted);
  font-size: 12px;
}
#atom-focus-block .focus-micro.hidden{ display:none; }
```

## (4) Implement `enforceFocusIfNeeded()` + bindings button

**Chèn sau phần UI setup (trước `dispatchFromPipeline` là hợp lý):**

```js
function fmtRemaining(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function getCurrentDomain() {
  try {
    return new URL(location.href).hostname.toLowerCase().replace(/^www\./, "");
  } catch { return ""; }
}

function showFocusBlockUI() {
  if (!focusBlock) return;
  focusBlock.classList.remove('hidden');
  isFocusBlockActive = true;
}

function hideFocusBlockUI() {
  if (!focusBlock) return;
  focusBlock.classList.add('hidden');
  isFocusBlockActive = false;
  // ẩn micro hint nếu có
  const micro = shadow.getElementById("atom-focus-micro");
  micro?.classList.add("hidden");
}

async function enforceFocusIfNeeded(reason = "tick") {
  const domain = getCurrentDomain();
  if (!domain) return;

  const store = await chrome.storage.local.get(["atom_whitelist", "atom_focus_state", "atom_focus_config"]);
  const st = store.atom_focus_state;
  const cfg = store.atom_focus_config;

  // Focus off → đảm bảo tắt block
  if (!st?.enabled) {
    hideFocusBlockUI();
    return;
  }

  // BREAK default FREE → không block
  if (st.phase !== "WORK") {
    hideFocusBlockUI();
    return;
  }

  const whitelist = store.atom_whitelist || [];
  const isSafe = Array.isArray(whitelist) && whitelist.includes(domain);

  // allow window
  const allowUntil = st.allowUntil?.[domain] || 0;
  const now = Date.now();
  const isAllowed = now < allowUntil;

  // timer text
  const timerEl = shadow.getElementById("atom-focus-timer");
  if (timerEl) timerEl.textContent = `WORK còn ${fmtRemaining(st.phaseEndsAt - now)}`;

  if (isSafe || isAllowed) {
    hideFocusBlockUI();
    return;
  }

  // blocked
  showFocusBlockUI();

  // cập nhật quota allow
  const allow60 = shadow.getElementById("atom-focus-allow-60");
  const allow120 = shadow.getElementById("atom-focus-allow-120");
  const used = st.allowUsedCount || 0;
  const max = cfg?.allowMaxPerWork ?? 2;
  const allowOk = used < max;
  if (allow60) allow60.style.display = allowOk ? "inline-flex" : "none";
  if (allow120) allow120.style.display = allowOk ? "inline-flex" : "none";

  // report attempt (background sẽ cooldown)
  const attemptResp = await chrome.runtime.sendMessage({
    type: "FOCUS_REPORT_ATTEMPT",
    payload: { domain, url: location.href }
  });

  if (attemptResp?.ok) {
    const microEl = shadow.getElementById("atom-focus-micro");
    if (attemptResp.escalation === "MICRO") {
      microEl?.classList.remove("hidden");
    } else if (attemptResp.escalation === "HARD") {
      // gọi hard interrupt mode có sẵn
      const mode = attemptResp.hardMode || "BREATH";
      // đảm bảo không bị pipeline xen ngang
      isInterventionActive = true;
      microRenderer?.remove?.();
      resetUI();

      if (mode === "STILLNESS") startStillnessMode();
      else if (mode === "TAP") startTapHoldMode();
      else startBreathingMode();
    }
  }
}

// bind buttons (1 lần)
const btnBack = shadow.getElementById("atom-focus-back");
const btnAllow60 = shadow.getElementById("atom-focus-allow-60");
const btnAllow120 = shadow.getElementById("atom-focus-allow-120");
const btnAddSafe = shadow.getElementById("atom-focus-add-safe");

if (btnBack) btnBack.onclick = async () => {
  // ưu tiên history.back
  const before = location.href;
  if (history.length > 1) {
    history.back();
    setTimeout(() => window.__ATOM_FOCUS_ENFORCE__?.("back"), 350);
  } else {
    chrome.runtime.sendMessage({ type: "FOCUS_CLOSE_TAB" });
  }
};

async function doAllow(sec) {
  const domain = getCurrentDomain();
  const resp = await chrome.runtime.sendMessage({ type: "FOCUS_ALLOW_TEMP", payload: { domain, sec } });
  if (resp?.ok) {
    hideFocusBlockUI();
    clearTimeout(focusAllowTimer);
    focusAllowTimer = setTimeout(() => window.__ATOM_FOCUS_ENFORCE__?.("allow_expired"), sec * 1000 + 50);
  }
}

if (btnAllow60) btnAllow60.onclick = () => doAllow(60);
if (btnAllow120) btnAllow120.onclick = () => doAllow(120);

if (btnAddSafe) btnAddSafe.onclick = async () => {
  const domain = getCurrentDomain();
  await chrome.runtime.sendMessage({ type: "FOCUS_ADD_WHITELIST", payload: { domain } });
  hideFocusBlockUI();
};
```

## (5) Thêm listener nhận broadcast từ background

**Chèn 1 lần ở cuối setup (trước setInterval sendTick):**

```js
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "ATOM_FOCUS_STATE_UPDATED") {
    // state update → enforce ngay
    window.__ATOM_FOCUS_ENFORCE__?.("broadcast");
  }
});
```

## (6) URL change watcher (SPA)

**Chèn cuối file (trước/hoặc sau setInterval sendTick), để phát hiện `location.href` đổi:**

```js
// SPA URL watcher: mỗi 1s check url đổi
focusRecheckTimer = setInterval(() => {
  if (location.href !== lastFocusUrl) {
    lastFocusUrl = location.href;
    window.__ATOM_FOCUS_ENFORCE__?.("url_changed");
  }
}, 1000);

// enforce ngay khi load
window.__ATOM_FOCUS_ENFORCE__?.("init");
```

## (7) Dừng TICK khi Focus block active

Trong `sendTick()` hiện có:

```js
// Nếu đang bị can thiệp hoặc viết nhật ký -> Không đếm giờ
if (isInterventionActive || isJournalActive) {
  lastTickAt = Date.now();
  return;
}
```

**Sửa thành:**

```js
if (isInterventionActive || isJournalActive || isFocusBlockActive) {
  lastTickAt = Date.now();
  return;
}
```

## (8) Sau khi hard-interrupt kết thúc: enforce lại Focus

Trong `closeIntervention(...)` (đang có sẵn), **thêm cuối hàm**:

```js
// Sau khi đóng hard-interrupt/micro: nếu đang Focus WORK và domain không allow/whitelist → block lại
setTimeout(() => window.__ATOM_FOCUS_ENFORCE__?.("after_intervention"), 80);
```

---

# 2.3) `popup.html` + `popup.js` – Focus section

## (1) popup.html: thêm section “Focus Session”

Chèn dưới Safe Zone card (hoặc trước menu-grid):

```html
<div class="safe-zone-card" style="padding-top:14px;">
  <div style="font-weight:700; margin-bottom:10px;">Focus Session</div>

  <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:center; margin-bottom:10px;">
    <button class="btn-toggle-status" id="focus-preset-25">25/5</button>
    <button class="btn-toggle-status" id="focus-preset-30">30/6</button>
    <button class="btn-toggle-status" id="focus-preset-40">40/8</button>
    <button class="btn-toggle-status" id="focus-preset-50">50/10</button>
    <button class="btn-toggle-status" id="focus-preset-10">10/2</button>
  </div>

  <div style="display:flex; gap:8px; justify-content:center; margin-bottom:10px;">
    <input id="focus-work" type="number" min="1" placeholder="Work (min)" style="width:120px; padding:8px 10px; border-radius:12px; border:1px solid var(--border); background:var(--surface); color:var(--foreground);">
    <input id="focus-break" type="number" min="1" placeholder="Break (min)" style="width:120px; padding:8px 10px; border-radius:12px; border:1px solid var(--border); background:var(--surface); color:var(--foreground);">
  </div>

  <div style="display:flex; gap:10px; justify-content:center;">
    <button class="btn-toggle-status active" id="focus-start">Start</button>
    <button class="btn-toggle-status" id="focus-stop" style="display:none;">Stop</button>
  </div>

  <div class="status-subtext" id="focus-status" style="margin-top:10px;">—</div>
</div>
```

## (2) popup.js: logic Start/Stop + countdown realtime

Chèn vào `DOMContentLoaded` (cuối file là dễ):

```js
const elStatus = document.getElementById("focus-status");
const btnStart = document.getElementById("focus-start");
const btnStop  = document.getElementById("focus-stop");
const inWork = document.getElementById("focus-work");
const inBreak = document.getElementById("focus-break");

function fmt(ms){
  const s = Math.max(0, Math.floor(ms/1000));
  const mm = String(Math.floor(s/60)).padStart(2,"0");
  const ss = String(s%60).padStart(2,"0");
  return `${mm}:${ss}`;
}

async function getFocusState(){
  const resp = await chrome.runtime.sendMessage({ type: "FOCUS_GET_STATE" });
  return resp?.atom_focus_state || null;
}

function render(st){
  if (!elStatus) return;
  if (!st?.enabled){
    elStatus.textContent = "Focus: OFF";
    if (btnStart) btnStart.style.display = "inline-flex";
    if (btnStop) btnStop.style.display = "none";
    return;
  }
  const now = Date.now();
  elStatus.textContent = `${st.phase} còn ${fmt(st.phaseEndsAt - now)}`;
  if (btnStart) btnStart.style.display = "none";
  if (btnStop) btnStop.style.display = "inline-flex";
}

async function startFocus(workMin, breakMin){
  await chrome.runtime.sendMessage({ type:"FOCUS_START", payload:{ workMin, breakMin }});
  const st = await getFocusState();
  render(st);
}

async function stopFocus(){
  await chrome.runtime.sendMessage({ type:"FOCUS_STOP" });
  const st = await getFocusState();
  render(st);
}

if (btnStart) btnStart.onclick = async () => {
  const w = Number(inWork?.value || 25);
  const b = Number(inBreak?.value || 5);
  await startFocus(w,b);
};

if (btnStop) btnStop.onclick = stopFocus;

// preset buttons
const preset = (id,w,b) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.onclick = () => { if(inWork) inWork.value = w; if(inBreak) inBreak.value = b; startFocus(w,b); };
};
preset("focus-preset-25",25,5);
preset("focus-preset-30",30,6);
preset("focus-preset-40",40,8);
preset("focus-preset-50",50,10);
preset("focus-preset-10",10,2);

// initial + realtime tick
let focusUiTimer = null;
(async () => {
  const st = await getFocusState();
  render(st);
  clearInterval(focusUiTimer);
  focusUiTimer = setInterval(async () => {
    const st2 = await getFocusState();
    render(st2);
  }, 1000);
})();
```

---

## 3) Checklist “Done” đúng Acceptance Criteria (spec)

* Start Focus từ popup ⇒ `atom_focus_state.enabled=true`, phase WORK, countdown chạy.
* WORK: mở domain ngoài whitelist ⇒ **Focus Block overlay** chặn click/scroll (pointer-events + full-screen).
* Allow 60/120s ⇒ được thao tác đúng thời gian; hết thời gian ⇒ block lại.
* Attempt quay lại nhiều lần:

  * attempt 2 ⇒ hiện “micro hint card” (trong Focus Block).
  * attempt 3 ⇒ trigger hard-interrupt (BREATH/TAP/STILLNESS luân phiên).
* Alarm hết WORK/BREAK ⇒ tự flip phase + broadcast.
* Service worker restart ⇒ recovery từ storage + reschedule alarm.
* Stop Focus ⇒ tắt block ngay.

---

## 4) Hai “bẫy MV3” trong v1.5.5 bạn nên giữ đúng

1. **Không dùng RAM làm truth** cho focus state/attempts/allow — luôn đọc storage (trên đã làm).
2. **Broadcast gửi vào mọi tab** phải bỏ qua `chrome://` / `chrome-extension://` để tránh throw (trên đã filter).

---

Nếu bạn muốn, mình có thể viết tiếp một **“Codex Task Plan” dạng từng commit nhỏ** (Commit 1 background-only, Commit 2 popup, Commit 3 content block, Commit 4 escalation, Commit 5 analytics) để codex chạy tuần tự và dễ review PR.
