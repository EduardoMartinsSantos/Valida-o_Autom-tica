import { route } from '../../server/http.js'
import { requireUser } from '../../server/session.js'
import { criar, listar, parseJornada } from '../../server/jornadas.js'

export default route({
  async GET(req, res) {
    requireUser(req)
    res.json({ jornadas: await listar() })
  },
  async POST(req, res) {
    const user = requireUser(req)
    res.status(201).json({ jornada: await criar(parseJornada(req.body), user) })
  },
})
