"""Stage optional loading benchmarks; none of these files are game entry dependencies."""
import argparse
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import shutil
import time
import urllib.request
import zipfile

BASELINE_VERSION = "5.9.0"
BASELINE_SHA256 = "ea28cdbb36b7e6e7a5f152d929f1710fadf63e8e97bb656485a9821515b7b081"
URL = "https://github.com/Caleb-Guyer/recoil-foundry/releases/download/v5.9.0/recoil-foundry-v5.9.0-site.zip"
ERROR_PROBE = '<script>addEventListener("error",()=>document.documentElement.dataset.loadingError="true");addEventListener("unhandledrejection",()=>document.documentElement.dataset.loadingError="true");</script>'


def instrument(html):
    # The same passive error probe in both wrappers; original game JS/CSS bytes
    # remain unchanged. A failed module must never count as a ready title.
    return html.replace("</head>", ERROR_PROBE + "</head>")


def selected(name):
    path = PurePosixPath(name)
    if path.is_absolute() or ".." in path.parts or "\\" in name or ":" in name:
        raise ValueError("Unsafe archive path")
    return name in ("index.html", "icon.svg") or (
        len(path.parts) == 2 and path.parts[0] == "assets" and path.suffix in (".js", ".css")
    )


def stage(build, archive_path=None):
    version = json.loads(Path("package.json").read_text(encoding="utf-8"))["version"]
    build = build.resolve(strict=True)
    if not (build / "index.html").is_file():
        raise ValueError("Build the game first")
    if archive_path:
        data = archive_path.read_bytes()
    else:
        for attempt in range(3):
            try:
                request = urllib.request.Request(URL, headers={"User-Agent": "Recoil-Foundry-loading-benchmark"})
                with urllib.request.urlopen(request, timeout=45) as response:
                    data = response.read(11_000_000)
                break
            except Exception:
                if attempt == 2:
                    raise
                time.sleep(2)
    if hashlib.sha256(data).hexdigest() != BASELINE_SHA256:
        raise ValueError("The 5.9.0 reference archive does not match its pinned SHA-256")

    reference = build / "benchmark" / BASELINE_VERSION
    current = build / "benchmark" / version
    if current == reference:
        raise ValueError("Reference and current versions must differ")
    for directory in (reference, current):
        directory.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        for entry in archive.infolist():
            if not entry.is_dir() and selected(entry.filename):
                output = reference / entry.filename
                output.parent.mkdir(parents=True, exist_ok=True)
                contents = archive.read(entry)
                if entry.filename == "index.html":
                    contents = instrument(contents.decode("utf-8")).encode("utf-8")
                output.write_bytes(contents)
    if not (reference / "index.html").is_file():
        raise ValueError("Reference archive has no root index")
    # Separate URL namespaces give both versions unused asset URLs on the first
    # comparison. A warm repeat then reuses each version's own browser cache.
    for path in [build / "index.html", build / "icon.svg", *(build / "assets").iterdir()]:
        name = path.relative_to(build).as_posix()
        if path.is_file() and selected(name):
            output = current / name
            output.parent.mkdir(parents=True, exist_ok=True)
            if name == "index.html":
                output.write_text(instrument(path.read_text(encoding="utf-8")), encoding="utf-8")
            else:
                shutil.copyfile(path, output)
    manifest = {"baseline": BASELINE_VERSION, "current": version, "baselineSha256": BASELINE_SHA256,
                "scope": "Optional isolated loading references; no media or user progress included."}
    (build / "benchmark" / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--build", type=Path, default=Path("dist"))
    parser.add_argument("--archive", type=Path)
    args = parser.parse_args()
    stage(args.build, args.archive)
