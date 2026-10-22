import { route } from '../../server/http.js'
import { requireUser } from '../../server/session.js'
import { finalizarExecucao, liberarExecucao, obterPdf, reabrirExecucao } from '../../server/baterias.js'

export default route({
  // Download do PDF da validação concluída.
  async GET(req, res) {
    requireUser(req)
    const pdf = await obterPdf(req.query.id)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="validacao.pdf"')
    res.status(200).send(pdf)
  },
  async PUT(req, res) {
    const user = requireUser(req)
    await finalizarExecucao(req.query.id, req.body, user)
    res.json({ ok: true })
  },
  // Reabre uma validação concluída.
  async PATCH(req, res) {
    const user = requireUser(req)
    res.json({ execucao: await reabrirExecucao(req.query.id, user) })
  },
  async DELETE(req, res) {
    const user = requireUser(req)
    await liberarExecucao(req.query.id, user)
    res.json({ ok: true })
  },
})
