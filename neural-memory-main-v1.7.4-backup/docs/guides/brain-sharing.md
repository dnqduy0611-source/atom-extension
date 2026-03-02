# Brain Sharing

Share knowledge between agents and team members.

## Overview

NeuralMemory supports multiple ways to share brains:

| Mode | Description | Use Case |
|------|-------------|----------|
| **Export/Import** | File-based transfer | Backup, offline sharing |
| **Shared Server** | Real-time HTTP sync | Team collaboration |
| **Fork** | Create copy of brain | Start from template |
| **Merge** | Combine two brains | Aggregate knowledge |

## Export & Import

### Export a Brain

```bash
# Export current brain
nmem brain export -o backup.json

# Export specific brain
nmem brain export --name work -o work-backup.json

# Export without sensitive content
nmem brain export --exclude-sensitive -o safe-share.json
```

### Import a Brain

```bash
# Import as new brain
nmem brain import backup.json

# Import with custom name
nmem brain import backup.json --name imported-brain

# Import and switch to it
nmem brain import backup.json --use

# Merge into existing brain
nmem brain import additional.json --merge

# Scan for sensitive content first
nmem brain import untrusted.json --scan
```

### Export Format

The export is a JSON file containing:

```json
{
  "brain_id": "brain-123",
  "exported_at": "2026-02-05T10:00:00Z",
  "version": "0.4.0",
  "neurons": [...],
  "synapses": [...],
  "fibers": [...],
  "typed_memories": [...],
  "neuron_states": [...],
  "metadata": {
    "neuron_count": 150,
    "synapse_count": 280,
    "fiber_count": 45
  }
}
```

## Shared Server Mode

### Enable Shared Mode

Connect to a NeuralMemory server:

```bash
# Enable with server URL
nmem shared enable http://localhost:8000

# With API key authentication
nmem shared enable https://memory.example.com --api-key YOUR_KEY

# With custom timeout
nmem shared enable http://localhost:8000 --timeout 60
```

### Check Status

```bash
nmem shared status
```

Output:
```
Shared mode: ENABLED
Server: http://localhost:8000
Connection: OK
Last sync: 2 minutes ago
```

### Test Connection

```bash
nmem shared test
```

### Use Shared Storage

Once enabled, commands automatically use remote storage:

```bash
# Store to remote
nmem remember "Shared team knowledge"

# Query from remote
nmem recall "team decisions"
```

### Per-Command Sharing

Use `--shared` flag for single commands without enabling globally:

```bash
nmem remember "Team insight" --shared
nmem recall "project status" --shared
```

### Sync Local with Remote

```bash
# Full bidirectional sync
nmem shared sync

# Push local to server only
nmem shared sync --direction push

# Pull from server only
nmem shared sync --direction pull
```

### Disable Shared Mode

```bash
nmem shared disable
```

## Running a Server

### Start Server

```bash
pip install neural-memory[server]
nmem serve --host 0.0.0.0 --port 8000
```

### Server Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/memory/encode` | POST | Store memory |
| `/memory/query` | POST | Query memories |
| `/brain/create` | POST | Create brain |
| `/brain/{id}` | GET | Get brain info |
| `/brain/{id}/export` | GET | Export brain |
| `/sync/ws` | WS | Real-time sync |
| `/ui` | GET | Web visualization |
| `/api/graph` | GET | Graph data for UI |

### Docker Deployment

```dockerfile
FROM python:3.11-slim

RUN pip install neural-memory[server]

EXPOSE 8000

CMD ["uvicorn", "neural_memory.server:app", "--host", "0.0.0.0", "--port", "8000"]
```

```bash
docker build -t neural-memory-server .
docker run -p 8000:8000 neural-memory-server
```

## Use Cases

### Team Knowledge Base

1. One team member runs the server
2. All team members connect with `nmem shared enable`
3. Decisions, patterns, and errors are automatically shared

```bash
# Team member 1
nmem remember "API rate limit is 1000/hour" --type fact --shared

# Team member 2 (sees the same knowledge)
nmem recall "rate limit" --shared
```

### Brain Templates

Create template brains for common setups:

```bash
# Create template
nmem brain create python-project-template
nmem remember "Use black for formatting" --type instruction
nmem remember "Run pytest before commit" --type workflow
nmem brain export -o python-template.json

# Share with team
# Each person imports as starting point
nmem brain import python-template.json --name my-project
```

### Knowledge Transfer

When onboarding or handing off:

```bash
# Expert exports their brain
nmem brain export --name auth-expertise -o auth-brain.json

# New team member imports
nmem brain import auth-brain.json --name auth-learning
nmem recall "authentication best practices"
```

### Multi-Agent Collaboration

Multiple AI agents share knowledge:

```bash
# Agent 1 learns something
nmem remember "User prefers detailed explanations" --type preference --shared

# Agent 2 uses that knowledge
nmem recall "user preferences" --shared
```

## Security Considerations

### Before Sharing

!!! warning "Check for Sensitive Content"
    Always check brain health before sharing:
    ```bash
    nmem brain health
    ```

### Safe Export

```bash
# Exclude sensitive content
nmem brain export --exclude-sensitive -o safe.json

# Scan import for issues
nmem brain import untrusted.json --scan
```

### Brain Isolation

Use separate brains for different security levels:

```bash
nmem brain create public-knowledge    # Safe to share
nmem brain create internal-only       # Team only
nmem brain create personal            # Never share
```

### Server Security

For production deployments:

- Use HTTPS
- Implement authentication (API keys)
- Set up proper CORS
- Use rate limiting
- Monitor for abuse

## Merge Strategies

When importing with `--merge`:

| Strategy | Behavior |
|----------|----------|
| Keep newer | Conflicting memories keep newer timestamp |
| Keep both | Both versions preserved with tags |
| Ask | Prompt for each conflict |

```bash
# Merge with existing brain
nmem brain import updates.json --merge
```

## Troubleshooting

### Connection Failed

```bash
# Check server is running
curl http://localhost:8000/health

# Check firewall/network
ping memory.example.com

# Increase timeout
nmem shared enable http://slow-server.com --timeout 120
```

### Sync Conflicts

```bash
# Check current status
nmem shared status

# Force push local
nmem shared sync --direction push

# Force pull remote
nmem shared sync --direction pull
```

### Large Exports

For very large brains:

```bash
# Export with compression
nmem brain export -o brain.json
gzip brain.json

# Import compressed
gunzip brain.json.gz
nmem brain import brain.json
```
