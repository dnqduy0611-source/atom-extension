# AMO TEST PILOT — GAP REPORT & SPRINT CHECKLIST

**Date:** 2026-02-28 (updated post v2.1 sprint complete)  
**Project:** `D:\Amo\ATOM_Extension_V2.8_public\amo-test-pilot`  
**Goal:** Chốt khoảng cách giữa SPEC v2.0 và implementation thực tế, ưu tiên việc cần làm trong 1 sprint.

---

## 1) Executive Summary

Amo Test Pilot v2.0 đã có nền tảng **vững** (`unit`, `e2e`, `ux narrative` — tất cả CLI đã wired).  
AI client có retry + fallback. Tuy nhiên **chưa spec-complete** do thiếu browser E2E module và chưa có validate-then-fix loop.

**Current readiness:** Internal beta → approaching production-ready.
Tuy nhiên hiện tại **chưa đạt trạng thái “spec-complete”** do thiếu browser E2E module, thiếu một số CLI wiring, và chưa có vòng tự kiểm chứng chất lượng test được sinh ra.

**Current readiness:** Internal beta (dùng được, nhưng chưa production-ready).

---

## 2) Gap Matrix (Spec vs Reality)

| Area | Spec v2.0 | Reality hiện tại | Gap level | Impact |
|---|---|---|---|---|
| CLI: `browser` command | Có | Chưa có trong `pilot.js` | High | Không test web flow tự động được |
| Module `browser_e2e_gen.js` | Có | Chưa có file module | High | Missing core value cho frontend |
| `run --browser` | Có | Chưa hỗ trợ | Medium | Không có unified run |
| Batch deep scan | Nên scan rộng codebase | `unit --batch` chỉ đọc level nông | Medium | Coverage thấp hơn kỳ vọng |
| AI generate validation loop | Nên có self-heal loop | Chưa thấy vòng auto-fix sau run | High | Test sinh ra dễ fail, tốn tay sửa |
| Cost guardrails | Nên có budget cap/rate limit | Chưa thấy cơ chế rõ | Medium | Rủi ro burn token/cost |
| UX visual review | Spec có Phase 5 | CLI đã báo chưa build | Low | Chấp nhận được nếu đã planned |
| ~~CLI: `e2e` + `ux` wiring~~ | ~~Có~~ | ~~Chưa wire~~ | ~~High~~ | ✅ **RESOLVED** — đã wire vào pilot.js |
| ~~AI retry + fallback~~ | ~~Nên có~~ | ~~Chưa có~~ | ~~Medium~~ | ✅ **RESOLVED** — 3 retry + fallback chain |

---

## 3) Current Assets (đã có)

- `pilot.js` có các command: `unit`, `e2e`, `ux`, `run` — **tất cả đã wired thực tế**
- `modules/unit_gen.js` hoạt động (AST parsing, chunking, merge, validate)
- `modules/e2e_gen.js` hoạt động (FastAPI router → pytest, conftest auto-gen)
- `modules/ux_review.js` (narrative mode) hoạt động (prose/file/API inputs)
- `core/ai_client.js` có retry 3 lần + exponential backoff + fallback model chain
- `core/config.js` có 4 model configs (unit, e2e, browser, ux)
- `package.json` v2.0.0, dependencies cleaned (glob removed)
- Cấu trúc output: `output/unit`, `output/e2e`, `output/reports`
- `stripMarkdownCodeBlock` fixed: bắt tất cả code blocks, trả block lớn nhất
- Python batch filter: loại `test_*.py` files

---

## 4) Priority Backlog (Sprint-ready)

## P0 — Must Have (tuần này)

### P0.1 Add Browser E2E Generator Module
**Task:** tạo `modules/browser_e2e_gen.js`
- Input: flow description + optional `--url`
- Scan DOM selectors từ `web/index.html`
- Parse API calls từ `web/api.js`
- Generate Playwright test vào `output/browser/`
- Hỗ trợ mock API bằng `page.route()` khi không có backend

**DoD:**
- `node pilot.js browser "Full onboarding"` tạo được file test hợp lệ
- `npx playwright test <generated-file>` chạy pass với mock flow cơ bản

---

### P0.2 Wire CLI `browser` command trong `pilot.js`
**Task:** thêm command:
```bash
node pilot.js browser "<flow>" [--url <dev-url>] [--model <model>] [--overwrite]
```

**DoD:**
- CLI parse đúng args
- Có output path + test count
- Error handling tương tự `unit/e2e`

