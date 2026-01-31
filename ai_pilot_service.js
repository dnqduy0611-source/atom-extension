// ai_pilot_service.js - AI Pilot teacher adapter (build prompt + validate)

const SYSTEM_PROMPT = `You are ATOM AI-Pilot (teacher). Your job is to classify user engagement mode and recommend an intervention.

Return ONLY valid JSON, no markdown, no extra commentary, no trailing commas.
Use exactly the keys and types defined in the schema below.
All scores must be numbers in [0,1]. confidence must reflect uncertainty.
cooldown_s must be an integer in [0,120].
why_short must be <= 140 characters.

If the input text is too short or ambiguous, return low confidence and recommend "none" or "presence".
Never include any personally identifying information in why_short.

Schema:
{
  "intent_score": number,
  "compulsion_score": number,
  "mode": "intentional"|"mixed"|"doomscroll",
  "confidence": number,
  "recommend": "none"|"presence"|"micro"|"gentle"|"hard",
  "hard_mode": "BREATH"|"TAP"|"STILLNESS"|null,
  "cooldown_s": integer,
  "why_short": string,
  "ai_reason_codes": string[]
}

ai_reason_codes must be chosen from the allowed list provided in the user message.`;

const AI_REASON_CODES = new Set([
  "AI_PAGE_FEED_INFINITE",
  "AI_PAGE_VIDEO_SHORTS",
  "AI_PAGE_ARTICLE_DENSE",
  "AI_PAGE_FORUM_THREAD",
  "AI_TEXT_ANALYTICAL_GUIDE",
  "AI_TEXT_ENTERTAINMENT_BUT_STRUCTURED",
  "AI_TEXT_LOW_SIGNAL_NO_CONTEXT",
  "AI_BEHAVIOR_CONTINUOUS_SCROLL_HIGH",
  "AI_BEHAVIOR_DWELL_DEEP",
  "AI_BEHAVIOR_SCROLL_BACK_REREAD",
  "AI_ACTION_FIND_USED",
  "AI_ACTION_SELECT_COPY_USED",
  "AI_ACTION_OPEN_RELATED_LINKS",
  "AI_ACTION_NAV_BACK_FORWARD",
  "AI_INTENT_HIGH_TOPIC_COHERENCE",
  "AI_COMPULSION_HIGH_FAST_REFRESH",
  "AI_MIXED_ENJOYMENT_WITH_PULL",
  "AI_LOW_CONFIDENCE_AMBIGUOUS"
]);

const DECISION_SCHEMA = {
  type: "object",
  properties: {
    intent_score: { type: "number" },
    compulsion_score: { type: "number" },
    mode: { type: "string", enum: ["intentional", "mixed", "doomscroll"] },
    confidence: { type: "number" },
    recommend: { type: "string", enum: ["none", "presence", "micro", "gentle", "hard"] },
    hard_mode: { type: ["string", "null"], enum: ["BREATH", "TAP", "STILLNESS", null] },
    cooldown_s: { type: "integer" },
    why_short: { type: "string" },
    ai_reason_codes: { type: "array", items: { type: "string" } }
  },
  required: [
    "intent_score",
    "compulsion_score",
    "mode",
    "confidence",
    "recommend",
    "hard_mode",
    "cooldown_s",
    "why_short",
    "ai_reason_codes"
  ],
  additionalProperties: false
};

const RECOMMEND = new Set(["none", "presence", "micro", "gentle", "hard"]);
const MODE = new Set(["intentional", "mixed", "doomscroll"]);
const HARD_MODE = new Set(["BREATH", "TAP", "STILLNESS"]);

function in01(x) {
  return typeof x === "number" && x >= 0 && x <= 1;
}

