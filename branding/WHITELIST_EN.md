# AmoNexus Whitelist & Exemption Policy

**Last updated:** February 01, 2026

To ensure the highest level of privacy and safety ("NeuroGuard" standard), AmoNexus employs a strict **Whitelist Policy**. This document details how we handle specific domains, what we consider "Safe Zones," and where the extension automatically disables itself to protect your sensitive data.

## 1. Privacy Exemptions (Automatic Disable)
AmoNexus is designed to respect your privacy in critical contexts. The extension is programmed to **automatically disable** its "Active Reading" and "Journaling" features on the following categories of websites. We do not process, read, or send data from these domains to any AI endpoints.

### 🛑 Tier 1: Financial & Banking
*   **Banking Portals:** `*.bankofamerica.com`, `*.chase.com`, `*.wellsfargo.com`, `*.hsbc.com`, etc.
*   **Payment Gateways:** `paypal.com`, `stripe.com`, `venmo.com`.
*   **Crypto Wallets:** `metamask.io`, `coinbase.com`.

### 🛑 Tier 2: Government & Legal
*   **Government Sites:** Domains ending in `.gov` (e.g., `usa.gov`, `gov.uk`) or `.gov.vn`.
*   **Tax Services:** `irs.gov`, `gdt.gov.vn`.

### 🛑 Tier 3: Healthcare (PII Protection)
*   **Medical Records (EMR/EHR):** `epic.com`, `cerner.com`, `mychart.org`.
*   **Telehealth Portals:** Domains containing sensitive patient data.
*   *Note:* While AmoNexus is a "Medical-grade" productivity tool, we strictly avoid interacting with actual clinical data unless you are on a generic medical knowledge site (e.g., PubMed, WebMD).

---

## 2. Productivity Whitelist (Default Safe Zones)
AmoNexus recognizes that "Productivity" looks different for everyone. However, out of the box, we whitelist the following domains as **"Safe Zones"**.
*   **Behavior:** The "Focus Mode" timer will **NOT** count browsing time on these sites as "distraction," and no intervention alerts (breathing exercises) will be triggered.

### ✅ Collaborative Tools
*   `notion.so`
*   `figma.com`
*   `linear.app`
*   `trello.com`
*   `miro.com`

### ✅ Knowledge & Dev
*   `github.com`
*   `stackoverflow.com`
*   `docs.google.com` (Drive/Docs/Sheets)
*   `chatgpt.com`, `claude.ai` (AI Workspaces)

### ✅ Education
*   `coursera.org`
*   `udemy.com`
*   `khanacademy.org`
*   `wikipedia.org`

---

## 3. User-Defined Control
You are the ultimate architect of your digital environment.

*   **Custom Whitelist:** You can add any domain to your personal "Safe Zone" via the **Options Page** or by clicking the "Add to Safe Zone" toggle in the Popup menu.
*   **Custom Blacklist:** Conversely, you can manually flag specific "Productivity" sites as distractions if you find yourself overusing them (e.g., spending too much time tweaking Notion details).

## 4. Third-Party Connections
AmoNexus only connects to third-party services that are explicitly whitelisted in our security architecture:
1.  **Google Gemini API:** `generativelanguage.googleapis.com` (For AI processing).
2.  **NotebookLM:** `notebooklm.google.com` (For "Second Brain" export).
3.  **Chrome Sync:** Internal browser storage (For settings sync).

We **block** all other background connections to unauthorized ad-servers or analytics trackers.

---

**Contact Support**
If you believe a domain is incorrectly categorized, please submit a request via our GitHub Support page.
