# Amo Lofi — UI/Design Spec V2 (Cinematic HUD)

## Direction: Immersive Cinematic HUD
Background 100% màn hình. UI auto-hide. Floating widgets. User cảm thấy **đang ở trong scene**.
Timer là **hero element** — trung tâm trải nghiệm. Sound mixer luôn accessible.

> **Reference**: Concept lấy cảm hứng từ Lofi apps với full-screen
> scene backgrounds, centered timer, và minimal floating controls.

## Layout
```
┌───────────────────────────────────────────────────────┐
│                                                       │
│  [Amo Lofi]                            [👤 Avatar]   │
│                                                       │
│             FULL BACKGROUND (AI/Image)                │
│             + dark overlay for readability             │
│                                                       │
│ hover→ ┌──┐                                           │
│        │🎵│          ┌─────────────┐                  │
│        │🎨│          │   25:00     │ ← HERO TIMER     │
│        │⏱│          │  (○ ring)   │   (centered)     │
│        │☀│          │  ●●●○       │                  │
│        │🧘│          └─────────────┘                  │
│        │⛶│                                           │
│        └──┘  "Deep Work: Writing System Architecture" │
│              ← task label below timer                 │
│                                                       │
│   ┌────────────────┐                                  │
│   │ 🔊 Rain  ━━━○ │ ← mini mixer                    │
│   │    Thunder━○   │   (bottom-right,                │
│   │    Lo-fi ━━━○  │    always visible)               │
│   └────────────────┘                                  │
│                                                       │
│ ▶ ◀ ▶▶  Coffee Jazz — Denis  🔊━━  ●──── 3:42      │
│━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
└───────────────────────────────────────────────────────┘
```

---

## Components

### 1. Auto-Hide HUD System
- **Default**: All UI visible (opacity 100%)
- **After 5s idle**: Fade to opacity 0 (except player bar → opacity 30%, mini mixer → opacity 20%)
- **Mouse move / keyboard press / touch**: Fade in 200ms
- **Playing indicator**: Tiny pulsing green dot (bottom-center) always visible
- **Zen Mode override**: All UI hidden including player bar; only timer + playing dot visible

### 2. Hover Sidebar (replaces Toolbar)
- **Hidden by default** — no permanent sidebar
- **Hover left edge** (0-60px zone) → sidebar slides in (200ms)
- **Leave hover zone** → sidebar slides out (300ms)
- **Icons** (top to bottom):
  - 🎵 Sound Mixer
  - 🎨 Scenes (includes Create Scene — see §9)
  - ⏱ Focus Tools
  - ☀/🌙 Day/Night
  - 🧘 Zen Mode
  - ⛶ Fullscreen
- **Style**: Vertical pill shape, glass bg, rounded-full, 48px wide
- **Tooltip**: Shown on right side of each icon
- **Pro indicator**: 👑 Crown badge on Scene icon (Create Scene is Pro-gated)
- **Mobile**: See §10 Mobile Adaptations

### 3. Floating Panels
All panels share these behaviors:
- **Glass card** — `bg: rgba(0,0,0,0.7)`, backdrop-blur 20px, rounded-2xl
- **Text color**: `rgba(255,255,255,0.9)` primary, `rgba(255,255,255,0.6)` secondary
- **Appear with spring animation** — scale 0.95→1, opacity 0→1 (300ms ease-out)
- **Position**: Center of screen (viewport-centered)
- **Close**: Click outside panel, press Escape, or close button (×)
- **Width**: 360px, max-height: 70vh, scrollable (custom thin scrollbar)
- **Single panel rule**: Only 1 panel open at a time; opening a new panel closes the current one
- **Z-index**: Panels = 100, Sidebar = 90, Timer = 80, Player = 70

Panels:
- **Scene Selector** — grid of scene cards with image thumbnails + "Create Scene" button (see §9)
- **Sound Mixer** — tabs (Lo-fi / Jazz / Ambient) + track card + ambience sliders
- **Focus Panel** — tabs (Timer / Tasks / Stats) — existing component

### 4. Hero Timer (Centered)
- **Always visible** (positioned center of viewport)
- **Timer NOT running**: Show `25:00` in large font (72px), muted opacity (0.4)
- **Timer running**: Full opacity, optional circular ring animation
- **Ring style** (optional, can toggle):
  - SVG circle stroke, dashoffset animates as time decreases
  - Glow effect matching mode color: `green = work`, `blue = break`
- **Task label**: Text below timer — "Deep Work: Writing System Architecture"
  - Editable on click → inline input → saves to timer state
  - If empty: show placeholder "What are you working on?"
- **Cycle indicator**: `●●●○` dots below task label (filled = completed, hollow = remaining)
- **Controls**: Play/Pause, Skip appear on hover over timer area
- Click timer → opens Focus Panel

