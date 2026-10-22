import { query } from './db.js'
import { HttpError } from './http.js'

const COLUNAS = 'id, nome, descricao, passos'

const texto = (value) => (typeof value === 'string' ? value.trim() : '')

// Valida o corpo vindo do navegador; nada é gravado sem passar por aqui.
export function parseJornada(body) {
  const nome = texto(body?.nome)
  const descricao = typeof body?.descricao === 'string' ? body.descricao : ''
  const passos = Array.isArray(body?.passos) ? body.passos : []

  if (!nome || nome.length > 200) throw new HttpError(400, 'Nome obrigatório (até 200 caracteres).')
  if (!descricao.trim() || descricao.length > 200_000) throw new HttpError(400, 'Descrição obrigatória.')
  if (passos.length === 0 || passos.length > 100) throw new HttpError(400, 'A jornada precisa de 1 a 100 passos.')

  return {
    nome,
    descricao,
    passos: passos.map((p) => {
      const passo = { id: texto(p?.id), titulo: texto(p?.titulo), hint: texto(p?.hint) }
      if (!passo.id || !passo.titulo || passo.titulo.length > 300 || passo.hint.length > 5000) {
        throw new HttpError(400, 'Todo passo precisa de um título (até 300 caracteres).')
      }
      return passo
    }),
  }
}

// Erros do Postgres que viram resposta para o usuário.
function traduzErro(err) {
  if (err.code === '23505') return new HttpError(409, 'Já existe uma jornada com esse nome.')
  if (err.code === '22P02') return new HttpError(404, 'Jornada não encontrada.')
  if (err.code === '23503') return new HttpError(409, 'Esta jornada já foi usada em baterias de validação e não pode ser excluída.')
  return err
}

export async function listar() {
  const { rows } = await query(`select ${COLUNAS} from validacao.jornadas order by criado_em`)
  return rows
}

export async function criar(jornada, user) {
  try {
    const { rows } = await query(
      `insert into validacao.jornadas (nome, descricao, passos, criado_por, atualizado_por)
       values ($1, $2, $3, $4, $4) returning ${COLUNAS}`,
      [jornada.nome, jornada.descricao, JSON.stringify(jornada.passos), user.email],
    )
    return rows[0]
  } catch (err) {
    throw traduzErro(err)
  }
}

export async function atualizar(id, jornada, user) {
  try {
    const { rows } = await query(
      `update validacao.jornadas
       set nome = $2, descricao = $3, passos = $4, atualizado_por = $5, atualizado_em = now()
       where id = $1 returning ${COLUNAS}`,
      [id, jornada.nome, jornada.descricao, JSON.stringify(jornada.passos), user.email],
    )
    if (!rows[0]) throw new HttpError(404, 'Jornada não encontrada.')
    return rows[0]
  } catch (err) {
    throw traduzErro(err)
  }
}

export async function excluir(id) {
  try {
    // Bloqueia só se a jornada estiver em bateria ainda aberta (sem link da pasta);
    // baterias concluídas mantêm o registro com o nome da jornada.
    const { rowCount } = await query(
      `delete from validacao.jornadas j
       where j.id = $1 and not exists (
         select 1 from validacao.execucoes e join validacao.baterias b on b.id = e.bateria_id
         where e.jornada_id = j.id and b.link_pasta is null)`,
      [id],
    )
    if (!rowCount) {
      const { rows } = await query('select 1 from validacao.jornadas where id = $1', [id])
      if (!rows[0]) throw new HttpError(404, 'Jornada não encontrada.')
      throw new HttpError(409, 'Esta jornada está em uma bateria em andamento e não pode ser excluída agora.')
    }
  } catch (err) {
    throw traduzErro(err)
  }
}
