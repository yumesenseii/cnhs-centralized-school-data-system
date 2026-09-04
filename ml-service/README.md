# CNHS LEARN — Academic Risk Machine Learning Service

## Purpose

Replace the previous rule-based “ensemble” path with a **trained Random Forest Classifier** that predicts academic risk from **ECR grades only**.

Attendance / SF2 remains a **separate** monitoring module and is **never** a model feature.

## Official risk basis (not arbitrary thresholds)

| Grade | Descriptor | Risk class |
|------:|------------|------------|
| 90–100 | Outstanding | Low Risk |
| 85–89 | Very Satisfactory | Low Risk |
| 80–84 | Satisfactory | Moderate Risk |
| 75–79 | Fairly Satisfactory | Moderate Risk |
| &lt;75 | Did Not Meet Expectations | High Risk |

**Final RF label classes (from General Average / GWA):**

- **85–100** → Low Risk  
- **75–84** → Moderate Risk  
- **&lt;75** → High Risk  

## Workflow

```
Historical ECR Data
→ Data Preprocessing
→ Official Grade-Based Risk Labeling (GWA → 3 classes)
→ Feature Preparation (features.js contract)
→ RandomForestClassifier Training
→ Model Evaluation (Accuracy, Precision, Recall, F1, Confusion Matrix)
→ Model Saving (joblib)
→ FastAPI Prediction (/predict, /predict_batch)
→ Academic Risk Result
→ Separate Intervention Recommendation (ARAL / Classroom Remediation / None)
```

## Feature contract (Model B — PRODUCTION)

Aligned with `lib/services/recommendation/features.js`.

**RF inputs (no GWA):**

- english_grade, filipino_grade, mathematics_grade, science_grade
- mapeh_grade (consolidated official MAPEH only), araling_panlipunan_grade
- tle_grade, values_education_grade
- failing_subject_count, language_fail_count, non_language_fail_count
- lowest_grade, available_grade_count

**Excluded from RF:** `general_average` (labels / UI only), SF2, attendance, Music/Arts/PE/Health as separate features.

See `docs/CNHS_SUBJECT_GRADING.md` for WW/PT/QA weight split (MAPEH & Values Education 20/60/20; others 20/50/30).
See `docs/MODEL_A_VS_B.md` for the leakage methodology note.

## Setup

```bash
cd ml-service
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate

pip install -r requirements.txt
python scripts/train_model.py
uvicorn app.main:app --reload --port 8000
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Model status + metrics summary |
| POST | `/predict` | Single learner risk |
| POST | `/predict_batch` | Bulk learners |

### Example `/predict` body

```json
{
  "student_id": "uuid",
  "features": {
    "english_grade": 72,
    "filipino_grade": 78,
    "mathematics_grade": 80,
    "science_grade": 81,
    "mapeh_grade": 85,
    "araling_panlipunan_grade": 79,
    "tle_grade": 82,
    "failing_subject_count": 1,
    "language_fail_count": 1,
    "non_language_fail_count": 0,
    "lowest_grade": 72,
    "available_grade_count": 7
  }
}
```

(`general_average` must not be included; if sent, the service ignores it.)

### Response (risk only)

```json
{
  "risk_level": "Moderate Risk",
  "confidence": 0.91,
  "probabilities": {
    "High Risk": 0.05,
    "Moderate Risk": 0.91,
    "Low Risk": 0.04
  },
  "source": "random-forest",
  "model_configuration": "Model B"
}
```

## Next.js integration

Set in `.env.local`:

```
RF_INFERENCE_URL=http://127.0.0.1:8000
```

CNHS LEARN calls:

- `POST /api/recommendations/predict`
- `POST /api/recommendations/predict-batch`

→ FastAPI trained model.

`recommendationService.generate()` / `generateBatch()`:

1. RF risk prediction  
2. Separate intervention policy  
3. ARAL eligibility (Eng/Fil grade &lt; 75)  

Rule-based engines remain **fallback only** (`source: "rule-based-fallback"`).

## Retrain on live ECR exports

1. Export grades CSV with subject columns + `general_average` (for labeling only).  
2. `python scripts/train_model.py --csv path/to/export.csv`  
3. Restart uvicorn (Model B joblib replaces production artifact).

## Evaluation artifacts

After training:

- `artifacts/random_forest_academic_risk.joblib` (Model B)
- `artifacts/metrics.json`
- `docs/MODEL_A_VS_B.md` (leakage methodology)

Model B excludes `general_average` from RF inputs so evaluation reflects subject-level learning, not label reconstruction.