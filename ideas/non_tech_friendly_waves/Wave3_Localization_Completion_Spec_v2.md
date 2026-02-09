# Non-Tech Friendly Wave 3 Spec v2

**Version**: 2.0
**Date**: 2026-02-08
**Status**: Ready for Implementation
**Previous Version**: Wave3_Localization_Completion_Spec.md (outdated baseline)

---

## 1) Mục tiêu và phạm vi

Wave 3 đồng bộ hoàn toàn i18n để không còn fallback ngôn ngữ không mong muốn cho user VI.

### Mục tiêu định lượng:
1. **Key parity**: `missing in vi = 0` so với EN.
2. **100% màn hình chính** không xuất hiện fallback English khi locale là VI.
3. **Có công cụ check tự động** để chặn missing key trong các PR sau.
4. **Zero placeholder mismatch** giữa EN và VI.

### Phạm vi:
- `_locales/vi/messages.json` - Thêm 252 keys thiếu
- `_locales/en/messages.json` - Verify và cleanup nếu cần
- `tools/i18n/check_parity.mjs` - Tool kiểm tra tự động (optional, recommended)

---

## 2) Baseline hiện tại (Cập nhật 2026-02-08)

### Số liệu thực tế:
```
EN keys:                797
VI keys:                545
Missing in VI:          252
Missing in EN:          0
Placeholder mismatches: 0 (clean state ✅)
```

**Note**: Con số này đã tính Wave 1 và Wave 2 implementations (thêm ~71 keys vào cả EN và VI).

### Phân bố keys thiếu theo domain:
```
Domain          Count   Percentage  Priority  Batch
─────────────────────────────────────────────────────
sp_*            225     89.3%       HIGH      B1-B5
focus_*         13      5.2%        MEDIUM    B6
sidepanel_*     8       3.2%        HIGH      B6
reading_*       3       1.2%        MEDIUM    B6
ctx_*           1       0.4%        LOW       B6
opt_*           1       0.4%        HIGH      B6
popup_*         1       0.4%        MEDIUM    B6
─────────────────────────────────────────────────────
TOTAL           252     100%
```

**Critical Insight**: 89% keys thiếu nằm trong `sp_*` domain (sidepanel). Cần chiến lược batch rõ ràng.

---

## 3) Non-goals

1. Không thay đổi logic runtime.
2. Không đổi locale strategy của manifest.
3. Không chỉnh sửa nội dung marketing ngoài scope extension UI.
4. Không refactor key naming structure (giữ nguyên key names hiện tại).

---

## 4) Chuẩn hóa i18n

### 4.1 Nguồn sự thật
1. **EN là source of truth** cho key set.
2. VI phải mirror đầy đủ key của EN.
3. Mọi key mới trong tương lai phải add vào CẢ EN VÀ VI cùng lúc.

### 4.2 Quy tắc đặt key
1. Key theo domain: `popup_*`, `opt_*`, `sp_*`, `srq_*`, `bug_*`, `focus_*`.
2. Không tạo key mới nếu key cũ đã dùng được.
3. Placeholder phải có `placeholders` đúng tên biến.
4. Key name phải descriptive: `sp_error_rate_limit` (not `sp_err1`).

### 4.3 Quy tắc dịch
1. **Ngắn gọn, dễ hiểu, plain-language** (theo tinh thần Wave 1).
2. **Đồng nhất thuật ngữ** đã chốt:
   - "API key" → "Mã kết nối AI" / "AI Access Key"
   - "Export" → "Lưu" / "Save"
   - "Settings" → "Cài đặt" / "Settings"
   - "Advanced" → "Nâng cao" (not "Cao cấp")
3. Không dùng viết tắt khó hiểu.
4. **Preserve placeholder structure** y hệt EN:
   ```json
   // EN
   "sp_quiz_of": {
     "message": "Question $1 of $2",
     "placeholders": {
       "current": { "content": "$1", "example": "2" },
       "total": { "content": "$2", "example": "5" }
     }
   }

   // VI
   "sp_quiz_of": {
     "message": "Câu hỏi $1 / $2",
     "placeholders": {
       "current": { "content": "$1", "example": "2" },
       "total": { "content": "$2", "example": "5" }
     }
   }
   ```

---

## 5) Kế hoạch thực thi

### 5.1 Bước 1: Gap analysis (DONE)
✅ Đã sinh danh sách 252 keys missing VI.
✅ Đã nhóm theo domain để chia batch.

