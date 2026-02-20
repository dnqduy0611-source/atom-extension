/**
 * useAIInsight — Weekly AI-generated productivity insight for Pro users.
 *
 * AI-1 Upgrade:
 *   - Structured output: headline, score (0-100), actionable_tip, body
 *   - Data quality fallbacks (§2.2): skip if <3 sessions, adapt prompt
 *   - Rate limit: 1 generation/week with cooldown tracking
 *   - Saves to `weekly_insights` table (§2.4)
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabaseClient';
import { useAuth } from './useAuth';
import { useFocusStore } from '../store/useFocusStore';

// ── Types ──

export interface AIInsight {
    headline: string;        // "You're a Night Owl 🦉"
    text: string;            // Full analysis body
    score: number;           // 0-100 productivity score
    actionable_tip: string;  // "Try scheduling coding for 10 PM"
    weekStart: string;       // YYYY-MM-DD (Monday)
    generatedAt: number;
    status: 'success' | 'skipped_insufficient_data' | 'failed';
}

export interface InsightState {
    insight: AIInsight | null;
    isLoading: boolean;
    error: string | null;
    cooldownDays: number;              // days until next generation allowed
    insufficientData: boolean;         // <3 sessions this week
    sessionsNeeded: number;            // how many more sessions needed
    archive: AIInsight[];              // past insights
}

// ── Constants ──

const INSIGHT_STORAGE_KEY = 'amo_ai_insight_v2';
const GEMINI_MODEL = 'gemini-2.0-flash-lite';
const MIN_SESSIONS_PER_WEEK = 3;
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── Helpers ──

/** Get Monday of current week as YYYY-MM-DD */
function getCurrentWeekStart(): string {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setDate(monday.getDate() - diff);
    return monday.toISOString().slice(0, 10);
}

/** Count sessions in the current week from focusHistory */
function countWeekSessions(focusHistory: Record<string, number>): number {
    const weekStart = getCurrentWeekStart();
    return Object.entries(focusHistory)
        .filter(([date, mins]) => date >= weekStart && mins > 0)
        .length;
}

/** Analyze data quality and decide what to include in prompt */
function analyzeDataQuality(stats: ReturnType<typeof useFocusStore.getState>['stats']) {
    const weekSessions = countWeekSessions(stats.focusHistory);
    const hasSceneData = true; // scenes are always tracked in lofi app
    const hasPeakHours = Object.keys(stats.hourlyHistory).length > 0;

    return {
        weekSessions,
        hasEnoughData: weekSessions >= MIN_SESSIONS_PER_WEEK,
        sessionsNeeded: Math.max(0, MIN_SESSIONS_PER_WEEK - weekSessions),
        includeEnvironment: hasSceneData,
        includePeakHours: hasPeakHours,
    };
}

/** Build stats summary for Gemini prompt */
function buildStatsSummary(stats: ReturnType<typeof useFocusStore.getState>['stats']): string {
    const entries = Object.entries(stats.focusHistory)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-14);

    const dailySummary = entries.map(([date, mins]) => `${date}: ${mins}m`).join(', ');

    const hourEntries = Object.entries(stats.hourlyHistory)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5);
    const peakHours = hourEntries.map(([h, c]) => `${h}:00 (${c} sessions)`).join(', ');

    return `USER STATS (last 2 weeks):
- Total focus: ${stats.totalFocusMinutes} minutes
- Sessions completed: ${stats.sessionsCompleted}
- Current streak: ${stats.dayStreak} days (best: ${stats.bestDayStreak})
- Today: ${stats.todayMinutes} minutes
- Daily breakdown: ${dailySummary || 'No data yet'}
- Peak hours: ${peakHours || 'Not enough data'}
- Tasks completed: ${stats.tasksCompleted}`;
}

