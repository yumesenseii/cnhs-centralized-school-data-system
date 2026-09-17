# CNHS LEARN Academic Risk ML service (FastAPI + trained Random Forest)
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY artifacts ./artifacts

# Joblib artifact must ship with the image (do not train at boot).
RUN test -f artifacts/random_forest_academic_risk.joblib

EXPOSE 8000

# Railway / Render / Cloud Run inject $PORT
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