### 5.2 Bước 2: Translation - Phân batch theo chức năng

#### **Batch Strategy Overview**

Chia thành **6 batches** với priority khác nhau:

| Batch | Domain | Keys | Priority | Est. Time | PR Order |
|-------|--------|------|----------|-----------|----------|
| B1    | sp_* Core UI & Navigation | 40 | CRITICAL | 0.5 day | #1 |
| B2    | sp_* Retention Features | 45 | HIGH | 0.5 day | #2 |
| B3    | sp_* Learning Features | 50 | HIGH | 0.5 day | #3 |
| B4    | sp_* Actions & Feedback | 45 | MEDIUM | 0.5 day | #4 |
| B5    | sp_* Errors & Edge Cases | 45 | HIGH | 0.5 day | #5 |
| B6    | Small Domains (focus, sidepanel, etc) | 27 | MIXED | 0.5 day | #6 |

**Total**: 6 batches, 252 keys, ~3 days translation + 0.5 day per-batch QA = **4 days**

---

#### **Batch 1: sp_* Core UI & Navigation (40 keys) - CRITICAL**

**Scope**: Fundamental UI elements user sees immediately when opening sidepanel.

**Keys to translate**:
```
sp_title
sp_threads_label
sp_highlighted_text
sp_input_placeholder
sp_menu_clear
sp_no_discussions
sp_no_connections
sp_no_highlight
sp_no_content
sp_from_reading_card
sp_analyzing
sp_generating
sp_exporting
sp_shortcut_send
sp_shortcut_insight
sp_shortcut_done
sp_shortcut_note
sp_shortcut_search
sp_shortcut_undo
sp_btn_mark_done
sp_btn_key_insight
sp_btn_download_notes
sp_btn_finish_reading
sp_btn_save_to_knowledge
sp_btn_save_all_knowledge
sp_btn_compare
sp_btn_merge
sp_btn_quick_save
sp_key_insight_label
sp_key_insight_copy
sp_key_insight_save
sp_chip_analyze
sp_chip_example
sp_action_explain
sp_action_summarize
sp_action_counter
sp_action_connect
sp_toast_saved
sp_toast_copied
sp_toast_quick_saved
sp_toast_already_saved
```

**Translation Guide**:
- `sp_btn_*`: Dùng động từ ngắn gọn (Đánh dấu xong, Lưu ghi chú)
- `sp_toast_*`: Thông báo ngắn 2-4 từ (Đã lưu, Đã sao chép)
- `sp_no_*`: Empty state descriptions (Chưa có thảo luận, Chưa có nội dung)

**Test After Merge**:
- [ ] Open sidepanel → VI locale → All buttons show Vietnamese
- [ ] Quick actions menu → All actions in Vietnamese
- [ ] Toast notifications → Vietnamese messages

---

#### **Batch 2: sp_* Retention Features (45 keys) - HIGH**

**Scope**: Quiz, Teachback, Flashcard, Reading Card features.

**Keys to translate**:
```
sp_retention_quiz_title
sp_retention_teachback_title
sp_retention_flashcard_title
sp_retention_close
sp_retention_no_highlight
sp_retention_loading
sp_retention_unavailable
sp_retention_missing_key
sp_retention_empty_quiz
sp_quiz_skip
sp_quiz_submit
sp_quiz_evaluating
sp_quiz_continue
sp_quiz_placeholder
sp_quiz_question
sp_quiz_of
sp_quiz_summary_title
sp_quiz_add_review
sp_quiz_done
sp_quiz_correct_label
sp_quiz_missing_label
sp_quiz_evidence_label
sp_quiz_added_review
sp_teachback_title
sp_teachback_prompt_label
sp_teachback_hint
sp_teachback_submit
sp_teachback_retry
sp_teachback_add_review
sp_teachback_placeholder
sp_teachback_feedback_title
sp_teachback_suggestions_title
sp_teachback_misconceptions_title
sp_teachback_added_review
sp_flashcard_show_answer
sp_flashcard_rate_again
sp_flashcard_rate_hard
sp_flashcard_rate_good
sp_flashcard_rate_easy
sp_flashcard_review_title
sp_flashcard_review_done
sp_flashcard_review_empty
reading_card_quiz_action
reading_card_teachback_action
reading_card_flashcard_action
```

