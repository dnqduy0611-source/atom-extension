# SOUL FORGE REDESIGN SPEC — Items 2–8

> **Status:** Ready to implement
> **Prerequisite:** Item 1 (void-dialogue whispers) — ✅ Done
> **Scope:** Frontend (web/) + Backend (app/engine/soul_forge.py)

---

## Tổng quan trạng thái

| # | Item | Status | Effort | Files |
|---|------|--------|--------|-------|
| 1 | Soul Fragment → void-whispers | ✅ Done | — | — |
| 2 | Defer skill reveal đến Ch.2-3 | ⬜ Not done | S | main.js, index.html, style.css |
| 3 | Living Void background (void_anchor colors) | ⬜ Not done | M | main.js, style.css |
| 4 | Fragment prompt contextual theo void_anchor | ⬜ Not done | S | soul_forge.py |
| 5 | Behavioral → personality_hints trung gian | ⬜ Not done | S | soul_forge.py |
| 6 | Forge animation 3-phase + category sigil | ⬜ Not done | L | main.js, index.html, style.css |
| 7 | Backstory → structured signals parse step | ⬜ Not done | M | soul_forge.py |
| 8 | Remove glass-card ở scene 1-2 | ⬜ Not done | S | index.html, style.css |

---

## Item 2: Defer Skill Reveal đến Ch.2-3

### Vấn đề
`showForgeResult()` trong `main.js:543` hiện show full skill card ngay sau forge:
- Skill name, description, mechanic, activation, limitation, weakness, unique_clause
- Vi phạm SOUL_FORGE_SPEC.md Section 8.2: *"Skill KHÔNG được reveal ngay. Skill lần đầu manifest ở Chapter 2-3"*

### Thiết kế mới

**Sau forge → không show skill:**
```
[Forge animation kết thúc]
        ↓
Màn hình fade to black
        ↓
Chỉ show soul_resonance (câu thơ poetic) — italic, gold, centered
        ↓
3-4 giây im lặng
        ↓
"Lửa tắt. Bạn cảm nhận thứ gì đó sâu trong lồng ngực —
 như nhịp tim thứ hai. Bạn không biết nó là gì.
 Nhưng nó là CỦA BẠN."
        ↓
[Button: "Bước vào thế giới mới →"]
        ↓
Story Setup view (không mention skill)
```

**In-game skill reveal (Ch.2-3):**
- Trigger: SSE `scene` event chứa narrative text có `skill_reference` hoặc khi intent classifier nhận diện skill_use lần đầu
- Hiển thị: Overlay card slide-in từ dưới lên, cinematic
- Nội dung reveal: skill name (lớn, gradient), description, soul_resonance — KHÔNG show mechanic/limitation ở đây (player tự khám phá dần)

### Thay đổi cần làm

**`main.js`:**
- `showForgeResult(result)`:
  - Xoá toàn bộ logic render skill-result card
  - Chỉ render: soul_resonance text + transition message + button "Bước vào thế giới mới"
  - Button click → `showView('story-setup')` (giống flow cũ)
  - `state.player.unique_skill` vẫn được lưu đủ (không thay đổi)

- Thêm `revealUniqueSkill()`:
  ```js
  function revealUniqueSkill() {
      // Called when first skill manifest detected in narrative
      const skill = state.player?.unique_skill;
      if (!skill || state.skillRevealed) return;
      state.skillRevealed = true;
      // Show #skill-reveal-overlay with animation
  }
  ```

- Trong SSE handler cho `scene` event: check `scene.skill_first_use === true` → gọi `revealUniqueSkill()`

**`index.html`:**
- Sửa `#forge-result`: xoá `forge-skill-name`, `forge-skill-desc`, `forge-skill-details`, `forge-skill-meta`
- Giữ lại: `forge-skill-resonance` (chỉ show soul_resonance text + transition message)
- Thêm `#skill-reveal-overlay` trong `#view-game`:
  ```html
  <div class="skill-reveal-overlay" id="skill-reveal-overlay" style="display:none">
      <div class="skill-reveal-card">
          <p class="skill-reveal-label">Thứ đó đang thức tỉnh...</p>
          <h2 class="skill-reveal-name" id="skill-reveal-name"></h2>
          <p class="skill-reveal-desc" id="skill-reveal-desc"></p>
          <p class="skill-reveal-resonance" id="skill-reveal-resonance"></p>
          <button class="btn-ghost skill-reveal-close" id="btn-skill-reveal-close">Tôi hiểu rồi</button>
      </div>
  </div>
  ```