function buildUserPrompt(frame) {
  const allowedCodes = Array.from(AI_REASON_CODES).join("\n");
  return `Task:
Classify whether the user is intentionally engaged (reading with curiosity/learning/goal), mixed, or doomscrolling.
Use BOTH behavior signals and content context (title/headings/viewport snippet).
Return JSON strictly following the schema.

Definitions:
- intent_score (0..1): Higher when user shows purposeful reading/curiosity/learning/goal-oriented exploration.
  Signals: long dwell on paragraphs, scroll-back to reread, select/copy/find, opening related links, text-dense analytical content.
- compulsion_score (0..1): Higher when user shows compulsive consumption.
  Signals: continuous scrolling, short dwell repeated, feed/shorts/infinite scroll, rapid topic switching, few active signals.
- mode rules:
  - doomscroll: compulsion high AND intent low
  - intentional: intent high AND compulsion low/moderate
  - mixed: both moderate/high (user may enjoy content but is being pulled by feed)

Recommendation policy:
- intentional: recommend "none" or "presence"
- mixed: recommend "presence" or "gentle"
- doomscroll: recommend "micro" or "hard" (hard only if strong compulsion, and not recently interrupted)

Allowed ai_reason_codes:
${allowedCodes}

Input frame:
${JSON.stringify(frame)}

Output: JSON only.`;
}

export function deriveExpectedAiReasonCodes(frame, aiOut) {
  const exp = new Set();

  const page = frame?.page || {};
  const snip = frame?.snippet || {};
  const beh = frame?.behavior_60s || {};
  const act = frame?.actions_60s || {};

  if (page.pageType === "feed" || page.isInfiniteScrollLikely) exp.add("AI_PAGE_FEED_INFINITE");
  if (page.pageType === "video" || page.hasVideoLikely) exp.add("AI_PAGE_VIDEO_SHORTS");
  if (page.pageType === "article" && (page.wordCountApprox || 0) > 800) exp.add("AI_PAGE_ARTICLE_DENSE");
  if (page.pageType === "forum") exp.add("AI_PAGE_FORUM_THREAD");

  if ((snip.viewportTextChars || 0) < 200 && (snip.selectedTextChars || 0) === 0) {
    exp.add("AI_TEXT_LOW_SIGNAL_NO_CONTEXT");
  }

  if ((beh.continuousScrollSec || 0) > 20) exp.add("AI_BEHAVIOR_CONTINUOUS_SCROLL_HIGH");
  if ((beh.dwellP90Ms || 0) > 4500) exp.add("AI_BEHAVIOR_DWELL_DEEP");
  if ((beh.scrollBackEvents || 0) >= 1) exp.add("AI_BEHAVIOR_SCROLL_BACK_REREAD");

  if ((act.findCount || 0) >= 1) exp.add("AI_ACTION_FIND_USED");
  if (((act.selectCount || 0) + (act.copyCount || 0)) >= 1) exp.add("AI_ACTION_SELECT_COPY_USED");
  if ((act.openLinkCount || 0) >= 1) exp.add("AI_ACTION_OPEN_RELATED_LINKS");
  if ((act.backForwardCount || 0) >= 1) exp.add("AI_ACTION_NAV_BACK_FORWARD");

  if (aiOut) {
    if ((aiOut.intent_score ?? 0) >= 0.7) exp.add("AI_INTENT_HIGH_TOPIC_COHERENCE");
    if ((aiOut.compulsion_score ?? 0) >= 0.75) exp.add("AI_COMPULSION_HIGH_FAST_REFRESH");
    if (aiOut.mode === "mixed") exp.add("AI_MIXED_ENJOYMENT_WITH_PULL");
    if ((aiOut.confidence ?? 1) < 0.45) exp.add("AI_LOW_CONFIDENCE_AMBIGUOUS");
  }

  return [...exp];
}

