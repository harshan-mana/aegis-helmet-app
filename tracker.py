"""
ByteTrack Integration Module
Provides persistent object tracking with centroid history.
"""
import numpy as np
from collections import defaultdict, deque
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, field


@dataclass
class TrackedObject:
    """Persistent tracked object with trajectory history."""
    track_id: int
    class_name: str
    centroid_history: deque = field(default_factory=lambda: deque(maxlen=30))
    bbox_history: deque = field(default_factory=lambda: deque(maxlen=30))
    last_seen: int = 0
    velocity: Tuple[float, float] = (0.0, 0.0)
    angle_history: deque = field(default_factory=lambda: deque(maxlen=30))


class CentroidTracker:
    """
    Simple centroid-based tracker with persistent IDs.
    Uses IoU matching for robust tracking across frames.
    """

    def __init__(self, max_disappeared: int = 10, iou_threshold: float = 0.3):
        self.next_id = 0
        self.objects: Dict[int, TrackedObject] = {}
        self.max_disappeared = max_disappeared
        self.iou_threshold = iou_threshold
        self.frame_count = 0

    def _calculate_iou(self, bbox1: Tuple[int, int, int, int],
                       bbox2: Tuple[int, int, int, int]) -> float:
        """Calculate Intersection over Union between two bounding boxes."""
        x1 = max(bbox1[0], bbox2[0])
        y1 = max(bbox1[1], bbox2[1])
        x2 = min(bbox1[2], bbox2[2])
        y2 = min(bbox1[3], bbox2[3])

        intersection = max(0, x2 - x1) * max(0, y2 - y1)
        area1 = (bbox1[2] - bbox1[0]) * (bbox1[3] - bbox1[1])
        area2 = (bbox2[2] - bbox2[0]) * (bbox2[3] - bbox2[1])
        union = area1 + area2 - intersection

        return intersection / union if union > 0 else 0.0

    def _calculate_centroid(self, bbox: Tuple[int, int, int, int]) -> Tuple[float, float]:
        """Calculate centroid of a bounding box."""
        return ((bbox[0] + bbox[2]) / 2.0, (bbox[1] + bbox[3]) / 2.0)

    def update(self, detections: List) -> Dict[int, TrackedObject]:
        """
        Update tracker with new detections.

        Args:
            detections: List of Detection objects

        Returns:
            Dictionary of tracked objects by ID
        """
        self.frame_count += 1

        # Extract centroids and bboxes from detections
        input_centroids = []
        input_bboxes = []
        input_classes = []

        for det in detections:
            centroid = self._calculate_centroid(det.bbox)
            input_centroids.append(centroid)
            input_bboxes.append(det.bbox)
            input_classes.append(det.class_name)

        # If no existing objects, register all detections
        if len(self.objects) == 0:
            for i, (centroid, bbox, cls) in enumerate(zip(input_centroids, input_bboxes, input_classes)):
                self._register(centroid, bbox, cls)
        else:
            # Match existing objects to new detections using IoU
            object_ids = list(self.objects.keys())
            object_bboxes = [self.objects[oid].bbox_history[-1] if self.objects[oid].bbox_history
                           else (0, 0, 0, 0) for oid in object_ids]

            # Calculate IoU matrix
            iou_matrix = np.zeros((len(object_bboxes), len(input_bboxes)))
            for i, obj_bbox in enumerate(object_bboxes):
                for j, inp_bbox in enumerate(input_bboxes):
                    iou_matrix[i, j] = self._calculate_iou(obj_bbox, inp_bbox)

            # Greedy matching
            matched_objects = set()
            matched_detections = set()

            # Sort by IoU descending
            flat_indices = np.argsort(iou_matrix.flatten())[::-1]
            for flat_idx in flat_indices:
                i = flat_idx // len(input_bboxes)
                j = flat_idx % len(input_bboxes)

                if i in matched_objects or j in matched_detections:
                    continue
                if iou_matrix[i, j] < self.iou_threshold:
                    break

                object_id = object_ids[i]
                self.objects[object_id].centroid_history.append(input_centroids[j])
                self.objects[object_id].bbox_history.append(input_bboxes[j])
                self.objects[object_id].last_seen = self.frame_count

                # Calculate velocity
                if len(self.objects[object_id].centroid_history) >= 2:
                    prev = self.objects[object_id].centroid_history[-2]
                    curr = self.objects[object_id].centroid_history[-1]
                    self.objects[object_id].velocity = (curr[0] - prev[0], curr[1] - prev[1])

                # Calculate angle
                if len(self.objects[object_id].centroid_history) >= 2:
                    prev = self.objects[object_id].centroid_history[-2]
                    curr = self.objects[object_id].centroid_history[-1]
                    dx = curr[0] - prev[0]
                    dy = curr[1] - prev[1]
                    angle = np.arctan2(dy, dx) * 180 / np.pi
                    self.objects[object_id].angle_history.append(angle)

                matched_objects.add(i)
                matched_detections.add(j)

            # Register unmatched detections
            for j in range(len(input_bboxes)):
                if j not in matched_detections:
                    self._register(input_centroids[j], input_bboxes[j], input_classes[j])

            # Deregister stale objects
            stale_ids = [oid for oid in object_ids
                        if self.frame_count - self.objects[oid].last_seen > self.max_disappeared]
            for oid in stale_ids:
                del self.objects[oid]

        return self.objects

    def _register(self, centroid: Tuple[float, float], bbox: Tuple[int, int, int, int], class_name: str):
        """Register a new tracked object."""
        self.objects[self.next_id] = TrackedObject(
            track_id=self.next_id,
            class_name=class_name,
            centroid_history=deque([centroid], maxlen=30),
            bbox_history=deque([bbox], maxlen=30),
            last_seen=self.frame_count,
            angle_history=deque(maxlen=30)
        )
        self.next_id += 1

    def reset(self):
        """Reset tracker state."""
        self.next_id = 0
        self.objects = {}
        self.frame_count = 0
