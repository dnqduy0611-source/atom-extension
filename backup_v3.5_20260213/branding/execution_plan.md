# Implementation Plan: AmoNexus Rebranding 🚀

# Goal Description
Rename the extension from "Amo" to "**AmoNexus**" and update the visual identity across the entire codebase to reflect the "Second Brain / Neural Nexus" theme.

## User Review Required
> [!IMPORTANT]
> This change will update the Extension Name visible in `chrome://extensions` and the Chrome Web Store.
> **New Name:** `AmoNexus`
> **New Description:** `The Neural Nexus for Your Second Brain.`

## Phase 1: Core Identity (Configuration)

### Configuration
#### [MODIFY] [manifest.json](file:///d:/Amo/ATOM_Extension_V2.6/manifest.json)
- Update `name` to `AmoNexus`
- Update `description` to match the new tagline.

### Localization
#### [MODIFY] [messages.json (en)](file:///d:/Amo/ATOM_Extension_V2.6/_locales/en/messages.json)
- Update `appName` to `AmoNexus`
- Update `appDesc` to `The Neural Nexus for Your Second Brain.`
- Update `popup_title` to `AmoNexus`
- Update `popup_subtitle` to `The Neural Nexus`
- Update `opt_title` to `AmoNexus Settings`

#### [MODIFY] [messages.json (vi)](file:///d:/Amo/ATOM_Extension_V2.6/_locales/vi/messages.json)
- Update `appName` to `AmoNexus`
- Update `appDesc` to `Giao điểm thần kinh cho bộ não thứ hai của bạn.`
- Update `popup_title` to `AmoNexus`
- Update `popup_subtitle` to `Trung tâm điều hành`
- Update `opt_title` to `Cài đặt AmoNexus`

## Phase 2: UI & Visual Identity Update (HTML/JS)

### HTML Files (Hardcoded Fallbacks)
#### [MODIFY] [options.html](file:///d:/Amo/ATOM_Extension_V2.6/options.html)
- Line 6: `<title>ATOM Settings</title>` -> `<title>AmoNexus Settings</title>`
- Line 735: `ATOM` -> `AmoNexus` (Sidebar Header)

#### [MODIFY] [popup.html](file:///d:/Amo/ATOM_Extension_V2.6/popup.html)
- Line 6: `<title>ATOM</title>` -> `<title>AmoNexus</title>`
- Line 509: `<h2>ATOM</h2>` -> `<h2>AmoNexus</h2>`
- Line 510: Subtitle `Intelligent Attention Compass` -> `The Neural Nexus`
- Line 522: `ATOM is on Chrome Store` -> `AmoNexus is live!`

### JavaScript (Visible Logs/Notifications)
#### [MODIFY] [background.js](file:///d:/Amo/ATOM_Extension_V2.6/background.js)
- Update any user-facing notifications that mention "ATOM".

#### [MODIFY] [content.js](file:///d:/Amo/ATOM_Extension_V2.6/content.js)
- Check for "ATOM" in any visible overlay text not covered by i18n.

## Verification Plan

### Manual Verification
1.  **Load Extension**: Open `chrome://extensions`.
2.  **Verify Name**: Check that the extension card shows "AmoNexus".
3.  **Verify Popup**: Open the popup and check the Title "AmoNexus" and Subtitle "The Neural Nexus".
4.  **Verify Options**: Open Options page and check the Sidebar Title.
5.  **Language Test**: Switch browser language to Vietnamese/English to verify translations.
