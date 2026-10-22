import { query } from './db.js'
import { HttpError } from './http.js'

// O PDF vem em base64 dentro do JSON; a Vercel limita o corpo a ~4,5 MB.
const MAX_PDF_BYTES = 3 * 1024 * 1024

function traduzErro(err) {
  if (err.code === '22P02') return new HttpError(404, 'Registro não encontrado.')
  return err
}

export async function listarBaterias() {
  const { rows } = await query(`
    select b.id, b.gml, b.criado_por, b.criado_em, b.link_pasta, b.finalizada_em,
      (select count(*)::int from validacao.jornadas) as total,
      (count(e.id) filter (where e.status = 'em_validacao'))::int as em_validacao,
      (count(e.id) filter (where e.status = 'concluida'))::int as concluidas
    from validacao.baterias b
    left join validacao.execucoes e on e.bateria_id = b.id
    group by b.id
    order by b.criado_em desc`)
  return rows
}

export async function criarBateria(body, user) {
  const gml = typeof body?.gml === 'string' ? body.gml.trim() : ''
  if (!gml || gml.length > 50) throw new HttpError(400, 'Informe o número da GML (até 50 caracteres).')
  const { rows } = await query(
    'insert into validacao.baterias (gml, criado_por) values ($1, $2) returning id, gml, criado_por, criado_em',
    [gml, user.name ?? user.email],
  )
  return rows[0]
}

export async function obterBateria(id) {
  try {
    const { rows } = await query(
      `select id, gml, criado_por, criado_em, link_pasta, finalizada_em, finalizada_por,
              (select count(*)::int from validacao.jornadas) as total
       from validacao.baterias where id = $1`,
      [id],
    )
    if (!rows[0]) throw new HttpError(404, 'Bateria não encontrada.')
    const execucoes = await query(
      `select id, jornada_id, jornada_nome, status, responsavel_email, responsavel_nome,
              iniciado_em, concluido_em, progresso
       from validacao.execucoes where bateria_id = $1`,
      [id],
    )
    return { ...rows[0], execucoes: execucoes.rows }
  } catch (err) {
    throw traduzErro(err)
  }
}

export async function iniciarExecucao(body, user) {
  const { bateriaId, jornadaId } = body ?? {}
  try {
    const { rows } = await query(
      `insert into validacao.execucoes
         (bateria_id, jornada_id, jornada_nome, status, responsavel_email, responsavel_nome)
       select b.id, j.id, j.nome, 'em_validacao', $3, $4
       from validacao.baterias b, validacao.jornadas j
       where b.id = $1 and j.id = $2 and b.link_pasta is null
       on conflict (bateria_id, jornada_id) do nothing
       returning id`,
      [bateriaId, jornadaId, user.email, user.name],
    )
    if (rows[0]) return rows[0]

    // Nada inserido: bateria/jornada inexistente ou alguém já pegou essa validação.
    const atual = await query(
      `select responsavel_nome, responsavel_email, status from validacao.execucoes
       where bateria_id = $1 and jornada_id = $2`,
      [bateriaId, jornadaId],
    )
    if (!atual.rows[0]) throw new HttpError(404, 'Bateria ou jornada não encontrada (ou bateria já finalizada).')
    const { status, responsavel_nome, responsavel_email } = atual.rows[0]
    const quem = responsavel_nome ?? responsavel_email
    throw new HttpError(409, status === 'concluida'
      ? `Esta validação já foi concluída por ${quem}.`
      : `Esta validação já está com ${quem}.`)
  } catch (err) {
    throw traduzErro(err)
  }
}

// Só quem iniciou pode finalizar ou liberar, e só enquanto estiver em validação.
const DA_PESSOA = "id = $1 and status = 'em_validacao' and responsavel_email = $2"
const NAO_E_SUA = 'Esta validação não está mais em andamento com você.'

