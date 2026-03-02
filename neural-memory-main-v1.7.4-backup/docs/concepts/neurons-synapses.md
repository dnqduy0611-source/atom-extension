# Neurons & Synapses

The fundamental building blocks of NeuralMemory.

## Neurons

Neurons are atomic units of information in the memory graph.

### Neuron Types

| Type | Description | Examples |
|------|-------------|----------|
| `TIME` | Temporal references | "Tuesday", "3pm", "last week" |
| `SPATIAL` | Locations | "office", "coffee shop", "NYC" |
| `ENTITY` | People, things | "Alice", "UserService", "PR #123" |
| `ACTION` | Activities | "discussed", "fixed", "deployed" |
| `STATE` | Conditions | "blocked", "completed", "urgent" |
| `CONCEPT` | Ideas, topics | "authentication", "caching" |
| `SENSORY` | Observations | "error message", "log output" |
| `INTENT` | Goals, purposes | "improve performance", "fix bug" |

### Neuron Structure

```python
@dataclass(frozen=True)
class Neuron:
    id: str                    # Unique identifier
    type: NeuronType           # One of the types above
    content: str               # The actual value
    metadata: dict[str, Any]   # Type-specific metadata
```

### Neuron State

Mutable activation state is tracked separately:

```python
@dataclass
class NeuronState:
    neuron_id: str
    activation_level: float    # 0.0 - 1.0
    access_frequency: int      # How often accessed
    last_activated: datetime   # When last used
    decay_rate: float          # How fast it fades
    created_at: datetime
```

## Synapses

Synapses are typed, weighted connections between neurons.

### Synapse Types

#### Temporal Relationships

| Type | Meaning | Example |
|------|---------|---------|
| `HAPPENED_AT` | Event occurred at time | meeting → HAPPENED_AT → Tuesday |
| `BEFORE` | Temporal ordering | task_A → BEFORE → task_B |
| `AFTER` | Temporal ordering | deploy → AFTER → testing |
| `DURING` | Concurrent events | error → DURING → migration |

#### Spatial Relationships

| Type | Meaning | Example |
|------|---------|---------|
| `AT_LOCATION` | Where something is | meeting → AT_LOCATION → office |
| `CONTAINS` | Location hierarchy | building → CONTAINS → room |
| `NEAR` | Proximity | server_A → NEAR → server_B |

#### Causal Relationships

| Type | Meaning | Example |
|------|---------|---------|
| `CAUSED_BY` | What caused this | outage → CAUSED_BY → bug |
| `LEADS_TO` | What this causes | bug → LEADS_TO → crash |
| `ENABLES` | What this allows | auth → ENABLES → access |
| `PREVENTS` | What this blocks | rate_limit → PREVENTS → abuse |

#### Associative Relationships

| Type | Meaning | Example |
|------|---------|---------|
| `CO_OCCURS` | Appears together | Alice → CO_OCCURS → Bob |
| `RELATED_TO` | General association | auth → RELATED_TO → security |
| `SIMILAR_TO` | Conceptual similarity | Redis → SIMILAR_TO → Memcached |

#### Semantic Relationships

| Type | Meaning | Example |
|------|---------|---------|
| `IS_A` | Type hierarchy | FastAPI → IS_A → framework |
| `HAS_PROPERTY` | Attributes | bug → HAS_PROPERTY → critical |
| `INVOLVES` | Participation | meeting → INVOLVES → Alice |

#### Emotional Relationships

| Type | Meaning | Example |
|------|---------|---------|
| `FELT` | Emotional response | decision → FELT → confident |
| `EVOKES` | Triggers emotion | error → EVOKES → frustration |

### Synapse Structure

```python
@dataclass
class Synapse:
    id: str
    source_id: str              # From neuron
    target_id: str              # To neuron
    type: SynapseType           # One of the types above
    weight: float               # 0.0 - 1.0 (strength)
    direction: Direction        # uni or bi-directional
    metadata: dict[str, Any]

    # Lifecycle
    reinforced_count: int       # Times strengthened
    last_activated: datetime
    created_at: datetime
```