**Translation Guide**:
- `sp_quiz_*`: Dùng ngôn ngữ học tập thân thiện (Câu hỏi, Tiếp tục)
- `sp_teachback_*`: Giọng điệu khuyến khích (Thử lại, Góp ý)
- `sp_flashcard_*`: Term đơn giản (Dễ, Khó, Lại, Tốt)

**Test After Merge**:
- [ ] Trigger quiz from reading card → All UI in VI
- [ ] Open teachback modal → Prompts in VI
- [ ] Review flashcards → Rating buttons in VI

---

#### **Batch 3: sp_* Learning Features (50 keys) - HIGH**

**Scope**: Primer, Mode selector, Stats, Connections, Deep angle, Semantic features.

**Keys to translate**:
```
sp_primer_title
sp_primer_topic_label
sp_primer_objectives
sp_primer_start
sp_primer_skip
sp_primer_started
sp_primer_skipped
sp_mode_label
sp_mode_skim_label
sp_mode_skim_desc
sp_mode_deep_label
sp_mode_deep_desc
sp_stats_time
sp_stats_discussions
sp_stats_done
sp_stats_saved
sp_connections_title
sp_connection_contradicts
sp_connection_supports
sp_connection_extends
sp_menu_semantic_embeddings
sp_menu_semantic_search
sp_toggle_on
sp_toggle_off
sp_toggle_locked
sp_semantic_cost_warning
sp_semantic_key_required
sp_semantic_needs_embeddings
sp_deep_angle
sp_deep_angle_title
sp_deep_angle_hint
sp_deep_angle_analyzing
sp_deep_angle_loading
sp_deep_angle_empty
sp_deep_angle_error
sp_auto_summary_title
sp_auto_summary_takeaways
sp_auto_summary_suggestions
sp_auto_summary_create_insight
sp_auto_summary_ask_followup
sp_auto_summary_dismiss
sp_bloom_level_1
sp_bloom_level_2
sp_bloom_level_3
sp_bloom_level_4
sp_bloom_level_5
sp_bloom_level_6
sp_quick_note_title
sp_quick_note_placeholder
sp_quick_note_add
sp_quick_note_empty
```

**Translation Guide**:
- `sp_mode_*`: Dùng term Wave 1 (Đọc nhanh / Quick read, Đọc kỹ / Focused)
- `sp_connection_*`: Học thuật nhưng dễ hiểu (Mâu thuẫn, Hỗ trợ, Mở rộng)
- `sp_bloom_level_*`: Dịch theo Bloom's Taxonomy chuẩn (Nhớ, Hiểu, Áp dụng, Phân tích, Đánh giá, Sáng tạo)

**Test After Merge**:
- [ ] Primer modal → VI instructions
- [ ] Reading mode selector → Labels in VI
- [ ] Connections panel → Relationship types in VI

---

#### **Batch 4: sp_* Actions & Feedback (45 keys) - MEDIUM**

**Scope**: Nudges, Auto summary, Undo actions, Welcome guide, Search/Filter.

**Keys to translate**:
```
sp_nudge_fast_scroll_title
sp_nudge_fast_scroll_msg
sp_nudge_passive_title
sp_nudge_passive_msg
sp_nudge_section_title
sp_nudge_section_msg
sp_nudge_completion_title
sp_nudge_completion_msg
sp_nudge_action_open_panel
sp_nudge_action_ask
sp_nudge_action_self_check
sp_nudge_action_insight
sp_nudge_action_key_point
sp_nudge_action_next_steps
sp_undo
sp_action_undone
sp_marked_done
sp_note_deleted
sp_chat_cleared
sp_nothing_to_undo
sp_welcome_guide
sp_guide_title
sp_guide_close
sp_guide_highlight_title
sp_guide_highlight_desc
sp_guide_chat_title
sp_guide_chat_desc
sp_guide_insight_title
sp_guide_insight_desc
sp_guide_save_title
sp_guide_save_desc
sp_guide_shortcuts_title
sp_tooltip_first_insight
sp_search_placeholder
sp_search_hint
sp_search_no_results
sp_filter_all
sp_filter_today
sp_filter_week
sp_filter_insights
sp_filter_notes
sp_time_just_now
sp_confirm_end_session
sp_confirm_export_all
```

**Translation Guide**:
- `sp_nudge_*`: Giọng điệu nhẹ nhàng, khuyến khích (Bạn có muốn...?)
- `sp_guide_*`: Onboarding friendly tone
- `sp_filter_*`: Term ngắn gọn (Tất cả, Hôm nay, Tuần này)

