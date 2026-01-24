# ATOM Privacy Policy

**Last Updated:** January 2026

## Overview

ATOM is designed with **privacy-first** principles. We believe your browsing habits and personal data should stay on your device.

## Data Collection

### What We Store (Locally Only)

| Data Type | Purpose | Location |
|-----------|---------|----------|
| `journal_logs` | Your mood/reflection entries | Local Storage |
| `atom_reactions` | How you respond to interventions | Local Storage |
| `atom_whitelist` | Sites you've marked as "Safe Zone" | Local Storage |
| `user_gemini_key` | Your personal API key (encrypted) | Local Storage |
| `user_sensitivity` | Your chosen sensitivity level | Local Storage |
| `atom_daily_rollups` | Daily usage statistics | Local Storage |

### What We Do NOT Collect

- ❌ Browsing history
- ❌ Personal identification information
- ❌ Location data
- ❌ Cookies from other sites
- ❌ Any data sent to our servers (we don't have servers!)

## Network Requests

### When Does ATOM Make Network Calls?

**Only when you provide a Gemini API key**, ATOM will make requests to:

| Endpoint | Purpose | When |
|----------|---------|------|
| `generativelanguage.googleapis.com` | Generate personalized messages & strategies | During interventions |

### What Data Is Sent?

When calling Google's Gemini API:
- Scroll duration (seconds)
- Resistance score (0-10)
- Intervention streak count
- Sentiment tags (e.g., "tired", "stressed")

**We do NOT send:**
- URLs you visit
- Page content
- Personal notes from journal
- Your name or any identifiable info

## Data Retention

- All data is stored **indefinitely** until you choose to delete it
- Use the **Reset** button in the popup to clear all data
- Use the **Export** button to download your data as JSON

## Your Rights

1. **Access**: Export all your data anytime (JSON format)
2. **Delete**: Clear all data with one click
3. **Control**: Disable the extension on any site via Safe Zone

## Third-Party Services

| Service | Purpose | Privacy Policy |
|---------|---------|----------------|
| Google Gemini API | AI-powered responses | [Google AI Privacy](https://ai.google.dev/terms) |

## Contact

For privacy concerns, please open an issue on our GitHub repository.

---

**Summary:** Your data stays on your device. We only talk to Google's API when you explicitly provide a key, and even then, we only send anonymous behavioral signals—never personal content.
