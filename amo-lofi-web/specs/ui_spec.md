# Amo Lofi — UI/Design Spec (Cinematic HUD)

## Direction: Immersive Cinematic HUD
Background 100% màn hình. UI auto-hide. Floating widgets. User cảm thấy **đang ở trong scene**.

## Layout
```
┌───────────────────────────────────────────┐
│                                           │
│            FULL BACKGROUND                │
│            + overlay effects              │
│                                           │
│ hover→ ┌──┐        ┌──────┐              │
│        │🎵│        │25:00 │ ← timer pill  │
│        │🎨│        │●●●○  │   (top center)│
│        │⏱│        └──────┘              │
│        │☀│                               │
│        │🧘│  ┌─────────────┐              │
│        └──┘  │ Float Panel │ ← on click   │
│              │ (draggable) │              │
│              └─────────────┘              │
│                                           │
│ ▶ ◀ ▶▶  Coffee Jazz — Denis  ●──── 3:42  │ ← ultra-slim bar
│━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│ ← progress line
└───────────────────────────────────────────┘
```

---

## Components

### 1. Auto-Hide HUD System
- **Default**: All UI visible (opacity 100%)
- **After 5s idle**: Fade to opacity 0 (except player bar → opacity 30%)
- **Mouse move**: Fade in 200ms
- **Playing indicator**: Tiny pulsing green dot (bottom-center) always visible

### 2. Hover Sidebar (replaces Toolbar)
- **Hidden by default** — no permanent sidebar
- **Hover left edge** (0-60px zone) → sidebar slides in (200ms)
- **Leave hover zone** → sidebar slides out (300ms)
- **Icons** (top to bottom):
  - 🎵 Sound Mixer
  - 🎨 Scenes
  - ⏱ Focus Tools
  - ☀/🌙 Day/Night
  - 🧘 Zen Mode
  - ⛶ Fullscreen
- **Style**: Vertical pill shape, glass bg, rounded-full, 48px wide
- **Tooltip**: Shown on right side of each icon

### 3. Floating Panels
All panels share these behaviors:
- **Glass card** — `bg: rgba(0,0,0,0.7)`, backdrop-blur 20px, rounded-2xl
- **Appear with spring animation** — scale 0.95→1, opacity 0→1 (300ms ease-out)
- **Position**: Center-left of screen (not edge-pinned)
- **Close**: Click outside panel, or press Escape
- **Width**: 320px, max-height: 70vh, scrollable

Panels:
- **Scene Selector** — grid of scene cards with gradient thumbnails
- **Sound Mixer** — tabs (Lo-fi / Jazz / Ambient) + track card + ambience sliders
- **Focus Panel** — tabs (Timer / Tasks / Stats) — existing component

### 4. Timer Pill (Top-Center)
- Only visible when timer is running
- Layout: `[▶/⏸] [24:38] [●●●○] [⛶] [✕]`
- Cycle dots: filled = completed, hollow = remaining
- Background: glass pill, rounded-full
- Click → opens Focus Panel
- **Glow ring**: Subtle pulsing glow matching timer mode color (green=work, blue=break)

### 5. Ultra-Slim Player Bar
- **Height**: 40px
- **Background**: transparent → glass on hover
- **Progress**: 2px line across FULL width at very top of bar
- **Layout**: `[▶ ◀ ▶▶] [🔊━━] [Track — Artist] [0:00/3:42]`
- **Auto-fade**: Fades to 30% opacity when idle (not fully hidden)
- **Hover**: Full opacity + glass background appears

### 6. Ambient Glow (Ambilight Effect)
- 4 edges of screen glow with colors extracted from scene palette
- CSS: `box-shadow: inset 0 0 150px rgba(scene_color, 0.15)`
- Subtle pulse animation (4s cycle, opacity 0.1-0.2)
- Colors per scene: Cafe=amber, Garden=pink, City=blue, Forest=green, Ocean=teal, Space=purple

### 7. Scene Background Enhancement
- Keep CSS gradients + add **parallax on mouse move** (10-20px shift)
- Crossfade 800ms (existing)
- Overlay effects on top (existing)

---

## Animations

| Element | Animation | Duration |
|---------|-----------|----------|
| Sidebar slide in | translateX(-100%) → 0 | 200ms ease-out |
| Sidebar slide out | 0 → translateX(-100%) | 300ms ease-in |
| Panel open | scale(0.95) opacity(0) → scale(1) opacity(1) | 300ms spring |
| Panel close | reverse | 200ms ease-in |
| HUD fade out | opacity 1 → 0 | 800ms ease |
| HUD fade in | opacity 0 → 1 | 200ms ease-out |
| Player idle | opacity 1 → 0.3 | 800ms ease |
| Ambient glow | opacity 0.1 ↔ 0.2 | 4s infinite |
| Timer pill glow | box-shadow pulse | 2s infinite |

---

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `App.tsx` | MODIFY | New layout: full-screen + HUD system |
| `Toolbar.tsx` → `Sidebar.tsx` | REPLACE | Horizontal → hover sidebar |
| `PlayerBar.tsx` | MODIFY | Ultra-slim, transparent, auto-fade |
| `TimerPill.tsx` | NEW | Compact top-center timer |
| `index.css` | MODIFY | Ambient glow, auto-hide, animations |
| `SceneBackground.tsx` | MODIFY | Parallax on mouse move |

## Implementation Order
1. Auto-hide HUD system (CSS + state)
2. Hover sidebar (replace Toolbar)
3. Ultra-slim player bar
4. Floating panel animations
5. Timer pill
6. Ambient glow
7. Mouse parallax
