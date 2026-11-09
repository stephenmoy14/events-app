# Build from the repo root: docker build -f pipeline/Dockerfile -t events-pipeline .
FROM python:3.12-slim
WORKDIR /app
COPY pipeline/pyproject.toml pipeline/
COPY pipeline/src pipeline/src
RUN pip install --no-cache-dir ./pipeline
COPY config config
ENTRYPOINT ["python", "-m", "events_pipeline.run"]
