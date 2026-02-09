# Focus Recall Review - Bug Fix Spec

## Tổng Quan

Tính năng **Recall Review** (AI-generated recall question khi kết thúc WORK phase) hiện **không hoạt động** do 3 bugs nghiêm trọng.

---

## Bug Analysis

### Bug 1: Session ID Mismatch (CRITICAL)

**File**: `popup.js` line 599-623

**Vấn đề**:
```javascript
// Lấy linked session
const linked = await window.TimerIntegration.getLinkedSession();
focusLinkedSessionId = linked?.sessionId || null;  // ← Đây là focusSessionId!

// Gọi review với ID sai
const reviewData = await window.TimerIntegration.onWorkPhaseEnd(focusLinkedSessionId);
```

**Root cause**:
- `getLinkedSession()` trả về object với 2 IDs khác nhau:
  - `focusSessionId`: ID của Focus session từ background (vd: `1738946400000_abc`)
  - `sessionId`: ID của ReadingSession (vd: `session_1738946401234_xyz`)
- Code đang dùng `linked.sessionId` (Focus ID) thay vì ReadingSession ID
- `onWorkPhaseEnd()` gọi `ReadingSessionService.getSession(sessionId)` → trả về `null`

---

### Bug 2: Review Chỉ Hiện Khi Popup Đang Mở (CRITICAL)

**File**: `popup.js` line 604-613

**Vấn đề**:
```javascript
focusUiTimer = setInterval(async () => {
    const st2 = await getFocusState();
    if (st2?.phase && lastFocusPhase && st2.phase !== lastFocusPhase) {
        if (lastFocusPhase === "WORK" && st2.phase === "BREAK") {
            await maybeShowReview();  // Chỉ chạy khi popup mở!
        }
    }
}, 1000);
```

**Root cause**:
- Review logic nằm trong `popup.js` với `setInterval`
- Khi user đóng popup → interval bị clear → không detect phase change
- User pattern thực tế: Start Focus → đóng popup → làm việc → KHÔNG BAO GIỜ thấy review

---

### Bug 3: Không Có Notification Khi Phase Kết Thúc (UX)

**File**: `background.js`

**Vấn đề**:
- Khi WORK → BREAK, chỉ broadcast state update
- Không có sound, không có browser notification
- User không biết cần mở popup để xem review

---

## Fix Plan

### Fix 1: Sửa Session ID Mismatch

**File**: `popup.js`

**Thay đổi**:
```diff
async function maybeShowReview() {
    if (reviewVisible || !window.TimerIntegration) return;
    if (!focusLinkedSessionId) {
        const linked = await window.TimerIntegration.getLinkedSession();
-       focusLinkedSessionId = linked?.sessionId || null;
+       // linked.sessionId là ReadingSession ID (session_xxx)
+       // linked.focusSessionId là Focus session ID từ background
+       focusLinkedSessionId = linked?.sessionId || null;
    }
    if (!focusLinkedSessionId) return;
    const reviewData = await window.TimerIntegration.onWorkPhaseEnd(focusLinkedSessionId);
    // ...
}
```

**Kiểm tra thêm** trong `timer_integration.js`:
```javascript
// Line 81-89: Đảm bảo LINK_KEY lưu đúng sessionId
await chrome.storage.local.set({
    [LINK_KEY]: {
        focusSessionId: focusState.sessionId,  // Focus ID từ background
        sessionId: session.id,                  // ReadingSession ID ← đây mới đúng!
        url,
        title,
        startedAt: focusSession.startedAt
    }
});
```

**Kết luận**: Code `timer_integration.js` lưu đúng, nhưng `popup.js` line 601 đọc sai field. Tuy nhiên, kiểm tra lại thấy `linked?.sessionId` là đúng field. Bug thực sự là ở chỗ khác - cần trace thêm.

**Trace thêm**: Vấn đề là `startFocus()` chỉ gọi `startFocusTracking()` khi user bấm Start từ popup, KHÔNG track nếu start từ preset buttons?

---

### Fix 2: Di Chuyển Review Logic Sang Background + Notification

**Approach**: Background xử lý review, hiện notification để user biết

#### 2.1 Thêm Phase Transition Handler trong Background

**File**: `background.js`