/** Build system prompt requesting structured JSON output */
function buildInsightPrompt(statsSummary: string, quality: ReturnType<typeof analyzeDataQuality>): string {
    const analysisCategories = [
        '1. **Peak Performance Window:** When do they focus longest and most consistently?',
        quality.includeEnvironment
            ? '2. **Environment Correlation:** Which scene/sound setting correlates with completed tasks?'
            : null,
        '3. **Burnout Risk:** Check for: no breaks in sessions >45 min, avg session length trending up, abandonment rate >40%, late-night sessions (after 11 PM) increasing. If 2+ signals → warn gently.',
    ].filter(Boolean).join('\n');

    return `You are a productivity coach analyzing a user's focus data from AmoLofi (a lofi study app).

${statsSummary}

INSTRUCTIONS:
1. Analyze the user's patterns across these categories:
${analysisCategories}
2. Be specific — reference actual numbers and dates from the data
3. Tone: warm, caring coach — encouraging, not alarming
4. Auto-detect language from the context, default to English

OUTPUT FORMAT (respond with ONLY this JSON, no markdown fences):
{
  "headline": "Short catchy title with 1 emoji (e.g. 'Night Owl Power 🦉')",
  "text": "2-4 sentences of analysis referencing specific data points",
  "score": <number 0-100 based on consistency, total time, streak>,
  "actionable_tip": "One specific, actionable recommendation"
}

SCORING GUIDE:
- 0-20: Very low activity
- 21-40: Getting started
- 41-60: Building habits
- 61-80: Strong consistency
- 81-100: Elite performer

Be generous but honest. A user with 5+ days/week and 30+ min/day should score 70+.`;
}

// ── localStorage cache ──

