# AMOISEKAI — MANGA MODE SPEC (v1)

**Date:** 2026-02-27  
**Owner:** Product/Story Team  
**Status:** Draft for implementation

---

## 1) Product Goal

Add a paid **Manga Mode** on top of existing Light Novel gameplay.

- Keep Light Novel as default play mode.
- Let users unlock manga visualization for current chapter/scene.
- Increase engagement, retention, and monetization through premium visual storytelling.

**Core promise:** "Your story, rendered as your own manga."

---

## 2) Scope (v1)

### In-scope
1. Scene segmentation from chapter text.
2. Panel planning (3–6 panels per scene block).
3. AI image generation pipeline.
4. Manga page assembly (vertical/webtoon-first).
5. Paid access controls (Pro or Credits).
6. Character/world consistency system (basic).

### Out-of-scope (v1)
- Full speech bubble auto-typesetting perfection.
- Advanced inpainting editor.
- Motion comic/video export.

---

## 3) User Experience Flow

1. User plays Light Novel chapter.
2. User taps **"Visualize as Manga"**.
3. System shows generation estimate (credits/time).
4. System generates:
   - preview panels (free teaser or low-credit preview), then
   - full manga pages (if unlocked).
5. User reads manga version in viewer.
6. User can:
   - regenerate individual panel,
   - save chapter to library,
   - share selected page.

---

## 4) Monetization Model

### Free
- Light Novel full access (existing).
- Manga preview: first 1–2 panels per chapter (watermarked/low-res optional).

### Pro
- Monthly manga quota (e.g. N panels/month).
- Higher quality render.
- Priority queue.

### Credits (à la carte)
- Buy extra panel packs.
- Pay-per-generation when over quota.

**Important:** Pro unlocks the mode, Credits scale heavy usage.

---

## 5) Scene-to-Manga Pipeline

## 5.1 Stage A — Story Extraction
Input: chapter text + current game state.
Output JSON (`scene_beats`):
- beat_id
- location
- time_of_day
- involved_characters
- emotion
- key_action
- dialogue_snippet
- cinematic_intensity (1-5)

## 5.2 Stage B — Panel Planning
For each beat, generate `panel_plan`:
- panel_order
- shot_type (`establishing|closeup|over_shoulder|action|reaction`)
- subject
- action_pose
- expression
- composition_notes

Rules:
- First panel of beat = establish context.
- Last panel of beat = emotional or action payoff.
- Avoid repeating identical shot_type >2 in sequence.

## 5.3 Stage C — Prompt Composer
Build prompt from:
- world style tags
- character visual profile
- shot_type + emotion + action
- lighting/time-of-day
- continuity tags (outfit, weapon, injuries)

Output:
- `positive_prompt`
- `negative_prompt`
- `seed`
- `model_variant`

## 5.4 Stage D — Render + Post
- Generate panel images in queue.
- Validate safety/quality.
- Optional reroll on low score.
- Assemble to page(s) with gutters and panel borders.

## 5.5 Stage E — Delivery
- Store in user manga library.
- Return progressive results (stream as panels finish).

---

## 6) Consistency System (Critical)

## 6.1 Character Bible (must-have)
Each major character has immutable visual anchors:
- hair style/color
- eye color
- face shape
- core outfit elements
- signature accessories
- silhouette tags

## 6.2 World Bible Binding
Every location has fixed scene tags:
- architecture style
- color palette
- weather profile
- ambient objects

## 6.3 Continuity Memory
Store previous panel metadata and pass into next prompt:
- previous camera angle
- injuries/dust/blood state
- object positions (coarse)

---

## 7) Data Model (Supabase)

## 7.1 `manga_jobs`
- id (uuid)
- user_id
- chapter_id
- status (`queued|running|done|failed`)
- mode (`preview|full`)
- credits_spent
- created_at, finished_at

## 7.2 `manga_scenes`
- id
- job_id
- beat_index
- source_text
- scene_json

## 7.3 `manga_panels`
- id
- job_id
- scene_id
- panel_index
- shot_type
- prompt_hash
- seed
- image_url
- quality_score
- regenerated_from_panel_id (nullable)

## 7.4 `manga_pages`
- id
- job_id
- page_index
- page_image_url
- panel_count

## 7.5 `character_visual_profiles`
- id
- character_id
- canonical_tags (jsonb)
- locked_seed_range
- updated_at

---

## 8) API Contracts (v1)

### POST `/manga/generate`
Request:
- chapter_id
- mode (`preview|full`)
- options (quality/style)

Response:
- job_id
- estimated_seconds
- credits_required

### GET `/manga/job/:job_id`
Response:
- status
- progress_percent
- finished_panels[]
- pages[] (when ready)

### POST `/manga/panel/:panel_id/regenerate`
Request:
- reason
- optional shot override

Response:
- new_panel_id

---

## 9) Quality Controls

1. NSFW/safety filter before publish.
2. Character mismatch detector (face/accessory mismatch heuristic).
3. Blur/artifact detector (simple CV score).
4. Retry policy:
   - max 2 auto-rerolls per panel in v1.

---

## 10) Performance & Cost Controls

1. Cache by `prompt_hash + seed + model_variant`.
2. Batch render (2–4 panels/request) to avoid queue spikes.
3. Limit max panels/chapter in v1.
4. Progressive delivery (show first finished panels immediately).
5. Daily quota guardrail by plan.

---

## 11) UX Details

### Manga Viewer
- Vertical scroll (webtoon first).
- Toggle text overlay on/off.
- Tap panel to zoom.
- Regenerate button per panel (Pro+).

### Paywall Moments
- At first manga entry.
- At end of preview.
- When quota exhausted.

Copy principle: sell transformation, not restriction.

---

## 12) Rollout Plan

### Milestone 1 (Internal Alpha)
- Single chapter, fixed cast.
- Preview mode only.

### Milestone 2 (Closed Beta)
- Full mode for selected users.
- Quota + credit billing live.

### Milestone 3 (Public)
- Full chapter generation.
- Panel regenerate + library.

---

## 13) KPIs

1. Manga entry rate: `% users clicking Visualize as Manga`.
2. Preview-to-paid conversion rate.
3. Avg panels generated per paid user.
4. Manga chapter completion rate.
5. Cost per paying user vs ARPPU.

---

## 14) Risks & Mitigation

1. **Inconsistent characters**  
   Mitigation: strict Character Bible + continuity memory.

2. **High generation cost**  
   Mitigation: previews, quotas, caching, credits.

3. **Slow rendering UX**  
   Mitigation: progressive results + queue ETA.

4. **Low perceived quality**  
   Mitigation: panel reroll + quality filter + curated style presets.

---

## 15) Definition of Done (v1)

- User can generate manga preview from a chapter.
- Pro/Credit gates are functional.
- Full manga generation works for at least one season arc.
- Character consistency acceptable in 80%+ sampled chapters.
- Telemetry for conversion and cost is in place.
