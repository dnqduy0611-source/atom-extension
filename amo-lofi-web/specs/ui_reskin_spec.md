# Amo Lofi — UI/UX Reskin Specification

> **Goal:** Transform Amo Lofi from a "Productivity Dashboard" into an "Immersive Focus Sanctuary" (Interactive Cinematic Minimalism).
> **Tech Stack:** React 19 + Tailwind 4 + Framer Motion (existing).
> **Strategy:** Replace layout & presentation layers while preserving robust backend logic.

---

## 1. Core Visual Changes

| Component | Current State | New State (Cinematic) |
| :--- | :--- | :--- |
| **Main Layout** | Sidebar + Toolbar (Admin-like) | **Fullscreen Video + Floating Controls** |
| **Focus Timer** | Small widget in sidebar | **Giant Cinematic Clock (Center)** |
| **Navigation** | Fixed Left Sidebar | **Auto-hiding Floating Dock (Bottom)** |
| **Dashboard** | Tab inside a panel | **Glass Overlay (Modal)** |
| **Mixer** | Fixed Right Sidebar | **Floating Glass Panel (Draggable)** |

---

## 2. Component Migration Plan

### 2.1 The "Stage" (`App.tsx`)
*   **Remove:** `<Sidebar />`, `<Toolbar />`, `<QuickSettings />` (old version).
*   **Keep:** `<SceneBackground />`, `<OverlayEffects />`, `<AmbientGlow />`.
*   **Add:** `<CinematicClock />`, `<FloatingDock />`.
*   **Behavior:**
    *   **Focus Mode:** All UI fades out after 3s inactivity.
    *   **Zen Mode:** Only Clock remains (dimmed).

### 2.2 The "Anchor" (`CinematicClock.tsx`)
*   **Font:** `Geist Mono` / `Inter` (Size: `text-9xl` or dynamic `15vw`).
*   **Position:** Absolute Center.
*   **Features:**
    *   Hover → Play/Pause button.
    *   Below Clock → Minimal Input: "What are you working on?".
    *   Bottom Edge → Subtle Audio Visualizer (CSS Animation).

### 2.3 The "Control" (`FloatingDock.tsx`)
*   **Style:** MacOS-like Dock, frosted glass (`backdrop-blur-2xl`).
*   **Location:** Bottom Center (Fixed).
*   **Items:**
    *   🏠 Home (Focus)
    *   🎛️ Mixer (Sound)
    *   🖼️ Scenes (Background)
    *   📊 Stats (Dashboard)
    *   👤 Profile
*   **Interaction:** Icons scale up on hover (`scale-110`).

### 2.4 The "Panels" (Glass Overlays)
All panels (Mixer, Scenes, Stats) share a common **Glass Container**:
```css
.glass-panel {
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5);
}
```

---

## 3. Data Wiring (Preserving Logic)

We must ensure the new UI connects to existing Stores (`zustand`).

### 3.1 Mixer wiring
*   **UI:** `SoundMixer` (New UI).
*   **Logic:** `useLofiStore` (volume, mute, binaural).
    *   Slider changes → `setAmbienceVolume(id, val)`.
    *   Tab switch → `setActiveTab()`.

### 3.2 Clock wiring
*   **UI:** `CinematicClock`.
*   **Logic:** `useFocusStore` (time, status).
    *   Click Clock → `toggleTimer()`.
    *   Task Input → `setTaskName()`.

### 3.3 Auth wiring
*   **UI:** Profile Icon in Dock.
*   **Logic:** `useAuth` (Supabase).
    *   Click Profile → Show `UserMenu` (Popup).

---

## 4. Implementation Steps

1.  **Preparation:** Create `src/components/ui/GlassPanel.tsx` (reusable wrapper).
2.  **Navigation:** Build `FloatingDock.tsx` & integrate icons.
3.  **Core:** Build `CinematicClock.tsx` & connect to `useFocusStore`.
4.  **Reskin:** Rewrite `SoundMixer.tsx` using the new Glass style (keeping logic).
5.  **Assembly:** Update `App.tsx` to assemble the new layout.
6.  **Cleanup:** Delete `Sidebar.tsx`, `Toolbar.tsx`.

---

## 5. Visual Reference (Mental Model)
Think **Iron Man's HUD** meets **Lo-fi Girl**.
High-tech functionality, but cozy atmosphere.
