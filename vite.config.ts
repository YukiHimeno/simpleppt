import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'simpleppt-api-proxy',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url !== '/api/proxy') return next()
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.end('Method Not Allowed')
            return
          }
          try {
            const chunks: Buffer[] = []
            for await (const chunk of req) chunks.push(chunk as Buffer)
            const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
            const target = new URL(payload.url)
            if (target.protocol !== 'https:' && target.hostname !== 'localhost' && target.hostname !== '127.0.0.1') {
              throw new Error('仅允许转发到 https 或本机地址')
            }
            const upstream = await fetch(target.toString(), {
              method: payload.method ?? 'GET',
              headers: new Headers(payload.headers ?? {}),
              body:
                payload.method && payload.method !== 'GET' && payload.method !== 'HEAD'
                  ? (payload.body ?? undefined)
                  : undefined,
              signal: AbortSignal.timeout(290_000),
            })
            const text = await upstream.text()
            res.statusCode = upstream.status
            res.setHeader('content-type', upstream.headers.get('content-type') ?? 'text/plain; charset=utf-8')
            res.end(text)
          } catch (e: any) {
            res.statusCode = 502
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ error: e?.message ?? String(e) }))
          }
        })
      },
    },
  ],
  resolve: {
    alias: {
      shared: path.resolve(import.meta.dirname, 'shared'),
    },
  },
})
