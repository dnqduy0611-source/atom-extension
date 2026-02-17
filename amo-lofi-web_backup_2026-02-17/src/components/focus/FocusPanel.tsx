import { useState } from 'react';
import { PomodoroTimer } from './PomodoroTimer';
import { TaskList } from './TaskList';
import { Target } from 'lucide-react';
import { useSceneIcons } from '../../hooks/useSceneIcons';
import { useTranslation } from '../../hooks/useTranslation';
import type { FC } from 'react';
import type { IconProps } from '../../icons/types';

type Tab = 'timer' | 'tasks';

interface Props {
    onClose: () => void;
}

export function FocusPanel({ onClose }: Props) {
    const [activeTab, setActiveTab] = useState<Tab>('timer');
    const icons = useSceneIcons();
    const { t } = useTranslation();

    const TABS: { id: Tab; label: string; Icon: FC<IconProps> }[] = [
        { id: 'timer', label: t('focus.timer'), Icon: icons.ui.timer },
        { id: 'tasks', label: t('focus.tasks'), Icon: icons.ui.tasks },
    ];

    return (
        <div
            className="w-[480px] h-full rounded-2xl backdrop-blur-xl fade-in overflow-hidden flex flex-col"
            style={{
                background: 'var(--theme-panel-bg)',
                border: `1px solid var(--theme-panel-border)`,
                boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
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

            {/* Tabs */}
            <div
                className="flex mx-5 mb-4 rounded-xl p-1.5"
                style={{ background: 'rgba(255,255,255,0.04)' }}
            >
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg
                            text-[14px] font-medium cursor-pointer transition-all duration-200"
                        style={{
                            background: activeTab === tab.id
                                ? 'color-mix(in srgb, var(--theme-primary) 15%, transparent)'
                                : 'transparent',
                            color: activeTab === tab.id
                                ? 'var(--theme-primary)'
                                : 'var(--theme-text-muted)',
                        }}
                    >
                        <tab.Icon size={16} />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab content — scrollable */}
            <div className="flex-1 overflow-y-auto px-5 pb-5 fade-in custom-scrollbar">
                {activeTab === 'timer' && <PomodoroTimer />}
                {activeTab === 'tasks' && <TaskList />}
            </div>
        </div>
    );
}
