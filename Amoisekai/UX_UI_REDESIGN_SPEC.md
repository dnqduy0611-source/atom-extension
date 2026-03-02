# UX/UI REDESIGN SPEC v1.0 — "Dark Immersive Novel"

> **Author:** Amo + AI Assistant
> **Date:** 2026-03-01
> **Status:** ✅ Approved — Ready for Implementation
> **Scope:** Frontend UX/UI overhaul (không bao gồm Soul Forge — đang triển khai riêng)

---

## 1. Triết lý thiết kế

### 1.1 Nguyên tắc cốt lõi

Amoisekai là **narrative-first RPG**, không phải game hành động. Mọi quyết định UI phải phục vụ:

| Hành vi người chơi | UI phải | UI KHÔNG nên |
|---------------------|---------|--------------|
| Đọc prose dài, nhiều session | Full-width prose, serif, generous spacing | Sidebar chiếm không gian đọc |
| Chờ AI generate (5-20s latency) | Narrative-flavored loading, smooth transition | Spinner, "Loading...", blank screen |
| Cảm nhận identity drift dần dần | Visual metaphor thay đổi chậm (Soul Orb) | Bảng số liệu thay đổi liên tục |
| Chơi 22 chương trải dài nhiều ngày | Continue screen, chapter recap, auto-save | Bắt đầu lại từ đầu, không biết mình ở đâu |
| Chọn hành động có hệ quả | Choice cards rõ ràng, hint consequence | Button grid generic, không context |

### 1.2 Visual Identity: "Dark Immersive Novel"

**Không phải "game dashboard"** — mà là **trải nghiệm đọc tiểu thuyết tương tác trong bóng tối.**

**Color palette mới:**

```css
/* ── Palette: Isekai Dark Gold ── */
--bg-deep:         #080810;        /* Deeper void */
--bg-surface:      #0f0f1a;        /* Surface layer */
--bg-card:         rgba(15, 15, 30, 0.75);

/* Primary accent: Amber/Gold — "ánh sáng isekai" */
--accent-primary:  #d4a853;        /* Warm gold */
--accent-glow:     #f0c674;        /* Bright gold glow */

/* Secondary: Deep violet — "bóng tối thế giới cũ" */
--accent-secondary: #8b7ec8;       /* Muted violet */

/* Status colors giữ nguyên */
--accent-danger:   #e85d5d;
--accent-success:  #4ade80;

/* Text hierarchy */
--text-primary:    #e8e0d0;        /* Warm white — dễ đọc lâu */
--text-secondary:  #9a9080;        /* Warm gray */
--text-prose:      #d4cfc0;        /* Prose body — warm, serif-friendly */
--text-muted:      #5a5548;

/* Gradients */
--gradient-hero:   linear-gradient(135deg, #d4a853 0%, #8b7ec8 50%, #d4a853 100%);
--gradient-card:   linear-gradient(160deg, rgba(212,168,83,0.06) 0%, rgba(139,126,200,0.04) 100%);
--gradient-glow:   radial-gradient(ellipse at 50% 0%, rgba(212,168,83,0.08) 0%, transparent 60%);
```

**Rationale:** Violet/cyan hiện tại thiên về "sci-fi". Amber/gold + deep navy tạo cảm giác "isekai cổ đại" phù hợp hơn với thế giới quan fantasy. Warm white text giảm eye strain cho reading session dài.

---

## 2. Layout chính khi chơi — Full Immersion

### 2.1 Current State (vấn đề)

```
┌──────────┬──────────────────────────────────────┐
│ SIDEBAR  │  MAIN CONTENT                        │
│ 260px    │  max-width: 800px                     │
│          │                                       │
│ Name     │  Chapter header                       │
│ Archetype│  Scene progress                       │
│ Skill    │  Prose text                            │
│ Stats    │  Choices                               │
│ DNA tags │                                       │
│          │                                       │
│ [Toggle] │                                       │
└──────────┴──────────────────────────────────────┘
```

**Vấn đề:**
- Sidebar 260px luôn hiện → giảm reading width, phá immersion
- Mobile: sidebar bị `display: none` → mất hoàn toàn stats
- Stats bars (numbers) phá vỡ cảm giác "đọc tiểu thuyết"
- Layout "dashboard" style không phù hợp narrative-first

### 2.2 Proposed Layout

```
┌─────────────────────────────────────────────────────┐
│  [← Ch.3 · Scene 2/4]              [🔮 Soul Orb]   │  ← minimal header (48px)
├─────────────────────────────────────────────────────┤
│                                                     │
│        Full-width prose area                        │
│        max-width: 680px, centered                   │
│        font: Noto Serif, 1.1rem                     │
│        line-height: 2.0                             │
│        Generous padding: 64px sides                 │
│                                                     │
│        "Devold mở mắt. Ánh sáng chói chang         │
│        xuyên qua tán lá xanh biếc, lọt qua         │
│        kẽ lá và rơi xuống khuôn mặt anh             │
│        như những giọt vàng nóng rát..."              │
│                                                     │
│        █                                            │  ← cursor blink
│                                                     │
├─────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐           │
│  │ ⚔️ Tiến về phía │  │ 👁️ Rút lui và   │           │  ← choice cards
│  │ hắn và đối đầu  │  │ quan sát kỹ hơn │           │
│  │                 │  │                 │           │
│  │ risk ●●●○○      │  │ risk ●○○○○      │           │
│  └─────────────────┘  └─────────────────┘           │
│  ┌──────────────────────────────────────┐           │
│  │ 💬 Tự do nhập...                     │  [➤]      │
│  └──────────────────────────────────────┘           │
└─────────────────────────────────────────────────────┘

                          ↓ Click Soul Orb

┌─────────────────────────────────────────────────────┐
│                                        [Identity    │
│                                         Panel]      │
│                                        ┌───────────┐│
│                                        │ Soul Orb  ││
│                                        │           ││
│       (Prose vẫn hiện,                 │ Name      ││
│        dim xuống nhẹ)                  │ Archetype ││
│                                        │           ││
│                                        │ Coherence ││
│                                        │ ████░░ 72%││
│                                        │           ││
│                                        │ Instability│
│                                        │ ██░░░░ 30%││
│                                        │           ││
│                                        │ Unique Sk.││
│                                        │ [details] ││
│                                        │           ││
│                                        │ DNA Tags  ││
│                                        └───────────┘│
└─────────────────────────────────────────────────────┘
```

### 2.3 Thay đổi cụ thể

#### Header Bar (48px)

