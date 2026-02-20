/**
 * useGenerateBackground — Calls the generate-background Edge Function.
 *
 * Server handles:
 *   - Pro check + credit deduction (10 credits)
 *   - Gemini text model → image prompt
 *   - Gemini image model → background image
 *   - Storage upload + metadata save
 *   - Automatic refund on failure
 */

import { useState, useCallback, useRef } from 'react';
import { supabase, SUPABASE_URL } from '../lib/supabaseClient';
import type { UserBackground } from './useBackgrounds';

export type GeneratePhase = 'idle' | 'prompting' | 'generating' | 'saving' | 'done' | 'error';

export interface GenerateResult {
    background: UserBackground;
    imagePrompt: string;
    creditsRemaining: number;
}

export function useGenerateBackground() {
    const [isGenerating, setIsGenerating] = useState(false);
    const [phase, setPhase] = useState<GeneratePhase>('idle');
    const [error, setError] = useState<string | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const abortRef = useRef(false);

    const generate = useCallback(async (
        sceneName: string,
        sceneDescription: string,
        style?: string,
        sceneId?: string,
    ): Promise<GenerateResult> => {
        setIsGenerating(true);
        setError(null);
        setPreview(null);
        setPhase('prompting');
        abortRef.current = false;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Bạn cần đăng nhập.');

            setPhase('generating');

            const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-background`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sceneName,
                    sceneDescription,
                    style: style || 'realistic',
                    sceneId,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                if (data.code === 'INSUFFICIENT_CREDITS') {
                    throw Object.assign(
                        new Error('Không đủ credits. Cần 10 credits.'),
                        { code: 'INSUFFICIENT_CREDITS', balance: data.balance },
                    );
                }
                if (data.code === 'NOT_PRO') {
                    throw Object.assign(new Error('Cần nâng cấp Pro.'), { code: 'NOT_PRO' });
                }
                if (data.code === 'STORAGE_LIMIT') {
                    throw Object.assign(new Error('Đã đạt giới hạn 50 backgrounds.'), { code: 'STORAGE_LIMIT' });
                }
                throw new Error(data.error || `Server error (${res.status})`);
            }

            setPhase('saving');

            const bg: UserBackground = {
                id: data.background.id,
                name: data.background.name,
                source: 'ai_generated',
                storage_path: data.background.storage_path,
                signedUrl: data.background.signedUrl || '',
                file_size_bytes: data.background.file_size_bytes,
                width: data.background.width,
                height: data.background.height,
                ai_prompt: data.background.ai_prompt || data.imagePrompt,
                created_at: data.background.created_at,
                scene_ids: [],
            };

            setPreview(bg.signedUrl);
            setPhase('done');

            return {
                background: bg,
                imagePrompt: data.imagePrompt,
                creditsRemaining: data.creditsRemaining,
            };
        } catch (err) {
            setPhase('error');
            const msg = (err as Error).message || 'Generation failed';
            setError(msg);
            throw err;
        } finally {
            setIsGenerating(false);
        }
    }, []);

    const reset = useCallback(() => {
        setPhase('idle');
        setError(null);
        setPreview(null);
        setIsGenerating(false);
    }, []);

    return { generate, isGenerating, phase, error, preview, reset };
}
