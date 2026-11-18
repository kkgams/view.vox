import { runtime, unwrap } from "/core/runtime.js"
import { registerViewPlugin, unregisterViewPlugin } from "/util/view-plugin.js"
import { decode as decodeVox } from "/util/vox/decode.js"
import { collectVoxInstances, voxelRenderDataFromVox } from "/util/vox/scene.js"
import { VoxelOrbitRenderer } from "/util/voxel-orbit-renderer.js"

const WEBGL2_UNAVAILABLE = "WebGL2 is unavailable. VOX rendering requires WebGL2."

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
        this.webgl2Unavailable = false
        this.loadRevision = 0
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
        this.style.display = "contents"

        this.path = String(this.popupProps?.path || this.getAttribute("data-source") || "").trim()
        assert(this.path, "view-vox requires data-source")

        this.innerHTML = `
      <canvas data-element="canvas"></canvas>
      <footer data-element="footer">
        <output data-element="path"></output>
        <output data-element="status"></output>
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

        this.mountHeaderControls()
        registerViewPlugin(this)
        this.dataset.ready = "1"
        void this.load()
    }

    disconnectedCallback() {
        delete this.dataset.ready
        this.loadRevision++
        if (this.resizeFrame) {
            cancelAnimationFrame(this.resizeFrame)
            this.resizeFrame = 0
        }
        this.pendingCanvasSize = null
        this.resizeObserver.disconnect()
        this.unmountHeaderControls()
        if (this.renderer) this.renderer.dispose()
        this.renderer = null
        this.webgl2Unavailable = false
        void unregisterViewPlugin(this)
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return
        if (name !== "data-source") return
        this.path = String(newValue || "").trim()
        if (this.pathElement instanceof HTMLOutputElement) this.pathElement.textContent = this.path
        if (this.dataset.ready) void this.load()
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
        const path = this.path
        const result = await this.load()
        if (result.ok) await runtime.call("ui.toast.success", { message: `Reloaded ${path}` })
        return result
    }

    zoomIn() {
        return this.applyViewAction(renderer => renderer.zoom(0.8))
    }

    zoomOut() {
        return this.applyViewAction(renderer => renderer.zoom(1.25))
    }

    zoomFit() {
        return this.applyViewAction(renderer => renderer.fit())
    }

    applyViewAction(action) {
        if (this.webgl2Unavailable) return { err: WEBGL2_UNAVAILABLE }
        assert(this.renderer, "view-vox renderer is not initialized")
        action(this.renderer)
    }

    setStatus(text, tone = null) {
        assert(this.statusElement instanceof HTMLOutputElement, "view-vox status output is not initialized")
        this.statusElement.textContent = text
        this.statusElement.classList.remove("accent", "success", "warning", "danger", "info")
        if (tone) this.statusElement.classList.add(tone)
    }

    initializeRenderer() {
        assert(this.canvas instanceof HTMLCanvasElement, "view-vox missing canvas")
        // Probe the actual canvas with the renderer's options. Only null is expected.
        this.webgl2Unavailable = this.canvas.getContext("webgl2", { antialias: true, alpha: true }) === null
        if (this.headerControlsElement) {
            for (const button of this.headerControlsElement.querySelectorAll('[data-element="view-actions"] > button')) {
                button.disabled = this.webgl2Unavailable
            }
        }
        if (this.webgl2Unavailable) return false

        this.renderer = new VoxelOrbitRenderer(this.canvas)
        this.resizeObserver.observe(this.canvas)
        return true
    }

    async load() {
        const revision = ++this.loadRevision
        const path = this.path
        assert(path, "view-vox requires data-source")
        if (!this.renderer && !this.initializeRenderer()) {
            this.setStatus(WEBGL2_UNAVAILABLE, "danger")
            return { err: WEBGL2_UNAVAILABLE }
        }
        this.setStatus("Loading...", "info")

        let vox, instances, renderData
        try {
            const bytes = new Uint8Array(unwrap(await runtime.invoke("fs/fs::read-file", path), path))
            if (revision !== this.loadRevision) return { err: "VOX load was superseded" }
            vox = decodeVox(bytes.buffer, bytes.byteOffset, bytes.byteLength)
            instances = collectVoxInstances(vox)
            renderData = voxelRenderDataFromVox(vox, instances)
        } catch (error) {
            if (revision !== this.loadRevision) return { err: "VOX load was superseded" }
            const message = `Error: ${error?.message || error}`
            this.setStatus(message, "danger")
            console.error("view-vox load failed:", error)
            return { err: message }
        }
        this.renderer.setInstances(renderData)
        this.setStatus(this.createStatusText(vox, instances, renderData.instances.length / 4), "success")
        return { ok: true }
    }

    createStatusText(vox, instances, voxelCount) {
        const modelText = vox.models.length === 1 ? "1 model" : `${vox.models.length} models`
        const instanceText = instances.length === 1 ? "1 instance" : `${instances.length} instances`
        return [
            modelText,
            instanceText,
            `${voxelCount} voxels`,
            vox.palette ? "RGBA palette" : "debug palette",
            "WebGL orbit",
        ].join(" · ")
    }
}

if (!customElements.get("view-vox")) {
    customElements.define("view-vox", ViewVox)
}
