"""
FastAPI Backend for AEGIS AI Vision System
Handles ESP32-CAM stream ingestion, YOLOv8 inference, and WebSocket streaming.
"""
import cv2
import numpy as np
import asyncio
import json
import base64
from typing import Optional, Dict, Any
from datetime import datetime
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import uvicorn
from detector import YOLOv8Detector
from tracker import CentroidTracker
from analyzer import AegisAnalyzer, AnalysisResult

app = FastAPI(title="AEGIS AI Vision API", version="2.5.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
detector = YOLOv8Detector(model_path="best.pt")
tracker = CentroidTracker()
analyzer = AegisAnalyzer()

# Stream state
stream_active = False
stream_url = "http://192.168.4.1:81/stream"
current_frame = None
current_result = None
frame_lock = asyncio.Lock()


class StreamConfig(BaseModel):
    url: str
    fps: int = 30


class DetectionResponse(BaseModel):
    timestamp: str
    frame_id: int
    detections: list
    alerts: list
    person_count: int
    vehicle_count: int


@app.get("/")
async def root():
    return {"status": "online", "service": "AEGIS AI Vision API", "version": "2.5.0"}


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "stream_active": stream_active,
        "detector_loaded": detector.model is not None,
    }


@app.post("/stream/start")
async def start_stream(config: StreamConfig):
    global stream_active, stream_url
    stream_url = config.url
    stream_active = True
    return {"status": "started", "url": stream_url}


@app.post("/stream/stop")
async def stop_stream():
    global stream_active
    stream_active = False
    return {"status": "stopped"}


@app.get("/stream/status")
async def stream_status():
    return {
        "active": stream_active,
        "url": stream_url,
        "fps": 30,
    }


def draw_annotations(frame: np.ndarray, result: AnalysisResult) -> np.ndarray:
    """Draw bounding boxes and alerts on frame."""
    annotated = frame.copy()

    # Draw filtered persons
    for person in result.filtered_persons:
        x1, y1, x2, y2 = person.bbox
        cv2.rectangle(annotated, (x1, y1), (x2, y2), (255, 0, 0), 2)
        cv2.putText(annotated, f"Person {person.confidence:.2f}",
                   (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 2)

    # Draw alerts
    y_offset = 30
    for alert in result.alerts:
        color = (0, 0, 255) if alert.severity == "critical" else (0, 165, 255)
        cv2.putText(annotated, f"⚠ {alert.type}: {alert.message}",
                   (10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
        y_offset += 25

    # Draw stats
    cv2.putText(annotated, f"Persons: {len(result.filtered_persons)}",
               (10, annotated.shape[0] - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

    return annotated


async def process_stream():
    """Main stream processing loop."""
    global current_frame, current_result, stream_active

    cap = None
    frame_id = 0

    while True:
        if not stream_active:
            await asyncio.sleep(0.1)
            continue

        try:
            if cap is None or not cap.isOpened():
                cap = cv2.VideoCapture(stream_url)
                if not cap.isOpened():
                    await asyncio.sleep(1)
                    continue

            ret, frame = cap.read()
            if not ret:
                await asyncio.sleep(0.01)
                continue

            frame_id += 1

            # Run detection
            detections = detector.detect(frame)

            # Update tracker
            tracked_objects = tracker.update(detections)

            # Run analysis
            result = analyzer.analyze_frame(frame, detections, tracked_objects)

            # Annotate frame
            annotated = draw_annotations(frame, result)

            async with frame_lock:
                current_frame = annotated
                current_result = result

            # Control frame rate
            await asyncio.sleep(1 / 30)

        except Exception as e:
            print(f"Stream error: {e}")
            await asyncio.sleep(1)


@app.on_event("startup")
async def startup():
    asyncio.create_task(process_stream())


@app.websocket("/ws/stream")
async def websocket_stream(websocket: WebSocket):
    """WebSocket endpoint for live video streaming."""
    await websocket.accept()
    try:
        while True:
            async with frame_lock:
                if current_frame is not None:
                    _, buffer = cv2.imencode('.jpg', current_frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
                    jpg_as_text = base64.b64encode(buffer).decode('utf-8')
                    await websocket.send_json({
                        "type": "frame",
                        "data": jpg_as_text,
                        "timestamp": datetime.now().isoformat(),
                    })
            await asyncio.sleep(1 / 30)
    except WebSocketDisconnect:
        pass


@app.websocket("/ws/alerts")
async def websocket_alerts(websocket: WebSocket):
    """WebSocket endpoint for real-time alerts."""
    await websocket.accept()
    try:
        while True:
            async with frame_lock:
                if current_result and current_result.alerts:
                    alerts_data = [{
                        "type": a.type,
                        "severity": a.severity,
                        "message": a.message,
                        "timestamp": a.timestamp,
                    } for a in current_result.alerts]
                    await websocket.send_json({
                        "type": "alerts",
                        "data": alerts_data,
                    })
            await asyncio.sleep(0.5)
    except WebSocketDisconnect:
        pass


@app.get("/api/detections")
async def get_detections():
    """Get current detections."""
    async with frame_lock:
        if current_result is None:
            return {"detections": [], "alerts": []}

        return {
            "timestamp": datetime.now().isoformat(),
            "persons": len(current_result.filtered_persons),
            "alerts": [{
                "type": a.type,
                "severity": a.severity,
                "message": a.message,
            } for a in current_result.alerts],
        }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