export async function finalizarExecucao(id, body, user) {
  const pdf = Buffer.from(typeof body?.pdfBase64 === 'string' ? body.pdfBase64 : '', 'base64')
  if (pdf.subarray(0, 4).toString() !== '%PDF') throw new HttpError(400, 'PDF inválido.')
  if (pdf.length > MAX_PDF_BYTES) throw new HttpError(413, 'O PDF passou de 3 MB. Use prints menores.')

  const passos = Array.isArray(body?.progresso?.passos) ? body.progresso.passos : []
  const progresso = {
    total: passos.length,
    concluidos: passos.filter((p) => p?.concluido === true).length,
    passos: passos.map((p) => ({
      id: String(p?.id ?? ''),
      titulo: String(p?.titulo ?? ''),
      concluido: p?.concluido === true,
    })),
  }
  try {
    const { rowCount } = await query(
      `update validacao.execucoes
       set status = 'concluida', concluido_em = now(), progresso = $3, pdf = $4
       where ${DA_PESSOA}`,
      [id, user.email, JSON.stringify(progresso), pdf],
    )
    if (!rowCount) throw new HttpError(409, NAO_E_SUA)
  } catch (err) {
    throw traduzErro(err)
  }
}

export async function liberarExecucao(id, user) {
  try {
    const { rowCount } = await query(`delete from validacao.execucoes where ${DA_PESSOA}`, [id, user.email])
    if (!rowCount) throw new HttpError(409, NAO_E_SUA)
  } catch (err) {
    throw traduzErro(err)
  }
}

export async function obterPdf(id) {
  try {
    const { rows } = await query(
      "select pdf from validacao.execucoes where id = $1 and status = 'concluida'",
      [id],
    )
    if (!rows[0]?.pdf) throw new HttpError(404, 'PDF não encontrado.')
    return rows[0].pdf
  } catch (err) {
    throw traduzErro(err)
  }
}

// Fecha a bateria: guarda o link da pasta e apaga PDFs e prints (já estão no SharePoint).
// Tudo num único comando, só se todas as jornadas estiverem concluídas e o link ainda não existir.
export async function salvarLinkPasta(id, body, user) {
  const link = typeof body?.linkPasta === 'string' ? body.linkPasta.trim() : ''
  let url
  try {
    url = new URL(link)
  } catch {
    url = null
  }
  if (url?.protocol !== 'https:' || link.length > 2000) {
    throw new HttpError(400, 'Cole o link completo da pasta (começando com https://).')
  }
  try {
    const { rows } = await query(
      `with fechada as (
         update validacao.baterias b
         set link_pasta = $2, finalizada_em = now(), finalizada_por = $3
         where b.id = $1 and b.link_pasta is null
           and (select count(*) from validacao.jornadas) > 0
           and (select count(*) from validacao.execucoes e where e.bateria_id = b.id and e.status = 'concluida')
             = (select count(*) from validacao.jornadas)
         returning b.id
       ),
       prints as (
         delete from validacao.execucao_prints p
         using validacao.execucoes e, fechada f
         where p.execucao_id = e.id and e.bateria_id = f.id
       ),
       pdfs as (
         update validacao.execucoes e set pdf = null from fechada f where e.bateria_id = f.id
       )
       select id from fechada`,
      [id, link, user.name ?? user.email],
    )
    if (!rows[0]) {
      throw new HttpError(409, 'A bateria precisa ter todas as validações concluídas e ainda não ter link salvo.')
    }
  } catch (err) {
    throw traduzErro(err)
  }
}

// Volta uma validação concluída para "em validação", no nome de quem reabriu.
// Os prints continuam salvos; o PDF antigo é descartado e será gerado de novo ao finalizar.
// Só antes de a bateria ter o link da pasta (depois disso os prints já foram apagados).
export async function reabrirExecucao(id, user) {
  try {
    const { rows } = await query(
      `update validacao.execucoes e
       set status = 'em_validacao', responsavel_email = $2, responsavel_nome = $3,
           iniciado_em = now(), concluido_em = null, progresso = null, pdf = null
       from validacao.baterias b
       where e.id = $1 and e.bateria_id = b.id and e.status = 'concluida' and b.link_pasta is null
       returning e.id, e.jornada_id`,
      [id, user.email, user.name],
    )
    if (!rows[0]) {
      throw new HttpError(409, 'Só é possível reabrir validações concluídas de baterias sem link salvo.')
    }
    return rows[0]
  } catch (err) {
    throw traduzErro(err)
  }
}