**Test After Merge**:
- [ ] Trigger nudge → Message in VI
- [ ] Open welcome guide → All steps in VI
- [ ] Use search/filter → Labels in VI

---

#### **Batch 5: sp_* Errors & Edge Cases (45 keys) - HIGH**

**Scope**: Error messages, offline handling, network issues, export features.

**Keys to translate**:
```
sp_error_empty_response
sp_error_empty_response_desc
sp_error_network
sp_error_network_desc
sp_error_rate_limit
sp_error_rate_limit_desc
sp_error_server
sp_error_server_desc
sp_error_timeout
sp_error_timeout_desc
sp_error_unknown
sp_error_generic_desc
sp_error_bad_request
sp_error_forbidden
sp_error_not_found
sp_error_unavailable
sp_error_save
sp_nlm_disabled
sp_nlm_pii_blocked
sp_offline_message
sp_offline_mode
sp_network_restored
sp_network_lost
sp_still_offline
sp_message_queued
sp_sending_pending
sp_pending_partial
sp_waiting_connection
sp_retry
sp_retrying
sp_open_settings
sp_report_issue
sp_export_empty
sp_export_title
sp_export_format
sp_export_content
sp_export_cancel
sp_export_download
sp_export_opt_insights
sp_export_opt_notes
sp_export_opt_chat
sp_export_opt_source
sp_export_success
sp_multitab_warning
sp_multitab_continue
sp_multitab_switch
sp_data_sync
```

**Translation Guide**:
- `sp_error_*`: Phải có CTA rõ ràng (Thử lại, Mở Cài đặt, Báo lỗi)
- `sp_offline_*`: Giải thích tình trạng (Mất kết nối, Đang thử lại)
- `sp_export_*`: Dùng term Wave 1 ("Lưu" not "Export")

**Test After Merge**:
- [ ] Simulate network error → Error message in VI with CTA
- [ ] Go offline → Offline indicator in VI
- [ ] Export flow → All dialogs in VI

---

#### **Batch 6: Small Domains (27 keys) - MIXED PRIORITY**

**Scope**: Các domain nhỏ: focus_*, sidepanel_*, reading_*, ctx_*, opt_*, popup_*.

**Keys to translate**:

**focus_* (13 keys)**:
```
focus_review_title
focus_review_subtitle
focus_review_read
focus_review_stats
focus_review_stat_highlights
focus_review_stat_insights
focus_review_stat_messages
focus_review_question_label
focus_review_hint
focus_review_placeholder
focus_review_submit
focus_review_skip
focus_review_feedback_saved
```

**sidepanel_* (8 keys)**:
```
sidepanel_title
sidepanel_loading
sidepanel_welcome
sidepanel_welcome_desc
sidepanel_input_placeholder
sidepanel_quick_summarize
sidepanel_quick_keypoints
sidepanel_quick_explain
```

**Others (6 keys)**:
```
reading_card_quiz_action (already in B2, remove duplicate)
reading_card_teachback_action (already in B2, remove duplicate)
reading_card_flashcard_action (already in B2, remove duplicate)
ctx_chat_with_page
opt_nlm_pii_warning_desc
popup_focus_custom
```

**Actual count**: 24 keys (3 duplicates removed from B2)

**Translation Guide**:
- `focus_review_*`: Focus mode reflection UI
- `sidepanel_*`: Legacy keys (might be unused, verify before translate)
- Others: Context-specific

**Test After Merge**:
- [ ] Focus mode review → All prompts in VI
- [ ] Check if sidepanel_* keys still used in code
- [ ] Popup focus custom option → VI label

---

### 5.3 Bước 3: Runtime fallback audit (Per-batch)

Mỗi batch merge xong, check fallback hardcoded trong:
- `sidepanel.js` - Main UI logic
- `ui/components/` - Component-level fallbacks
- `services/` - Service layer messages

**Pattern to check**:
```javascript
// ❌ Bad fallback (technical jargon)
const msg = chrome.i18n.getMessage('sp_error_network') || 'Network error';

// ✅ Good fallback (plain language + CTA)
const msg = chrome.i18n.getMessage('sp_error_network') ||
  'Connection lost. Please check your internet and try again.';
```

**Action**: Update fallback strings to match Wave 1 plain-language style.

---

### 5.4 Bước 4: Add parity check tool (Optional but Recommended)