```html
<header class="game-header">
    <div class="header-left">
        <span class="header-chapter">Chương 3</span>
        <span class="header-separator">·</span>
        <span class="header-scene">Scene 2/4</span>
        <span class="scene-type-badge" data-type="combat">⚔️ Chiến đấu</span>
    </div>
    <div class="header-right">
        <button class="soul-orb" id="soul-orb" aria-label="Identity Panel">
            <div class="soul-orb-glow"></div>
        </button>
    </div>
</header>
```

**CSS specs:**
- `position: sticky; top: 0; z-index: 50`
- `background: rgba(8,8,16,0.85); backdrop-filter: blur(12px)`
- `border-bottom: 1px solid rgba(212,168,83,0.08)`
- Font: `Inter 0.8rem`, uppercase, letter-spacing 2px
- Fade-in khi scroll xuống, ẩn khi ở top (optional)

#### Prose Area

**CSS specs:**
- `max-width: 680px; margin: 0 auto`
- `padding: 48px 24px` (mobile), `padding: 64px 0` (desktop)
- `font-family: 'Noto Serif'; font-size: 1.1rem; line-height: 2.0`
- `color: var(--text-prose)` — warm white
- **Không có border, card, glass effect** — prose nổi trên background như trang sách
- `white-space: pre-wrap` (giữ nguyên)

#### Identity Panel (Slide-in từ phải)

**Behavior:**
- Click Soul Orb → panel slide-in từ phải (width: 320px)
- Overlay trên prose, prose dim xuống `opacity: 0.4`
- Click bên ngoài hoặc click orb lại → slide-out
- Touch: swipe left to dismiss

**CSS specs:**
- `position: fixed; right: 0; top: 0; height: 100vh; width: 320px`
- `transform: translateX(100%)` → `translateX(0)` khi mở
- `transition: transform 400ms cubic-bezier(0.16, 1, 0.3, 1)`
- `background: rgba(10,10,18,0.95); backdrop-filter: blur(20px)`
- `border-left: 1px solid rgba(212,168,83,0.1)`
- Chứa: Soul Orb (to), tên, archetype, stat bars, DNA tags, skill profile
- Z-index: 100

#### Xóa sidebar cũ

- Remove `<aside class="game-sidebar">` và toàn bộ CSS liên quan
- Di chuyển nội dung sang Identity Panel
- Bỏ `#btn-toggle-sidebar`

### 2.4 Files cần thay đổi

| File | Thay đổi |
|------|----------|
| `web/index.html` | Restructure `#view-game`: xóa `<aside>`, thêm `<header class="game-header">` + `<div class="identity-panel">` |
| `web/style.css` | Xóa `.game-sidebar`, `.game-layout` flex → single column. Thêm `.game-header`, `.identity-panel`, `.soul-orb` styles |
| `web/main.js` | Update sidebar functions → panel functions. Soul Orb click handler |

---

## 3. Soul Orb — Identity Visualization

### 3.1 Concept

Thay thế stat bars bằng **visual metaphor**. Soul Orb là một radial gradient orb nhỏ (36×36px) ở header bar, phản ánh identity state qua:

| Identity State | Visual Effect |
|----------------|---------------|
| Coherence cao (> 0.7) | Orb sáng amber/gold ổn định, glow nhẹ |
| Coherence trung bình (0.4-0.7) | Orb amber mờ hơn, glow subtle pulse |
| Coherence thấp (< 0.4) | Orb chuyển violet, glow nhanh hơn |
| Instability cao (> 0.6) | Orb có thêm red flicker, pulse nhanh, glow mạnh |
| Instability thấp (< 0.3) | Orb ổn định, không flicker |
| Identity event vừa xảy ra | Orb pulse mạnh 1 lần + ripple effect |

### 3.2 Implementation

```css
.soul-orb {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    position: relative;
    background: radial-gradient(circle at 40% 40%,
        var(--orb-bright) 0%,
        var(--orb-core) 40%,
        var(--orb-edge) 70%,
        transparent 100%
    );
    transition: all 600ms ease;
    /* Custom properties set by JS based on identity state */
    --orb-bright: #f0c674;
    --orb-core: #d4a853;
    --orb-edge: rgba(139,126,200,0.3);
}

.soul-orb-glow {
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    background: radial-gradient(circle, var(--orb-core) 0%, transparent 70%);
    opacity: 0.4;
    animation: orbPulse var(--orb-pulse-speed, 3s) ease-in-out infinite;
    pointer-events: none;
}

@keyframes orbPulse {
    0%, 100% { transform: scale(1); opacity: 0.3; }
    50% { transform: scale(1.3); opacity: 0.6; }
}
```

**JS logic (`updateSoulOrb`):**

```javascript
function updateSoulOrb(coherence, instability) {
    const orb = document.getElementById('soul-orb');
    
    // Color shift: amber (stable) → violet (drifting) → red tint (unstable)
    if (coherence > 0.7) {
        orb.style.setProperty('--orb-bright', '#f0c674');
        orb.style.setProperty('--orb-core', '#d4a853');
    } else if (coherence > 0.4) {
        orb.style.setProperty('--orb-bright', '#c4a070');
        orb.style.setProperty('--orb-core', '#9a8a70');
    } else {
        orb.style.setProperty('--orb-bright', '#a78bfa');
        orb.style.setProperty('--orb-core', '#7c6bc4');
    }
    
    // Pulse speed: faster when unstable
    const pulseSpeed = instability > 0.6 ? '1.2s' : instability > 0.3 ? '2.5s' : '4s';
    orb.style.setProperty('--orb-pulse-speed', pulseSpeed);
    
    // Red flicker for high instability
    if (instability > 0.6) {
        orb.style.setProperty('--orb-edge', 'rgba(232,93,93,0.4)');
    } else {
        orb.style.setProperty('--orb-edge', 'rgba(139,126,200,0.3)');
    }
}
```

### 3.3 Identity Event Pulse

Khi SSE gửi `identity` event → trigger 1 lần:

```javascript
function pulseSoulOrb() {
    const orb = document.getElementById('soul-orb');
    orb.classList.add('soul-orb-event');
    setTimeout(() => orb.classList.remove('soul-orb-event'), 1500);
}
```

```css
.soul-orb-event {
    animation: orbEvent 1.5s ease-out;
}

@keyframes orbEvent {
    0% { box-shadow: 0 0 0 0 rgba(212,168,83,0.6); }
    50% { box-shadow: 0 0 0 12px rgba(212,168,83,0); }
    100% { box-shadow: 0 0 0 0 rgba(212,168,83,0); }
}
```

---

