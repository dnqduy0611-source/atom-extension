.PHONY: install install-dev lint format typecheck test test-cov security audit check clean build docs serve

# Install package
install:
	pip install -e .

# Install with dev dependencies
install-dev:
	pip install -e ".[dev,server]"
	pre-commit install

# Run linter
lint:
	ruff check src/ tests/

# Format code
format:
	ruff format src/ tests/
	ruff check --fix src/ tests/

# Run type checker
typecheck:
	mypy src/

# Run tests
test:
	pytest tests/ -v

# Run tests with coverage
test-cov:
	pytest tests/ -v --cov=neural_memory --cov-report=term-missing --cov-report=html --cov-fail-under=67

# Run security checks (S rules already in select, filtered by ignore + per-file-ignores)
security:
	ruff check src/ --select S --ignore S101,S110,S112,S311,S324
	@echo "Security scan passed."

# Preview extended rules (non-blocking audit)
audit:
	ruff check src/ tests/ --select S,A,DTZ,T20,PT,PERF,PIE,ERA --statistics || true

# Run all checks (full quality gate)
check: lint typecheck test-cov security

# Clean build artifacts
clean:
	rm -rf build/
	rm -rf dist/
	rm -rf *.egg-info/
	rm -rf .pytest_cache/
	rm -rf .mypy_cache/
	rm -rf .ruff_cache/
	rm -rf htmlcov/
	rm -rf .coverage
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete

# Build package
build: clean
	python -m build

# Start development server
serve:
	uvicorn neural_memory.server.app:create_app --factory --reload --port 8000

# Generate docs
docs:
	mkdocs build

# Serve docs locally
docs-serve:
	mkdocs serve
