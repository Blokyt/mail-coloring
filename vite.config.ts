import { defineConfig, type Plugin } from 'vite'
import solid from 'vite-plugin-solid'
import fs from 'node:fs'
import path from 'node:path'

/** Plugin Vite — API admin locale pour persister dans public/ */
function adminApiPlugin(): Plugin {
  /** Helper generique : lit un POST JSON et ecrit dans un fichier */
  function jsonWriter(filePath: string) {
    return (req: any, res: any) => {
      if (req.method !== 'POST') { res.statusCode = 405; res.end('Method not allowed'); return }
      let body = ''
      req.on('data', (chunk: Buffer) => { body += chunk.toString() })
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body)
          fs.writeFileSync(path.resolve(filePath), JSON.stringify(parsed, null, 2))
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true }))
        } catch {
          res.statusCode = 400
          res.end('Invalid JSON')
        }
      })
    }
  }

  return {
    name: 'admin-api',
    configureServer(server) {
      // Sauvegarder les CSS defaults
      server.middlewares.use('/api/save-defaults', jsonWriter('public/defaults.json'))
      // Sauvegarder toutes les donnees admin
      server.middlewares.use('/api/save-admin', jsonWriter('public/admin-data.json'))
    },
  }
}

export default defineConfig({
  plugins: [solid(), adminApiPlugin()],
})
