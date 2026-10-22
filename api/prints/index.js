import { route } from '../../server/http.js'
import { requireUser } from '../../server/session.js'
import { listarPassosComPrint, obterPrint, removerPrint, salvarPrint } from '../../server/prints.js'

// Prints de uma validação em andamento.
//   GET    ?execucaoId=X              -> { passos: [ids com print] }
//   GET    ?execucaoId=X&passoId=Y    -> imagem
//   PUT    { execucaoId, passoId, tipo, imagemBase64 }
//   DELETE ?execucaoId=X&passoId=Y
export default route({
  async GET(req, res) {
    requireUser(req)
    const { execucaoId, passoId } = req.query
    if (!passoId) return res.json({ passos: await listarPassosComPrint(execucaoId) })
    const { imagem, tipo } = await obterPrint(execucaoId, passoId)
    res.setHeader('Content-Type', tipo)
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).send(imagem)
  },
  async PUT(req, res) {
    const user = requireUser(req)
    await salvarPrint(req.body, user)
    res.json({ ok: true })
  },
  async DELETE(req, res) {
    const user = requireUser(req)
    await removerPrint(req.query.execucaoId, req.query.passoId, user)
    res.json({ ok: true })
  },
})
