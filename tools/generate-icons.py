"""Reproduce install icons from the supplied master without redrawing it."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
release = json.loads((ROOT / "release.json").read_text())
master_path = ROOT / release["iconMaster"]
master_hash = hashlib.sha256(master_path.read_bytes()).hexdigest()
master = Image.open(master_path).convert("RGB")
assert master.size == (1024, 1024)
destination = ROOT / release["iconDirectory"]
destination.mkdir(parents=True, exist_ok=True)
# Trim only the asymmetric outer mat; preserve the central supplied artwork.
crop = (0, 24, 960, 984)
fitted = master.crop(crop)

for size in (16, 32, 64, 152, 180, 192, 512):
    scaled = fitted.resize((size, size), Image.Resampling.LANCZOS)
    scaled.save(destination / f"icon-{size}.png", optimize=True)
    assert ImageChops.difference(Image.open(destination / f"icon-{size}.png"), scaled).getbbox() is None
    fallback = {64: "favicon.png", 180: "apple-touch-icon.png", 192: "icon-192.png", 512: "icon-512.png"}.get(size)
    if fallback:
        scaled.save(ROOT / fallback, optimize=True)

fitted.save(destination / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
(ROOT / "favicon.ico").write_bytes((destination / "favicon.ico").read_bytes())
# The meaningful central motif fits the safe circle; the outer frame is decorative.
maskable = Image.new("RGB", (512, 512), master.getpixel((470, 260)))
scaled = fitted.resize((360, 360), Image.Resampling.LANCZOS)
maskable.paste(scaled, (76, 76))
maskable.save(destination / "maskable-512.png", optimize=True)
preview_dir = ROOT / "qa" / "fdg16-install-icons"
preview_dir.mkdir(parents=True, exist_ok=True)
for name, source, radius in [("android-safe-circle", maskable, 204.8), ("android-circle", maskable, 256)]:
    mask = Image.new("L", (512, 512))
    ImageDraw.Draw(mask).ellipse((256-radius, 256-radius, 256+radius, 256+radius), fill=255)
    preview = Image.new("RGB", (512, 512), "#eeeeee")
    preview.paste(source, (0, 0), mask)
    preview.save(preview_dir / f"{name}.png")
preview = fitted.resize((512, 512), Image.Resampling.LANCZOS)
mask = Image.new("L", (512, 512))
ImageDraw.Draw(mask).rounded_rectangle((0, 0, 511, 511), radius=114, fill=255)
ios = Image.new("RGB", (512, 512), "#eeeeee")
ios.paste(preview, (0, 0), mask)
ios.save(preview_dir / "ios-rounded-preview.png")
assert hashlib.sha256(master_path.read_bytes()).hexdigest() == master_hash
(destination / "provenance.json").write_text(json.dumps({
    "master": release["iconMaster"], "sha256": master_hash,
    "resize": "Pillow LANCZOS, RGB; square outer-mat crop only; no redrawing or recoloring",
    "crop": crop,
    "maskable": "360px fitted artwork centered in 512px canvas; background sampled from master interior; decorative frame may be masked"
}, indent=2) + "\n")
print("ICON_GENERATION_PASS", master_hash)
