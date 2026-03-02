# 🧪 AMO TEST PILOT — AI Testing Tool cho Amoisekai v2.0

> **Date:** 2026-02-28 (v2.0 — Amoisekai-focused)  
> **Scope:** Testing tool chuyên biệt cho toàn bộ Amoisekai (backend + web frontend)  
> **Goal:** Tự động hoá unit test, API integration test, browser E2E test, và narrative quality review  
> **Stack:** Node.js CLI + OpenRouter API + Playwright + Vitest + pytest  

---

## 1. Tổng Quan

**Amo Test Pilot** là CLI tool dùng AI (qua OpenRouter) để tự động hoá testing cho Amoisekai — hệ thống game isekai AI-driven gồm FastAPI backend + Vanilla JS web frontend.

| Module | Mục tiêu | Target |
|--------|----------|--------|
| **unit-gen** | Sinh unit test từ source code | 22 engine + 12 models + 13 narrative agents |
| **e2e-gen** | Sinh FastAPI integration tests | 6 routers (story, player, soul_forge, scene, skill, stream) |
| **browser-e2e** | Sinh Playwright browser tests | 5 web views (onboarding → soul forge → setup → game → combat) |
| **ux-review** | Đánh giá chất lượng narrative output | Prose quality, choices, pacing, Vietnamese writing |

**Chi phí:** ~$1-3/tháng (OpenRouter API)

---

## 2. Architecture

```
amo-test-pilot/
├── pilot.js                    # CLI entry point (4 commands: unit, e2e, browser, ux)
├── core/
│   ├── ai_client.js            # OpenRouter wrapper (retry + fallback)
│   └── config.js               # Env + model config
├── modules/
│   ├── unit_gen.js             # Unit test generator (AST + chunking)
│   ├── e2e_gen.js              # FastAPI integration test generator
│   ├── browser_e2e_gen.js      # [NEW] Playwright browser E2E generator
│   └── ux_review.js            # Narrative quality reviewer
├── prompts/
│   ├── unit_gen_system.md      # Prompt cho unit gen
│   ├── e2e_gen_amoisekai.md    # Prompt cho API E2E
│   ├── browser_e2e_system.md   # [NEW] Prompt cho browser E2E
│   └── ux_narrative_review.md  # Prompt cho narrative review
└── output/
    ├── unit/                   # Generated Vitest/pytest files
    ├── e2e/                    # Generated FastAPI integration tests
    ├── browser/                # [NEW] Generated Playwright browser tests
    └── reports/                # Narrative quality JSON reports
```

---

## 3. Target Codebase

### 3.1 Unit Test Targets — `app/` (47 Python files)

| Layer | Files | Test Framework | Mô tả |
|-------|-------|---------------|--------|
| `engine/` | 22 files | pytest | CRNG, combat, skill system, soul forge, fate buffer |
| `models/` | 12 files | pytest | Pydantic models: NarrativeState, PlayerState, Combat, Skill |
| `narrative/` | 13 files | pytest + AsyncMock | LangGraph agents: planner, writer, critic, identity |

### 3.2 API Integration Test Targets — 6 FastAPI Routers

| Router | Endpoints | Auth | Priority |
|--------|-----------|------|----------|
| `routers/story.py` | start, continue, state, list, delete | ✅ | P0 |
| `routers/soul_forge.py` | start, answer, result | ✅ | P0 |
| `routers/player.py` | onboard, get state, identity | ✅ | P0 |
| `routers/scene.py` | get scene, submit choice | ✅ | P1 |
| `routers/skill_router.py` | list skills, evolve, discover | ✅ | P1 |
| `routers/stream.py` | SSE stream chapter | ✅ | P2 |

### 3.3 Browser E2E Targets — `web/` (Vanilla JS + Vite)

Amoisekai web app có 5 views chính trong `web/index.html` + `web/main.js` (1,692 lines):