```javascript
// Trong focusHandlePhaseEnd(), sau khi chuyển phase:
if (prevPhase === "WORK" && nextPhase === "BREAK") {
    // Trigger review notification
    await triggerFocusReview(st);
}

async function triggerFocusReview(focusState) {
    // Lấy linked ReadingSession
    const { atom_focus_linked_session_v1 } = await chrome.storage.local.get(['atom_focus_linked_session_v1']);
    if (!atom_focus_linked_session_v1?.sessionId) return;
    
    // Store pending review để popup/sidepanel có thể pickup
    await chrome.storage.local.set({
        atom_focus_pending_review: {
            readingSessionId: atom_focus_linked_session_v1.sessionId,
            focusSessionId: focusState.sessionId,
            triggeredAt: Date.now()
        }
    });
    
    // Show browser notification
    chrome.notifications.create('focus_review', {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: '🎯 Phiên tập trung hoàn thành!',
        message: 'Mở AmoNexus để review những gì bạn vừa học.',
        priority: 2,
        requireInteraction: true
    });
    
    // Play sound (optional)
    // Note: Chrome extension sound requires user gesture, consider alternatives
}
```

#### 2.2 Popup/Sidepanel Kiểm Tra Pending Review

**File**: `popup.js`

```javascript
// Khi popup mở, check pending review
async function checkPendingReview() {
    const { atom_focus_pending_review } = await chrome.storage.local.get(['atom_focus_pending_review']);
    if (!atom_focus_pending_review) return;
    
    const { readingSessionId, triggeredAt } = atom_focus_pending_review;
    
    // Chỉ hiện review nếu < 5 phút
    if (Date.now() - triggeredAt > 5 * 60 * 1000) {
        await chrome.storage.local.remove(['atom_focus_pending_review']);
        return;
    }
    
    focusLinkedSessionId = readingSessionId;
    await maybeShowReview();
    
    // Clear pending sau khi show
    await chrome.storage.local.remove(['atom_focus_pending_review']);
}

// Gọi khi popup init
checkPendingReview();
```

#### 2.3 Notification Click Handler

**File**: `background.js`

```javascript
chrome.notifications.onClicked.addListener(async (notificationId) => {
    if (notificationId === 'focus_review') {
        // Clear notification
        chrome.notifications.clear(notificationId);
        
        // Open popup or sidepanel
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
            await chrome.sidePanel.open({ tabId: tab.id });
        }
    }
});
```

---

### Fix 3: Add Sound Notification (Optional Enhancement)

**Approach**: Sử dụng `chrome.offscreen` API để play audio trong MV3

**File**: `background.js`

```javascript
async function playPhaseTransitionSound(phase) {
    // MV3: Cần offscreen document để play audio
    try {
        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['AUDIO_PLAYBACK'],
            justification: 'Playing focus phase transition sound'
        });
    } catch (e) {
        // Document already exists
    }
    
    await chrome.runtime.sendMessage({
        type: 'PLAY_SOUND',
        sound: phase === 'BREAK' ? 'work_complete.mp3' : 'break_complete.mp3'
    });
}
```

**Note**: Cần tạo `offscreen.html` + `offscreen.js` + audio files. Có thể defer nếu effort cao.

---

## Implementation Checklist

### Phase 1: Critical Fixes (P0)

- [ ] Verify session ID flow end-to-end bằng logging
- [ ] Thêm pending review storage trong `background.js`
- [ ] Thêm `checkPendingReview()` trong `popup.js`
- [ ] Thêm browser notification khi WORK → BREAK
- [ ] Test full flow: Start → đóng popup → wait → notification → mở popup → thấy review

### Phase 2: UX Improvements (P1)

- [ ] Thêm sound notification (nếu feasible với MV3)
- [ ] Thêm Focus timer indicator trong sidepanel header
- [ ] Hiển thị review trong sidepanel (alternative to popup)

### Phase 3: Polish (P2)

- [ ] Copy tiếng Việt cho notifications
- [ ] Analytics tracking cho review completion rate
- [ ] Timeout handling nếu review bị bỏ qua

---

## Files Cần Sửa

| File | Thay đổi |
|------|----------|
| `background.js` | Thêm `triggerFocusReview()`, notification logic |
| `popup.js` | Thêm `checkPendingReview()`, fix session ID |
| `manifest.json` | Thêm `notifications` permission (nếu chưa có) |
| `_locales/*/messages.json` | Thêm i18n cho notification text |

---

## Testing Scenarios

1. **Happy path**: Start Focus → đóng popup → wait 25m → nhận notification → mở popup → thấy review
2. **Popup open**: Start Focus → giữ popup mở → wait → thấy review tự động
3. **Skip review**: Nhận notification → không mở → review expires sau 5 phút
4. **Stop early**: Start Focus → Stop trước khi hết WORK → không có review

---

*Created: 2026-02-09*
*Status: ✅ Implemented (2026-02-09)*
