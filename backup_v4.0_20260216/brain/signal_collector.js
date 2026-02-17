// brain/signal_collector.js
// Extracted from core_logic.js — SignalExtractor class
// Chuyển đổi Raw Data -> Signals + Logic vượt rào (Escalation)

export class SignalExtractor {
    extract(raw, thresholds = null) {
        if (!thresholds) {
            thresholds = {
                SCROLL_THRESHOLD_SEC: 180,      // Ngưỡng Red Zone (3 phút)
                PRESENCE_THRESHOLD_SEC: 90,     // Ngưỡng Yellow Zone (1.5 phút)
                INTERVENTION_CAP: 2,            // Giới hạn số lần nhắc thường
                RESISTANCE_THRESHOLD: 4         // Ngưỡng kháng cự để kích hoạt "chế độ nghiêm túc"
            };
        }
        const continuous_scroll = raw.continuous_scroll_sec || 0;
        // Nếu có scroll_px thì dùng, không thì fallback về thời gian
        const realScrollDepth = raw.scroll_px !== undefined ? raw.scroll_px : continuous_scroll;
        const intervention_count_recent = raw.intervention_count_recent || 0;

        // Lấy dữ liệu Leo thang (nếu không có thì tạo mặc định an toàn)
        const escalation = raw.escalation || {
            resistanceScore: 0,
            lastHardTs: 0,
            hardCooldownOk: true,
            triggeredCount: 0,
            ignoredStreak: 0
        };

        // --- TÍNH TOÁN NGƯỠNG ĐỘNG ---
        const limit = thresholds.SCROLL_THRESHOLD_SEC;
        const momentumLimit = limit;

        // Signal 1: Chạm ngưỡng chặn (Red Zone)
        const attention_risk = continuous_scroll >= thresholds.SCROLL_THRESHOLD_SEC;

        // Signal 2: Vùng cảnh báo (Yellow Zone)
        const approaching_risk = (continuous_scroll >= thresholds.PRESENCE_THRESHOLD_SEC)
            && (continuous_scroll < thresholds.SCROLL_THRESHOLD_SEC);

        // Signal 3: High Momentum
        const is_high_momentum = continuous_scroll >= momentumLimit;

        // Signal 4: Cap check — OK nếu chưa vượt giới hạn HOẶC user quá lì lợm
        const isResistant = escalation.resistanceScore >= thresholds.RESISTANCE_THRESHOLD;
        const cap_ok = (intervention_count_recent < thresholds.INTERVENTION_CAP) || isResistant;

        return {
            attention_risk,
            approaching_risk,
            cap_ok,
            scroll_depth: realScrollDepth,
            is_high_momentum,
            escalation,
            thresholds
        };
    }
}

export default SignalExtractor;
