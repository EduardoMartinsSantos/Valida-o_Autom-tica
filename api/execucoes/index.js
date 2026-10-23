import { route } from '../../server/http.js'
import { requireUser } from '../../server/session.js'
import { iniciarExecucao, marcarSemAlteracao } from '../../server/baterias.js'

export default route({
  async POST(req, res) {
    const user = requireUser(req)
    // semAlteracao: true marca a jornada como "sem alteração" em vez de iniciar a validação.
    const execucao = req.body?.semAlteracao === true
      ? await marcarSemAlteracao(req.body, user)
      : await iniciarExecucao(req.body, user)
    res.status(201).json({ execucao })
  },
})
