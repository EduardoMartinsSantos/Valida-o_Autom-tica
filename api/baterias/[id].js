import { route } from '../../server/http.js'
import { requireUser } from '../../server/session.js'
import { obterBateria, salvarLinkPasta } from '../../server/baterias.js'

export default route({
  async GET(req, res) {
    requireUser(req)
    res.json({ bateria: await obterBateria(req.query.id) })
  },
  // Salva o link da pasta no SharePoint e apaga PDFs e prints da bateria.
  async PUT(req, res) {
    const user = requireUser(req)
    await salvarLinkPasta(req.query.id, req.body, user)
    res.json({ ok: true })
  },
})
