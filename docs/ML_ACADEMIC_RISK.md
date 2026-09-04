# Academic Prediction — ML Integration & Retest Checklist

## Model B (production)

Production RF **excludes** `general_average` from features (target-leakage fix).
GWA is used only for official training labels. See `ml-service/docs/MODEL_A_VS_B.md`.

## Architecture

```
CNHS LEARN (Next.js)
  → buildFeatureVector (ECR only)
  → /api/recommendations/predict-batch
  → FastAPI RandomForestClassifier
  → risk_level + confidence + probabilities
  → interventionPolicy (ARAL / remediation / none)
  → Dashboard / Monitoring / Reports
```

Attendance (SF2) is isolated under Attendance Monitoring.

## Environment

```
RF_INFERENCE_URL=http://127.0.0.1:8000
# optional:
# RF_INFERENCE_TIMEOUT_MS=8000
# RF_INFERENCE_BATCH_TIMEOUT_MS=30000
# RF_INFERENCE_API_KEY=
```

## Safe demo-data reset

See `scripts/safe-reset-demo-data.sql`.

**Dry-run first.** Only removes clearly flagged demo/test rows. Does **not** drop schema, tables, env, or required admin access.

## Retesting checklist

1. **Fresh test accounts** — create new teacher/admin test users after reset (keep one real admin).
2. **Fresh learner data** — enroll learners in a class (or import ECR roster).
3. **ECR upload** — import Class Record Excel; confirm grades appear.
4. **Random Forest prediction** — start `ml-service`, set `RF_INFERENCE_URL`, open Monitoring; confirm `source` is random-forest (not rule-based-fallback).
5. **Risk classification** — verify High / Moderate / Low align with academic performance patterns learned by RF (labels trained on official GWA bands).
6. **Confidence / probabilities** — inspect recommendation confidence and optional probability map from API.
7. **Intervention recommendation** — Eng/Fil failing → ARAL candidate; other fails → remediation policy; Low risk → none. Confirm RF did not emit intervention type directly.
8. **Batch prediction** — load full monitoring roster; confirm `/predict_batch` is used and UI remains responsive.
9. **Attendance isolation** — upload SF2; confirm attendance module works and academic risk features never include attendance fields.
10. **Reports and monitoring** — grade bands show &lt;75 / 75–84 / 85–100; risk cards use RF risk from roster.

## Capstone note

Earlier UI paths were named “Random Forest” but used rule-based voting. This release trains a real `sklearn.ensemble.RandomForestClassifier`, persists it with joblib, and serves it via FastAPI so the claimed methodology matches the running system.
