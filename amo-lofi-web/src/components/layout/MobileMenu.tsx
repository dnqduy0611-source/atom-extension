import { useState } from 'react';
import { useLofiStore } from '../../store/useLofiStore';
import { useSceneIcons } from '../../hooks/useSceneIcons';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * MobileMenu — Hamburger icon → slide-up menu for mobile.
 * Replaces the hover sidebar on touch devices (<640px).
 */

const ICON = 20;

export function MobileMenu() {
    const [open, setOpen] = useState(false);
    const togglePanel = useLofiStore((s) => s.togglePanel);
    const activePanel = useLofiStore((s) => s.activePanel);
    const activeVariant = useLofiStore((s) => s.activeVariant);
    const setVariant = useLofiStore((s) => s.setVariant);
    const icons = useSceneIcons();
    const { t } = useTranslation();

    const menuItems = [
        { id: 'scenes' as const, label: t('sidebar.scenes'), Icon: icons.ui.scenes },
        { id: 'mixer' as const, label: t('sidebar.mixer'), Icon: icons.ui.music },
        { id: 'focus' as const, label: t('sidebar.focus'), Icon: icons.ui.focus },
        { id: 'stats' as const, label: t('sidebar.stats'), Icon: icons.ui.stats },
    ];

    const handleItem = (id: typeof menuItems[number]['id']) => {
        togglePanel(id);
        setOpen(false);
    };

    return (
        <>
            {/* Hamburger button — hidden on desktop, shown on mobile via CSS */}
            <button
                className="mobile-menu-btn hidden fixed top-4 left-4 z-50 w-11 h-11 items-center justify-center rounded-xl backdrop-blur-xl cursor-pointer transition-all duration-200"
                style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.1)',
                }}
                onClick={() => setOpen(!open)}
            >
                {open ? (
                    <icons.ui.close size={ICON} color="white" />
                ) : (
                    <svg width={ICON} height={ICON} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round">
                        <line x1="3" y1="6" x2="21" y2="6" />
                        <line x1="3" y1="12" x2="21" y2="12" />
                        <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                )}
            </button>

            {/* Overlay + Menu */}
            {open && (
                <>
                    <div
                        className="fixed inset-0 z-40 bg-black/40"
                        onClick={() => setOpen(false)}
                    />
                    <div
                        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl backdrop-blur-xl p-4 pb-8"
                        style={{
                            background: 'var(--theme-panel-bg)',
                            border: '1px solid var(--theme-panel-border)',
                            borderBottom: 'none',
                            animation: 'bottomSheetIn 300ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
                        }}
                    >
                        {/* Drag handle */}
                        <div className="flex justify-center mb-4">
                            <div className="w-10 h-1 rounded-full bg-white/20" />
                        </div>

                        {/* Menu grid */}
                        <div className="grid grid-cols-4 gap-3">
                            {menuItems.map((item) => {
                                const isActive = activePanel === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        className="flex flex-col items-center gap-2 py-3 rounded-xl transition-all cursor-pointer"
                                        style={{
                                            background: isActive
                                                ? 'color-mix(in srgb, var(--theme-primary) 15%, transparent)'
                                                : 'rgba(255,255,255,0.04)',
                                            border: isActive
                                                ? '1px solid color-mix(in srgb, var(--theme-primary) 30%, transparent)'
                                                : '1px solid rgba(255,255,255,0.06)',
                                        }}
                                        onClick={() => handleItem(item.id)}
                                    >
                                        <item.Icon
                                            size={22}
                                            style={{
                                                color: isActive ? 'var(--theme-primary)' : 'var(--theme-text-muted)',
                                            }}
                                        />
                                        <span
                                            className="text-[11px] font-medium"
                                            style={{
                                                color: isActive ? 'var(--theme-primary)' : 'var(--theme-text-muted)',
                                            }}
                                        >
                                            {item.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Day/Night toggle */}
                        <div className="flex items-center justify-center gap-3 mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <button
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-medium cursor-pointer transition-all"
                                style={{
                                    background: activeVariant === 'day'
                                        ? 'color-mix(in srgb, var(--theme-primary) 12%, transparent)'
                                        : 'rgba(255,255,255,0.04)',
                                    color: activeVariant === 'day' ? 'var(--theme-primary)' : 'var(--theme-text-muted)',
                                }}
                                onClick={() => setVariant('day')}
                            >
                                ☀️ Day
                            </button>
                            <button
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-medium cursor-pointer transition-all"
                                style={{
                                    background: activeVariant === 'night'
                                        ? 'color-mix(in srgb, var(--theme-primary) 12%, transparent)'
                                        : 'rgba(255,255,255,0.04)',
                                    color: activeVariant === 'night' ? 'var(--theme-primary)' : 'var(--theme-text-muted)',
                                }}
                                onClick={() => setVariant('night')}
                            >
                                🌙 Night
                            </button>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
