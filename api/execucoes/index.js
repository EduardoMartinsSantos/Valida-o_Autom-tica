import { route } from '../../server/http.js'
import { requireUser } from '../../server/session.js'
import { iniciarExecucao } from '../../server/baterias.js'

export default route({
  async POST(req, res) {
    const user = requireUser(req)
    res.status(201).json({ execucao: await iniciarExecucao(req.body, user) })
  },
})
