# Non-Tech Friendly Wave 1 Spec v2

**Version:** 2.0
**Date:** 2026-02-08
**Changes from v1:** Improved term mappings, added unit handling, terminology consistency, test cases, migration plan, and exceptions

---

## 1) Mục tiêu và phạm vi

Wave 1 tập trung vào quick wins để giảm ngôn ngữ kỹ thuật trong UI và giúp user non-tech hiểu ngay thao tác cần làm.

### Mục tiêu định lượng:
1. Giảm >70% text kỹ thuật hiện ra ở luồng sử dụng cơ bản (tăng từ 60% v1)
2. 100% hành động nguy hiểm có cảnh báo dễ hiểu (không dùng từ nội bộ kỹ thuật)
3. Tất cả error state chính có CTA rõ ràng (Thử lại / Mở Cài đặt / Báo lỗi)
4. **[MỚI]** 100% terminology consistency giữa SRQ và Options

### Phạm vi:
- Popup (`popup.html`, `popup.js`)
- Options (`options.html`, `options.js`)
- Sidepanel (`sidepanel.html`, `sidepanel.js`)
- i18n (`_locales/en/messages.json`, `_locales/vi/messages.json`)

---

## 2) Baseline hiện tại

Bằng chứng baseline từ code:
1. Settings còn nhiều term kỹ thuật: `Proxy URL`, `Model ID`, `JSON`, `TTL`, `Min Confidence`, `Timeout (ms)`
2. Confirm reset còn wording kỹ thuật (`machine learning data and history`)
3. Nhiều fallback text trong JS mang tính nội bộ kỹ thuật
4. i18n VI thiếu key so với EN (baseline: VI 488 keys, EN 755 keys)
5. **[MỚI]** Terminology không consistent giữa SRQ (đã non-tech) và Options (còn technical)

---

## 3) Non-goals

1. Không đổi architecture lớn
2. Không đổi logic AI pipeline
3. Không đổi data schema storage
4. Không redesign visual style tổng thể
5. **[MỚI]** Không force non-tech terminology cho fields dành cho advanced users (e.g., JSON rules)

---

## 4) Nguyên tắc copy

1. **Plain language first:** Ưu tiên từ thông dụng, tránh thuật ngữ
2. **Action-first:** Mọi thông báo lỗi phải kèm bước tiếp theo
3. **Safe wording:** Với thao tác xóa/reset, nêu rõ phạm vi và không hoàn tác
4. **Không lộ implementation details** cho luồng cơ bản
5. **[MỚI] Terminology consistency:** Dùng terms đã được non-tech-ify trong SRQ cho toàn bộ extension
6. **[MỚI] Progressive disclosure:** Technical fields phải wrap trong collapsible "Advanced" section

---

## 5) Danh sách thay đổi chi tiết

### 5.1 Term mapping (bắt buộc)

**[CẢI TIẾN từ v1]** Đổi terms sau theo bảng mapping dưới đây cho UI layer:

| # | Term cũ | v1 mapping | **v2 mapping (CẢI TIẾN)** | EN v2 | Lý do thay đổi |
|---|---------|------------|---------------------------|-------|----------------|
| 1 | API key | Ma ket noi AI | **Khóa truy cập AI** | AI Access Key | "Khóa" dễ hình dung hơn "mã" |
| 2 | Proxy URL | Dia chi ket noi tuy chon | **Địa chỉ proxy (nâng cao)** | Proxy address (advanced) | Thêm "(nâng cao)" để signal field này không dành cho basic user |
| 3 | Model ID | Mau AI | **Mẫu AI** | AI Model | Giữ nguyên, đã OK |
| 4 | Semantic Embeddings | Lien ket noi dung thong minh | **Phân tích ý nghĩa** | Meaning Analysis | Tránh "liên kết" gây hiểu lầm |
| 5 | Semantic Search | Tim noi dung lien quan | **Tìm theo ý nghĩa** | Find by Meaning | Ngắn gọn, rõ ràng |
| 6 | Min Confidence | Muc tin cay toi thieu | **Độ tin cậy tối thiểu** | Minimum confidence level | VI đã OK, fix EN |
| 7 | Timeout (ms) | Thoi gian cho toi da | **Giới hạn thời gian** | Time limit | Ẩn "(ms)", thêm hint text riêng |
| 8 | Budget / day | Gioi han su dung moi ngay | **Hạn mức hàng ngày** | Daily quota | "Hạn mức" rõ hơn "giới hạn sử dụng" |
| 9 | Cache TTL (ms) | Thoi gian nho tam | **Thời gian lưu tạm** | Temporary storage time | "Lưu" rõ hơn "nhớ" |
| 10 | JSON mapping rules | Quy tac tu dong (nang cao) | **[EXCEPTION] Giữ "JSON mapping rules"** | JSON mapping rules | Xem Section 5.1.3 |

### 5.1.1 Xử lý đơn vị đo **[MỚI]**

**Vấn đề:** Đơn vị "(ms)", "(day)", "(chars)" làm UI cluttered và technical.

**Giải pháp:**

1. **Loại bỏ đơn vị khỏi label chính**
   ```html
   <!-- CŨ -->
   <label>Timeout (ms)</label>
   <input type="text" placeholder="800">

   <!-- MỚI -->
   <label>Giới hạn thời gian</label>
   <input type="text" placeholder="800">
   <small class="hint">Đơn vị: mili giây (1000ms = 1 giây)</small>
   ```

2. **Thêm hint text dưới mỗi field có đơn vị đo:**

| Field | Hint text EN | Hint text VI |
|-------|-------------|-------------|
| Time limit (ms) | "Maximum wait time for AI response (in milliseconds)" | "Thời gian tối đa chờ AI phản hồi (đơn vị: mili giây)" |
| Daily quota | "Number of AI calls allowed per day" | "Số lần gọi AI được phép mỗi ngày" |
| Cache time (ms) | "How long to remember recent results (in milliseconds)" | "Thời gian nhớ kết quả gần đây (đơn vị: mili giây)" |
| Max export chars | "Maximum text length per export (0 = unlimited)" | "Độ dài văn bản tối đa mỗi lần xuất (0 = không giới hạn)" |

3. **i18n keys mới cần tạo:**
   ```json
   {
     "opt_ai_pilot_timeout_hint": { "message": "..." },
     "opt_ai_pilot_budget_hint": { "message": "..." },
     "opt_ai_pilot_cache_ttl_hint": { "message": "..." },
     "opt_nlm_export_max_chars_hint": { "message": "..." }
   }
   ```

### 5.1.2 Terminology consistency với SRQ **[MỚI]**

**Vấn đề phát hiện:** SRQ Wave 1-4 đã dùng non-tech terms, nhưng Options settings vẫn dùng technical terms cho cùng concept.

**Nguyên tắc:** Áp dụng SRQ naming conventions vào toàn bộ extension.

**Mapping table:**

