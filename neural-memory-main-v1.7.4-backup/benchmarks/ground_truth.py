"""Ground truth dataset for evaluation benchmarks.

30 curated memories + queries with expected relevant results.
Covers: factual recall, temporal queries, causal chains, pattern queries,
and multi-session coherence.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class GroundTruthMemory:
    """A memory with metadata for benchmark evaluation.

    Attributes:
        id: Unique identifier
        content: Memory text
        tags: Classification tags
        memory_type: Type (fact, decision, etc.)
        day_offset: Day offset from start (for temporal simulation)
    """

    id: str
    content: str
    tags: set[str] = field(default_factory=set)
    memory_type: str = "fact"
    day_offset: int = 0


@dataclass(frozen=True)
class GroundTruthQuery:
    """A query with expected relevant memory IDs.

    Attributes:
        query: The query text
        category: Query category (factual, temporal, causal, pattern, coherence)
        expected_ids: Set of memory IDs that are relevant
        description: Human-readable description of what the query tests
    """

    query: str
    category: str
    expected_ids: set[str]
    description: str = ""


# ── Memories ──

MEMORIES: list[GroundTruthMemory] = [
    # Day 1: Project setup
    GroundTruthMemory(
        "m01",
        "We decided to use PostgreSQL for the database",
        {"database", "decision", "postgresql"},
        "decision",
        0,
    ),
    GroundTruthMemory(
        "m02",
        "Alice is the tech lead for the backend team",
        {"team", "alice", "backend"},
        "fact",
        0,
    ),
    GroundTruthMemory(
        "m03",
        "The project uses Python 3.11 with FastAPI",
        {"python", "fastapi", "tech-stack"},
        "fact",
        0,
    ),
    GroundTruthMemory(
        "m04",
        "Bob is responsible for the frontend using React",
        {"team", "bob", "frontend", "react"},
        "fact",
        0,
    ),
    GroundTruthMemory(
        "m05", "JWT tokens chosen for authentication", {"auth", "jwt", "decision"}, "decision", 0
    ),
    GroundTruthMemory(
        "m06", "Redis selected for caching layer", {"redis", "caching", "decision"}, "decision", 0
    ),
    GroundTruthMemory(
        "m07",
        "CI/CD pipeline set up with GitHub Actions",
        {"ci-cd", "github-actions", "devops"},
        "fact",
        0,
    ),
    GroundTruthMemory(
        "m08",
        "Code review required for all PRs before merge",
        {"process", "code-review", "pr"},
        "instruction",
        0,
    ),
    # Day 3: Development progress
    GroundTruthMemory(
        "m09",
        "Alice implemented the user authentication module",
        {"alice", "auth", "backend"},
        "fact",
        3,
    ),
    GroundTruthMemory(
        "m10",
        "Found a bug in JWT token refresh - tokens expire too early",
        {"bug", "jwt", "auth"},
        "error",
        3,
    ),
    GroundTruthMemory(
        "m11",
        "Bob completed the login page with React hooks",
        {"bob", "frontend", "login", "react"},
        "fact",
        3,
    ),
    GroundTruthMemory(
        "m12",
        "Performance test showed API response time of 200ms average",
        {"performance", "api", "testing"},
        "fact",
        3,
    ),
    GroundTruthMemory(
        "m13",
        "Team standup: Alice working on auth, Bob on login UI",
        {"standup", "alice", "bob", "status"},
        "context",
        3,
    ),
    # Day 7: First integration
    GroundTruthMemory(
        "m14", "Deployed v0.1 to staging environment", {"deployment", "staging", "v0.1"}, "fact", 7
    ),
    GroundTruthMemory(
        "m15",
        "Integration test revealed auth module crashes on empty tokens",
        {"testing", "auth", "bug", "integration"},
        "error",
        7,
    ),
    GroundTruthMemory(
        "m16",
        "Alice fixed the empty token bug with null check",
        {"alice", "auth", "bug-fix"},
        "fact",
        7,
    ),
    GroundTruthMemory(
        "m17",
        "Database migration script needs updating for new schema",
        {"database", "migration", "todo"},
        "todo",
        7,
    ),
    GroundTruthMemory(
        "m18",
        "Bob added error boundary components to React frontend",
        {"bob", "frontend", "react", "error-handling"},
        "fact",
        7,
    ),
    # Day 14: Mid-sprint review
    GroundTruthMemory(
        "m19",
        "Sprint review: 70% of planned features completed",
        {"sprint", "review", "progress"},
        "fact",
        14,
    ),
    GroundTruthMemory(
        "m20",
        "Decided to switch from REST to GraphQL for the API",
        {"api", "graphql", "decision"},
        "decision",
        14,
    ),
    GroundTruthMemory(
        "m21",
        "Alice noticed the caching layer reduces response time by 60%",
        {"alice", "caching", "performance"},
        "insight",
        14,
    ),
    GroundTruthMemory(
        "m22",
        "Bob reported React component re-renders causing UI lag",
        {"bob", "react", "performance", "bug"},
        "error",
        14,
    ),
    GroundTruthMemory(
        "m23",
        "Team agreed to add TypeScript to the frontend codebase",
        {"typescript", "frontend", "decision"},
        "decision",
        14,
    ),
    # Day 30: Production launch
    GroundTruthMemory(
        "m24",
        "Launched v1.0 to production successfully",
        {"deployment", "production", "v1.0", "launch"},
        "fact",
        30,
    ),
    GroundTruthMemory(
        "m25",
        "Post-launch: 500 users registered in first hour",
        {"launch", "users", "metrics"},
        "fact",
        30,
    ),
    GroundTruthMemory(
        "m26",
        "Production alert: database connection pool exhausted at peak",
        {"production", "database", "alert", "bug"},
        "error",
        30,
    ),
    GroundTruthMemory(
        "m27",
        "Alice scaled PostgreSQL connections from 20 to 100",
        {"alice", "database", "postgresql", "scaling"},
        "fact",
        30,
    ),
    GroundTruthMemory(
        "m28",
        "Bob optimized React bundle size from 2MB to 800KB",
        {"bob", "react", "frontend", "performance"},
        "fact",
        30,
    ),
    GroundTruthMemory(
        "m29",
        "Decision: implement rate limiting using Redis",
        {"redis", "rate-limiting", "decision"},
        "decision",
        30,
    ),
    GroundTruthMemory(
        "m30",
        "Retrospective: auth bugs were the main risk, now resolved",
        {"retrospective", "auth", "risk"},
        "insight",
        30,
    ),
]


# ── Queries ──

QUERIES: list[GroundTruthQuery] = [
    # Factual recall (who, what) — 8 queries
    GroundTruthQuery(
        "What database did we choose?",
        "factual",
        {"m01"},
        "Direct factual recall of a decision",
    ),
    GroundTruthQuery(
        "Who is the tech lead?",
        "factual",
        {"m02"},
        "Person identification",
    ),
    GroundTruthQuery(
        "What tech stack does the project use?",
        "factual",
        {"m03", "m04"},
        "Multi-memory tech stack recall",
    ),
    GroundTruthQuery(
        "What authentication method did we pick?",
        "factual",
        {"m05"},
        "Decision recall",
    ),
    GroundTruthQuery(
        "What did Alice implement?",
        "factual",
        {"m09", "m16", "m21", "m27"},
        "Person-scoped activity recall",
    ),
    GroundTruthQuery(
        "What did Bob work on?",
        "factual",
        {"m04", "m11", "m18", "m22", "m28"},
        "Person-scoped activity recall",
    ),
    GroundTruthQuery(
        "What caching system do we use?",
        "factual",
        {"m06", "m29"},
        "Technology decision recall",
    ),
    GroundTruthQuery(
        "What API approach did the team decide on?",
        "factual",
        {"m20"},
        "Decision recall with potential conflict (REST initially implied)",
    ),
    # Temporal queries (when, sequence) — 6 queries
    GroundTruthQuery(
        "What happened on the first day?",
        "temporal",
        {"m01", "m02", "m03", "m04", "m05", "m06", "m07", "m08"},
        "Day-specific temporal recall",
    ),
    GroundTruthQuery(
        "What bugs were found during development?",
        "temporal",
        {"m10", "m15", "m22", "m26"},
        "Bug-type temporal filtering",
    ),
    GroundTruthQuery(
        "When was the first deployment?",
        "temporal",
        {"m14"},
        "Event-time identification",
    ),
    GroundTruthQuery(
        "What happened after the launch?",
        "temporal",
        {"m25", "m26", "m27", "m28", "m29", "m30"},
        "Post-event temporal recall",
    ),
    GroundTruthQuery(
        "What was deployed and when?",
        "temporal",
        {"m14", "m24"},
        "Multi-deployment temporal",
    ),
    GroundTruthQuery(
        "What decisions were made in the sprint review?",
        "temporal",
        {"m20", "m23"},
        "Meeting-scoped recall",
    ),
    # Causal chains (why, because) — 4 queries
    GroundTruthQuery(
        "Why did the production database have issues?",
        "causal",
        {"m26", "m27"},
        "Cause-effect chain",
    ),
    GroundTruthQuery(
        "What caused the auth module crash?",
        "causal",
        {"m15", "m16"},
        "Bug cause-fix chain",
    ),
    GroundTruthQuery(
        "Why was rate limiting implemented?",
        "causal",
        {"m26", "m29"},
        "Decision justification",
    ),
    GroundTruthQuery(
        "What led to switching from REST to GraphQL?",
        "causal",
        {"m12", "m20"},
        "Decision evolution",
    ),
    # Pattern queries (usually, always) — 4 queries
    GroundTruthQuery(
        "What does Alice usually work on?",
        "pattern",
        {"m02", "m09", "m16", "m21", "m27"},
        "Person activity pattern",
    ),
    GroundTruthQuery(
        "What performance issues occurred?",
        "pattern",
        {"m12", "m21", "m22", "m28"},
        "Cross-time pattern",
    ),
    GroundTruthQuery(
        "What decisions did the team make?",
        "pattern",
        {"m01", "m05", "m06", "m20", "m23", "m29"},
        "Decision pattern",
    ),
    GroundTruthQuery(
        "What testing was done?",
        "pattern",
        {"m12", "m15"},
        "Activity type pattern",
    ),
    # Multi-session coherence (day 1 vs day 7 vs day 30) — 3 queries
    GroundTruthQuery(
        "How did the project evolve from start to launch?",
        "coherence",
        {"m01", "m03", "m14", "m19", "m24"},
        "Full timeline coherence",
    ),
    GroundTruthQuery(
        "How was the auth system developed and what issues arose?",
        "coherence",
        {"m05", "m09", "m10", "m15", "m16", "m30"},
        "Feature lifecycle",
    ),
    GroundTruthQuery(
        "What was Bob's contribution over the project?",
        "coherence",
        {"m04", "m11", "m18", "m22", "m28"},
        "Person contribution over time",
    ),
]


def get_memories_for_day(day: int) -> list[GroundTruthMemory]:
    """Get memories that should exist by a given day offset."""
    return [m for m in MEMORIES if m.day_offset <= day]


def get_session_schedule() -> list[tuple[int, list[GroundTruthMemory]]]:
    """Get the 5-session schedule for long-horizon coherence testing.

    Returns:
        List of (day, memories_to_encode) tuples
    """
    days = sorted({m.day_offset for m in MEMORIES})
    schedule: list[tuple[int, list[GroundTruthMemory]]] = []
    for day in days:
        day_memories = [m for m in MEMORIES if m.day_offset == day]
        schedule.append((day, day_memories))
    return schedule
