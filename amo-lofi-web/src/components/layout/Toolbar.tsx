import { useLofiStore } from '../../store/useLofiStore';
import { scenes } from '../../data/scenes';
import { moodPresets } from '../../data/moodPresets';

const SCENE_EMOJIS: Record<string, string> = {
    cozy_cafe: '☕',
    japanese_garden: '🌸',
    city_night: '🌃',
    forest_cabin: '🏕️',
    ocean_cliff: '🌊',
    space_station: '🚀',
};

export function Toolbar() {
    const activeSceneId = useLofiStore((s) => s.activeSceneId);
    const activeVariant = useLofiStore((s) => s.activeVariant);
    const activePanel = useLofiStore((s) => s.activePanel);
    const zenMode = useLofiStore((s) => s.zenMode);
    const togglePanel = useLofiStore((s) => s.togglePanel);
    const toggleVariant = useLofiStore((s) => s.toggleVariant);
    const toggleZenMode = useLofiStore((s) => s.toggleZenMode);
    const applyConfig = useLofiStore((s) => s.applyConfig);

    const activeScene = scenes.find((s) => s.id === activeSceneId);

    if (zenMode) {
        return (
            <div className="absolute top-4 right-4 z-20 fade-in">
                <button
                    className="icon-btn glass-panel-sm !w-auto px-3 py-2 text-xs opacity-30 hover:opacity-100 transition-opacity"
                    onClick={toggleZenMode}
                    title="Exit Zen Mode (Z)"
                >
                    Exit Zen
                </button>
            </div>
        );
    }

    return (
        <div className="absolute top-0 left-0 right-0 z-20 p-4">
            <div className="flex items-start justify-between">
                {/* ── Left: Logo + Scene Info ── */}
                <div className="flex items-center gap-3">
                    {/* Logo */}
                    <div className="flex items-center gap-2 glass-panel-sm px-3 py-2">
                        <img src="/amo-icon.png" alt="AmoLofi" width={20} height={20} className="rounded-full" style={{ filter: 'drop-shadow(0 0 4px rgba(74,222,128,0.4))' }} />
                        <span className="text-sm font-semibold bg-gradient-to-r from-[var(--amo-primary)] to-[var(--amo-accent)] bg-clip-text text-transparent">
                            Amo Lofi
                        </span>
                    </div>

                    {/* Scene badge */}
                    <button
                        className={`glass-panel-sm px-3 py-2 flex items-center gap-2 cursor-pointer
                        transition-all duration-200 hover:border-[var(--amo-border-hover)]
                        ${activePanel === 'scenes' ? 'border-[var(--amo-primary)] !bg-[rgba(74,222,128,0.05)]' : ''}`}
                        onClick={() => togglePanel('scenes')}
                        title="Change scene (S)"
                    >
                        <span className="text-base">{SCENE_EMOJIS[activeSceneId] ?? '🎵'}</span>
                        <div className="text-left">
                            <div className="text-xs font-medium">{activeScene?.name}</div>
                            <div className="text-[10px] text-[var(--amo-text-muted)]">
                                {activeVariant === 'day' ? '☀️ Day' : '🌙 Night'}
                            </div>
                        </div>
                    </button>
                </div>

                {/* ── Center: Mood Presets ── */}
                <div className="hidden md:flex gap-1.5 glass-panel-sm px-2 py-1.5">
                    {moodPresets.map((preset) => (
                        <button
                            key={preset.id}
                            className={`mood-chip text-xs ${activeSceneId === preset.config.scene_id ? 'active' : ''
                                }`}
                            onClick={() => applyConfig(preset.config)}
                            title={preset.description}
                        >
                            {preset.emoji} {preset.name}
                        </button>
                    ))}
                </div>

                {/* ── Right: Controls ── */}
                <div className="flex items-center gap-1.5">
                    <button
                        className={`icon-btn glass-panel-sm ${activePanel === 'mixer' ? 'active' : ''}`}
                        onClick={() => togglePanel('mixer')}
                        title="Ambience mixer (M)"
                    >
                        🎚️
                    </button>
                    <button
                        className={`icon-btn glass-panel-sm ${activePanel === 'focus' ? 'active' : ''}`}
                        onClick={() => togglePanel('focus')}
                        title="Focus tools (F)"
                    >
                        ⏱️
                    </button>
                    <button
                        className="icon-btn glass-panel-sm"
                        onClick={toggleVariant}
                        title="Day/Night (D)"
                    >
                        {activeVariant === 'day' ? '☀️' : '🌙'}
                    </button>
                    <button
                        className="icon-btn glass-panel-sm"
                        onClick={toggleZenMode}
                        title="Zen Mode (Z)"
                    >
                        🧘
                    </button>
                </div>
            </div>
        </div>
    );
}