| Concept | Options (CŨ) | SRQ (reference) | **Options (MỚI)** |
|---------|--------------|-----------------|-------------------|
| Save action | "Export to NotebookLM" | "Save" (line 2222) | "Lưu vào NotebookLM" |
| Queue widget | "Smart Research Queue" | "Saved highlights" (line 2217) | "Ghi chú đã lưu" |
| Reading mode: Deep | "Deep reading mode" | "Focused" / "Đọc kỹ" (line 2276) | "Chế độ đọc kỹ" |
| Reading mode: Skim | "Skim reading mode" | "Quick read" / "Đọc nhanh" (line 2277) | "Chế độ đọc nhanh" |
| Density setting | "SRQ density" | (implicit in UX) | "Mật độ hiển thị" |

**Thực thi:**
- Search toàn bộ EN/VI i18n files cho "export" → replace với "save" context-appropriate
- Audit options.html labels để match với SRQ terminology
- Update fallback strings trong JS files

### 5.1.3 Exceptions to term mapping **[MỚI]**

**Các term KHÔNG đổi vì technical by nature:**

1. **"JSON mapping rules"**
   - **Lý do:** Field này yêu cầu nhập JSON syntax, không dành cho non-tech users
   - **Hành động:**
     - Giữ nguyên label "JSON mapping rules"
     - Wrap field trong collapsible `<details>` section có title "Advanced Settings"
     - Thêm tooltip: "For advanced users only. Configure custom routing rules in JSON format. Leave blank if unsure."
     - Thêm link "Documentation" mở external docs

2. **"Proxy URL"**
   - **Lý do:** Concept "proxy" không thể plain-language hóa
   - **Hành động:**
     - Đổi label thành "Proxy address (advanced)"
     - Thêm "(optional)" vào placeholder
     - Wrap trong Advanced section

3. **Technical toggles trong Debug tab**
   - **Lý do:** Debug mode inherently technical
   - **Hành động:** Không áp dụng non-tech terminology cho Debug tab

---

### 5.2 Popup copy

**Yêu cầu:**
1. Text status ngắn, dễ hiểu, tránh term nội bộ
2. Confirm reset phải nêu rõ dữ liệu nào bị xóa (không dùng "machine learning")
3. Nút hành động phải là động từ rõ nghĩa

**Chi tiết:**

#### 5.2.1 Fix `popup_confirm_reset`

**CŨ (line 587 EN):**
```json
"popup_confirm_reset": {
  "message": "Are you sure you want to DELETE ALL machine learning data and history? This cannot be undone."
}
```

**MỚI:**
```json
"popup_confirm_reset": {
  "message": "Delete all saved highlights, reading history, and AI chat logs? This action cannot be undone."
}
```

**VI:**
```json
"popup_confirm_reset": {
  "message": "Xóa toàn bộ ghi chú đã lưu, lịch sử đọc và trò chuyện với AI? Hành động này không thể hoàn tác."
}
```

**Rationale:**
- ❌ "machine learning data" → ✅ "saved highlights, reading history, AI chat logs" (cụ thể hơn)
- ❌ "DELETE ALL" (viết hoa gây aggressive) → ✅ "Delete all" (bình thường nhưng rõ ràng)

#### 5.2.2 Onboarding subtitle

**Kiểm tra:** Popup onboarding keys đã có (line 527-548), nhưng cần verify hiển thị đúng lần đầu mở.

**Action items:**
- [ ] Verify `popup_onboarding_title` hiển thị khi `firstRun === true`
- [ ] Đảm bảo subtitle thay đổi dựa trên API key status:
  - Có key: "Open the side panel and follow 3 quick steps."
  - Chưa key: "Open Settings to add your API key, then continue in the side panel."

#### 5.2.3 Loading/checking status

**Chuẩn hóa:**
- `popup_loading` → "Loading..." (OK)
- `popup_checking` → "Checking..." (OK)
- Thêm key mới: `popup_connecting` → "Connecting to AI..."

---

### 5.3 Options copy

**Yêu cầu:**
1. Tất cả label ở tab `General` và `AI` có tooltip 1 câu plain-language
2. Field nâng cao wrap trong collapsible section với title rõ ràng
3. Warning về chi phí AI viết theo kiểu user-facing (không technical)

#### 5.3.1 Phân loại fields và Progressive Disclosure **[MỚI]**

**Tier 1 - Core Settings (Hiển thị mặc định):**

Các field này KHÔNG wrap trong "Advanced":
- Provider selection (Google Gemini / OpenRouter)
- AI Access Key input
- Enable/Disable toggles (AI Pilot, NotebookLM Bridge, Semantic features)
- Language selection
- Sensitivity level
- SRQ density

**Tier 2 - Advanced Settings (Wrap trong collapsible section):**

```html
<details class="advanced-section">
  <summary>
    <span data-i18n="opt_advanced_settings_title">Advanced Settings</span>
    <span class="advanced-badge" data-i18n="opt_advanced_badge">(For advanced users)</span>
  </summary>
  <div class="advanced-content">
    <!-- Các fields sau đây -->
  </div>
</details>
```

**Fields trong Advanced section:**
- Time limit (Timeout ms)
- Minimum confidence level
- Daily quota (Budget/day)
- Temporary storage time (Cache TTL)
- Viewport max chars
- Selected max chars
- Proxy address
- JSON mapping rules

**i18n keys mới:**
```json
{
  "opt_advanced_settings_title": {
    "message": "Advanced Settings",
    "description": "Title for collapsible advanced options section"
  },
  "opt_advanced_badge": {
    "message": "(For advanced users)",
    "description": "Badge shown next to advanced settings title"
  }
}
```

#### 5.3.2 Tooltips cho mỗi field **[MỚI]**

**Cách thực hiện:** Thêm icon `ⓘ` bên cạnh label, show tooltip on hover.

**Tooltip mapping:**

| Field | EN Tooltip | VI Tooltip |
|-------|-----------|-----------|
| AI Access Key | "Your personal key to use AI features. Get it free from Google AI Studio." | "Khóa cá nhân để sử dụng tính năng AI. Lấy miễn phí từ Google AI Studio." |
| Meaning Analysis | "AI analyzes the meaning of each highlight to find related content later." | "AI phân tích ý nghĩa từng đoạn để tìm nội dung liên quan sau này." |
| Find by Meaning | "Find highlights by what they mean, not just by keywords." | "Tìm ghi chú theo ý nghĩa, không chỉ theo từ khóa." |
| Daily quota | "Limit how many times AI can be called per day to control costs." | "Giới hạn số lần gọi AI mỗi ngày để kiểm soát chi phí." |
| Time limit | "How long to wait for AI before giving up (in milliseconds)." | "Thời gian chờ AI trước khi bỏ qua (đơn vị: mili giây)." |

**Implementation:**
```html
<label>
  <span data-i18n="opt_ai_pilot_budget_per_day">Daily quota</span>
  <span class="info-icon" data-tooltip-i18n="opt_ai_pilot_budget_tooltip">ⓘ</span>
</label>
```

#### 5.3.3 AI cost warning - User-facing version

**CŨ (line 299 EN):**
```json
"opt_semantic_cost_warning": {
  "message": "Warning: May increase Gemini API usage and latency."
}
```

**MỚI:**
```json
"opt_semantic_cost_warning": {
  "message": "Enabling this will use more of your AI quota and may slow down responses slightly."
}
```

