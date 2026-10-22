import { route } from '../server/http.js'
import { requireUser } from '../server/session.js'

export default route({
  async GET(req, res) {
    const { id, name, email, admin } = requireUser(req)
    res.json({ user: { id, name, email, admin: admin === true } })
  },
})
