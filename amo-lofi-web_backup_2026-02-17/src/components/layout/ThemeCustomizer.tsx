import { useLofiStore } from '../../store/useLofiStore';
import { useSceneIcons } from '../../hooks/useSceneIcons';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../hooks/useTranslation';
import { useProGate } from '../../hooks/useProGate';
import { useState, useEffect } from 'react';
import type { ClockStyle } from '../../store/useLofiStore';
import type { TranslationKey } from '../../i18n/en';

/**
 * ThemeCustomizer — Appearance panel, visually consistent with SceneSelector.
 * Same panel bg, border, fonts, header style, 340px width.
 */

const ACCENT_PRESETS = [
    { color: '#00ffd5', name: 'Cyan' },
    { color: '#3b82f6', name: 'Blue' },
    { color: '#8b5cf6', name: 'Violet' },
    { color: '#ec4899', name: 'Pink' },
    { color: '#ef4444', name: 'Red' },
    { color: '#f97316', name: 'Orange' },
    { color: '#f59e0b', name: 'Amber' },
    { color: '#4ade80', name: 'Green' },
    { color: '#14b8a6', name: 'Teal' },
    { color: '#a78bfa', name: 'Lavender' },
];

const CLOCK_STYLES: { id: ClockStyle; labelKey: TranslationKey; fontFamily: string; fontWeight: number }[] = [
    { id: 'classic', labelKey: 'clock.classic', fontFamily: "'Inter', sans-serif", fontWeight: 300 },
    { id: 'serif', labelKey: 'clock.serif', fontFamily: "'Playfair Display', serif", fontWeight: 400 },
    { id: 'bold', labelKey: 'clock.bold', fontFamily: "'Inter', sans-serif", fontWeight: 800 },
    { id: 'soft', labelKey: 'clock.soft', fontFamily: "'Quicksand', sans-serif", fontWeight: 400 },
    { id: 'creative', labelKey: 'clock.creative', fontFamily: "'Caveat', cursive", fontWeight: 400 },
    { id: 'mono', labelKey: 'clock.mono', fontFamily: "'JetBrains Mono', monospace", fontWeight: 400 },
];

interface Props {
    onClose: () => void;
}

