# RF risk evaluation (thesis / defense)

This artifact evaluates **academic RISK only** (High / Moderate / Low).

It does **not** evaluate:

- ARAL (English / Filipino class-subject grade &lt; 75)
- Classroom Remedial (class share of graded learners below 75 &gt; 50%)

Teachers never see this matrix. Academic Monitoring shows Risk + a compact **Priority** (check-first) cue, not sklearn copy.

## Official grade-band labels

Same bands as `riskLevelFromGrade` / `GRADE_RISK_BANDS` / `risk_label_from_gwa`:

| Grade | Official risk |
|------:|---------------|
| &lt; 75 | High Risk |
| 75–84 | Moderate Risk |
| ≥ 85 | Low Risk |

Ungraded rows (no GWA / no official label) are **excluded**.

## Command

From the repo root, against the trained model:

```bash
npm run ml:eval
```

Equivalent (from `ml-service`, using the venv):

```bash
.venv\Scripts\python scripts\eval_confusion_matrix.py
```

Default: holdout split matching `train_model.py` (`--test-size 0.2 --seed 42`).

Score every labeled row:

```bash
cd ml-service
.venv\Scripts\python scripts\eval_confusion_matrix.py --full
```

Writes `ml-service/artifacts/confusion_matrix.json` (3×3 counts, accuracy, per-class precision / recall / F1).

Train first if the joblib is missing: `npm run ml:train`.
