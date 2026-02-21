/**
 * SuggestionChips — Clickable suggestion chips for Amo Agent.
 *
 * Renders below the chat input to help users discover Agent capabilities.
 * Glassmorphism styling consistent with MoodCompanion UI.
 */

import type { CSSProperties } from 'react';

interface SuggestionChipsProps {
    chips: string[];
    onChipClick: (text: string) => void;
    disabled?: boolean;
}

export function SuggestionChips({ chips, onChipClick, disabled }: SuggestionChipsProps) {
    if (!chips || chips.length === 0) return null;

    return (
        <div style={styles.container}>
            {chips.map((chip) => (
                <button
                    key={chip}
                    onClick={() => onChipClick(chip)}
                    disabled={disabled}
                    style={{
                        ...styles.chip,
                        opacity: disabled ? 0.4 : 1,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                    }}
                    className="mood-chip"
                >
                    {chip}
                </button>
            ))}
        </div>
    );
}

const styles: Record<string, CSSProperties> = {
    container: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        padding: '6px 12px 4px',
    },
    chip: {
        padding: '5px 12px',
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(255,255,255,0.06)',
        color: 'rgba(255,255,255,0.65)',
        fontSize: 12,
        fontWeight: 500,
        transition: 'all 0.2s ease',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
    },
};

export default SuggestionChips;
