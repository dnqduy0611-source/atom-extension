# Implementation Plan - OpenRouter Integration

## Goal
Enable the use of OpenRouter as an alternative LLM provider. This allows access to a wider range of models (including free ones like generic Llama 3, Mistral, and Google's models via OpenRouter) using a unified API.

## User Review Required
> [!IMPORTANT]
> **API Key**: User will need an OpenRouter API Key.
> **Payload Format**: OpenRouter uses the OpenAI Chat Completions API format (`messages` array), while the current implementation uses Google's Gemini API format (`contents` array). We must implement an adapter to support both or switch the internal logic to a standardized format.

## Proposed Changes

### Configuration
#### [MODIFY] [config/ai_config.js](file:///d:/Amo/ATOM_Extension_V2.7.1/config/ai_config.js)
- Add `PROVIDER` setting (values: `GOOGLE`, `OPENROUTER`).
- Add `OPENROUTER` config section (Base URL: `https://openrouter.ai/api/v1`).
- Update `MODELS` to support OpenRouter model IDs (e.g., `google/gemini-2.0-flash-exp:free`, `meta-llama/llama-3-8b-instruct:free`).

### Logic
#### [MODIFY] [sidepanel.js](file:///d:/Amo/ATOM_Extension_V2.7.1/sidepanel.js)
- Rename/Refactor `callGeminiAPI` to `callLLMService`.
- Inside `callLLMService`, check the configured `PROVIDER`.
- **If GOOGLE**: Keep existing logic (Google native format).
- **If OPENROUTER**:
    - Convert `conversationHistory` (Gemini format) to OpenAI `messages` format.
        - Gemini: `[{ role: 'user', parts: [{ text: '...' }] }]`
        - OpenAI: `[{ role: 'user', content: '...' }]`
    - Call OpenRouter endpoint.
    - Parse OpenAI-style response (`choices[0].message.content`).

## Verification Plan

### Automated Tests
- None existing. Will rely on manual verification.

### Manual Verification
1.  **Configure OpenRouter**:
    - Set `PROVIDER` to `OPENROUTER` in code/storage.
    - Set a valid `OPENROUTER_API_KEY`.
    - Set `MODEL_NAME` to a free model (e.g., `google/gemini-2.0-flash-exp:free`).
2.  **Test Chat**:
    - Open Sidepanel.
    - Send a message ("Hello").
    - Verify response comes from OpenRouter (check Network tab for `openrouter.ai` request).
3.  **Test Context/Reading**:
    - Select text -> "Explain".
    - Verify it works with the new provider.
