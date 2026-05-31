import * as path from "node:path"
import { renderWith } from "remix/middleware/render"
import { createHtmlResponse } from "remix/response/html"
import type { RemixNode } from "remix/ui"
import { renderToStream } from "remix/ui/server"
import { assetServer } from "../asset-server.js"

// Installs `context.render(node)` which streams a JSX tree to an HTML Response.
// Client entries (`clientEntry(import.meta.url, …)`) are resolved to their
// browser module URL via the asset server.
export function render() {
  return renderWith(({ request }) => (node: RemixNode, init?: ResponseInit) => {
    const stream = renderToStream(node, {
      signal: request.signal,
      async resolveClientEntry(entryId, component) {
        if (!entryId.startsWith("file://")) {
          throw new Error(`Expected \`import.meta.url\` for clientEntry ID, received '${entryId}'`)
        }
        return {
          href: await assetServer.getHref(entryId),
          exportName: entryId.split("#")[1] || component.name || titleCaseFileName(entryId)
        }
      }
    })
    return createHtmlResponse(stream, init)
  })
}

function titleCaseFileName(fileUrl: string): string {
  const url = new URL(fileUrl)
  const fileName = path.basename(url.pathname, path.extname(url.pathname))
  return fileName
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((s) => s[0]!.toUpperCase() + s.slice(1))
    .join("")
}
