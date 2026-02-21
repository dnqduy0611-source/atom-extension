/**
 * useMoodCompanion — DEPRECATED backward compatibility wrapper.
 *
 * Re-exports useAmoAgent as useMoodCompanion to avoid breaking existing imports.
 * New code should import from useAmoAgent directly.
 *
 * @deprecated Use useAmoAgent instead
 */

import { useAmoAgent } from './useAmoAgent';
import type { AgentMessage, AgentPhase, SceneConcept } from '../types/agent';

// Re-export types with old names for backward compat
export type MoodMessage = AgentMessage;
export type MoodPhase = AgentPhase;
export type { SceneConcept };

export interface UseMoodCompanion {
    messages: MoodMessage[];
    phase: MoodPhase;
    sceneConcept: SceneConcept | null;
    error: string | null;
    isOnline: boolean;

    sendMessage: (text: string) => Promise<void>;
    confirmScene: () => void;
    dismiss: () => void;
    reset: () => void;
}

/** @deprecated Use useAmoAgent instead */
export function useMoodCompanion(): UseMoodCompanion {
    return useAmoAgent();
}
