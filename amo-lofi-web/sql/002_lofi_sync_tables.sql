-- ═══════════════════════════════════════════════════════
-- Migration 002: Lofi Sync Tables (Phase 3A)
-- Run this in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────
-- 1. lofi_state — Persisted user config for cross-device resume
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lofi_state (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

    -- Current mixer config (MixerConfig JSON shape)
    active_config JSONB NOT NULL DEFAULT '{
        "scene_id": "cozy_cafe",
        "variant": "day",
        "music": null,
        "ambience": []
    }',

    -- Playback state
    is_playing         BOOLEAN DEFAULT false,
    master_volume      REAL DEFAULT 0.7,

    -- Pomodoro state
    pomodoro_state     TEXT DEFAULT 'idle',   -- 'idle' | 'work' | 'break'
    pomodoro_remaining INTEGER DEFAULT 1500,  -- seconds remaining
    current_task       TEXT DEFAULT '',

    -- Device tracking
    last_device        TEXT DEFAULT 'web',    -- 'web' | 'extension'
    last_active_at     TIMESTAMPTZ DEFAULT now(),

    -- Timestamps
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- RLS: users can only access their own state
ALTER TABLE public.lofi_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own lofi state"
    ON public.lofi_state
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_lofi_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lofi_state_updated
    BEFORE UPDATE ON public.lofi_state
    FOR EACH ROW EXECUTE FUNCTION public.update_lofi_timestamp();


-- ─────────────────────────────────────────────────────
-- 2. lofi_presets — User-saved custom mix presets (Pro)
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lofi_presets (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    emoji      TEXT DEFAULT '🎵',
    config     JSONB NOT NULL,  -- MixerConfig shape
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.lofi_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own presets"
    ON public.lofi_presets
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_lofi_presets_user
    ON public.lofi_presets(user_id);

-- Limit: max 20 presets per user
CREATE OR REPLACE FUNCTION public.check_preset_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM public.lofi_presets WHERE user_id = NEW.user_id) >= 20 THEN
        RAISE EXCEPTION 'Preset limit reached (max 20)';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER preset_limit_check
    BEFORE INSERT ON public.lofi_presets
    FOR EACH ROW EXECUTE FUNCTION public.check_preset_limit();


-- ─────────────────────────────────────────────────────
-- 3. lofi_focus_log — Per-device daily focus aggregation
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lofi_focus_log (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date            DATE NOT NULL DEFAULT CURRENT_DATE,
    focus_minutes   INTEGER DEFAULT 0,
    sessions_done   INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    device          TEXT DEFAULT 'web',  -- 'web' | 'extension'
    created_at      TIMESTAMPTZ DEFAULT now(),

    -- One row per user per day per device
    UNIQUE(user_id, date, device)
);

ALTER TABLE public.lofi_focus_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own focus logs"
    ON public.lofi_focus_log
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_lofi_focus_log_user_date
    ON public.lofi_focus_log(user_id, date);