export function validateAiDecisionOutput(out, frame) {
  const errors = [];
  const warnings = [];

  if (!out || typeof out !== "object") {
    return { ok: false, sanitized: null, errors: ["AI_OUTPUT_NOT_OBJECT"], warnings };
  }

  if (!in01(out.intent_score)) errors.push("AI_BAD_INTENT_SCORE");
  if (!in01(out.compulsion_score)) errors.push("AI_BAD_COMPULSION_SCORE");
  if (!in01(out.confidence)) errors.push("AI_BAD_CONFIDENCE");

  if (!MODE.has(out.mode)) errors.push("AI_BAD_MODE");
  if (!RECOMMEND.has(out.recommend)) errors.push("AI_BAD_RECOMMEND");

  if (!(out.hard_mode === null || HARD_MODE.has(out.hard_mode))) errors.push("AI_BAD_HARD_MODE");

  if (!Number.isInteger(out.cooldown_s) || out.cooldown_s < 0 || out.cooldown_s > 120) {
    errors.push("AI_BAD_COOLDOWN");
  }

  if (typeof out.why_short !== "string") errors.push("AI_BAD_WHY_TYPE");
  else if (out.why_short.length > 140) errors.push("AI_WHY_TOO_LONG");

  let codes = Array.isArray(out.ai_reason_codes) ? out.ai_reason_codes : null;
  if (!codes) {
    warnings.push("AI_MISSING_REASON_CODES");
    codes = [];
  }

  const unknown = [];
  const sanitizedCodes = [];
  for (const c of codes) {
    if (typeof c !== "string") continue;
    if (!AI_REASON_CODES.has(c)) unknown.push(c);
    else sanitizedCodes.push(c);
  }

  if (unknown.length) {
    warnings.push("AI_UNKNOWN_REASON_CODES:" + unknown.join(","));
  }

  const expectedCodes = deriveExpectedAiReasonCodes(frame, out);
  if (out.mode === "doomscroll" && !sanitizedCodes.includes("AI_BEHAVIOR_CONTINUOUS_SCROLL_HIGH")) {
    warnings.push("AI_DOOMSCROLL_WITHOUT_CONTINUOUS_SCROLL_CODE");
  }
  if (out.mode === "intentional" && out.intent_score >= 0.7
      && !sanitizedCodes.includes("AI_BEHAVIOR_DWELL_DEEP")
      && !sanitizedCodes.includes("AI_ACTION_FIND_USED")
      && !sanitizedCodes.includes("AI_ACTION_SELECT_COPY_USED")) {
    warnings.push("AI_INTENT_HIGH_WITHOUT_ACTIVE_SIGNALS");
  }
  if (out.confidence < 0.45 && !sanitizedCodes.includes("AI_LOW_CONFIDENCE_AMBIGUOUS")) {
    warnings.push("AI_LOW_CONFIDENCE_MISSING_AMBIGUOUS_CODE");
  }

  const sanitized = {
    intent_score: out.intent_score,
    compulsion_score: out.compulsion_score,
    mode: out.mode,
    confidence: out.confidence,
    recommend: out.recommend,
    hard_mode: out.hard_mode ?? null,
    cooldown_s: out.cooldown_s,
    why_short: out.why_short ?? "",
    ai_reason_codes: sanitizedCodes
  };

  return {
    ok: errors.length === 0,
    sanitized,
    errors,
    warnings,
    expectedCodes
  };
}

export class AIPilotService {
  constructor(provider) {
    this.provider = provider;
    this.cache = new Map();
  }

  async classify(frame, options = {}) {
    const timeoutMs = options.timeoutMs ?? 800;
    const cacheKey = options.cacheKey || null;
    const cacheTtlMs = options.cacheTtlMs ?? 15000;
    const prompt = `${SYSTEM_PROMPT}\n\n${buildUserPrompt(frame)}`;
    const now = Date.now();

    if (cacheKey) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        return { ...cached.value, fromCache: true };
      }
    }

    const raw = await this.provider.classify(prompt, DECISION_SCHEMA, timeoutMs, 0);
    const result = validateAiDecisionOutput(raw, frame);
    const wrapped = {
      ...result,
      raw,
      fromCache: false
    };

    if (cacheKey && cacheTtlMs > 0) {
      this.cache.set(cacheKey, { value: wrapped, expiresAt: now + cacheTtlMs });
    }

    return wrapped;
  }
}