**VI MỚI:**
```json
"opt_semantic_cost_warning": {
  "message": "Bật tính năng này sẽ tốn nhiều hạn mức AI hơn và có thể làm chậm phản hồi một chút."
}
```

**Changes:**
- ❌ "Gemini API usage" → ✅ "AI quota"
- ❌ "latency" → ✅ "slow down responses"
- Thêm "slightly" để giảm anxiety

#### 5.3.4 Remove hardcoded text trong options.html

**Audit checklist:**
- [ ] Scan `options.html` cho tất cả `<label>`, `<p>`, `<span>` không có `data-i18n`
- [ ] Đặc biệt check:
  - Tab titles (line ~850-900)
  - Section headers
  - Button labels
  - Placeholder text trong `<input>` và `<textarea>`
- [ ] Với mỗi hardcoded text found:
  - Tạo i18n key mới
  - Thay text bằng `data-i18n` attribute
  - Đảm bảo cả EN và VI có key tương ứng

---

### 5.4 Sidepanel copy

**Yêu cầu:**
1. Empty state nói rõ bước bắt đầu
2. Error state có CTA (`Thử lại`, `Mở Cài đặt`)
3. Quick action text dùng động từ dễ hiểu

#### 5.4.1 Empty state - Verification

**Current (line 1307 EN):**
```json
"sp_empty_title": "Ready",
"sp_empty_desc": "Highlight text or select a Quick Action to begin."
```

**Assessment:** ✅ Đã đủ rõ ràng cho non-tech user. Không cần sửa.

#### 5.4.2 Error states audit

**Check các error keys sau đây có CTA chưa:**

| Key | Current message | Has CTA? | Action needed |
|-----|-----------------|----------|---------------|
| `sp_error_no_api_key` (1877) | "API key not set" | ❌ | Thêm CTA button |
| `sp_error_no_api_key_desc` (1880) | "Go to Settings to configure..." | ✅ | OK |
| `sp_error_rate_limit` (1901) | "Too many requests" | ❌ | Thêm wait time |
| `sp_error_rate_limit_desc` (1904) | "Please wait..." | ⚠️ | Vague |
| `sp_error_timeout` (1913) | "Request timed out" | ❌ | Thêm CTA |

**Fixes needed:**

```json
// MỚI
"sp_error_rate_limit_desc": {
  "message": "Please wait $1 seconds before trying again.",
  "placeholders": {
    "seconds": { "content": "$1" }
  }
}

"sp_error_timeout_desc": {
  "message": "The request took too long. Please try again or check your internet connection."
}

"sp_error_cta_retry": {
  "message": "Try Again"
}

"sp_error_cta_settings": {
  "message": "Open Settings"
}
```

**Implementation in sidepanel.js:**
```javascript
// Error state UI phải render CTA buttons
function showError(errorType) {
  const errorConfig = {
    no_api_key: {
      title: i18n('sp_error_no_api_key'),
      desc: i18n('sp_error_no_api_key_desc'),
      cta: { label: i18n('sp_error_cta_settings'), action: () => openSettings() }
    },
    rate_limit: {
      title: i18n('sp_error_rate_limit'),
      desc: i18n('sp_error_rate_limit_desc', [waitSeconds]),
      cta: { label: i18n('sp_error_cta_retry'), action: () => retryRequest() }
    }
    // ...
  };
  // Render error với CTA button
}
```

#### 5.4.3 Quick actions terminology

**Verify consistency với SRQ:**

| Action | Current | Consistent với SRQ? | Keep/Change |
|--------|---------|---------------------|-------------|
| Summarize | "Summarize" / "Tóm tắt" | ✅ (line 1301) | Keep |
| Key points | "Key Points" / "Ý chính" | ✅ (line 1304) | Keep |
| Save | "Save" / "Lưu" | ✅ (line 1317) | Keep |
| Export | - | N/A | Should not appear |

**Action:** Audit sidepanel.js fallback strings để đảm bảo không có "export" terminology leak.

---

## 6) File-level implementation

### 6.1 `_locales/en/messages.json`

**Changes:**

1. **Update existing keys (Section 5.1 term mapping):**
   - [ ] Line 254: `opt_gemini_api_key` → "AI Access Key"
   - [ ] Line 270: `opt_openrouter_model` → "AI Model"
   - [ ] Line 305: `opt_semantic_embeddings_title` → "Meaning Analysis"
   - [ ] Line 311: `opt_semantic_search_title` → "Find by Meaning"
   - [ ] Line 377: `opt_ai_pilot_min_confidence` → "Minimum confidence level"
   - [ ] Line 383: `opt_ai_pilot_timeout_ms` → "Time limit"
   - [ ] Line 389: `opt_ai_pilot_budget_per_day` → "Daily quota"
   - [ ] Line 417: `opt_ai_pilot_cache_ttl_ms` → "Temporary storage time"
   - [ ] Line 423: `opt_ai_pilot_proxy_url` → "Proxy address (advanced)"
   - [ ] Line 587: `popup_confirm_reset` → Fix theo Section 5.2.1

2. **Add new keys (Section 5.1.1 hint texts):**
   ```json
   {
     "opt_ai_pilot_timeout_hint": {
       "message": "Maximum wait time for AI response (in milliseconds)"
     },
     "opt_ai_pilot_budget_hint": {
       "message": "Number of AI calls allowed per day"
     },
     "opt_ai_pilot_cache_ttl_hint": {
       "message": "How long to remember recent results (in milliseconds)"
     },
     "opt_nlm_export_max_chars_hint": {
       "message": "Maximum text length per export (0 = unlimited)"
     }
   }
   ```

3. **Add new keys (Section 5.3.1 advanced section):**
   ```json
   {
     "opt_advanced_settings_title": {
       "message": "Advanced Settings"
     },
     "opt_advanced_badge": {
       "message": "(For advanced users)"
     }
   }
   ```

4. **Add new keys (Section 5.3.2 tooltips):**
   ```json
   {
     "opt_gemini_api_key_tooltip": {
       "message": "Your personal key to use AI features. Get it free from Google AI Studio."
     },
     "opt_semantic_embeddings_tooltip": {
       "message": "AI analyzes the meaning of each highlight to find related content later."
     },
     "opt_semantic_search_tooltip": {
       "message": "Find highlights by what they mean, not just by keywords."
     },
     "opt_ai_pilot_budget_tooltip": {
       "message": "Limit how many times AI can be called per day to control costs."
     },
     "opt_ai_pilot_timeout_tooltip": {
       "message": "How long to wait for AI before giving up (in milliseconds)."
     }
   }
   ```

5. **Update existing keys (Section 5.4.2 error CTAs):**
   ```json
   {
     "sp_error_rate_limit_desc": {
       "message": "Please wait $1 seconds before trying again.",
       "placeholders": {
         "seconds": { "content": "$1" }
       }
     },
     "sp_error_timeout_desc": {
       "message": "The request took too long. Please try again or check your internet connection."
     },
     "sp_error_cta_retry": {
       "message": "Try Again"
     },
     "sp_error_cta_settings": {
       "message": "Open Settings"
     }
   }
   ```