**Location**: `tools/i18n/check_parity.mjs`

**Requirements**:
1. Parse EN and VI messages.json
2. Compare key sets (missing in VI, missing in EN)
3. Compare placeholder structure
4. Exit code non-zero if mismatch found
5. CI-friendly output format

**Sample Implementation**:
```javascript
// tools/i18n/check_parity.mjs
import { readFileSync } from 'fs';

const en = JSON.parse(readFileSync('_locales/en/messages.json', 'utf8'));
const vi = JSON.parse(readFileSync('_locales/vi/messages.json', 'utf8'));

const enKeys = new Set(Object.keys(en));
const viKeys = new Set(Object.keys(vi));

const missingInVi = [...enKeys].filter(k => !viKeys.has(k));
const missingInEn = [...viKeys].filter(k => !enKeys.has(k));

let exitCode = 0;

if (missingInVi.length > 0) {
  console.error(`❌ Missing in VI: ${missingInVi.length} keys`);
  missingInVi.forEach(k => console.error(`  - ${k}`));
  exitCode = 1;
}

if (missingInEn.length > 0) {
  console.error(`❌ Missing in EN: ${missingInEn.length} keys`);
  missingInEn.forEach(k => console.error(`  - ${k}`));
  exitCode = 1;
}

// Check placeholder mismatches
const mismatches = [];
Object.keys(en).forEach(key => {
  if (!vi[key]) return;
  const enPlaceholders = en[key].placeholders ? Object.keys(en[key].placeholders).sort() : [];
  const viPlaceholders = vi[key].placeholders ? Object.keys(vi[key].placeholders).sort() : [];
  if (JSON.stringify(enPlaceholders) !== JSON.stringify(viPlaceholders)) {
    mismatches.push({ key, en: enPlaceholders, vi: viPlaceholders });
  }
});

if (mismatches.length > 0) {
  console.error(`❌ Placeholder mismatches: ${mismatches.length}`);
  mismatches.forEach(m => {
    console.error(`  ${m.key}: EN[${m.en.join(',')}] != VI[${m.vi.join(',')}]`);
  });
  exitCode = 1;
}

if (exitCode === 0) {
  console.log('✅ i18n parity check passed');
  console.log(`   EN keys: ${enKeys.size}`);
  console.log(`   VI keys: ${viKeys.size}`);
}

process.exit(exitCode);
```

**Usage**:
```bash
node tools/i18n/check_parity.mjs
```

**Integration** (optional):
- Add to `package.json`: `"scripts": { "check:i18n": "node tools/i18n/check_parity.mjs" }`
- Add to pre-commit hook (future work)

---

## 6) File-level implementation

### `_locales/vi/messages.json`
**Changes**:
1. Add 252 keys in 6 batches
2. Preserve placeholder structure from EN
3. Ensure UTF-8 encoding
4. Maintain alphabetical order within each batch (for easier review)

**Format Example**:
```json
{
  "sp_btn_mark_done": {
    "message": "Đánh dấu xong"
  },
  "sp_quiz_of": {
    "message": "Câu hỏi $1 / $2",
    "placeholders": {
      "current": { "content": "$1", "example": "2" },
      "total": { "content": "$2", "example": "5" }
    }
  }
}
```

### `_locales/en/messages.json`
**Changes**: No changes expected (already complete at 797 keys).

**Action**: Verify no orphaned keys (keys in code but not in messages.json).

### `tools/i18n/check_parity.mjs` (NEW FILE)
**Changes**: Create parity check tool as specified in section 5.4.

### `README.md` or `spec/i18n/README.md` (Optional)
**Changes**: Document i18n workflow:
```markdown
## i18n Maintenance

### Adding New Keys
1. Add key to `_locales/en/messages.json` (source of truth)
2. Mirror key to `_locales/vi/messages.json` immediately
3. Run `node tools/i18n/check_parity.mjs` to verify

### Translation Guidelines
- Use plain language (avoid technical jargon)
- Keep consistent with existing terms (see Wave 1 glossary)
- Preserve placeholder structure exactly
```

---

## 7) Test plan

### 7.1 Static Tests (Run after each batch)

**Parity Check**:
```bash
node tools/i18n/check_parity.mjs
# Expected: Exit 0, no missing keys
```

**JSON Validation**:
```bash
# Validate EN
node -e "require('./_locales/en/messages.json')"
# Validate VI
node -e "require('./_locales/vi/messages.json')"
# Expected: No syntax errors
```

