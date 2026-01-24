// selection_logic.js - THE CURATOR (V3)

export class SelectionLogic {
    /**
     * @param {Object} strategy - Input A: Strategy Object {intent, priority, intensity, risk_tolerance}
     * @param {Object} context - Input B: Context Constraints {fatigue, recent_category, dismissal_frequency}
     */
    selectCategory(strategy, context) {
        //return 'hard_interrupt';
        if (!strategy) return null;

        // --- BƯỚC 1: KHỞI TẠO DANH SÁCH ỨNG VIÊN (Input C) ---
        // Sắp xếp theo mức độ xâm lấn tăng dần (Nguyên tắc 1: Least Intrusive First)
        const candidates = [
            'presence_signal',   // Rất thấp
            'micro_closure',     // Thấp
            'gentle_reflection', // Trung bình
            'hard_interrupt'     // Cao
        ];

        // --- BƯỚC 2: ÁP DỤNG EXCLUSION RULES (Chạy trước - Bảo vệ Trust) ---
        let isAggressive = strategy.risk_tolerance === 'aggressive';
        let filteredCandidates = candidates;
        // E1: Fatigue cao -> Silence (Nguyên tắc 2)
        if (context.intervention_fatigue === "high" && !isAggressive) return null;

        // E3: Risk Tolerance Conservative -> Cấm Hard Interrupt
        if (strategy.risk_tolerance === "conservative") {
            filteredCandidates = filteredCandidates.filter(c => c !== 'hard_interrupt');
        }

        // E2: Không lặp lại category vừa dùng (Nguyên tắc 3: Anti-meh)
        if (context.recent_category && context.recent_category !== 'presence_signal' && !isAggressive) {
             filteredCandidates = filteredCandidates.filter(c => c !== context.recent_category);
        }
        // --- BƯỚC 3: BẢNG QUYẾT ĐỊNH (DECISION TABLE) ---
        let selected = null;

        const { intent, intensity, priority, risk_tolerance } = strategy;
        // [MEMORY] Logic ưu tiên dựa trên lịch sử thành công
        const userPrefersMicro = context.last_successful_intervention === 'micro_closure';
        // L1: Giảm phản kháng
        if (intent === "reduce_resistance") selected = 'presence_signal';

        // L2 & L3: Phục hồi nhận thức
        else if (intent === "restore_awareness") {
            selected = (intensity === "low") ? 'presence_signal' : 'gentle_reflection';
        }

        // L4, L5, L6: Đóng vòng lặp (Closure)
        else if (intent === "enable_closure") {
            
            // [FIXED] Ưu tiên Hard Interrupt trước tiên nếu mode là Aggressive
            if (intensity === "high" && risk_tolerance === "aggressive") {
                selected = 'hard_interrupt';
            }
            // Sau đó mới xét đến sở thích user (Micro Closure)
            else if (userPrefersMicro && intensity === "high") {
                 selected = 'micro_closure';
            }
        
            // Mặc định dùng Micro Closure
            else {
                selected = 'micro_closure'; 
            }
        }

        // L7: Phản chiếu nhẹ nhàng (Sentiment-driven từ V2)
        else if (intent === "gentle_reflection") {
            selected = 'gentle_reflection';
        }

        // --- BƯỚC 4: FINAL VALIDATION ---
        
        // Kiểm tra xem selected có nằm trong danh sách được phép (filteredCandidates) không
        if (selected && !filteredCandidates.includes(selected)) {
            // Nếu mode là Aggressive mà bị lọc mất Hard Interrupt thì bắt buộc trả về cái nặng nhất còn lại
            if (isAggressive && filteredCandidates.includes('micro_closure')) return 'micro_closure';
            
            return filteredCandidates.includes('presence_signal') ? 'presence_signal' : null;
        }

        return selected;
    }
}