**`style.css`:**
- `.forge-result` redesign: chỉ centered text, no card-like appearance
- `.skill-reveal-overlay`: full-screen dim overlay + centered card
- `.skill-reveal-card`: slides in từ bottom với animation, gold glow
- `.skill-reveal-name`: font-size 2rem, gradient text

---

## Item 3: Living Void — Background phản ứng theo void_anchor

### Vấn đề
Background `#0a0a12` tĩnh hoàn toàn suốt Soul Forge. Không có visual feedback khi player chọn path.

### Thiết kế

**Color map theo void_anchor:**
| void_anchor | Primary color | CSS variable |
|-------------|--------------|--------------|
| connection | Amber warm `#f59e0b` | `--void-color: 245, 158, 11` |
| power | Electric blue `#38bdf8` | `--void-color: 56, 189, 248` |
| knowledge | Silver moonlight `#cbd5e1` | `--void-color: 203, 213, 225` |
| silence | Deep indigo `#818cf8` | `--void-color: 129, 140, 248` |

**Progression theo scene:**
```
Scene 1:  Chọn → void_anchor lock → background bắt đầu tint rất nhẹ (opacity 0.03)
Scene 2:  Tint tăng (opacity 0.06) + radial glow mờ ở edges
Scene 3:  CSS crack lines xuất hiện ở corners — ánh sáng lọt qua
Scene 4:  Cracks lan rộng hơn, glow mạnh hơn
Scene 5:  Tất cả vỡ — forge light fills (handled trong forge animation)
```

### Thay đổi cần làm

**`main.js`:**
- Thêm `voidAnchor` vào `forgeState`
- Trong `handleForgeChoice()` khi scene_id === 1:
  ```js
  const VOID_ANCHOR_MAP = ['connection', 'power', 'knowledge', 'silence'];
  forgeState.voidAnchor = VOID_ANCHOR_MAP[choiceIndex] || 'silence';
  applyVoidColor(forgeState.voidAnchor);
  ```
- `applyVoidColor(anchor)`:
  ```js
  function applyVoidColor(anchor) {
      const colors = {
          connection: '245, 158, 11',
          power:      '56, 189, 248',
          knowledge:  '203, 213, 225',
          silence:    '129, 140, 248',
      };
      document.documentElement.style.setProperty('--void-color', colors[anchor] || '167, 139, 250');
  }
  ```
- `advanceVoidScene(sceneId)`: tăng `--void-intensity` theo scene:
  ```js
  function advanceVoidScene(sceneId) {
      const intensity = Math.min(sceneId * 0.02, 0.08);
      document.documentElement.style.setProperty('--void-intensity', intensity);
      if (sceneId >= 3) document.getElementById('forge-container').classList.add('void-cracked');
      if (sceneId >= 4) document.getElementById('forge-container').classList.add('void-fracturing');
  }
  ```
  Gọi trong `renderForgeScene()` sau khi render narrative scene.

**`style.css`:**
```css
:root {
    --void-color: 167, 139, 250;  /* default violet */
    --void-intensity: 0;
}

/* Forge container — living void background */
#view-soul-forge {
    background:
        radial-gradient(
            ellipse at 50% 100%,
            rgba(var(--void-color), var(--void-intensity)) 0%,
            transparent 60%
        ),
        var(--bg-deep);
    transition: background 1.5s ease;
}

/* Cracks — Scene 3+ */
.void-cracked::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image:
        /* Top-left crack */
        linear-gradient(135deg,
            transparent 0%,
            rgba(var(--void-color), 0.06) 48%,
            transparent 50%
        ),
        /* Bottom-right crack */
        linear-gradient(315deg,
            transparent 0%,
            rgba(var(--void-color), 0.04) 48%,
            transparent 50%
        );
    pointer-events: none;
    animation: crackPulse 3s ease-in-out infinite;
}

.void-fracturing::before {
    /* More cracks, higher opacity */
    opacity: 1.5;  /* multiply effect */
}

@keyframes crackPulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
}
```

