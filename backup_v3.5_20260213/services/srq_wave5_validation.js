/**
 * SRQ Wave 5 Validation - usability scoring and release gate
 *
 * Scope:
 * - Normalize participant usability reports
 * - Aggregate Wave 5 metrics
 * - Evaluate release decision: go | conditional_go | no_go
 */

export const SRQ_WAVE5_EXPECTED_PARTICIPANTS = 10;

export const SRQ_WAVE5_TASKS = [
    { taskId: "task_1_open_extension", label: "Open extension and understand current status" },
    { taskId: "task_2_configure_ai_basic", label: "Configure basic AI settings and save" },
    { taskId: "task_3_open_sidepanel_and_summarize", label: "Open sidepanel and summarize one text paragraph" },
    { taskId: "task_4_save_insight", label: "Save one insight into memory" },
    { taskId: "task_5_recover_from_error", label: "Handle one error scenario via available CTA" }
];

export const SRQ_WAVE5_RUBRIC_FIELDS = [
    "wordingClarity",
    "buttonFindability",
    "resultClarity",
    "errorRecoveryClarity",
    "confidenceFeeling"
];

const SRQ_WAVE5_ALLOWED_CATEGORIES = [
    "copy_ambiguity",
    "navigation_confusion",
    "error_recovery_gap"
];

const SEVERITY_WEIGHT = { S1: 3, S2: 2, S3: 1 };

function normalizeText(value, fallback = "") {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    return trimmed || fallback;
}

function normalizeInteger(value, fallback = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    if (n < 0) return 0;
    return Math.round(n);
}

function normalizeNumber(value, fallback = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return n < 0 ? 0 : n;
}

function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
}

function round(value, digits = 2) {
    if (!Number.isFinite(value)) return 0;
    const base = 10 ** digits;
    return Math.round(value * base) / base;
}

function normalizeBoolean(value) {
    return value === true;
}

function normalizeSeverity(value) {
    const raw = normalizeText(String(value || "")).toUpperCase();
    if (raw === "S1" || raw === "S2" || raw === "S3") return raw;
    return "S3";
}

function normalizeCategory(value) {
    const raw = normalizeText(String(value || "")).toLowerCase();
    if (SRQ_WAVE5_ALLOWED_CATEGORIES.includes(raw)) return raw;
    return "navigation_confusion";
}

function normalizeRubric(rawRubric = {}) {
    const rubric = {};

    for (const field of SRQ_WAVE5_RUBRIC_FIELDS) {
        const value = clamp(Number(rawRubric[field]), 0, 10);
        rubric[field] = Number.isFinite(value) ? round(value, 2) : 0;
    }

    return rubric;
}

function averageRubric(rubric) {
    const values = SRQ_WAVE5_RUBRIC_FIELDS.map((field) => normalizeNumber(rubric?.[field], 0));
    if (!values.length) return 0;
    const sum = values.reduce((acc, value) => acc + value, 0);
    return round(sum / values.length, 2);
}

function buildDefaultTask(index) {
    const def = SRQ_WAVE5_TASKS[index] || {};
    return {
        taskId: def.taskId || `task_${index + 1}`,
        label: def.label || `Task ${index + 1}`,
        completed: false,
        timeSec: 0,
        askedLabelMeaningCount: 0,
        misclickCount: 0,
        directHelpNeeded: false,
        feedback: ""
    };
}

function normalizeTask(rawTask = {}, index = 0) {
    const fallback = buildDefaultTask(index);
    const taskId = normalizeText(rawTask.taskId, fallback.taskId);
    const label = normalizeText(rawTask.label, fallback.label);

    return {
        taskId,
        label,
        completed: normalizeBoolean(rawTask.completed),
        timeSec: normalizeNumber(rawTask.timeSec, 0),
        askedLabelMeaningCount: normalizeInteger(rawTask.askedLabelMeaningCount, 0),
        misclickCount: normalizeInteger(rawTask.misclickCount, 0),
        directHelpNeeded: normalizeBoolean(rawTask.directHelpNeeded),
        feedback: normalizeText(rawTask.feedback, "")
    };
}