### 5. Ultra-Slim Player Bar
- **Height**: 40px
- **Background**: transparent → glass on hover
- **Progress**: 2px line across FULL width at very top of bar
- **Layout**: `[▶ ◀ ▶▶] [Track — Artist] [🔊━━] [0:00/3:42]`
- **Auto-fade**: Fades to 30% opacity when idle (not fully hidden)
- **Hover**: Full opacity + glass background appears

### 6. Mini Mixer Widget (Bottom-Right)
- **Always visible** (semi-transparent when idle, full opacity on hover)
- **Shows**: 2-3 ambience sliders (Rain, Thunder, Lo-fi Beats)
- **Compact size**: ~180px wide, glass card style
- **Expandable**: Click header → expands to show all sliders + track selector
- **Auto-fade**: Fades to 20% opacity when idle, 100% on hover

### 7. Ambient Glow (Ambilight Effect)
- 4 edges of screen glow with colors extracted from scene palette
- CSS: `box-shadow: inset 0 0 150px rgba(scene_color, 0.15)`
- Subtle pulse animation (4s cycle, opacity 0.1-0.2)
- Colors per scene: Cafe=amber, Garden=pink, City=blue, Forest=green, Ocean=teal, Space=purple
- **Scene change transition**: Crossfade glow colors over 800ms (match scene crossfade)

### 8. Scene Background
- **Primary**: AI-generated or uploaded images (JPG/WebP, stored in IndexedDB)
- **Fallback**: CSS gradients for preset scenes (existing)
- **Dark overlay**: `bg: rgba(0,0,0, 0.3)` for text readability, adjustable per scene
- **Parallax**: Subtle mouse-follow shift (10-20px), uses `transform: translate3d()` for GPU acceleration
- **Crossfade**: 800ms between scenes (existing)
- **`prefers-reduced-motion`**: Disable parallax, use instant transitions

### 9. Create Scene (Pro Feature)
- Accessible from Scene Selector panel → "✨ Create Scene" button
- **Pro-gated**: Free users see 👑 crown + "Upgrade to Pro" overlay
- **Flow**: See `ai_scene_image_gen_spec.md` for full details
- **Integration**: Created scenes appear in Scene Selector grid alongside presets
- **Visual**: Crown badge on Create Scene button, upsell banner for free users

---

## Day/Night Mode

| Aspect | Day ☀ | Night 🌙 |
|--------|-------|---------|
| Background overlay | `rgba(0,0,0,0.2)` | `rgba(0,0,0,0.5)` |
| Glass panels | `rgba(0,0,0,0.5)` blur 20px | `rgba(0,0,0,0.8)` blur 20px |
| Timer text | White with subtle shadow | White with stronger glow |
| Ambient glow | Lighter, wider spread | Deeper, more saturated |
| Player bar | Slightly lighter glass | Darker glass |
| Scene tint | Scene-specific day tint | Scene-specific night tint |
| Toggle | ☀ icon in sidebar | 🌙 icon in sidebar |

Each scene defines its own `day` and `night` color tokens (see theme system in `ai_scene_image_gen_spec.md`).

---

## Keyboard Shortcuts

> Already implemented in `useKeyboardShortcuts.ts`. Documented here for completeness.

| Key | Action | Context |
|-----|--------|---------|
| `Space` | Play / Pause | Global (skipped in inputs) |
| `N` | Next track | Global |
| `P` | Previous track | Global |
| `M` | Toggle sound mixer panel | Global |
| `S` | Toggle scene selector | Global |
| `F` | Toggle focus panel | Global |
| `Z` | Toggle Zen Mode | Global |
| `D` | Toggle Day/Night variant | Global |
| `↑` | Volume up 5% | Global |
| `↓` | Volume down 5% | Global |
| `Escape` | Close any open panel | When panel is open |

### Future additions
| Key | Action |
|-----|--------|
| `T` | Start/pause timer |
| `Ctrl+Enter` | Fullscreen toggle |
| `1-9` | Quick switch scene (by index) |
| `?` | Show shortcuts cheat sheet overlay |

---

## Mobile / Touch Adaptations

### Breakpoints
| Breakpoint | Width | Layout changes |
|------------|-------|----------------|
| Desktop | ≥1024px | Full layout as spec'd |
| Tablet | 768-1023px | Sidebar → bottom sheet, panels full-width |
| Mobile | <768px | Simplified HUD, tap-based controls |

### Touch interactions (replaces hover)
| Desktop (hover) | Mobile (touch) |
|-----------------|----------------|
| Hover left edge → sidebar | Tap hamburger icon (top-left) → slide-over menu |
| Hover player bar → full opacity | Tap bottom area → player controls appear (5s auto-hide) |
| Hover mini mixer → expand | Tap mixer icon → bottom sheet with sliders |
| Mouse parallax on background | Disabled (performance + no mouse) |