---

## Item 4: Fragment Prompt Contextual theo void_anchor

### Vấn đề
`_SOUL_FRAGMENT_PROMPT` trong `soul_forge.py:250` là static string — tất cả player nhận cùng 1 câu hỏi bất kể đã chọn gì ở Scene 1.

### Thiết kế

Thay bằng dict 4 prompts, cùng preamble, khác câu hỏi cuối:

```python
_VOID_PREAMBLE = (
    "Lửa nung chảy mọi thứ — nhưng có thứ gì đó từ chối bị xóa. "
    "Một mảnh linh hồn, nhỏ nhưng không thể phá vỡ.\n\n"
)

_FRAGMENT_PROMPTS_BY_ANCHOR = {
    "connection": (
        _VOID_PREAMBLE
        + "Sợi dây nào ngươi không thể để đứt, "
        + "dù ngươi không còn nhớ nó là gì?"
    ),
    "power": (
        _VOID_PREAMBLE
        + "Ngọn lửa trong ngươi cháy vì điều gì? "
        + "Đừng nghĩ — chỉ cần nói."
    ),
    "knowledge": (
        _VOID_PREAMBLE
        + "Điều gì ngươi phải biết, dù nó đau đến đâu?"
    ),
    "silence": (
        _VOID_PREAMBLE
        + "Có điều gì, ở nơi sâu nhất, "
        + "ngươi chưa bao giờ nói ra?"
    ),
}

# Fallback nếu void_anchor chưa xác định
_SOUL_FRAGMENT_PROMPT = (
    _VOID_PREAMBLE
    + "Nếu bạn chỉ được giữ lại DUY NHẤT một thứ khi bước vào thế giới mới "
    + "— đó là gì?"
)
```

### Thay đổi cần làm

**`app/engine/soul_forge.py`** — hàm `get_scene()`:
```python
if session.phase == "fragment":
    # Pick contextual prompt based on void_anchor
    void_anchor = ""
    if session.scene_choices:
        first_choice_signals = session.scene_choices[0].signal_tags
        void_anchor = first_choice_signals.get("void_anchor", "")

    fragment_text = _FRAGMENT_PROMPTS_BY_ANCHOR.get(
        void_anchor, _SOUL_FRAGMENT_PROMPT
    )

    return SceneData(
        scene_id=6,
        title="Soul Fragment",
        text=fragment_text,
        phase="fragment",
    )
```

**Không cần thay đổi frontend** — frontend đã render `scene.text` như thường.

---

## Item 5: Behavioral → Personality Hints (Backend)

### Vấn đề
`_build_forge_prompt_v2()` trong `soul_forge.py:1458` truyền raw behavioral numbers cho AI:
```
- Decisiveness: 0.7
- Deliberation: 0.3
```
AI phải tự suy diễn từ numbers — không nhất quán và đôi khi ignore hoàn toàn.

### Thiết kế

Thêm bước trung gian: convert behavioral vector thành personality guidance text trước khi inject vào prompt.

**Hàm mới `_derive_personality_hints(behavioral)`:**

```python
def _derive_personality_hints(b: BehavioralFingerprint) -> str:
    hints = []

    # Activation style
    if b.impulsivity > 0.7:
        hints.append("Activation trigger phải đơn giản, tức thì — không cần điều kiện phức tạp hay setup lâu dài.")
    elif b.deliberation > 0.7 and b.patience > 0.7:
        hints.append("Skill có depth và complexity — phù hợp với người suy nghĩ sâu trước khi hành động.")

    # Expression style
    if b.expressiveness > 0.7:
        hints.append("Skill liên quan đến giao tiếp, cảm xúc, hoặc biểu đạt — không phải brute force thuần túy.")
    elif b.expressiveness < 0.3:
        hints.append("Skill thiên về nội tâm, âm thầm, hoặc passive — không cần biểu hiện ra ngoài rõ ràng.")

    # Confidence → flavor
    if b.confidence < 0.35:
        hints.append("Flavor phòng thủ, bảo vệ, hoặc reactive — không aggressive hay offensive.")
    elif b.confidence > 0.75:
        hints.append("Flavor chủ động, quyết đoán, hoặc offensive — không hesitant.")

    # Perfectionism
    if b.revision_tendency > 0.65:
        hints.append("Skill có element kiểm soát, cẩn thận, hoặc perfectionism — activation có thể cần chuẩn bị.")

    # Consistency
    if b.consistency < 0.35:
        hints.append("Skill có element hỗn loạn hoặc unpredictability — không phải stable passive buff.")

    # Decisiveness
    if b.decisiveness > 0.75:
        hints.append("Activation cost không nên quá phức tạp — player quyết định nhanh.")

    return "\n".join(f"→ {h}" for h in hints) if hints else "→ Không có hint đặc biệt — balance giữa các traits."
```

