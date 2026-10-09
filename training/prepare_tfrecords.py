#!/usr/bin/env python3
"""Convert Pascal-VOC annotated vehicle images into TFRecord files.

Expected input layout (standard VOC):
    dataset/
        images/            *.jpg / *.png
        annotations/       *.xml   (one per image)

Class names come from label_map.pbtxt, so the ids ALWAYS match what the app
expects (see src/utils/vehicleClassification.ts -> DEDICATED_CLASS_LABELS).

Usage:
    python prepare_tfrecords.py \
        --annotations_dir dataset/annotations \
        --image_dir dataset/images \
        --output_dir data \
        --label_map training/label_map.pbtxt

Requires: pip install tensorflow
"""

import argparse
import os
import random
import xml.etree.ElementTree as ET

import tensorflow as tf

LABEL_MAP_PATH_HINT = "training/label_map.pbtxt"


def load_label_map(path):
    """Parse the pbtxt into {class_name: id} and {id: class_name}."""
    id_to_name = {}
    name_to_id = {}
    current = {}
    with open(path, "r", encoding="utf-8") as fh:
        for raw in fh:
            line = raw.strip()
            if line.startswith("item"):
                current = {}
            elif line.startswith("id:"):
                current["id"] = int(line.split(":", 1)[1].strip())
            elif line.startswith("name:"):
                name = line.split(":", 1)[1].strip().strip("'").strip('"')
                current["name"] = name
            elif line == "}" and "id" in current and "name" in current:
                # pbtxt ids are 1-based; TFRecord uses 0-based ints.
                name_to_id[current["name"]] = current["id"] - 1
                id_to_name[current["id"] - 1] = current["name"]
                current = {}
    if not name_to_id:
        raise SystemExit("Could not parse label map: %s" % path)
    return name_to_id, id_to_name


def parse_voc(xml_path, name_to_id, wanted):
    """Return (width, height, boxes, is_cropped) for one annotation."""
    root = ET.parse(xml_path).getroot()
    size = root.find("size")
    width = int(size.find("width").text)
    height = int(size.find("height").text)

    boxes, classes = [], []
    for obj in root.findall("object"):
        name = (obj.find("name").text or "").strip().lower().replace(" ", "_")
        if name not in wanted:
            continue
        if name not in name_to_id:
            print("  ! skipping unknown class '%s' (add it to label_map.pbtxt)" % name)
            continue
        difficult_node = obj.find("difficult")
        difficult = difficult_node is not None and difficult_node.text == "1"
        bb = obj.find("bndbox")
        boxes.append(
            (
                float(bb.find("xmin").text),
                float(bb.find("ymin").text),
                float(bb.find("xmax").text),
                float(bb.find("ymax").text),
            )
        )
        classes.append(name_to_id[name])

    cropped = root.find("truncated")
    is_cropped = cropped is not None and cropped.text == "1"
    return width, height, boxes, classes, is_cropped


def convert(image_path, boxes, classes, is_cropped):
    with tf.io.TFRecord.open(image_path, "rb") as f:
        image_data = f.read()

    xmin, xmax, ymin, ymax = [], [], [], []
    for b in boxes:
        xmin.append(b[0])
        ymin.append(b[1])
        xmax.append(b[2])
        ymax.append(b[3])

    def _bytes_feature(value):
        return tf.train.Feature(bytes_list=tf.train.BytesList(value=[value]))

    def _float_list(value):
        return tf.train.Feature(float_list=tf.train.FloatList(value=value))

    def _int64_feature(value):
        return tf.train.Feature(int64_list=tf.train.Int64List(value=value))

    def _int64_list(value):
        return tf.train.Feature(int64_list=tf.train.Int64List(value=value))

    filename = os.path.basename(image_path).encode("utf-8")
    image_format = b"jpg" if filename.lower().endswith((".jpg", ".jpeg")) else b"png"

    example = tf.train.Example(
        features=tf.train.Features(
            feature={
                "image/encoded": _bytes_feature(image_data),
                "image/filename": _bytes_feature(filename),
                "image/format": _bytes_feature(image_format),
                "image/height": _int64_feature([0]),  # unused by SSD pipeline
                "image/width": _int64_feature([0]),
                "image/object/bbox/xmin": _float_list(xmin),
                "image/object/bbox/xmax": _float_list(xmax),
                "image/object/bbox/ymin": _float_list(ymin),
                "image/object/bbox/ymax": _float_list(ymax),
                "image/object/class/text": _bytes_feature([c.encode("utf-8") for c in classes]),
                "image/object/class/label": _int64_list(classes),
                "image/object/is_crowd": _int64_list([0] * len(classes)),
                "image/object/difficult": _int64_list([0] * len(classes)),
                "image/object/is_cropped": _int64_feature([1 if is_cropped else 0]),
            }
        )
    )
    return example.SerializeToString()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--annotations_dir", required=True)
    ap.add_argument("--image_dir", required=True)
    ap.add_argument("--output_dir", default="data")
    ap.add_argument("--label_map", default=LABEL_MAP_PATH_HINT)
    ap.add_argument("--val_percent", type=int, default=15)
    ap.add_argument("--test_percent", type=int, default=15)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    name_to_id, _ = load_label_map(args.label_map)
    wanted = set(name_to_id.keys())
    print("Classes: %s" % ", ".join(sorted(wanted)))

    os.makedirs(args.output_dir, exist_ok=True)

    pairs = []
    for xml_name in sorted(os.listdir(args.annotations_dir)):
        if not xml_name.lower().endswith(".xml"):
            continue
        stem = os.path.splitext(xml_name)[0]
        for ext in (".jpg", ".jpeg", ".png", ".JPG"):
            candidate = os.path.join(args.image_dir, stem + ext)
            if os.path.exists(candidate):
                pairs.append((candidate, os.path.join(args.annotations_dir, xml_name)))
                break
    if not pairs:
        raise SystemExit("No image/annotation pairs found.")

    random.Random(args.seed).shuffle(pairs)
    n = len(pairs)
    n_val = max(1, int(n * args.val_percent / 100.0))
    n_test = max(1, int(n * args.test_percent / 100.0))
    splits = {
        "train": pairs[: n - n_val - n_test],
        "val": pairs[n - n_val - n_test: n - n_test],
        "test": pairs[n - n_test:],
    }

    for split, items in splits.items():
        writer = tf.io.TFRecordWriter(os.path.join(args.output_dir, "%s.record" % split))
        kept = 0
        for image_path, xml_path in items:
            _, _, boxes, classes, cropped = parse_voc(xml_path, name_to_id, wanted)
            if not boxes:
                continue
            writer.write(convert(image_path, boxes, classes, cropped))
            kept += 1
        writer.close()
        print("%-5s -> %d examples (%s.record)" % (split, kept, split))

    # Copy the label map next to the records so the pipeline finds it.
    import shutil

    shutil.copyfile(args.label_map, os.path.join(args.output_dir, "label_map.pbtxt"))
    print("\nDone. Next: run train_and_export.py")


if __name__ == "__main__":
    main()
