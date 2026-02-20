// AmoLofi Extension — Service Worker (Background)
// Handles timer, notifications, and message routing.

import { handleTimerCommand, handleTimerTick } from './timer';

const ALARM_NAME = 'amo-timer-tick';

// ── Install ──
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('[AmoLofi] Extension installed successfully.');
    }
});

// ── Alarm handler ──
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === ALARM_NAME) {
        await handleTimerTick();
    }
});

// ── Message handler ──
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'timer') {
        handleTimerCommand(message.action, message.payload)
            .then(() => sendResponse({ ok: true }))
            .catch((err) => sendResponse({ ok: false, error: err.message }));
        return true; // keep channel open for async response
    }
});