## 4. AI Generation Latency — Immersive Loading

### 4.1 Current State (vấn đề)

```javascript
// Hiện tại: generic messages
showLoading('Đang tạo chương...');
showLoading('Đang lập dàn ý chương 1...');
showLoading('Đang tải scene tiếp theo...');
```

- Typing indicator: 3 bouncing dots — generic, không thematic
- Loading status: plain text, single message
- Không có transition giữa loading → prose streaming

### 4.2 Narrative Loading Messages

Thay generic messages bằng **immersive, rotating narrative messages:**

```javascript
const NARRATIVE_LOADING = {
    // Khi planner đang chạy (đầu chapter)
    planner: [
        'Vận mệnh đang dệt những sợi chỉ mới...',
        'Thế giới xoay chuyển quanh lựa chọn của ngươi...',
        'Những con đường phía trước đang mở ra...',
        'Bóng tối thì thầm về chương kế tiếp...',
        'Hư Vô quan sát bước chân ngươi...',
    ],
    // Khi writer đang gen prose (giữa scene)
    writer: [
        'Câu chuyện đang thành hình...',
        'Thế giới đang định hình xung quanh ngươi...',
        'Hắn bước ra từ bóng tối...',
        'Gió thay đổi hướng...',
        'Một chương mới đang viết chính nó...',
    ],
    // Khi đang chờ scene tiếp theo (inter-scene)
    nextScene: [
        'Thời gian trôi chậm lại...',
        'Hậu quả lựa chọn đang lan tỏa...',
        'Thế giới phản ứng với hành động của ngươi...',
        'Con đường phía trước hiện dần...',
    ],
    // Khi đang tạo skill (Soul Forge)
    forging: [
        'Linh hồn đang được rèn trong lửa vĩnh hằng...',
        'Bản chất ngươi đang kết tinh thành sức mạnh...',
        'Hư Vô đọc ký ức của ngươi...',
        'Kỹ năng đang thức tỉnh từ sâu thẳm...',
    ],
};

function getRandomLoadingMessage(stage) {
    const messages = NARRATIVE_LOADING[stage] || NARRATIVE_LOADING.writer;
    return messages[Math.floor(Math.random() * messages.length)];
}
```

### 4.3 Loading UI Redesign

Thay 3 bouncing dots bằng **narrative loading state:**

```html
<div class="prose-loading" id="prose-loading">
    <div class="loading-whisper">
        <p class="loading-message" id="loading-message">
            Vận mệnh đang dệt những sợi chỉ mới...
        </p>
        <div class="loading-dots">
            <span></span><span></span><span></span>
        </div>
    </div>
</div>
```

```css
.loading-whisper {
    text-align: center;
    padding: 64px 24px;
}

.loading-message {
    font-family: var(--font-prose);
    font-size: 1.05rem;
    font-style: italic;
    color: var(--text-muted);
    opacity: 0;
    animation: whisperFadeIn 1.2s ease-out forwards;
    margin-bottom: 24px;
}

@keyframes whisperFadeIn {
    0% { opacity: 0; transform: translateY(8px); }
    100% { opacity: 1; transform: translateY(0); }
}

.loading-dots {
    display: flex;
    justify-content: center;
    gap: 6px;
}

.loading-dots span {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--accent-primary);
    opacity: 0.3;
    animation: dotPulse 1.8s ease-in-out infinite;
}

.loading-dots span:nth-child(2) { animation-delay: 0.3s; }
.loading-dots span:nth-child(3) { animation-delay: 0.6s; }
```

### 4.4 Loading → Prose Transition

Khi prose bắt đầu stream (first chunk từ SSE), loading message **fade out** rồi prose **fade in:**

```javascript
function onFirstProseChunk() {
    const loading = document.getElementById('prose-loading');
    const prose = document.getElementById('prose-text');
    
    // Fade out loading message
    loading.style.transition = 'opacity 0.5s ease';
    loading.style.opacity = '0';
    
    setTimeout(() => {
        loading.classList.add('hidden');
        loading.style.opacity = ''; // Reset
        
        // Prose container fades in
        prose.style.opacity = '0';
        prose.style.display = 'block';
        requestAnimationFrame(() => {
            prose.style.transition = 'opacity 0.6s ease';
            prose.style.opacity = '1';
        });
    }, 500);
}
```

### 4.5 Message Rotation

Nếu loading kéo dài > 8s, **rotate message** để người chơi không thấy bị stuck:

```javascript
function startLoadingRotation(stage) {
    let rotationTimer;
    const messageEl = document.getElementById('loading-message');
    
    // Set initial message
    messageEl.textContent = getRandomLoadingMessage(stage);
    
    // Rotate every 8 seconds
    rotationTimer = setInterval(() => {
        messageEl.style.animation = 'none';
        messageEl.offsetHeight; // Force reflow
        messageEl.textContent = getRandomLoadingMessage(stage);
        messageEl.style.animation = 'whisperFadeIn 1.2s ease-out forwards';
    }, 8000);
    
    return rotationTimer;
}
```

### 4.6 Choices — Disabled State Pulse

Khi prose đang stream, choices bị disabled. Thay `opacity: 0.5` bằng subtle pulse:

```css
.choice-card:disabled,
.choice-card.generating {
    opacity: 0.35;
    cursor: default;
    transform: none;
    animation: choiceWaiting 2.5s ease-in-out infinite;
}

@keyframes choiceWaiting {
    0%, 100% { opacity: 0.35; }
    50% { opacity: 0.5; }
}
```

---

## 5. Choice Cards Redesign

### 5.1 Current State

```css
/* Hiện tại: simple list, translateX on hover */
.choice-card {
    padding: 16px 20px;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(167, 139, 250, 0.1);
}
```

### 5.2 Proposed: Rich Choice Cards

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  ┌──────────────────────┐  ┌──────────────────────┐ │
│  │ ⚔️                    │  │ 👁️                    │ │
│  │ Tiến về phía hắn     │  │ Rút lui và quan sát  │ │
│  │ và đối đầu trực diện │  │ từ bóng tối          │ │
│  │                      │  │                      │ │
│  │ ●●●○○ nguy hiểm      │  │ ●○○○○ an toàn        │ │
│  │ ─────────────────── │  │ ─────────────────── │ │
│  │ "Sức mạnh đòi hỏi   │  │ "Kiên nhẫn mang lại │ │
│  │  sự dũng cảm"       │  │  lợi thế"            │ │
│  └──────────────────────┘  └──────────────────────┘ │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ 🌀 [Ý Chí Vượt Trội] — Tập trung sức mạnh   │   │
│  │   để áp đảo đối phương                        │   │
│  │                                               │   │
│  │ ●●●●○ rất nguy hiểm                          │   │
│  │ "Unique Skill có thể thay đổi cục diện"      │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ 💬 Tự do nhập hành động...              [➤]  │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 5.3 CSS Specs

