# AMO TEST OPTIMIZATION PLAYBOOK (for Amoisekai)

**Date:** 2026-02-28  
**Scope:** Vận hành + kỹ thuật tối ưu Amo Test Pilot cho codebase Amoisekai  
**Audience:** Dev, QA, Tech Lead

---

## 1) Mục tiêu tối ưu

Tối ưu Amo Test không phải để có nhiều test nhất, mà để đạt 4 mục tiêu sau:

1. **Tin cậy cao**: phát hiện lỗi thật trên flow quan trọng.
2. **Phản hồi nhanh**: dev biết pass/fail sớm sau commit.
3. **Chi phí thấp**: kiểm soát token/API cost khi dùng AI gen.
4. **Ít flaky**: test ổn định, không fail ngẫu nhiên.

---

## 2) North Star

**Principle:** _“Critical-first, deterministic-by-default, AI-assisted-not-AI-dependent.”_

- Test flow quan trọng trước coverage rộng.
- Cố định randomness/state để giảm nhiễu.
- Dùng AI để tăng tốc tạo test, nhưng phải có validate gate.

---

## 3) Tier testing strategy

## Tier 0 — Smoke (bắt buộc mỗi commit)
Thời gian mục tiêu: **< 10 phút**

### 3.1 Golden flows (3 flow bắt buộc pass)
1. **Onboarding → Soul Forge → Start Story**
2. **Story continue + choice submit**
3. **Combat encounter action → result**

### 3.2 Gate rule
- Nếu bất kỳ smoke flow fail => **không merge**.

---

## Tier 1 — Daily core suite
Thời gian mục tiêu: **10–25 phút**

- Unit tests cho `engine/` core logic (combat, crng, fate buffer, skill progression)
- API integration tests cho routers P0 (`story`, `player`, `soul_forge`)
- Contract tests cho response schema

---

## Tier 2 — Weekly deep suite
Thời gian mục tiêu: **30–90 phút**

- Full browser E2E flows
- Narrative UX review batch
- Edge case: soul death/reset, retry/error recovery, state restore

---

## 4) Mandatory quality loop (Generate -> Validate -> Auto-fix)

Mọi test AI generate đều phải qua vòng sau:

1. **Generate test**
2. **Validate compile/syntax/import**
3. **Run targeted test**
4. Nếu fail: **AI auto-fix từ log lỗi** (max 2 vòng)
5. Nếu vẫn fail: mark `manual_review_required`

### 4.1 Retry policy
- Max auto-fix rounds: `2`
- Nếu lỗi infra (timeout/network), retry infra trước rồi mới regenerate.

### 4.2 DoD cho generated test
- Không syntax error
- Chạy pass độc lập
- Có assertion meaningful (không chỉ `expect(true).toBe(true)`)

---

## 5) Determinism checklist (giảm flaky)

## Backend
- Seed CRNG trong test mode
- Freeze time cho logic phụ thuộc thời gian (nếu có)
- Mock external AI calls (`llm.ainvoke`) bằng fixture chuẩn

## Frontend / Browser
- Ưu tiên `data-testid` selectors
- Không dùng `sleep` hardcoded nếu có thể dùng explicit wait
- Mock API responses cho flow smoke

## Narrative
- Với test logic: assert trên structure/state, không assert prose exact string quá dài
- Với prose quality: dùng score threshold thay vì exact match

---

## 6) Selector & UI stability policy

## 6.1 Bắt buộc thêm `data-testid` cho:
- View switch points (`view-onboarding`, `view-soul-forge`, `view-game`)
- Primary CTA buttons
- Choice list container
- Combat action submit
- Error/retry controls

## 6.2 Selector order
1. `data-testid`
2. semantic role/name
3. fallback CSS selector

---

## 7) Coverage policy (risk-based)

Không tăng coverage theo số file một cách mù quáng.  
Ưu tiên theo rủi ro nghiệp vụ:

### P0 (must cover)
- Story progression
- Player state transitions
- Soul forge completion
- Combat resolution

### P1
- Skill evolution branches
- Scene retrieval and submit choice
- Stream endpoint stability

### P2
- Non-critical helper utils
- Cosmetic UI interactions

---

## 8) Cost optimization policy

## 8.1 Budget guardrails
- `MAX_CALLS_PER_RUN`
- `MAX_EST_COST_PER_RUN_USD`
- Hard stop khi vượt trần (configurable)

## 8.2 Model routing
- Unit/E2E generation: model rẻ/ổn định
- Narrative review: model nhanh
- Chỉ escalate model mạnh khi auto-fix fail

## 8.3 Caching
Cache key đề xuất:
- `file_hash + prompt_version + model`
- Nếu hash không đổi => skip regenerate

---

## 9) CI/CD operating mode

## 9.1 On PR
- Run smoke suite + changed-file unit tests
- Block merge nếu smoke fail

## 9.2 On main branch nightly
- Run daily core suite
- Publish JSON report

## 9.3 Weekly scheduled
- Run deep suite + UX narrative review summary
- Push report vào `output/reports/weekly_*.json`

---

## 10) Metrics dashboard (must track)

1. **Smoke pass rate** (target 100%)
2. **First-pass generated test pass rate** (target >= 70%)
3. **Flaky rate** (target < 5%)
4. **Mean time to feedback** (target < 10 min smoke)
5. **Estimated cost per run** (target theo ngân sách team)

---

## 11) Merge checklist (copy-paste)

- [ ] Golden smoke flows pass
- [ ] No new flaky test observed in 3 consecutive runs
- [ ] Generated tests validated (compile + run)
- [ ] Contract tests updated if API schema changed
- [ ] Cost delta acceptable (< configured threshold)
- [ ] Report artifact generated

---

## 12) Incident response runbook (khi test đỏ hàng loạt)

1. Kiểm tra infra first (API keys, env, network, timeout).
2. Chạy lại smoke bằng mock mode.
3. Nếu mock pass nhưng live fail => khả năng backend/API regression.
4. Nếu cả mock fail => khả năng UI selector/flow break.
5. Freeze merge với module liên quan cho đến khi smoke xanh lại.

---

## 13) Suggested sprint implementation order

1. Browser module + CLI wiring (`browser`, `run --browser`)
2. Validate/auto-fix loop
3. Selector hardening (`data-testid` pass)
4. Recursive scan + ignore rules
5. Cost guardrails + reports

---

## 14) Definition of Success (v2.1 Browser-ready)

Amo Test được coi là tối ưu phase này khi:

- Có browser E2E chạy ổn cho 3 golden flows.
- Generated tests pass first-run >= 70%.
- Smoke feedback < 10 phút/commit.
- Flaky rate < 5% trong 1 tuần.
- Cost được kiểm soát trong trần ngân sách đã cấu hình.

---

## 15) Notes

Playbook này là bản vận hành thực chiến.  
Sau 2 tuần chạy thật, cần review lại metric và cập nhật ngưỡng theo dữ liệu thực tế.

### Status Update (v2.1 — 2026-02-28)

All v2.1 sprint items resolved:
- ✅ Browser E2E module (`browser_e2e_gen.js`) — 3 golden flows demo'd
- ✅ Generate → Validate → Auto-fix loop (Section 4) — max 2 fix rounds
- ✅ `data-testid` hardening (Section 6) — 59 static + 6 dynamic types
- ✅ Cost guardrails (Section 8) — MAX_CALLS_PER_RUN + MAX_COST_EST_USD
- ✅ Recursive batch scan — ignore rules, depth limit, truncation
- ✅ Structured JSON run reports — `output/reports/run_*.json`
- ✅ DOM scanner — 139 elements, 5 views, data-testid extraction
- ✅ API scanner — 23 functions, 7 SSE endpoints