| View | ID | User Flow | Priority |
|------|-----|-----------|----------|
| Loading | `view-loading` | Auto-transition, loading bar | P2 |
| Onboarding Quiz | `view-onboarding` | 7 câu quiz → submit answers | P0 |
| Soul Forge | `view-soul-forge` | 5 scenes + fragment input + backstory + forge animation → skill reveal | P0 |
| Story Setup | `view-story-setup` | Chọn preference tags + tone → bắt đầu story | P0 |
| Game | `view-game` | Prose streaming + choices + free input + combat panel + skill profile | P0 |

**User flows cần test (E2E):**

| # | Flow | Steps | Type |
|---|------|-------|------|
| 1 | Full onboarding | Quiz 7 câu → Soul Forge 5 scenes → Fragment → Name → Start | Happy path |
| 2 | Soul Forge error recovery | Server error mid-forge → error message → retry | Error path |
| 3 | Story playthrough | Setup → Start → Read prose → Choose → Next chapter | Happy path |
| 4 | Free input | Game view → Type custom action → Submit → Prose generated | Happy path |
| 5 | Combat flow | Combat panel appears → Select actions → Submit → Result | Happy path |
| 6 | Character death | Soul death overlay → "Tạo nhân vật mới" → Reset | Edge case |
| 7 | Sidebar interaction | Toggle sidebar → View stats → View skill profile | UI |

### 3.4 Narrative Review Targets

| Input Type | Source | Mô tả |
|-----------|--------|--------|
| JSON file | Lưu API response `/api/story/continue` | Full chapter + choices + critic score |
| Raw prose | Paste prose string | Chỉ đánh giá văn viết |
| Live API | Fetch từ running server | Real-time review chapter mới nhất |

---

## 4. CLI Interface

```powershell
# ─── Unit Test Generation ───
node pilot.js unit ../amo-stories-engine/app/engine/crng.py
node pilot.js unit ../amo-stories-engine/app/models/              # batch all models
node pilot.js unit ../amo-stories-engine/app/narrative/planner.py  # async agent

# ─── E2E Integration Tests (API) ───
node pilot.js e2e ../amo-stories-engine/app/routers/soul_forge.py
node pilot.js e2e ../amo-stories-engine/app/routers/              # batch all routers

# ─── Browser E2E Tests (Playwright) ───
node pilot.js browser "Full onboarding: quiz → soul forge → start"  
node pilot.js browser "Combat flow: encounter → actions → result"   
node pilot.js browser --url http://localhost:5173                    # against running dev server

# ─── Narrative Quality Review ───
node pilot.js ux --narrative --file chapter_output.json
node pilot.js ux --narrative --api http://localhost:8001 --story-id xyz --chapter 3

# ─── Visual UX Review (Phase 5) ───
node pilot.js ux --visual --url http://localhost:5173
node pilot.js ux --visual --screenshot ./screenshots/soul_forge.png

# ─── Run all generated tests ───
node pilot.js run                  # run all
node pilot.js run --unit           # only unit tests
node pilot.js run --browser        # only Playwright tests
```

---

## 5. Module Highlights

### 5.1 Unit Gen — Amoisekai-Specific Intelligence

Khi detect project = `amoisekai`, tự động inject mock patterns:

| Sub-module | Mock Pattern |
|-----------|-------------|
| `narrative/` agents | `AsyncMock` cho `llm.ainvoke`, `NarrativeState` fixtures |
| `engine/` | Pure function tests, CRNG seeding, deterministic assertions |
| `models/` | Pydantic field defaults, validators, type coercion |
| `routers/` | `TestClient` + mock orchestrator, auth override |

**Features:**
- AST parsing: Babel (JS) + Python `ast` module
- Chunking: file >50KB split theo function groups
- Existing test detection: skip tests đã có trong `tests/`
- Syntax validation: compile check trước khi save

### 5.2 E2E Gen — FastAPI Integration Tests

Generate pytest tests cho mỗi router endpoint:

