import { route } from '../../server/http.js'
import { requireUser } from '../../server/session.js'
import { atualizar, excluir, parseJornada } from '../../server/jornadas.js'

export default route({
  async PUT(req, res) {
    const user = requireUser(req)
    res.json({ jornada: await atualizar(req.query.id, parseJornada(req.body), user) })
  },
  async DELETE(req, res) {
    requireUser(req)
    await excluir(req.query.id)
    res.json({ ok: true })
  },
})
