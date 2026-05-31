import "./app/env.js"
import * as http from "node:http"
import { createRequestListener } from "remix/node-fetch-server"
import { clientAddresses } from "./app/auth/client-ip.js"
import { router } from "./app/router.js"

const PORT = Number(process.env.PORT ?? 3000)

// The Remix 3 router exposes a web-standard `fetch(request) => Response`,
// which `createRequestListener` adapts to a Node `http` server. The 2nd arg
// carries the socket client address; stash it so handlers can rate-limit by IP.
const server = http.createServer(
  createRequestListener((request, client) => {
    if (client?.address) clientAddresses.set(request, client.address)
    return router.fetch(request)
  })
)

server.listen(PORT, () => {
  console.log(`web server listening at http://localhost:${PORT}`)
})
