// ai/prompts/nudge.js — Chat-based nudge templates
// Replaces intervention modals when sidepanel is open (Phase 2E)

const NUDGE_TEMPLATES = {
    gentle: [
        {
            template: "You've been reading for {duration}. Want to jot something down before moving on?",
            actions: [
                { label: "Save a note", prompt: "/save" },
                { label: "Keep reading", prompt: "" }
            ]
        },
        {
            template: "Found {connectionCount} connections with your previous reads. Want to explore?",
            actions: [
                { label: "Show connections", prompt: "Show me connections to what I read before" },
                { label: "Later", prompt: "" }
            ]
        },
        {
            template: "Anything interesting so far? /save to capture it.",
            actions: [
                { label: "Save highlight", prompt: "/save" }
            ]
        }
    ],
    moderate: [
        {
            template: "It's been {duration}. A short break might help — try /focus 5",
            actions: [
                { label: "Take a break", prompt: "/focus 5" },
                { label: "Summarize first", prompt: "/summarize" }
            ]
        },
        {
            template: "Page {pageCount} today — want to review what you've saved so far?",
            actions: [
                { label: "Review saved", prompt: "Show me what I saved today" },
                { label: "Keep going", prompt: "" }
            ]
        },
        {
            template: "{duration} straight — your brain could use a breather. Try /focus 5?",
            actions: [
                { label: "5-min break", prompt: "/focus 5" },
                { label: "Not yet", prompt: "" }
            ]
        }
    ],
    firm: [
        {
            template: "{duration} without a break. Save your key takeaway, then rest for 5 minutes.",
            actions: [
                { label: "Save & break", prompt: "/save" },
                { label: "Just break", prompt: "/focus 5" }
            ]
        },
        {
            template: "You've spent {totalTime} reading today. Quality over quantity — want a quick review?",
            actions: [
                { label: "Review", prompt: "Summarize what I read today" },
                { label: "Take a break", prompt: "/focus 5" }
            ]
        }
    ]
};

/**
 * Generate a chat nudge based on signals and context.
 * Returns { message, actions } or null.
 *
 * @param {Object} signals - { attention_risk, approaching_risk, escalation }
 * @param {Object} context - { sessionDuration, connections, pagesReadToday, totalReadingToday }
 * @returns {{ message: string, actions: Array<{label: string, prompt: string}> } | null}
 */
export function generateNudge(signals, context) {
    const { attention_risk, approaching_risk, escalation } = signals;
    if (!attention_risk && !approaching_risk) return null;

    let pool;
    if (escalation?.resistanceScore >= 4 && attention_risk) pool = NUDGE_TEMPLATES.firm;
    else if (attention_risk) pool = NUDGE_TEMPLATES.moderate;
    else pool = NUDGE_TEMPLATES.gentle;

    const entry = pool[Math.floor(Math.random() * pool.length)];
    const message = fillPlaceholders(entry.template, {
        duration: formatDuration(context.sessionDuration),
        connectionCount: context.connections?.length || 0,
        pageCount: context.pagesReadToday || 1,
        totalTime: formatDuration(context.totalReadingToday)
    });

    return {
        message,
        actions: entry.actions.filter(a => a.prompt)
    };
}

function fillPlaceholders(template, data) {
    return template.replace(/\{(\w+)\}/g, (_, key) => data[key] ?? '?');
}

function formatDuration(ms) {
    if (!ms) return '0m';
    const m = Math.floor(ms / 60000);
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h${m % 60}m`;
}
