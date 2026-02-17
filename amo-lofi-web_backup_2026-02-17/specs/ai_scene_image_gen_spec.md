# AI Scene Image Generation — Feature Spec

## Overview

Upgrade "Create Scene" to auto-generate background images via AI,
eliminating manual upload. Uses **Approach B (2-step)**:
Gemini text model crafts an optimized image prompt + theme JSON,
then Gemini image model generates the background.

---

## Terminology

| Term | Meaning |
|------|---------|
| DAU | Daily Active Users — users who open the app on a given day |
| Scene | A complete visual environment: background image + color theme + ambience |
| Quota | Max AI generations a user can perform per day |

**"100 free + 10 Pro" example**: out of ~1,000 registered users,
~100 free users and ~10 Pro users actually use the app on a typical day.
Only these DAUs consume API quota.

---

## User Flow

```
┌─────────────────────────────────────────────────────────┐
│  SceneCreator Form                                      │
│                                                         │
│  Name:        [Medieval Castle          ]               │
│  Description: [A grand castle on a cliff at sunset   ]  │
│  Background:  [📁 Upload] or [✨ AI Generate]          │
│                                                         │
│  ┌─── "✨ AI Generate" pressed ───┐                    │
│  │                                 │                    │
│  │  Step 1 (text, ~2s):           │                    │
│  │    → craft image prompt         │                    │
│  │    → generate theme JSON        │                    │
│  │    → suggest tags + ambience    │                    │
│  │                                 │                    │
│  │  Step 2 (image, ~8-15s):       │                    │
│  │    → generate 16:9 background   │                    │
│  │    → show preview               │                    │
│  └─────────────────────────────────┘                    │
│                                                         │
│  [Preview: theme colors + background image]             │
│  [🔄 Regenerate]              [💾 Save Scene]          │
└─────────────────────────────────────────────────────────┘
```

### Key UX decisions
- User can still manually upload (existing flow preserved)
- "AI Generate" is the NEW default/prominent option
- User sees a 2-phase progress: "Designing theme..." → "Creating background..."
- "Regenerate" re-runs step 2 only (image), keeps theme — costs $0.039 not $0.0396
- If image generation fails, theme is still usable with manual upload fallback

---

## Architecture

### Step 1: Text model (theme + image prompt)

**Model**: `gemini-2.5-flash` (same as current theme generation)
**Change**: Extend existing `SYSTEM_PROMPT` to also output an `imagePrompt` field.

Current output shape:
```json
{ "day": {...}, "night": {...}, "tags": [], "defaultAmbience": [], "suggestedTint": {} }
```

New output shape:
```json
{
  "day": { ... 9 color tokens ... },
  "night": { ... 9 color tokens ... },
  "tags": ["medieval", "fantasy", "sunset"],
  "defaultAmbience": ["wind"],
  "suggestedTint": { "day": "rgba(...)", "night": "rgba(...)" },
  "imagePrompt": "A majestic medieval stone castle perched on a dramatic cliff edge during golden hour sunset. Warm orange and amber light streams through scattered clouds, casting long shadows across ancient stone towers with weathered banners. A winding cobblestone path leads up through autumn-colored forest. Wide-angle cinematic composition with atmospheric perspective, misty valley below. Detailed matte painting style, rich warm tones contrasting cool blue shadows in the distance. No text, no UI elements, no watermarks."
}
```

**System prompt addition** (appended to existing SYSTEM_PROMPT):
```
Additionally, generate an "imagePrompt" field containing a detailed,
vivid prompt (50-80 words) for an AI image generator to create a
beautiful background image matching the scene. The prompt must:
- Describe the scene with rich visual detail (lighting, colors, mood, composition)
- Specify "wide-angle cinematic composition" for desktop wallpaper framing
- Include atmospheric elements (fog, light rays, reflections, etc.)
- End with "No text, no UI elements, no watermarks."
- Do NOT mention "lofi" — the scene can be any theme the user wants
```

### Step 2: Image model

**Model**: `gemini-2.5-flash-image` (Nano Banana)
**Endpoint**: same Gemini API, different model name
**Config**:
```json
{
  "contents": [{ "parts": [{ "text": "{imagePrompt from step 1}" }] }],
  "generationConfig": {
    "responseModalities": ["IMAGE"],
    "imageConfig": {
      "aspectRatio": "16:9"
    }
  }
}
```

