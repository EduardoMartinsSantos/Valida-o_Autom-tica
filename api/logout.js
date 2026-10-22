import { route } from '../server/http.js'
import { clearSession } from '../server/session.js'

export default route({
  async POST(req, res) {
    clearSession(res)
    res.json({ ok: true })
  },
})
