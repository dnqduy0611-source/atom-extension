import { initI18n, getMessage as atomGetMessage } from './i18n_bridge.js';

const i18nReady = initI18n();
const atomMsg = (key, substitutions, fallback) => atomGetMessage(key, substitutions, fallback);

export class MicroClosureRenderer {
  constructor() {
    this.container = null;
    this.shadowRoot = null;
    this.scrollListener = null;
    this.initialScrollY = 0;
    this.isVisible = false;

    // NHÚNG CSS TRỰC TIẾP VÀO ĐÂY (Để tránh lỗi missing variable)
    this.styles = `
          :host {
            all: initial;
            z-index: 2147483647;
            position: fixed;
            bottom: 40px;
            left: 50%;
            transform: translateX(-50%);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            pointer-events: none; /* Mặc định để click xuyên qua vùng trống */
          }

          .atom-pill {
            pointer-events: auto; /* Bật lại click cho nút */
            display: flex;
            align-items: center;
            gap: 12px;
            background: rgba(28, 28, 30, 0.9);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            padding: 10px 12px 10px 20px;
            border-radius: 99px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
            
            /* Animation */
            opacity: 0;
            transform: translateY(30px);
            transition: all 0.5s cubic-bezier(0.19, 1, 0.22, 1);
          }

          .atom-pill.visible {
            opacity: 1;
            transform: translateY(0);
          }

          .atom-pill.hiding {
            opacity: 0;
            transform: translateY(20px);
            pointer-events: none;
          }

          .atom-mini-orb {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #FFD700;
            box-shadow: 0 0 12px #FFD700;
            animation: pulse 2s infinite;
          }

          .atom-text {
            color: #F2F2F2;
            font-size: 14px;
            font-weight: 500;
            white-space: nowrap;
            margin-right: 8px;
          }

          .atom-actions {
            display: flex;
            gap: 8px;
          }

          button {
            cursor: pointer;
            border: none;
            outline: none;
            font-size: 13px;
            font-weight: 600;
            padding: 8px 16px;
            border-radius: 20px;
            transition: all 0.2s;
          }

          button:active {
            transform: scale(0.95);
          }

          .btn-primary {
            background: #FFFFFF;
            color: #000;
          }
          
          .btn-primary:hover {
            background: #E0E0E0;
            box-shadow: 0 2px 8px rgba(255,255,255,0.2);
          }

          .btn-secondary {
            background: transparent;
            color: #A0A0A0;
            border: 1px solid rgba(255,255,255,0.1);
          }

          .btn-secondary:hover {
            color: #FFF;
            border-color: rgba(255,255,255,0.4);
            background: rgba(255,255,255,0.05);
          }

          @keyframes pulse {
            0% { opacity: 0.6; transform: scale(0.9); }
            50% { opacity: 1; transform: scale(1.1); }
            100% { opacity: 0.6; transform: scale(0.9); }
          }
        `;
  }

  render(payload, onAction) {
    this.onActionCallback = onAction; // Lưu callback lại dùng sau
    // 1. Dọn dẹp cũ
    this.remove();

    // 2. Tạo Shadow DOM
    this.container = document.createElement('div');
    this.container.id = 'atom-micro-root';
    this.shadowRoot = this.container.attachShadow({ mode: 'open' });

    // 3. Inject Style & HTML
    const styleTag = document.createElement('style');
    styleTag.textContent = this.styles; // <--- SỬA LẠI THAM CHIẾU Ở ĐÂY

    const wrapper = document.createElement('div');
    wrapper.addEventListener('click', (e) => e.stopPropagation());
    wrapper.className = 'atom-pill';

    wrapper.innerHTML = `
            ${payload.presence?.show_orb ? '<div class="atom-mini-orb"></div>' : ''}
            <span class="atom-text">${payload.text || atomMsg("micro_copy_1")}</span>
            <div class="atom-actions">
                <button class="btn-secondary" id="atom-btn-snooze">
                    ${payload.actions?.find(a => a.id === 'snooze_delay')?.label || atomMsg("btn_snooze")}
                </button>
                <button class="btn-primary" id="atom-btn-stop">
                    ${payload.actions?.find(a => a.id === 'finish_session')?.label || atomMsg("btn_stop_session")}
                </button>
            </div>
        `;

    this.shadowRoot.append(styleTag, wrapper);
    document.body.appendChild(this.container);

    // 4. Animation In
    requestAnimationFrame(() => {
      wrapper.classList.add('visible');
    });
    this.isVisible = true;

    // [NEW] Passive Timeout
    this._startPassiveTimeout();

    // 5. Bind Events
    this._bindEvents(payload);

    // 6. Scroll Detection
    this.shownAt = Date.now();
    this.lockUntil = 0; // [NEW] Hover Lock
    this._startScrollDetection();
  }