**Key Count Verification**:
```bash
node -e "
const en = require('./_locales/en/messages.json');
const vi = require('./_locales/vi/messages.json');
console.log('EN:', Object.keys(en).length);
console.log('VI:', Object.keys(vi).length);
console.log('Match:', Object.keys(en).length === Object.keys(vi).length ? '✅' : '❌');
"
# Expected after Wave 3: EN: 797, VI: 797, Match: ✅
```

---

### 7.2 Manual Tests (Per-batch functional areas)

#### After Batch 1 (Core UI):
1. Set Chrome locale to VI: `chrome://settings/languages`
2. Open sidepanel
3. Verify:
   - [ ] Title bar in VI
   - [ ] All buttons in VI
   - [ ] Toast messages in VI
   - [ ] No "undefined" or English fallbacks

#### After Batch 2 (Retention):
1. Highlight text on a page
2. Trigger quiz from reading card
3. Verify:
   - [ ] Quiz modal UI in VI
   - [ ] Question counter in VI format
   - [ ] Rating buttons in VI
4. Try teachback and flashcard features
5. Verify all labels in VI

#### After Batch 3 (Learning):
1. Open reading mode selector
2. Verify mode labels: "Đọc nhanh" / "Đọc kỹ"
3. Check primer modal (if applicable)
4. Verify stats display in VI
5. Check connections panel labels

#### After Batch 4 (Actions):
1. Trigger a nudge (e.g., fast scroll)
2. Verify nudge message in VI
3. Open welcome guide (first-time user flow)
4. Verify all guide steps in VI
5. Use search/filter → labels in VI

#### After Batch 5 (Errors):
1. Simulate network error (DevTools → Offline)
2. Verify error message in VI with CTA
3. Check offline indicator
4. Restore network → verify "Đã khôi phục kết nối"
5. Test export flow → all dialogs in VI

#### After Batch 6 (Small Domains):
1. Enter focus mode
2. Complete reading → check review UI in VI
3. Verify popup focus custom option in VI
4. Check options page for `opt_nlm_pii_warning_desc` in VI

---

### 7.3 Regression Tests (Final validation)

**Locale EN still works**:
1. Set Chrome locale to EN
2. Go through all 5 main flows
3. Verify no VI text appears

**Placeholder replacement**:
1. Trigger messages with placeholders:
   - `sp_quiz_of` (Question X of Y)
   - Error messages with dynamic content
2. Verify placeholders replaced correctly (not "$1", "$2" showing)

**No console errors**:
1. Open DevTools Console
2. Navigate through all features
3. Verify no i18n-related errors:
   - No "getMessage undefined"
   - No "placeholder mismatch" warnings

---

## 8) Acceptance criteria

### Must-Have:
- ✅ `missing in vi = 0` (verified by parity check tool)
- ✅ `missing in en = 0`
- ✅ `placeholder mismatch = 0`
- ✅ All 6 batches reviewed and merged
- ✅ Manual QA confirms no English fallback in 5 main flows:
  1. Popup
  2. Options page
  3. Sidepanel (reading, chat, insights)
  4. Focus mode
  5. Bug report / Memory pages

### Nice-to-Have:
- ✅ Parity check tool created and documented
- ✅ i18n workflow documented in README
- ✅ Translation glossary created (terms from Wave 1/2/3)

### Optional:
- ⚪ Pre-commit hook for i18n check
- ⚪ CI integration (GitHub Actions)
- ⚪ Screenshot comparison EN vs VI

---

## 9) Rủi ro và rollback

### Rủi ro:

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Translation fatigue (225 keys) | HIGH | HIGH | Use 6-batch strategy with breaks |
| Meaning drift from EN | MEDIUM | HIGH | Domain expert review per batch |
| Placeholder syntax errors | LOW | HIGH | Automated parity check |
| JSON syntax errors | LOW | MEDIUM | Static validation after each batch |
| Regression in EN locale | LOW | HIGH | Keep EN unchanged, test both locales |
| Key name typos | MEDIUM | MEDIUM | Copy-paste keys from EN, not manual typing |

### Giảm thiểu:
1. **Batch review cadence**: 1 batch/PR, QA test before next batch starts
2. **Double-check placeholders**: Use parity tool after every edit
3. **Copy EN key structure**: Don't manually type key names → copy from EN file
4. **Semantic review**: Each batch reviewed by native VI speaker