### 6.2 `_locales/vi/messages.json`

**Changes:**

1. **Mirror tất cả EN updates từ Section 6.1**
2. **Key names PHẢI giống EN exactly**
3. **Dịch theo bảng mapping trong Section 5.1**

**Example:**
```json
{
  "opt_gemini_api_key": {
    "message": "Khóa truy cập AI"
  },
  "opt_gemini_api_key_tooltip": {
    "message": "Khóa cá nhân để sử dụng tính năng AI. Lấy miễn phí từ Google AI Studio."
  },
  "opt_advanced_settings_title": {
    "message": "Cài đặt nâng cao"
  },
  "opt_advanced_badge": {
    "message": "(Dành cho người dùng nâng cao)"
  }
}
```

### 6.3 `options.html`

**Changes:**

1. **Wrap advanced fields trong `<details>` (Section 5.3.1):**

```html
<!-- TRƯỚC field "Time limit" -->
<details class="advanced-section" id="advancedAiSettings">
  <summary class="advanced-summary">
    <span class="advanced-title" data-i18n="opt_advanced_settings_title">Advanced Settings</span>
    <span class="advanced-badge" data-i18n="opt_advanced_badge">(For advanced users)</span>
    <span class="toggle-icon">▼</span>
  </summary>

  <div class="advanced-content">
    <!-- Di chuyển các fields sau đây vào đây: -->
    <!-- - Time limit (Timeout) -->
    <!-- - Minimum confidence -->
    <!-- - Daily quota -->
    <!-- - Temporary storage time (Cache TTL) -->
    <!-- - Viewport/Selected max chars -->
    <!-- - Proxy address -->
  </div>
</details>

<!-- Separate advanced section cho NotebookLM -->
<details class="advanced-section" id="advancedNlmSettings">
  <summary class="advanced-summary">
    <span class="advanced-title" data-i18n="opt_nlm_advanced">Advanced Settings</span>
    <span class="advanced-badge" data-i18n="opt_advanced_badge">(For advanced users)</span>
    <span class="toggle-icon">▼</span>
  </summary>

  <div class="advanced-content">
    <!-- - Max export chars -->
    <!-- - Sensitive domains -->
    <!-- - JSON mapping rules -->
  </div>
</details>
```

2. **Thêm tooltips cho labels (Section 5.3.2):**

```html
<!-- Example -->
<label for="geminiApiKey">
  <span data-i18n="opt_gemini_api_key">AI Access Key</span>
  <span class="info-icon"
        data-tooltip-i18n="opt_gemini_api_key_tooltip"
        aria-label="More information">ⓘ</span>
</label>
```

3. **Thêm hint texts dưới inputs (Section 5.1.1):**

```html
<div class="form-group">
  <label for="aiTimeoutMs" data-i18n="opt_ai_pilot_timeout_ms">Time limit</label>
  <input type="text" id="aiTimeoutMs" placeholder="800">
  <small class="hint" data-i18n="opt_ai_pilot_timeout_hint">
    Maximum wait time for AI response (in milliseconds)
  </small>
</div>
```

4. **Remove ALL hardcoded text:**
   - [ ] Scan toàn bộ file cho text không có `data-i18n`
   - [ ] Với mỗi hardcoded text: tạo key mới, add `data-i18n`

5. **CSS cho advanced sections (thêm vào style block):**

```css
.advanced-section {
  margin-top: 20px;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}

.advanced-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  background: var(--background);
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}

.advanced-summary:hover {
  background: rgba(16, 185, 129, 0.05);
}

.advanced-title {
  font-weight: 600;
  color: var(--foreground);
}

.advanced-badge {
  font-size: 12px;
  color: var(--muted);
  font-style: italic;
}

.toggle-icon {
  margin-left: auto;
  transition: transform 0.2s;
}

details[open] .toggle-icon {
  transform: rotate(180deg);
}

.advanced-content {
  padding: 20px 16px;
  background: var(--surface);
  border-top: 1px solid var(--border);
}

/* Tooltip styles */
.info-icon {
  display: inline-block;
  width: 16px;
  height: 16px;
  line-height: 16px;
  text-align: center;
  font-size: 12px;
  color: var(--muted);
  cursor: help;
  margin-left: 4px;
  position: relative;
}

.info-icon:hover {
  color: var(--primary);
}

/* Hint text under inputs */
.hint {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--muted);
  line-style: italic;
}
```

### 6.4 `options.js`

**Changes:**

1. **Update fallback strings trong `atomMsg()` calls:**

```javascript
// Find all atomMsg() calls và update theo new terminology
// Example:
// OLD: atomMsg('opt_ai_pilot_timeout_ms', 'Timeout (ms)')
// NEW: atomMsg('opt_ai_pilot_timeout_ms', 'Time limit')
```

2. **Error messages phải dùng plain language:**

```javascript
// OLD
showError('Failed to validate API key format');

// NEW
showError(atomMsg('opt_error_invalid_key', 'Please check your AI Access Key format'));
```

3. **Thêm tooltip initialization:**

```javascript
// Initialize tooltips on page load
document.addEventListener('DOMContentLoaded', () => {
  // Existing initialization...

  // NEW: Initialize tooltips
  initTooltips();
});

function initTooltips() {
  const tooltipIcons = document.querySelectorAll('[data-tooltip-i18n]');

  tooltipIcons.forEach(icon => {
    const key = icon.getAttribute('data-tooltip-i18n');
    const tooltipText = chrome.i18n.getMessage(key);

    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = tooltipText;

    // Show on hover
    icon.addEventListener('mouseenter', () => {
      document.body.appendChild(tooltip);
      positionTooltip(icon, tooltip);
    });

    icon.addEventListener('mouseleave', () => {
      tooltip.remove();
    });
  });
}
```

### 6.5 `popup.js`

**Changes:**

1. **Update confirm reset flow:**

```javascript
// Find reset button handler
document.getElementById('btnClear')?.addEventListener('click', async () => {
  // Use new i18n key
  const confirmed = confirm(
    chrome.i18n.getMessage('popup_confirm_reset')
  );

  if (confirmed) {
    // Existing reset logic...
  }
});
```

2. **Chuẩn hóa status messages:**

```javascript
// Consolidate loading states
function showStatus(type) {
  const messages = {
    loading: chrome.i18n.getMessage('popup_loading'),
    checking: chrome.i18n.getMessage('popup_checking'),
    connecting: chrome.i18n.getMessage('popup_connecting'), // NEW
    packing: chrome.i18n.getMessage('popup_msg_packing'),
    downloaded: chrome.i18n.getMessage('popup_msg_downloaded')
  };

  statusElement.textContent = messages[type] || '';
}
```

### 6.6 `sidepanel.js`

**Changes:**

1. **Audit fallback text trong error handlers:**

```javascript
// Find all error handling code
// Replace technical fallbacks with plain language

// OLD
showError('API_KEY_MISSING', 'No API key configured');

// NEW
showError('API_KEY_MISSING', atomMsg('sp_error_no_api_key', 'API key not set'));
```

2. **Add CTA buttons to error states:**