### Mobile-specific changes
- **Timer**: Smaller font (48px vs 72px), ring thinner
- **Player bar**: 56px height (touch-friendly), larger tap targets (44px minimum)
- **Panels**: Full-width bottom sheets instead of centered floating cards
- **Sidebar**: Replaced with hamburger menu → full-screen overlay menu
- **Mini mixer**: Hidden by default, accessible from hamburger menu or player bar
- **Landscape mode**: Timer shifts to left third, mixer to right third

---

## Pro Feature Indicators

| Element | Free User | Pro User |
|---------|-----------|----------|
| Create Scene button | 👑 Crown + "Pro" badge, disabled overlay | Fully functional, no badge |
| Scene Selector | Preset scenes accessible; custom scene slots show lock | All scenes unlocked |
| Upsell banner | Bottom of Scene panel: gradient banner "Unlock AI Scene Creation" | Hidden |
| Daily quota | "0/0 creates today" (grayed) | "2/15 creates today" |
| Stats dashboard | Basic stats only | Full stats + peak hours + insights |

### Upsell banner style
```css
/* Gradient banner in Scene Selector panel */
.pro-upsell-banner {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);
  border-radius: 12px;
  padding: 16px;
  /* Crown icon + "Unlock AI Scenes" + CTA button */
}
```

---

## Performance Budget

| Metric | Target | Max acceptable |
|--------|--------|----------------|
| First Contentful Paint | < 1.5s | < 2.5s |
| Time to Interactive | < 3s | < 5s |
| Animation FPS | 60fps | 30fps (mobile) |
| DOM nodes | < 500 | < 800 |
| JS bundle (gzipped) | < 200KB | < 350KB |
| Background image size | < 500KB (WebP) | < 1MB |
| Memory usage | < 100MB | < 200MB |

### Optimization strategies
- **`will-change: transform`** on parallax background and animated elements
- **`transform: translate3d()`** for GPU-accelerated animations (not top/left)
- **`prefers-reduced-motion`**: Disable parallax, reduce all animation durations by 80%
- **Image lazy loading**: Scene images loaded on-demand, not all at once
- **Audio preload**: Only preload current + next track
- **Debounce mouse move**: Parallax handler throttled to 16ms (1 frame)
- **`requestAnimationFrame`** for all custom animations
- **IndexedDB** for scene image storage (not localStorage — no 5MB limit)

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
| Mini mixer idle | opacity 1 → 0.2 | 800ms ease |
| Ambient glow | opacity 0.1 ↔ 0.2 | 4s infinite |
| Timer ring progress | stroke-dashoffset animate | Continuous (synced to timer) |
| Timer ring glow | box-shadow pulse (green/blue) | 2s infinite |
| Scene crossfade | opacity 0 ↔ 1 on two layers | 800ms ease |
| Background parallax | translate3d on mouse move | 16ms throttled |

---

## Error & Empty States

| State | Display |
|-------|---------|
| No internet (scene image fail) | Show CSS gradient fallback + toast "Image unavailable, using gradient" |
| No tracks available | Player bar shows "No tracks — check your connection" |
| Timer completed | Notification sound + screen flash + "Break time!" overlay (3s auto-dismiss) |
| AI scene generation fail | Keep theme colors, show "Upload your own image" fallback |
| Empty task list | "No tasks yet — add one to stay focused" with + button |
| Quota exhausted (Free) | Disabled button + "Come back tomorrow" or "Upgrade to Pro" CTA |

---

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `App.tsx` | MODIFY | New layout: full-screen + hero timer centered + HUD system |
| `Toolbar.tsx` → `Sidebar.tsx` | REPLACE | Horizontal → hover sidebar with Pro indicators |
| `PlayerBar.tsx` | MODIFY | Ultra-slim, transparent, auto-fade |
| `HeroTimer.tsx` | NEW | Large centered timer with ring, task label, cycle dots |
| `MiniMixer.tsx` | NEW | Always-visible compact mixer widget (bottom-right) |
| `index.css` | MODIFY | Ambient glow, auto-hide, animations, mobile breakpoints |
| `SceneBackground.tsx` | MODIFY | Real images + parallax on mouse move + dark overlay |

## Implementation Order
1. Hero Timer (centered, ring, task label) — core visual change
2. Scene Background upgrade (real images + overlay)
3. Auto-hide HUD system (CSS + state)
4. Hover sidebar (replace Toolbar) + Pro indicators
5. Ultra-slim player bar
6. Mini Mixer widget (bottom-right)
7. Floating panel animations + single-panel rule
8. Ambient glow + scene-based colors
9. Mouse parallax (GPU-accelerated)
10. Mobile / touch adaptations
11. Day/Night visual differences
12. Error & empty states
