import { query } from './db.js'
import { HttpError } from './http.js'

// A imagem chega em base64 dentro do JSON; a Vercel limita o corpo a ~4,5 MB.
const MAX_IMAGEM_BYTES = 3 * 1024 * 1024

// Assinatura dos formatos aceitos (o navegador comprime para JPEG antes de enviar).
const FORMATOS = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8,
  'image/png': (b) => b.subarray(0, 4).toString('hex') === '89504e47',
}

function traduzErro(err) {
  if (err.code === '22P02') return new HttpError(404, 'Validação não encontrada.')
  return err
}

// Só quem está validando mexe nos prints, e só em passos que existem na jornada.
async function exigirResponsavel(execucaoId, passoId, user) {
  const { rows } = await query(
    `select e.status, e.responsavel_email,
            exists (select 1 from jsonb_array_elements(j.passos) p where p->>'id' = $2) as passo_existe
     from validacao.execucoes e join validacao.jornadas j on j.id = e.jornada_id
     where e.id = $1`,
    [execucaoId, passoId],
  )
  const execucao = rows[0]
  if (!execucao) throw new HttpError(404, 'Validação não encontrada.')
  if (execucao.status !== 'em_validacao' || execucao.responsavel_email !== user.email) {
    throw new HttpError(409, 'Esta validação não está mais em andamento com você.')
  }
  if (!execucao.passo_existe) throw new HttpError(404, 'Passo não encontrado nesta jornada.')
}

export async function listarPassosComPrint(execucaoId) {
  try {
    const { rows } = await query('select passo_id from validacao.execucao_prints where execucao_id = $1', [execucaoId])
    return rows.map((r) => r.passo_id)
  } catch (err) {
    throw traduzErro(err)
  }
}

export async function obterPrint(execucaoId, passoId) {
  try {
    const { rows } = await query(
      'select imagem, tipo from validacao.execucao_prints where execucao_id = $1 and passo_id = $2',
      [execucaoId, passoId],
    )
    if (!rows[0]) throw new HttpError(404, 'Print não encontrado.')
    return rows[0]
  } catch (err) {
    throw traduzErro(err)
  }
}

export async function salvarPrint(body, user) {
  const { execucaoId, passoId, tipo } = body ?? {}
  const imagem = Buffer.from(typeof body?.imagemBase64 === 'string' ? body.imagemBase64 : '', 'base64')
  if (!FORMATOS[tipo]?.(imagem)) throw new HttpError(400, 'Imagem inválida (use JPEG ou PNG).')
  if (imagem.length > MAX_IMAGEM_BYTES) throw new HttpError(413, 'A imagem passou de 3 MB.')
  try {
    await exigirResponsavel(execucaoId, String(passoId ?? ''), user)
    await query(
      `insert into validacao.execucao_prints (execucao_id, passo_id, imagem, tipo) values ($1, $2, $3, $4)
       on conflict (execucao_id, passo_id) do update set imagem = $3, tipo = $4, atualizado_em = now()`,
      [execucaoId, passoId, imagem, tipo],
    )
  } catch (err) {
    throw traduzErro(err)
  }
}

export async function removerPrint(execucaoId, passoId, user) {
  try {
    await exigirResponsavel(execucaoId, String(passoId ?? ''), user)
    await query('delete from validacao.execucao_prints where execucao_id = $1 and passo_id = $2', [execucaoId, passoId])
  } catch (err) {
    throw traduzErro(err)
  }
}