```javascript
function showError(errorType, errorDetails) {
  const errorConfig = {
    no_api_key: {
      title: atomMsg('sp_error_no_api_key'),
      desc: atomMsg('sp_error_no_api_key_desc'),
      cta: {
        label: atomMsg('sp_error_cta_settings'),
        action: () => chrome.runtime.openOptionsPage()
      }
    },
    rate_limit: {
      title: atomMsg('sp_error_rate_limit'),
      desc: atomMsg('sp_error_rate_limit_desc', [errorDetails.waitSeconds]),
      cta: {
        label: atomMsg('sp_error_cta_retry'),
        action: () => retryLastRequest()
      }
    },
    timeout: {
      title: atomMsg('sp_error_timeout'),
      desc: atomMsg('sp_error_timeout_desc'),
      cta: {
        label: atomMsg('sp_error_cta_retry'),
        action: () => retryLastRequest()
      }
    }
  };

  const config = errorConfig[errorType];
  if (!config) return;

  // Render error UI với CTA button
  errorContainer.innerHTML = `
    <div class="error-state">
      <div class="error-icon">⚠️</div>
      <h3>${config.title}</h3>
      <p>${config.desc}</p>
      <button class="error-cta" onclick="handleErrorCTA('${errorType}')">
        ${config.cta.label}
      </button>
    </div>
  `;
}
```

3. **Verify terminology consistency:**

```javascript
// Search for "export" strings → replace with "save" where appropriate
// Example:
// OLD: 'Export to NotebookLM'
// NEW: atomMsg('srq_export', 'Save')
```

---

## 7) Test plan

### 7.1 Unit / Static tests

**Automated checks:**

1. **Hardcoded text scan:**
   ```bash
   # Scan options.html for text without data-i18n
   grep -n '<label\|<span\|<p\|<button' options.html | grep -v 'data-i18n'

   # Should return 0 results (except CSS/JS blocks)
   ```

2. **i18n key parity check:**
   ```javascript
   // Script: check_i18n_parity.js
   const enKeys = Object.keys(require('./_locales/en/messages.json'));
   const viKeys = Object.keys(require('./_locales/vi/messages.json'));

   const missing = enKeys.filter(k => !viKeys.includes(k));
   if (missing.length > 0) {
     console.error('VI missing keys:', missing);
     process.exit(1);
   }
   ```

3. **Term mapping verification:**
   ```bash
   # Check if old terms still appear in UI-facing files
   grep -rn "API key\|Model ID\|Semantic Embeddings" _locales/en/messages.json

   # Should only appear in:
   # - Exception fields (JSON mapping rules tooltip)
   # - Non-UI keys (debug, internal)
   ```

### 7.2 Manual Testing - Chi tiết **[MỞ RỘNG]**

#### Test Case 1: First-time setup (non-tech user)

**Objective:** Verify a non-technical user can set up the extension without external help.

**Precondition:**
- Fresh install (clear extension data)
- Tester has NEVER used AI tools before
- Tester profile: age 25-50, basic computer literacy, non-tech job

**Steps:**
1. Click extension icon → Popup opens
2. Read onboarding message
3. Click "Open Settings" (or equivalent CTA)
4. Options page opens → Read hero section
5. Click "Get Free Key" button
6. Follow inline guide (should be 4 steps max)
7. Copy key from Google AI Studio
8. Paste into "AI Access Key" field
9. Click "Save Settings"
10. Return to any webpage → Open sidepanel
11. Highlight text → Click "Summarize"

**Expected outcomes:**
- ✅ User completes Steps 1-11 in **≤ 5 minutes** without asking questions
- ✅ User does NOT need to Google "what is API key"
- ✅ User does NOT ask "what is Gemini" or "what is Model ID"
- ✅ Success message appears after save
- ✅ Summarize function works immediately

**Pass criteria:** 4/5 non-tech testers complete successfully

**Failure handling:**
- If >2 testers fail: BLOCK release, revise copy
- If testers ask questions: Document what confused them → iterate

---

#### Test Case 2: Reset flow comprehension

**Objective:** Verify users understand exactly what data will be deleted.

**Precondition:**
- Extension has been used (has saved highlights, chat history)
- User has NOT been told what "reset" does

**Steps:**
1. Open popup
2. Click "Reset" button
3. Read confirmation dialog
4. **DO NOT click any button yet**
5. Interviewer asks: "What will happen if you click OK?"

**Expected answer (paraphrased OK):**
- "My saved highlights will be deleted"
- "My reading history will be deleted"
- "My AI chat logs will be deleted"
- "I cannot undo this"

**Fail indicators:**
- User says "I don't know"
- User asks "What is machine learning data?"
- User guesses incorrectly

**Pass criteria:** 5/5 testers answer correctly

---

#### Test Case 3: Error recovery (missing API key)

**Objective:** Verify error messages guide user to resolution.

**Precondition:**
- Fresh install, NO API key set

**Steps:**
1. Open sidepanel
2. Highlight text on page
3. Click "Summarize"
4. Error appears
5. Observe user behavior (no interviewer guidance)

**Expected behavior:**
- ✅ User reads error message
- ✅ User clicks "Open Settings" CTA button (should be visually obvious)
- ✅ Options page opens
- ✅ User scrolls to API key field
- ✅ User attempts to get key

**Fail indicators:**
- User closes error and gives up
- User does not see CTA button
- User clicks wrong area

**Pass criteria:** 4/5 testers successfully navigate to Settings

---

#### Test Case 4: Advanced settings discoverability

**Objective:** Verify basic users are not overwhelmed, but advanced users can find settings.

**Tester profiles:**
- Group A: 3 non-tech users
- Group B: 2 tech-savvy users

**Steps:**
1. Open Options page
2. Ask Group A: "Set up your AI key to start using the extension"
3. Ask Group B: "Find the timeout setting"

**Expected outcomes:**

**Group A (non-tech):**
- ✅ Ignores collapsed "Advanced Settings" section
- ✅ Successfully completes API key setup without opening Advanced
- ✅ Does NOT feel confused by visible settings

**Group B (tech-savvy):**
- ✅ Clicks "Advanced Settings" collapsible
- ✅ Finds "Time limit" (Timeout) field within 10 seconds
- ✅ Understands hint text explains units

**Pass criteria:**
- 3/3 Group A users ignore Advanced section
- 2/2 Group B users find timeout setting

---

#### Test Case 5: Terminology consistency spot-check

**Objective:** Verify no terminology conflicts between Options and SRQ.

**Steps:**
1. Open Options → Enable "Find by Meaning" (Semantic Search)
2. Save settings
3. Use extension to save 3+ highlights
4. Open sidepanel → Check SRQ widget
5. Interviewer asks: "Is the 'Find by Meaning' feature you enabled related to how this widget groups highlights?"

**Expected answer:**
- User should correctly identify connection (even if unsure how it works technically)

**Fail indicator:**
- User says "I don't see any 'Find by Meaning' here"
- User confused because widget uses different terms

**Pass criteria:** 3/5 users recognize connection

---

### 7.3 Smoke Checklist (Pre-release)

