# MINI-AGENTS INTEGRATION SPECIFICATION (AmoNexus)

## 1. Overview & Vision
This document outlines the architecture and implementation plan for embedding "Mini-Agents" into AmoNexus. The goal is to transform the Sidepanel from a passive chat interface into an **active orchestrator** that can personalize the user's workspace on demand.

**Core Concept:** User chat commands (Intent) -> Sidepanel (Orchestrator) -> Mini-Agent Execution (DOM/Audio/Logic).

## 2. Agent Roles

### 2.1. Ambience Agent (Visuals)
*   **Purpose:** Create visual focus environments.
*   **Capabilities:**
    *   Change page background (overlay image/video).
    *   Apply color filters (sepia, dark mode, high contrast).
    *   Control "Zen Mode" (hide distracting elements on the page).
*   **Example Intents:**
    *   "Bật chế độ rừng mưa" (Rainforest mode).
    *   "Làm tối màn hình đi chút" (Dim screen).

### 2.2. DJ Agent (Audio)
*   **Purpose:** Manage auditory focus environment.
*   **Capabilities:**
    *   Play/Pause/Loop focus tracks (White noise, Lo-fi, Nature sounds).
    *   Mix sounds (e.g., Rain + Fireplace).
*   **Example Intents:**
    *   "Bật nhạc tập trung" (Play focus music).
    *   "Thêm tiếng mưa" (Add rain sound).

### 2.3. Active Reading Agent (Cognitive Lens)
*   **Purpose:** Enhance information absorption via specific "Lenses".
*   **Capabilities:**
    *   Switch System Prompts for the AI (e.g., "Critic", "Simplifier", "Academic").
    *   Auto-generate specific outputs based on the lens (e.g., "Summarize 5 key points").
*   **Example Intents:**
    *   "Đọc bài này dưới góc nhìn chuyên gia phản biện" (Critical analysis).
    *   "Giải thích cho trẻ con 5 tuổi" (Simplify).

## 3. Technical Architecture

### 3.1. The "Brain" (Sidepanel.js)
*   **Intent Router:** A lightweight logic layer to parse user input.
    *   *Mechanism:* Regex patterns (Phase 1) -> LLM Classification (Phase 2).
*   **Command Dispatcher:** Sends standardized messages to `background.js` or `content.js`.

### 3.2. Communications (Message Bus)
*   **Sidepanel -> Content:** via `chrome.tabs.sendMessage` (for Visuals/DOM).
*   **Sidepanel -> Background:** via `chrome.runtime.sendMessage` (for Audio/State).
*   **Standard Scheme:**
    ```json
    {
      "type": "AGENT_COMMAND",
      "agent": "AMBIENCE", // or "DJ", "READING"
      "action": "SET_THEME",
      "payload": { "id": "rainforest", "intensity": 0.8 }
    }
    ```

### 3.3. Asset Management
*   **Phase 1 (MVP):** Bundled assets (local MP3s, optimized JPGS).
*   **Phase 2 (Cloud):** Stream from external URL or AmoNexus CDN to reduce extension size.

## 4. Implementation Constraints & Solutions
*   **Constraint:** DOM Access. `sidepanel.js` cannot touch the page DOM directly.
*   **Solution:** Must route through `content.js`. `content.js` will expose an `AgentExecutor` interface to handle DOM manipulation safely within the Shadow DOM or main document.
*   **Constraint:** Audio persistence. Audio stops if the tab closes (if played in Content Script).
*   **Solution:** Play audio internally in `options.html` (hidden) or `sidepanel.js` (keeps playing if panel open), or Offscreen Document (for robust background audio). *Recommendation: Offscreen Document for Phase 2.*

## 5. Roadmap

### Phase 1: Proof of Concept (The "Rain" Demo)
*   [ ] Intent: "rain" -> Triggers command.
*   [ ] Visual: Show a full-screen rain overlay (CSS/GIF).
*   [ ] Audio: Play `rain.mp3`.
*   [ ] UI: Simple toggle in chat.

### Phase 2: The Agent Registry
*   [ ] Structured "Tool" definition in `sidepanel.js`.
*   [ ] Dynamic UI in Sidepanel to show active agents.

### Phase 3: Smart Context
*   [ ] Auto-trigger agents based on behavior (e.g., scrolling fast -> suggest "Focus Music").
