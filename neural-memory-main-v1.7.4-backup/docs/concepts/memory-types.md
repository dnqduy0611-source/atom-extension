# Memory Types

NeuralMemory supports typed memories for better organization and automatic lifecycle management.

## Available Types

| Type | Description | Default Expiry | Use Case |
|------|-------------|----------------|----------|
| `fact` | Objective information | Never | API endpoints, configuration values |
| `decision` | Choices made | Never | Architectural decisions, tool choices |
| `preference` | User preferences | Never | Coding style, naming conventions |
| `todo` | Action items | 30 days | Tasks, reminders, follow-ups |
| `insight` | Learned patterns | Never | Debugging tricks, optimization tips |
| `context` | Situational info | 7 days | Meeting notes, temporary context |
| `instruction` | User guidelines | Never | Project rules, conventions |
| `error` | Error patterns | Never | Bug fixes, error solutions |
| `workflow` | Process patterns | Never | Deployment steps, review processes |
| `reference` | External references | Never | Documentation links, resources |

## Using Memory Types

### Explicit Type

```bash
nmem remember "We decided to use PostgreSQL" --type decision
nmem remember "API endpoint: /v2/users" --type fact
nmem remember "Review PR before merge" --type instruction
```

### Auto-Detection

NeuralMemory can detect types from content:

```bash
# Detected as TODO
nmem remember "TODO: fix the login bug"

# Detected as ERROR
nmem remember "ERROR: null pointer in auth module"

# Detected as DECISION
nmem remember "We chose FastAPI over Flask"
```

## Type-Specific Features

### fact

Facts are objective, verifiable information.

```bash
nmem remember "Database host is db.example.com" --type fact
nmem remember "Max file size is 10MB" --type fact
```

**Behavior:**

- Never expires
- High priority in retrieval for technical queries
- Good for configuration, endpoints, specifications

### decision

Architectural and strategic decisions.

```bash
nmem remember "DECISION: Use JWT for auth. REASON: Stateless, scales better." --type decision
```

**Best Practice:** Include rationale

```bash
nmem remember "DECISION: PostgreSQL over MongoDB. REASON: Strong consistency needed. ALTERNATIVE: Considered MongoDB for flexibility." --type decision
```

**Behavior:**

- Never expires
- Searchable by decision keywords
- Critical for understanding project history

### preference

User and team preferences.

```bash
nmem remember "User prefers tabs over spaces" --type preference
nmem remember "Team uses camelCase for JS" --type preference
```

**Behavior:**

- Never expires
- Lower activation weight (preferences are contextual)
- Used for personalization

### todo

Action items and tasks.

```bash
nmem todo "Fix the login bug"
nmem todo "Review PR #123" --priority 8
nmem todo "Deploy to production" --priority 10 --expires 1
```

**Behavior:**

- Expires in 30 days by default
- Supports priority 0-10
- Listed with `nmem list --type todo`

### insight

Learned patterns and tips.

```bash
nmem remember "Cache invalidation causes 90% of our bugs" --type insight
nmem remember "Always check for null before array access" --type insight
```

**Behavior:**

- Never expires
- High value for similar problem-solving
- Good for documenting "lessons learned"

### context

Temporary, situational information.

```bash
nmem remember "Currently working on auth module" --type context
nmem remember "Sprint 5 focus: performance" --type context --expires 14
```

**Behavior:**

- Expires in 7 days by default
- Lower retrieval priority for older queries
- Good for session-specific context

### instruction

Rules and guidelines.

```bash
nmem remember "Always run tests before committing" --type instruction
nmem remember "Use semantic commit messages" --type instruction
```

**Behavior:**

- Never expires
- High priority in retrieval
- Good for enforcing conventions

### error

Error patterns and solutions.

```bash
nmem remember "ERROR: 'Cannot read id of undefined'. SOLUTION: Add null check before user.id" --type error
```

**Best Practice:** Include both error and solution

```bash
nmem remember "ERROR: CORS blocked request. SOLUTION: Add origin to allowed list in cors.config.ts" --type error --tag cors --tag api
```

**Behavior:**

- Never expires
- Highly relevant for debugging queries
- Pairs well with tags for categorization

### workflow

Process documentation.

```bash
nmem remember "Deploy process: 1. Run tests 2. Build 3. Push to staging 4. Verify 5. Push to prod" --type workflow
```

**Behavior:**

- Never expires
- Good for recurring processes
- Can be broken into steps

### reference

External links and resources.

```bash
nmem remember "FastAPI docs: https://fastapi.tiangolo.com" --type reference
nmem remember "Design doc: notion.so/design-v2" --type reference
```

**Behavior:**

- Never expires
- Lower activation weight (supplementary info)
- Good for documentation links

## Priority System

All types support priority 0-10:

| Priority | Meaning | Use Case |
|----------|---------|----------|
| 0-2 | Low | Nice to have, minor notes |
| 3-4 | Below normal | Useful but not critical |
| 5 | Normal (default) | Standard importance |
| 6-7 | Above normal | Important items |
| 8-9 | High | Critical information |
| 10 | Critical | Must not forget |

```bash
nmem remember "API key rotation needed" --priority 9
nmem todo "Update dependencies" --priority 3
```

## Expiry

Set custom expiry in days:

```bash
nmem remember "Sprint goal" --type context --expires 14
nmem todo "Review before Friday" --expires 5
```

Check expired memories:

```bash
nmem list --expired
nmem cleanup --expired --dry-run
```

## Querying by Type

```bash
# List all TODOs
nmem list --type todo

# List high-priority decisions
nmem list --type decision --min-priority 7

# Get only facts about auth
nmem recall "auth configuration" --type fact
```

## Cleanup by Type

```bash
# Clean expired context
nmem cleanup --type context --expired

# Preview cleanup
nmem cleanup --type todo --expired --dry-run
```
