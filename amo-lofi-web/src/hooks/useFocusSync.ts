/**
 * useFocusSync — Cloud sync hook for Pro users' focus data.
 *
 * Strategy:
 *   - Free/Guest: localStorage only (no sync).
 *   - Pro: On session complete → upsert to focus_sessions + focus_stats_sync.
 *          On login/mount → hydrate localStorage from cloud if cloud is newer.
 *
 * Usage: Call `useFocusSync()` once in the Dashboard or App root.
 */

import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './useAuth';
import { useProGate } from './useProGate';
import { useFocusStore } from '../store/useFocusStore';
import type { FocusStats } from '../store/useFocusStore';

/** Sync localStorage stats → Supabase (Pro only) */
async function pushStatsToCloud(userId: string, stats: FocusStats): Promise<void> {
    const { error } = await supabase
        .from('focus_stats_sync')
        .upsert({
            user_id: userId,
            day_streak: stats.dayStreak,
            best_day_streak: stats.bestDayStreak,
            total_focus_minutes: stats.totalFocusMinutes,
            sessions_completed: stats.sessionsCompleted,
            tasks_completed: stats.tasksCompleted,
            streak_freezes: stats.streakFreezes,
            freezes_used_month: stats.freezesUsedThisMonth,
            last_freeze_month: stats.lastFreezeResetMonth,
            frozen_dates: stats.frozenDates,
            last_session_date: stats.lastSessionDate || null,
            focus_history: stats.focusHistory,
            hourly_history: stats.hourlyHistory,
            synced_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

    if (error) {
        console.warn('[FocusSync] Push failed:', error.message);
    }
}

/** Record a single focus session to focus_sessions table */
async function pushSessionToCloud(
    userId: string,
    date: string,
    minutes: number,
    hour: number
): Promise<void> {
    const { error } = await supabase
        .from('focus_sessions')
        .insert({
            user_id: userId,
            session_date: date,
            minutes,
            hour,
        });

    if (error) {
        console.warn('[FocusSync] Session push failed:', error.message);
    }
}

/** Pull cloud stats and merge into localStorage (cloud wins if newer) */
async function pullStatsFromCloud(userId: string): Promise<Partial<FocusStats> | null> {
    const { data, error } = await supabase
        .from('focus_stats_sync')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error || !data) return null;

    return {
        dayStreak: data.day_streak ?? 0,
        bestDayStreak: data.best_day_streak ?? 0,
        totalFocusMinutes: data.total_focus_minutes ?? 0,
        sessionsCompleted: data.sessions_completed ?? 0,
        tasksCompleted: data.tasks_completed ?? 0,
        streakFreezes: data.streak_freezes ?? 2,
        freezesUsedThisMonth: data.freezes_used_month ?? 0,
        lastFreezeResetMonth: data.last_freeze_month ?? '',
        frozenDates: data.frozen_dates ?? [],
        lastSessionDate: data.last_session_date ?? '',
        focusHistory: data.focus_history ?? {},
        hourlyHistory: data.hourly_history ?? {},
    };
}

/** Fetch aggregated focus data for Pro dashboard (month/year views) */
export async function fetchFocusAggregates(
    userId: string,
    startDate: string,
    endDate: string,
    groupBy: 'day' | 'week' | 'month' = 'day'
): Promise<{ period: string; total_minutes: number; session_count: number }[]> {
    const { data, error } = await supabase
        .rpc('get_focus_aggregates', {
            p_user_id: userId,
            p_start_date: startDate,
            p_end_date: endDate,
            p_group_by: groupBy,
        });

    if (error) {
        console.warn('[FocusSync] Aggregate fetch failed:', error.message);
        return [];
    }

    return data ?? [];
}

/**
 * useFocusSync — Main hook. Call once in Dashboard or App root.
 * Handles: initial hydration from cloud, and provides syncNow() for push.
 */
export function useFocusSync() {
    const { user } = useAuth();
    const { isPro } = useProGate();
    const hydratedRef = useRef(false);

    // Hydrate from cloud on first Pro login
    useEffect(() => {
        if (!user || !isPro || hydratedRef.current) return;

        async function hydrate() {
            const cloudStats = await pullStatsFromCloud(user!.id);
            if (!cloudStats) {
                // No cloud data yet — push current local stats
                await pushStatsToCloud(user!.id, useFocusStore.getState().stats);
                hydratedRef.current = true;
                return;
            }

            // Merge: cloud wins if it has more total minutes (more complete data)
            const localStats = useFocusStore.getState().stats;
            if ((cloudStats.totalFocusMinutes ?? 0) > localStats.totalFocusMinutes) {
                // Cloud is ahead — merge focusHistory (union of both, max per day)
                const mergedHistory = { ...cloudStats.focusHistory };
                for (const [date, mins] of Object.entries(localStats.focusHistory)) {
                    mergedHistory[date] = Math.max(mergedHistory[date] ?? 0, mins);
                }
                cloudStats.focusHistory = mergedHistory;

                // Merge hourlyHistory (sum)
                const mergedHourly = { ...cloudStats.hourlyHistory };
                for (const [hour, count] of Object.entries(localStats.hourlyHistory)) {
                    mergedHourly[hour] = Math.max(mergedHourly[hour] ?? 0, count as number);
                }
                cloudStats.hourlyHistory = mergedHourly;

                // Apply cloud stats to local store
                useFocusStore.setState((state) => ({
                    stats: { ...state.stats, ...cloudStats },
                }));
            } else {
                // Local is ahead — push to cloud
                await pushStatsToCloud(user!.id, localStats);
            }

            hydratedRef.current = true;
        }

        hydrate();
    }, [user, isPro]);

    // Push sync: call after session completes
    const syncNow = useCallback(async (sessionMinutes?: number, sessionHour?: number) => {
        if (!user || !isPro) return;

        const currentStats = useFocusStore.getState().stats;

        // Push stats snapshot
        await pushStatsToCloud(user.id, currentStats);

        // If session data provided, also record individual session
        if (sessionMinutes && sessionMinutes > 0) {
            const today = new Date().toISOString().slice(0, 10);
            await pushSessionToCloud(
                user.id,
                today,
                sessionMinutes,
                sessionHour ?? new Date().getHours()
            );
        }
    }, [user, isPro]);

    return { syncNow, isPro, userId: user?.id };
}
