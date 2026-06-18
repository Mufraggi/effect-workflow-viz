import { run } from "remix/ui"

// Client bootstrap: starts the Remix runtime and hydrates any clientEntry()
// components present in the document.
const app = run({
  // Resolve the module for each hydrated client entry.
  async loadModule(moduleUrl, exportName) {
    const mod = await import(moduleUrl)
    return mod[exportName]
  },
  // Resolve content when the runtime navigates (top-level document) or a
  // <Frame> (re)loads. Without this, the runtime intercepts same-origin anchor
  // navigations, changes the URL, but has no way to fetch/swap the new page —
  // so the page appears not to load. Fetching the target HTML lets the runtime
  // swap it in (including the new <head> styles).
  async resolveFrame(src, signal, target) {
    const headers = new Headers({ accept: "text/html" })
    if (target) headers.set("x-remix-target", target)
    const response = await fetch(src, { headers, signal })
    return response.body ?? (await response.text())
  }
})

// Surface hydration/component errors instead of swallowing them silently.
app.addEventListener("error", (event) => {
  // eslint-disable-next-line no-console -- surface hydration/component errors in the browser console
  console.error("Remix component error:", (event as ErrorEvent).error ?? event)
})
