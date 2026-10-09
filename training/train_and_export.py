#!/usr/bin/env python3
"""Train the Indian-vehicle detector and export it for browser inference.

Steps:
  1. (Optionally) fine-tune from the SSD MobileNet V2 FPNLite COCO checkpoint.
  2. Export the SavedModel to a TensorFlow.js graph model.
  3. Copy model.json + weight shards into public/models/indian_vehicle/ so the
     app picks them up automatically at runtime.

The app does NOT ship weights. Until this script has been run and the files
exist, the app stays on COCO-SSD and labels remain honestly broad.

Usage:
    # 0) install deps
    pip install tensorflow tensorflowjs

    # 1) convert dataset -> TFRecords (see prepare_tfrecords.py)

    # 2) train + export
    python training/train_and_export.py \
        --pipeline_config training/pipeline.config \
        --model_dir runs/indian_vehicle \
        --output_dir ../public/models/indian_vehicle \
        --num_steps 200000

    # Optional: skip training and only export an existing SavedModel
    python training/train_and_export.py \
        --pipeline_config training/pipeline.config \
        --model_dir runs/indian_vehicle \
        --output_dir ../public/models/indian_vehicle \
        --export_only
"""

import argparse
import os
import re
import shutil
import subprocess
import sys


def run(cmd, cwd=None):
    print("\n$ %s" % " ".join(cmd))
    subprocess.check_call(cmd, cwd=cwd)


def patch_num_classes(config_path, num_classes):
    """Ensure pipeline.config's num_classes matches the label map."""
    with open(config_path, "r", encoding="utf-8") as fh:
        text = fh.read()
    patched, n = re.subn(r"num_classes:\s*\d+", "num_classes: %d" % num_classes, text, count=1)
    if n == 0:
        raise SystemExit("Could not find num_classes in %s" % config_path)
    with open(config_path, "w", encoding="utf-8") as fh:
        fh.write(patched)
    print("Set num_classes = %d in %s" % (num_classes, config_path))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pipeline_config", default="training/pipeline.config")
    ap.add_argument("--label_map", default="training/label_map.pbtxt")
    ap.add_argument("--model_dir", default="runs/indian_vehicle")
    ap.add_argument("--output_dir", default="public/models/indian_vehicle")
    ap.add_argument("--num_steps", type=int, default=200000)
    ap.add_argument("--num_classes", type=int, default=10)
    ap.add_argument("--export_only", action="store_true")
    ap.add_argument("--train_script", default=None,
                    help="Path to model_main_tf2.py from the TF Object Detection API repo.")
    args = ap.parse_args()

    patch_num_classes(args.pipeline_config, args.num_classes)

    saved_model_dir = os.path.join(args.model_dir, "saved_model")

    # ---- 1. Train -----------------------------------------------------------
    if not args.export_only:
        if not args.train_script:
            raise SystemExit(
                "Provide --train_script (path to model_main_tf2.py) or use --export_only.\n"
                "Get the Object Detection API from:\n"
                "  git clone https://github.com/tensorflow/models.git"
            )
        run([
            sys.executable, args.train_script,
            "--pipeline_config_path", args.pipeline_config,
            "--model_dir", args.model_dir,
            "--num_train_steps", str(args.num_steps),
            "--alsologtostderr",
        ])

    if not os.path.isdir(saved_model_dir):
        raise SystemExit("SavedModel not found at %s (train first or fix --model_dir)." % saved_model_dir)

    # ---- 2. Export to TensorFlow.js ---------------------------------------
    print("\nExporting SavedModel -> TensorFlow.js graph model ...")
    run([
        "tensorflowjs_converter",
        "--input_format=tf_saved_model",
        "--output_format=tfjs_graph_model",
        "--signature_name=serving_default",
        "--saved_model_tags=serve",
        saved_model_dir,
        args.output_dir,
    ])

    model_json = os.path.join(args.output_dir, "model.json")
    if not os.path.exists(model_json):
        raise SystemExit("Export finished but model.json is missing in %s" % args.output_dir)

    shards = [f for f in os.listdir(args.output_dir) if f.endswith(".bin")]
    total = sum(
        os.path.getsize(os.path.join(args.output_dir, f)) for f in os.listdir(args.output_dir)
    )
    print("\nExported model.json + %d weight shard(s), total %.1f MB"
          % (len(shards), total / (1024.0 * 1024.0)))

    # ---- 3. Report ---------------------------------------------------------
    readme = os.path.join(args.output_dir, "README.md")
    if not os.path.exists(readme):
        with open(readme, "w", encoding="utf-8") as fh:
            fh.write(
                "# Indian vehicle model (generated)\n\n"
                "These files are produced by `training/train_and_export.py`.\n"
                "The app loads `model.json` automatically at runtime and switches\n"
                "from COCO-SSD to this dedicated classifier.\n"
            )

    if total > 25 * 1024 * 1024:
        print("\nWARNING: model is %.1f MB — large for mobile data. Consider a "
              "smaller input size or an int8-quantised export." % (total / (1024.0 * 1024.0)))

    print("\nDone. Deploy so that %s/model.json is reachable, then hard-refresh the app."
          % args.output_dir)
    print("Until then the app keeps using COCO-SSD with broad, unverified labels.")


if __name__ == "__main__":
    main()
