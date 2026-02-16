/**
 * English translations for AmoLofi
 */
export const en = {
    // ── App ──
    'app.exitZen': 'Exit Zen',
    'app.upgradeToPro': 'Upgrade to Pro',
    'app.pro': 'PRO',

    // ── Loading Screen ──
    'loading.tagline': 'Focus, Relax & Create',

    // ── Sidebar ──
    'sidebar.scenes': 'Scenes',
    'sidebar.mixer': 'Mixer',
    'sidebar.focus': 'Focus',
    'sidebar.stats': 'Stats',
    'sidebar.customize': 'Customize',
    'sidebar.zen': 'Zen',
    'sidebar.fullscreen': 'Fullscreen',
    'sidebar.language': 'Language',

    // ── Focus Panel ──
    'focus.title': 'Focus Tools',
    'focus.timer': 'Timer',
    'focus.tasks': 'Tasks',

    // ── Pomodoro Timer ──
    'timer.focus': 'Focus',
    'timer.shortBreak': 'Short Break',
    'timer.longBreak': 'Long Break',
    'timer.reset': 'Reset',
    'timer.skip': 'Skip',
    'timer.skipToNext': 'Skip to next',
    'timer.quickNotes': 'Quick Notes',
    'timer.notesPlaceholder': 'Jot down thoughts, ideas, goals...',

    // ── Timer Pill ──
    'timerPill.focus': 'Focus',
    'timerPill.break': 'Break',
    'timerPill.rest': 'Rest',

    // ── Sound Mixer ──
    'mixer.title': 'Sound Mixer',
    'mixer.tracks': 'Tracks',
    'mixer.ambience': 'Ambience',
    'mixer.brainwave': 'Brainwave',
    'mixer.binauralBeats': 'Binaural Beats',
    'mixer.headphonesRecommended': 'Headphones recommended',
    'mixer.intensity': 'Intensity',
    'mixer.subtle': 'Subtle',
    'mixer.strong': 'Strong',
    'mixer.syncNote': 'Syncs with focus timer — switches automatically',

    // ── Brainwave modes ──
    'brainwave.focus': 'Focus',
    'brainwave.concentration': 'Concentration',
    'brainwave.relax': 'Relax',
    'brainwave.calmUnwind': 'Calm & unwind',
    'brainwave.deepRest': 'Deep Rest',
    'brainwave.meditation': 'Meditation',

    // ── Stats Dashboard ──
    'stats.title': 'Productivity Report',
    'stats.totalSessions': 'Total Sessions',
    'stats.sessionsCompleted': 'Sessions completed',
    'stats.totalFocusTime': 'Total Focus Time',
    'stats.totalTime': 'Total time',
    'stats.avgDuration': 'Avg Duration',
    'stats.perSession': 'Per session',
    'stats.dayStreak': 'Day Streak',
    'stats.bestDays': 'Best: {0} days',
    'stats.dayStreakLabel': 'day streak',
    'stats.best': 'Best: {0}',
    'stats.days': '{0} / {1} days',
    'stats.peakHours': 'Peak Hours',
    'stats.thisWeek': 'This Week',
    'stats.today': 'Today',
    'stats.focusTime': 'Focus time',
    'stats.tasksDone': 'Tasks done',
    'stats.pomodoroCycle': 'Pomodoro Cycle',
    'stats.moreUntilLongBreak': '{0} more until long break',

    // ── Heatmap ──
    'heatmap.activity': 'Activity',
    'heatmap.activeDays': '{0} active {1}',
    'heatmap.day': 'day',
    'heatmap.days': 'days',
    'heatmap.noActivity': 'No activity',
    'heatmap.less': 'Less',
    'heatmap.more': 'More',

    // ── Tasks ──
    'tasks.addPlaceholder': 'Add a task...',
    'tasks.noTasks': 'No tasks yet',
    'tasks.getStarted': 'Add one to get started',
    'tasks.completed': '{0}/{1} completed',
    'tasks.clearDone': 'Clear done',

    // ── Theme Customizer ──
    'theme.appearance': 'Appearance',
    'theme.mode': 'Mode',
    'theme.day': 'Day',
    'theme.night': 'Night',
    'theme.accentColor': 'Accent Color',
    'theme.reset': 'Reset',
    'theme.sceneColor': 'Scene color',
    'theme.overlayTint': 'Overlay Tint',
    'theme.vignette': 'Vignette',
    'theme.vignetteDesc': 'Dark edges around screen',
    'theme.accentGlow': 'Accent Glow',
    'theme.accentGlowDesc': 'Colored light effects',

    // ── Scene Selector ──
    'scene.scenes': 'Scenes',
    'scene.hideScene': 'Hide this scene',
    'scene.deleteScene': 'Delete custom scene',
    'scene.proFeature': 'Pro feature',
    'scene.maxWallpapers': 'Max 5 wallpapers',
    'scene.addWallpaper': 'Add wallpaper',
    'scene.createScene': 'Create Scene',
    'scene.hiddenScenes': '{0} hidden scene',
    'scene.hiddenScenesPlural': '{0} hidden scenes',
    'scene.show': 'Show',
} as const;

export type TranslationKey = keyof typeof en;
