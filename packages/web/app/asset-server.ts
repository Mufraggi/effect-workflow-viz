import { createAssetServer } from "remix/assets"
import * as path from "node:path"

const rootDir = process.cwd()
const isProd = process.env.NODE_ENV === "production"

// Compiles & serves client TS/TSX on demand under `/assets`. In this pnpm
// monorepo, dependencies (remix/ui → @remix-run/*) and workspace packages live
// in the hoisted root `node_modules`, two levels up from packages/web.
export const assetServer = createAssetServer({
  basePath: "/assets",
  rootDir,
  fileMap: {
    "/app/*path": "app/*path",
    "/node_modules/*path": path.join("..", "..", "node_modules", "*path")
  },
  allow: [
    "app/**",
    path.join("..", "..", "node_modules", "**")
  ],
  deny: ["app/**/*.server.*"],
  // Shared compiler options must stay at the top level so they apply to styles too.
  target: { es: "2022", chrome: "111", safari: "16.4" },
  minify: isProd,
  // In dev, watch `app/` for hot reload but ignore the hoisted `node_modules`
  // tree (watching it is prohibitively heavy in this monorepo). In prod, disable
  // watching entirely since files on disk are stable.
  watch: isProd ? false : { ignore: ["**/node_modules/**"] },
  ...(isProd ? {} : { sourceMaps: "external" as const }),
  scripts: {
    define: {
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "development")
    }
  }
})
