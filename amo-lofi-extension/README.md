# Amo Lofi Extension

> **The Standalone Focus Sanctuary**
> Replacing "New Tab" with a cinematic focus environment.

## Overview
This is the standalone extension project for **Amo Lofi**, completely separate from Amo Nexus.
It functions as a **New Tab Override** and companion to [lofi.amonexus.com](https://lofi.amonexus.com).

## Tech Stack
- **Framework:** React 19 + TypeScript 5.9
- **Build:** Vite 7 + CRXJS
- **Manifest:** V3
- **Permissions:** `tabs`, `storage`, `alarms`, `notifications`

## Setup
```bash
npm install
npm run dev   # Start dev server with HMR
```

## Load Extension in Chrome
1. Run `npm run dev` (or `npx vite build` for production)
2. Open `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked" → select the `dist/` folder
5. Open a new tab → Amo Lofi should appear

## Build
```bash
npm run build   # TypeScript check + production build → dist/
```

## Project Structure
```
amo-lofi-extension/
├── src/
│   ├── newtab/          # New Tab override page
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── NewTab.tsx
│   │   └── newtab.css
│   ├── background/      # Service Worker
│   │   └── index.ts
│   └── popup/           # Extension popup
│       ├── index.html
│       ├── main.tsx
│       └── Popup.tsx
├── public/icons/        # Extension icons
├── manifest.json        # MV3 manifest
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Core Features (Planned)
1. **Cinematic Dashboard:** Video scenes, giant clock, immersive UI
2. **Teleport Blocker:** Gently redirects blocked sites back to Sanctuary
3. **Parking Lot:** Saves blocked URLs for break time
4. **Scene Sync:** Syncs scenes from lofi.amonexus.com
