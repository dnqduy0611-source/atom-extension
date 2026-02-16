import { useMemo } from 'react';
import { useLofiStore } from '../store/useLofiStore';
import { getIconPack } from '../icons';
import type { SceneIconPack } from '../icons/types';

/**
 * useSceneIcons — returns the icon pack for the active scene.
 *
 * Components call this instead of importing lucide-react directly.
 * When the scene changes, all icons update automatically.
 *
 * Usage:
 *   const icons = useSceneIcons();
 *   <icons.ui.play size={18} color="white" />
 *   <icons.ambience.rain size={20} color="var(--theme-primary)" />
 */
export function useSceneIcons(): SceneIconPack {
    const activeSceneId = useLofiStore((s) => s.activeSceneId);

    return useMemo(() => getIconPack(activeSceneId), [activeSceneId]);
}
