# Indian-vehicle model — training pipeline

This directory produces the **dedicated classifier** that lets AEGIS separate
scooter vs motorcycle, auto-rickshaw, e-rickshaw and van — the distinctions
COCO-SSD cannot make.

The app contains **no weights**. Until this pipeline is run and the output is
deployed, the app runs on COCO-SSD and honestly reports the broad class.

## Files

| File | Purpose |
| --- | --- |
| `label_map.pbtxt` | The 10 class ids. **Must** match `DEDICATED_CLASS_LABELS` in `src/utils/vehicleClassification.ts`. |
| `pipeline.config` | SSD MobileNet V2 FPNLite 320×320 fine-tuning config. |
| `prepare_tfrecords.py` | Pascal-VOC XML → TFRecord, 70/15/15 train/val/test split. |
| `train_and_export.py` | Trains, exports to TensorFlow.js, copies to `public/models/indian_vehicle/`. |

## 1. Dataset layout

```
dataset/
  images/       *.jpg
  annotations/  *.xml     (Pascal VOC, one per image)
```

Class `name` values must use exactly: `car`, `motorcycle`, `scooter`,
`bicycle`, `auto_rickshaw`, `e_rickshaw`, `bus`, `truck`, `van`, `person`.

Aim for ≥500–1000 images per class, varied in lighting/weather/angle, with
auto-rickshaw and e-rickshaw shots from real Indian roads (they are the
classes open datasets miss). Suggested sources, **verify each licence**:
Roboflow Universe (many CC-BY-4.0 vehicle sets) and Open Images (CC-BY 2.0,
`Car`/`Motorcycle`/`Bus`/`Truck`/`Bicycle`/`Van` boxes you can re-map).

## 2. Install

```bash
pip install tensorflow tensorflowjs
git clone https://github.com/tensorflow/models.git   # for model_main_tf2.py
```

## 3. Convert dataset

```bash
python training/prepare_tfrecords.py \
  --annotations_dir dataset/annotations \
  --image_dir dataset/images \
  --output_dir data \
  --label_map training/label_map.pbtxt
```

Produces `data/train.record`, `data/val.record`, `data/test.record`.

## 4. Download the pre-trained checkpoint

SSD MobileNet V2 FPNLite 320×320 COCO17, then set `fine_tune_checkpoint` in
`pipeline.config` to the downloaded `model.ckpt` path.

## 5. Train + export

```bash
python training/train_and_export.py \
  --pipeline_config training/pipeline.config \
  --model_dir runs/indian_vehicle \
  --output_dir public/models/indian_vehicle \
  --train_script ../models/research/object_detection/model_main_tf2.py
```

This writes `model.json` + weight shards into `public/models/indian_vehicle/`.

## 6. Verify (do this before trusting it)

Hold out `data/test.record` and measure **per-class** precision/recall —
especially scooter vs motorcycle. If those two are not clearly separable,
merge them into one `two_wheeler` class rather than shipping noisy labels.

Then confirm in the app: a green box + "Verified" badge means the trained
model decided the subclass; orange + "Heuristic" means broad class only.

## 7. Honesty rules

- Never commit a placeholder/random-weight `model.json` — it produces false
  labels and false violations.
- Keep the runtime fallback: if weights are missing or fail to load, the app
  keeps working on COCO-SSD rather than erroring.
- Keep model size reasonable (<25 MB) for mobile data.
