export interface MusicTrack {
    id: string;
    name: string;
    artist: string;
    src: string;
    duration: number; // seconds
    genre: 'lofi' | 'synthwave' | 'classical' | 'ambient';
    tags: string[];
}

export const musicTracks: MusicTrack[] = [
    {
        id: 'lofi_chill_01',
        name: 'Afternoon Drift',
        artist: 'Amo Beats',
        src: '/assets/audio/music/lofi_chill_01.mp3',
        duration: 180,
        genre: 'lofi',
        tags: ['chill', 'warm'],
    },
    {
        id: 'lofi_chill_02',
        name: 'Rainy Window',
        artist: 'Amo Beats',
        src: '/assets/audio/music/lofi_chill_02.mp3',
        duration: 210,
        genre: 'lofi',
        tags: ['melancholy', 'rain'],
    },
    {
        id: 'synthwave_01',
        name: 'Neon Pulse',
        artist: 'Amo Synth',
        src: '/assets/audio/music/synthwave_01.mp3',
        duration: 240,
        genre: 'synthwave',
        tags: ['energetic', 'night'],
    },
    {
        id: 'classical_01',
        name: 'Nocturne Dream',
        artist: 'Amo Classical',
        src: '/assets/audio/music/classical_01.mp3',
        duration: 300,
        genre: 'classical',
        tags: ['calm', 'elegant'],
    },
    {
        id: 'ambient_01',
        name: 'Deep Orbit',
        artist: 'Amo Ambient',
        src: '/assets/audio/music/ambient_01.mp3',
        duration: 360,
        genre: 'ambient',
        tags: ['focus', 'minimal', 'space'],
    },
];
