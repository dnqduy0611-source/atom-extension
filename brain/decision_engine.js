// brain/decision_engine.js
// Extracted from core_logic.js — DecisionEngine class
// + Phase 1 MỚI: Hybrid delivery (sidepanel-aware nudge routing)

// === ORIGINAL: DecisionEngine (từ core_logic.js) ===

export class DecisionEngine {
    decide(signals) {
        // Pipeline chỉ chạy tiếp khi: (Có rủi ro) VÀ (Được phép can thiệp)
        const needs_processing = (signals.attention_risk || signals.approaching_risk) && signals.cap_ok;

        return {
            // is_safe_to_scroll = TRUE → an toàn, cứ lướt
            // is_safe_to_scroll = FALSE → cần xử lý
            is_safe_to_scroll: !needs_processing,

            trigger: signals.attention_risk
                ? "HARD_LIMIT"
                : (signals.approaching_risk ? "SOFT_SIGNAL" : "NONE"),

            meta: {
                scroll_depth: signals.scroll_depth
            }
        };
    }
}

// === PHASE 1 MỚI: Hybrid Delivery ===

const NUDGE_COOLDOWN_MS = 5 * 60 * 1000;  // 5 phút giữa các nudge
const MAX_NUDGES_PER_SESSION = 3;          // Tối đa 3 nudge/session
const MAX_NUDGES_PER_DAY = 8;              // Tối đa 8 nudge/ngày

/**
 * Gate logic: có nên nudge user lúc này không?
 * Áp dụng cho CẢ HAI mode (chat + page).
 */
export function shouldNudge(signals, stats) {
    if (stats.nudgesThisSession >= MAX_NUDGES_PER_SESSION) return 'skip';
    if (stats.nudgesToday >= MAX_NUDGES_PER_DAY) return 'skip';
    if (Date.now() - stats.lastNudgeAt < NUDGE_COOLDOWN_MS) return 'wait';

    const { escalation } = signals;
    if (escalation.resistanceScore >= 6 && stats.nudgesThisSession >= 2) {
        return 'skip'; // User lì quá, dừng nudge
    }

    if (signals.attention_risk || signals.approaching_risk) return 'nudge';
    return 'skip';
}

/**
 * Check sidepanel open state via PING/PONG.
 * Sidepanel trả lời PONG = đang mở.
 * Timeout 100ms = đóng.
 * 
 * Có resolved flag để tránh race condition khi cả
 * callback và setTimeout đều fire gần nhau.
 */
export async function isSidepanelOpen() {
    return new Promise(resolve => {
        let resolved = false;
        try {
            chrome.runtime.sendMessage({ type: 'PING_SIDEPANEL' }, response => {
                if (!resolved) {
                    resolved = true;
                    resolve(response?.pong === true);
                }
            });
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    resolve(false);
                }
            }, 100);
        } catch {
            if (!resolved) {
                resolved = true;
                resolve(false);
            }
        }
    });
}

/**
 * Hybrid delivery: chọn kênh dựa trên sidepanel state.
 * 
 * - Sidepanel MỞ  → chat nudge (companion mode)
 * - Sidepanel ĐÓNG → return 'use_page_mode' để caller dùng intervention pipeline cũ
 */
export async function deliverNudge(signals, context) {
    const decision = shouldNudge(signals, context);
    if (decision === 'skip' || decision === 'wait') return decision;

    const sidepanelOpen = await isSidepanelOpen();

    if (sidepanelOpen) {
        // ═══ CHAT MODE ═══
        // Dynamic import — nudge.js chỉ load khi cần
        try {
            const { generateNudge } = await import('../ai/prompts/nudge.js');
            const nudge = generateNudge(signals, context);
            if (nudge) {
                chrome.runtime.sendMessage({
                    type: 'CHAT_NUDGE',
                    nudge
                });
                return 'delivered_chat';
            }
        } catch (err) {
            console.warn('[DecisionEngine] Chat nudge failed:', err);
        }
        return 'skip';
    } else {
        // ═══ PAGE MODE ═══
        // Trả về signal cho caller giữ nguyên pipeline cũ:
        // core_logic → strategy_layer → intervention_manager
        return 'use_page_mode';
    }
}

export default DecisionEngine;