```css
.choices-container {
    margin-top: 48px;
    padding-top: 32px;
    border-top: 1px solid rgba(212,168,83,0.06);
    animation: choicesFadeIn 0.8s ease-out;
}

@keyframes choicesFadeIn {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
}

.choices-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 16px;
}

/* Skill choice (3rd option) spans full width */
.choice-card.choice-skill {
    grid-column: 1 / -1;
}

.choice-card {
    padding: 20px;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(212,168,83,0.08);
    border-radius: 12px;
    cursor: pointer;
    transition: all 300ms cubic-bezier(0.16, 1, 0.3, 1);
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.choice-card:hover {
    background: rgba(212,168,83,0.06);
    border-color: rgba(212,168,83,0.25);
    transform: translateY(-3px);
    box-shadow: 0 8px 32px rgba(212,168,83,0.08);
}

.choice-icon {
    font-size: 1.4rem;
    margin-bottom: 4px;
}

.choice-text {
    font-size: 0.95rem;
    line-height: 1.5;
    color: var(--text-primary);
}

.choice-risk {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75rem;
    color: var(--text-muted);
}

.choice-risk-dots {
    display: flex;
    gap: 3px;
}

.choice-risk-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(255,255,255,0.15);
}

.choice-risk-dot.filled { background: var(--accent-danger); }
.choice-risk-dot.filled.low { background: var(--accent-success); }
.choice-risk-dot.filled.medium { background: var(--accent-primary); }

.choice-hint {
    font-size: 0.78rem;
    font-style: italic;
    color: var(--text-muted);
    border-top: 1px solid rgba(212,168,83,0.05);
    padding-top: 8px;
    margin-top: 4px;
}

/* Mobile: single column */
@media (max-width: 600px) {
    .choices-grid {
        grid-template-columns: 1fr;
    }
}
```

### 5.4 Responsive behavior

- **Desktop (>768px):** 2-column grid, skill choice full-width
- **Mobile (≤600px):** 1-column stack
- **Hover effect:** Chỉ desktop, không áp dụng trên mobile (use `@media (hover: hover)`)

---

## 6. Session Continuity — Home/Continue Screen

### 6.1 Flow

```
App Launch → Check saved state
  ├── Có save → Show Continue Screen
  └── Không có → Show Loading Screen → Soul Forge
```

### 6.2 Continue Screen Layout

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│                    異世界                             │
│                  AMOISEKAI                           │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │                                               │  │
│  │  🔮  DEVOLD                                    │  │
│  │      Archetype: Strategist                     │  │
│  │                                               │  │
│  │  📖 Chương 7 — Bóng Tối Lan Tỏa              │  │
│  │     Scene 3/5 · Chiến đấu                     │  │
│  │                                               │  │
│  │  "Devold đứng trước cổng thành, thanh kiếm    │  │
│  │   vẫn còn nóng trong tay. Phía sau, tiếng     │  │
│  │   quân lính reo hò vang vọng..."              │  │
│  │                                               │  │
│  │  [Soul Orb]  Coherence ████░░ 68%             │  │
│  │                                               │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │  ⚡ Tiếp tục hành trình                  │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  │                                               │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │  🔄 Tạo nhân vật mới                     │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  │                                               │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 6.3 HTML Structure

```html
<div id="view-continue" class="view" data-testid="view-continue">
    <div class="continue-container">
        <div class="continue-logo">
            <div class="logo-glow">異世界</div>
            <h1>Amoisekai</h1>
        </div>
        
        <div class="continue-card glass-card">
            <div class="continue-character">
                <div class="continue-orb" id="continue-orb"></div>
                <div class="continue-character-info">
                    <h2 id="continue-name">—</h2>
                    <span class="continue-archetype" id="continue-archetype"></span>
                </div>
            </div>
            
            <div class="continue-progress">
                <div class="continue-chapter" id="continue-chapter">
                    📖 Chương 7 — Bóng Tối Lan Tỏa
                </div>
                <div class="continue-scene" id="continue-scene">
                    Scene 3/5 · Chiến đấu
                </div>
            </div>
            
            <div class="continue-recap" id="continue-recap">
                <!-- Last scene's prose excerpt (2-3 sentences) -->
            </div>
            
            <div class="continue-stats">
                <div class="continue-stat">
                    <span class="continue-stat-label">Coherence</span>
                    <div class="continue-stat-bar">
                        <div class="continue-stat-fill" id="continue-coherence"></div>
                    </div>
                </div>
            </div>
            
            <button class="btn-primary btn-glow btn-continue" id="btn-continue">
                <span class="btn-icon">⚡</span> Tiếp tục hành trình
            </button>
            
            <button class="btn-ghost btn-new-game" id="btn-new-game">
                🔄 Tạo nhân vật mới
            </button>
        </div>
    </div>
</div>
```

### 6.4 Data Source

Continue screen cần data từ saved state:

```javascript
function loadContinueScreen() {
    const savedState = JSON.parse(localStorage.getItem('amo_game_state'));
    if (!savedState || !savedState.storyId) return false; // No save found
    
    // Populate continue screen
    document.getElementById('continue-name').textContent = savedState.playerName;
    document.getElementById('continue-archetype').textContent = savedState.archetype;
    document.getElementById('continue-chapter').textContent = 
        `📖 Chương ${savedState.chapterNumber} — ${savedState.chapterTitle}`;
    document.getElementById('continue-scene').textContent = 
        `Scene ${savedState.sceneNumber}/${savedState.totalScenes}`;
    document.getElementById('continue-recap').textContent = savedState.lastProseExcerpt;
    
    // Coherence bar
    const pct = Math.round((savedState.coherence || 0.5) * 100);
    document.getElementById('continue-coherence').style.width = `${pct}%`;
    
    return true;
}
```

### 6.5 Auto-Save Strategy

Cần save state tại các điểm:

| Trigger | Data saved |
|---------|------------|
| Sau mỗi choice | Full game state: storyId, chapterId, sceneNumber, identity stats |
| Sau mỗi scene complete | + prose excerpt (last 100 chars) cho recap |
| Sau chapter end | + chapter summary |
| Trước tab close (`beforeunload`) | Full state snapshot |