function loadCachedInsight(): AIInsight | null {
    try {
        const raw = localStorage.getItem(INSIGHT_STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as AIInsight;
    } catch {
        return null;
    }
}

function saveCachedInsight(insight: AIInsight): void {
    try {
        localStorage.setItem(INSIGHT_STORAGE_KEY, JSON.stringify(insight));
    } catch { /* ignore */ }
}

// ── Hook ──

export function useAIInsight(isPro: boolean) {
    const { user } = useAuth();
    const stats = useFocusStore(s => s.stats);
    const [insight, setInsight] = useState<AIInsight | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [archive, setArchive] = useState<AIInsight[]>([]);

    // Data quality
    const quality = analyzeDataQuality(stats);

    // Cooldown calculation
    const cached = loadCachedInsight();
    const cooldownMs = cached ? COOLDOWN_MS - (Date.now() - cached.generatedAt) : 0;
    const cooldownDays = Math.max(0, Math.ceil(cooldownMs / (24 * 60 * 60 * 1000)));
    const canGenerate = cooldownDays === 0 || !cached;

    // Check cache on mount
    useEffect(() => {
        if (!isPro) return;

        const currentWeek = getCurrentWeekStart();
        if (cached && cached.weekStart === currentWeek) {
            setInsight(cached);
            return;
        }

        // Try loading from Supabase
        if (user) {
            supabase
                .from('weekly_insights')
                .select('*')
                .eq('user_id', user.id)
                .eq('week_start_date', currentWeek)
                .single()
                .then(({ data }) => {
                    if (data && data.status === 'success') {
                        const restored: AIInsight = {
                            headline: data.headline || '',
                            text: data.insight_text || '',
                            score: data.score || 0,
                            actionable_tip: data.actionable_tip || '',
                            weekStart: data.week_start_date,
                            generatedAt: new Date(data.created_at).getTime(),
                            status: 'success',
                        };
                        setInsight(restored);
                        saveCachedInsight(restored);
                    }
                });
        }
    }, [isPro, user]); // eslint-disable-line react-hooks/exhaustive-deps

    // Load archive
    useEffect(() => {
        if (!isPro || !user) return;

        supabase
            .from('weekly_insights')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'success')
            .order('week_start_date', { ascending: false })
            .limit(12) // last 3 months
            .then(({ data }) => {
                if (data) {
                    setArchive(data.map(d => ({
                        headline: d.headline || '',
                        text: d.insight_text || '',
                        score: d.score || 0,
                        actionable_tip: d.actionable_tip || '',
                        weekStart: d.week_start_date,
                        generatedAt: new Date(d.created_at).getTime(),
                        status: 'success' as const,
                    })));
                }
            });
    }, [isPro, user]);

    const generateInsight = useCallback(async () => {
        if (!isPro || isLoading) return;

        // Rate limit check
        if (!canGenerate) {
            setError(`Cooldown: next analysis in ${cooldownDays} days`);
            return;
        }

        // Data quality check
        if (!quality.hasEnoughData) {
            const skipInsight: AIInsight = {
                headline: '',
                text: '',
                score: 0,
                actionable_tip: '',
                weekStart: getCurrentWeekStart(),
                generatedAt: Date.now(),
                status: 'skipped_insufficient_data',
            };
            setInsight(skipInsight);

            // Save skip status to DB
            if (user) {
                supabase.from('weekly_insights').upsert({
                    user_id: user.id,
                    week_start_date: getCurrentWeekStart(),
                    status: 'skipped_insufficient_data',
                }, { onConflict: 'user_id,week_start_date' }).then(() => { });
            }
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
            };
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }

            const currentStats = useFocusStore.getState().stats;
            const currentQuality = analyzeDataQuality(currentStats);
            const statsSummary = buildStatsSummary(currentStats);

            const res = await fetch(`${SUPABASE_URL}/functions/v1/gemini-proxy`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model: GEMINI_MODEL,
                    contents: [
                        { role: 'user', parts: [{ text: 'Analyze my focus data and generate my weekly productivity report.' }] },
                    ],
                    systemInstruction: {
                        parts: [{ text: buildInsightPrompt(statsSummary, currentQuality) }],
                    },
                    generationConfig: {
                        temperature: 0.7,
                        topP: 0.9,
                        maxOutputTokens: 500,
                        responseMimeType: 'application/json',
                    },
                }),
            });

            if (!res.ok) {
                throw new Error(`Insight generation failed (${res.status})`);
            }

            const data = await res.json();
            const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

            // Parse structured JSON
            let parsed: { headline?: string; text?: string; score?: number; actionable_tip?: string };
            try {
                parsed = JSON.parse(rawText);
            } catch {
                // Fallback: treat raw text as body
                parsed = { text: rawText, headline: '📊 Weekly Analysis', score: 50, actionable_tip: '' };
            }

            const weekStart = getCurrentWeekStart();
            const newInsight: AIInsight = {
                headline: parsed.headline || '📊 Weekly Analysis',
                text: (parsed.text || rawText).trim(),
                score: Math.min(100, Math.max(0, parsed.score || 50)),
                actionable_tip: parsed.actionable_tip || '',
                weekStart,
                generatedAt: Date.now(),
                status: 'success',
            };

            setInsight(newInsight);
            saveCachedInsight(newInsight);

            // Save to Supabase
            if (user) {
                supabase
                    .from('weekly_insights')
                    .upsert({
                        user_id: user.id,
                        week_start_date: weekStart,
                        headline: newInsight.headline,
                        insight_text: newInsight.text,
                        score: newInsight.score,
                        actionable_tip: newInsight.actionable_tip,
                        status: 'success',
                        stats_snapshot: currentStats,
                    }, { onConflict: 'user_id,week_start_date' })
                    .then(({ error: dbErr }) => {
                        if (dbErr) console.warn('[AIInsight] DB save failed:', dbErr.message);
                    });
            }
        } catch (err) {
            setError((err as Error).message);

            // Save failure status
            if (user) {
                supabase.from('weekly_insights').upsert({
                    user_id: user.id,
                    week_start_date: getCurrentWeekStart(),
                    status: 'failed',
                }, { onConflict: 'user_id,week_start_date' }).then(() => { });
            }
        } finally {
            setIsLoading(false);
        }
    }, [isPro, isLoading, user, canGenerate, cooldownDays, quality.hasEnoughData]);

    return {
        insight,
        isLoading,
        error,
        cooldownDays,
        canGenerate,
        insufficientData: !quality.hasEnoughData,
        sessionsNeeded: quality.sessionsNeeded,
        archive,
        regenerate: generateInsight,
    };
}
