import { useState } from 'react';
import { useLofiStore } from '../../store/useLofiStore';
import { useSceneIcons } from '../../hooks/useSceneIcons';
import { useProGate } from '../../hooks/useProGate';
import { useTranslation } from '../../hooks/useTranslation';
import { ThemeCustomizer } from './ThemeCustomizer';

/**
 * Sidebar — Scene-themed, auto-hidden, hover-revealed.
 * Beeziee-sized: 52px pill, 44px buttons, 20px icons.
 * SVG icons via useSceneIcons() — auto-change with scene.
 */
export function Sidebar() {
    const [hovered, setHovered] = useState(false);
    const [showCustomizer, setShowCustomizer] = useState(false);
    const activePanel = useLofiStore((s) => s.activePanel);
    const activeVariant = useLofiStore((s) => s.activeVariant);
    const zenMode = useLofiStore((s) => s.zenMode);
    const togglePanel = useLofiStore((s) => s.togglePanel);
    const toggleZenMode = useLofiStore((s) => s.toggleZenMode);
    const accentGlowEnabled = useLofiStore((s) => s.accentGlowEnabled);
    const icons = useSceneIcons();
    const { isPro, showUpsell } = useProGate();
    const { t, cycleLocale, localeInfo } = useTranslation();

    if (zenMode) return null;

    const items = [
        { id: 'scenes' as const, Icon: icons.ui.scenes, label: t('sidebar.scenes'), shortcut: 'S', proOnly: false },
        { id: 'mixer' as const, Icon: icons.ui.music, label: t('sidebar.mixer'), shortcut: 'M', proOnly: false },
        { id: 'focus' as const, Icon: icons.ui.focus, label: t('sidebar.focus'), shortcut: 'F', proOnly: false },
        { id: 'stats' as const, Icon: icons.ui.stats, label: t('sidebar.stats'), shortcut: 'R', proOnly: true },
    ];

    const ICON = 20;
    const LOGO_ICON = 22;

    return (
        <>
            {/* Hover trigger zone */}
            <div
                className="fixed left-0 top-0 bottom-0 w-[72px] z-40"
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
            >
                {/* Sidebar pill */}
                <div
                    className={`
                        absolute left-3 top-1/2 -translate-y-1/2
                        flex flex-col items-center gap-1.5 py-4 px-2
                        rounded-2xl transition-all duration-300
                        ${hovered || activePanel
                            ? 'opacity-100 translate-x-0 backdrop-blur-xl shadow-2xl'
                            : 'opacity-0 -translate-x-4'
                        }
                    `}
                    style={{
                        background: hovered || activePanel ? 'var(--theme-sidebar-bg)' : 'transparent',
                        borderWidth: 1,
                        borderStyle: 'solid',
                        borderColor: hovered || activePanel ? 'var(--theme-panel-border)' : 'transparent',
                        boxShadow: hovered || activePanel
                            ? '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)'
                            : 'none',
                    }}
                >
                    {/* Logo */}
                    <div className="w-11 h-11 flex items-center justify-center mb-0.5" title="Amo Lofi">
                        <icons.ui.music size={LOGO_ICON} style={{ color: 'var(--theme-primary)' }} />
                    </div>

                    <div className="w-8 h-px mb-0.5" style={{ background: 'var(--theme-panel-border)' }} />

                    {/* Panel toggles */}
                    {items.map((item) => (
                        <button
                            key={item.id}
                            className={`
                                group relative w-11 h-11 flex items-center justify-center rounded-xl
                                transition-all duration-200 cursor-pointer
                                ${activePanel === item.id
                                    ? ''
                                    : 'hover:bg-white/10 hover:scale-[1.08]'
                                }
                            `}
                            style={activePanel === item.id ? {
                                background: 'color-mix(in srgb, var(--theme-primary) 20%, transparent)',
                                boxShadow: accentGlowEnabled
                                    ? `0 0 16px var(--theme-primary-glow), inset 0 0 8px color-mix(in srgb, var(--theme-primary) 10%, transparent)`
                                    : 'none',
                                transform: 'scale(1.05)',
                            } : undefined}
                            onClick={() => {
                                if (item.proOnly && !isPro) {
                                    showUpsell(item.id);
                                    return;
                                }
                                togglePanel(item.id);
                            }}
                            title={`${item.label} (${item.shortcut})${item.proOnly && !isPro ? ' — Pro' : ''}`}
                        >
                            <item.Icon
                                size={ICON}
                                style={{
                                    color: activePanel === item.id
                                        ? 'var(--theme-primary)'
                                        : item.proOnly && !isPro
                                            ? 'var(--theme-text-muted)'
                                            : 'var(--theme-text-muted)',
                                }}
                            />
                            {/* Pro badge */}
                            {item.proOnly && !isPro && (
                                <span className="absolute -top-0.5 -right-0.5 text-[8px] leading-none">👑</span>
                            )}

                            {/* Tooltip */}
                            <span
                                className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap
                                    opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200"
                                style={{
                                    background: 'var(--theme-panel-bg)',
                                    color: 'var(--theme-text)',
                                    border: `1px solid var(--theme-panel-border)`,
                                }}
                            >
                                {item.label} <kbd className="ml-1 text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>{item.shortcut}</kbd>
                            </span>
                        </button>
                    ))}

                    <div className="w-8 h-px my-0.5" style={{ background: 'var(--theme-panel-border)' }} />

                    {/* Theme Customizer button */}
                    <button
                        className={`w-11 h-11 flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer group relative ${showCustomizer ? '' : 'hover:bg-white/10 hover:scale-[1.08]'}`}
                        style={showCustomizer ? {
                            background: 'color-mix(in srgb, var(--theme-primary) 20%, transparent)',
                            boxShadow: accentGlowEnabled
                                ? `0 0 16px var(--theme-primary-glow), inset 0 0 8px color-mix(in srgb, var(--theme-primary) 10%, transparent)`
                                : 'none',
                            transform: 'scale(1.05)',
                        } : undefined}
                        onClick={() => setShowCustomizer(!showCustomizer)}
                        title={`${t('sidebar.customize')} (D)`}
                    >
                        {activeVariant === 'day'
                            ? <icons.ui.sun size={ICON} style={{ color: showCustomizer ? 'var(--theme-primary)' : 'var(--theme-text-muted)' }} />
                            : <icons.ui.moon size={ICON} style={{ color: showCustomizer ? 'var(--theme-primary)' : 'var(--theme-text-muted)' }} />
                        }
                        <span
                            className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap
                                opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200"
                            style={{
                                background: 'var(--theme-panel-bg)',
                                color: 'var(--theme-text)',
                                border: `1px solid var(--theme-panel-border)`,
                            }}
                        >
                            {t('sidebar.customize')} <kbd className="ml-1 text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>D</kbd>
                        </span>
                    </button>

                    {/* Zen mode */}
                    <button
                        className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-white/10 hover:scale-[1.08] transition-all duration-200 cursor-pointer group relative"
                        onClick={toggleZenMode}
                        title={`${t('sidebar.zen')} (Z)`}
                    >
                        <icons.ui.zen size={ICON} style={{ color: 'var(--theme-text-muted)' }} />
                        <span
                            className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap
                                opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200"
                            style={{
                                background: 'var(--theme-panel-bg)',
                                color: 'var(--theme-text)',
                                border: `1px solid var(--theme-panel-border)`,
                            }}
                        >
                            {t('sidebar.zen')} <kbd className="ml-1 text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>Z</kbd>
                        </span>
                    </button>

                    {/* Fullscreen */}
                    <button
                        className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-white/10 hover:scale-[1.08] transition-all duration-200 cursor-pointer group relative"
                        onClick={() => {
                            if (document.fullscreenElement) {
                                document.exitFullscreen();
                            } else {
                                document.documentElement.requestFullscreen();
                            }
                        }}
                        title={t('sidebar.fullscreen')}
                    >
                        <icons.ui.fullscreen size={ICON} style={{ color: 'var(--theme-text-muted)' }} />
                        <span
                            className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap
                                opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200"
                            style={{
                                background: 'var(--theme-panel-bg)',
                                color: 'var(--theme-text)',
                                border: `1px solid var(--theme-panel-border)`,
                            }}
                        >
                            {t('sidebar.fullscreen')}
                        </span>
                    </button>

                    {/* ── Language Switcher ── */}
                    <button
                        className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-white/10 hover:scale-[1.08] transition-all duration-200 cursor-pointer group relative"
                        onClick={cycleLocale}
                        title={`${t('sidebar.language')} — ${localeInfo.label}`}
                    >
                        <span className="text-[16px] leading-none">{localeInfo.flag}</span>
                        <span
                            className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap
                                opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200"
                            style={{
                                background: 'var(--theme-panel-bg)',
                                color: 'var(--theme-text)',
                                border: `1px solid var(--theme-panel-border)`,
                            }}
                        >
                            {localeInfo.label}
                        </span>
                    </button>
                </div>
            </div >

            {/* Theme Customizer Popover */}
            {
                showCustomizer && (
                    <ThemeCustomizer onClose={() => setShowCustomizer(false)} />
                )
            }
        </>
    );
}
