# Assembles frames from demo-capture.mjs into docs/demo.gif and README stills (docs/*.jpg).
# usage: python scripts/make-gif.py <framesDir>
import glob, os, re, sys
from PIL import Image

src = sys.argv[1] if len(sys.argv) > 1 else "docs/frames"
files = sorted(glob.glob(os.path.join(src, "*.png")))
frames, durations = [], []
for f in files:
    hold = int(re.search(r"-h(\d+)\.png$", f).group(1))
    im = Image.open(f).convert("RGB")
    im = im.resize((375, int(im.height * 375 / im.width)), Image.LANCZOS)
    frames.append(im.convert("P", palette=Image.ADAPTIVE, colors=96))
    durations.append(hold * 100)
frames[0].save("docs/demo.gif", save_all=True, append_images=frames[1:], duration=durations, loop=0, optimize=True)
print("docs/demo.gif", os.path.getsize("docs/demo.gif") // 1024, "KB,", len(frames), "frames")

stills = {"home-live": "home", "home-sim": "home-sim", "plan-why": "plan", "alerts-disruption": "alerts", "map-crowd": "map"}
for f in files:
    for key, name in stills.items():
        if re.search(rf"\d+-{key}-h", f):
            im = Image.open(f).convert("RGB")
            im.save(f"docs/{name}.jpg", quality=80, optimize=True)
            print(f"docs/{name}.jpg", os.path.getsize(f"docs/{name}.jpg") // 1024, "KB")
