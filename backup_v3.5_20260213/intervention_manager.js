// intervention_manager.js
// Lớp này chịu trách nhiệm: SELECT UI & PICK COPY

import { initI18n, getMessage as atomGetMessage } from './i18n_bridge.js';

const i18nReady = initI18n();
const atomMsg = (key, substitutions, fallback) => atomGetMessage(key, substitutions, fallback);

export class InterventionManager {
    constructor() {
        // KHO COPY: Nơi chứa lời thoại của ATOM
        // Sau này có thể load từ Server hoặc AI generate
        this.copyLibrary = {
            // Dành cho Intent: ENFORCE_LIMIT (Chặn)
            red_zone: [
                atomMsg("red_zone_1"),
                atomMsg("red_zone_2"),
                atomMsg("red_zone_3"),
                atomMsg("red_zone_4"),
                atomMsg("red_zone_5"),
                atomMsg("red_zone_6")
            ],
            // Dành cho Intent: SIGNAL_AWARENESS (Cảnh báo)
            yellow_zone: [
                atomMsg("yellow_zone_1"),
                atomMsg("yellow_zone_2")
            ]
        };
    }
    /**
     * Hàm render chính cho V3
     * @param {string} category - Loại can thiệp (presence_signal, hard_interrupt, none...)
     * @param {Object} strategy - Ý đồ từ StrategyLayer
     */
    async renderV3(category, strategy) {
        // Lấy dữ liệu phản ứng từ storage để làm đầu vào cho hàm học
        const result = await chrome.storage.local.get(['atom_reactions']);
        const reactions = result.atom_reactions || [];

        // Xử lý Layer 2 (Orb) dựa trên 4 loại Silence đã định nghĩa
        const presencePayload = category === 'presence_signal' ? this._handleSilenceRules(category, strategy) : { show_orb: false };
        if (category === 'gentle_reflection') {
            return {
                type: 'micro_closure',
                payload: {
                    variant: "one_tap",
                    text: await this._pickCopy("yellow_zone"),
                    actions: [
                        { id: "finish_session", label: atomMsg("btn_rest_short"), type: "primary", log_result: "completed" },
                        { id: "snooze_delay", label: atomMsg("btn_snooze"), type: "secondary", log_result: "snoozed" }
                    ],
                    presence: { ...presencePayload, level: "low" }
                }
            };
        }
        if (category === 'micro_closure') {
            return {
                type: 'micro_closure',
                payload: {
                    // Variant 1: One-tap (Theo khuyến nghị của bạn)
                    variant: "one_tap",

                    // Copywriting: Ngắn, gọn, gợi mở (Open-ended)
                    text: this._pickMicroCopy(),

                    // Logic nút bấm
                    // SỬA CÁC LABEL NÚT BẤM:
                    actions: [
                        {
                            id: "finish_session",
                            label: atomMsg("btn_stop_session"), // Thay cho "Dừng lại ở đây nhé"
                            type: "primary",
                            log_result: "completed"
                        },
                        {
                            id: "snooze_delay",
                            label: atomMsg("btn_snooze"), // Thay cho "Lát nữa"
                            type: "secondary",
                            log_result: "snoozed"
                        }
                    ],

                    // Vẫn có thể kèm orb nền nếu muốn (Hybrid Layer)

                }
            };
        }
        if (category === 'hard_interrupt') {
            // SỬ DỤNG HÀM CỦA BẠN TẠI ĐÂY
            const selectedMode = this._determineBestMode(reactions);

            const textContent = await this._pickCopy(
                strategy.intent === "restore_awareness" ? "yellow_zone" : "red_zone"
            );

            return {
                type: 'hard_interrupt',
                payload: {
                    mode: selectedMode, // Kết quả từ thuật toán học
                    text: textContent,
                }
            };
        }

        if (category === 'presence_signal') {
            return {
                type: 'presence_signal',
                payload: { presence: presencePayload }
            };
        }

        return { type: 'none' };
    }

    /**
     * Logic phân loại 4 loại Silence cho Layer 2
     */
    _handleSilenceRules(category, strategy) {
        if (!strategy) return { show_orb: false };

        const { intent, intensity, risk_tolerance } = strategy;

        // 1️⃣ Silence loại A - Respectful Silence (Agency cao / Self-stop)
        // Khi Strategy không được kích hoạt (Intent là ALLOW_CONTINUE)
        if (intent === "ALLOW_CONTINUE") {
            return { show_orb: false, mode: 'hidden' };
        }

        if (intent === "observe_only") {
            return { show_orb: false };
        }

        const isPresencePhase = (category === null || category === 'presence_signal');

        // 2️⃣ Silence loại B - Fatigue Silence (Fatigue cao)
        // Ưu tiên hiện Orb nhẹ để giữ kết nối mà không làm phiền
        if (intent === "reduce_resistance" && (category === null || category === 'presence_signal')) {
            return { show_orb: true, level: 'low', pulse: 'slow' };
        }

        if (category === 'presence_signal') {
            return { show_orb: true, level: intensity || 'low' };
        }

        // 3️⃣ Silence loại C - Pre-Intervention Silence (Approaching Risk)
        if (intent === "restore_awareness" && (category === null || category === 'presence_signal')) {
            return { show_orb: true, level: 'medium', pulse: 'normal' };
        }

        // 4️⃣ Silence loại D - Observational Silence (Data Baseline)





        return { show_orb: false };
    }
    // Hàm chọn text ngẫu nhiên (Sau này sẽ nâng cấp thành AI chọn)
    // intervention_manager.js

