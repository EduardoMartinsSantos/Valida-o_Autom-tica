export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

// Monta um handler da Vercel por método HTTP, com tratamento de erro único.
export function route(handlers) {
  return async (req, res) => {
    const handler = handlers[req.method]
    if (!handler) {
      res.setHeader('Allow', Object.keys(handlers).join(', '))
      return res.status(405).json({ error: 'Método não permitido.' })
    }
    // Requisições que alteram dados só aceitam JSON (bloqueia formulários de outros sites).
    if (req.method !== 'GET' && !req.headers['content-type']?.startsWith('application/json')) {
      return res.status(415).json({ error: 'Envie os dados como JSON.' })
    }
    try {
      await handler(req, res)
    } catch (err) {
      if (err instanceof HttpError) return res.status(err.status).json({ error: err.message })
      console.error(err)
      res.status(500).json({ error: 'Erro interno.' })
    }
  }
}
