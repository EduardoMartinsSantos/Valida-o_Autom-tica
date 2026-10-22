import { useEffect, useState } from 'react'
import { api } from './api.js'

export const criarJornada = (jornada) => api('jornadas', { method: 'POST', body: jornada }).then((d) => d.jornada)

export const atualizarJornada = (id, jornada) =>
  api(`jornadas/${id}`, { method: 'PUT', body: jornada }).then((d) => d.jornada)

export const excluirJornada = (id) => api(`jornadas/${id}`, { method: 'DELETE' })

export function useJornadas() {
  const [jornadas, setJornadas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let ativo = true
    api('jornadas')
      .then((d) => ativo && setJornadas(d.jornadas))
      .catch((err) => ativo && setError(err.message))
      .finally(() => ativo && setLoading(false))
    return () => { ativo = false }
  }, [])

  return { jornadas, setJornadas, loading, error }
}