**Must pass ALL before release:**

- [ ] **Popup opens without i18n errors**
  - Check browser console for `getMessage` errors
  - Verify all labels render (not showing key names)

- [ ] **Options page loads in both EN and VI**
  - Switch language → Reload → All text changes
  - No missing translations (no English leaking into VI mode)

- [ ] **Sidepanel empty state shows correct message**
  - Fresh page load → Empty state visible
  - Message matches `sp_empty_desc` key

- [ ] **Sidepanel error state shows CTA button**
  - Trigger rate limit error → CTA "Try Again" visible
  - Trigger no-key error → CTA "Open Settings" visible
  - Click CTA → Expected action occurs

- [ ] **Advanced sections collapsed by default**
  - Options page → "Advanced Settings" sections closed
  - Click summary → Expands smoothly

- [ ] **Tooltips display on hover**
  - Hover ⓘ icon next to "AI Access Key" → Tooltip appears
  - Tooltip text matches i18n key

- [ ] **Hint texts visible under relevant fields**
  - "Time limit" field has hint about milliseconds
  - "Daily quota" field has hint about call count

- [ ] **No technical terms in basic flow**
  - Complete Test Case 1 → Screenshot each step
  - Scan screenshots for: "API key", "Model ID", "Timeout (ms)", "Cache TTL"
  - Should only see plain-language versions

- [ ] **Reset confirmation uses new copy**
  - Click Reset → Confirm dialog
  - Text matches Section 5.2.1 (no "machine learning")

- [ ] **SRQ terminology consistent with Options**
  - Check widget title: "Saved highlights" (not "Smart Research Queue")
  - Check action buttons: "Save" (not "Export")

---

## 8) Acceptance Criteria

**MUST achieve ALL to consider Wave 1 complete:**

### AC1: Zero technical terms in basic flow ✅

**Definition of "basic flow":**
- First-time setup (popup → settings → get key → save)
- Highlight → Summarize → Save
- View saved highlights in sidepanel

**Technical term blacklist:**
- API key → Must be "AI Access Key" / "Khóa truy cập AI"
- Model ID → Must be "AI Model" / "Mẫu AI"
- Semantic Embeddings/Search → Must be "Meaning Analysis" / "Find by Meaning"
- Export → Must be "Save" / "Lưu"
- Cache TTL, Timeout (ms), JSON, Proxy URL → Must be hidden in Advanced section (not in basic flow)

**Verification:**
- Manual walkthrough của basic flow
- Screenshot mỗi bước
- Grep screenshots text → Không có blacklist terms

**Pass:** 0/10 blacklist terms xuất hiện trong basic flow

---

### AC2: 100% error states have actionable CTA ✅

**Error states in scope:**
- Missing API key
- Invalid API key format
- Rate limit exceeded
- Network timeout
- Server error (5xx)
- Empty response

**CTA requirements:**
- Phải là button (không chỉ là text link)
- Label phải là action verb ("Try Again", "Open Settings", "Report Issue")
- Click CTA phải trigger action (không chỉ close error)

**Verification:**
```javascript
// Test script to trigger each error type
const errorTests = [
  { type: 'no_key', trigger: () => callAIWithoutKey() },
  { type: 'rate_limit', trigger: () => rapidFireRequests(100) },
  { type: 'timeout', trigger: () => callAIWithShortTimeout() },
  // ...
];

errorTests.forEach(test => {
  test.trigger();
  assert(document.querySelector('.error-cta'), `Missing CTA for ${test.type}`);
});
```

**Pass:** 6/6 error types hiển thị CTA button

---

### AC3: 100% UI text qua i18n (no hardcoded) ✅

**Files in scope:**
- `popup.html`
- `options.html`
- `sidepanel.html`

**Exceptions allowed:**
- CSS content (e.g., `content: "▼"` in CSS)
- Placeholder examples (e.g., `placeholder="AIzaSy..."`)
- Debug mode labels (debug tab not in basic flow)

**Verification:**
```bash
# Run automated scan
node scripts/check_hardcoded_text.js

# Manual review of flagged items
# Approve exceptions explicitly
```

**Pass:** 0 hardcoded UI text ngoài exceptions list

---

### AC4: Non-tech reviewer understands setup in ≤3 minutes ✅

**Reviewer profile:**
- Age 25-55
- Non-technical job (e.g., teacher, marketer, designer)
- Has basic computer skills (can browse web, use Gmail)
- Has NEVER used AI tools before

**Test protocol:**
1. Give reviewer fresh Chrome profile with extension installed
2. Say: "Please set up this extension so you can use it to summarize text"
3. No additional guidance
4. Start timer
5. Stop when reviewer successfully completes first summarize action

**Success metrics:**
- Time ≤ 3 minutes
- Reviewer does NOT ask clarifying questions
- Reviewer does NOT need to Google anything
- Reviewer expresses confidence ("I know what I'm doing")

**Pass criteria:** 4/5 reviewers meet success metrics

---

### AC5: Terminology consistency across extension ✅ **[NEW]**

**Verification checklist:**

| Concept | Options label | SRQ widget | Sidepanel | All match? |
|---------|---------------|------------|-----------|------------|
| Save action | "Save" / "Lưu" | "Save" / "Lưu" | "Save" / "Lưu" | ✅ |
| Queue name | "Saved highlights" | "Saved highlights" | N/A | ✅ |
| Deep mode | "Đọc kỹ" | "Đọc kỹ" | "Focused" | ✅ |
| Skim mode | "Đọc nhanh" | "Đọc nhanh" | "Quick read" | ✅ |

**Pass:** 100% terminology consistent (manual review)

---

## 9) Rủi ro và rollback

### 9.1 Rủi ro

**R1: Đổi copy làm lệch nghĩa kỹ thuật**
- **Likelihood:** Medium
- **Impact:** High (users misconfigure settings)
- **Example:** "Time limit" có thể hiểu nhầm là "time remaining" thay vì "timeout"

**Giảm thiểu:**
- [ ] Tech review của mỗi term mapping
- [ ] Cross-reference với actual code behavior
- [ ] Tooltip text phải clarify nghĩa chính xác

**R2: Mất key i18n gây fallback sai ngôn ngữ**
- **Likelihood:** Low (có automated check)
- **Impact:** Medium (UX degradation)

**Giảm thiểu:**
- [ ] Run `check_i18n_parity.js` script trước mỗi commit
- [ ] CI/CD gate: block merge nếu EN/VI key count mismatch

**R3: Existing users confused bởi terminology change**
- **Likelihood:** Medium
- **Impact:** Low (chỉ ảnh hưởng labels, not functionality)
- **Example:** Users report "where did Model ID setting go?" (vì đổi thành "AI Model")

**Giảm thiểu:**
- [ ] Include changelog trong update notification
- [ ] Thêm in-app tooltip "We simplified some labels" lần đầu mở Options
- [ ] Monitor support channels 1 tuần sau release

**R4: "Advanced Settings" collapsible làm power users khó tìm settings **[NEW]**
- **Likelihood:** Low
- **Impact:** Medium

