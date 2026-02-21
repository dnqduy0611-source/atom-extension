import { useState, useCallback, useRef } from 'react';
import type { SceneTheme } from '../data/scenes';
import { supabase, SUPABASE_URL } from '../lib/supabaseClient';
import { buildSceneHints } from '../utils/userModel';

/**
 * useGeminiTheme — Calls the create-scene Edge Function (server-side proxy).
 *
 * The server handles:
 *   - Credit/trial checking & deduction
 *   - Gemini text model → theme JSON + imagePrompt
 *   - Gemini image model → background image
 *
 * No API key needed client-side.
 */

export interface AIIconPaths {
    music: string;
    scenes: string;
    focus: string;
    zen: string;
    timer: string;
    tasks: string;
}

export interface GeneratedTheme {
    theme: { day: SceneTheme; night: SceneTheme };
    tags: string[];
    defaultAmbience: string[];
    suggestedTint: { day: string; night: string };
    imagePrompt: string;
    icons?: AIIconPaths;
}

export interface CreateSceneResult {
    generatedTheme: GeneratedTheme;
    imageBlob: Blob | null;
    creditsRemaining: number;
    trialUsed: boolean;
    paymentMethod: 'credits' | 'trial';
}

// ── Hook ──

export function useGeminiTheme() {
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef(false);

    const generate = useCallback(
        async (name: string, description: string): Promise<CreateSceneResult> => {
            setIsGenerating(true);
            setError(null);
            abortRef.current = false;

            try {
                // Get current session
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    throw new Error('Bạn cần đăng nhập để tạo cảnh.');
                }

                // Call create-scene Edge Function
                const res = await fetch(`${SUPABASE_URL}/functions/v1/create-scene`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name,
                        description: description + buildSceneHints(),
                    }),
                });

                const data = await res.json();

                if (!res.ok) {
                    // Handle specific error codes
                    if (res.status === 402) {
                        if (data.code === 'INSUFFICIENT_CREDITS') {
                            throw Object.assign(
                                new Error('Không đủ credits. Mua thêm để tiếp tục.'),
                                { code: 'INSUFFICIENT_CREDITS', balance: data.balance },
                            );
                        }
                        if (data.code === 'TRIAL_EXHAUSTED') {
                            throw Object.assign(
                                new Error('Bạn đã dùng hết lượt thử miễn phí.'),
                                { code: 'TRIAL_EXHAUSTED' },
                            );
                        }
                    }
                    throw new Error(data.error || `Server error (${res.status})`);
                }

                // Parse theme data
                const themeData = data.theme;
                const generatedTheme: GeneratedTheme = {
                    theme: {
                        day: themeData.day as SceneTheme,
                        night: themeData.night as SceneTheme,
                    },
                    tags: Array.isArray(themeData.tags) ? themeData.tags : [],
                    defaultAmbience: Array.isArray(themeData.defaultAmbience) ? themeData.defaultAmbience : ['rain'],
                    suggestedTint: themeData.suggestedTint || { day: 'rgba(0,0,0,0.3)', night: 'rgba(0,0,0,0.5)' },
                    imagePrompt: themeData.imagePrompt || '',
                    icons: themeData.icons,
                };

                // Convert base64 image to Blob if present
                let imageBlob: Blob | null = null;
                if (data.imageBase64) {
                    const mimeType = data.imageMimeType || 'image/png';
                    const bytes = Uint8Array.from(atob(data.imageBase64), (c) => c.charCodeAt(0));
                    imageBlob = new Blob([bytes], { type: mimeType });
                }

                setIsGenerating(false);
                return {
                    generatedTheme,
                    imageBlob,
                    creditsRemaining: data.creditsRemaining ?? 0,
                    trialUsed: data.trialUsed ?? true,
                    paymentMethod: data.paymentMethod,
                };
            } catch (err) {
                setIsGenerating(false);
                const msg = (err as Error).message || 'Failed to generate scene';
                setError(msg);
                throw err;
            }
        },
        [],
    );

    return { generate, isGenerating, error };
}
