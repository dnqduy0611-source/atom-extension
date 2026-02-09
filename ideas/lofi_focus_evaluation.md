# Product Evaluation: Amo Lofi (AI-Orchestrated Focus Environments)

## 1. Concept Overview
**"Amo Lofi"** is a premium feature for AmoNexus (Web & Extension) that provides immersive, customizable focus environments similar to Lofi.co, but supercharged by Gemini AI.

**Core Value Proposition:**
Instead of manually selecting tracks/wallpapers, the user tells the AI their mood or task ("I'm writing a sad novel" or "Deep coding session"), and Gemini orchestrates the perfect audio-visual environment instantly.

### 1.1 Competitive Differentiation (vs Lofi.co)
| Feature | Traditional Apps (Lofi.co) | Amo Lofi |
| :--- | :--- | :--- |
| **Creation Flow** | **Manual**: User selects scenes, adjusts sliders for rain/wind individually. | **AI Orchestrated**: User states intent ("Focus for coding"), AI generates the mix. |
| **Personalization**| Limited to preset scenes. | **Generative**: Can create unique, non-existent environments (e.g., "Cyberpunk Library"). |
| **Goal** | Relaxation / Chill. | **Deep Work / Productivity**: Audio tailored to brainwave states (Alpha/Beta). |

## 2. Feature Breakdown & AI Integration

### A. The "Gemini DJ" (Orchestrator)
*   **Role**: The brain of the operation.
*   **Input**: User status ("Coding"), local weather, time of day, or direct prompt ("Cyberpunk city in rain").
*   **Process**: Gemini 1.5 Pro analyzes the intent and outputs a JSON configuration.
*   **Output**:
    ```json
    {
      "scene_id": "cyberpunk_highrise",
      "variant": "rainy_night",
      "audio_layers": [
        { "track": "rain_heavy", "volume": 0.6 },
        { "track": "neon_hum", "volume": 0.2 },
        { "track": "lofi_beats_sad", "volume": 0.8 }
      ],
      "visual_filters": { "brightness": 0.4, "blur": "5px" }
    }
    ```

### B. Generative Backgrounds (The "Killer Feature")
*   **Standard (Fast)**: Pre-rendered video loops (like Lofi.co). High quality, low latency.
*   **Pro (AI Generated)**: Use Imagen 3 (via Gemini API) to generate *static* high-res backgrounds based on user prompts, then apply subtle CSS animations (breathing, panning) or particle effects (rain overlay) to make them "alive" without needing expensive video generation.

### C. Cross-Platform Sync
*   **Web (AmoNexus)**: Full immersive experience (Full screen video, 3D audio).
*   **Extension (ATOM)**: Lightweight "Satellite" mode.
    *   Syncs the *Audio* and a static snapshot of the background to the side panel.
    *   **Focus Overlay Sync**: When "Focus Session" is active (fullscreen), the overlay (`#atom-focus-block`) also adopts the current Lofi background and audio, creating a seamless immersive environment.
    *   Controls (Play/Pause/Skip) sync instantly via Supabase Realtime.

## 3. Technical Feasibility (Rating: High)

| Component | Technology | Complexity | Notes |
| :--- | :--- | :--- | :--- |
| **Frontend** | React / Next.js | Medium | Managing audio context and video buffering is standard. |
| **Audio Engine** | Web Audio API | Medium | Need to build a multi-track mixer (Rain + Fire + Music). |
| **AI Logic** | Gemini 1.5 Pro | Low | Prompt engineering for JSON output is reliable. |
| **Sync** | Supabase Realtime | Low | Already in the tech stack. |
| **Assets** | CDN (R2/S3) | Medium | Video bandwidth can be costly. Need aggressive caching. |

## 4. Monetization Strategy (Tier: PRO)

This feature is a perfect driver for the **AmoNexus Pro** subscription.

*   **Free Tier**:
    *   3 Basic Scenes (Cafe, Bedroom, Nature).
    *   No AI Generation.
    *   Basic Audio Mixer (2 tracks max).
*   **Pro Tier ($X/month)**:
    *   **"Magic Mode"**: AI automatically adapts scene to your task (detected via active tab/content).
    *   **Unlimited Scenes**: Access to full library.
    *   **Custom AI Backgrounds**: Generate unique environments.
    *   **Cross-Device Sync**: Control web music from extension.

## 5. Development Roadmap (Phased)

### Phase 1: The "Lofi Player" (MVP)
*   Build a simple React component that plays a video loop and loops 2 audio tracks.
*   Hardcode 3 scenes.
*   No AI, No Sync.

### Phase 2: The "Gemini Bridge"
*   Implement the `text-to-config` prompt in Gemini.
*   Allow users to type "Make it rainy" -> App adjusts mixer volumes.

### Phase 3: The "Sync Ecosystem"
*   Connect Web and Extension via Supabase.
*   "Handoff" feature: Start on Web, continue on Extension.

## 6. Verdict
**GO FOR IT.**
*   It differentiates AmoNexus from simple "read it later" apps.
*   It leverages the "Second Brain" concept—not just storing info, but creating the *mental space* to process it.
*   Technically feasible with current Gemini models.
*   High perceived value for paid users.
