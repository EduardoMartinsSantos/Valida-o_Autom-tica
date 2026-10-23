import { route } from '../../server/http.js'
import { requireAdmin, requireUser } from '../../server/session.js'
import { excluirBateria, obterBateria, salvarLinkPasta } from '../../server/baterias.js'

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
  // Exclui a bateria (ex.: baterias de teste). Só admin.
  async DELETE(req, res) {
    await requireAdmin(req, 'Apenas administradores podem excluir baterias.')
    await excluirBateria(req.query.id)
    res.json({ ok: true })
  },
})