```javascript
function saveGameState() {
    const gameState = {
        userId: state.userId,
        storyId: state.storyId,
        playerName: state.player?.name,
        archetype: state.player?.archetype,
        chapterNumber: extractChapterNumber(),
        chapterTitle: document.getElementById('chapter-title')?.textContent || '',
        sceneNumber: state.currentSceneNumber,
        totalScenes: state.totalScenes,
        lastProseExcerpt: getLastProseExcerpt(150),
        coherence: state.lastCoherence || 0.5,
        instability: state.lastInstability || 0,
        savedAt: new Date().toISOString(),
    };
    
    localStorage.setItem('amo_game_state', JSON.stringify(gameState));
}

// Auto-save triggers
window.addEventListener('beforeunload', saveGameState);
```

### 6.6 Files cần thay đổi

| File | Thay đổi |
|------|----------|
| `web/index.html` | Thêm `#view-continue` section |
| `web/style.css` | Thêm `.continue-*` styles |
| `web/main.js` | Thay đổi `init()`: check saved state → show continue hoặc loading. Thêm `saveGameState()`, `loadContinueScreen()` |

---

## 7. Chapter End Summary Card

### 7.1 Concept

Khi scene cuối của chapter kết thúc, trước khi bắt đầu chapter mới, hiển thị **summary card** full-screen:

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│              ━━━ CHƯƠNG 3 HOÀN THÀNH ━━━            │
│                  "Bóng Tối Lan Tỏa"                 │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │                                               │  │
│  │  📊 Hành trình của ngươi                      │  │
│  │                                               │  │
│  │  Scenes hoàn thành:  4/4                      │  │
│  │  Lựa chọn chính:     Chiến đấu trực diện    │  │
│  │                                               │  │
│  │  ─────────────────────────────────────────── │  │
│  │                                               │  │
│  │  🔮 Identity Drift                            │  │
│  │                                               │  │
│  │  Coherence:  72% → 68%  ▼ -4%                │  │
│  │  Instability: 20% → 35%  ▲ +15%              │  │
│  │                                               │  │
│  │  💫 "Linh hồn ngươi dao động —               │  │
│  │     sức mạnh mới nhưng bất ổn"               │  │
│  │                                               │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│         [⚡ Tiếp tục sang Chương 4]                 │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 7.2 Data Requirements

Chapter end summary cần:
- Chapter number + title (đã có từ metadata)
- Total scenes (đã có)
- **Identity delta** (coherence/instability so với đầu chapter) ← cần track `chapterStartCoherence` và `chapterStartInstability` trong state
- **Narrative summary** từ backend (nếu có) hoặc auto-generate từ last scene prose

### 7.3 Implementation Notes

```javascript
function showChapterSummary(chapterData) {
    const overlay = document.createElement('div');
    overlay.className = 'chapter-summary-overlay';
    overlay.innerHTML = `
        <div class="chapter-summary-card glass-card">
            <div class="chapter-summary-complete">
                ━━━ CHƯƠNG ${chapterData.number} HOÀN THÀNH ━━━
            </div>
            <h2 class="chapter-summary-title">"${chapterData.title}"</h2>
            
            <div class="chapter-summary-stats">
                <div class="summary-stat">
                    <span class="summary-label">Scenes hoàn thành</span>
                    <span class="summary-value">${chapterData.scenes}/${chapterData.totalScenes}</span>
                </div>
            </div>
            
            <div class="chapter-summary-identity">
                <h3>🔮 Identity Drift</h3>
                ${renderIdentityDelta(chapterData.identityDelta)}
            </div>
            
            ${chapterData.narrativeReflection ? `
                <div class="chapter-summary-reflection">
                    💫 "${chapterData.narrativeReflection}"
                </div>
            ` : ''}
            
            <button class="btn-primary btn-glow" id="btn-next-chapter">
                <span class="btn-icon">⚡</span> Tiếp tục sang Chương ${chapterData.number + 1}
            </button>
        </div>
    `;
    
    document.getElementById('app').appendChild(overlay);
    overlay.querySelector('#btn-next-chapter').addEventListener('click', () => {
        overlay.remove();
        // Trigger next chapter generation
        startNextChapter();
    });
}
```

---

## 8. Animated Background

### 8.1 Current State

```css
/* Hiện tại: static radial gradient */
body::before {
    background: var(--gradient-glow);
}
```

### 8.2 Proposed: Ultra-slow Ambient Animation

**Nguyên tắc:** Animation PHẢI rất chậm (30s+ cycle) và rất subtle. Mục đích là tạo cảm giác "sống" mà không gây mất tập trung khi đọc.

```css
body::before {
    content: '';
    position: fixed;
    inset: 0;
    background:
        radial-gradient(ellipse at 20% 20%, rgba(212,168,83,0.04) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 80%, rgba(139,126,200,0.03) 0%, transparent 50%);
    pointer-events: none;
    z-index: 0;
    animation: ambientDrift 40s ease-in-out infinite;
}

body::after {
    content: '';
    position: fixed;
    inset: 0;
    background:
        radial-gradient(ellipse at 70% 30%, rgba(212,168,83,0.03) 0%, transparent 40%);
    pointer-events: none;
    z-index: 0;
    animation: ambientDrift 55s ease-in-out infinite reverse;
}

@keyframes ambientDrift {
    0%   { transform: translate(0, 0) scale(1); }
    33%  { transform: translate(30px, -20px) scale(1.05); }
    66%  { transform: translate(-20px, 15px) scale(0.95); }
    100% { transform: translate(0, 0) scale(1); }
}
```

**Performance notes:**
- Chỉ dùng `transform` (GPU-accelerated, không trigger layout/paint)
- `will-change: transform` có thể thêm nếu cần
- Opacity rất thấp (0.03-0.04) → gần như invisible trên mobile → OK

---

## 9. Identity Toast Refinement

### 9.1 Current State

```css
/* Đã có: fixed bottom-right, slideUp animation */
.identity-toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    max-width: 320px;
}
```

**Vấn đề:** Toast hiện có thể quá chú ý, che prose, hoặc interrupt reading.

### 9.2 Proposed Changes

```css
.identity-toast {
    position: fixed;
    top: 60px;           /* Ngay dưới header */
    right: 24px;
    max-width: 300px;
    padding: 12px 16px;
    border-radius: 10px;
    background: rgba(10,10,18,0.9);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(212,168,83,0.15);
    font-size: 0.82rem;
    color: var(--text-secondary);
    z-index: 90;
    
    /* Subtle entrance — không sốc */
    animation: toastAppear 0.6s ease-out;
    
    /* Auto-dismiss */
    pointer-events: none;
}

@keyframes toastAppear {
    0%   { opacity: 0; transform: translateX(20px); }
    100% { opacity: 1; transform: translateX(0); }
}
```

