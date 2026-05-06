import { tanstackRouter } from "@tanstack/router-plugin/vite"
import tailwindcss from "@tailwindcss/vite"
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
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@template/domain": path.resolve(__dirname, "../domain/src/index.ts"),
      "@template/api-contract": path.resolve(__dirname, "../api-contract/src/index.ts")
    }
  },
  server: {
    port: 5173
  }
})
