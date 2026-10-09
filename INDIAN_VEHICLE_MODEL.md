# Indian Vehicle Classification — Integration Guide

## Why this guide exists

The browser detector ships as **TensorFlow.js COCO-SSD**, which outputs a
fixed set of broad classes and **cannot** distinguish Indian road subtypes:

| Real vehicle | What COCO-SSD reports |
| --- | --- |
| Scooter | `motorcycle` (cannot tell scooter from motorcycle) |
| Motorcycle | `motorcycle` |
| Auto-rickshaw / 3-wheeler | `car` or `truck` |
| Van | `car` or `truck` |
| E-rickshaw, handcart | not recognized |

## How the app now handles this

The app runs a **two-stage pipeline** (see `src/utils/vehicleClassification.ts`):

1. **Stage 1 — COCO-SSD** (always available) finds vehicle regions.
2. **Stage 2 — a dedicated trained model** classifies each region into a true
   Indian-vehicle subclass when its weights are deployed at
   `models/indian_vehicle/model.json`.

Consequences:

- **Weights present** → real subclass (`Scooter`, `Auto-rickshaw`, `Van`, …),
  drawn with a **green** box and a **"Verified"** badge.
- **Weights absent** → the app stays on COCO-SSD and shows the broad class
  with an **orange** box and a **"Heuristic"** badge, plus a `~` marker on
  the canvas. Nothing is faked and nothing breaks.

The app deliberately does **not** rename every motorcycle a scooter, does not
label an unknown object as a car, and ships **no placeholder weights**.

## Producing the trained model

The full pipeline lives in [`training/`](./training/README.md):

| File | Purpose |
| --- | --- |
| `training/label_map.pbtxt` | The 10 class ids (must match `DEDICATED_CLASS_LABELS`). |
| `training/pipeline.config` | SSD MobileNet V2 FPNLite 320×320 fine-tuning config. |
| `training/prepare_tfrecords.py` | Pascal-VOC XML → TFRecord (70/15/15 split). |
| `training/train_and_export.py` | Train → TF.js export → writes to `public/models/indian_vehicle/`. |

Quick start:

```bash
pip install tensorflow tensorflowjs
git clone https://github.com/tensorflow/models.git

python training/prepare_tfrecords.py \
  --annotations_dir dataset/annotations \
  --image_dir dataset/images \
  --output_dir data \
  --label_map training/label_map.pbtxt

python training/train_and_export.py \
  --pipeline_config training/pipeline.config \
  --model_dir runs/indian_vehicle \
  --output_dir public/models/indian_vehicle \
  --train_script ../models/research/object_detection/model_main_tf2.py
```

## Target classes

```
car, motorcycle, scooter, bicycle, auto_rickshaw,
e_rickshaw, bus, truck, van, person
```

If scooter vs motorcycle cannot be annotated consistently by humans, **merge
them into one `two_wheeler` class** rather than training on noisy labels.

## Dataset

- **Preferred open sources (verify each licence):**
  - [Roboflow Universe](https://universe.roboflow.com/) — many CC-BY-4.0 vehicle datasets.
  - [Open Images](https://storage.googleapis.com/openimages/web/index.html) (CC-BY 2.0).
  - **Your own Indian road footage** — best for auto-rickshaw / e-rickshaw.
- ≥500–1000 annotated images per class, varied by weather, lighting, angle,
  and occlusion.
- Hold out a test split and check **per-class** precision/recall — especially
  scooter vs motorcycle — before trusting the model.

## Annotation format

Pascal VOC XML or COCO JSON (bounding boxes). `prepare_tfrecords.py` consumes
Pascal VOC:

```xml
<annotation>
  <size><width>640</width><height>480</height></size>
  <object>
    <name>scooter</name>
    <bndbox>
      <xmin>120</xmin><ymin>200</ymin>
      <xmax>260</xmax><ymax>430</ymax>
    </bndbox>
  </object>
</annotation>
```

## Deployment

`train_and_export.py` exports with:

```bash
tensorflowjs_converter \
  --input_format=tf_saved_model \
  --output_format=tfjs_graph_model \
  --signature_name=serving_default \
  runs/indian_vehicle/saved_model \
  public/models/indian_vehicle
```

The runtime (`loadDedicatedModel`) then probes `model.json` with a cheap
`HEAD` request, lazily imports TensorFlow.js, loads the graph model, runs it
on a square crop of each detected region, and maps class ids through
`DEDICATED_CLASS_LABELS`. If the probe 404s or loading throws, it returns
`null` and COCO-SSD continues to run.

## Honesty rules

- Never commit a placeholder or random-weight `model.json` — an untrained
  model produces false labels and therefore false violations.
- Keep the fallback path intact so a missing/failed model never breaks the app.
- Keep the export under ~25 MB for mobile data.
- Until a model is trained and verified on real examples, the app must keep
  reporting broad classes as **unverified**.
