// strategy_layer.js - THE CORE INTELLIGENCE (V3)

export class StrategyLayer {
    /**
     * @param {Object} signals - Nhóm 1: Behavioral Signals (từ SignalExtractor)
     * @param {Object} ctx - Nhóm 2, 3, 4: Fatigue, Resistance, Trajectory & Sentiment
     */
    buildStrategy(signals, ctx) {
        const { approaching_risk, attention_risk} = signals;
        const escalation = signals.escalation || { resistanceScore: 0, hardCooldownOk: true, triggeredCount: 0, ignoredStreak: 0 };
        const { 
            intervention_fatigue, // Nhóm 2: low/medium/high
            resistance_signal,    // Nhóm 3: low/medium/high
            recent_effect,        // Nhóm 4: positive/neutral/negative
            sentiment             // Tinh túy V2: cảm xúc từ Journal
        } = ctx;

        // --- LAYER 0: EMERGENCY / SILENCE RULES ---
        // Nếu đang làm phiền user quá mức (Fatigue High), rút lui để bảo vệ Trust
        if (intervention_fatigue === "high" && escalation.resistanceScore < 6) {
            return this._createStrategyObject("reduce_resistance", "trust", "low", "conservative");
        }

        // --- LAYER 1: SENTIMENT OVERRIDE (Tinh túy V2) ---
        // Nếu user đang trong trạng thái tâm lý đặc biệt, cảm xúc sẽ dẫn dắt chiến thuật
        if (["anxious", "stressed", "tired"].includes(sentiment)) {
            return this._createStrategyObject("gentle_reflection", "empathy", "low", "conservative");
        }

        // --- LAYER 2: BEHAVIORAL STRATEGY (Logic Leo Thang) ---
        
        // A. RED ZONE (Đã lướt quá lâu >= 180s)
        if (attention_risk) {
            
            // 1. Đánh giá Momentum (Đà lướt)
            // scroll_depth ở đây chính là số giây lướt (do core_logic mapping)
            // > 300s (5 phút) là đà cao
            const isHighMomentum = signals.is_high_momentum;

            // 2. Đánh giá Resistance (Độ lì lợm)
            // Điểm >= 4 (tương đương 2 lần lờ đi) HOẶC đã hiện > 3 lần trong 30p
            const isHighResistance = 
                (escalation.resistanceScore >= 4) || 
                (escalation.triggeredCount >= 3) ||
                (escalation.ignoredStreak >= 2);

            // 3. QUYẾT ĐỊNH CHIẾN THUẬT
            let riskTolerance = "balanced"; // Mặc định: Ôn hòa
            let intensity = "medium";       // Mặc định: Vừa phải

            // 🔥 LOGIC LEO THANG (ESCALATION RULE)
            // Điều kiện: Đà cao + Lì lợm + Không bị Cooldown chặn
            if (isHighMomentum && isHighResistance && escalation.hardCooldownOk) {
                riskTolerance = "aggressive"; // <--- Chìa khóa mở Hard Interrupt
                intensity = "high";
                console.log("🔥 ATOM STRATEGY: Escalation Triggered (Hard Mode)");
            } 
            // Nếu chỉ lướt sâu mà chưa lì lợm -> Nhắc nhở mạnh hơn chút nhưng vẫn mềm mỏng
            else if (isHighMomentum) {
                intensity = "high";
            }

            return this._createStrategyObject("enable_closure", "clarity", intensity, riskTolerance);
        }

        // B. YELLOW ZONE (Sắp chạm ngưỡng)
        if (approaching_risk) {
            return this._createStrategyObject("restore_awareness", "trust", "low", "conservative");
        }

        // Mặc định: Silence (Chủ động không can thiệp)
        return null;
    }

    /**
     * Hàm tạo Object theo Schema cố định - Cực kỳ quan trọng để ML học sau này
     */
    _createStrategyObject(intent, priority, intensity, risk_tolerance) {
        return {
            intent,          // WHY: restore_awareness, enable_closure, reduce_resistance, gentle_reflection
            priority,        // VALUE: trust, clarity, empathy, momentum
            intensity,       // STRENGTH: low, medium, high
            risk_tolerance,  // SAFETY: conservative, balanced, aggressive
            timestamp: Date.now() 
        };
    }

    /**
     * Helper để chuẩn hóa dữ liệu từ các file V2 vào V3
     * Chuyển đổi atom_reactions (raw) thành các nhóm yếu tố của Strategy
     */
    static parseContext(data) {
        const reactions = data.atom_reactions || [];
        const logs = data.journal_logs || [];
        
        // Logic tính toán nhanh (MVP)
        const recentDismissals = reactions.slice(-3).filter(r => r.event === 'IGNORED').length;
        
        return {
            intervention_fatigue: reactions.length > 5 ? "medium" : "low",
            resistance_signal: recentDismissals >= 2 ? "high" : "low",
            recent_effect: "neutral", // Sẽ được cập nhật khi có logic Trajectory
            sentiment: this.parseSentiment(logs)
        };
    }

    // strategy_layer.js

    static parseSentiment(logs) {
    // Defensive defaults
    if (!Array.isArray(logs) || logs.length === 0) return "neutral";

    const last = logs[logs.length - 1];
    const input = last?.input || {};

    // 1) Ưu tiên "stress" tag -> sentiment = "stressed"
    // Vì UI có tag "stress" nhưng emoji list hiện không có data-val="stressed"
    // (nên nếu không map, nhánh "stressed" trong buildStrategy gần như không bao giờ chạy)
    const tags = input.user_tags;
    if (Array.isArray(tags) && tags.includes("stress")) {
        return "stressed";
    }

    // 2) Fallback: lấy trực tiếp từ emoji/feeling
    return input.user_feeling || "neutral";
    }

}