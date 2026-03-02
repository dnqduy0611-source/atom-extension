FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY app/ ./app/
COPY api/ ./api/

# Copy static frontend
COPY web/ ./web/

# Create data directory for SQLite
RUN mkdir -p /app/data

# Railway sets PORT env var automatically
ENV HOST=0.0.0.0

EXPOSE 8001

CMD python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8001}