    async _pickCopy(category) {
        // 1. Kiểm tra tin nhắn cá nhân hóa
        const result = await chrome.storage.local.get(['atom_personalized_msg']);
        const msgData = result.atom_personalized_msg;

        // Logic kiểm tra độ tươi mới (Ví dụ: Tin nhắn chỉ có giá trị trong 45 phút)
        const EXPIRY_MS = 45 * 60 * 1000;

        if (msgData && msgData.text) {
            const age = Date.now() - (msgData.timestamp || 0);

            if (age < EXPIRY_MS) {
                // Tin còn mới -> Dùng và xóa ngay (chỉ dùng 1 lần duy nhất)
                await chrome.storage.local.remove(['atom_personalized_msg']);
                return msgData.text;
            } else {
                // Tin đã thiu -> Xóa đi cho sạch
                await chrome.storage.local.remove(['atom_personalized_msg']);
            }
        }

        // 2. Nếu không có tin nhắn mới, dùng kho mặc định
        const list = this.copyLibrary[category] || this.copyLibrary.red_zone;
        return list[Math.floor(Math.random() * list.length)];
    }
    // intervention_manager.js
    _pickMicroCopy() {
        // Danh sách các key trong messages.json
        const keys = ["micro_copy_1", "micro_copy_2", "micro_copy_3", "micro_copy_4"];
        // Chọn ngẫu nhiên key, sau đó lấy text tương ứng
        const randomKey = keys[Math.floor(Math.random() * keys.length)];
        return atomMsg(randomKey);
    }
    _determineBestMode(reactions) {
        const modes = ['BREATH', 'TAP', 'STILLNESS'];

        // 1. Nếu chưa có dữ liệu, chọn ngẫu nhiên để khám phá
        if (!Array.isArray(reactions) || reactions.length < 3) {
            return modes[Math.floor(Math.random() * modes.length)];
        }
        const usable = reactions.filter(r =>
            (r.event === 'COMPLETED' || r.event === 'IGNORED' || r.event === 'SNOOZED') &&
            (r.mode === 'BREATH' || r.mode === 'TAP' || r.mode === 'STILLNESS')
        );
        // 2. Tính điểm cho từng mode (Tỷ lệ bị bỏ qua)
        const modeStats = modes.map(mode => {
            const modeEvents = usable.filter(r => r.mode === mode);
            if (modeEvents.length === 0) return { mode, weight: 1 }; // chưa thử mode này

            const completed = modeEvents.filter(r => r.event === 'COMPLETED').length;
            const ignored = modeEvents.filter(r => r.event === 'IGNORED').length;
            const snoozed = modeEvents.filter(r => r.event === 'SNOOZED').length;

            const total = completed + ignored + snoozed;
            if (total === 0) return { mode, weight: 1 };

            // Điểm: thưởng completed, phạt ignored mạnh hơn, phạt snoozed nhẹ
            const weight = (completed - 2 * ignored - 0.5 * snoozed) / total;

            return { mode, weight };
        });

        // 3. Sắp xếp: Chọn mode có trọng số (weight) cao nhất (ít bị bỏ qua nhất)
        modeStats.sort((a, b) => b.weight - a.weight);

        // 4. Cơ chế "Thử sai": 80% chọn mode tốt nhất, 20% chọn ngẫu nhiên để kiểm tra lại
        return (Math.random() > 0.2)
            ? modeStats[0].mode
            : modes[Math.floor(Math.random() * modes.length)];
    }
    // Hàm chính: Biến Decision thành UI Payload
    async selectIntervention(decision) {
        // 1. Nếu Brain bảo "Không làm gì" -> Trả về None
        if (!decision.should_intervene) {
            return { type: "none" };
        }

        // 2. Xử lý YELLOW ZONE (Presence Orb)
        if (decision.intent === "SIGNAL_AWARENESS") {
            return {
                type: "presence_signal",
                payload: {
                    level: 'soft_companion', // Tên level mới mang tính đồng hành
                    scroll_sec: decision.meta?.depth || 0
                }
            };
        }


        // 3. Xử lý RED ZONE (Chặn màn hình)
        if (decision.intent === "ENFORCE_LIMIT") {
            const result = await chrome.storage.local.get(['atom_reactions']);
            const reactions = result.atom_reactions || [];

            // Xác định mode dựa trên lịch sử hoặc ngẫu nhiên
            const selectedMode = this._determineBestMode(reactions);

            const textContent = await this._pickCopy("red_zone");

            return {
                type: 'hard_interrupt',
                payload: {
                    mode: selectedMode, // Gửi về 'BREATH', 'TAP', hoặc 'STILLNESS'
                    text: textContent
                }
            };
        }

        return { type: "none" };
    }
}

