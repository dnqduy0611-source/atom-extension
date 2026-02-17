import { useEffect, useRef, useCallback } from 'react';
import { Howl } from 'howler';
import { useLofiStore } from '../store/useLofiStore';
import { musicTracks } from '../data/musicTracks';
import { ambienceSounds } from '../data/ambienceSounds';

// ══════════════════════════════════════════════════════
//  Audio Engine — Howler.js multi-track management
//
//  Manages 1 music track + up to 3 ambience layers.
//  Reacts to Zustand store changes automatically.
//  Volume formula: layerVolume × masterVolume
// ══════════════════════════════════════════════════════

const MUSIC_FADE_MS = 500;
const AMBIENCE_FADE_MS = 300;

interface AudioState {
    howl: Howl;
    id: string;
}

export function useAudioEngine() {
    const musicRef = useRef<AudioState | null>(null);
    const ambienceMapRef = useRef<Map<string, Howl>>(new Map());
    const isMountedRef = useRef(true);

    // ── Get current store values (non-reactive for callbacks) ──
    const getState = useLofiStore.getState;

    // ── Create a Howl instance ──
    const createHowl = useCallback((src: string, loop: boolean, volume: number): Howl | null => {
        try {
            return new Howl({
                src: [src],
                loop,
                volume,
                html5: true, // Stream for large files, better memory
                preload: true,
                onloaderror: (_id: number, err: unknown) => {
                    console.warn(`[Audio] Failed to load: ${src}`, err);
                },
                onplayerror: (_id: number, err: unknown) => {
                    console.warn(`[Audio] Failed to play: ${src}`, err);
                },
            });
        } catch (e) {
            console.warn(`[Audio] Error creating Howl for: ${src}`, e);
            return null;
        }
    }, []);

    // ── Music: Load & play with crossfade ──
    const loadMusic = useCallback((trackId: string) => {
        const track = musicTracks.find((t) => t.id === trackId);
        if (!track) return;

        const state = getState();
        const targetVolume = (state.musicTrack?.volume ?? 0.5) * state.masterVolume;

        // If same track already loaded, skip
        if (musicRef.current?.id === trackId) return;

        // Fade out current music
        if (musicRef.current) {
            const oldHowl = musicRef.current.howl;
            oldHowl.fade(oldHowl.volume(), 0, MUSIC_FADE_MS);
            setTimeout(() => {
                oldHowl.stop();
                oldHowl.unload();
            }, MUSIC_FADE_MS + 50);
        }

        // Create new music
        const howl = createHowl(track.src, true, 0);
        if (!howl) return;

        musicRef.current = { howl, id: trackId };

        howl.once('load', () => {
            if (!isMountedRef.current) return;
            if (getState().isPlaying) {
                howl.play();
                howl.fade(0, targetVolume, MUSIC_FADE_MS);
            } else {
                howl.volume(targetVolume);
            }
        });
    }, [createHowl, getState]);

    // ── Ambience: Toggle layer on/off ──
    const syncAmbienceLayers = useCallback(() => {
        const state = getState();
        const activeLayers = state.ambienceLayers.filter((l) => l.active);
        const activeIds = new Set(activeLayers.map((l) => l.id));

        // Remove layers that are no longer active
        ambienceMapRef.current.forEach((howl, id) => {
            if (!activeIds.has(id)) {
                howl.fade(howl.volume(), 0, AMBIENCE_FADE_MS);
                setTimeout(() => {
                    howl.stop();
                    howl.unload();
                    ambienceMapRef.current.delete(id);
                }, AMBIENCE_FADE_MS + 50);
            }
        });

        // Add new active layers
        for (const layer of activeLayers) {
            if (ambienceMapRef.current.has(layer.id)) {
                // Update volume of existing layer
                const howl = ambienceMapRef.current.get(layer.id)!;
                const targetVol = layer.volume * state.masterVolume;
                howl.volume(targetVol);
                continue;
            }

            // Create new ambience howl
            const sound = ambienceSounds.find((s) => s.id === layer.id);
            if (!sound) continue;

            const targetVol = layer.volume * state.masterVolume;
            const howl = createHowl(sound.src, true, 0);
            if (!howl) continue;

            ambienceMapRef.current.set(layer.id, howl);

            howl.once('load', () => {
                if (!isMountedRef.current) return;
                if (getState().isPlaying) {
                    howl.play();
                    howl.fade(0, targetVol, AMBIENCE_FADE_MS);
                } else {
                    howl.volume(targetVol);
                }
            });
        }
    }, [createHowl, getState]);

    // ── Update all volumes (music + ambience) ──
    const updateAllVolumes = useCallback(() => {
        const state = getState();

        // Music volume
        if (musicRef.current) {
            const musicVol = (state.musicTrack?.volume ?? 0.5) * state.masterVolume;
            musicRef.current.howl.volume(musicVol);
        }

        // Ambience volumes
        for (const layer of state.ambienceLayers) {
            if (layer.active && ambienceMapRef.current.has(layer.id)) {
                const howl = ambienceMapRef.current.get(layer.id)!;
                howl.volume(layer.volume * state.masterVolume);
            }
        }
    }, [getState]);

    // ── Play / Pause all ──
    const syncPlayback = useCallback((isPlaying: boolean) => {
        if (isPlaying) {
            musicRef.current?.howl.play();
            ambienceMapRef.current.forEach((howl) => howl.play());
        } else {
            musicRef.current?.howl.pause();
            ambienceMapRef.current.forEach((howl) => howl.pause());
        }
    }, []);

    // ══════════════════════════════════════════════════
    //  Subscribe to store changes
    // ══════════════════════════════════════════════════

    useEffect(() => {
        isMountedRef.current = true;

        // Initial load
        const state = getState();
        if (state.musicTrack) {
            loadMusic(state.musicTrack.id);
        }
        syncAmbienceLayers();

        // Subscribe to store changes
        const unsub = useLofiStore.subscribe((curr, prev) => {
            // Music track changed
            if (curr.musicTrack?.id !== prev.musicTrack?.id) {
                if (curr.musicTrack) {
                    loadMusic(curr.musicTrack.id);
                } else {
                    // Music cleared
                    if (musicRef.current) {
                        musicRef.current.howl.fade(musicRef.current.howl.volume(), 0, MUSIC_FADE_MS);
                        setTimeout(() => {
                            musicRef.current?.howl.stop();
                            musicRef.current?.howl.unload();
                            musicRef.current = null;
                        }, MUSIC_FADE_MS + 50);
                    }
                }
            }

            // Music volume changed (but not track change)
            if (
                curr.musicTrack?.id === prev.musicTrack?.id &&
                (curr.musicTrack?.volume !== prev.musicTrack?.volume ||
                    curr.masterVolume !== prev.masterVolume)
            ) {
                updateAllVolumes();
            }

            // Ambience layers changed
            if (curr.ambienceLayers !== prev.ambienceLayers) {
                syncAmbienceLayers();
            }

            // Master volume changed (update all)
            if (curr.masterVolume !== prev.masterVolume) {
                updateAllVolumes();
            }

            // Play/pause changed
            if (curr.isPlaying !== prev.isPlaying) {
                syncPlayback(curr.isPlaying);
            }
        });

        return () => {
            isMountedRef.current = false;
            unsub();

            // Cleanup all audio
            if (musicRef.current) {
                musicRef.current.howl.stop();
                musicRef.current.howl.unload();
                musicRef.current = null;
            }
            ambienceMapRef.current.forEach((howl) => {
                howl.stop();
                howl.unload();
            });
            ambienceMapRef.current.clear();
        };
    }, [getState, loadMusic, syncAmbienceLayers, updateAllVolumes, syncPlayback]);

    // ── Return current state for UI ──
    return {
        /** Check if music is currently loaded */
        isMusicLoaded: () => musicRef.current !== null,
        /** Get number of active ambience layers */
        activeAmbienceCount: () => ambienceMapRef.current.size,
    };
}
