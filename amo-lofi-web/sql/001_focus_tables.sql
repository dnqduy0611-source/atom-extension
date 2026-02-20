-- ══════════════════════════════════════════════════════
--  AmoLofi — Focus Sessions Table
--  Run this in Supabase Dashboard → SQL Editor
--  Date: 2026-02-19
-- ══════════════════════════════════════════════════════

-- 1. Focus Sessions Table — stores individual focus records for Pro users
CREATE TABLE IF NOT EXISTS public.focus_sessions (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,                    -- YYYY-MM-DD
    minutes     SMALLINT NOT NULL DEFAULT 0,        -- focus minutes
    hour        SMALLINT,                           -- hour of day (0-23)
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Index: fast lookup by user + date range
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_date 
    ON public.focus_sessions(user_id, session_date DESC);

-- 2. User Insights Table — caches AI-generated weekly insights
CREATE TABLE IF NOT EXISTS public.user_insights (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_start  DATE NOT NULL,                      -- Monday of the week
    insight_text TEXT NOT NULL,
    stats_snapshot JSONB,                            -- raw stats used to generate
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_user_insights_user 
    ON public.user_insights(user_id, week_start DESC);

-- 3. Focus Stats Sync Table — mirrors localStorage stats to cloud
CREATE TABLE IF NOT EXISTS public.focus_stats_sync (
    user_id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    day_streak          INT DEFAULT 0,
    best_day_streak     INT DEFAULT 0,
    total_focus_minutes INT DEFAULT 0,
    sessions_completed  INT DEFAULT 0,
    tasks_completed     INT DEFAULT 0,
    streak_freezes      SMALLINT DEFAULT 2,
    freezes_used_month  SMALLINT DEFAULT 0,
    last_freeze_month   TEXT,                       -- 'YYYY-MM'
    frozen_dates        TEXT[] DEFAULT '{}',
    last_session_date   DATE,
    focus_history       JSONB DEFAULT '{}',          -- last 90 days: { "YYYY-MM-DD": minutes }
    hourly_history      JSONB DEFAULT '{}',          -- { "0": count, "1": count, ... }
    synced_at           TIMESTAMPTZ DEFAULT now()
);

-- 4. RLS Policies — users can only access their own data
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_stats_sync ENABLE ROW LEVEL SECURITY;

-- focus_sessions policies
CREATE POLICY "Users read own focus_sessions"
    ON public.focus_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users insert own focus_sessions"
    ON public.focus_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own focus_sessions"
    ON public.focus_sessions FOR DELETE
    USING (auth.uid() = user_id);

-- user_insights policies
CREATE POLICY "Users read own insights"
    ON public.user_insights FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users insert own insights"
    ON public.user_insights FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own insights"
    ON public.user_insights FOR UPDATE
    USING (auth.uid() = user_id);

-- focus_stats_sync policies
CREATE POLICY "Users read own stats_sync"
    ON public.focus_stats_sync FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users upsert own stats_sync"
    ON public.focus_stats_sync FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own stats_sync"
    ON public.focus_stats_sync FOR UPDATE
    USING (auth.uid() = user_id);

-- 5. Aggregate function: get monthly/yearly totals for Pro dashboard
CREATE OR REPLACE FUNCTION public.get_focus_aggregates(
    p_user_id UUID,
    p_start_date DATE,
    p_end_date DATE,
    p_group_by TEXT DEFAULT 'day'  -- 'day', 'week', 'month'
)
RETURNS TABLE(period TEXT, total_minutes BIGINT, session_count BIGINT)
LANGUAGE SQL STABLE
AS $$
    SELECT
        CASE p_group_by
            WHEN 'day'   THEN TO_CHAR(session_date, 'YYYY-MM-DD')
            WHEN 'week'  THEN TO_CHAR(DATE_TRUNC('week', session_date), 'YYYY-MM-DD')
            WHEN 'month' THEN TO_CHAR(session_date, 'YYYY-MM')
        END AS period,
        SUM(minutes)::BIGINT AS total_minutes,
        COUNT(*)::BIGINT AS session_count
    FROM public.focus_sessions
    WHERE user_id = p_user_id
      AND session_date BETWEEN p_start_date AND p_end_date
    GROUP BY period
    ORDER BY period;
$$;
