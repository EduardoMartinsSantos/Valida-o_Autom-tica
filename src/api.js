import { useEffect, useState } from 'react'

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

// Baixa um arquivo da API (ex.: PDF) como Blob.
export async function apiBlob(path) {
  let res
  try {
    res = await fetch(`/api/${path}`)
  } catch {
    throw new ApiError(0, 'Sem conexão com o servidor.')
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    if (res.status === 401) window.dispatchEvent(new Event(SESSAO_EXPIRADA))
    throw new ApiError(res.status, data.error ?? 'Erro ao baixar o arquivo.')
  }
  return res.blob()
}

// Carrega dados da API com estado de loading/erro e permite recarregar.
export function useCarregar(carregar, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let ativo = true
    setLoading(true)
    carregar()
      .then((d) => { if (ativo) { setData(d); setError('') } })
      .catch((err) => ativo && setError(err.message))
      .finally(() => ativo && setLoading(false))
    return () => { ativo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, versao])

  return { data, loading, error, recarregar: () => setVersao((v) => v + 1) }
}
