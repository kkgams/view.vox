---
title: Voxel View
status: reference
---

# Voxel View

MagicaVoxel model viewer for [GAMS](https://github.com/kkgams/gams).

| View | Source / release file | Screenshot | Author |
| --- | --- | --- | --- |
| `view-vox` | `src/view.vox/views/view-vox.js` / `view.vox.zip` | Not available | [GAMS contributors](https://github.com/kkgams/view.vox) |

## Development

Requires Make, Node.js 24, Python 3, curl, zip, unzip and tar. Canonical JavaScript loads directly; no compilation or package installation is needed.

| Command | Purpose |
| --- | --- |
| `make check` | Check JavaScript syntax and local Project configuration |
| `make package` | Build incremental ZIPs and `SHA256SUMS` under `build.nosync/` |
| `make open` | Open local `gams.json` in the released Host (macOS Apple Silicon) |
| `make serve-docs` | Preview pinned wiki; independent `DOCS_PORT=8080` |
| `make validate-docs` | Validate wiki |
| `make docs` | Build `build.nosync/site/` |
| `make clean` | Remove generated `build.nosync/`, marked Host downloads and configured completed Unit caches; refuse tracked files, symlinks and unidentified tools/caches |

Supply the MagicaVoxel model described in the inputs below before opening. Supplied inputs are not packaged. Existing Host downloads are never updated implicitly; notices remain beside the app. First use requires network. No sibling checkout is needed.

## Supplied inputs

Supply your own MagicaVoxel model at `dev-assets/model.vox` before `make open`, or change `ui.views.view-vox.defaultSource` in `gams.json` to a Project-local VOX path. Launch checks that the configured file exists. The real Host requires WebGL; no fixture model or mock renderer is supplied.

