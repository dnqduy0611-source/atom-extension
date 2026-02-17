/**
 * useBinauralBeats — Web Audio API binaural beats generator.
 *
 * Plays 2 sine oscillators at slightly different frequencies, one per ear.
 * The brain perceives a "beat" at the difference frequency:
 *
 *   Focus:    Left 100 Hz + Right 140 Hz = 40 Hz Gamma
 *   Relax:    Left 100 Hz + Right 110 Hz = 10 Hz Alpha
 *   Deep:     Left 100 Hz + Right 104 Hz =  4 Hz Theta
 *
 * Requires headphones. Volume is layered: binauralVolume × masterVolume.
 * Auto-switches mode when Pomodoro timer changes work ↔ break.
 */

import { useEffect, useRef } from 'react';
import { useLofiStore } from '../store/useLofiStore';
import { useFocusStore } from '../store/useFocusStore';

const BASE_FREQ = 100; // Hz — carrier tone (inaudible hum)

const BEAT_FREQS: Record<string, number> = {
    focus: 40,   // Gamma — concentration
    relax: 10,   // Alpha — relaxation
    deep: 4,     // Theta — deep rest / meditation
};

const FADE_TIME = 0.8; // seconds — smooth volume transitions

export function useBinauralBeats() {
    const ctxRef = useRef<AudioContext | null>(null);
    const leftOscRef = useRef<OscillatorNode | null>(null);
    const rightOscRef = useRef<OscillatorNode | null>(null);
    const leftGainRef = useRef<GainNode | null>(null);
    const rightGainRef = useRef<GainNode | null>(null);
    const leftPanRef = useRef<StereoPannerNode | null>(null);
    const rightPanRef = useRef<StereoPannerNode | null>(null);
    const isRunningRef = useRef(false);

    // ── Start oscillators ──
    function start(mode: string, volume: number, masterVol: number) {
        if (isRunningRef.current) return;

        const ctx = new AudioContext();
        ctxRef.current = ctx;

        const beatFreq = BEAT_FREQS[mode] ?? 40;
        const effectiveVol = volume * masterVol;

        // Left channel: base frequency
        const leftOsc = ctx.createOscillator();
        const leftGain = ctx.createGain();
        const leftPan = ctx.createStereoPanner();
        leftOsc.type = 'sine';
        leftOsc.frequency.value = BASE_FREQ;
        leftGain.gain.value = 0;
        leftPan.pan.value = -1; // hard left
        leftOsc.connect(leftGain).connect(leftPan).connect(ctx.destination);

        // Right channel: base + beat frequency
        const rightOsc = ctx.createOscillator();
        const rightGain = ctx.createGain();
        const rightPan = ctx.createStereoPanner();
        rightOsc.type = 'sine';
        rightOsc.frequency.value = BASE_FREQ + beatFreq;
        rightGain.gain.value = 0;
        rightPan.pan.value = 1; // hard right
        rightOsc.connect(rightGain).connect(rightPan).connect(ctx.destination);

        leftOsc.start();
        rightOsc.start();

        // Fade in
        leftGain.gain.linearRampToValueAtTime(effectiveVol, ctx.currentTime + FADE_TIME);
        rightGain.gain.linearRampToValueAtTime(effectiveVol, ctx.currentTime + FADE_TIME);

        leftOscRef.current = leftOsc;
        rightOscRef.current = rightOsc;
        leftGainRef.current = leftGain;
        rightGainRef.current = rightGain;
        leftPanRef.current = leftPan;
        rightPanRef.current = rightPan;
        isRunningRef.current = true;
    }

    // ── Stop oscillators ──
    function stop() {
        if (!isRunningRef.current || !ctxRef.current) return;

        const ctx = ctxRef.current;
        const now = ctx.currentTime;

        // Fade out
        leftGainRef.current?.gain.linearRampToValueAtTime(0, now + FADE_TIME);
        rightGainRef.current?.gain.linearRampToValueAtTime(0, now + FADE_TIME);

        // Stop after fade
        setTimeout(() => {
            leftOscRef.current?.stop();
            rightOscRef.current?.stop();
            ctxRef.current?.close();
            ctxRef.current = null;
            leftOscRef.current = null;
            rightOscRef.current = null;
            isRunningRef.current = false;
        }, FADE_TIME * 1000 + 50);
    }

    // ── Update volume without restart ──
    function updateVolume(volume: number, masterVol: number) {
        if (!isRunningRef.current || !ctxRef.current) return;
        const effectiveVol = volume * masterVol;
        const now = ctxRef.current.currentTime;
        leftGainRef.current?.gain.linearRampToValueAtTime(effectiveVol, now + 0.1);
        rightGainRef.current?.gain.linearRampToValueAtTime(effectiveVol, now + 0.1);
    }

    // ── Update beat frequency (mode change) without restart ──
    function updateMode(mode: string) {
        if (!isRunningRef.current || !ctxRef.current) return;
        const beatFreq = BEAT_FREQS[mode] ?? 40;
        const now = ctxRef.current.currentTime;
        // Left stays at base, right shifts smoothly
        rightOscRef.current?.frequency.linearRampToValueAtTime(
            BASE_FREQ + beatFreq,
            now + FADE_TIME,
        );
    }

    // ── React to store changes ──
    useEffect(() => {
        const unsub = useLofiStore.subscribe((curr, prev) => {
            const { binauralEnabled, binauralVolume, binauralMode, masterVolume, isPlaying } = curr;
            const shouldPlay = binauralEnabled && isPlaying;

            // Start/stop
            if (shouldPlay && !isRunningRef.current) {
                start(binauralMode, binauralVolume, masterVolume);
            } else if (!shouldPlay && isRunningRef.current) {
                stop();
            }

            if (!isRunningRef.current) return;

            // Volume change
            if (curr.binauralVolume !== prev.binauralVolume || curr.masterVolume !== prev.masterVolume) {
                updateVolume(binauralVolume, masterVolume);
            }

            // Mode change
            if (curr.binauralMode !== prev.binauralMode) {
                updateMode(binauralMode);
            }
        });

        return () => {
            unsub();
            stop();
        };
    }, []);

    // ── Auto-switch mode based on Pomodoro state ──
    useEffect(() => {
        const unsub = useFocusStore.subscribe((curr, prev) => {
            if (curr.timerMode === prev.timerMode) return;
            const { binauralEnabled } = useLofiStore.getState();
            if (!binauralEnabled) return;

            const newMode = curr.timerMode === 'work' ? 'focus'
                : curr.timerMode === 'longBreak' ? 'deep'
                : 'relax';

            useLofiStore.getState().setBinauralMode(newMode);
        });

        return () => { unsub(); };
    }, []);
}