| Per Endpoint | Tests |
|-------------|-------|
| ✅ Happy path | Valid request → 200 |
| ❌ Not found | Non-existent resource → 404 |
| ❌ Unauthorized | Wrong user → 403 |
| ❌ Bad request | Missing fields → 400 |
| ❌ Server error | Orchestrator throws → 500 |

Auto-generate `conftest.py` với shared fixtures: `client`, `mock_db`, `override_auth`, `mock_orchestrator`.

### 5.3 Browser E2E — Playwright Tests

AI nhận flow description bằng tiếng Việt/Anh → sinh Playwright test script:

- Scan `web/index.html` để extract element IDs và structure
- Scan `web/api.js` để hiểu API endpoints frontend gọi
- Generate test sử dụng selectors từ actual DOM
- Mock API responses bằng `page.route()` (tránh cần running backend)
- Support `--url` mode: test against live dev server

### 5.4 UX Review — Dual Mode

**Mode 1: `--narrative`** (đã build, Phase 3)  
Đánh giá text quality của generated narrative:

| Dimension | Weight | Tiêu chí |
|-----------|--------|----------|
| Prose Quality | 30% | Hình ảnh, từ ngữ, mô tả |
| Immersion | 25% | Đắm chìm, không exposition dump |
| Pacing | 15% | Nhịp phù hợp loại chapter |
| Coherence | 15% | Logic, nhất quán personality |
| Tension Curve | 10% | Micro-climax, hook, cliffhanger |
| Vietnamese Quality | 5% | Hán-Việt đúng chỗ, văn phong isekai |

**Mode 2: `--visual`** (chưa build, Phase 5)  
Screenshot → AI Vision phân tích UI:
- Contrast & readability (WCAG AA)
- Visual hierarchy & CTA visibility
- Spacing, alignment, responsive layout
- Anime/isekai aesthetic consistency

Output: JSON structured report + console visualization.

---

## 6. Coverage Targets

| Module layer | Files | Existing tests | Generated target |
|-------------|-------|---------------|-----------------|
| `engine/` (22 files) | 16 test files exist | Bổ sung functions chưa cover |
| `models/` (12 files) | 5 test files exist | +7 model test files |
| `narrative/` (13 files) | 2 test files exist | +11 agent test files |
| `routers/` (6 files) | 0 test files | +6 integration test files |
| `web/` (2 files) | 0 test files | +7 browser E2E flow tests |
| **Total** | 55 source files | 23 test files | +31 new test files |

---

## 7. Dependencies

```json
{
    "dependencies": {
        "@babel/parser": "^7.24.0",
        "chalk": "^5.3.0",
        "commander": "^12.0.0",
        "dotenv": "^16.4.0",
        "glob": "^10.0.0",
        "playwright": "^1.50.0"
    },
    "devDependencies": {
        "vitest": "^2.0.0"
    }
}
```

---

## 8. Cost Estimation

| Action | Model | Cost/call |
|--------|-------|-----------|
| Unit test (1 file) | DeepSeek V3 | ~$0.003 |
| API E2E (1 router) | DeepSeek V3 | ~$0.004 |
| Browser E2E (1 flow) | DeepSeek V3 | ~$0.005 |
| Narrative review (1 chapter) | Gemini Flash | ~$0.002 |
| Visual UX review (1 screenshot) | Gemini Flash | ~$0.003 |

**Full scan (47 unit + 6 api-e2e + 7 browser-e2e + 10 reviews):** ~$0.24/run

---

## 9. Development Phases

| Phase | Module | Status | Priority |
|-------|--------|--------|----------|
| 1 | Unit Gen | ✅ Done | Fix `stripMarkdownCodeBlock` |
| 2 | API E2E Gen | ⚠️ Code done | Wire CLI |
| 3 | UX Narrative (`--narrative`) | ⚠️ Code done | Wire CLI |
| 4 | Browser E2E | ❌ Not started | New module + prompt |
| 5 | UX Visual (`--visual`) | ❌ Not started | Build sau khi UI ổn định |
| 🔧 | AI Client | ⚠️ Needs fix | Add retry + fallback |
