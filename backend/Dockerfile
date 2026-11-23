# The Hoot backend. Built from the repo root: docker compose build (see docs/deployment.md).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/app backend/app

RUN useradd --system --uid 10001 hoot && mkdir /data && chown hoot /data
USER hoot

EXPOSE 8000

# One process: refreshing a user's GitHub token is serialised per process.
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
