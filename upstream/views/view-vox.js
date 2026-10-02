import { runtime, unwrap } from "/core/runtime.js"
import { registerViewPlugin, unregisterViewPlugin } from "/util/view-plugin.js"
import { VoxelOrbitRenderer } from "/util/voxel-orbit-renderer.js"
import { decode as decodeVox } from "/util/vox/decode.js"
import { collectVoxInstances, voxelRenderDataFromVox } from "/util/vox/scene.js"

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

export class ViewVox extends HTMLElement {
  static get observedAttributes() {
    return ["data-source"]
  }

  constructor() {
    super()
    this.path = ""
    this.canvas = null
    this.renderer = null
    this.statusElement = null
    this.pathElement = null
    this.headerControlsElement = null
    this.resizeFrame = 0
    this.pendingCanvasSize = null
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target !== this.canvas) continue
        this.pendingCanvasSize = {
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        }
        if (this.resizeFrame) return
        this.resizeFrame = requestAnimationFrame(() => {
          this.resizeFrame = 0
          const size = this.pendingCanvasSize
          this.pendingCanvasSize = null
          if (!size || !this.renderer) return
          this.renderer.resize(size.width, size.height)
        })
      }
    })
  }

  connectedCallback() {
    if (this.dataset.ready) return
    this.dataset.ready = "1"
    this.style.display = "contents"

    this.path = String(this.popupProps?.path || this.getAttribute("data-source") || "").trim()
    assert(this.path, "view-vox requires data-source")

    this.innerHTML = `
      <canvas data-element="canvas"></canvas>
      <footer data-element="footer">
        <output data-element="path"></output>
        <output data-element="status">Loading...</output>
      </footer>
    `

    this.canvas = this.querySelector('canvas[data-element="canvas"]')
    this.statusElement = this.querySelector('[data-element="status"]')
    this.pathElement = this.querySelector('[data-element="path"]')
    assert(this.canvas instanceof HTMLCanvasElement, "view-vox missing canvas")
    assert(this.statusElement instanceof HTMLOutputElement, "view-vox missing status output")
    assert(this.pathElement instanceof HTMLOutputElement, "view-vox missing path output")
    this.pathElement.textContent = this.path

    this.canvas.style.width = "100%"
    this.canvas.style.height = "100%"
    this.canvas.style.minWidth = "0"
    this.canvas.style.minHeight = "0"
    this.canvas.style.maxWidth = "100%"
    this.canvas.style.maxHeight = "100%"
    this.canvas.style.justifySelf = "stretch"
    this.canvas.style.alignSelf = "stretch"
    this.canvas.style.cursor = "grab"
    if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "0")

    this.renderer = new VoxelOrbitRenderer(this.canvas)
    this.resizeObserver.observe(this.canvas)
    this.mountHeaderControls()
    registerViewPlugin(this, this.createViewPluginMethods())
    void this.load()
  }

  disconnectedCallback() {
    if (this.resizeFrame) {
      cancelAnimationFrame(this.resizeFrame)
      this.resizeFrame = 0
    }
    this.resizeObserver.disconnect()
    this.unmountHeaderControls()
    if (this.renderer) this.renderer.dispose()
    this.renderer = null
    void unregisterViewPlugin(this)
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return
    if (name !== "data-source") return
    this.path = String(newValue || "").trim()
    if (this.pathElement instanceof HTMLOutputElement) this.pathElement.textContent = this.path
    if (this.dataset.ready) void this.load()
  }

  createViewPluginMethods() {
    return {
      reload: async () => {
        await this.reload()
        return { ok: true }
      },
    }
  }

  mountHeaderControls() {
    if (!this.parentElement || this.headerControlsElement) return
    const toolbar = document.createElement("div")
    toolbar.dataset.element = "toolbar"
    toolbar.setAttribute("slot", "header-controls")
    toolbar.innerHTML = `
      <div role="buttongroup" data-element="file-actions">
        <button type="button" data-action="reload" aria-label="Reload" title="Reload"><i aria-hidden="true">refresh</i></button>
      </div>
      <div role="buttongroup" data-element="view-actions">
        <button type="button" data-action="zoom-in" aria-label="Zoom in" title="Zoom in"><i aria-hidden="true">zoom_in</i></button>
        <button type="button" data-action="zoom-fit" aria-label="Fit" title="Fit"><i aria-hidden="true">fit_screen</i></button>
        <button type="button" data-action="zoom-out" aria-label="Zoom out" title="Zoom out"><i aria-hidden="true">zoom_out</i></button>
      </div>
    `
    toolbar.querySelector('[data-action="reload"]').addEventListener("click", () => this.reload())
    toolbar.querySelector('[data-action="zoom-in"]').addEventListener("click", () => this.zoomIn())
    toolbar.querySelector('[data-action="zoom-fit"]').addEventListener("click", () => this.zoomFit())
    toolbar.querySelector('[data-action="zoom-out"]').addEventListener("click", () => this.zoomOut())
    this.headerControlsElement = toolbar
    this.parentElement.appendChild(toolbar)
  }

  unmountHeaderControls() {
    if (this.headerControlsElement?.parentElement) this.headerControlsElement.remove()
    this.headerControlsElement = null
  }

  async reload() {
    await this.load()
    await runtime.call("ui.toast.success", { message: `Reloaded ${this.path}` })
  }

  zoomIn() {
    assert(this.renderer, "view-vox renderer is not initialized")
    this.renderer.zoom(0.8)
  }

  zoomOut() {
    assert(this.renderer, "view-vox renderer is not initialized")
    this.renderer.zoom(1.25)
  }

  zoomFit() {
    assert(this.renderer, "view-vox renderer is not initialized")
    this.renderer.fit()
  }

  setStatus(text, tone = null) {
    assert(this.statusElement instanceof HTMLOutputElement, "view-vox status output is not initialized")
    this.statusElement.textContent = text
    this.statusElement.classList.remove("accent", "success", "warning", "danger", "info")
    if (tone) this.statusElement.classList.add(tone)
  }

  async load() {
    assert(this.path, "view-vox requires data-source")
    assert(this.renderer, "view-vox renderer is not initialized")
    this.setStatus("Loading...", "info")

    try {
      const bytes = new Uint8Array(unwrap(await runtime.invoke("fs/fs::read-file", this.path), this.path))
      const vox = decodeVox(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      const instances = collectVoxInstances(vox)
      const renderData = voxelRenderDataFromVox(vox, instances)
      this.renderer.setInstances(renderData)
      this.setStatus(this.createStatusText(vox, instances, renderData.instances.length / 4), "success")
    } catch (error) {
      this.setStatus(`Error: ${error?.message || error}`, "danger")
      console.error("view-vox load failed:", error)
    }
  }

  createStatusText(vox, instances, voxelCount) {
    const modelText = vox.models.length === 1 ? "1 model" : `${vox.models.length} models`
    const instanceText = instances.length === 1 ? "1 instance" : `${instances.length} instances`
    return [modelText, instanceText, `${voxelCount} voxels`, vox.palette ? "RGBA palette" : "debug palette", "WebGL orbit"].join(" · ")
  }
}

if (!customElements.get("view-vox")) {
  customElements.define("view-vox", ViewVox)
}