**Behavior:**
- Xuất hiện khi có identity event từ SSE
- Tự biến mất sau 4 giây (fade out)
- **Không block** reading — position top-right, nhỏ
- Đồng thời trigger Soul Orb pulse (Section 3.3)

---

## 10. Cursor Blink Enhancement

### 10.1 Current State

```css
.prose-text .cursor-blink {
    width: 2px;
    height: 1.1em;
    background: var(--accent-primary);
    animation: blink 1s step-end infinite;
}
```

### 10.2 Proposed: Soft Glow Cursor

```css
.prose-text .cursor-blink {
    display: inline-block;
    width: 2px;
    height: 1.15em;
    background: var(--accent-primary);
    margin-left: 1px;
    vertical-align: text-bottom;
    border-radius: 1px;
    animation: cursorGlow 1.2s ease-in-out infinite;
    box-shadow: 0 0 6px rgba(212,168,83,0.4);
}

@keyframes cursorGlow {
    0%, 100% { opacity: 1; box-shadow: 0 0 8px rgba(212,168,83,0.5); }
    50%      { opacity: 0.2; box-shadow: 0 0 2px rgba(212,168,83,0.1); }
}
```

**Rationale:** Soft glow thay vì step-end blink tạo cảm giác "sống" hơn, phù hợp aesthetic isekai.

---

## 11. Implementation Priority & Effort

| Priority | Module | Description | Effort | Impact | Dependencies |
|----------|--------|-------------|--------|--------|--------------|
| **P0** | §2 | Layout restructure → full-width prose + identity panel | 6-8h | 🔥🔥🔥 | Nền tảng cho tất cả |
| **P0** | §4 | Latency UX: narrative loading + transition | 3-4h | 🔥🔥🔥 | Không |
| **P0** | §6 | Home/Continue screen + auto-save | 4-5h | 🔥🔥🔥 | Không |
| **P1** | §1.2 | Color palette shift (amber/gold) | 1-2h | 🔥🔥 | CSS tokens chỉ |
| **P1** | §3 | Soul Orb widget | 2-3h | 🔥🔥 | §2 (header) |
| **P1** | §5 | Choice cards redesign | 2-3h | 🔥🔥 | §1.2 (palette) |
| **P2** | §8 | Animated background | 1h | 🔥 | §1.2 (palette) |
| **P2** | §7 | Chapter end summary card | 3-4h | 🔥 | Backend data |
| **P2** | §9 | Identity toast refinement | 1h | 🔥 | §2 (header) |
| **P2** | §10 | Cursor glow enhancement | 0.5h | 🔥 | §1.2 (palette) |
| | | **TỔNG** | **~24-32h** | | |

### Recommended Implementation Order

```
Phase 1 (P0 — Nền tảng):
  1. §1.2 Color palette shift (1-2h) ← làm trước vì ảnh hưởng mọi thứ
  2. §2 Layout restructure (6-8h) ← quan trọng nhất
  3. §4 Latency UX (3-4h)
  4. §6 Continue screen + auto-save (4-5h)

Phase 2 (P1 — Enhancements):
  5. §3 Soul Orb (2-3h)
  6. §5 Choice cards (2-3h)
  7. §10 Cursor glow (0.5h)

Phase 3 (P2 — Polish):
  8. §8 Animated background (1h)
  9. §9 Identity toast (1h)
  10. §7 Chapter end summary (3-4h)
```

---

## 12. Verification Plan

### 12.1 Visual Testing (Browser)

Dùng browser tool để verify sau mỗi phase:

1. **Layout:** Mở game view → verify prose full-width, không còn sidebar, header minimal
2. **Soul Orb:** Click orb → identity panel slide in/out, orb color thay đổi theo coherence
3. **Loading:** Start new game → verify narrative messages hiện, rotate sau 8s, fade transition sang prose
4. **Continue screen:** Reload page với saved state → verify continue screen hiện đúng data
5. **Choices:** Verify card layout 2-column desktop, 1-column mobile (resize browser)
6. **Background:** Verify animation smooth, không jank, rất subtle

### 12.2 Responsive Testing

- **Desktop (1440px):** Full layout, 2-col choices, 680px prose width
- **Tablet (768px):** Prose full-width, panel overlay
- **Mobile (375px):** Prose edge-to-edge, 1-col choices, no hover effects

### 12.3 Performance

- Background animation: verify GPU compositing (check DevTools Layers panel)
- No layout thrashing during prose streaming
- Identity panel transition: 60fps

---

## 13. Quyết định đã xác nhận ✅

| # | Câu hỏi | Quyết định |
|---|---------|------------|
| 1 | Color palette: giữ violet hay chuyển amber/gold? | ✅ **Chuyển amber/gold** làm primary |
| 2 | Identity panel: slide-in overlay hay modal? | ✅ **Slide-in từ phải** (overlay) |
| 3 | Choices: 2-column grid hay 1-column list? | ✅ **2-column** desktop, 1-col mobile |
| 4 | Continue screen: check localStorage hay API? | ✅ **localStorage** (offline-first) |
| 5 | Chapter summary: cần backend data hay frontend-only? | ✅ **Frontend-only** (track delta in state) |
| 6 | Loading message rotation: 8s hay interval khác? | ✅ **8 giây** |

---

## Appendix A: Gap Analysis & Resolutions

> Gaps identified during spec review, verified against codebase.

### Gap 1 — Risk indicators ❌ NOT A GAP

**Claim:** Backend không trả `risk_level` per choice.

**Reality:** Backend `Choice` model (`app/models/story.py:67`) **đã có** `risk_level: int = Field(default=1, ge=1, le=5)`. Field này:
- Được LLM generate trong `scene_writer.py` và `writer.py`
- Được validate/clamp bởi `scene_critic.py` (lines 80-85)
- Được serialize trong SSE stream (`stream.py:83`, `scene.py:126`)
- Frontend `renderChoices()` (`main.js:1266`) **đã render** risk circle

**Resolution:** ✅ Không cần thay đổi backend. §5 chỉ cần upgrade visual từ `<div class="choice-risk risk-${c.risk_level}">${c.risk_level}</div>` sang risk dots UI mới.

---

### Gap 2 — Choice hints ❌ NOT A GAP

**Claim:** `choice.hint` không tồn tại.

