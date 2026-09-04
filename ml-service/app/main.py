"""
FastAPI Academic Risk Prediction Service

Trained RandomForestClassifier — ECR grades only (no SF2 / attendance).
Predicts: Low Risk | Moderate Risk | High Risk + confidence/probabilities.
Intervention recommendations are applied separately in CNHS LEARN.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .feature_contract import FEATURE_NAMES, to_feature_list
from .model_loader import get_model_bundle, model_ready

app = FastAPI(
    title="CNHS LEARN Academic Risk ML Service",
    description=(
        "Model B: Supervised Random Forest for academic risk "
        "(ECR subject grades only; general_average excluded from features). "
        "Attendance/SF2 is out of scope. Intervention is applied in CNHS LEARN."
    ),
    version="1.1.0-model-b",
)


class PredictRequest(BaseModel):
    student_id: str | None = None
    features: dict[str, Any] | None = None
    feature_list: list[float] | None = None
    feature_names: list[str] | None = None


class BatchPredictRequest(BaseModel):
    students: list[PredictRequest] = Field(default_factory=list)


def _predict_one(req: PredictRequest) -> dict[str, Any]:
    bundle = get_model_bundle()
    model = bundle["model"]
    names = bundle.get("feature_names") or FEATURE_NAMES
    vector = to_feature_list(req.features, req.feature_list, req.feature_names or names)
    X = [vector]
    pred = model.predict(X)[0]
    proba_row = model.predict_proba(X)[0]
    classes = list(model.classes_)
    probabilities = {
        str(cls): float(p) for cls, p in zip(classes, proba_row)
    }
    confidence = float(max(proba_row))
    return {
        "student_id": req.student_id,
        "risk_level": str(pred),
        "riskLevel": str(pred),
        "confidence": confidence,
        "probabilities": probabilities,
        "class_probabilities": probabilities,
        "feature_names": FEATURE_NAMES,
        "source": "random-forest",
        "model": "RandomForestClassifier",
        "model_configuration": "Model B",
        # Intervention is NOT predicted by this service.
        "reasons": [
            f"Trained Random Forest (Model B) predicted {pred} "
            f"(confidence {confidence:.2f})."
        ],
    }


@app.get("/health")
def health():
    ready = model_ready()
    payload = {
        "status": "ok" if ready else "degraded",
        "model_loaded": ready,
        "model_configuration": "Model B",
        "feature_names": FEATURE_NAMES,
        "general_average_in_features": False,
        "predicts": ["Low Risk", "Moderate Risk", "High Risk"],
        "excludes": ["SF2", "attendance", "general_average"],
    }
    if ready:
        try:
            bundle = get_model_bundle()
            payload["classes"] = list(bundle["model"].classes_)
            payload["metrics_summary"] = {
                k: bundle.get("metrics", {}).get(k)
                for k in ("accuracy", "precision_macro", "recall_macro", "f1_macro")
            }
        except Exception as exc:  # noqa: BLE001
            payload["status"] = "degraded"
            payload["error"] = str(exc)
    return payload


@app.post("/predict")
def predict(req: PredictRequest):
    if not model_ready():
        raise HTTPException(status_code=503, detail="Model artifact not found. Train first.")
    try:
        return _predict_one(req)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/predict_batch")
def predict_batch(req: BatchPredictRequest):
    if not model_ready():
        raise HTTPException(status_code=503, detail="Model artifact not found. Train first.")
    if not req.students:
        return {"predictions": [], "count": 0, "source": "random-forest"}
    try:
        predictions = [_predict_one(item) for item in req.students]
        return {
            "predictions": predictions,
            "count": len(predictions),
            "source": "random-forest",
        }
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc
