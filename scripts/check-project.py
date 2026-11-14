"""Validate the local development Project without downloading or launching Units."""
import json
from pathlib import Path
import sys

def remote_url(source):
    assert isinstance(source, dict) and set(source) == {"$file"}, source
    resource = source["$file"]
    if isinstance(resource, dict):
        assert set(resource) == {"url", "entry"}, resource
        assert isinstance(resource["entry"], str) and resource["entry"], resource
        resource = resource["url"]
    assert isinstance(resource, str) and resource.startswith("https://github.com/kkgams/"), resource
    assert "/releases/download/v" in resource, resource
    return resource


ROOT = Path(__file__).resolve().parents[1]
config = json.loads((ROOT / "gams.json").read_text())
entries = {"view-vox": "src/view.vox/views/view-vox.js"}
views = config["ui"]["views"]
assert set(config["ui"]["services"]) == {
    "ui-context", "ui-keys", "ui-toast", "ui-popup", "ui-tooltip", "ui-layout"
}
for tag, source in entries.items():
    assert views[tag]["url"] == source
    assert (ROOT / source).is_file(), source
for entry in [config["ui"]["theme"], *config["ui"]["services"].values()]:
    remote_url(entry["url"])
for source in config["plugins"]:
    remote_url(source)

if "--require-inputs" in sys.argv:
    paths = []
    if "view-tree" in views:
        tree = views["view-tree"]["config"]
        paths = [tree["text"]["source"]["metaUrl"], tree["text"]["source"]["atlasUrl"]]
        paths += [entry["textureUrl"] for entry in tree["nineSlices"].values()]
    if "view-vox" in views:
        paths = [views["view-vox"]["defaultSource"]]
    for path in paths:
        local = (ROOT / path).resolve()
        if not local.is_relative_to(ROOT):
            sys.exit(f"Input must stay within this Project: {path}")
        if not local.is_file():
            sys.exit(f"Missing required development input: {path}; see docs/index.md")
print("Local Project configuration OK")
