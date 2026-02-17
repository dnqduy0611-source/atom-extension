// styles/micro_closure.css.js (hoặc khai báo string trong JS)
const microClosureStyles = `
  :host {
    all: initial; /* Reset mọi style thừa kế từ web */
    z-index: 2147483647; /* Max layer */
    position: fixed;
    bottom: 40px;
    left: 50%;
    transform: translateX(-50%);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }

  .atom-pill {
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(28, 28, 30, 0.85); /* Màu tối sang trọng */
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    padding: 8px 8px 8px 16px;
    border-radius: 99px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    
    /* Animation nhập xuất */
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .atom-pill.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .atom-pill.hiding {
    opacity: 0;
    transform: translateY(10px);
    pointer-events: none;
  }

  /* Mini Orb (Đèn hiệu nhỏ) */
  .atom-mini-orb {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #FFD700; /* Màu vàng ATOM */
    box-shadow: 0 0 10px #FFD700;
    animation: pulse 2s infinite;
  }

  .atom-text {
    color: #F2F2F2;
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    margin-right: 4px;
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
    padding: 6px 14px;
    border-radius: 20px;
    transition: transform 0.1s;
  }

  button:active {
    transform: scale(0.95);
  }

  .btn-primary {
    background: #E0E0E0;
    color: #000;
  }
  
  .btn-primary:hover {
    background: #FFFFFF;
  }

  .btn-secondary {
    background: transparent;
    color: #A0A0A0;
    border: 1px solid rgba(255,255,255,0.1);
  }

  .btn-secondary:hover {
    color: #FFF;
    border-color: rgba(255,255,255,0.3);
  }

  @keyframes pulse {
    0% { opacity: 0.6; transform: scale(0.9); }
    50% { opacity: 1; transform: scale(1.1); }
    100% { opacity: 0.6; transform: scale(0.9); }
  }
`;