FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

ARG INSTALL_OPTIONAL_AI=false

RUN if [ "$INSTALL_OPTIONAL_AI" = "true" ]; then \
      apt-get update \
      && apt-get install -y --no-install-recommends build-essential \
      && rm -rf /var/lib/apt/lists/*; \
    fi

COPY requirements*.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    && if [ "$INSTALL_OPTIONAL_AI" = "true" ]; then \
         pip install --no-cache-dir -r requirements-optional.txt; \
       fi

COPY . .

RUN mkdir -p /app/runtime/voice

EXPOSE 8005

CMD ["sh", "-c", "if [ ! -f /app/runtime/dev.db ] && [ -f /app/dev.db ]; then cp /app/dev.db /app/runtime/dev.db; fi; alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8005"]
