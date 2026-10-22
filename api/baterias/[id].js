import { route } from '../../server/http.js'
import { requireUser } from '../../server/session.js'
import { obterBateria } from '../../server/baterias.js'

export default route({
  async GET(req, res) {
    requireUser(req)
    res.json({ bateria: await obterBateria(req.query.id) })
  },
})
