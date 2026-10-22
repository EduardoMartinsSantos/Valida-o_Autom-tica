import { route } from '../../server/http.js'
import { requireAdmin } from '../../server/session.js'
import { atualizar, excluir, parseJornada } from '../../server/jornadas.js'

export default route({
  async PUT(req, res) {
    const user = await requireAdmin(req)
    res.json({ jornada: await atualizar(req.query.id, parseJornada(req.body), user) })
  },
  async DELETE(req, res) {
    await requireAdmin(req)
    await excluir(req.query.id)
    res.json({ ok: true })
  },
})
