"""
Business Logic Analyzer Module
Implements helmet detection, triple riding, rash driving, and accident detection.
"""
import numpy as np
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass, field
from collections import defaultdict
import time


@dataclass
class Alert:
    """Alert event."""
    type: str
    severity: str  # 'low', 'medium', 'high', 'critical'
    message: str
    timestamp: float
    track_id: Optional[int] = None
    bbox: Optional[Tuple[int, int, int, int]] = None


@dataclass
class AnalysisResult:
    """Complete analysis result for a frame."""
    alerts: List[Alert] = field(default_factory=list)
    filtered_persons: List = field(default_factory=list)
    helmet_violations: List = field(default_factory=list)
    triple_riding: List = field(default_factory=list)
    rash_driving: List = field(default_factory=list)
    accidents: List = field(default_factory=list)
    annotated_frame: Optional[np.ndarray] = None


class AegisAnalyzer:
    """
    Main analyzer implementing all business logic:
    - Pedestrian filtering
    - Helmet & triple riding detection
    - Rash driving detection (velocity + swerving)
    - High-precision accident detection
    """

    def __init__(self):
        # Configuration
        self.speed_threshold = 150  # pixels/frame for rash driving
        self.swerve_threshold = 45  # degrees change in trajectory angle
        self.accident_iou_threshold = 0.7
        self.accident_deceleration_threshold = 100  # velocity drop

        # Tracking state
        self.track_history = defaultdict(lambda: {
            'velocities': [],
            'angles': [],
            'attached_persons': [],
            'last_bbox': None,
            'last_seen': 0
        })

        # Alert cooldown to prevent spam
        self.alert_cooldown = {}
        self.cooldown_seconds = 2.0

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

    def _calculate_overlap_ratio(self, bbox1: Tuple[int, int, int, int],
                                  bbox2: Tuple[int, int, int, int]) -> float:
        """Calculate overlap ratio (intersection / smaller area)."""
        x1 = max(bbox1[0], bbox2[0])
        y1 = max(bbox1[1], bbox2[1])
        x2 = min(bbox1[2], bbox2[2])
        y2 = min(bbox1[3], bbox2[3])

        intersection = max(0, x2 - x1) * max(0, y2 - y1)
        area1 = (bbox1[2] - bbox1[0]) * (bbox1[3] - bbox1[1])
        area2 = (bbox2[2] - bbox2[0]) * (bbox2[3] - bbox2[1])
        smaller_area = min(area1, area2)

        return intersection / smaller_area if smaller_area > 0 else 0.0

    def _is_on_vehicle(self, person_bbox: Tuple[int, int, int, int],
                       vehicle_bbox: Tuple[int, int, int, int]) -> bool:
        """Check if a person is on/overlapping with a vehicle."""
        overlap = self._calculate_overlap_ratio(person_bbox, vehicle_bbox)
        return overlap > 0.15  # 15% overlap threshold

    def _filter_pedestrians(self, persons: List, vehicles: List) -> List:
        """
        Filter out pedestrians who are not on any vehicle.
        Only keep persons that overlap with motorcycles, cars, or trucks.
        """
        vehicle_classes = {'motorcycle', 'car', 'truck'}
        vehicle_detections = [v for v in vehicles if v.class_name in vehicle_classes]

        filtered = []
        for person in persons:
            for vehicle in vehicle_detections:
                if self._is_on_vehicle(person.bbox, vehicle.bbox):
                    filtered.append(person)
                    break

        return filtered

    def _check_helmet_violation(self, person, frame_height: int) -> Optional[Alert]:
        """
        Check if a person on a motorcycle is not wearing a helmet.
        Looks for 'no-helmet' class or absence of 'helmet' in head area.
        """
        # This is called when we have a person on a motorcycle
        # The helmet/no-helmet detection is done at the YOLO level
        # Here we just check if the person has a helmet

        # For now, we'll rely on the YOLO detection of 'no-helmet' class
        # If a 'no-helmet' detection exists for this person, it's a violation
        return None

    def _check_triple_riding(self, motorcycle, persons: List) -> Optional[Alert]:
        """
        Check if a motorcycle has 3 or more riders.
        """
        rider_count = 0
        for person in persons:
            if self._is_on_vehicle(person.bbox, motorcycle.bbox):
                rider_count += 1

        if rider_count >= 3:
            return Alert(
                type='TRIPLE_RIDING',
                severity='high',
                message=f'Triple Riding Detected - {rider_count} persons on motorcycle',
                timestamp=time.time(),
                track_id=None,
                bbox=motorcycle.bbox
            )
        return None

    def _check_rash_driving(self, track_id: int, tracked_objects: Dict) -> Optional[Alert]:
        """
        Detect rash driving using velocity and trajectory analysis.
        """
        if track_id not in tracked_objects:
            return None

        obj = tracked_objects[track_id]
        if len(obj.centroid_history) < 5:
            return None

        # Calculate velocity
        recent_centroids = list(obj.centroid_history)[-10:]
        if len(recent_centroids) < 2:
            return None

        # Calculate pixel distance between consecutive frames
        distances = []
        for i in range(1, len(recent_centroids)):
            dx = recent_centroids[i][0] - recent_centroids[i-1][0]
            dy = recent_centroids[i][1] - recent_centroids[i-1][1]
            dist = np.sqrt(dx*dx + dy*dy)
            distances.append(dist)

        avg_velocity = np.mean(distances) if distances else 0

        # Check for high speed
        if avg_velocity > self.speed_threshold:
            return Alert(
                type='RASH_DRIVING',
                severity='high',
                message=f'Rash Driving Detected - Speed: {avg_velocity:.1f} px/frame',
                timestamp=time.time(),
                track_id=track_id,
                bbox=obj.bbox_history[-1] if obj.bbox_history else None
            )

        # Check for swerving (rapid angle changes)
        if len(obj.angle_history) >= 5:
            recent_angles = list(obj.angle_history)[-10:]
            angle_changes = []
            for i in range(1, len(recent_angles)):
                change = abs(recent_angles[i] - recent_angles[i-1])
                if change > 180:
                    change = 360 - change
                angle_changes.append(change)

            if angle_changes and np.mean(angle_changes) > self.swerve_threshold:
                return Alert(
                    type='RASH_DRIVING',
                    severity='high',
                    message=f'Rash Driving Detected - Swerving: {np.mean(angle_changes):.1f}°/frame',
                    timestamp=time.time(),
                    track_id=track_id,
                    bbox=obj.bbox_history[-1] if obj.bbox_history else None
                )

        return None

    def _check_accident(self, detections: List, tracked_objects: Dict) -> List[Alert]:
        """
        High-precision accident detection using multiple signals.
        """
        alerts = []

        # Check for explicit accident class
        for det in detections:
            if det.class_name == 'accident':
                alerts.append(Alert(
                    type='ACCIDENT',
                    severity='critical',
                    message='Accident Detected - Visual Confirmation',
                    timestamp=time.time(),
                    bbox=det.bbox
                ))

        # Check for car-bike collision
        motorcycles = [d for d in detections if d.class_name == 'motorcycle']
        cars = [d for d in detections if d.class_name in ('car', 'truck')]

        for motorcycle in motorcycles:
            for car in cars:
                iou = self._calculate_iou(motorcycle.bbox, car.bbox)
                if iou > self.accident_iou_threshold:
                    alerts.append(Alert(
                        type='ACCIDENT',
                        severity='critical',
                        message=f'Collision Detected - IoU: {iou:.2f}',
                        timestamp=time.time(),
                        bbox=motorcycle.bbox
                    ))

        # Check for passenger falling (person detached from motorcycle)
        for track_id, obj in tracked_objects.items():
            if obj.class_name == 'motorcycle' and len(obj.bbox_history) > 10:
                # Check if velocity dropped suddenly
                if len(obj.centroid_history) >= 10:
                    recent = list(obj.centroid_history)[-10:]
                    velocities = []
                    for i in range(1, len(recent)):
                        dx = recent[i][0] - recent[i-1][0]
                        dy = recent[i][1] - recent[i-1][1]
                        velocities.append(np.sqrt(dx*dx + dy*dy))

                    if len(velocities) >= 5:
                        avg_vel = np.mean(velocities[:-5])
                        recent_vel = np.mean(velocities[-5:])
                        if avg_vel > 50 and recent_vel < 5:
                            alerts.append(Alert(
                                type='ACCIDENT',
                                severity='critical',
                                message='Sudden Stop Detected - Possible Accident',
                                timestamp=time.time(),
                                track_id=track_id,
                                bbox=obj.bbox_history[-1]
                            ))

        return alerts

    def analyze_frame(self, frame: np.ndarray, detections: List,
                     tracked_objects: Dict) -> AnalysisResult:
        """
        Main analysis pipeline for a single frame.
        """
        result = AnalysisResult()

        # 1. Filter pedestrians
        persons = [d for d in detections if d.class_name == 'person']
        vehicles = [d for d in detections if d.class_name in ('motorcycle', 'car', 'truck')]
        filtered_persons = self._filter_pedestrians(persons, vehicles)
        result.filtered_persons = filtered_persons

        # 2. Check helmet violations
        no_helmets = [d for d in detections if d.class_name == 'no-helmet']
        for nh in no_helmets:
            result.helmet_violations.append(Alert(
                type='NO_HELMET',
                severity='medium',
                message='Helmet Violation Detected',
                timestamp=time.time(),
                bbox=nh.bbox
            ))

        # 3. Check triple riding
        motorcycles = [d for d in detections if d.class_name == 'motorcycle']
        for motorcycle in motorcycles:
            alert = self._check_triple_riding(motorcycle, filtered_persons)
            if alert:
                result.triple_riding.append(alert)

        # 4. Check rash driving
        for track_id in tracked_objects:
            alert = self._check_rash_driving(track_id, tracked_objects)
            if alert:
                result.rash_driving.append(alert)

        # 5. Check accidents
        result.accidents = self._check_accident(detections, tracked_objects)

        # 6. Combine all alerts
        result.alerts = (
            result.helmet_violations +
            result.triple_riding +
            result.rash_driving +
            result.accidents
        )

        return result