**Response**: base64 PNG in `parts[].inlineData.data`
→ Convert to Blob → store in IndexedDB as `backgroundBlob`

---

## File Changes

### Modified files

| File | Change |
|------|--------|
| `hooks/useGeminiTheme.ts` | Add `imagePrompt` to GeneratedTheme interface; add to SYSTEM_PROMPT; add `generateImage()` function; add IMAGE_MODEL to MODEL_CHAIN |
| `components/scene/SceneCreator.tsx` | Add "AI Generate" button; 2-phase progress UI; image preview; "Regenerate" button; keep manual upload as alternative |
| `utils/idb.ts` | No change (StoredScene.backgroundBlob already supports Blob) |
| `hooks/useCustomScenes.ts` | No change (already handles backgroundBlob) |

### No new files needed
All logic fits in existing files.

---

## Detailed Implementation

### 1. useGeminiTheme.ts changes

```typescript
// Add to GeneratedTheme interface:
export interface GeneratedTheme {
    theme: { day: SceneTheme; night: SceneTheme };
    tags: string[];
    defaultAmbience: string[];
    suggestedTint: { day: string; night: string };
    imagePrompt: string;  // NEW
}

// Add image model constant:
const IMAGE_MODEL = 'gemini-2.5-flash-image';

// Add new exported function:
export async function generateImage(
    apiKey: string,
    imagePrompt: string,
): Promise<Blob>
```

**generateImage()** logic:
1. POST to `{API_BASE}/{IMAGE_MODEL}:generateContent?key={apiKey}`
2. Body: `{ contents, generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "16:9" } } }`
3. Parse response: `candidates[0].content.parts` → find part with `inlineData`
4. Decode base64 → `Uint8Array` → `new Blob([bytes], { type: mimeType })`
5. Timeout: 60s (image gen is slower than text)
6. No model fallback chain for image — only one image model

### 2. SceneCreator.tsx changes

**New state:**
```typescript
const [bgBlob, setBgBlob] = useState<Blob | null>(null);
const [isGeneratingImage, setIsGeneratingImage] = useState(false);
const [imageError, setImageError] = useState<string | null>(null);
const [generationPhase, setGenerationPhase] = useState<'idle' | 'theme' | 'image'>('idle');
```

**New flow (handleGenerate):**
```
1. setGenerationPhase('theme')
2. result = await generate(name, description)  // existing — now returns imagePrompt
3. setGenerated(result)
4. setGenerationPhase('image')
5. blob = await generateImage(apiKey, result.imagePrompt)
6. setBgBlob(blob); setBgPreview(URL.createObjectURL(blob))
7. setGenerationPhase('idle')
```

**Progress UI:**
```
Phase 'theme':  "✨ Designing theme..."       (spinner)
Phase 'image':  "🎨 Creating background..."   (spinner + pulse animation)
```

**Regenerate button** (visible after generation):
- Only re-runs step 2 with same `imagePrompt`
- Cheaper: only $0.039, no text call
- Shows next to preview image

**Manual upload preserved:**
- "📁 Upload your own" link below AI generate
- If user uploads, skip image generation entirely

### 3. handleSave changes

```typescript
const stored: StoredScene = {
    id: `custom_scene_${Date.now()}`,
    name,
    description,
    theme: generated.theme,
    backgroundBlob: bgBlob ?? bgFile,  // AI blob or manual upload
    tint: generated.suggestedTint,
    tags: generated.tags,
    defaultAmbience: generated.defaultAmbience,
    createdAt: Date.now(),
};
```

---

## Rate Limiting (Client-side, Phase 1)

Since we're using the user's own API key in Phase 1 (client-side),
rate limiting is informational/soft — prevents accidental overuse.

```typescript
// localStorage keys
const DAILY_KEY = 'amo_scene_gen_daily';  // { date: 'YYYY-MM-DD', count: number }

function getDailyCount(): number { ... }
function incrementDaily(): void { ... }

// Limits
const FREE_DAILY_LIMIT = 2;
const PRO_DAILY_LIMIT = 15;
```

UI shows: "2 of 2 used today" with disabled button when exhausted.

