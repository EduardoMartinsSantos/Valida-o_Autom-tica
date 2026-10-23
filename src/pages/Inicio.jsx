import { useState } from 'react'
import { api, useCarregar } from '../api.js'
import { statusBateria } from '../baterias.js'

const dataHora = (valor) => new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export default function Inicio({ onNavigate }) {
  const { data: baterias, loading, error } = useCarregar(() => api('baterias').then((d) => d.baterias))
  const [form, setForm] = useState(null) // { gml, abertoEm } quando o formulário está aberto
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function handleCriar(e) {
    e.preventDefault()
    if (!form.gml.trim()) {
      setErro('Informe o número da GML.')
      return
    }
    setErro('')
    setSalvando(true)
    try {
      const { bateria } = await api('baterias', { method: 'POST', body: { gml: form.gml } })
      onNavigate('bateria', { bateriaId: bateria.id })
    } catch (err) {
      setErro(err.message)
      setSalvando(false)
    }
  }

  return (
    <>
      <header className="hero form-header-row">
        <div>
          <h1>Baterias de validação</h1>
          <p>Cada bateria agrupa as validações de uma GML.</p>
        </div>
        {!form && (
          <button type="button" className="primary-btn" onClick={() => setForm({ gml: '', abertoEm: new Date() })}>
            + Adicionar Bateria de Validação
          </button>
        )}
      </header>

      {form && (
        <form className="card" onSubmit={handleCriar} noValidate>
          <h2>Nova bateria de validação</h2>
          <div className="bateria-form">
            <div className="field">
              <label htmlFor="bateria-gml">Número da GML</label>
              <input id="bateria-gml" value={form.gml} autoFocus placeholder="Ex: 123456"
                onChange={(e) => setForm((f) => ({ ...f, gml: e.target.value }))}
                aria-invalid={Boolean(erro)} />
            </div>
            <div className="field">
              <span className="field-label">Data da bateria</span>
              <span className="muted">{dataHora(form.abertoEm)} (registrada ao criar)</span>
            </div>
          </div>
          {erro && <p className="field-error" role="alert">{erro}</p>}
          <div className="form-actions">
            <button type="submit" className="primary-btn" disabled={salvando}>
              {salvando ? 'Criando...' : 'Criar bateria'}
            </button>
            <button type="button" className="btn-limpar" onClick={() => { setForm(null); setErro('') }}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="muted">Carregando baterias...</p>
      ) : error ? (
        <p className="field-error" role="alert">{error}</p>
      ) : baterias.length === 0 ? (
        <section className="card">
          <p className="muted list-empty">Nenhuma bateria de validação criada.</p>
        </section>
      ) : (
        <ul className="jornada-grid">
          {baterias.map((b) => {
            const percentual = b.total ? Math.round((b.concluidas / b.total) * 100) : 0
            const st = statusBateria(b)
            return (
              <li key={b.id}>
                <button type="button" className="jornada-card"
                  onClick={() => onNavigate('bateria', { bateriaId: b.id })}>
                  <span className="titulo-status">
                    <span className="jornada-card-title">GML {b.gml}</span>
                    <span className={`status-badge ${st.className}`}>{st.label}</span>
                  </span>
                  <span className="muted">{dataHora(b.criado_em)} · {b.criado_por}</span>
                  <span className="jornada-card-resumo">
                    {b.concluidas} de {b.total} resolvidas
                    {b.sem_alteracao > 0 && ` (${b.sem_alteracao} sem alteração)`}
                    {b.em_validacao > 0 && ` · ${b.em_validacao} em validação`}
                  </span>
                  <span className="progress progress-sm" aria-hidden="true">
                    <span className="progress-bar" style={{ width: `${percentual}%` }} />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
