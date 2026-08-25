#!/usr/bin/env python3
"""Recover images the user pasted into a Claude Code chat.

Pasted images aren't saved as files, but they are embedded (base64) in the
session transcript under ~/.claude/projects/<project-dir>/<session>.jsonl.
This extracts every image from *user* messages (skipping tool results, which
carry browser screenshots) and writes them to an output directory.

Usage:
  python3 scripts/pasted-images.py [output-dir] [transcript.jsonl]

Defaults: output-dir = ./pasted-images, transcript = newest .jsonl for this
project. Files are named pasted-01.webp, pasted-02.webp, ... in paste order.
Convert/rename afterwards, e.g.:
  sips -Z 1400 -s format jpeg -s formatOptions 82 pasted-01.webp --out photo.jpg
"""
import base64
import glob
import json
import os
import sys

PROJECT_DIR = os.path.expanduser(
    "~/.claude/projects/-Users-shotrox-Documents-webprojects-PROJECTS-toolcrate"
)

out_dir = sys.argv[1] if len(sys.argv) > 1 else "pasted-images"
if len(sys.argv) > 2:
    transcript = sys.argv[2]
else:
    candidates = sorted(
        glob.glob(os.path.join(PROJECT_DIR, "*.jsonl")),
        key=os.path.getmtime,
        reverse=True,
    )
    if not candidates:
        sys.exit(f"no transcripts found in {PROJECT_DIR}")
    transcript = candidates[0]

os.makedirs(out_dir, exist_ok=True)
count = 0
with open(transcript) as f:
    for line in f:
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            continue
        msg = rec.get("message") or {}
        if rec.get("type") != "user" or msg.get("role") != "user":
            continue
        content = msg.get("content")
        if not isinstance(content, list):
            continue
        if any(b.get("type") == "tool_result" for b in content if isinstance(b, dict)):
            continue
        for block in content:
            if isinstance(block, dict) and block.get("type") == "image":
                src = block.get("source", {})
                if src.get("type") != "base64":
                    continue
                count += 1
                ext = src.get("media_type", "image/webp").split("/")[-1]
                ext = {"jpeg": "jpg"}.get(ext, ext)
                name = os.path.join(out_dir, f"pasted-{count:02d}.{ext}")
                with open(name, "wb") as o:
                    o.write(base64.b64decode(src["data"]))
                print(name)

print(f"{count} image(s) from {os.path.basename(transcript)}")
