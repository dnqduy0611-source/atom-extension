/**
 * Agent Types — Unified type system for Amo Agent.
 *
 * Extends MoodMessage/MoodPhase with optional Agent metadata.
 * All new fields are optional → backward compatible with existing code.
 */

// ── Intents ──

export type AmoIntent =
    | { type: 'mood_chat' }
    | { type: 'task_breakdown'; taskText: string }
    | { type: 'insight_report' }
    | { type: 'scene_control'; query: string }
    | { type: 'music_control'; query: string }
    | { type: 'app_guide'; question: string }
    | { type: 'journal'; entry: string }
    | { type: 'stuck_repair' }
    | { type: 'unknown' };

export type IntentType = AmoIntent['type'];

// ── Task Steps ──

export interface TaskStep {
    text: string;
    emoji: string;
    estimatedMinutes: number;
    definitionOfDone: string;
}

// ── Agent Actions ──

export type AgentAction =
    | { type: 'inject_tasks'; tasks: TaskStep[] }
    | { type: 'switch_scene'; sceneId: string }
    | { type: 'toggle_play' }
    | { type: 'next_track' }
    | { type: 'prev_track' }
    | { type: 'mood_mix'; mood: string }
    | { type: 'show_insight' }
    | { type: 'start_timer'; duration?: number }
    | { type: 'open_panel'; panel: 'focus' | 'scene' | 'settings' | 'stats' };

// ── Inline UI ──

export interface InlineUIBlock {
    type: 'task_steps' | 'insight_card' | 'scene_preview'
    | 'feedback_buttons' | 'stuck_options' | 'guide_steps' | 'journal_entry';
    data: unknown;
}

// ── Agent Message (extends MoodMessage) ──

export interface AgentMessage {
    role: 'user' | 'amo';
    content: string;
    timestamp: number;

    // Agent metadata (all optional for backward compat)
    intent?: IntentType;
    actions?: AgentAction[];
    inlineUI?: InlineUIBlock;
    suggestions?: string[];
}

// ── Agent Phase (superset of MoodPhase) ──

export type AgentPhase =
    | 'idle'
    | 'thinking'
    | 'chatting'
    | 'suggesting'
    | 'confirmed'
    | 'creating'
    | 'done'
    // Agent-specific phases
    | 'broken';      // Task breakdown displayed

// ── Scene Concept (re-export compatible) ──

export interface SceneConcept {
    description: string;
    mood: string;
    style: string;
}

// ── Hook interface ──

export interface UseAmoAgent {
    messages: AgentMessage[];
    phase: AgentPhase;
    sceneConcept: SceneConcept | null;
    error: string | null;
    isOnline: boolean;

    sendMessage: (text: string) => Promise<void>;
    confirmScene: () => void;
    dismiss: () => void;
    reset: () => void;
}
