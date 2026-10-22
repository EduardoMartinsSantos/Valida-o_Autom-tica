import bcrypt from 'bcryptjs'
import { query } from '../server/db.js'
import { HttpError, route } from '../server/http.js'
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

    // Usuários e senhas vêm do Mops-Escala (somente leitura).
    const { rows } = await query('select id, name, email, password from public.users where email = $1', [email])
    const user = rows[0]
    const valido = Boolean(user?.password) && (await bcrypt.compare(password, user.password))
    if (!valido) {
      await registrarFalha(email)
      throw new HttpError(401, 'E-mail ou senha inválidos.')
    }

    await query('delete from validacao.login_falhas where email = $1', [email])
    setSession(res, user)
    res.json({ user: { id: user.id, name: user.name, email: user.email } })
  },
})
