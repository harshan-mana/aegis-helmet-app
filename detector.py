"""
YOLOv8 Detection Module
Handles model inference and raw detection extraction.
"""
import cv2
import numpy as np
from ultralytics import YOLO
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass


@dataclass
class Detection:
    """Single detection result."""
    bbox: Tuple[int, int, int, int]  # x1, y1, x2, y2
    confidence: float
    class_id: int
    class_name: str
    center: Tuple[float, float]  # centroid


class YOLOv8Detector:
    """YOLOv8 detector wrapper with custom model support."""

    def __init__(self, model_path: str = "best.pt", conf_threshold: float = 0.5):
        self.model = YOLO(model_path)
        self.conf_threshold = conf_threshold
        self.class_names = self.model.names

    def detect(self, frame: np.ndarray) -> List[Detection]:
        """
        Run YOLOv8 inference on a single frame.

        Args:
            frame: BGR image (H, W, 3)

        Returns:
            List of Detection objects
        """
        results = self.model(frame, verbose=False, conf=self.conf_threshold)
        detections = []

        for result in results:
            boxes = result.boxes
            for box in boxes:
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                conf = float(box.conf[0].cpu().numpy())
                cls_id = int(box.cls[0].cpu().numpy())
                cls_name = self.class_names[cls_id]

                # Calculate centroid
                cx = (x1 + x2) / 2.0
                cy = (y1 + y2) / 2.0

                detections.append(Detection(
                    bbox=(int(x1), int(y1), int(x2), int(y2)),
                    confidence=conf,
                    class_id=cls_id,
                    class_name=cls_name,
                    center=(cx, cy)
                ))

        return detections

    def get_class_color(self, class_name: str) -> Tuple[int, int, int]:
        """Get consistent color for each class (BGR format)."""
        color_map = {
            'motorcycle': (0, 255, 0),      # Green
            'person': (255, 0, 0),          # Blue
            'helmet': (0, 255, 255),        # Yellow
            'no-helmet': (0, 0, 255),       # Red
            'car': (255, 255, 0),           # Cyan
            'truck': (128, 0, 128),         # Purple
            'accident': (0, 0, 139),        # Dark Red
        }
        return color_map.get(class_name, (255, 255, 255))  # Default white
