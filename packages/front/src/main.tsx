import { RegistryProvider } from "@effect-atom/atom-react"
import React from "react"
import ReactDOM from "react-dom/client"
import { App } from "./App.js"

const root = document.getElementById("root")
if (!root) throw new Error("missing #root element")

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <RegistryProvider>
      <App />
    </RegistryProvider>
  </React.StrictMode>
)
