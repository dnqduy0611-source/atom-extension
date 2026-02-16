export interface AmbienceSound {
    id: string;
    name: string;
    icon: string;
    src: string;
    tags: string[];
}

export const ambienceSounds: AmbienceSound[] = [
    {
        id: 'rain',
        name: 'Rain',
        icon: '🌧️',
        src: '/assets/audio/ambience/rain.mp3',
        tags: ['water', 'calm'],
    },
    {
        id: 'thunder',
        name: 'Thunder',
        icon: '⛈️',
        src: '/assets/audio/ambience/thunder.mp3',
        tags: ['dramatic', 'rain'],
    },
    {
        id: 'wind',
        name: 'Wind',
        icon: '💨',
        src: '/assets/audio/ambience/wind.mp3',
        tags: ['nature', 'open'],
    },
    {
        id: 'fire',
        name: 'Fireplace',
        icon: '🔥',
        src: '/assets/audio/ambience/fire.mp3',
        tags: ['warm', 'cozy'],
    },
    {
        id: 'coffee_shop',
        name: 'Coffee Shop',
        icon: '☕',
        src: '/assets/audio/ambience/coffee_shop.mp3',
        tags: ['social', 'indoor'],
    },
    {
        id: 'ocean',
        name: 'Ocean Waves',
        icon: '🌊',
        src: '/assets/audio/ambience/ocean.mp3',
        tags: ['nature', 'calm'],
    },
    {
        id: 'white_noise',
        name: 'White Noise',
        icon: '📡',
        src: '/assets/audio/ambience/white_noise.mp3',
        tags: ['focus', 'minimal'],
    },
    {
        id: 'dungeon_air',
        name: 'Dungeon Air',
        icon: '🏚️',
        src: '/assets/audio/ambience/dungeon_air.mp3',
        tags: ['dark', 'mysterious', 'focus'],
    },
];
