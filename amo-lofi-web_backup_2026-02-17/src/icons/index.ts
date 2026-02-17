/**
 * Icon Pack Registry
 * ──────────────────
 * Central registry mapping scene IDs → icon packs.
 *
 * Built-in scenes register their packs at import time.
 * AI-generated scenes register packs at runtime via registerIconPack().
 *
 * Scenes without an entry here → defaultPack (lucide-react).
 */

import { defaultPack } from './packs/defaultPack';
import { cafePack } from './packs/cafePack';
import { spacePack } from './packs/spacePack';
import { gardenPack } from './packs/gardenPack';
import { cityPack } from './packs/cityPack';
import { forestPack } from './packs/forestPack';
import { oceanPack } from './packs/oceanPack';
import { cyberpunkPack } from './packs/cyberpunkPack';
import { ghibliPack } from './packs/ghibliPack';
import type { SceneIconPack } from './types';

export type { SceneIconPack, IconProps } from './types';

// ── Internal registry ──

const _registry = new Map<string, SceneIconPack>();

// ── Public API ──

/**
 * Register an icon pack for a scene.
 * Called statically for built-in packs, or at runtime for AI packs.
 */
export function registerIconPack(sceneId: string, pack: SceneIconPack): void {
    _registry.set(sceneId, pack);
}

/**
 * Get the icon pack for a scene.
 * Returns defaultPack if no custom pack is registered.
 */
export function getIconPack(sceneId: string): SceneIconPack {
    return _registry.get(sceneId) ?? defaultPack;
}

/**
 * Check if a scene has a custom icon pack registered.
 */
export function hasCustomIconPack(sceneId: string): boolean {
    return _registry.has(sceneId);
}

export { defaultPack };

// ── Static registration for built-in scene packs ──
registerIconPack('cozy_cafe', cafePack);
registerIconPack('space_station', spacePack);
registerIconPack('japanese_garden', gardenPack);
registerIconPack('city_night', cityPack);
registerIconPack('forest_cabin', forestPack);
registerIconPack('ocean_cliff', oceanPack);
registerIconPack('cyberpunk_alley', cyberpunkPack);
registerIconPack('ghibli_meadow', ghibliPack);
