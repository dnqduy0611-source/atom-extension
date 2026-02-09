# Soft Launch Spec: Early Access Mode

**Version:** 1.0 (Soft Launch)
**Date:** 2026-02-09
**Status:** Draft
**Goal:** Hook users with 30 days of free Pro features before monetization.

---

## 1. Overview
This spec details the "Early Access" phase where new users get a **30-day Free Trial of Pro features** immediately upon installation. To manage costs, AI usage is capped at **30 calls/day** using the extension's managed key.

### Key Metrics
- **Trial Duration**: 30 Days from install.
- **Daily AI Limit**: 30 requests / day.
- **Model**: `gemini-2.5-flash-lite` (Cost optimization).

---

## 2. User Flow

### 2.1 First Install
1.  User installs extension.
2.  **Onboarding**: "Welcome to AmoNexus Early Access! You have full Pro powers for 30 days."
3.  **Status**: `trial_active`, `days_left: 30`.

### 2.2 Daily Usage
1.  User uses AI features (Chat, Explain, SRQ).
2.  Extension checks `daily_ai_usage` counter.
3.  **If < 30**: Request proceeds. Counter increments.
4.  **If >= 30**: Request blocked. Toast message:
    > "Daily limit reached (30/30). Come back tomorrow or add your own key for unlimited access."

### 2.3 Trial Expiry (Day 31+)
1.  Status changes to `trial_expired`.
2.  **Free Tier Enforcement**:
    - Limit reduced to **10 calls/day**.
    - Advanced features (SRQ, Bridge, Deep Angle) **LOCKED**.
3.  **UI**: "Trial Expired. Upgrade to Pro to unlock."

---

## 3. UI Specifications

### 3.1 Banner (Sidepanel & Options)
**Location**: Top of Sidepanel (dismissible) and Options Page (permanent).
**Content**:
- **Active**: "🥂 Early Access Pro: [X] Days Left" | [Upgrade Now button (future)]
- **Expired**: "⚠️ Trial Expired. [Upgrade to Restore]"

### 3.2 Usage Indicator
**Location**: Options Page > Account Section
**Content**:
- "Daily AI Usage: [5] / 30"
- Progress bar visual.

---

## 4. Technical Implementation

### 4.1 Storage Schema (`chrome.storage.local`)
```javascript
{
  "user_status": {
    "install_date": 1700000000000, // Timestamp
    "trial_end_date": 1702592000000, // Install + 30 days
    "is_pro": true, // Logic: (now < trial_end_date)
    "manual_pro_override": false // For future payments
  },
  "daily_usage": {
    "date": "2026-02-09", // Current tracking date
    "count": 5
  }
}
```

### 4.2 Background Logic (`background.js`)

#### A. Install Handler
```javascript
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    chrome.storage.local.set({
      user_status: {
        install_date: now,
        trial_end_date: now + thirtyDays
      },
      daily_usage: {
        date: new Date().toDateString(),
        count: 0
      }
    });
  }
});
```

#### B. Daily Reset
- Check `daily_usage.date` on every AI request (or Alarm).
- If `daily_usage.date != new Date().toDateString()` -> Reset `count` to 0, update `date`.

### 4.3 Quota Check Service
**File**: `services/quota_service.js` (NEW)
1.  `checkQuota()`: Returns boolean.
    - If `BYOK` is present -> Always True (Unlimited).
    - If `Managed Key`:
        - Check `daily_usage.count < 30`.
2.  `incrementQuota()`:
    - Increments `daily_usage.count`.

---

## 5. Security Note (Soft Launch)
- Since we use a managed key embedded in the extension, there is a risk of scraping.
- **Mitigation**:
    1.  Use `gemini-2.5-flash-lite` (Low balance impact).
    2.  Set quotas in Google Cloud Console per day/minute to prevent massive abuse.
    3.  Obfuscate key in build (basic protection).

---

## 6. Implementation Checklist
- [ ] Create `services/quota_service.js`
- [ ] Update `background.js` (Install & Reset logic)
- [ ] Update `sidepanel.js` (Banner UI)
- [ ] Update `options.html` (Usage indicator)
- [ ] Add "Daily Limit" toast notification