function normalizePainPoint(rawPainPoint = {}, index = 0) {
    const severity = normalizeSeverity(rawPainPoint.severity);
    const patchReady = normalizeBoolean(rawPainPoint.patchReady);

    return {
        painId: normalizeText(rawPainPoint.painId, `pain_${index + 1}`),
        taskId: normalizeText(rawPainPoint.taskId, ""),
        title: normalizeText(rawPainPoint.title, "Unspecified friction"),
        details: normalizeText(rawPainPoint.details, ""),
        severity,
        category: normalizeCategory(rawPainPoint.category),
        fileHint: normalizeText(rawPainPoint.fileHint, ""),
        proposedFix: normalizeText(rawPainPoint.proposedFix, ""),
        owner: normalizeText(rawPainPoint.owner, ""),
        eta: normalizeText(rawPainPoint.eta, ""),
        patchReady
    };
}

function buildPainPointFingerprint(painPoint) {
    return [
        normalizeText(painPoint.title, "unspecified").toLowerCase(),
        normalizeText(painPoint.category, "navigation_confusion").toLowerCase(),
        normalizeText(painPoint.fileHint, "").toLowerCase(),
        normalizeText(painPoint.taskId, "").toLowerCase()
    ].join("|");
}

function summarizeParticipant(report) {
    const tasks = Array.isArray(report?.tasks) ? report.tasks : [];
    const completedTasks = tasks.filter((task) => task.completed).length;
    const totalTasks = tasks.length || SRQ_WAVE5_TASKS.length;
    const totalTimeSec = tasks.reduce((acc, task) => acc + normalizeNumber(task.timeSec, 0), 0);
    const labelClarificationCount = tasks.reduce((acc, task) => acc + normalizeInteger(task.askedLabelMeaningCount, 0), 0);
    const misclickCount = tasks.reduce((acc, task) => acc + normalizeInteger(task.misclickCount, 0), 0);
    const directHelpTaskCount = tasks.filter((task) => task.directHelpNeeded).length;

    const s1Total = (report.painPoints || []).filter((point) => point.severity === "S1").length;
    const s1Unpatched = (report.painPoints || []).filter((point) => point.severity === "S1" && !point.patchReady).length;

    return {
        participantId: report.participantId,
        completionRate: round((completedTasks / totalTasks) * 100, 2),
        nonTechScore: averageRubric(report.rubric),
        totalTaskTimeSec: round(totalTimeSec, 2),
        directHelpRate: round((directHelpTaskCount / totalTasks) * 100, 2),
        labelClarificationCount,
        misclickCount,
        s1Total,
        s1Unpatched
    };
}

function aggregatePainPoints(participants) {
    const map = new Map();

    for (const participant of participants) {
        const participantId = participant.participantId;
        const points = Array.isArray(participant.painPoints) ? participant.painPoints : [];

        for (const point of points) {
            const fingerprint = buildPainPointFingerprint(point);
            const severityWeight = SEVERITY_WEIGHT[point.severity] || 1;
            const taskId = normalizeText(point.taskId, "");
            const entry = map.get(fingerprint) || {
                fingerprint,
                title: point.title,
                category: point.category,
                highestSeverity: point.severity,
                highestSeverityWeight: severityWeight,
                occurrences: 0,
                participantIds: new Set(),
                taskIds: new Set(),
                fileHints: new Set(),
                proposedFixes: new Set(),
                owners: new Set(),
                etas: new Set(),
                patchReadyCount: 0,
                totalS1Count: 0
            };

            entry.occurrences += 1;
            entry.participantIds.add(participantId);
            if (taskId) entry.taskIds.add(taskId);
            if (point.fileHint) entry.fileHints.add(point.fileHint);
            if (point.proposedFix) entry.proposedFixes.add(point.proposedFix);
            if (point.owner) entry.owners.add(point.owner);
            if (point.eta) entry.etas.add(point.eta);
            if (point.patchReady) entry.patchReadyCount += 1;
            if (point.severity === "S1") entry.totalS1Count += 1;

            if (severityWeight > entry.highestSeverityWeight) {
                entry.highestSeverityWeight = severityWeight;
                entry.highestSeverity = point.severity;
            }

            map.set(fingerprint, entry);
        }
    }

    const rows = Array.from(map.values()).map((entry) => ({
        fingerprint: entry.fingerprint,
        title: entry.title,
        category: entry.category,
        severity: entry.highestSeverity,
        occurrences: entry.occurrences,
        participants: Array.from(entry.participantIds),
        taskIds: Array.from(entry.taskIds),
        fileHints: Array.from(entry.fileHints),
        proposedFixes: Array.from(entry.proposedFixes),
        owners: Array.from(entry.owners),
        etas: Array.from(entry.etas),
        patchReadyRate: entry.occurrences > 0 ? round((entry.patchReadyCount / entry.occurrences) * 100, 2) : 0,
        hasUnpatchedS1: entry.totalS1Count > entry.patchReadyCount,
        severityWeight: entry.highestSeverityWeight
    }));

    rows.sort((a, b) => {
        if (b.severityWeight !== a.severityWeight) return b.severityWeight - a.severityWeight;
        if (b.occurrences !== a.occurrences) return b.occurrences - a.occurrences;
        return a.title.localeCompare(b.title);
    });

    return rows;
}

