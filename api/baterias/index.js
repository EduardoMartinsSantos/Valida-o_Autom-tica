import { route } from '../../server/http.js'
import { requireUser } from '../../server/session.js'
import { criarBateria, listarBaterias } from '../../server/baterias.js'

export default route({
  async GET(req, res) {
    requireUser(req)
    res.json({ baterias: await listarBaterias() })
  },
  async POST(req, res) {
    const user = requireUser(req)
    res.status(201).json({ bateria: await criarBateria(req.body, user) })
  },
})
