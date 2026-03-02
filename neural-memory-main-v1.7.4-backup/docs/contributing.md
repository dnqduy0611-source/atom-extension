# Contributing

Thank you for your interest in contributing to NeuralMemory!

## Getting Started

### Development Setup

```bash
# Clone the repository
git clone https://github.com/nhadaututtheky/neural-memory
cd neural-memory

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows

# Install with dev dependencies
pip install -e ".[dev]"

# Install pre-commit hooks
pre-commit install
```

### Running Tests

```bash
# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ -v --cov=neural_memory --cov-report=term-missing

# Run specific test file
pytest tests/unit/test_neuron.py -v
```

### Code Quality

```bash
# Type checking
mypy src/

# Linting
ruff check src/ tests/

# Formatting
ruff format src/ tests/
```

## Code Style

We use:

- **ruff** for linting and formatting
- **mypy** for type checking
- **PEP 8** naming conventions
- **Google-style** docstrings

### Type Hints

All public functions must have type hints:

```python
# Good
def encode_memory(
    content: str,
    memory_type: MemoryType | None = None
) -> EncodingResult:
    ...

# Bad
def encode_memory(content, memory_type=None):
    ...
```

### Docstrings

Use Google-style docstrings:

```python
def query(
    self,
    query: str,
    depth: DepthLevel | None = None,
    max_tokens: int = 500
) -> RetrievalResult:
    """Query memories using spreading activation.

    Args:
        query: The query string to search for.
        depth: Search depth level (auto-detected if None).
        max_tokens: Maximum tokens in response.

    Returns:
        RetrievalResult containing context and metadata.

    Raises:
        ValueError: If query is empty.
    """
    ...
```

## Pull Request Process

### 1. Create a Branch

```bash
git checkout -b feature/my-feature
# or
git checkout -b fix/bug-description
```

### 2. Make Changes

- Keep commits focused and atomic
- Write tests for new functionality
- Update documentation as needed

### 3. Run Checks

```bash
# All checks must pass
pytest tests/ -v
mypy src/
ruff check src/ tests/
ruff format --check src/ tests/
```

### 4. Submit PR

- Write a clear description
- Reference any related issues
- Ensure CI passes

### Commit Messages

Use conventional commits:

```
feat: add decay manager for memory lifecycle
fix: handle null values in query parser
docs: update API reference
test: add tests for spreading activation
refactor: simplify neuron state management
chore: update dependencies
```

## Project Structure

```
src/neural_memory/
├── core/          # Data structures (Neuron, Synapse, etc.)
├── engine/        # Processing (Encoder, Pipeline, etc.)
├── extraction/    # NLP utilities (Parser, Temporal, etc.)
├── storage/       # Storage backends
├── server/        # FastAPI server
├── mcp/           # MCP server for Claude
├── cli/           # Command-line interface
└── sharing/       # Export/import functionality
```

## Testing Guidelines

### Unit Tests

Test individual components in isolation:

```python
# tests/unit/test_neuron.py
def test_neuron_creation():
    neuron = Neuron(
        id="test-1",
        type=NeuronType.ENTITY,
        content="Alice"
    )
    assert neuron.id == "test-1"
    assert neuron.type == NeuronType.ENTITY
```

### Integration Tests

Test component interactions:

```python
# tests/integration/test_encoding_flow.py
async def test_encode_and_retrieve():
    storage = InMemoryStorage()
    brain = Brain.create("test")
    await storage.save_brain(brain)
    storage.set_brain(brain.id)

    encoder = MemoryEncoder(storage, brain.config)
    await encoder.encode("Test memory")

    pipeline = ReflexPipeline(storage, brain.config)
    result = await pipeline.query("Test")
    assert result.confidence > 0
```

### Test Fixtures

Use pytest fixtures for common setup:

```python
# tests/conftest.py
@pytest.fixture
async def storage():
    storage = InMemoryStorage()
    yield storage

@pytest.fixture
async def brain(storage):
    brain = Brain.create("test-brain")
    await storage.save_brain(brain)
    storage.set_brain(brain.id)
    return brain
```

## Areas for Contribution

### Good First Issues

- Documentation improvements
- Test coverage increases
- Bug fixes with clear reproduction steps

### Intermediate

- New CLI commands
- Storage backend optimizations
- NLP improvements

### Advanced

- Neo4j storage implementation
- Rust extensions for performance
- New retrieval algorithms

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions
- Check existing issues before creating new ones

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
