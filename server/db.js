import pg from 'pg'

let pool

export function query(text, params) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.')
  // Funções serverless: poucas conexões por instância.
  pool ??= new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 })
  return pool.query(text, params)
}