function mapPriorityByFriction(friction) {
    if (friction.severity === "S1") return "P0";
    if (friction.occurrences >= 3) return "P1";
    return "P2";
}

function createQuickFixBacklog(topFrictionPoints) {
    return topFrictionPoints.map((friction, idx) => {
        const priority = mapPriorityByFriction(friction);
        const proposedFix = friction.proposedFixes[0] || "Define and implement targeted UX patch";
        return {
            fixId: `wave5_fix_${idx + 1}`,
            priority,
            friction: friction.title,
            category: friction.category,
            severity: friction.severity,
            owner: friction.owners[0] || "TBD",
            eta: friction.etas[0] || "TBD",
            fileHint: friction.fileHints[0] || "",
            proposedFix
        };
    });
}

function evaluateReleaseGate(metrics) {
    const reasons = [];
    const score = metrics.nonTechScore;
    const completion = metrics.taskCompletionRate;
    const assistance = metrics.directHelpRate;
    const unpatchedS1 = metrics.s1UnpatchedCount;

    if (score < 8.0) reasons.push("Non-tech friendly score below 8.0");
    if (completion < 85) reasons.push("Task completion below 85%");
    if (assistance > 20) reasons.push("Direct-help rate above 20% target");
    if (unpatchedS1 > 0) reasons.push("Unpatched S1 blockers remain");

    if (
        score >= 8.5 &&
        completion >= 90 &&
        assistance <= 20 &&
        unpatchedS1 === 0
    ) {
        return { decision: "go", reasons };
    }

    if (score >= 8.0 && completion >= 85 && unpatchedS1 === 0) {
        const conditionalReasons = [...reasons];
        if (score >= 8.5 && completion < 90) {
            conditionalReasons.push("Task completion is below 90% go threshold");
        }
        if (score >= 8.5 && assistance > 20) {
            conditionalReasons.push("Direct-help rate needs one more usability patch cycle");
        }
        if (score < 8.5) {
            conditionalReasons.push("Score is in 8.0-8.49 range; release with tracked patches only");
        }

        return {
            decision: "conditional_go",
            reasons: Array.from(new Set(conditionalReasons))
        };
    }

    return { decision: "no_go", reasons };
}

export function normalizeWave5ParticipantReport(rawReport = {}) {
    const participantId = normalizeText(rawReport.participantId, `participant_${Date.now()}`);
    const now = Date.now();

    const rawTasks = Array.isArray(rawReport.tasks) ? rawReport.tasks : [];
    const tasks = SRQ_WAVE5_TASKS.map((_, index) => normalizeTask(rawTasks[index] || {}, index));

    const rawPainPoints = Array.isArray(rawReport.painPoints) ? rawReport.painPoints : [];
    const painPoints = rawPainPoints.map((point, idx) => normalizePainPoint(point, idx));

    const rubric = normalizeRubric(rawReport.rubric || {});
    const participantSummary = summarizeParticipant({ participantId, tasks, rubric, painPoints });

    return {
        participantId,
        profile: normalizeText(rawReport.profile, ""),
        moderatorId: normalizeText(rawReport.moderatorId, ""),
        startedAt: normalizeNumber(rawReport.startedAt, 0),
        finishedAt: normalizeNumber(rawReport.finishedAt, 0),
        durationMinutes: normalizeNumber(rawReport.durationMinutes, 0),
        tasks,
        rubric,
        painPoints,
        keyFeedbackQuote: normalizeText(rawReport.keyFeedbackQuote, ""),
        notes: normalizeText(rawReport.notes, ""),
        createdAt: normalizeNumber(rawReport.createdAt, now),
        updatedAt: now,
        summary: participantSummary
    };
}

