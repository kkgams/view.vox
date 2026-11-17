# Voxel View

MagicaVoxel model viewer for [GAMS](https://github.com/kkgams/gams).

| View | Source / release file | Screenshot | License / author |
| --- | --- | --- | --- |
| `view-vox` | `src/view.vox/views/view-vox.js` / `view.vox.zip` | Not available | [Apache-2.0](LICENSE), [GAMS contributors](https://github.com/kkgams/view.vox) |

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
| `make clean` | Remove all of `build.nosync/`, `tools/` and `gams_modules/`, without ownership markers; refuse tracked files or symlinks in deletion paths before deleting anything. |

Supply the MagicaVoxel model described in [the wiki](docs/index.md) before opening. Supplied inputs are not packaged. Existing Host downloads are never updated implicitly; notices remain beside the app. First use requires network. No sibling checkout is needed.
