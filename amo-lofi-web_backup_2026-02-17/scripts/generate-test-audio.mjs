/**
 * Generate Test Audio Files for Amo Lofi
 *
 * Run: node scripts/generate-test-audio.mjs
 *
 * Creates simple tone-based MP3-compatible WAV files for testing
 * the audio engine before real assets are available.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const SAMPLE_RATE = 44100;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

// Create a sine wave WAV buffer
function createToneWav(frequency, durationSec, volume = 0.3) {
    const numSamples = SAMPLE_RATE * durationSec;
    const dataSize = numSamples * CHANNELS * (BITS_PER_SAMPLE / 8);
    const buffer = Buffer.alloc(44 + dataSize);

    // WAV header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // chunk size
    buffer.writeUInt16LE(1, 20);  // PCM
    buffer.writeUInt16LE(CHANNELS, 22);
    buffer.writeUInt32LE(SAMPLE_RATE, 24);
    buffer.writeUInt32LE(SAMPLE_RATE * CHANNELS * (BITS_PER_SAMPLE / 8), 28);
    buffer.writeUInt16LE(CHANNELS * (BITS_PER_SAMPLE / 8), 32);
    buffer.writeUInt16LE(BITS_PER_SAMPLE, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    // Generate sine wave
    for (let i = 0; i < numSamples; i++) {
        const t = i / SAMPLE_RATE;
        // Add slight variation for more natural sound
        const sample = Math.sin(2 * Math.PI * frequency * t) * volume;
        const val = Math.max(-1, Math.min(1, sample));
        buffer.writeInt16LE(Math.round(val * 32767), 44 + i * 2);
    }

    return buffer;
}

// Create ambient noise (white noise filtered)
function createNoiseWav(durationSec, volume = 0.15) {
    const numSamples = SAMPLE_RATE * durationSec;
    const dataSize = numSamples * CHANNELS * (BITS_PER_SAMPLE / 8);
    const buffer = Buffer.alloc(44 + dataSize);

    // WAV header (same as above)
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(CHANNELS, 22);
    buffer.writeUInt32LE(SAMPLE_RATE, 24);
    buffer.writeUInt32LE(SAMPLE_RATE * CHANNELS * (BITS_PER_SAMPLE / 8), 28);
    buffer.writeUInt16LE(CHANNELS * (BITS_PER_SAMPLE / 8), 32);
    buffer.writeUInt16LE(BITS_PER_SAMPLE, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    // Generate filtered noise
    let prev = 0;
    for (let i = 0; i < numSamples; i++) {
        const noise = (Math.random() * 2 - 1) * volume;
        // Simple low-pass filter for smoother sound
        prev = prev * 0.95 + noise * 0.05;
        buffer.writeInt16LE(Math.round(prev * 32767), 44 + i * 2);
    }

    return buffer;
}

// ── Generate files ──
const publicDir = join(process.cwd(), 'public', 'assets', 'audio');

const musicDir = join(publicDir, 'music');
const ambienceDir = join(publicDir, 'ambience');

[musicDir, ambienceDir].forEach(dir => {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
});

console.log('🎵 Generating test audio files...\n');

// Music tracks (different frequencies = different "songs")
const musicFiles = [
    { name: 'lofi_chill_01', freq: 261.63, label: 'C4 (Afternoon Drift)' },
    { name: 'lofi_chill_02', freq: 293.66, label: 'D4 (Rainy Window)' },
    { name: 'synthwave_01', freq: 329.63, label: 'E4 (Neon Pulse)' },
    { name: 'classical_01', freq: 349.23, label: 'F4 (Nocturne Dream)' },
    { name: 'ambient_01', freq: 392.00, label: 'G4 (Deep Orbit)' },
];

for (const track of musicFiles) {
    const wav = createToneWav(track.freq, 10, 0.25);  // 10 second loops
    const path = join(musicDir, `${track.name}.mp3`);  // .mp3 extension for Howler path matching
    writeFileSync(path, wav);
    console.log(`  ✅ music/${track.name}.mp3 — ${track.label}`);
}

// Ambience sounds (noise-based, different characteristics)
const ambienceFiles = [
    { name: 'rain', type: 'noise', label: 'Rain (filtered noise)' },
    { name: 'thunder', type: 'tone', freq: 80, label: 'Thunder (low rumble)' },
    { name: 'wind', type: 'noise', label: 'Wind (noise)' },
    { name: 'fire', type: 'tone', freq: 180, label: 'Fire (crackle tone)' },
    { name: 'coffee_shop', type: 'noise', label: 'Coffee Shop (chatter noise)' },
    { name: 'ocean', type: 'tone', freq: 120, label: 'Ocean (wave tone)' },
    { name: 'white_noise', type: 'noise', label: 'White Noise' },
];

for (const sound of ambienceFiles) {
    let wav;
    if (sound.type === 'noise') {
        wav = createNoiseWav(8, 0.15);  // 8 second loops
    } else {
        wav = createToneWav(sound.freq, 8, 0.2);
    }
    const path = join(ambienceDir, `${sound.name}.mp3`);
    writeFileSync(path, wav);
    console.log(`  ✅ ambience/${sound.name}.mp3 — ${sound.label}`);
}

console.log('\n🎉 Done! All test audio files created.');
console.log('   These are simple WAV files with .mp3 extension for path matching.');
console.log('   Replace with real audio assets before production.\n');
