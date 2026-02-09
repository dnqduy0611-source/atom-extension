# Specification: AmoNexus + OpenClaw Integration

## 1. Overview
This specification defines the integration between **AmoNexus** (Chrome Extension) and **OpenClaw** (Agentic Browser Orchestration Framework). The goal is to evolve AmoNexus from a passive reading assistant into an active, autonomous research agent.

## 2. Core Components

### 2.1 CDP Automation Bridge (Background Export)
- **Goal:** Enable "Zero-Click" background operations for cloud tools (e.g., NotebookLM).
- **Capability:**
    - Use Chrome DevTools Protocol (CDP) to drive a background browser instance.
    - **Logic:** `Sidepanel -> OpenClaw API -> CDP Sequence (Type/Click) -> Success Callback`.
    - **Session Sharing:** Use current browser cookies/session to bypass manual logins.

### 2.2 Snapshot Visual Engine
- **Goal:** Capture visual context beyond simple text selection.
- **Capability:**
    - Trigger `Snapshot API` on specific DIVs or regions highlighted by the user.
    - **AI-Enhanced Capture:** Use OpenClaw's "Element Numbering" to allow the LLM to understand spatial relationships (e.g., "Note relevant to image #5").
    - **Storage:** Save snapshots to local `/vault/assets` or cloud storage.

### 2.3 Proactive Heartbeat Assistant
- **Goal:** Autonomous research monitoring during offline hours.
- **Capability:**
    - **Crontab Orchestration:** OpenClaw runs a background loop every 6-12 hours.
    - **Research Watchlist:** Monitor sites like arXiv, PubMed, or specific domain blogs.
    - **Semantic Scoring:** Compare found content with local `RelatedMemory` tags.
    - **Push Notification:** Send a summary "Digest" to the AmoNexus `Services/InternalStorage` for next-session display.

## 3. Technical Architecture

### 3.1 Connector Service
- **Location:** `services/openclaw_bridge.js`
- **Responsibilities:**
    - Handle API authentication with OpenClaw Server.
    - Queueing background tasks.
    - Processing CDP state callbacks.

### 3.2 Security & Privacy
- **Sandbox:** OpenClaw runs automation in an isolated environment.
- **Sensitive Domains:** Exclude CDP automation on banking or private data sites (using existing `privacy_guard.js`).

## 4. Cost & Resource Estimations

| Item | Strategy | Est. Cost |
| :--- | :--- | :--- |
| **Infrastucture** | Local Hosting (Self-hosted) | $0 |
| **Infrastucture** | Cloud VPS (Small instance) | $5-10/mo |
| **LLM Tokens** | Gemini 1.5 Flash / OpenRouter Free | < $1/mo |

## 5. UI/UX Touchpoints
- **Sidepanel:** "Syncing via OpenClaw..." status indicators.
- **Toasts:** Real-time feedback from background CDP actions.
- **Settings:** Config for OpenClaw Server URL and Heartbeat frequency.
