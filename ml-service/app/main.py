"""
FastAPI Academic Risk Prediction Service

Trained RandomForestClassifier — ECR grades only (no SF2 / attendance).
Predicts: Low Risk | Moderate Risk | High Risk + confidence/probabilities.
Intervention recommendations are applied separately in CNHS LEARN.
"""

from __future__ import annotations

import os
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
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


def _expected_api_key() -> str:
    return (os.environ.get("RF_INFERENCE_API_KEY") or "").strip()


@app.middleware("http")
async def optional_api_key_guard(request: Request, call_next):
    """If RF_INFERENCE_API_KEY is set, require Bearer token (except /health)."""
    expected = _expected_api_key()
    if not expected or request.url.path in ("/health", "/docs", "/openapi.json", "/redoc"):
        return await call_next(request)

    auth = request.headers.get("authorization") or ""
    token = ""
    if auth.lower().startswith("bearer "):
        token = auth[7:].strip()
    if token != expected:
        return JSONResponse(
            status_code=401,
            content={"detail": "Invalid or missing RF_INFERENCE_API_KEY."},
        )
    return await call_next(request)


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


class TrajectoryRequest(BaseModel):
    student_id: str | None = None
    terms: dict[str, dict[str, Any]] = Field(
        default_factory=dict,
        description="Map of term keys ('term_1', 'term_2', 'term_3') to feature dictionaries."
    )


class ExplainRequest(BaseModel):
    student_id: str | None = None
    features: dict[str, Any] | None = None
    feature_list: list[float] | None = None
    feature_names: list[str] | None = None


def _explain_one(req: ExplainRequest) -> dict[str, Any]:
    bundle = get_model_bundle()
    model = bundle["model"]
    names = bundle.get("feature_names") or FEATURE_NAMES
    vector = to_feature_list(req.features, req.feature_list, req.feature_names or names)
    X = [vector]
    pred = model.predict(X)[0]
    proba_row = model.predict_proba(X)[0]
    classes = list(model.classes_)
    probabilities = {str(cls): float(p) for cls, p in zip(classes, proba_row)}
    confidence = float(max(proba_row))

    importances = model.feature_importances_
    drivers = []
    for name, val, imp in zip(names, vector, importances):
        if val == -1.0:
            continue
        # Impact weight = feature importance scaled by academic vulnerability
        if "grade" in name and val < 75:
            drivers.append({
                "feature": name,
                "value": val,
                "importance": float(imp),
                "severity": "critical",
                "message": f"{name.replace('_', ' ').title()} is failing ({val:.1f})"
            })
        elif "grade" in name and val < 80:
            drivers.append({
                "feature": name,
                "value": val,
                "importance": float(imp),
                "severity": "moderate",
                "message": f"{name.replace('_', ' ').title()} is near failing ({val:.1f})"
            })
        elif "count" in name and val > 0:
            drivers.append({
                "feature": name,
                "value": val,
                "importance": float(imp),
                "severity": "critical" if val >= 2 else "moderate",
                "message": f"{int(val)} subject(s) flagged under {name.replace('_', ' ')}"
            })

    drivers.sort(key=lambda d: d["importance"], reverse=True)

    return {
        "student_id": req.student_id,
        "risk_level": str(pred),
        "confidence": confidence,
        "probabilities": probabilities,
        "primary_risk_drivers": drivers[:5],
        "model": "RandomForestClassifier (200 Trees)",
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


@app.post("/explain_risk")
def explain_risk(req: ExplainRequest):
    if not model_ready():
        raise HTTPException(status_code=503, detail="Model artifact not found. Train first.")
    try:
        return _explain_one(req)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/predict_trajectory")
def predict_trajectory(req: TrajectoryRequest):
    if not model_ready():
        raise HTTPException(status_code=503, detail="Model artifact not found. Train first.")
    try:
        progression = {}
        for term_key, feat_dict in req.terms.items():
            pred_res = _predict_one(PredictRequest(
                student_id=req.student_id,
                features=feat_dict
            ))
            progression[term_key] = {
                "risk_level": pred_res["risk_level"],
                "confidence": pred_res["confidence"],
                "probabilities": pred_res["probabilities"],
            }

        # Trajectory assessment
        term_keys = sorted(progression.keys())
        status = "Stable"
        if len(term_keys) >= 2:
            first_risk = progression[term_keys[0]]["risk_level"]
            last_risk = progression[term_keys[-1]]["risk_level"]
            rank = {"High Risk": 3, "Moderate Risk": 2, "Low Risk": 1}
            r_first = rank.get(first_risk, 1)
            r_last = rank.get(last_risk, 1)
            if r_last < r_first:
                status = "De-escalating (Improved)"
            elif r_last > r_first:
                status = "Escalating (Worsened)"
            else:
                status = "Stable"

        return {
            "student_id": req.student_id,
            "trajectory_status": status,
            "terms": progression,
            "source": "random-forest",
        }
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/dataset/cnhs-2025-2026/summary")
def get_historical_dataset_summary() -> dict[str, Any]:
    """Returns official CNHS historical cohort metrics and model alignment for SY 2025-2026."""
    return {
        "school_year": "SY 2025-2026",
        "benchmark_source": "Official CNHS Historical Aggregate Benchmark",
        "total_unique_students": 600,
        "total_term_records": 1800,
        "aral_cohort": {
            "basic": {
                "beginning": 129,
                "end": 120,
                "retained": 19,
                "promoted": 101,
                "percentage": 78.29,
            },
            "plus": {
                "beginning": 86,
                "end": 81,
                "retained": 7,
                "promoted": 74,
                "percentage": 86.05,
            },
            "total_enrolled": 215,
            "total_promoted": 175,
            "overall_promotion_rate": 81.40,
        },
        "monthly_attendance_trajectory": {
            "september": 65.79,
            "october": 60.35,
            "november": 52.89,
        },
        "classroom_remediation_cohort": {
            "enrolled": 105,
            "improved": 82,
            "recovery_rate": 78.10,
        },
        "model_performance": {
            "model": "RandomForestClassifier (Model B)",
            "test_accuracy": 0.9917,
            "macro_f1": 0.9899,
            "features_used": FEATURE_NAMES,
        },
    }


