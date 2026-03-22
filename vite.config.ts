import { defineConfig, type Plugin } from 'vite'
import solid from 'vite-plugin-solid'
import fs from 'node:fs'
import path from 'node:path'

/** Plugin Vite qui expose POST /api/save-defaults pour écrire public/defaults.json */
function saveDefaultsPlugin(): Plugin {
  return {
    name: 'save-defaults',
    configureServer(server) {
      server.middlewares.use('/api/save-defaults', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }
        let body = ''
        req.on('data', (chunk: Buffer) => { body += chunk.toString() })
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body)
            const filePath = path.resolve('public/defaults.json')
            fs.writeFileSync(filePath, JSON.stringify(parsed))
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          } catch {
            res.statusCode = 400
            res.end('Invalid JSON')
          }
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [solid(), saveDefaultsPlugin()],
})