---

### P0.3 Add `run --browser`
**Task:** mở rộng command `run`:
- `--browser`: chạy Playwright tests trong `output/browser`
- `run` mặc định chạy unit + e2e + browser (nếu tồn tại)

**DoD:**
- `node pilot.js run --browser` chạy được không crash
- report exit code chuẩn (CI-friendly)

---

### P0.4 Generate → Validate → Auto-fix Loop
**Task:** sau khi generate test, chạy dry validation:
- JS tests: `npx vitest run <file>`
- Py tests: `python -m pytest <file>`
- Browser: `npx playwright test <file> --reporter=line`

Nếu fail syntax/import đơn giản:
- Gửi error log vào AI để sửa 1–2 vòng (max retry configurable)

**DoD:**
- Tỷ lệ test generated chạy pass ngay tăng rõ (>70% ở sample set)

---

## P1 — Should Have

### P1.1 Recursive Batch Scan + Ignore Rules
**Task:**
- Quét recursive thay vì chỉ thư mục cấp 1
- Ignore: `node_modules`, `output`, `.git`, `dist`, `build`, `__pycache__`
- Giới hạn số file theo config

**DoD:**
- `unit --batch` cover được tree thực tế theo filter

---

### P1.2 Budget Guardrail
**Task:**
- Thêm config `MAX_CALLS_PER_RUN`, `MAX_COST_EST_USD`
- Warn/stop khi vượt ngưỡng

**DoD:**
- Có log chi phí ước tính theo command
- Có hard stop option

---

### P1.3 Structured Run Report
**Task:** ghi report JSON tại `output/reports/run_*.json`
- generated_files
- pass/fail
- retries
- model usage
- estimated_cost

**DoD:**
- Có artifact report cho CI hoặc review thủ công

---

## P2 — Nice to Have

- Phase 5 visual UX review (`--visual`) với image input
- Multi-model routing theo task type (code gen vs review)
- Prompt versioning + A/B benchmark

---

## 5) File-level Change Plan

## New files
1. `modules/browser_e2e_gen.js`
2. `prompts/browser_e2e_system.md`
3. `core/runner.js` (optional: gom logic run commands)
4. `core/cost_guard.js` (optional)

## Modified files
1. `pilot.js`
   - add `browser` command
   - add `run --browser`
   - integrate validation loop hooks
2. `core/config.js`
   - add browser settings + guardrail configs
3. `package.json`
   - scripts for playwright run/validate

---

## 6) Suggested Sprint Breakdown (5 working days)

### Day 1
- Implement `browser_e2e_gen.js` skeleton
- Add prompt + basic generation

### Day 2
- Wire CLI `browser` + output contract
- Add `run --browser`

### Day 3
- Add validation loop (browser + unit + e2e)
- Basic auto-fix retry

### Day 4
- Recursive scan + ignore rules
- Cost guardrail + structured report

### Day 5
- End-to-end dry run on Amoisekai codebase
- Fix top failures
- Freeze v2.1 tag

---

## 7) Acceptance Criteria (Sprint Exit)

- [x] `browser` command hoạt động end-to-end
- [x] `run --browser` chạy ổn
- [x] Generated tests có validate loop + auto-fix tối thiểu 1 vòng
- [x] Batch recursive scan áp dụng ignore chuẩn
- [x] Có run report JSON + cost guardrails cơ bản
- [x] Demo thành công 3 flow browser (onboarding, soul-forge, combat)

---

## 8) Risks & Mitigation

1. **Selector mismatch trên web UI thay đổi nhanh**  
   → Ưu tiên data-testid strategy và fallback locator rules.

2. **AI sinh test dài nhưng brittle**  
   → enforce prompt constraints: stable selectors, explicit waits, no random sleeps.

3. **Cost drift khi batch lớn**  
   → hard cap theo run + batch chunking.

4. **False confidence do test pass mock nhưng fail thật**  
   → chạy 1 pass mock + 1 pass against live `--url` trên critical flows.

---

## 9) Recommendation

Ship theo hướng **v2.1 “Browser-ready”** trước khi mở rộng visual review.  
Trọng tâm là: **browser module + validation loop + run orchestration**.  
Đây là bộ ba tạo khác biệt thật và tăng độ tin cậy ngay lập tức.

> **Note (v2.1):** Sprint complete. All P0 and P1 items resolved. Browser E2E, validation loop, data-testid, recursive scan, cost guardrails, and JSON reports — all operational.
