import { TaskList } from './TaskList';
import { Target, PenLine } from 'lucide-react';
import { useFocusStore } from '../../store/useFocusStore';
import { useSceneIcons } from '../../hooks/useSceneIcons';
import { useTranslation } from '../../hooks/useTranslation';

interface Props {
    onClose: () => void;
}

/**
 * FocusPanel — Tasks + Quick Notes only.
 * Timer controls are now on the HeroTimer (external clock).
 */
export function FocusPanel({ onClose }: Props) {
    const icons = useSceneIcons();
    const { t } = useTranslation();
    const focusNotes = useFocusStore((s) => s.focusNotes);
    const setFocusNotes = useFocusStore((s) => s.setFocusNotes);

    return (
        <div
            className="w-[520px] h-full rounded-2xl backdrop-blur-xl fade-in overflow-hidden flex flex-col"
            style={{
                background: `linear-gradient(160deg, color-mix(in srgb, var(--theme-primary) 12%, rgba(10,10,20,0.55)) 0%, color-mix(in srgb, var(--theme-primary) 6%, rgba(10,10,20,0.6)) 50%, rgba(8,6,15,0.65) 100%)`,
                border: `1px solid color-mix(in srgb, var(--theme-primary) 12%, rgba(255,255,255,0.08))`,
                boxShadow: '0 16px 64px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.1)',
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-7 pt-6 pb-4">
                <div className="w-7" />
                <div className="flex items-center gap-3">
                    <Target size={22} style={{ color: 'var(--theme-primary)' }} />
                    <h3 className="text-lg font-bold tracking-wide" style={{ color: 'var(--theme-text)' }}>
                        {t('focus.title')}
                    </h3>
                </div>
                <button
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                    onClick={onClose}
                >
                    <icons.ui.close size={14} style={{ color: 'var(--theme-text-muted)' }} />
                </button>
            </div>

            {/* Tasks — scrollable */}
            <div className="flex-1 overflow-y-auto px-6 pb-4 fade-in custom-scrollbar">
                <TaskList />
            </div>

            {/* ═══ Quick Notes ═══ */}
            <div
                className="flex flex-col mx-6 mb-6 rounded-xl overflow-hidden"
                style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    minHeight: '120px',
                    maxHeight: '200px',
                }}
            >
                <div
                    className="flex items-center gap-2 px-4 py-3"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                    <PenLine size={13} style={{ color: 'var(--theme-primary)', opacity: 0.8 }} />
                    <span className="text-[12px] font-medium" style={{ color: 'var(--theme-text-muted)' }}>
                        {t('timer.quickNotes')}
                    </span>
                </div>
                <textarea
                    className="flex-1 w-full bg-transparent resize-none px-4 py-3 text-[13px] leading-relaxed outline-none placeholder:text-white/15"
                    style={{ color: 'var(--theme-text)', minHeight: '80px' }}
                    placeholder={t('timer.notesPlaceholder')}
                    value={focusNotes}
                    onChange={(e) => setFocusNotes(e.target.value)}
                    spellCheck={false}
                />
            </div>
        </div>
    );
}