export function buildWave5AggregateReport(rawParticipants = [], options = {}) {
    const expectedParticipants = normalizeInteger(
        options.expectedParticipants,
        SRQ_WAVE5_EXPECTED_PARTICIPANTS
    );
    const normalizedParticipants = (Array.isArray(rawParticipants) ? rawParticipants : [])
        .map((participant) => normalizeWave5ParticipantReport(participant));

    const participantCount = normalizedParticipants.length;
    const totalTasks = participantCount * SRQ_WAVE5_TASKS.length;

    const participantSummaries = normalizedParticipants.map((participant) => participant.summary);
    const completedTaskCount = normalizedParticipants.reduce(
        (acc, participant) => acc + participant.tasks.filter((task) => task.completed).length,
        0
    );
    const directHelpTaskCount = normalizedParticipants.reduce(
        (acc, participant) => acc + participant.tasks.filter((task) => task.directHelpNeeded).length,
        0
    );

    const totalTaskTimeSec = participantSummaries.reduce((acc, summary) => acc + summary.totalTaskTimeSec, 0);
    const totalLabelClarificationCount = participantSummaries.reduce((acc, summary) => acc + summary.labelClarificationCount, 0);
    const totalMisclickCount = participantSummaries.reduce((acc, summary) => acc + summary.misclickCount, 0);
    const totalNonTechScore = participantSummaries.reduce((acc, summary) => acc + summary.nonTechScore, 0);
    const s1TotalCount = participantSummaries.reduce((acc, summary) => acc + summary.s1Total, 0);
    const s1UnpatchedCount = participantSummaries.reduce((acc, summary) => acc + summary.s1Unpatched, 0);

    const taskMetrics = SRQ_WAVE5_TASKS.map((taskDef, index) => {
        const taskRows = normalizedParticipants.map((participant) => {
            return participant.tasks.find((task) => task.taskId === taskDef.taskId) || buildDefaultTask(index);
        });

        const completedCount = taskRows.filter((task) => task.completed).length;
        const totalTime = taskRows.reduce((acc, task) => acc + normalizeNumber(task.timeSec, 0), 0);
        const directHelpCount = taskRows.filter((task) => task.directHelpNeeded).length;
        const labelClarificationCount = taskRows.reduce(
            (acc, task) => acc + normalizeInteger(task.askedLabelMeaningCount, 0),
            0
        );
        const misclickCount = taskRows.reduce((acc, task) => acc + normalizeInteger(task.misclickCount, 0), 0);

        return {
            taskId: taskDef.taskId,
            label: taskDef.label,
            completionRate: participantCount > 0 ? round((completedCount / participantCount) * 100, 2) : 0,
            avgTimeSec: participantCount > 0 ? round(totalTime / participantCount, 2) : 0,
            directHelpRate: participantCount > 0 ? round((directHelpCount / participantCount) * 100, 2) : 0,
            labelClarificationCount,
            misclickCount
        };
    });

    const metrics = {
        participantCount,
        expectedParticipants,
        sampleCoverageRate: expectedParticipants > 0 ? round((participantCount / expectedParticipants) * 100, 2) : 0,
        nonTechScore: participantCount > 0 ? round(totalNonTechScore / participantCount, 2) : 0,
        taskCompletionRate: totalTasks > 0 ? round((completedTaskCount / totalTasks) * 100, 2) : 0,
        avgTimePerTaskSec: totalTasks > 0 ? round(totalTaskTimeSec / totalTasks, 2) : 0,
        directHelpRate: totalTasks > 0 ? round((directHelpTaskCount / totalTasks) * 100, 2) : 0,
        totalLabelClarificationCount,
        totalMisclickCount,
        s1TotalCount,
        s1UnpatchedCount
    };

    const gate = evaluateReleaseGate(metrics);
    const frictionRows = aggregatePainPoints(normalizedParticipants);
    const topFrictionPoints = frictionRows.slice(0, 10);
    const quickFixBacklog = createQuickFixBacklog(topFrictionPoints);

    const frictionToFileMapping = topFrictionPoints.map((friction) => ({
        friction: friction.title,
        severity: friction.severity,
        category: friction.category,
        files: friction.fileHints,
        proposedFix: friction.proposedFixes[0] || "TBD"
    }));

    return {
        generatedAt: Date.now(),
        metrics,
        taskMetrics,
        gate,
        participantSummaries,
        topFrictionPoints,
        frictionToFileMapping,
        quickFixBacklog,
        acceptanceChecklist: {
            hasParticipantReports: participantCount >= expectedParticipants,
            hasGateDecision: true,
            hasPrioritizedBacklog: quickFixBacklog.length > 0
        }
    };
}
