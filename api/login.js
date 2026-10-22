import { query, queryEscala } from '../server/db.js'
import { HttpError, route } from '../server/http.js'
import { senhaConfere } from '../server/senha.js'
import { setSession } from '../server/session.js'

const MAX_FALHAS = 5
const JANELA = "interval '15 minutes'"

async function bloqueado(email) {
  const { rows } = await query(
    `select 1 from validacao.login_falhas
     where email = $1 and tentativas >= $2 and desde > now() - ${JANELA}`,
    [email, MAX_FALHAS],
  )
  return rows.length > 0
}

function registrarFalha(email) {
  return query(
    `insert into validacao.login_falhas (email, tentativas, desde) values ($1, 1, now())
     on conflict (email) do update set
       tentativas = case when validacao.login_falhas.desde < now() - ${JANELA} then 1
                         else validacao.login_falhas.tentativas + 1 end,
       desde = case when validacao.login_falhas.desde < now() - ${JANELA} then now()
                    else validacao.login_falhas.desde end`,
    [email],
  )
}

export default route({
  async POST(req, res) {
    const email = String(req.body?.email ?? '').toLowerCase().trim()
    const password = String(req.body?.password ?? '')
    if (!email || !password) throw new HttpError(400, 'Informe e-mail e senha.')
    if (await bloqueado(email)) {
      throw new HttpError(429, 'Muitas tentativas. Aguarde 15 minutos e tente de novo.')
    }

    // Usuários e senhas vêm da Nova Escala (somente leitura).
    const { rows } = await queryEscala(
      `select id, nome, email, ativo, senha_hash from public.colaboradores
       where lower(email) = $1 and email <> ''`,
      [email],
    )
    const colaborador = rows[0]
    // Mesma mensagem para e-mail inexistente, inativo ou senha errada.
    if (!colaborador?.ativo || !senhaConfere(password, colaborador.senha_hash)) {
      await registrarFalha(email)
      throw new HttpError(401, 'E-mail ou senha inválidos.')
    }

    await query('delete from validacao.login_falhas where email = $1', [email])
    const user = { id: colaborador.id, name: colaborador.nome, email: colaborador.email }
    setSession(res, user)
    res.json({ user })
  },
})
