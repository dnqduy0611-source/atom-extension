import { useState, useRef, useEffect } from 'react';
import { useLofiStore } from '../../store/useLofiStore';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * QuickSettings — Gear icon dropdown at top-right corner.
 * Toggles for showing/hiding HUD components.
 */
export function QuickSettings() {
    const [open, setOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation();

    const showClock = useLofiStore((s) => s.showClock);
    const use24hFormat = useLofiStore((s) => s.use24hFormat);
    const showDate = useLofiStore((s) => s.showDate);
    const showPlayerBar = useLofiStore((s) => s.showPlayerBar);
    const showBranding = useLofiStore((s) => s.showBranding);

    const setShowClock = useLofiStore((s) => s.setShowClock);
    const setUse24hFormat = useLofiStore((s) => s.setUse24hFormat);
    const setShowDate = useLofiStore((s) => s.setShowDate);
    const setShowPlayerBar = useLofiStore((s) => s.setShowPlayerBar);
    const setShowBranding = useLofiStore((s) => s.setShowBranding);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const toggles = [
        { label: t('qs.clock'), desc: t('qs.clockDesc'), value: showClock, set: setShowClock },
        { label: t('qs.format24h'), desc: t('qs.format24hDesc'), value: use24hFormat, set: setUse24hFormat },
        { label: t('qs.showDate'), desc: t('qs.showDateDesc'), value: showDate, set: setShowDate },
        { label: t('qs.playerBar'), desc: t('qs.playerBarDesc'), value: showPlayerBar, set: setShowPlayerBar },
        { label: t('qs.branding'), desc: t('qs.brandingDesc'), value: showBranding, set: setShowBranding },
    ];

    return (
        <div ref={panelRef} className="relative">
            {/* Gear button */}
            <button
                className="qs-gear-btn"
                onClick={() => setOpen(!open)}
                title={t('qs.title')}
                style={open ? {
                    background: 'rgba(255,255,255,0.12)',
                } : undefined}
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
            </button>

            {/* Dropdown panel */}
            {open && (
                <div className="qs-panel">
                    <div className="qs-header">
                        <span className="qs-title">{t('qs.title')}</span>
                    </div>
                    <div className="qs-body">
                        {toggles.map((item, i) => (
                            <div key={i}>
                                <div className="qs-row">
                                    <div className="qs-info">
                                        <span className="qs-label">{item.label}</span>
                                        <span className="qs-desc">{item.desc}</span>
                                    </div>
                                    <button
                                        className={`qs-switch ${item.value ? 'qs-switch-on' : ''}`}
                                        onClick={() => item.set(!item.value)}
                                    >
                                        <div className="qs-switch-thumb" />
                                    </button>
                                </div>
                                {i < toggles.length - 1 && <div className="qs-sep" />}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <style>{`
                .qs-gear-btn {
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 12px;
                    background: rgba(0, 0, 0, 0.35);
                    backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .qs-gear-btn:hover {
                    background: rgba(255, 255, 255, 0.12);
                    border-color: rgba(255, 255, 255, 0.15);
                }
                .qs-gear-btn:hover svg {
                    stroke: rgba(255, 255, 255, 0.9);
                }

                .qs-panel {
                    position: absolute;
                    top: calc(100% + 8px);
                    right: 0;
                    width: 280px;
                    border-radius: 16px;
                    background: rgba(18, 18, 24, 0.92);
                    backdrop-filter: blur(24px) saturate(1.4);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5);
                    animation: qsIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                    font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
                    overflow: hidden;
                }
                @keyframes qsIn {
                    from { opacity: 0; transform: translateY(-4px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }

                .qs-header {
                    padding: 14px 16px 10px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
                }
                .qs-title {
                    font-size: 13px;
                    font-weight: 600;
                    color: rgba(255, 255, 255, 0.9);
                    letter-spacing: 0.2px;
                }

                .qs-body {
                    padding: 6px 0;
                }

                .qs-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 10px 16px;
                }
                .qs-sep {
                    height: 1px;
                    margin: 0 16px;
                    background: rgba(255, 255, 255, 0.04);
                }
                .qs-info {
                    display: flex;
                    flex-direction: column;
                    gap: 1px;
                }
                .qs-label {
                    font-size: 13px;
                    font-weight: 500;
                    color: rgba(255, 255, 255, 0.85);
                }
                .qs-desc {
                    font-size: 11px;
                    color: rgba(255, 255, 255, 0.35);
                }

                .qs-switch {
                    width: 40px;
                    height: 22px;
                    border-radius: 11px;
                    background: rgba(255, 255, 255, 0.1);
                    border: none;
                    cursor: pointer;
                    position: relative;
                    transition: background 0.2s;
                    padding: 0;
                    flex-shrink: 0;
                }
                .qs-switch-on {
                    background: var(--theme-primary, #4ade80);
                }
                .qs-switch-thumb {
                    position: absolute;
                    top: 2px;
                    left: 2px;
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: #fff;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
                    transition: left 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .qs-switch-on .qs-switch-thumb {
                    left: 20px;
                }
            `}</style>
        </div>
    );
}