> **Phase 2** (server proxy with your API key): enforce server-side,
> user doesn't need their own key, quota tracked per user account.

---

## Cost Model

### Per-scene generation cost (Approach B)

| Step | Model | Cost |
|------|-------|------|
| Text (theme + imagePrompt) | gemini-2.5-flash | ~$0.0006 |
| Image (background) | gemini-2.5-flash-image | $0.039 |
| **Total** | | **$0.0396** |
| Regenerate (image only) | gemini-2.5-flash-image | $0.039 |

### Monthly cost projections

Assumptions:
- 30% utilization (not every DAU uses full quota every day)
- No cache (worst case)

**Scenario 1: Launch (small)**
| | DAU | Quota/day | Utilization | Images/day | Cost/month |
|---|---|---|---|---|---|
| Free | 100 | 2 | 30% | 60 | $36 (@ $0.02 Imagen Fast) |
| Pro | 10 | 15 | 30% | 45 | $52.65 (@ $0.039 Flash Image) |
| Text calls | — | — | — | 105 | $1.89 |
| **Total** | | | | **105** | **~$91/month** |

**Scenario 2: Growth**
| | DAU | Quota/day | Utilization | Images/day | Cost/month |
|---|---|---|---|---|---|
| Free | 500 | 2 | 30% | 300 | $180 |
| Pro | 50 | 15 | 30% | 225 | $263 |
| Text calls | — | — | — | 525 | $9.45 |
| **Total** | | | | **525** | **~$453/month** |

**Scenario 3: Scale**
| | DAU | Quota/day | Utilization | Images/day | Cost/month |
|---|---|---|---|---|---|
| Free | 2000 | 2 | 30% | 1200 | $720 |
| Pro | 200 | 15 | 30% | 900 | $1,053 |
| Text calls | — | — | — | 2100 | $37.80 |
| **Total** | | | | **2,100** | **~$1,811/month** |

### Revenue offset (Pro @ $4/month)
| Scenario | Pro users | Revenue | Cost | Net |
|---|---|---|---|---|
| Launch | 10 | $40 | $91 | **-$51** |
| Growth | 50 | $200 | $453 | **-$253** |
| Scale | 200 | $800 | $1,811 | **-$1,011** |

> Image generation alone doesn't break even.
> But it's a **conversion driver** — users create a scene,
> love it, hit the daily limit, upgrade to Pro.
> Revenue comes from the full Pro bundle (all features), not just image gen.

### Cost optimization levers (future)

1. **Cache**: hash(description) → serve existing image (~20-35% savings at scale)
2. **Lower free quota**: 1/day instead of 2 → halves free cost
3. **Imagen 4 Fast for free users**: $0.02/image instead of $0.039
4. **Batch API for variants**: $0.0195/image for non-realtime wallpaper extras
5. **Server proxy**: move to your API key, enforce hard limits, prevent abuse

---

## Error Handling

| Error | Handling |
|-------|----------|
| Image gen fails (timeout/500) | Show error, keep theme, offer "Upload your own" fallback |
| Image gen returns no image | Retry once, then fallback to manual upload |
| Invalid API key | Same as current — show error message |
| Quota exhausted | Disable button, show "Come back tomorrow" or "Upgrade to Pro" |
| Base64 decode fails | Log error, offer manual upload |

---

## UI Copy (Non-tech friendly)

| Internal | English UI | Vietnamese UI |
|----------|-----------|---------------|
| Generate theme | Designing your scene... | Đang thiết kế cảnh... |
| Generate image | Creating background... | Đang tạo hình nền... |
| Regenerate | Try another look | Thử kiểu khác |
| Quota exhausted | You've used all your free creates today | Bạn đã hết lượt tạo miễn phí hôm nay |
| Upgrade CTA | Get more with Pro | Nâng cấp Pro để tạo thêm |
| Upload fallback | Or upload your own image | Hoặc tải ảnh của bạn lên |

---

## Phase Roadmap

| Phase | Scope | API Key |
|-------|-------|---------|
| **Phase 1 (now)** | Client-side, user's Gemini key, soft rate limit | User's key |
| **Phase 2** | Server proxy, your key, hard rate limit, user accounts | Your key |
| **Phase 3** | Cache layer, Batch API for wallpaper variants, Imagen 4 Fast for free | Your key |
