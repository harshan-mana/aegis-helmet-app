# Indian Vehicle Classification Model — Integration Guide

## Why this guide exists

The app currently uses **TensorFlow.js COCO-SSD** as its browser detector.
COCO-SSD outputs a fixed set of broad classes and **cannot** reliably
distinguish Indian road-vehicle subtypes:

| Real vehicle | What COCO-SSD reports |
| --- | --- |
| Scooter | `motorcycle` (cannot tell scooter from motorcycle) |
| Motorcycle | `motorcycle` |
| Auto-rickshaw / 3-wheeler | `car` or `truck` (not recognized as its own class) |
| Van | `car` or `truck` |
| E-rickshaw, handcart | not recognized |

The app therefore **does not** claim a scooter is a car, and does **not**
rename every motorcycle a scooter. It reports the honest COCO class.
To get true subtype accuracy you need a **dedicated, trained model**.
This guide describes how to produce one and plug it into the app
through the existing adapter in `src/utils/vehicleClassification.ts`.

---

## 1. Target classes

Choose a small, mutually-exclusive set the model can actually learn.
Recommended (aligns with the UI adapter):

```
car, motorcycle, scooter, bicycle, auto_rickshaw, bus, truck, van, e_rickshaw, person
```

Keep classes visually distinct. If scooter vs motorcycle is hard to
annotate consistently, merge them into one `two_wheeler` class rather
than labelling noise — a model cannot learn a distinction humans cannot
annotate reliably.

## 2. Dataset

- **Preferred open datasets (permissive licences):**
  - [Roboflow Universe](https://universe.roboflow.com/) — many CC-BY-4.0
    vehicle datasets (verify each dataset's licence before use).
  - [Open Images](https://storage.googleapis.com/openimages/web/index.html)
    (CC-BY 2.0) — has `Motorcycle`, `Car`, `Bus`, `Truck`, `Bicycle`,
    `Van` boxes you can re-map.
  - **User-provided images** you own — best for auto-rickshaw /
    e-rickshaw, which are under-represented in open sets.
- Aim for **≥ 500–1000 annotated images per class**, with variation in
  weather, lighting, angle, occlusion, and Indian road context.
- Split **70% train / 15% validation / 15% test**.

### Annotation format

Use **Pascal VOC XML** or **COCO JSON** (bounding boxes). Both convert
to TFRecord via the script below. Each object needs:
`image`, `class_label`, and `bbox = [xmin, ymin, xmax, ymax]`.

## 3. Training

Fine-tune a small detector so it runs in the browser. Recommended:
**SSD MobileNet V2 FPNLite** or **EfficientDet-Lite** (small, fast on
mobile).

Example (TensorFlow Object Detection API):

```bash
# 1. Convert annotations to TFRecord
python generate_tfrecord.py --annotations_dir=data/annotations \
  --label_map=data/label_map.pbtxt --output=data/train.record

# 2. Download a pre-trained checkpoint (TF2 detection model zoo)
#    e.g. ssd_mobilenet_v2_fpnlite_320x320_coco17_tpu-8

# 3. Configure pipeline.config:
#    - num_classes: 10
#    - fine_tune_checkpoint: <downloaded ckpt>
#    - label_map_path: data/label_map.pbtxt
#    - batch_size: 8 (raise if GPU allows)
#    - learning_rate, steps per your dataset size

# 4. Train
python model_main_tf2.py --pipeline_config_path=data/pipeline.config \
  --model_dir=data/output --alsologtostderr
```

`label_map.pbtxt` example:

```
item { id: 1 name: 'car' }
item { id: 2 name: 'motorcycle' }
item { id: 3 name: 'scooter' }
item { id: 4 name: 'bicycle' }
item { id: 5 name: 'auto_rickshaw' }
item { id: 6 name: 'bus' }
item { id: 7 name: 'truck' }
item { id: 8 name: 'van' }
item { id: 9 name: 'e_rickshaw' }
item { id: 10 name: 'person' }
```

## 4. Export for browser (TensorFlow.js)

```bash
# SavedModel -> TF.js GraphModel or LayersModel
tensorflowjs_converter \
  --input_format=tf_saved_model \
  --output_format=tfjs_graph_model \
  --signature_name=serving_default \
  data/output/saved_model \
  dist_indian_vehicle/model
```

This produces `model.json` + `group1-shard*of*` weight shards.

## 5. Place the model & load it in the app

1. Copy the exported folder into the app's static assets, e.g.
   `public/models/indian_vehicle/` (so it is served at
   `/models/indian_vehicle/model.json`).
2. In `src/utils/vehicleClassification.ts`, add a loader for the
   custom model (lazy-loaded, exactly like COCO-SSD is today):

   ```ts
   // Lazy-load the dedicated Indian vehicle classifier only when needed.
   export async function loadIndianVehicleModel() {
     const tf = await import('@tensorflow/tfjs');
     await tf.ready();
     const { loadGraphModel } = await import('@tensorflow/tfjs-converter');
     // Adjust the URL to wherever you placed model.json.
     return loadGraphModel('/models/indian_vehicle/model.json');
   }
   ```

3. In the detection loop (`DashboardView.tsx`), prefer the custom model
   when `modelReady` is true, and fall back to COCO-SSD if it fails to
   load. Map the custom model's output class ids to labels via
   `COCO_VEHICLE_LABELS` (extend that map with the new subtype names).

4. The verification pipeline (`src/utils/violationVerification.ts`)
   keeps working unchanged — it consumes `{ class, score }` pairs
   regardless of which model produced them.

## 6. Honest reporting

Until a custom model is trained, tested, and verified on real Indian
road examples, the app must continue to:

- report the COCO class + real confidence, and
- mark subtype-specific claims (scooter vs motorcycle, auto-rickshaw,
  van) as **unverified / requires a dedicated model**.

Do **not** ship a placeholder file claiming trained weights — an empty
or random-weight model produces false labels and false violations.