**Inject vào `_build_forge_prompt_v2()`:** Thay section "Phase 3 — Soul Signature" raw numbers bằng:
```python
f"""## Phase 3 — Soul Signature (Behavioral):
{_derive_personality_hints(behavioral)}

Raw scores (tham khảo thêm nếu cần):
Decisiveness={behavioral.decisiveness:.2f}, Deliberation={behavioral.deliberation:.2f},
Expressiveness={behavioral.expressiveness:.2f}, Confidence={behavioral.confidence:.2f},
Patience={behavioral.patience:.2f}, Impulsivity={behavioral.impulsivity:.2f}
"""
```

---

## Item 6: Forge Animation 3-Phase + Category Sigil

### Vấn đề
Forge animation hiện tại: 3 CSS fire particles + status text. Không cinematic, không liên quan đến skill.

### Thiết kế

**Timing challenge:** Skill category chỉ biết SAU khi API `/forge` trả về. Animation phải handle:
- Phase 1+2: play trong khi API đang gọi
- Phase 3 (sigil): play sau khi nhận được category

**3 Phases:**

**Phase 1 "Nung chảy" (~3s, auto):**
- Amber/orange gradient fill từ bottom lên — như lò rèn
- Text: `"Hư Vô đang nung chảy linh hồn ngươi..."`
- CSS: pseudo-element `::after` với `transform: scaleY()` transition

**Phase 2 "Rèn" (loop cho đến khi API trả về):**
- Forge sparks: nhiều particles nhỏ bắn ra từ center, hướng ngẫu nhiên
- Khác với fire particles hiện tại — sắc nét, burst pattern
- Text: `"Bản chất ngươi đang định hình..."` (fade in/out loop)
- CSS animation: `@keyframes forgeSpark` với nhiều particles

**Phase 3 "Kết tinh" (~2.5s, trigger sau khi có category):**
- Category sigil hình thành từ các particles tụ lại
- Sigil shapes dùng CSS clip-path hoặc Unicode glyph với scale + glow:

| Category | Glyph | CSS glow color |
|----------|-------|----------------|
| manifestation | ✦ hoặc ⊕ | `rgba(239, 68, 68, 0.6)` — red forge |
| perception | ◉ | `rgba(56, 189, 248, 0.6)` — blue clarity |
| contract | ⊗ | `rgba(251, 191, 36, 0.6)` — gold binding |
| obfuscation | ◈ | `rgba(129, 140, 248, 0.6)` — indigo shadow |
| manipulation | ⊛ | `rgba(52, 211, 153, 0.6)` — teal current |

- Animation: `scale(0) → scale(1.2) → scale(1)` + `opacity(0) → opacity(1)` + `filter: blur(20px) → blur(0)`
- Giữ sigil 1.5s → fade out → transition sang state tiếp theo

### Thay đổi cần làm

**`index.html`** — trong `#forge-animation`:
```html
<div class="forge-animation" id="forge-animation" style="display:none">
    <!-- Phase 1+2: existing fire particles -->
    <div class="forge-fire" id="forge-fire">
        <div class="forge-fire-particle"></div>
        <div class="forge-fire-particle"></div>
        <div class="forge-fire-particle"></div>
    </div>
    <!-- Phase 3: category sigil -->
    <div class="forge-sigil" id="forge-sigil" style="display:none">
        <div class="forge-sigil-glyph" id="forge-sigil-glyph"></div>
    </div>
    <p class="forge-status" id="forge-status"></p>
    <!-- Name input (existing) -->
    <div class="form-group" id="forge-name-group" style="display:none">
        <label for="forge-name-input">Tên nhân vật</label>
        <input type="text" id="forge-name-input" placeholder="Đặt tên cho linh hồn mới..."
            class="glass-input" data-testid="forge-name-input" />
        <button class="btn-primary btn-glow" id="btn-forge-go" style="margin-top:1rem"
            data-testid="forge-submit-go">
            <span class="btn-icon">⚡</span> Hoàn tất Soul Forge
        </button>
    </div>
</div>
```