**Reality:** Backend `Choice` model có `consequence_hint: str = ""`. Field này:
- Được LLM generate cùng với mỗi choice
- Được validate bởi `scene_critic.py:100` (cảnh báo nếu thiếu)
- Được serialize trong SSE và REST responses
- Frontend `renderChoices()` **đã render**: `${c.consequence_hint ? '<div class="choice-hint">${c.consequence_hint}</div>' : ''}`

**Resolution:** ✅ Không cần thay đổi backend. §5 spec ban đầu dùng tên `hint` — sửa thành `consequence_hint` cho consistent. Hiện `consequence_hint` bị ghi là "Internal hint for planner (hidden from player)" trong model docstring — nhưng thực tế frontend đã hiển thị nó. Cần quyết định: hiện cho player hay ẩn?

> **Quyết định:** ✅ **Hiện cho player** — đây chính là tính năng "hover preview" mong muốn. Rename trong UI thành "consequence hint" thay vì "internal hint". Sẽ update model docstring khi refactor backend.

---

### Gap 3 — Skill choice detection ⚠️ PARTIAL GAP

**Claim:** Frontend không biết choice nào là skill_use.

**Analysis:** Backend `Choice` model có `choice_type: str = "narrative"` (giá trị: `"narrative"` | `"combat_decision"`). Nhưng KHÔNG có `"skill_use"` type. `scene_writer.py` tạo skill choice dưới dạng text pattern `[Tên Skill] — hành động` nhưng không set `choice_type = "skill_use"`.

**Resolution:** Frontend detect từ `choice.text` dùng pattern matching:

```javascript
function isSkillChoice(choice, uniqueSkillName) {
    if (!uniqueSkillName) return false;
    const text = choice.text || '';
    // Pattern: "[Skill Name]" hoặc tên skill xuất hiện trong text
    return text.includes(`[${uniqueSkillName}]`) || 
           text.toLowerCase().includes(uniqueSkillName.toLowerCase());
}
```

> **Lý do chọn frontend detect thay vì backend field:**
> - Không cần thay đổi backend model/API
> - `uniqueSkillName` đã có trong `state.player.unique_skill.name`
> - Pattern `[Skill Name]` được `scene_writer.py` prompt enforce (_"Format: '[Tên Skill] — hành động cụ thể'"_)
> - Fragile? Partially — nhưng Scene Critic validate format rồi, acceptable cho v1

---

### Gap 4 — Loading stage detection ✅ RESOLVED

**Claim:** Frontend không biết SSE status ở stage nào.

**Reality:** SSE `status` events **đã có `stage` field:**

```python
# scene.py:230
yield _sse("status", {"stage": "planning", "message": "Đang lập dàn ý chương 1..."})
# scene.py:260
{"stage": "generating", "message": f"Đang viết scene {scene_num}/{total}..."}
# scene.py:610
yield _sse("status", {"stage": "writing", "message": msg})
# stream.py:52
yield _sse("status", {"stage": "init", "message": "Đang khởi tạo câu chuyện..."})
```

**Mapping table (definitive):**

| SSE `stage` value | NARRATIVE_LOADING key | Description |
|-------------------|-----------------------|-------------|
| `"init"` | `planner` | Khởi tạo story |
| `"planning"` | `planner` | Planner đang chạy |
| `"planned"` | `planner` | Planner xong, chuẩn bị write |
| `"generating"` | `writer` | Writer đang gen scene |
| `"writing"` | `writer` | Writer đang write prose |
| `"scene"` | `nextScene` | Scene complete, chờ input |
| `"loading"` | `nextScene` | Loading state |
| `"pipeline"` | `writer` | Legacy monolithic pipeline |

**Implementation:**

```javascript
function mapSSEStageToLoadingKey(sseStage) {
    const MAP = {
        'init': 'planner',
        'planning': 'planner',
        'planned': 'planner',
        'generating': 'writer',
        'writing': 'writer',
        'scene': 'nextScene',
        'loading': 'nextScene',
        'pipeline': 'writer',
    };
    return MAP[sseStage] || 'writer';
}

// Update handleSceneStatus:
function handleSceneStatus(data) {
    const loadingKey = mapSSEStageToLoadingKey(data.stage);
    showNarrativeLoading(loadingKey); // Use narrative message instead of data.message
    // ... rest of status handling
}
```

> **Quyết định:** Dùng narrative messages thay vì SSE `message` text. SSE `message` vẫn được log tới console cho debug.

---

### Gap 5 — `getLastProseExcerpt()` ✅ RESOLVED

**Implementation:**

```javascript
function getLastProseExcerpt(maxChars = 150) {
    // Priority 1: Current prose text on screen
    const proseEl = document.getElementById('prose-text');
    const proseText = proseEl?.textContent?.trim();
    if (proseText) {
        // Take last N characters, find sentence boundary
        const excerpt = proseText.slice(-maxChars);
        const sentenceStart = excerpt.indexOf('. ');
        return sentenceStart > 0 ? excerpt.slice(sentenceStart + 2) : excerpt;
    }
    
    // Priority 2: Last scene in buffer
    const lastScene = state.sceneBuffer[state.sceneBuffer.length - 1];
    if (lastScene?.prose) {
        const excerpt = lastScene.prose.slice(-maxChars);
        const sentenceStart = excerpt.indexOf('. ');
        return sentenceStart > 0 ? excerpt.slice(sentenceStart + 2) : excerpt;
    }
    
    // Priority 3: sceneProseBuffer
    const keys = Object.keys(state.sceneProseBuffer).sort((a, b) => b - a);
    if (keys.length > 0) {
        const prose = state.sceneProseBuffer[keys[0]];
        const excerpt = prose.slice(-maxChars);
        const sentenceStart = excerpt.indexOf('. ');
        return sentenceStart > 0 ? excerpt.slice(sentenceStart + 2) : excerpt;
    }
    
    return '';
}
```

---

### Gap 6 — Identity Panel HTML ✅ RESOLVED

**Full HTML structure cho Identity Panel:**