### Rollback:
1. Tách commit theo từng batch (B1 → B2 → ... → B6)
2. Nếu batch có lỗi, revert chỉ batch đó:
   ```bash
   git revert <commit-hash-batch-X>
   ```
3. Không cần rollback toàn bộ Wave 3 nếu chỉ 1 batch sai

---

## 10) Estimate (Revised)

### Detailed Breakdown:

| Phase | Task | Time | Notes |
|-------|------|------|-------|
| **Prep** | Create v2 spec, build parity tool | 0.5 day | ← You are here |
| **B1** | Translate Core UI (40 keys) + QA | 0.5 day | Critical path |
| **B2** | Translate Retention (45 keys) + QA | 0.5 day | High priority |
| **B3** | Translate Learning (50 keys) + QA | 0.5 day | High priority |
| **B4** | Translate Actions (45 keys) + QA | 0.5 day | Medium priority |
| **B5** | Translate Errors (45 keys) + QA | 0.5 day | High priority |
| **B6** | Translate Small Domains (24 keys) + QA | 0.5 day | Quick wins |
| **Final** | Full regression test + docs | 0.5 day | All locales |

**Total**: 4 days (vs v1 spec's 2 days)

**Team Option** (if 2 translators available):
- Parallel translation: 2 days
- Sequential QA: 1.5 days
- **Total**: 3.5 days

---

## 11) Implementation Checklist

### Pre-Implementation:
- [ ] Wave 3 v2 spec approved
- [ ] Parity check tool tested and working
- [ ] Translation glossary ready (from Wave 1/2)

### Per-Batch Checklist:
For each batch B1-B6:
1. [ ] Create feature branch: `wave3-i18n-batch-X`
2. [ ] Add keys to `vi/messages.json`
3. [ ] Run `node tools/i18n/check_parity.mjs` → pass
4. [ ] Run JSON validation → no syntax errors
5. [ ] Manual test functional area → no English fallbacks
6. [ ] Create PR with batch-specific test checklist
7. [ ] Review: native VI speaker approval
8. [ ] Merge to main
9. [ ] Verify on dev build

### Post-Implementation:
- [ ] All 6 batches merged
- [ ] Final parity check: `missing = 0`
- [ ] Full manual QA: 5 main flows in VI locale
- [ ] Regression QA: EN locale still works
- [ ] Update CHANGELOG.md
- [ ] Create git tag: `v2.8-wave3-complete`

---

## 12) Success Metrics

### Quantitative:
- ✅ `missing in vi` reduced from 252 → 0 (100% completion)
- ✅ `placeholder mismatches` = 0
- ✅ Zero console errors related to i18n
- ✅ All 6 PRs merged without rollback

### Qualitative:
- ✅ QA team reports: "No English fallbacks found in normal usage"
- ✅ Native VI speaker validation: "Translations are natural and consistent"
- ✅ Developer feedback: "Parity tool is helpful"

---

## 13) Next Steps After Wave 3

Once Wave 3 complete:
1. **Wave 4**: Onboarding end-to-end (uses translated keys from Wave 3)
2. **Maintenance**: Establish i18n workflow for new features
3. **CI Integration**: Add parity check to PR automation (optional)
4. **User Testing**: Get feedback from Vietnamese users on translation quality

---

## Appendix A: Translation Glossary (Quick Reference)

Core terms established in Wave 1-3:

| English | Vietnamese | Context |
|---------|-----------|---------|
| API key | Mã kết nối AI | Settings, errors |
| Save / Export | Lưu | Actions |
| Settings | Cài đặt | Navigation |
| Advanced | Nâng cao | Settings sections |
| Quick read / Skim | Đọc nhanh | Reading modes |
| Focused / Deep | Đọc kỹ | Reading modes |
| Research Queue | Ghi chú đã lưu | SRQ feature |
| Highlight | Tô sáng / Đánh dấu | Text selection |
| AI Features | Tính năng AI | Options tab |
| Integrations | Tích hợp | Options tab |
| Developer Tools | Công cụ Dev | Options tab (not "Advanced") |
| Getting Started | Bắt đầu | Options tab (not "General") |

---

**End of Wave 3 v2 Spec**

**Status**: ✅ Ready for Implementation
**Approval Required**: Yes (before starting Batch 1)
**Estimated Completion**: 2026-02-12 (if started 2026-02-09)
