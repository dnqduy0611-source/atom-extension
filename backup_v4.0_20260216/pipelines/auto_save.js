// pipelines/auto_save.js — Auto-save pipeline
// Phase 1: Marker file + re-export interface.
// Phase 3: Extract full auto-save logic from background.js.
//
// Pipeline flow:
//   User highlights text → floating_save.js click
//   → SRQ_CREATE_CARD message → background.js handler
//   → (auto-approve if SRQ_AUTO_SAVE) → (auto-export if SRQ_AUTO_EXPORT)
//
// NOTE: Actual auto-save logic hiện inline trong background.js.
// File này chỉ là marker và interface cho Phase 3 extraction.

/**
 * Auto-save pipeline entry point.
 * Phase 3: implement actual extraction from background.js
 */
export async function processAutoSave(payload) {
    // Phase 3: extract from background.js SRQ_CREATE_CARD handler
    console.log('[Pipeline:AutoSave] Placeholder — routing through background.js');
    return chrome.runtime.sendMessage({
        type: 'SRQ_CREATE_CARD',
        payload
    });
}

console.log('[Pipeline] auto_save loaded');
