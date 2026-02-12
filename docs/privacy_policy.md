# Privacy Policy for AmoNexus

**Last updated:** February 11, 2026

**AmoNexus** ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our browser extension and related services.

By using AmoNexus, you agree to the collection and use of information in accordance with this policy.

## 1. Core Principles

- **Privacy First:** We do not track your browsing history for advertising purposes.
- **Local-First Data:** Your data (journals, settings, reading history) is primarily stored locally on your device using Chrome's built-in storage APIs.
- **User Control:** You have full control over your data, API keys, and account.
- **Minimal Collection:** We only collect what is necessary to provide the extension's features.

## 2. Information We Collect

### A. Account Information

If you choose to sign in with Google (optional), we collect:

- **Email address** — Used to create and authenticate your account via our authentication provider (Supabase).
- **Display name** — Used to personalize your experience within the extension.

This information is transmitted securely to Supabase (our authentication provider) and is not shared with any other third party.

### B. Browsing Activity Data

To provide the "Active Reading" and digital wellness features, the extension monitors certain browsing activity **locally on your device**:

- **Page URLs and titles** — Used to identify content and categorize browsing behavior (e.g., social media vs. educational content).
- **Scroll distance and duration** — Used to detect doomscrolling patterns and trigger wellness interventions (breathing guides, break reminders).
- **User interaction events** — Mouse, keyboard, and scroll activity used to determine active vs. idle states.

> **Important:** This browsing activity data is processed and stored locally on your device. It is **not** sent to our servers or any third party. The only exception is when you explicitly trigger an AI feature (see Section 2D).

### C. User-Created Content

- **Journal Entries:** Entries you write in the Amo Journal are stored locally within the browser's storage system.
- **Highlights and Notes:** Text you highlight and notes you create are stored locally.
- **Focus Session Data:** Statistics about your focus sessions (duration, breaks taken) are stored locally.

### D. Data Sent to AI Providers

When you use AI-powered features (summarize, chat, AI Pilot classification), the following data may be sent to AI providers for processing:

- **Page text snippets** — Excerpts of the content you are reading.
- **Your highlighted text** — Selected text you want analyzed.
- **Journal entries** — Only when you explicitly request AI feedback on a journal entry.

This data is sent only when you trigger the feature and is not stored by us.

### E. Authentication Credentials

- **API Keys:** If you provide a Google Gemini API Key, it is stored locally on your device using Chrome's storage APIs. We do not have access to this key.
- **OAuth Tokens:** When you sign in with Google, temporary authentication tokens are handled by Chrome's built-in `chrome.identity` API and are not stored or accessible by us beyond the authentication flow.

## 3. How We Use Your Information

We use the collected information solely for the purpose of providing the extension's functionality:

- **AI Processing:** To generate summaries, answer questions, and provide insights on content you are reading.
- **Focus & Wellness:** To trigger wellness interventions (breathing guides, break reminders) based on local browsing pattern analysis.
- **Authentication:** To verify your identity and enable account features via Google Sign-In.
- **Data Sync:** To synchronize your settings and data across your devices (when signed in).

## 4. Third-Party Services

### Google Gemini API

AmoNexus uses Google's Gemini models for AI features.

- When you use AI features, text snippets are sent to Google's Generative Language API.
- If you use the built-in free tier, data is processed according to [Google's AI Terms of Service](https://policies.google.com/terms) and [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms).
- If you use your own API Key, data privacy is governed by your agreement with Google Cloud Platform.

### OpenRouter (Fallback AI Provider)

When the primary AI model (Google Gemini) is temporarily unavailable due to rate limits, AmoNexus may route AI requests through OpenRouter as a fallback:

- The same text data described in Section 2D is sent to OpenRouter's API.
- OpenRouter's privacy practices are governed by [OpenRouter's Privacy Policy](https://openrouter.ai/privacy).
- This fallback only occurs for background AI tasks and only when the primary provider is rate-limited.

### Supabase (Authentication & Backend)

AmoNexus uses Supabase as the authentication and data synchronization backend:

- Your email address and display name are stored on Supabase servers for authentication purposes.
- Supabase's privacy practices are governed by [Supabase's Privacy Policy](https://supabase.com/privacy).
- We do not store browsing history, journal entries, or page content on Supabase servers.

### NotebookLM

If you choose to export content to NotebookLM, you are interacting directly with Google's NotebookLM service. AmoNexus merely facilitates the data transfer.

## 5. Data Security

- **Local Storage:** Most sensitive data (journals, highlights, browsing activity) remains on your machine.
- **Secure Authentication:** Google Sign-In is handled through Chrome's built-in identity API, ensuring secure token management.
- **Encrypted Transport:** All data transmitted to third-party APIs is sent over HTTPS.
- **No Tracking:** We do not use cookies, analytics, or tracking pixels.

## 6. Data Retention

- **Local Data:** Stored on your device until you delete it or uninstall the extension.
- **Account Data (Supabase):** Your email and display name are retained as long as your account exists. You may request account deletion at any time by contacting us.
- **AI Provider Data:** Text sent to AI providers (Google Gemini, OpenRouter) is processed in real-time and is not retained by us. Retention by the AI providers is governed by their respective privacy policies.

## 7. Your Rights

- **Access:** You can view all your locally stored data via the Extension's "Memory" or "Settings" panel.
- **Deletion:** You can reset or delete all local data using the "Reset" button in the Settings menu. Uninstalling the extension will also remove all local data.
- **Account Deletion:** You may request deletion of your Supabase account data by contacting us at the email below.
- **Opt-Out:** AI features are optional. You can use the extension without providing an API key or signing in.

## 8. Children's Privacy

AmoNexus is not intended for use by children under the age of 13. We do not knowingly collect personal information from children under 13.

## 9. Changes to This Policy

We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the extension's release notes. The "Last updated" date at the top will be revised accordingly.

## 10. Contact Us

If you have any questions about this Privacy Policy, please contact us at:

- **Email:** dnqduy.0611@gmail.com
- **Website:** [https://www.amonexus.com](https://www.amonexus.com)
