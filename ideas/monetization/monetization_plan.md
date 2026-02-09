# Monetization Implementation Plan: AmoNexus (Soft Launch)

This plan outlines the "Soft Launch" strategy to maximize user adoption before enabling payments.

## Strategy Overview: "The Drug Dealer Model" 💊
1.  **Month 1 ("Early Access")**: Everyone gets **Pro features for FREE**.
    *   **Goal**: Hook users on the utility (SRQ, Unlimited AI, Sync).
    *   **Cost**: You cover AI costs (Managed Keys) but limit usage reasonable (30 calls/day).
    *   **UI**: "Pre-release Pro Trial - 30 Days Left".
2.  **Month 2+ (Paywall On)**:
    *   **Free Tier**: Downgraded to basic (10 calls/day).
    *   **Pro Tier ($4.99)**: Unlimited AI + Advanced Features.
    *   **Retention**: "Don't lose your SRQ data/workflows".

## Phase 1: Early Access (Month 1)

### 1. Feature Access
*   **All Features UNLOCKED** for everyone.
    *   Smart Research Queue (SRQ)
    *   NotebookLM Bridge
    *   Deep Angle / Semantic Brain
*   **AI Access**:
    *   **Model**: Gemini 2.5 Flash-Lite (Fast, Cheap).
    *   **Limit**: **30 calls / day** per user.
    *   **Key**: **Managed by Extension** (User does NOT need to input key).
    *   *Note: If user hits 30 limit, offer "Enter your own key for unlimited" (BYOK optional)*.

### 2. UI/UX Changes
*   **Banner**: Top of Sidepanel/Options.
    *   "🥂 Early Access Pro Trial: 29 Days Remaining"
*   **Onboarding**:
    *   "Welcome to AmoNexus Early Access. You have full Pro powers for 30 days."

### 3. Usage Tracking (Crucial)
*   Must track locally (and optionally sync to Supabase if ready):
    *   `install_date`: Timestamp of first install.
    *   `ai_calls_today`: Counter reset daily.
    *   `feature_usage`: Which pro features are they actually using?

## Phase 2: Monetization ON (Month 2+)

### 1. The Offer
*   **Free**:
    *   10 AI calls/day.
    *   Basic Highlight & Organize.
    *   Read-only Memory.
*   **Pro ($4.99/mo)**:
    *   Unlimited AI (Subject to fair use).
    *   Full SRQ & Brain features.
    *   Cloud Sync.

### 2. Infrastructure Setup
*   **Supabase**: For Auth & Subscription status.
*   **Lemon Squeezy**: For handling payments.
*   **Key Management**:
    *   Use a **Proxy Server** (highly recommended) or **Cloud Function** to hide your API keys.
    *   *Risk check*: Embedding keys directly in extension is risky (can be scraped).
        *   *Mitigation for Soft Launch*: Obfuscate key or use low-balance keys.

## Implementation Steps (Soft Launch)

### Step 1: Analytics & Limits (Day 1-2)
*   [ ] Implement `DailyUsageTracker` in `background.js`.
*   [ ] Add `install_date` logic.
*   [ ] Enforce 30 calls/day limit (show "Daily Limit Reached" toast).

### Step 2: UI Communication (Day 3-4)
*   [ ] Add "Early Access" Banner.
*   [ ] Add "Pro Feature" badges (visual only for now, showing value).

### Step 3: Backend Prep (During Month 1)
*   [ ] Set up Supabase & Lemon Squeezy (as per original plan).
*   [ ] Prepare "Switch" code to lock features when trial ends.

## Cost Management (Gemini 2.5 Flash-Lite)
*   **Input**: $0.075 / 1M tokens.
*   **Output**: $0.30 / 1M tokens.
*   **Est. Cost for 1000 users (Active)**: ~$30 - $50 / month.
*   **Free Tier Strategy**: Use Google's Free Tier API keys (rotated) to keep cost near $0.

## Open Questions
1.  [ ] Do we force login (Supabase) immediately? Or allow anonymous trial?
    *   *Recommendation*: Anonymous trial (save to local storage). Force login only to save/sync or buy Pro.
2.  [ ] Handling abuse (uninstall/reinstall to reset trial)?
    *   *Acceptable risk for soft launch*.

## User Review Required
> [!IMPORTANT]
> **API Key Security**:
> Since you are paying, your API keys will be in the extension.
> 1. **Do not commit keys to GitHub**.
> 2. **Obfuscate** them in the build.
> 3. Ideally, fetch them from a remote config or use a proxy.
