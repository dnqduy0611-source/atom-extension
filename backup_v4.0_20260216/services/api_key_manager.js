// services/api_key_manager.js
// Manages multiple API keys with automatic rotation on rate limit

const STORAGE_KEY = 'atom_api_keys_config';

class ApiKeyManager {
    constructor() {
        this.keys = [];           // Array of { key, label, enabled, cooldownUntil }
        this.activeIndex = 0;
        this.loaded = false;
        this._loadFromStorage();
    }

    async _loadFromStorage() {
        try {
            const data = await chrome.storage.local.get([STORAGE_KEY, 'user_gemini_key']);

            if (data[STORAGE_KEY] && data[STORAGE_KEY].keys?.length) {
                // Use stored multi-key config
                this.keys = data[STORAGE_KEY].keys;
                this.activeIndex = data[STORAGE_KEY].activeIndex || 0;
            } else if (data.user_gemini_key) {
                // Migrate from single key
                this.keys = [{
                    key: data.user_gemini_key,
                    label: 'Primary',
                    enabled: true,
                    cooldownUntil: 0
                }];
                this.activeIndex = 0;
            }

            this.loaded = true;
            console.log('[ApiKeyManager] Loaded', this.keys.length, 'keys');
        } catch (e) {
            console.warn('[ApiKeyManager] Load error:', e);
            this.loaded = true;
        }
    }

    async _saveToStorage() {
        try {
            await chrome.storage.local.set({
                [STORAGE_KEY]: {
                    keys: this.keys,
                    activeIndex: this.activeIndex
                }
            });
        } catch (e) {
            console.warn('[ApiKeyManager] Save error:', e);
        }
    }

    /**
     * Get current active API key
     * @returns {string|null}
     */
    getActiveKey() {
        const enabledKeys = this.keys.filter(k => k.enabled);
        if (enabledKeys.length === 0) return null;

        // Find first available key
        const now = Date.now();
        for (let i = 0; i < this.keys.length; i++) {
            const idx = (this.activeIndex + i) % this.keys.length;
            const keyConfig = this.keys[idx];

            if (keyConfig.enabled && keyConfig.cooldownUntil <= now) {
                if (idx !== this.activeIndex) {
                    this.activeIndex = idx;
                    this._saveToStorage();
                    console.log('[ApiKeyManager] Switched to key:', keyConfig.label);
                }
                return keyConfig.key;
            }
        }

        // All keys in cooldown, return first enabled key anyway
        const firstEnabled = this.keys.find(k => k.enabled);
        return firstEnabled?.key || null;
    }

    /**
     * Mark current key as rate limited
     * @param {number} cooldownMs - Cooldown duration in ms
     * @returns {{ rotated: boolean }} Whether rotation to new key succeeded
     */
    markKeyRateLimited(cooldownMs = 60000) {
        if (this.keys.length === 0) return { rotated: false };

        const currentKey = this.keys[this.activeIndex];
        if (currentKey) {
            currentKey.cooldownUntil = Date.now() + cooldownMs;
            console.log('[ApiKeyManager] Key', currentKey.label, 'rate limited for', cooldownMs, 'ms');

            // Try to rotate to next available key
            const rotated = this._rotateToNext();
            this._saveToStorage();

            // If we successfully rotated to a new key, emit event to reset global rate limiter
            if (rotated) {
                this._emitKeyRotated();
            }

            return { rotated };
        }
        return { rotated: false };
    }

    /**
     * Emit event when key rotation happens
     * This allows RateLimitManager to reset its cooldown for the fresh key
     */
    _emitKeyRotated() {
        // Dispatch custom event for other modules to listen
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('atom:api-key-rotated', {
                detail: { activeKey: this.keys[this.activeIndex]?.label }
            }));
        }
        // Also try to directly call the global rate manager if available
        if (typeof window !== 'undefined' && window.__ATOM_RATE_MANAGER__?.resetCooldown) {
            console.log('[ApiKeyManager] Calling RateLimitManager.resetCooldown() on key rotation');
            window.__ATOM_RATE_MANAGER__.resetCooldown();
        }
    }

    /**
     * Rotate to next available key
     * @returns {boolean} Whether rotation succeeded
     */
    _rotateToNext() {
        const now = Date.now();
        for (let i = 1; i < this.keys.length; i++) {
            const idx = (this.activeIndex + i) % this.keys.length;
            const keyConfig = this.keys[idx];

            if (keyConfig.enabled && keyConfig.cooldownUntil <= now) {
                this.activeIndex = idx;
                console.log('[ApiKeyManager] Rotated to key:', keyConfig.label);
                return true;
            }
        }
        return false;
    }

    /**
     * Add a new API key
     * @param {string} key - API key
     * @param {string} label - User-friendly label
     */
    async addKey(key, label = 'API Key') {
        // Check if key already exists
        if (this.keys.some(k => k.key === key)) {
            return { ok: false, error: 'Key already exists' };
        }

        this.keys.push({
            key,
            label: label || `Key ${this.keys.length + 1}`,
            enabled: true,
            cooldownUntil: 0
        });

        await this._saveToStorage();
        return { ok: true };
    }

    /**
     * Remove a key by index
     */
    async removeKey(index) {
        if (index < 0 || index >= this.keys.length) return false;

        this.keys.splice(index, 1);

        // Adjust activeIndex if needed
        if (this.activeIndex >= this.keys.length) {
            this.activeIndex = Math.max(0, this.keys.length - 1);
        }

        await this._saveToStorage();
        return true;
    }

    /**
     * Toggle key enabled status
     */
    async toggleKey(index, enabled) {
        if (index < 0 || index >= this.keys.length) return false;

        this.keys[index].enabled = enabled;
        await this._saveToStorage();
        return true;
    }

    /**
     * Get all keys (masked for display)
     */
    getKeysForDisplay() {
        return this.keys.map((k, idx) => ({
            label: k.label,
            keyPreview: k.key ? `${k.key.slice(0, 8)}...${k.key.slice(-4)}` : '',
            enabled: k.enabled,
            isActive: idx === this.activeIndex,
            inCooldown: k.cooldownUntil > Date.now(),
            cooldownRemainingSec: Math.max(0, Math.ceil((k.cooldownUntil - Date.now()) / 1000))
        }));
    }

    /**
     * Clear cooldown for all keys
     */
    async clearAllCooldowns() {
        for (const k of this.keys) {
            k.cooldownUntil = 0;
        }
        await this._saveToStorage();
        console.log('[ApiKeyManager] All cooldowns cleared');
    }
}

// Singleton instance
const apiKeyManager = new ApiKeyManager();

export { ApiKeyManager, apiKeyManager };
