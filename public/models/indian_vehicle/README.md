# Indian vehicle model (generated weights land here)

This directory is where `training/train_and_export.py` writes the trained
model (`model.json` + weight shards).

The app (`src/utils/vehicleClassification.ts`) probes
`models/indian_vehicle/model.json` at runtime:

- **Found** → the dedicated classifier is used, and subclasses such as
  scooter, motorcycle, auto-rickshaw, e-rickshaw and van are reported as
  **verified**.
- **Not found** → the app stays on COCO-SSD and reports the broad class,
  clearly marked as unverified. Nothing breaks.

**Do not commit placeholder or random-weight files.** An untrained model
produces false labels and therefore false violations.
