# ATOM - Intelligent Attention Compass

> A mindful Chrome extension that helps you regain control of your scrolling habits through gentle, empathetic interventions.

## ⚠️ Important Security Notice

> [!CAUTION]
> **DO NOT share your API key with anyone!**
> - This extension does **NOT** include a default API key
> - Your API key is stored **locally** on your device only
> - Never commit your API key to version control
> - If you suspect your key is compromised, regenerate it immediately at [Google AI Studio](https://aistudio.google.com/app/apikey)

## 🚀 Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked** and select the extension folder
5. Click the ATOM icon in your toolbar to get started

## ⚙️ Setup

1. Click on the ATOM extension icon
2. Go to **Settings** (gear icon)
3. Get your free API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
4. Paste your key and save
5. Choose your sensitivity level (Gentle / Balanced / Strict)

## 🔒 Privacy

See [PRIVACY.md](./PRIVACY.md) for complete privacy information.

**TL;DR:**
- ✅ All data stored **locally** on your device
- ✅ Network calls **only** to Google's Gemini API (when you provide a key)
- ✅ **No tracking**, no analytics, no third-party services
- ✅ You can export/delete all your data anytime

## 🐛 Bug Reports

Found a bug? Please use our [Bug Report Template](./BUG_REPORT_TEMPLATE.md) to help us fix it quickly!

## 🔧 Debug Mode

For testers and developers:
1. Go to Settings → Enable **Debug Mode**
2. Open Chrome DevTools (F12) → Console tab
3. Look for `[ATOM]` prefixed logs
4. Use **Export Debug Log** button to copy logs for bug reports

## 📦 Version

Current: **v5.3 ENVI**

## 📄 License

MIT License - Feel free to modify and share!

---

Made with 💚 for your digital wellbeing.
---

## AI Pilot (New Mode)

### Table of Contents
- [What It Does](#what-it-does)
- [How to Enable](#how-to-enable)
- [Modes](#modes)
- [Accuracy Level](#accuracy-level)
- [Settings Reference](#settings-reference)
- [When AI Is Called](#when-ai-is-called)
- [Decision & Guardrails](#decision--guardrails)
- [Logs & Debug](#logs--debug)
- [Privacy Notes](#privacy-notes)
- [Suggested Presets](#suggested-presets)
- [Current Limitations](#current-limitations)

### What It Does
AI Pilot classifies your current browsing mode (intentional / mixed / doomscroll) using recent behavior + page context, then recommends an intervention level. It still respects hard guardrails (Focus rules, cooldowns, safe zones).

### How to Enable
1. Open **Settings** from the ATOM popup.
2. Paste your **Gemini API Key**.
3. Toggle **AI Pilot** on.
4. Set **Mode** and **Accuracy Level** (see below).

### Modes
- **shadow**: AI runs and logs, but rule-based pipeline decides.
- **assist**: AI can downgrade/upgrade interventions when confident.
- **primary**: AI decides when confident (guardrails still apply).

### Accuracy Level
- **balanced**: No page text is sent (behavior-only).  
  Note: in the current build, AI is only called when text snippets exist, so **balanced effectively prevents AI calls**.
- **high**: Sends limited **viewport text**, **selected text**, and **headings** to increase accuracy.

### Settings Reference
- **Min Confidence** (default `0.65`): AI must meet this to override/assist.
- **Timeout (ms)** (default `800`): AI call timeout.
- **Budget / day** (default `200`): Max AI calls per day.
- **Cache TTL (ms)** (default `15000`): Per-tab AI decision cache.
- **Viewport max chars** (default `1200`): Max chars sent from visible text.
- **Selected max chars** (default `400`): Max chars sent from selection.
- **Provider / Proxy URL**: Present in UI but **not wired** in current pipeline.

### When AI Is Called
- AI Pilot enabled
- Observation frame available
- Enough text signal (viewport >= 200 chars or selected text > 0)
- Not in AI cooldown
- Budget not exhausted
- And either:
  - Rule says risk (yellow/red), or
  - Page type is `forum`, `doc`, `pdf`, `article`

### Decision & Guardrails
- AI outputs mode + recommendation (none/presence/micro/gentle/hard).
- Final intervention still obeys:
  - Focus mode hard blocks
  - Cooldowns
  - Safe zone / system page skips
  - Sensitivity constraints

### Logs & Debug
- AI Pilot logs stored locally in `atom_ai_pilot_logs_v1` (cap 1000).
- Reaction tracking records user response within 30s of intervention.
- Debug export currently includes settings and recent events, **not AI Pilot logs**.

### Privacy Notes
- Balanced mode sends no text.
- High mode sends limited snippets only (sanitized for emails/numbers).
- All logs stay local on your machine.

### Suggested Presets
- **First-time test**: `shadow` + `high` + `Min Confidence 0.7`
- **Gentle AI assist**: `assist` + `high`
- **AI-led**: `primary` + `high` + `Min Confidence 0.65`

### Current Limitations
- **Accuracy=balanced disables AI calls** (no text signal).
- **Provider/Proxy** options are present in UI but not used yet.
- AI runs only on top-level pages; system URLs and safe zones are skipped.