export function ThemeCustomizer({ onClose }: Props) {
    const activeVariant = useLofiStore((s) => s.activeVariant);
    const toggleVariant = useLofiStore((s) => s.toggleVariant);
    const customAccent = useLofiStore((s) => s.customAccent);
    const setCustomAccent = useLofiStore((s) => s.setCustomAccent);
    const tintOpacity = useLofiStore((s) => s.tintOpacity);
    const setTintOpacity = useLofiStore((s) => s.setTintOpacity);
    const vignetteEnabled = useLofiStore((s) => s.vignetteEnabled);
    const setVignetteEnabled = useLofiStore((s) => s.setVignetteEnabled);
    const accentGlowEnabled = useLofiStore((s) => s.accentGlowEnabled);
    const setAccentGlowEnabled = useLofiStore((s) => s.setAccentGlowEnabled);
    const clockStyle = useLofiStore((s) => s.clockStyle);
    const setClockStyle = useLofiStore((s) => s.setClockStyle);
    const icons = useSceneIcons();
    const sceneTheme = useTheme();
    const { t } = useTranslation();
    const { isPro, showUpsell } = useProGate();

    // Live clock preview
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);
    const previewTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Build swatches: scene primary first (if different from presets), then presets
    const scenePrimary = sceneTheme.primary;
    const isPreset = ACCENT_PRESETS.some((p) => p.color.toLowerCase() === scenePrimary?.toLowerCase());
    const allSwatches = isPreset
        ? ACCENT_PRESETS
        : [{ color: scenePrimary, name: t('theme.sceneColor') }, ...ACCENT_PRESETS];

    const tintPercent = Math.round(tintOpacity * 100);

    const handleClockStyleClick = (styleId: ClockStyle) => {
        if (styleId === 'classic') {
            setClockStyle(styleId);
        } else if (isPro) {
            setClockStyle(styleId);
        } else {
            showUpsell('clock_style');
        }
    };

    return (
        <div className="fixed inset-0 z-50" onClick={onClose}>
            <div
                className="tc-panel fade-in"
                style={{
                    background: 'var(--theme-panel-bg)',
                    border: `1px solid var(--theme-panel-border)`,
                    boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── Header ── */}
                <div className="tc-header">
                    <h3 className="tc-title" style={{ color: 'var(--theme-text)' }}>
                        {t('theme.appearance')}
                    </h3>
                    <button className="tc-close" onClick={onClose}>
                        <icons.ui.close size={12} style={{ color: 'var(--theme-text-muted)' }} />
                    </button>
                </div>

                <div className="tc-body">
                    {/* ── Mode ── */}
                    <div className="tc-section">
                        <span className="tc-label" style={{ color: 'var(--theme-text-muted)' }}>{t('theme.mode')}</span>
                        <div className="tc-segmented">
                            {(['day', 'night'] as const).map((v) => (
                                <button
                                    key={v}
                                    className={`tc-seg-btn ${activeVariant === v ? 'tc-seg-active' : ''}`}
                                    onClick={() => { if (activeVariant !== v) toggleVariant(); }}
                                >
                                    {v === 'day'
                                        ? <icons.ui.sun size={15} style={{ color: 'inherit' }} />
                                        : <icons.ui.moon size={15} style={{ color: 'inherit' }} />
                                    }
                                    <span>{v === 'day' ? t('theme.day') : t('theme.night')}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── Clock Style ── */}
                    <div className="tc-section">
                        <span className="tc-label" style={{ color: 'var(--theme-text-muted)' }}>{t('theme.clockStyle')}</span>
                        <div className="tc-clock-grid">
                            {CLOCK_STYLES.map((style) => (
                                <button
                                    key={style.id}
                                    className={`tc-clock-card ${clockStyle === style.id ? 'tc-clock-active' : ''}`}
                                    onClick={() => handleClockStyleClick(style.id)}
                                >
                                    <span
                                        className="tc-clock-preview"
                                        style={{
                                            fontFamily: style.fontFamily,
                                            fontWeight: style.fontWeight,
                                        }}
                                    >
                                        {previewTime}
                                    </span>
                                    <span className="tc-clock-label">
                                        {t(style.labelKey)}
                                        {style.id !== 'classic' && !isPro && (
                                            <span className="tc-clock-crown">👑</span>
                                        )}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── Accent ── */}
                    <div className="tc-section">
                        <div className="tc-label-row">
                            <span className="tc-label" style={{ color: 'var(--theme-text-muted)' }}>{t('theme.accentColor')}</span>
                            {customAccent && (
                                <button className="tc-reset" onClick={() => setCustomAccent(null)}>
                                    {t('theme.reset')}
                                </button>
                            )}
                        </div>
                        <div className="tc-swatches">
                            {allSwatches.map((p) => (
                                <button
                                    key={p.color}
                                    className={`tc-swatch ${customAccent === p.color ? 'tc-swatch-active' : ''} ${p.name === 'Scene' ? 'tc-swatch-scene' : ''}`}
                                    style={{ '--swatch': p.color } as React.CSSProperties}
                                    title={p.name === t('theme.sceneColor') ? t('theme.sceneColor') : p.name}
                                    onClick={() => setCustomAccent(customAccent === p.color ? null : p.color)}
                                />
                            ))}
                        </div>
                    </div>

                    {/* ── Tint ── */}
                    <div className="tc-section">
                        <div className="tc-label-row">
                            <span className="tc-label" style={{ color: 'var(--theme-text-muted)' }}>{t('theme.overlayTint')}</span>
                            <span className="tc-value" style={{ color: 'var(--theme-text-muted)' }}>{tintPercent}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={tintPercent}
                            onChange={(e) => setTintOpacity(Number(e.target.value) / 100)}
                            className="tc-slider"
                            style={{ '--fill': `${tintPercent}%` } as React.CSSProperties}
                        />
                    </div>

                    {/* ── Toggles ── */}
                    <div className="tc-toggles">
                        <div className="tc-toggle-row">
                            <div className="tc-toggle-info">
                                <span className="tc-toggle-label" style={{ color: 'var(--theme-text)' }}>{t('theme.vignette')}</span>
                                <span className="tc-toggle-desc" style={{ color: 'var(--theme-text-muted)' }}>{t('theme.vignetteDesc')}</span>
                            </div>
                            <button
                                className={`tc-switch ${vignetteEnabled ? 'tc-switch-on' : ''}`}
                                onClick={() => setVignetteEnabled(!vignetteEnabled)}
                            >
                                <div className="tc-switch-thumb" />
                            </button>
                        </div>
                        <div className="tc-toggle-sep" style={{ background: 'var(--theme-panel-border)' }} />
                        <div className="tc-toggle-row">
                            <div className="tc-toggle-info">
                                <span className="tc-toggle-label" style={{ color: 'var(--theme-text)' }}>{t('theme.accentGlow')}</span>
                                <span className="tc-toggle-desc" style={{ color: 'var(--theme-text-muted)' }}>{t('theme.accentGlowDesc')}</span>
                            </div>
                            <button
                                className={`tc-switch ${accentGlowEnabled ? 'tc-switch-on' : ''}`}
                                onClick={() => setAccentGlowEnabled(!accentGlowEnabled)}
                            >
                                <div className="tc-switch-thumb" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .tc-panel {
                    position: absolute;
                    left: 68px;
                    bottom: 60px;
                    width: 340px;
                    max-height: calc(100vh - 80px);
                    overflow-y: auto;
                    border-radius: 16px;
                    backdrop-filter: blur(24px) saturate(1.4);
                    animation: tcIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                    font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
                }
                .tc-panel::-webkit-scrollbar { width: 4px; }
                .tc-panel::-webkit-scrollbar-track { background: transparent; }
                .tc-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
                @keyframes tcIn {
                    from { opacity: 0; transform: translateY(8px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }

                /* Header */
                .tc-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 18px 20px 14px;
                }
                .tc-title {
                    font-size: 15px;
                    font-weight: 600;
                    letter-spacing: 0.2px;
                    margin: 0;
                }
                .tc-close {
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 8px;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    transition: background 0.15s;
                }
                .tc-close:hover { background: rgba(255,255,255,0.08); }

                .tc-body { padding: 0 20px 20px; }

                .tc-section { margin-bottom: 20px; }
                .tc-section:last-child { margin-bottom: 0; }

                .tc-label {
                    font-size: 13px;
                    font-weight: 500;
                }
                .tc-label-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 10px;
                }
                .tc-value {
                    font-size: 13px;
                    font-weight: 500;
                    font-variant-numeric: tabular-nums;
                }
                .tc-reset {
                    font-size: 12px;
                    font-weight: 500;
                    color: var(--theme-primary);
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 0;
                    opacity: 0.7;
                    transition: opacity 0.15s;
                }
                .tc-reset:hover { opacity: 1; }

                /* Segmented control */
                .tc-segmented {
                    display: flex;
                    gap: 2px;
                    background: rgba(255, 255, 255, 0.04);
                    border-radius: 12px;
                    padding: 3px;
                    margin-top: 10px;
                }
                .tc-seg-btn {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 7px;
                    padding: 10px 0;
                    font-size: 13px;
                    font-weight: 500;
                    color: rgba(255, 255, 255, 0.35);
                    background: transparent;
                    border: none;
                    border-radius: 10px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .tc-seg-btn:hover { color: rgba(255, 255, 255, 0.55); }
                .tc-seg-active {
                    background: rgba(255, 255, 255, 0.08) !important;
                    color: var(--theme-primary) !important;
                }

                /* ── Clock Style Grid ── */
                .tc-clock-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 8px;
                    margin-top: 10px;
                }
                .tc-clock-card {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 6px;
                    padding: 12px 4px 8px;
                    border-radius: 10px;
                    background: rgba(255, 255, 255, 0.04);
                    border: 1.5px solid transparent;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .tc-clock-card:hover {
                    background: rgba(255, 255, 255, 0.07);
                    border-color: rgba(255, 255, 255, 0.1);
                }
                .tc-clock-active {
                    border-color: var(--theme-primary) !important;
                    background: rgba(255, 255, 255, 0.06) !important;
                    box-shadow: 0 0 12px color-mix(in srgb, var(--theme-primary) 25%, transparent);
                }
                .tc-clock-preview {
                    font-size: 18px;
                    color: rgba(255, 255, 255, 0.85);
                    line-height: 1;
                    letter-spacing: 1px;
                }
                .tc-clock-label {
                    font-size: 10px;
                    font-weight: 500;
                    color: rgba(255, 255, 255, 0.4);
                    display: flex;
                    align-items: center;
                    gap: 3px;
                }
                .tc-clock-active .tc-clock-label {
                    color: var(--theme-primary);
                }
                .tc-clock-crown {
                    font-size: 9px;
                    filter: grayscale(0.3);
                }

                /* Color swatches */
                .tc-swatches {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                }
                .tc-swatch {
                    width: 28px;
                    height: 28px;
                    border-radius: 8px;
                    border: none;
                    cursor: pointer;
                    background: var(--swatch);
                    transition: all 0.15s;
                    position: relative;
                    box-shadow: inset 0 0 0 1px rgba(0,0,0,0.15);
                }
                .tc-swatch:hover {
                    transform: scale(1.12);
                    box-shadow: 0 0 14px color-mix(in srgb, var(--swatch) 50%, transparent);
                }
                .tc-swatch-active {
                    transform: scale(1.12);
                    box-shadow:
                        0 0 0 2px rgba(18, 18, 24, 0.95),
                        0 0 0 3.5px var(--swatch),
                        0 0 16px color-mix(in srgb, var(--swatch) 40%, transparent) !important;
                }
                .tc-swatch-scene {
                    position: relative;
                }
                .tc-swatch-scene::after {
                    content: '✦';
                    position: absolute;
                    bottom: -3px;
                    right: -3px;
                    font-size: 9px;
                    line-height: 1;
                    color: var(--swatch);
                    filter: drop-shadow(0 0 2px rgba(0,0,0,0.8));
                }

                /* Slider */
                .tc-slider {
                    -webkit-appearance: none;
                    width: 100%;
                    height: 5px;
                    border-radius: 3px;
                    outline: none;
                    background: linear-gradient(
                        to right,
                        var(--theme-primary) var(--fill),
                        rgba(255, 255, 255, 0.08) var(--fill)
                    );
                    cursor: pointer;
                }
                .tc-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: #fff;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.1);
                    cursor: pointer;
                    transition: transform 0.1s;
                }
                .tc-slider::-webkit-slider-thumb:hover { transform: scale(1.15); }
                .tc-slider::-moz-range-thumb {
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: #fff;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.4);
                    cursor: pointer;
                    border: none;
                }

                /* Toggles */
                .tc-toggles {
                    display: flex;
                    flex-direction: column;
                    gap: 0;
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 12px;
                    padding: 4px 0;
                }
                .tc-toggle-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 10px 14px;
                }
                .tc-toggle-sep {
                    height: 1px;
                    margin: 0 14px;
                }
                .tc-toggle-info {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .tc-toggle-label {
                    font-size: 13px;
                    font-weight: 500;
                }
                .tc-toggle-desc {
                    font-size: 11px;
                    opacity: 0.6;
                }
                .tc-switch {
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
                .tc-switch-on {
                    background: var(--theme-primary);
                }
                .tc-switch-thumb {
                    position: absolute;
                    top: 2px;
                    left: 2px;
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: #fff;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                    transition: left 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .tc-switch-on .tc-switch-thumb {
                    left: 20px;
                }
            `}</style>
        </div>
    );
}
