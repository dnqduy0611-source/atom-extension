-- ═══════════════════════════════════════════════════════
-- Migration 003: Weekly Insights (AI Insight System)
-- Run this in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.weekly_insights (
    id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    week_start_date  DATE NOT NULL,

    -- Structured AI output
    headline         TEXT,              -- "You're a Night Owl 🦉"
    insight_text     TEXT,              -- Full analysis body (Markdown)
    score            INTEGER DEFAULT 0, -- Productivity score 0-100
    actionable_tip   TEXT,              -- "Try scheduling coding for 10 PM"

    -- Metadata
    status           TEXT DEFAULT 'success' CHECK (status IN (
                        'success',
                        'skipped_insufficient_data',
                        'failed'
                     )),
    stats_snapshot   JSONB,             -- Raw stats at generation time
    created_at       TIMESTAMPTZ DEFAULT now(),

    -- One insight per user per week
    UNIQUE(user_id, week_start_date)
);

ALTER TABLE public.weekly_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own insights"
    ON public.weekly_insights
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_weekly_insights_user_week
    ON public.weekly_insights(user_id, week_start_date DESC);
