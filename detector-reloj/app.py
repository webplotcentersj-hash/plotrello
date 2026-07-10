"""
Detector de presencia para reloj tablet (YOLO + supervision).
Paso 1: deploy en VPS Hostinger. La tablet llega vía proxy Vercel (paso 2).
"""
from __future__ import annotations

import os
import time
from typing import Any

import cv2
import numpy as np
import supervision as sv
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from ultralytics import YOLO

API_KEY = os.getenv("DETECTOR_API_KEY", "").strip()
MIN_PERSON_AREA = float(os.getenv("MIN_PERSON_AREA", "0.08"))
MAX_PERSON_AREA = float(os.getenv("MAX_PERSON_AREA", "0.92"))
MODEL_NAME = os.getenv("YOLO_MODEL", "yolov8n.pt")

app = FastAPI(title="Plot Reloj Detector", version="1.0.0")
_model: YOLO | None = None


def get_model() -> YOLO:
    global _model
    if _model is None:
        _model = YOLO(MODEL_NAME)
    return _model


def assert_auth(key: str | None) -> None:
    if not API_KEY:
        raise HTTPException(status_code=503, detail="DETECTOR_API_KEY no configurada")
    got = (key or "").strip()
    if got != API_KEY:
        raise HTTPException(status_code=401, detail="No autorizado")


def decode_image(data: bytes) -> np.ndarray:
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Imagen inválida")
    return img


def analyze_frame(img: np.ndarray) -> dict[str, Any]:
    h, w = img.shape[:2]
    if h < 64 or w < 64:
        return {"ok": False, "personas": 0, "motivo": "Imagen demasiado chica"}

    results = get_model()(img, classes=[0], verbose=False)[0]
    detections = sv.Detections.from_ultralytics(results)
    count = len(detections)

    if count == 0:
        return {"ok": False, "personas": 0, "motivo": "No hay nadie en cámara"}

    if count > 1:
        return {"ok": False, "personas": count, "motivo": "Hay más de una persona"}

    x1, y1, x2, y2 = detections.xyxy[0]
    area_ratio = float((x2 - x1) * (y2 - y1) / (w * h))
    conf = float(detections.confidence[0]) if detections.confidence is not None else 0.0

    cx = float((x1 + x2) / 2)
    cy = float((y1 + y2) / 2)
    cx_norm = cx / w
    cy_norm = cy / h

    if area_ratio < MIN_PERSON_AREA:
        return {
            "ok": False,
            "personas": 1,
            "area": round(area_ratio, 3),
            "confianza": round(conf, 3),
            "motivo": "Acercate más al reloj",
        }

    if area_ratio > MAX_PERSON_AREA:
        return {
            "ok": False,
            "personas": 1,
            "area": round(area_ratio, 3),
            "confianza": round(conf, 3),
            "motivo": "Alejate un poco",
        }

    if cx_norm < 0.12 or cx_norm > 0.88 or cy_norm < 0.08 or cy_norm > 0.92:
        return {
            "ok": False,
            "personas": 1,
            "area": round(area_ratio, 3),
            "confianza": round(conf, 3),
            "motivo": "Centrate frente a la cámara",
        }

    return {
        "ok": True,
        "personas": 1,
        "area": round(area_ratio, 3),
        "confianza": round(conf, 3),
        "motivo": "Persona detectada",
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "model": MODEL_NAME}


@app.post("/detectar")
async def detectar(
    file: UploadFile = File(...),
    x_detector_key: str | None = Header(default=None, alias="X-Detector-Key"),
) -> JSONResponse:
    assert_auth(x_detector_key)
    t0 = time.perf_counter()
    raw = await file.read()
    if len(raw) > 5_000_000:
        raise HTTPException(status_code=413, detail="Imagen demasiado grande (máx 5 MB)")
    img = decode_image(raw)
    result = analyze_frame(img)
    result["ms"] = round((time.perf_counter() - t0) * 1000, 1)
    status = 200 if result.get("ok") else 200
    return JSONResponse(content=result, status_code=status)


@app.on_event("startup")
def warmup() -> None:
    """Precarga el modelo al arrancar."""
    get_model()