```html
<div class="identity-panel" id="identity-panel" aria-hidden="true">
    <div class="identity-panel-backdrop" id="identity-panel-backdrop"></div>
    <div class="identity-panel-content">
        <!-- Close button -->
        <button class="identity-panel-close" id="identity-panel-close" aria-label="Close">✕</button>
        
        <!-- Soul Orb (large version) -->
        <div class="identity-panel-orb">
            <div class="soul-orb soul-orb-large" id="panel-soul-orb">
                <div class="soul-orb-glow"></div>
            </div>
        </div>
        
        <!-- Character Info (migrated from sidebar-header) -->
        <div class="identity-panel-header">
            <h3 class="identity-panel-name" id="panel-player-name">—</h3>
            <span class="identity-panel-archetype" id="panel-archetype"></span>
        </div>
        
        <!-- Stat Bars (migrated from #stat-bars) -->
        <div class="identity-panel-stats" id="panel-stat-bars">
            <!-- Dynamically populated: coherence, instability, breakthrough, dqs, fate -->
        </div>
        
        <!-- DNA Tags (migrated from #sidebar-dna) -->
        <div class="identity-panel-dna" id="panel-dna"></div>
        
        <!-- Unique Skill Profile (migrated from #sidebar-skill-profile) -->
        <div class="identity-panel-skill" id="panel-skill-profile">
            <div class="skill-profile-header" id="panel-skill-toggle">
                <span>🔮 Unique Skill</span>
                <span class="skill-profile-arrow">▼</span>
            </div>
            <div class="skill-profile-body" id="panel-skill-body">
                <div class="skill-profile-name" id="panel-skill-name"></div>
                <div class="skill-profile-desc" id="panel-skill-desc"></div>
                <div class="skill-profile-details" id="panel-skill-details"></div>
            </div>
        </div>
        
        <!-- Identity Event Journal (NEW) -->
        <div class="identity-panel-journal" id="panel-journal">
            <h4>📜 Identity Journal</h4>
            <div class="journal-entries" id="panel-journal-entries">
                <!-- Populated from identity event history -->
            </div>
        </div>
    </div>
</div>
```

**Migration mapping (sidebar → panel):**

| Sidebar Element | Panel Element | ID Change |
|----------------|---------------|-----------|
| `#sidebar-name` | `#panel-player-name` | ✅ |
| `#sidebar-archetype` | `#panel-archetype` | ✅ |
| `#sidebar-skill` | _(merged into panel-skill-profile)_ | ✅ |
| `#stat-bars` | `#panel-stat-bars` | ✅ |
| `#sidebar-dna` | `#panel-dna` | ✅ |
| `#sidebar-skill-profile` | `#panel-skill-profile` | ✅ |
| `#btn-toggle-sidebar` | _(removed — panel toggle via Soul Orb)_ | ✅ |

**JS migration:**
- `updateSidebar()` → `updateIdentityPanel()` (same logic, new element IDs)
- Add `toggleIdentityPanel()` bound to Soul Orb click
- Add panel-backdrop click → close panel
- Add `Escape` key → close panel

---

### Gap 7 — `beforeunload` unreliable ✅ RESOLVED

**Problem:** iOS Safari, Android Chrome không fire `beforeunload` reliably khi swipe-close.

**Resolution:** Multi-trigger save strategy:

```javascript
// 1. After each choice submit (MOST RELIABLE)
function handleChoiceClick(choice) {
    saveGameState(); // ← ADD
    // ... existing choice handling
}

// 2. After each scene complete
function handleSceneComplete(sceneData) {
    // ... existing logic
    saveGameState(); // ← ADD
}

// 3. After chapter end
function showChapterSummary(chapterData) {
    saveGameState(); // ← ADD
    // ... existing logic
}

// 4. Periodic backup (every 60s while playing)
let autoSaveTimer = null;
function startAutoSave() {
    autoSaveTimer = setInterval(saveGameState, 60_000);
}
function stopAutoSave() {
    if (autoSaveTimer) clearInterval(autoSaveTimer);
}

// 5. beforeunload as fallback (still useful on desktop)
window.addEventListener('beforeunload', saveGameState);

// 6. visibilitychange (fires on tab switch, app background)
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveGameState();
});
```

**Updated save trigger table:**

| Trigger | Reliability | Platform |
|---------|-------------|----------|
| After choice submit | ✅ 100% | All |
| After scene complete | ✅ 100% | All |
| After chapter end | ✅ 100% | All |
| `visibilitychange` → hidden | ✅ ~95% | All (better than beforeunload) |
| Periodic (60s interval) | ✅ 100% while tab active | All |
| `beforeunload` | ⚠️ ~85% | Desktop only |

---

### Minor Issue 1 — `narrativeReflection` ✅ RESOLVED

**Problem:** §7 references `narrativeReflection` without clear data source.

**Resolution for v1:** Dùng template-based reflection thay vì LLM-generated:

```javascript
function generateNarrativeReflection(identityDelta) {
    const { coherenceDelta, instabilityDelta } = identityDelta;
    
    if (coherenceDelta < -0.1 && instabilityDelta > 0.1) {
        return 'Linh hồn ngươi dao động — sức mạnh mới nhưng bất ổn.';
    }
    if (coherenceDelta > 0.05) {
        return 'Bản ngã ngươi ngày càng vững chắc — con đường đã rõ ràng.';
    }
    if (instabilityDelta > 0.15) {
        return 'Sức mạnh trong ngươi đang vượt ngoài tầm kiểm soát...';
    }
    if (instabilityDelta < -0.1) {
        return 'Sự bình yên trở lại — ngươi đã tìm được sự cân bằng.';
    }
    return 'Hành trình tiếp tục — mỗi bước chân đều để lại dấu vết.';
}
```

---

### Minor Issue 2 — Soul Orb update call sites ✅ RESOLVED

**`updateSoulOrb()` cần được gọi tại:**

| Call Site | Khi nào | File |
|-----------|---------|------|
| `showIdentityToast(data)` | SSE identity event | `main.js` |
| `loadContinueScreen()` | Load saved state → init orb | `main.js` |
| `init()` | Khi player state có sẵn (từ Soul Forge hoặc saved) | `main.js` |
| `handleMetadata(data)` | Metadata SSE chứa identity stats | `main.js` |
| `updateIdentityPanel()` | Khi panel mở, sync orb state | `main.js` |

**Implementation:**

```javascript
// In showIdentityToast — already has identity data
function showIdentityToast(data) {
    // ... existing toast logic
    
    // Update Soul Orb
    if (data.coherence !== undefined) {
        state.lastCoherence = data.coherence;
        state.lastInstability = data.instability || state.lastInstability;
        updateSoulOrb(data.coherence, state.lastInstability);
        pulseSoulOrb(); // Pulse on identity event
    }
}

// In init — when restoring saved state
function init() {
    // ... existing init logic
    const saved = JSON.parse(localStorage.getItem('amo_game_state'));
    if (saved) {
        updateSoulOrb(saved.coherence || 0.5, saved.instability || 0);
    }
}

// In loadContinueScreen
function loadContinueScreen() {
    // ... existing logic
    updateSoulOrb(savedState.coherence || 0.5, savedState.instability || 0);
}
```
