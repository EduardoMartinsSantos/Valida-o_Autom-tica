import { existsSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Acha o arquivo de api/ para a URL, no mesmo formato de rotas da Vercel.
// Ex.: /jornadas -> api/jornadas/index.js; /jornadas/abc -> api/jornadas/[id].js com id = "abc".
function resolverRota(partes) {
  const base = ['api', ...partes].join('/')
  for (const file of [`${base}.js`, `${base}/index.js`]) {
    if (existsSync(file)) return { file, params: {} }
  }
  const pai = ['api', ...partes.slice(0, -1)].join('/')
  if (partes.length && existsSync(`${pai}/[id].js`)) {
    return { file: `${pai}/[id].js`, params: { id: decodeURIComponent(partes.at(-1)) } }
  }
  return null
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let dados = ''
    req.on('data', (chunk) => { dados += chunk })
    req.on('end', () => resolve(dados))
    req.on('error', reject)
  })
}

// Só em `npm run dev`: executa as funções de api/ dentro do servidor do Vite,
// imitando o req/res da Vercel (req.query, req.body, res.status/json/send).
function apiLocal() {
  return {
    name: 'api-local',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res) => {
        const url = new URL(req.url, 'http://localhost')
        const rota = resolverRota(url.pathname.split('/').filter(Boolean))

        res.status = (codigo) => { res.statusCode = codigo; return res }
        res.json = (obj) => {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(obj))
          return res
        }
        res.send = (corpo) => { res.end(corpo); return res }

        if (!rota) return res.status(404).json({ error: 'Rota não encontrada.' })

        const texto = await lerCorpo(req)
        try {
          req.body = texto && req.headers['content-type']?.startsWith('application/json') ? JSON.parse(texto) : texto
        } catch {
          return res.status(400).json({ error: 'JSON inválido.' })
        }
        req.query = { ...Object.fromEntries(url.searchParams), ...rota.params }

        try {
          const { default: handler } = await server.ssrLoadModule(`/${rota.file}`)
          await handler(req, res)
        } catch (err) {
          console.error(err)
          if (!res.writableEnded) res.status(500).json({ error: 'Erro interno.' })
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // Variáveis do servidor (DATABASE_URL etc.) vêm do .env.local; só VITE_* chegam ao navegador.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))
  return { plugins: [react(), apiLocal()] }
})
