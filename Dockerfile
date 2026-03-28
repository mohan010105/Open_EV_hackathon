FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy environment source
COPY env/ ./env/
COPY server.py .
COPY inference.py .
COPY openenv.yaml .

# Expose port for the FastAPI server
EXPOSE 8080

# Health check for HuggingFace Spaces validation pings
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/api/healthz || exit 1

# Run the environment server
CMD ["python", "server.py"]