**`main.js`** — `handleForgeGo()`:
```js
async function handleForgeGo() {
    // ... existing name/button disable ...

    // Phase 1: Nung chảy (play immediately)
    startForgePhase1();

    // Await API (Phase 2 loops during wait)
    const res = await api.soulForgeForge(forgeState.sessionId, name);

    // Phase 3: Kết tinh (with category from response)
    await playForgeSigil(res.skill_category);

    // Then save player + show result
    state.player = { ... };
    showForgeResult(res);
}

function startForgePhase1() {
    $('#forge-status').textContent = 'Hư Vô đang nung chảy linh hồn ngươi...';
    $('#forge-fire').classList.add('phase-smelt');
}

async function playForgeSigil(category) {
    const SIGILS = {
        manifestation: '✦', perception: '◉',
        contract: '⊗', obfuscation: '◈', manipulation: '⊛',
    };
    const COLORS = {
        manifestation: '239, 68, 68',   perception: '56, 189, 248',
        contract:      '251, 191, 36',  obfuscation: '129, 140, 248',
        manipulation:  '52, 211, 153',
    };

    $('#forge-fire').style.display = 'none';
    $('#forge-status').textContent = 'Linh hồn đang kết tinh...';

    const sigilEl = $('#forge-sigil');
    const glyphEl = $('#forge-sigil-glyph');
    glyphEl.textContent = SIGILS[category] || '✦';
    glyphEl.style.setProperty('--sigil-color', COLORS[category] || '167, 139, 250');

    sigilEl.style.display = 'block';
    sigilEl.classList.add('forge-sigil-reveal');

    await new Promise(r => setTimeout(r, 2500));
    sigilEl.classList.add('forge-sigil-exit');
    await new Promise(r => setTimeout(r, 600));
}
```

**`style.css`:**
```css
/* Forge Sigil */
.forge-sigil {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: var(--space-xl);
}

.forge-sigil-glyph {
    font-size: 5rem;
    color: rgba(var(--sigil-color, 167, 139, 250), 0.9);
    filter: drop-shadow(0 0 30px rgba(var(--sigil-color, 167, 139, 250), 0.5));
    transform: scale(0);
    opacity: 0;
}

.forge-sigil-reveal .forge-sigil-glyph {
    animation: sigilReveal 0.8s var(--ease-out) forwards;
}

@keyframes sigilReveal {
    0%   { transform: scale(0); opacity: 0; filter: blur(20px) drop-shadow(...); }
    70%  { transform: scale(1.15); opacity: 1; filter: blur(0) drop-shadow(0 0 40px rgba(var(--sigil-color), 0.8)); }
    100% { transform: scale(1); opacity: 1; filter: drop-shadow(0 0 20px rgba(var(--sigil-color), 0.5)); }
}

.forge-sigil-exit .forge-sigil-glyph {
    animation: sigilExit 0.5s ease-in forwards;
}

@keyframes sigilExit {
    to { transform: scale(1.5); opacity: 0; filter: blur(10px); }
}

/* Phase 1: Smelt — orange fill from bottom */
.forge-fire.phase-smelt {
    position: relative;
}
.forge-fire.phase-smelt::after {
    content: '';
    position: fixed;
    bottom: 0; left: 0; right: 0;
    height: 0;
    background: linear-gradient(to top, rgba(245, 158, 11, 0.08), transparent);
    animation: smeltRise 3s ease-out forwards;
    pointer-events: none;
    z-index: 0;
}
@keyframes smeltRise {
    to { height: 60vh; }
}
```

---

## Item 7: Backstory → Structured Signals Parse Step (Backend)

### Vấn đề
Whisper answers (occupation, trait, memory) hiện được nối thành plain text và pass vào forge prompt:
```
"Nghề nghiệp: bác sĩ. Đặc điểm: không bao giờ nói dối. Ký ức: mẹ rời đi."
```
AI phải tự parse câu này trong context của prompt lớn → inconsistent extraction.