  remove() {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener);
      this.scrollListener = null;
    }
    // [FIX] Cleanup Timer
    clearTimeout(this._passiveTimer);
    this.isVisible = false;
  }

  _bindEvents(payload) {
    const btnStop = this.shadowRoot.getElementById('atom-btn-stop');
    const btnSnooze = this.shadowRoot.getElementById('atom-btn-snooze');

    if (btnStop) btnStop.onclick = () => {
      this._sendFeedback('micro_closure', 'finish_session');

      // GỌI CALLBACK ĐỂ CONTENT.JS BIẾT MÀ RESET GIỜ
      if (this.onActionCallback) this.onActionCallback('finish_session');

      this._animateOutAndRemove();
    };

    if (btnSnooze) btnSnooze.onclick = () => {
      this._sendFeedback('micro_closure', 'snooze_delay');

      // GỌI CALLBACK (Optional)
      if (this.onActionCallback) this.onActionCallback('snooze_delay');

      this._animateOutAndRemove();
    };

    // [MỚI] Reset timer khi user tương tác
    if (btnStop) btnStop.addEventListener('click', () => clearTimeout(this._passiveTimer));
    if (btnSnooze) btnSnooze.addEventListener('click', () => clearTimeout(this._passiveTimer));

    // [NEW] Hover Lock Logic
    const pill = this.shadowRoot.querySelector('.atom-pill');
    if (pill) {
      pill.addEventListener('mouseenter', () => {
        this.lockUntil = Date.now() + 2000;
      });
      pill.addEventListener('mouseleave', () => {
        this.lockUntil = Math.max(this.lockUntil, Date.now() + 1200);
      });
    }
  }

  _sendFeedback(interventionType, actionId) {
    // Gửi log về background để học
    try {
      // [FIX 1] Logic mapping actionId sang Event chuẩn của Background
      let eventType = "UNKNOWN";

      if (actionId === 'finish_session') eventType = "COMPLETED";
      else if (actionId === 'snooze_delay') eventType = "SNOOZED";
      else if (actionId === 'FAST_DISMISS_BY_SCROLL') eventType = "IGNORED";
      else if (actionId === 'AUTO_DISMISSED_BY_SCROLL') eventType = "AUTO_DISMISSED";
      else if (actionId === 'TIMEOUT_IGNORED') eventType = "IGNORED_PASSIVE";

      chrome.runtime.sendMessage({
        type: "LOG_REACTION",
        payload: {
          action: eventType,
          type: "MICRO_CLOSURE"
        }
      });
    } catch (e) {
      console.log("ATOM: Extension context invalidated");
    }
  }

  _animateOutAndRemove() {
    const wrapper = this.shadowRoot.querySelector('.atom-pill');
    if (wrapper) {
      wrapper.classList.remove('visible');
      wrapper.classList.add('hiding');
    }
    // [FIX] Cleanup Timer
    clearTimeout(this._passiveTimer);
    setTimeout(() => this.remove(), 500);
  }

  _startPassiveTimeout() {
    clearTimeout(this._passiveTimer);
    this._passiveTimer = setTimeout(() => {
      if (!this.isVisible) return;
      if (document.hidden) return; // [NEW] Don't punish tab switching

      this._sendFeedback('micro_closure', 'TIMEOUT_IGNORED');
      if (this.onActionCallback) this.onActionCallback('TIMEOUT_IGNORED');
      this._animateOutAndRemove();
    }, 12000);
  }

  // [FIX 2] Đổi tên hàm thành _startScrollDetection cho khớp với dòng gọi ở trên (line 144)
  // --- THAY THẾ TOÀN BỘ HÀM _startScrollDetection CŨ BẰNG ĐOẠN NÀY ---

  _startScrollDetection() {
    const PX_THRESHOLD = 600;

    const GRACE_WINDOW_MS = 1000;      // giữ nguyên ý đồ
    const FAST_WINDOW_MS = 1200;       // 1.2s "thực" sau grace
    const FAST_DT_MS = 600;
    const FAST_VELOCITY = 1.4;

    const STOP_DEBOUNCE_MS = 250;
    const pillWrapper = this.shadowRoot.querySelector('.atom-pill');

    let startY = null;
    let startAt = null;
    let stopTimer = null;

    this.scrollListener = () => {
      if (!this.isVisible) return;

      const now = Date.now();
      const sinceShown = now - this.shownAt;

      // ✅ Guard trước: chưa qua grace/hover lock thì KHÔNG "arm" tracking
      if (sinceShown < GRACE_WINDOW_MS) return;
      if (now < this.lockUntil) return;

      const y = window.scrollY;

      // ✅ Chỉ bắt đầu tracking sau khi qua grace
      if (startY == null) {
        startY = y;
        startAt = now;

        if (pillWrapper) {
          pillWrapper.style.transition = 'opacity 0.3s ease';
          pillWrapper.style.opacity = '0.3';
          pillWrapper.style.pointerEvents = 'none';
        }
      }

      const deltaPx = Math.abs(y - startY);
      const dt = Math.max(1, now - startAt);
      const velocity = deltaPx / dt;

      if (deltaPx >= PX_THRESHOLD) {
        window.removeEventListener('scroll', this.scrollListener);
        clearTimeout(stopTimer);
        clearTimeout(this._passiveTimer);

        // ✅ FAST age tính sau grace: cửa sổ FAST = 1.2s kể từ khi "eligible"
        const ageAfterGrace = sinceShown - GRACE_WINDOW_MS;

        const isFast = (ageAfterGrace < FAST_WINDOW_MS) &&
          (dt < FAST_DT_MS || velocity > FAST_VELOCITY);

        const actionId = isFast ? 'FAST_DISMISS_BY_SCROLL' : 'AUTO_DISMISSED_BY_SCROLL';

        console.log(`[ATOM] Scroll Dismiss: ${actionId} (v=${velocity.toFixed(2)}, age=${sinceShown})`);

        this._sendFeedback('micro_closure', actionId);
        if (this.onActionCallback) this.onActionCallback(actionId);
        this._animateOutAndRemove();
        return;
      }

      clearTimeout(stopTimer);
      stopTimer = setTimeout(() => {
        startY = null;
        startAt = null;

        if (pillWrapper) {
          pillWrapper.style.opacity = '1';
          pillWrapper.style.pointerEvents = 'auto';
        }
      }, STOP_DEBOUNCE_MS);
    };

    window.addEventListener('scroll', this.scrollListener, { passive: true });
  }
}

