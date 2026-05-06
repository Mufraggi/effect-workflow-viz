import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import path from "node:path"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true
    }),
    react(),
    tailwindcss()
  ],
  resolve: {
    alias: [
      { find: /^@template\/domain\/(.*)$/, replacement: path.resolve(__dirname, "../domain/src/$1.ts") },
      { find: /^@template\/api-contract\/(.*)$/, replacement: path.resolve(__dirname, "../api-contract/src/$1.ts") },
      { find: "@template/domain", replacement: path.resolve(__dirname, "../domain/src/index.ts") },
      { find: "@template/api-contract", replacement: path.resolve(__dirname, "../api-contract/src/index.ts") },
      { find: "@", replacement: path.resolve(__dirname, "./src") }
    ]
  },
  server: {
    port: 5173
  }
})
