import pg from 'pg'

const pools = {}

function pool(envVar) {
  const url = process.env[envVar]
  if (!url) throw new Error(`${envVar} não configurada.`)
  // Funções serverless: poucas conexões por instância.
  pools[envVar] ??= new pg.Pool({ connectionString: url, max: 3 })
  return pools[envVar]
}

// Banco próprio do app: jornadas e bloqueio de login.
export const query = (text, params) => pool('VALIDACAO_DATABASE_URL').query(text, params)

// Banco da Nova Escala: usado só para conferir o login (somente leitura).
export const queryEscala = (text, params) => pool('DATABASE_URL').query(text, params)
