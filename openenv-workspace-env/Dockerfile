FROM python:3.10-slim

# Non-root user for HuggingFace Spaces compatibility
RUN useradd -m -u 1000 appuser

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Switch to non-root user
USER appuser

# HuggingFace Spaces uses port 7860
EXPOSE 7860

# Launch FastAPI server
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "7860"]
