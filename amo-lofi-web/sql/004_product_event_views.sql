-- ══════════════════════════════════════════════════════════════
--  Product Event Dashboard Views
--  Run in Supabase SQL Editor for quick analytics
-- ══════════════════════════════════════════════════════════════

-- ── Daily opens / starts / completes (last 14 days) ──
select
    date_trunc('day', created_at) as day,
    count(*) filter (where event_name = 'app_open')       as opens,
    count(*) filter (where event_name = 'focus_start')    as starts,
    count(*) filter (where event_name = 'focus_complete') as completes
from public.product_events
where created_at >= now() - interval '14 days'
group by 1
order by 1 desc;


-- ── Activation metrics (last 7 days) ──
with x as (
    select
        count(*) filter (where event_name = 'app_open')::numeric       as opens,
        count(*) filter (where event_name = 'focus_start')::numeric     as starts,
        count(*) filter (where event_name = 'focus_complete')::numeric  as completes
    from public.product_events
    where created_at >= now() - interval '7 days'
)
select
    opens, starts, completes,
    round((starts  / nullif(opens, 0)) * 100, 2) as activation_start_pct,
    round((completes / nullif(opens, 0)) * 100, 2) as activation_complete_pct,
    round((completes / nullif(starts, 0)) * 100, 2) as completion_pct
from x;


-- ── Monetization funnel (last 7 days) ──
with x as (
    select
        count(*) filter (where event_name = 'app_open')::numeric              as opens,
        count(*) filter (where event_name = 'upgrade_click')::numeric         as upgrade_clicks,
        count(*) filter (where event_name = 'pro_purchase_success')::numeric  as purchases
    from public.product_events
    where created_at >= now() - interval '7 days'
)
select
    opens, upgrade_clicks, purchases,
    round((upgrade_clicks / nullif(opens, 0)) * 100, 2) as upgrade_interest_pct,
    round((purchases / nullif(upgrade_clicks, 0)) * 100, 2) as checkout_conversion_pct
from x;


-- ── Top scenes (last 7 days) ──
select
    metadata->>'sceneId' as scene_id,
    count(*) as change_count
from public.product_events
where event_name = 'scene_change'
    and created_at >= now() - interval '7 days'
group by 1
order by 2 desc
limit 10;