**Giảm thiểu:**
- [ ] "Advanced Settings" section phải có rõ ràng ▼ icon
- [ ] Thêm search functionality trong Options (future enhancement)
- [ ] Document advanced settings locations in FAQ

---

### 9.2 Rollback plan

**Commit strategy:**
1. **Commit 1:** i18n EN updates only
2. **Commit 2:** i18n VI updates only
3. **Commit 3:** options.html structure changes (advanced sections)
4. **Commit 4:** options.js logic changes (tooltips, error handling)
5. **Commit 5:** popup.js changes (reset confirm)
6. **Commit 6:** sidepanel.js changes (error CTAs)

**Rollback triggers:**
- Critical bug discovered (e.g., settings save fails)
- >10 users report confusion in first 24 hours
- Acceptance criteria fail in QA

**Rollback procedure:**
1. Identify faulty commit using git bisect
2. Revert specific commit: `git revert <commit-hash>`
3. If i18n revert needed: fallback to old keys (code still compatible)
4. Hotfix release within 4 hours
5. Post-mortem: document what went wrong

**Rollback safety:**
- All i18n changes are backwards-compatible (old keys still exist as fallbacks in JS)
- HTML structure changes isolated to options.html (doesn't affect popup/sidepanel)

---

## 10) Estimate

### Dev time breakdown:

| Task | Time | Notes |
|------|------|-------|
| i18n files update (EN/VI) | 3 hours | ~40 keys to add/update |
| options.html restructure | 2 hours | Add advanced sections, tooltips, hint texts |
| options.js tooltip logic | 1.5 hours | Initialize tooltips, position logic |
| popup.js confirm update | 0.5 hour | Simple string replacement |
| sidepanel.js error CTAs | 2 hours | Render CTA buttons, wire up actions |
| CSS for advanced sections | 1 hour | Collapsible styling, tooltips |
| Manual testing (self) | 2 hours | Run through all 5 test cases |
| **Total dev** | **12 hours (1.5 days)** | |

### QA time breakdown:

| Task | Time | Notes |
|------|------|-------|
| Automated checks | 0.5 hour | Run i18n parity, hardcoded text scan |
| Manual test cases 1-5 | 3 hours | Need 5 testers, 30min each |
| Smoke checklist | 1 hour | Verify all 10 items |
| Copy review | 1 hour | Native speaker review VI translations |
| Regression testing | 1 hour | Ensure existing features still work |
| **Total QA** | **6.5 hours (1 day)** | |

### **Total estimate: 2.5 days** (up from 1.5 days v1)

**Why longer than v1?**
- Added advanced sections (HTML restructure)
- Added tooltips (JS logic)
- Added hint texts (more i18n keys)
- More comprehensive test cases

**Still achievable in 1 sprint (5 days) với buffer cho iterations.**

---

## 11) Migration & Communication **[NEW SECTION]**

### 11.1 Changelog entry

**Version:** v2.8.1
**Release date:** TBD
**Title:** Non-Tech Friendly Update

**Changelog text (EN):**
```markdown
## v2.8.1 - Simplified Language Update

We've made ATOM easier to use by simplifying technical terms:

**What changed:**
- "API Key" → "AI Access Key" (easier to understand)
- "Semantic Search" → "Find by Meaning" (plain language)
- "Export" → "Save" (consistent with other features)
- "Model ID" → "AI Model" (clearer naming)
- Advanced settings now grouped in collapsible sections
- Added helpful tooltips and hints for all settings

**Your data is safe:**
- All your saved highlights and settings are preserved
- Only the labels changed - functionality is the same
- No action needed from you

**Why we did this:**
We want ATOM to be accessible to everyone, not just technical users.
These changes make the extension easier to understand and use.
```

**Changelog text (VI):**
```markdown
## v2.8.1 - Cập nhật Ngôn ngữ Dễ hiểu

Chúng tôi đã làm cho ATOM dễ sử dụng hơn bằng cách đơn giản hóa thuật ngữ kỹ thuật:

**Thay đổi gì:**
- "API Key" → "Khóa truy cập AI" (dễ hiểu hơn)
- "Semantic Search" → "Tìm theo ý nghĩa" (ngôn ngữ thông dụng)
- "Export" → "Lưu" (đồng nhất với các tính năng khác)
- "Model ID" → "Mẫu AI" (tên rõ ràng hơn)
- Các cài đặt nâng cao được nhóm lại có thể thu gọn
- Thêm tooltip và gợi ý hữu ích cho tất cả cài đặt

**Dữ liệu của bạn được bảo toàn:**
- Tất cả ghi chú đã lưu và cài đặt đều được giữ nguyên
- Chỉ thay đổi nhãn hiển thị - chức năng vẫn như cũ
- Bạn không cần làm gì

**Tại sao chúng tôi làm điều này:**
Chúng tôi muốn ATOM dễ tiếp cận với mọi người, không chỉ người dùng kỹ thuật.
Những thay đổi này giúp extension dễ hiểu và sử dụng hơn.
```

### 11.2 In-app notification (optional)

**Trigger:** First time opening Options page after update to v2.8.1

**UI:** Toast notification at top of Options page (dismissible)

**Content:**
```
📢 We've simplified some labels to make settings easier to understand.
Your data and preferences are unchanged. [Learn more]
```

**Implementation:**
```javascript
// In options.js
async function checkFirstRunAfterUpdate() {
  const { lastSeenVersion } = await chrome.storage.local.get('lastSeenVersion');
  const currentVersion = chrome.runtime.getManifest().version;

  if (lastSeenVersion !== currentVersion) {
    showUpdateNotification();
    chrome.storage.local.set({ lastSeenVersion: currentVersion });
  }
}

function showUpdateNotification() {
  const notification = document.createElement('div');
  notification.className = 'update-notification';
  notification.innerHTML = `
    <span>📢 ${atomMsg('opt_update_v281_notice', 'We\'ve simplified some labels...')}</span>
    <a href="https://github.com/your-repo/releases/v2.8.1" target="_blank">
      ${atomMsg('opt_update_learn_more', 'Learn more')}
    </a>
    <button onclick="this.parentElement.remove()">×</button>
  `;

  document.querySelector('.options-content').prepend(notification);
}
```

### 11.3 Support FAQ additions

**Q: Where did the "API Key" setting go?**
A: We renamed it to "AI Access Key" to make it clearer. It's in the same location in Settings.

**Q: I can't find the "Timeout" setting anymore.**
A: It's now called "Time limit" and is located in the "Advanced Settings" section. Click to expand that section.

**Q: Why did you change the terminology?**
A: We want ATOM to be accessible to non-technical users. The new labels use plain language that everyone can understand.

**Q: Will my settings be lost after this update?**
A: No, all your settings and data are preserved. Only the labels changed.

---

## 12) Success Metrics (Post-release)

**Track for 2 weeks after release:**

### Quantitative metrics:

1. **Setup completion rate**
   - Metric: % of new installs that successfully save first highlight within 7 days
   - Baseline (pre-Wave1): TBD (measure current rate first)
   - Target: +15% improvement

2. **Support ticket volume**
   - Metric: # of tickets with keywords "API key", "don't understand", "how to setup"
   - Baseline: TBD
   - Target: -30% reduction

3. **Settings page bounce rate**
   - Metric: % of users who open Settings and close within 10 seconds (analytics)
   - Target: <20%

4. **Advanced section open rate**
   - Metric: % of users who expand "Advanced Settings" collapsible
   - Expected: 10-20% (most users shouldn't need it)

### Qualitative metrics:

1. **User feedback sentiment**
   - Monitor: GitHub issues, Chrome Web Store reviews, Discord/support channels
   - Look for: "easier to use", "clearer", "less confusing"
   - Red flags: "where did X go", "more confusing now", "too simple"

2. **Non-tech user testing (post-release)**
   - Recruit 3 new users (non-tech profile)
   - Run Test Case 1 again
   - Compare time vs. pre-Wave1 baseline

---

## Appendix A: Quick Reference - Term Mapping

**For developers: Copy-paste reference during implementation**

| Old term (v1) | New EN (v2) | New VI (v2) | i18n key |
|---------------|-------------|-------------|----------|
| API key | AI Access Key | Khóa truy cập AI | opt_gemini_api_key |
| Model ID | AI Model | Mẫu AI | opt_openrouter_model |
| Semantic Embeddings | Meaning Analysis | Phân tích ý nghĩa | opt_semantic_embeddings_title |
| Semantic Search | Find by Meaning | Tìm theo ý nghĩa | opt_semantic_search_title |
| Min Confidence | Minimum confidence level | Độ tin cậy tối thiểu | opt_ai_pilot_min_confidence |
| Timeout (ms) | Time limit | Giới hạn thời gian | opt_ai_pilot_timeout_ms |
| Budget / day | Daily quota | Hạn mức hàng ngày | opt_ai_pilot_budget_per_day |
| Cache TTL (ms) | Temporary storage time | Thời gian lưu tạm | opt_ai_pilot_cache_ttl_ms |
| Proxy URL | Proxy address (advanced) | Địa chỉ proxy (nâng cao) | opt_ai_pilot_proxy_url |
| Export | Save | Lưu | srq_export / sp_chip_save |
| Smart Research Queue | Saved highlights | Ghi chú đã lưu | srq_widget_title |
| Deep mode | Focused / Đọc kỹ | Đọc kỹ | srq_mode_deep |
| Skim mode | Quick read / Đọc nhanh | Đọc nhanh | srq_mode_skim |

---

## Appendix B: Implementation Checklist

**Use this as a task tracker:**

### Phase 1: i18n files (3 hours)
- [ ] Create backup of current `en/messages.json` and `vi/messages.json`
- [ ] Update 10 term mapping keys in EN
- [ ] Update 10 term mapping keys in VI
- [ ] Add 4 new hint text keys (Section 5.1.1)
- [ ] Add 5 new tooltip keys (Section 5.3.2)
- [ ] Add 2 new advanced section keys (Section 5.3.1)
- [ ] Add 4 new error CTA keys (Section 5.4.2)
- [ ] Update `popup_confirm_reset` in EN and VI
- [ ] Run `node scripts/check_i18n_parity.js` → Should pass
- [ ] Commit: "feat(i18n): Wave 1 non-tech terminology"

### Phase 2: options.html restructure (2 hours)
- [ ] Add CSS for advanced sections (copy from Section 6.3)
- [ ] Add CSS for tooltips
- [ ] Add CSS for hint texts
- [ ] Wrap AI advanced fields in `<details id="advancedAiSettings">`
- [ ] Wrap NLM advanced fields in `<details id="advancedNlmSettings">`
- [ ] Add ⓘ tooltip icons to relevant labels (API key, Semantic features, etc.)
- [ ] Add `<small class="hint">` under fields with units
- [ ] Scan for hardcoded text → Add `data-i18n` where missing
- [ ] Test: Open options.html in browser → Visual inspection
- [ ] Commit: "feat(options): add progressive disclosure for advanced settings"

### Phase 3: options.js logic (1.5 hours)
- [ ] Implement `initTooltips()` function (Section 6.4)
- [ ] Update all `atomMsg()` fallback strings to new terminology
- [ ] Test tooltip positioning on hover
- [ ] Test advanced sections expand/collapse
- [ ] Commit: "feat(options): add tooltip interactions"

### Phase 4: popup.js (0.5 hour)
- [ ] Update reset confirm dialog to use new i18n key
- [ ] Test: Click Reset → Verify new message appears
- [ ] Commit: "feat(popup): update reset confirmation copy"

### Phase 5: sidepanel.js error CTAs (2 hours)
- [ ] Implement `showError()` function with CTA rendering (Section 6.6)
- [ ] Add CTA handlers (openSettings, retryRequest)
- [ ] Update all error handling callsites to use new keys
- [ ] Test each error type:
  - [ ] Trigger no-key error → CTA appears → Click CTA → Settings opens
  - [ ] Trigger rate-limit error → CTA appears → Click CTA → Retry works
  - [ ] Trigger timeout error → CTA appears
- [ ] Commit: "feat(sidepanel): add actionable error CTAs"

### Phase 6: Testing (5 hours)
- [ ] Run automated checks (Section 7.1)
- [ ] Execute Test Case 1 (non-tech setup)
- [ ] Execute Test Case 2 (reset flow)
- [ ] Execute Test Case 3 (error recovery)
- [ ] Execute Test Case 4 (advanced discoverability)
- [ ] Execute Test Case 5 (terminology consistency)
- [ ] Complete smoke checklist (Section 7.3)
- [ ] Document any failures → Fix → Re-test

### Phase 7: QA & Polish (3.5 hours)
- [ ] Native speaker review VI translations
- [ ] Regression test existing features (SRQ, NLM export, focus mode)
- [ ] Cross-browser test (Chrome, Edge)
- [ ] Screenshot each step of Test Case 1 → Verify no technical terms
- [ ] Fix any issues found
- [ ] Final commit: "chore: Wave 1 QA fixes"

### Phase 8: Release prep (1 hour)
- [ ] Update CHANGELOG.md with Section 11.1 content
- [ ] Add in-app notification code (Section 11.2)
- [ ] Update FAQ docs (Section 11.3)
- [ ] Tag release: `git tag v2.8.1-wave1`
- [ ] Push to staging for final review

---

**End of Wave 1 Spec v2**

**Change log from v1:**
- Section 5.1: Improved 5 term mappings for better clarity
- Section 5.1.1: NEW - Unit handling strategy
- Section 5.1.2: NEW - Terminology consistency with SRQ
- Section 5.1.3: NEW - Exceptions for technical fields
- Section 5.3.1: NEW - Progressive disclosure strategy
- Section 5.3.2: NEW - Tooltip requirements
- Section 7.2: Expanded from generic to 5 detailed test cases
- Section 8: Added AC5 for terminology consistency
- Section 9.1: Added R4 for advanced settings discoverability
- Section 11: NEW - Migration & communication plan
- Section 12: NEW - Post-release success metrics
- Appendix A: NEW - Quick reference table
- Appendix B: NEW - Implementation checklist

**Review status:** Ready for implementation
**Approved by:** [Pending stakeholder review]
