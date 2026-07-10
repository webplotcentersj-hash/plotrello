"""
Detector adaptado al reloj tablet Plot Lab.

Selfie cercana en kiosco → MediaPipe rostros + supervision (zona/tamaño).
YOLO persona solo como respaldo si no se detecta rostro (persona de espaldas, etc.).
"""
from __future__ import annotations

import os
import time
from typing import Any

import cv2
import mediapipe as mp
import numpy as np
import supervision as sv
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from ultralytics import YOLO

API_KEY = os.getenv("DETECTOR_API_KEY", "").strip()
MODO = os.getenv("DETECTOR_MODO", "reloj_tablet").strip()
MIN_FACE_AREA = float(os.getenv("MIN_FACE_AREA", "0.035"))
MAX_FACE_AREA = float(os.getenv("MAX_FACE_AREA", "0.72"))
MIN_FACE_SCORE = float(os.getenv("MIN_FACE_SCORE", "0.50"))
YOLO_CONF = float(os.getenv("YOLO_CONF", "0.30"))
MODEL_NAME = os.getenv("YOLO_MODEL", "yolov8n.pt")

app = FastAPI(title="Plot Reloj Detector", version="2.0.0")
_model: YOLO | None = None
_face_detector = mp.solutions.face_detection.FaceDetection(
    model_selection=1,
    min_detection_confidence=0.40,
)


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


def _fail(
    motivo: str,
    *,
    metodo: str,
    rostros: int = 0,
    personas: int = 0,
    area: float | None = None,
    confianza: float | None = None,
    sugerencia: str | None = None,
) -> dict[str, Any]:
    out: dict[str, Any] = {
        "ok": False,
        "modo": MODO,
        "metodo": metodo,
        "rostros": rostros,
        "personas": personas,
        "motivo": motivo,
    }
    if area is not None:
        out["area"] = round(area, 3)
    if confianza is not None:
        out["confianza"] = round(confianza, 3)
    if sugerencia:
        out["sugerencia"] = sugerencia
    return out


def _ok(
    metodo: str,
    *,
    rostros: int = 1,
    personas: int = 1,
    area: float,
    confianza: float,
    motivo: str = "Rostro listo para marcar",
) -> dict[str, Any]:
    return {
        "ok": True,
        "modo": MODO,
        "metodo": metodo,
        "rostros": rostros,
        "personas": personas,
        "area": round(area, 3),
        "confianza": round(confianza, 3),
        "motivo": motivo,
        "sugerencia": "Mantenete quieto un segundo",
    }


def analyze_rostro_tablet(img: np.ndarray) -> dict[str, Any]:
    """Selfie de tablet: validar 1 rostro centrado y con tamaño útil para Gemini."""
    h, w = img.shape[:2]
    if h < 64 or w < 64:
        return _fail("Imagen demasiado chica", metodo="rostro")

    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    results = _face_detector.process(rgb)
    detections = results.detections or []
    count = len(detections)

    if count == 0:
        return analyze_yolo_respaldo(img)

    if count > 1:
        return _fail(
            "Hay más de una persona frente al reloj",
            metodo="rostro",
            rostros=count,
            personas=count,
            sugerencia="Marcá de a una persona",
        )

    det = detections[0]
    score = float(det.score[0]) if det.score else 0.0
    box = det.location_data.relative_bounding_box
    area = float(max(0.0, box.width * box.height))
    cx = float(box.xmin + box.width / 2)
    cy = float(box.ymin + box.height / 2)

    # supervision: validar caja en zona útil del encuadre kiosco
    x1 = int(max(0, box.xmin) * w)
    y1 = int(max(0, box.ymin) * h)
    x2 = int(min(1.0, box.xmin + box.width) * w)
    y2 = int(min(1.0, box.ymin + box.height) * h)
    sv_det = sv.Detections(
        xyxy=np.array([[x1, y1, x2, y2]], dtype=float),
        confidence=np.array([score]),
    )
    _ = sv_det  # anotación disponible si luego queremos debug visual

    if score < MIN_FACE_SCORE:
        return _fail(
            "Rostro poco claro",
            metodo="rostro",
            rostros=1,
            personas=1,
            area=area,
            confianza=score,
            sugerencia="Mejorá la luz o sacá gorra/barbufo",
        )

    if area < MIN_FACE_AREA:
        return _fail(
            "Acercate más al reloj",
            metodo="rostro",
            rostros=1,
            personas=1,
            area=area,
            confianza=score,
            sugerencia="Parate a un brazo de distancia de la tablet",
        )

    if area > MAX_FACE_AREA:
        return _fail(
            "Alejate un poco",
            metodo="rostro",
            rostros=1,
            personas=1,
            area=area,
            confianza=score,
            sugerencia="Tu rostro ocupa demasiado la pantalla",
        )

    if cx < 0.18 or cx > 0.82 or cy < 0.12 or cy > 0.88:
        return _fail(
            "Centrá tu rostro en la cámara",
            metodo="rostro",
            rostros=1,
            personas=1,
            area=area,
            confianza=score,
            sugerencia="Mirá de frente al centro del reloj",
        )

    return _ok("rostro", area=area, confianza=score)


def analyze_yolo_respaldo(img: np.ndarray) -> dict[str, Any]:
    """Respaldo: persona completa si MediaPipe no ve rostro (ángulo raro, casco, etc.)."""
    h, w = img.shape[:2]
    results = get_model()(img, classes=[0], conf=YOLO_CONF, verbose=False)[0]
    detections = sv.Detections.from_ultralytics(results)
    count = len(detections)

    if count == 0:
        return _fail(
            "No se ve ningún rostro ni persona",
            metodo="persona_yolo",
            sugerencia="Parate frente a la cámara del reloj",
        )

    if count > 1:
        return _fail(
            "Hay más de una persona",
            metodo="persona_yolo",
            personas=count,
            sugerencia="Marcá de a una persona",
        )

    x1, y1, x2, y2 = detections.xyxy[0]
    area_ratio = float((x2 - x1) * (y2 - y1) / (w * h))
    conf = float(detections.confidence[0]) if detections.confidence is not None else 0.0

    if area_ratio < 0.02:
        return _fail(
            "Acercate más al reloj",
            metodo="persona_yolo",
            personas=1,
            area=area_ratio,
            confianza=conf,
            sugerencia="El encuadre se ve muy lejos",
        )

    return _ok(
        "persona_yolo",
        area=area_ratio,
        confianza=conf,
        motivo="Persona detectada (respaldo)",
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "modo": MODO,
        "metodo": "rostro_mediapipe+supervision",
        "respaldo": MODEL_NAME,
    }


@app.post("/detectar")
async def detectar(
    file: UploadFile = File(...),
    x_detector_key: str | None = Header(default=None, alias="X-Detector-Key"),
    x_reloj_modo: str | None = Header(default=None, alias="X-Reloj-Modo"),
) -> JSONResponse:
    assert_auth(x_detector_key)
    _ = x_reloj_modo or MODO
    t0 = time.perf_counter()
    raw = await file.read()
    if len(raw) > 5_000_000:
        raise HTTPException(status_code=413, detail="Imagen demasiado grande (máx 5 MB)")
    img = decode_image(raw)
    result = analyze_rostro_tablet(img)
    result["ms"] = round((time.perf_counter() - t0) * 1000, 1)
    return JSONResponse(content=result, status_code=200)


@app.on_event("startup")
def warmup() -> None:
    dummy = np.zeros((480, 640, 3), dtype=np.uint8)
    analyze_rostro_tablet(dummy)