### Thiết kế

Thêm bước parse nhẹ **trước** khi gọi `_build_forge_prompt_v2()`. Chạy Gemini Flash với prompt nhỏ (~200 tokens) để extract 3 signals:

```python
async def _parse_backstory_signals(
    backstory: str,
    llm: object,
) -> dict:
    """Extract structured signals from backstory free-text."""
    if not backstory or len(backstory.strip()) < 10:
        return {}

    prompt = f"""Từ tiểu sử này: "{backstory}"

Trả JSON với 3 fields:
- domain_hint: 1 từ gợi ý loại skill (perception/manifestation/contract/obfuscation/manipulation/none)
- skill_flavor: 1-3 từ mô tả flavor của skill (vd: "medical precision", "silent guardian", "truth seeker")
- emotional_core: 1 từ cảm xúc chủ đạo (loss/determination/love/rage/grief/hope/fear/pride)

Chỉ trả JSON, không giải thích."""

    try:
        response = await llm.ainvoke(prompt)
        return json.loads(response.content)
    except Exception:
        return {}
```

**Inject vào `_build_forge_prompt_v2(signals)`:**
```python
backstory_section = ""
if signals.backstory_signals:
    bs = signals.backstory_signals
    backstory_section = f"""## Tín hiệu Tiểu Sử (đã parse):
- Domain hint: {bs.get('domain_hint', 'none')} → ưu tiên nhưng không bắt buộc
- Skill flavor: {bs.get('skill_flavor', '')}
- Emotional core: {bs.get('emotional_core', '')}
"""
```

**Lưu vào `IdentitySignals`:**
```python
# Trong models/soul_forge.py — thêm field:
backstory_signals: dict = Field(default_factory=dict)
```

**Gọi trong `build_identity_signals()`:**
```python
# Sau khi build signals, nếu có LLM context:
# (gọi từ forge route, truyền llm vào)
if session.backstory:
    signals.backstory_signals = await _parse_backstory_signals(session.backstory, llm)
```

> **Note:** Cần pass `llm` vào `build_identity_signals()` hoặc tách thành 2 bước trong router. Cost: ~$0.0001/player (rất nhỏ).

---

## Item 8: Remove glass-card từ Scene 1-5

### Vấn đề
`#forge-scene` có class `glass-card` → border, background, border-radius — cảm giác UI component, không phải void.

### Thiết kế
Scene 1-2: Text nổi hoàn toàn trong void, không có card viền.
Scene 3-4: Vẫn minimal — nhưng crack effects từ Item 3 tạo visual context.
Choices: Giữ choice card border (player cần biết đây là interactive element).

### Thay đổi cần làm

**`index.html`:**
```diff
- <div class="forge-scene glass-card" id="forge-scene" ...>
+ <div class="forge-scene" id="forge-scene" ...>
```

**`style.css`** — update `.forge-scene`:
```css
.forge-scene {
    width: min(620px, 95%);
    padding: var(--space-xl) var(--space-lg);
    text-align: center;
    z-index: 1;
    /* Remove: background, border, backdrop-filter, border-radius */
    /* Keep: width, padding, text-align, z-index */
}
```

Thêm transition khi scene text xuất hiện (đã có `forge-fade-in`) — không thay đổi thêm.

**Scene title:** Vẫn giữ gradient text (`.forge-scene-title`), không thay đổi.

---

## Thứ tự implement đề xuất

Items không phụ thuộc nhau — có thể làm song song. Thứ tự theo impact/effort ratio:

```
1. Item 8 (glass-card remove)     → S effort, visual improvement ngay
2. Item 4 (contextual prompt)     → S effort, assessment improvement
3. Item 2 (defer skill reveal)    → S effort, story immersion quan trọng
4. Item 5 (personality hints)     → S effort, accuracy improvement
5. Item 3 (living void BG)        → M effort, visual improvement
6. Item 7 (backstory parse)       → M effort, accuracy improvement
7. Item 6 (forge animation)       → L effort, cinematic upgrade
```

Items 4 và 5 là backend-only, có thể làm cùng lúc.
Items 8 và 2 là frontend-only, có thể làm cùng lúc.
