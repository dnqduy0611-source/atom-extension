# Amo Web Playground (Live Demo) Specification

## 1. Overview
**Goal**: Create a web-based "Playground" to allow users to experience Amo features (Chat, Knowledge Graph) instantly without installing the Chrome Extension. This serves as a "Try before you buy" mechanism to increase conversion rates.

**Current State**: 
- Extension exists (Vanilla JS/HTML).
- Landing Page exists (`ATOM_Web` - Next.js).
- Problem: Approval time for Extension is long; users hesitate to install unknown extensions.

**Solution**: Build a `/playground` route in the existing Next.js marketing site that simulates the Extension experience.

## 2. Architecture & Tech Stack
- **Base Project**: Existing `ATOM_Web` (Next.js 16, React 19, Tailwind CSS).
- **Architecture**: Single Page Application (SPA) simulation.
- **State Management**: React State + Hooks (`localChrome` simulation).

### Key Components
1.  **Split View Layout**:
    - **Left Panel (65%)**: "Simulated Browser". Displays static HTML content (Sample Articles) to mimic a real web page.
    - **Right Panel (35%)**: "Amo Sidebar". A React port of the Extension's Side Panel.

2.  **Mock Chrome Layer**:
    - Since `chrome.*` APIs are unavailable on the web, we must mock them.
    - `chrome.storage.local` -> Browser `localStorage`.
    - `chrome.runtime.sendMessage` -> React Context / Event Bus.
    - `chrome.tabs.query` -> Return the current "Sample Article" state.

## 3. User Flow
1.  **Entry**: User clicks "Try Demo" from Landing Page.
2.  **Setup**:
    - User enters API Key (or uses limited Free quota if backend supported).
    - User selects a "Demo Scenario" (e.g., "Analyze a TechCrunch Article", "Read a Wikipedia Page").
3.  **Experience**:
    - The "Simulated Browser" loads the article.
    - User selects text -> "Quick Actions" float menu appears (simulated).
    - User clicks "Summarize" -> Amo Sidebar opens and streams summary.
    - User chats with Amo about the content.
4.  **Conversion**:
    - After X interactions or Y minutes, show a "Call to Action" modal: "Want to use this on ANY website? Install the Extension now."

## 4. Implementation Details

### Phase 1: MVP (Client-Side Only)
- **Route**: `app/playground/page.tsx`
- **Sidebar Port**: Rewrite `sidepanel.html` components (Chat, Tab Bar, Bubble) into React components.
- **Demo Data**: Hardcode 3-5 articles in `lib/demo-data.ts`.
- **Logic**: 
    - `useAmoCore`: Hook to manage the virtual extension state.
    - `MockRuntime`: Service to handle message passing.

### Phase 2: Enhanced (Optional)
- **Backend Proxy**: Allow users to input ANY URL, backend fetches HTML and sanitizes it for the "Simulated Browser".
- **Visuals**: Add Knowledge Graph visualization using D3.js or React-Force-Graph.

## 5. Mock API Interface
```typescript
interface MockStorage {
  get(keys: string[] | string | null): Promise<any>;
  set(items: { [key: string]: any }): Promise<void>;
}

interface MockRuntime {
  sendMessage(message: any): Promise<any>;
  onMessage: {
    addListener(callback: (message: any, sender: any, sendResponse: any) => void): void;
  }
}
```

## 6. Design (UI/UX)
- **Style**: Match the existing Landing Page aesthetic (Premium, Dark/Light mode compatible).
- **Responsive**: 
    - Desktop: Split View.
    - Mobile: Stacked View (Content top, Button to open Sidebar bottom sheet).
