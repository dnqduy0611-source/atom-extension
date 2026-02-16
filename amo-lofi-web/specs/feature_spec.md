# Amo Lofi — Feature Spec

## Features Learned from Beeziee (Match)

### 1. Unified Sound Mixer
- Gộp MusicSelector + AmbienceMixer → 1 panel
- Tabs: Lo-fi / Jazz / Ambient (mood categories)
- Track card: album art thumbnail + name + artist
- UP NEXT queue hiển thị 2-3 tracks
- Ambience sliders bên dưới
- **Priority**: HIGH

### 2. Fullscreen Mode
- `document.documentElement.requestFullscreen()`
- Toggle button in sidebar + keyboard shortcut `F`
- **Priority**: LOW (1 line of code)

### 3. Keyboard Shortcuts Modal
- `Shift+?` → full cheat sheet
- 2 columns: Audio Control + Tools & Interaction
- Glass modal, centered
- **Priority**: LOW

---

## 6 Unique Features (Differentiation)

### 🫁 1. Breathing Guide (Break Activity)
**Thay thế games của Beeziee bằng mindfulness**
- Visual: SVG circle expand/contract
- Patterns: Box Breathing (4-4-4-4), 4-7-8 Relaxing
- Auto-trigger khi Pomodoro break bắt đầu
- Ambient sound tự chuyển sang nature (birds, water)
- Text instruction: "Hít vào..." / "Giữ..." / "Thở ra..."
- **Effort**: 2h | **File**: `BreathingGuide.tsx`

### 🧠 2. Binaural Beats Layer
**Lớp âm thanh khoa học — Brain.fm bán $50/năm, ta cho free**
- Web Audio API: 2 oscillators, chênh lệch tần số tạo binaural beat
- Modes:
  - 🎯 Focus: Left 200Hz + Right 240Hz = 40Hz Gamma
  - 😌 Relax: Left 200Hz + Right 210Hz = 10Hz Alpha
  - 💤 Deep Rest: Left 200Hz + Right 204Hz = 4Hz Theta
- Auto-switch theo Pomodoro: Focus (work) → Relax (break)
- UI: Toggle switch + intensity slider
- **Effort**: 2h | **File**: `useBinauralBeats.ts`

### 🎵 3. Smart Music Flow
**Nhạc tự thay đổi trong session — "set and forget"**
- Timeline:
  - 0-5 min: Soft ambient (ease in)
  - 5-20 min: Rhythmic lofi (deep focus)
  - 20-25 min: Gentle (wind-down)
  - Break: Nature sounds only
- Implementation: tag tracks by intensity, auto-queue
- **Effort**: 3h | **Files**: Track metadata + `useAudioEngine.ts`

### 🤖 4. AI Chat DJ (Phase 2 core)
**User nói → AI setup mọi thứ**
- Input: "Tôi cần tập trung viết code 2 tiếng"
- AI output: `MixerConfig` → `applyConfig()` → scene/music/ambience tự thay đổi
- History learning: "Lần trước bạn dùng Cafe + Rain + Jazz, dùng lại?"
- **Effort**: 4h | **Files**: `AIChatDJ.tsx`, `useAIConfig.ts`

### 📖 5. Reading Mode (ATOM Bridge)
**Competitive moat — Beeziee KHÔNG BAO GIỜ có**
- Extension gửi message → Amo Lofi auto-plays
- Auto-estimate reading time → set Pomodoro
- Content mood detection → music match
- **Effort**: Phase 3-4 | **Files**: Extension bridge

### 📊 6. AI Session Coach
**Actionable insights thay vì raw numbers**
- Post-session AI analysis
- "Bạn focus tốt nhất lúc 9-11am"
- "Session 30 phút hiệu quả hơn 45 phút với bạn"
- Weekly summary email/notification
- **Effort**: 2h | **File**: `SessionCoach.tsx`

---

## Implementation Order
1. Breathing Guide ← easy win, unique
2. Binaural Beats ← science-backed USP
3. Unified Sound Mixer ← match Beeziee
4. Smart Music Flow ← wow factor
5. Fullscreen + Shortcuts Modal ← quick polish
6. AI Chat DJ ← Phase 2
7. AI Session Coach ← Phase 2
8. Reading Mode ← Phase 3-4