### Synapse Weights

Weights indicate connection strength:

- **0.0 - 0.3**: Weak association
- **0.3 - 0.6**: Normal association
- **0.6 - 0.8**: Strong association
- **0.8 - 1.0**: Very strong / causal link

Weights change over time:

- **Decay**: Unused synapses weaken
- **Reinforcement**: Activated synapses strengthen

### Direction

- **Unidirectional**: A → B (default)
- **Bidirectional**: A ↔ B (mutual relationship)

## Example Graph

Here's a memory graph from:

```bash
nmem remember "Met Alice at coffee shop. She suggested using JWT for auth."
```

```
                    ┌──────────────┐
                    │  [Tuesday]   │
                    │   (TIME)     │
                    └──────┬───────┘
                           │ HAPPENED_AT
                           ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ [Coffee shop]│◄───│   [Meeting]  │───►│   [Alice]    │
│  (SPATIAL)   │    │   (ACTION)   │    │   (ENTITY)   │
└──────────────┘    └──────────────┘    └──────┬───────┘
   AT_LOCATION           INVOLVES              │ SUGGESTED_BY
                                               ▼
                                        ┌──────────────┐
                                        │    [JWT]     │
                                        │  (CONCEPT)   │
                                        └──────┬───────┘
                                               │ RELATED_TO
                                               ▼
                                        ┌──────────────┐
                                        │    [Auth]    │
                                        │  (CONCEPT)   │
                                        └──────────────┘
```

## Fibers

Fibers group related neurons into coherent memories and serve as **signal pathways** for reflex activation.

### Fiber Structure

```python
@dataclass
class Fiber:
    id: str                           # Unique identifier
    neuron_ids: set[str]              # Neurons in this fiber
    synapse_ids: set[str]             # Synapses in this fiber
    anchor_neuron_id: str             # Primary entry point

    # Signal pathway (v0.6.0+)
    pathway: list[str]                # Ordered neuron sequence
    conductivity: float               # Signal quality (0.0-1.0)
    last_conducted: datetime | None   # When last activated

    # Metadata
    summary: str | None               # Human-readable summary
    salience: float                   # Importance (0.0-1.0)
    tags: set[str]                    # Labels
    frequency: int                    # Access count
```

### Conductivity

Conductivity controls how well signals pass through a fiber pathway:

| Conductivity | Meaning |
|-------------|---------|
| **1.0** | Full signal (new or frequently-used fiber) |
| **0.7-0.9** | Good signal (regularly accessed) |
| **0.3-0.6** | Weak signal (rarely used) |
| **0.0** | Dead pathway (no signal passes) |

Each time a fiber is activated with `reinforce=True`, conductivity increases by +0.02 (capped at 1.0).

### Pathway

The pathway defines the ordered sequence of neurons that signals travel through:

```
Pathway: [time_neuron] → [entity_neuron] → [action_neuron] → [concept_neuron]
```

Signals propagate forward and backward along the pathway during reflex activation.

## Creating Custom Neurons

Using the Python API:

```python
from neural_memory.core import Neuron, NeuronType

# Create a custom neuron
neuron = Neuron(
    id="unique-id-123",
    type=NeuronType.ENTITY,
    content="UserService",
    metadata={
        "file": "services/user.py",
        "language": "python"
    }
)

await storage.add_neuron(neuron)
```

## Creating Custom Synapses

```python
from neural_memory.core import Synapse, SynapseType, Direction

# Create a custom synapse
synapse = Synapse(
    id="synapse-456",
    source_id="neuron-a",
    target_id="neuron-b",
    type=SynapseType.CAUSED_BY,
    weight=0.8,
    direction=Direction.UNIDIRECTIONAL,
    metadata={"confidence": "high"}
)

await storage.add_synapse(synapse)
```
