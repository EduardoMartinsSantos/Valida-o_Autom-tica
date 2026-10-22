export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export const SESSAO_EXPIRADA = 'sessao-expirada'

export async function api(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(`/api/${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Sem conexão com o servidor.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401 && path !== 'login') window.dispatchEvent(new Event(SESSAO_EXPIRADA))
    throw new ApiError(res.status, data.error ?? 'Erro ao falar com o servidor.')
  }
  return data
}
