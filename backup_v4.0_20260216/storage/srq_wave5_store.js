/**
 * SRQ Wave 5 Store - participant usability reports
 *
 * Storage key: atom_srq_wave5_reports_v1
 */

import { normalizeWave5ParticipantReport } from "../services/srq_wave5_validation.js";

export const SRQ_WAVE5_REPORTS_KEY = "atom_srq_wave5_reports_v1";

export async function loadWave5Participants() {
    const data = await chrome.storage.local.get([SRQ_WAVE5_REPORTS_KEY]);
    const list = data[SRQ_WAVE5_REPORTS_KEY];
    return Array.isArray(list) ? list : [];
}

export async function saveWave5Participants(participants) {
    const safe = Array.isArray(participants) ? participants : [];
    await chrome.storage.local.set({ [SRQ_WAVE5_REPORTS_KEY]: safe });
    return safe;
}

export async function upsertWave5Participant(rawParticipant) {
    const participant = normalizeWave5ParticipantReport(rawParticipant || {});
    const participants = await loadWave5Participants();
    const idx = participants.findIndex((item) => item?.participantId === participant.participantId);
    let savedParticipant = participant;

    if (idx >= 0) {
        participants[idx] = {
            ...participants[idx],
            ...participant,
            createdAt: participants[idx].createdAt || participant.createdAt
        };
        savedParticipant = participants[idx];
    } else {
        participants.push(participant);
    }

    await saveWave5Participants(participants);
    return savedParticipant;
}

export async function removeWave5Participant(participantId) {
    if (!participantId) return false;
    const participants = await loadWave5Participants();
    const next = participants.filter((item) => item?.participantId !== participantId);
    const removed = next.length !== participants.length;
    if (removed) {
        await saveWave5Participants(next);
    }
    return removed;
}

export async function clearWave5Participants() {
    await saveWave5Participants([]);
    return true;
}
