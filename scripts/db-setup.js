// Cria o esquema "validacao". Uso: DATABASE_URL=... npm run db:setup
import { readFile } from 'node:fs/promises'
import pg from 'pg'

if (!process.env.DATABASE_URL) {
  console.error('Defina DATABASE_URL antes de rodar.')
  process.exit(1)
}

const sql = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8')
const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
try {
  await client.query(sql)
  console.log('Esquema "validacao" pronto.')
} finally {
  await client.end()
}
