// core_logic.js - REFACTORED V3 (ATOM PIPELINE WITH ESCALATION)

// --- 1. SIGNAL EXTRACTOR ---
// Chuyển đổi Raw Data -> Signals + Logic vượt rào (Escalation)
export class SignalExtractor {
    extract(raw, thresholds = null) {
        if (!thresholds) {
            thresholds = {
                SCROLL_THRESHOLD_SEC: 180,      // Ngưỡng Red Zone (3 phút)
                PRESENCE_THRESHOLD_SEC: 90,     // Ngưỡng Yellow Zone (1.5 phút)
                INTERVENTION_CAP: 2,            // Giới hạn số lần nhắc thường
                RESISTANCE_THRESHOLD: 4         // [MỚI] Ngưỡng kháng cự để kích hoạt "chế độ nghiêm túc"
            };
        }
        const continuous_scroll = raw.continuous_scroll_sec || 0;
        // [FIX 2] MOMENTUM THẬT
        // Nếu có scroll_px thì dùng, không thì fallback về thời gian (cho tương thích cũ)
        const realScrollDepth = raw.scroll_px !== undefined ? raw.scroll_px : continuous_scroll;
        const intervention_count_recent = raw.intervention_count_recent || 0;
        
        // [MỚI] Lấy dữ liệu Leo thang (nếu không có thì tạo mặc định an toàn)
        const escalation = raw.escalation || { 
            resistanceScore: 0, 
            lastHardTs: 0, 
            hardCooldownOk: true,
            triggeredCount: 0,  // <--- Đã thêm
            ignoredStreak: 0    // <--- Đã thêm 
        };

        // --- 1. TÍNH TOÁN NGƯỠNG ĐỘNG ---
        const limit = thresholds.SCROLL_THRESHOLD_SEC;
        
        // [FIX] Momentum Scaling (1.5x ngưỡng đỏ)
        // Ví dụ: Strict(60) -> 90s; Balanced(180) -> 270s
        const momentumLimit = limit;

        // Signal 1: Chạm ngưỡng chặn (Red Zone)
        const attention_risk = continuous_scroll >= thresholds.SCROLL_THRESHOLD_SEC;

        // Signal 2: Vùng cảnh báo (Yellow Zone)
        const approaching_risk = (continuous_scroll >= thresholds.PRESENCE_THRESHOLD_SEC) 
                                 && (continuous_scroll < thresholds.SCROLL_THRESHOLD_SEC);

        // [QUAN TRỌNG - ĐÃ FIX] Signal 3: High Momentum (Tính toán trước khi dùng)
        const is_high_momentum = continuous_scroll >= momentumLimit;

        // Signal 3: Kiểm tra giới hạn (Logic thông minh)
        // Cap OK nếu: (Chưa vượt quá giới hạn) HOẶC (User đang quá lì lợm và cần biện pháp mạnh)
        const isResistant = escalation.resistanceScore >= thresholds.RESISTANCE_THRESHOLD;
        
        const cap_ok = (intervention_count_recent < thresholds.INTERVENTION_CAP) || isResistant;

        return {
            attention_risk: attention_risk,
            approaching_risk: approaching_risk,
            cap_ok: cap_ok,
            scroll_depth: realScrollDepth,
            is_high_momentum: is_high_momentum,
            // [QUAN TRỌNG] Truyền dữ liệu này xuống cho StrategyLayer quyết định
            escalation: escalation,
            thresholds: thresholds
        };
    }
}

// --- 2. DECISION ENGINE ---
// The Guard: Chỉ quyết định Cho đi tiếp hay Dừng lại
export class DecisionEngine {
    decide(signals) {
        // Pipeline chỉ chạy tiếp khi: (Có rủi ro) VÀ (Được phép can thiệp)
        const needs_processing = (signals.attention_risk || signals.approaching_risk) && signals.cap_ok;
        
        return {
            // is_allowed = FALSE nghĩa là "Không được bỏ qua, hãy xử lý tiếp đi"
            // is_allowed = TRUE nghĩa là "An toàn, cứ lướt tiếp đi" (Pipeline dừng tại đây)
            is_safe_to_scroll: !needs_processing, 
            
            // Gắn nhãn để debug
            trigger: signals.attention_risk 
                ? "HARD_LIMIT" 
                : (signals.approaching_risk ? "SOFT_SIGNAL" : "NONE"),
            
            meta: { 
                scroll_depth: signals.scroll_depth 
            }
        };
    }
}