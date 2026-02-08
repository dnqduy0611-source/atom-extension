# SRQ Wave 5 Validation Playbook

This document describes the Wave 5 usability validation flow implemented in code.

## Scope
- Test plan for 10 non-tech participants
- Rubric scoring (0-10 for 5 criteria)
- Aggregated Wave 5 report
- Release gate decision: `go`, `conditional_go`, `no_go`

## Participant Data Model
Use `SRQ_W5_UPSERT_PARTICIPANT` with this payload:

```json
{
  "type": "SRQ_W5_UPSERT_PARTICIPANT",
  "participant": {
    "participantId": "P01",
    "profile": "non-tech, light AI usage",
    "durationMinutes": 28,
    "tasks": [
      {
        "taskId": "task_1_open_extension",
        "completed": true,
        "timeSec": 35,
        "askedLabelMeaningCount": 0,
        "misclickCount": 1,
        "directHelpNeeded": false,
        "feedback": "I can see what to do next."
      }
    ],
    "rubric": {
      "wordingClarity": 9,
      "buttonFindability": 8,
      "resultClarity": 9,
      "errorRecoveryClarity": 8,
      "confidenceFeeling": 8
    },
    "painPoints": [
      {
        "painId": "p1",
        "taskId": "task_5_recover_from_error",
        "title": "Could not find retry CTA",
        "severity": "S2",
        "category": "error_recovery_gap",
        "fileHint": "sidepanel.js",
        "proposedFix": "Make retry CTA primary and always visible",
        "owner": "frontend",
        "eta": "2026-02-10",
        "patchReady": true
      }
    ],
    "keyFeedbackQuote": "Once I saw the button labels, the flow felt clear."
  }
}
```

## Wave 5 Module API
Use module functions directly:

- `storage/srq_wave5_store.js`
- `services/srq_wave5_validation.js`

Primary functions:

- `upsertWave5Participant(rawParticipant)`
- `loadWave5Participants()`
- `removeWave5Participant(participantId)`
- `clearWave5Participants()`
- `buildWave5AggregateReport(participants, options)`

## Release Gate Rules in Code
Implemented in `services/srq_wave5_validation.js`:

1. `go`
- score >= 8.5
- completion >= 90
- direct-help rate <= 20
- no unpatched S1 blocker

2. `conditional_go`
- score >= 8.0
- completion >= 85
- no unpatched S1 blocker
- but one or more go-threshold metrics still need patches

3. `no_go`
- score < 8.0, or
- completion < 85, or
- unpatched S1 blocker exists

## Output Fields of `SRQ_W5_BUILD_REPORT`
- `metrics`
- `taskMetrics`
- `gate`
- `participantSummaries`
- `topFrictionPoints` (top 10)
- `frictionToFileMapping`
- `quickFixBacklog`
- `acceptanceChecklist`
