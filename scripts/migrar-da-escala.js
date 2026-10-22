// Copia as jornadas do esquema "validacao" do banco da Nova Escala para o banco próprio do app.
// Uso:
//   DATABASE_URL=... VALIDACAO_DATABASE_URL=... node scripts/migrar-da-escala.js
//   ... node scripts/migrar-da-escala.js --apagar-origem   (depois de conferir a cópia)
// --apagar-origem só apaga o esquema da Escala se todas as jornadas já estiverem no banco novo.
import pg from 'pg'

const { DATABASE_URL, VALIDACAO_DATABASE_URL } = process.env
if (!DATABASE_URL || !VALIDACAO_DATABASE_URL) {
  console.error('Defina DATABASE_URL (Escala) e VALIDACAO_DATABASE_URL (banco novo).')
  process.exit(1)
}
for (const [nome, url] of Object.entries({ DATABASE_URL, VALIDACAO_DATABASE_URL })) {
  if (!/^postgres(ql)?:\/\//.test(url)) {
    console.error(`${nome} não parece uma connection string (deve começar com postgresql://).`)
    process.exit(1)
  }
}
if (DATABASE_URL === VALIDACAO_DATABASE_URL) {
  console.error('DATABASE_URL e VALIDACAO_DATABASE_URL apontam para o mesmo banco.')
  process.exit(1)
}

const apagarOrigem = process.argv.includes('--apagar-origem')
const escala = new pg.Client({ connectionString: DATABASE_URL })
const app = new pg.Client({ connectionString: VALIDACAO_DATABASE_URL })
await escala.connect()
await app.connect()

async function migrar() {
  const existe = await escala.query(
    "select 1 from information_schema.tables where table_schema = 'validacao' and table_name = 'jornadas'",
  )
  if (existe.rows.length === 0) {
    console.log('Não há esquema "validacao" no banco da Escala. Nada a fazer.')
    return
  }

  const { rows } = await escala.query('select * from validacao.jornadas order by criado_em')
  for (const j of rows) {
    await app.query(
      `insert into validacao.jornadas
         (id, nome, descricao, passos, criado_por, atualizado_por, criado_em, atualizado_em)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (id) do nothing`,
      [j.id, j.nome, j.descricao, JSON.stringify(j.passos), j.criado_por, j.atualizado_por, j.criado_em, j.atualizado_em],
    )
  }
  const ids = rows.map((j) => j.id)
  const copiadas = ids.length
    ? (await app.query('select count(*)::int as n from validacao.jornadas where id = any($1)', [ids])).rows[0].n
    : 0
  console.log(`Jornadas na Escala: ${rows.length}. Presentes no banco novo: ${copiadas}.`)

  if (apagarOrigem) {
    if (copiadas !== rows.length) {
      console.error('Cópia incompleta; o esquema da Escala NÃO foi apagado.')
      process.exitCode = 1
      return
    }
    await escala.query('drop schema validacao cascade')
    console.log('Esquema "validacao" removido do banco da Escala.')
  }
}

try {
  await migrar()
} finally {
  await escala.end()
  await app.end()
}
