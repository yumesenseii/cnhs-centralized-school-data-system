# Model A vs Model B — Target Leakage Methodology

## Official risk labels (unchanged)

GWA remains the **documented basis** for ground-truth labels:

| GWA | Risk class |
|----:|------------|
| 85–100 | Low Risk |
| 75–84 | Moderate Risk |
| &lt;75 | High Risk |

(Official scale descriptors: Outstanding / Very Satisfactory → Low; Satisfactory / Fairly Satisfactory → Moderate; Did Not Meet Expectations → High.)

## Model A (rejected for production)

- **Features:** full ECR contract **including** `general_average`
- **Labels:** from GWA official bands
- **Problem:** target leakage — GWA both defines `y` and appears in `X`
- **Symptom:** artificially perfect evaluation (Accuracy / Precision / Recall / F1 ≈ 1.0)
- Feature importance was dominated by `general_average` (~36%)

Model A is **not** served in production.

## Model B (FINAL production)

- **Features:** subject grades + failing counts + lowest grade + available grade count — **no** `general_average`
- **Labels:** still from official GWA bands (labeling only)
- **Rationale:** Random Forest learns academic risk patterns from individual subject performance and related indicators without seeing the label source directly
- **Contracts aligned:** `ml-service/app/feature_contract.py` ↔ `lib/services/recommendation/features.js`

GWA may still be computed for UI display and for creating training labels. It is **never** sent to `/predict` or `/predict_batch` as an RF input.

## Boundaries

- No SF2 / attendance features
- RF predicts only Low / Moderate / High Risk (+ confidence / probabilities)
- Intervention (ARAL / Classroom Remediation) remains a separate policy layer
