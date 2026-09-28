export interface AnalysisResult {
  vehicleNumber: string;
  violationType: 'NONE' | 'OVER_SPEEDING' | 'TRIPLE_RIDING' | 'FAKE_PLATE' | 'ACCIDENT' | 'NO_HELMET' | 'MANUAL_REPORT';
  confidence: number;
  description: string;
  penaltyAmount?: number;
  estimatedSpeedKmH?: number;
}

export interface YOLODetection {
  label: string;
  confidence: number;
  bbox: [number, number, number, number];
}

export interface YOLOv8Result {
  detections: YOLODetection[];
  inferenceTime: number;
  model: string;
}

// YOLOv8 object detection via server API
export async function detectObjectsYOLOv8(imageBase64: string): Promise<YOLOv8Result> {
  try {
    const response = await fetch('/api/detect-yolov8', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageBase64 }),
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const data = await response.json();
    return {
      detections: data.detections || [],
      inferenceTime: data.inferenceTime || 0,
      model: data.model || 'YOLOv8n',
    };
  } catch (error: any) {
    console.error('YOLOv8 detection failed:', error);
    return {
      detections: [],
      inferenceTime: 0,
      model: 'YOLOv8n (unavailable)',
    };
  }
}

// Gemini vision analysis (existing)
export async function analyzeHelmetFeed(imageBase64: string): Promise<AnalysisResult> {
  try {
    const response = await fetch('/api/analyze-helmet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageBase64 }),
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const data = await response.json();
    return {
      vehicleNumber: data.vehicleNumber || 'Unknown',
      violationType: data.violationType || 'NONE',
      confidence: typeof data.confidence === 'number' ? data.confidence : 0.85,
      description: data.description || 'Vision analysis completed.',
      penaltyAmount: data.penaltyAmount || 0,
      estimatedSpeedKmH: data.estimatedSpeedKmH || 45,
    };
  } catch (error: any) {
    console.error('Gemini vision analysis failed:', error);
    return {
      vehicleNumber: 'Unknown',
      violationType: 'NONE',
      confidence: 0,
      description: 'Network or AI engine error: ' + (error?.message || 'Check connection'),
      penaltyAmount: 0,
    };
  }
}

// Combined detection: YOLOv8 + Gemini
export async function combinedDetection(imageBase64: string): Promise<{
  yolov8: YOLOv8Result;
  gemini: AnalysisResult;
}> {
  const [yolov8, gemini] = await Promise.all([
    detectObjectsYOLOv8(imageBase64),
    analyzeHelmetFeed(imageBase64),
  ]);

  return { yolov8, gemini };
}