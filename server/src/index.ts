/**
 * Point d'entrée du serveur API + MCP du colorieur.
 */
import { config, ensureJwtSecret } from './config.js'
import { openDb } from './db.js'
import { buildApp } from './routes.js'
import { registerMcpRoutes } from './mcp.js'

const db = openDb()
ensureJwtSecret()
const app = buildApp({ db })
registerMcpRoutes(app, db)

app.listen({ port: config.port, host: config.host }).then(() => {
  console.log(`mailcolorer API + MCP sur http://${config.host}:${config.port} (data: ${config.dataDir})`)
}, (err) => {
  console.error('Écoute impossible:', err)
  process.exit(1)
})

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    db.close()
    process.exit(0)
  })
}
