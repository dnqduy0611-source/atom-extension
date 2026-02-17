import type { MixerConfig } from '../store/useLofiStore';

export interface MoodPreset {
    id: string;
    name: string;
    emoji: string;
    description: string;
    config: MixerConfig;
}

export const moodPresets: MoodPreset[] = [
    {
        id: 'deep_focus',
        name: 'Deep Focus',
        emoji: '🧠',
        description: 'Minimal distractions, maximum concentration',
        config: {
            scene_id: 'space_station',
            variant: 'night',
            music: { id: 'ambient_01', volume: 0.5 },
            ambience: [
                { id: 'white_noise', volume: 0.3 },
            ],
        },
    },
    {
        id: 'chill_work',
        name: 'Chill Work',
        emoji: '☕',
        description: 'Relaxed productivity with good vibes',
        config: {
            scene_id: 'cozy_cafe',
            variant: 'day',
            music: { id: 'lofi_chill_01', volume: 0.6 },
            ambience: [
                { id: 'coffee_shop', volume: 0.4 },
                { id: 'rain', volume: 0.2 },
            ],
        },
    },
    {
        id: 'night_owl',
        name: 'Night Owl',
        emoji: '🌙',
        description: 'Late night coding energy',
        config: {
            scene_id: 'city_night',
            variant: 'night',
            music: { id: 'synthwave_01', volume: 0.7 },
            ambience: [
                { id: 'rain', volume: 0.5 },
                { id: 'thunder', volume: 0.2 },
            ],
        },
    },
    {
        id: 'nature_flow',
        name: 'Nature Flow',
        emoji: '🌿',
        description: 'Grounded and warm, work by the fire',
        config: {
            scene_id: 'forest_cabin',
            variant: 'day',
            music: { id: 'classical_01', volume: 0.4 },
            ambience: [
                { id: 'fire', volume: 0.6 },
                { id: 'wind', volume: 0.3 },
            ],
        },
    },
    {
        id: 'calm',
        name: 'Calm',
        emoji: '🌊',
        description: 'Peaceful waves and gentle melodies',
        config: {
            scene_id: 'ocean_cliff',
            variant: 'day',
            music: { id: 'lofi_chill_02', volume: 0.5 },
            ambience: [
                { id: 'ocean', volume: 0.7 },
            ],
        },
    },
];
