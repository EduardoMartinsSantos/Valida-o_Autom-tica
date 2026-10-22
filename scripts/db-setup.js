// Cria/atualiza o esquema "validacao" no banco próprio do app (db/schema.sql só usa "if not exists").
// Uso manual: VALIDACAO_DATABASE_URL=... npm run db:setup
// No build (npm run build) roda com --se-configurado: aplica no banco do ambiente do deploy
// (produção na main, dev na branch dev) e pula quando o ambiente não tem banco configurado.
import { readFile } from 'node:fs/promises'
import pg from 'pg'

if (!process.env.VALIDACAO_DATABASE_URL) {
  if (process.argv.includes('--se-configurado')) {
    console.log('VALIDACAO_DATABASE_URL não definida: esquema não aplicado neste build.')
    process.exit(0)
  }
  console.error('Defina VALIDACAO_DATABASE_URL antes de rodar.')
  process.exit(1)
}

const sql = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8')
const client = new pg.Client({ connectionString: process.env.VALIDACAO_DATABASE_URL })
await client.connect()
try {
  await client.query(sql)
  console.log('Esquema "validacao" pronto.')
} finally {
  await client.end()
}
