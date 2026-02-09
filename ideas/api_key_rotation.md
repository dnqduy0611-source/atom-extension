# API Key Rotation Feature

> **Status**: Idea (Not Implemented)  
> **Created**: 2026-02-03  
> **Priority**: Low

## Overview

Support multiple API keys with automatic rotation when one hits rate limits.

## Why This Matters

- Single API key can exhaust quota quickly with heavy usage
- Auto-rotation allows continuous operation by switching to backup keys
- Reduces user frustration from rate limit interruptions

## Proposed Implementation

### Storage Schema
```javascript
{
    "atom_api_keys_config": {
        "keys": [
            { "key": "AIza...", "label": "Primary", "enabled": true, "cooldownUntil": 0 },
            { "key": "AIza...", "label": "Backup 1", "enabled": true, "cooldownUntil": 0 }
        ],
        "activeIndex": 0
    }
}
```

### Rotation Logic
1. Request → Use active key
2. If 429 → Mark current key in cooldown
3. Find next enabled key not in cooldown
4. Switch to that key
5. Retry request
6. If no keys available → Show error to user

### UI in Options Page
- List of API keys with labels
- Add/Remove/Enable/Disable buttons
- Status indicator per key (Active, Cooldown, Disabled)
- "Test Key" button

### Files to Modify
- `services/api_key_manager.js` ← Already created (skeleton)
- `options.html` + `options.js` — Multi-key management UI
- `background.js` — Use key from ApiKeyManager
- `sidepanel.js` — Use key from ApiKeyManager
- `ai_service.js` — Use key from ApiKeyManager

## Estimated Effort
- 6-8 hours for full implementation
- Need Options page UI redesign

## Related Files
- `services/api_key_manager.js` — Skeleton already exists
