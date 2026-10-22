import { useRef, useState } from 'react'
import { atualizarJornada, criarJornada, excluirJornada, useJornadas } from '../jornadas.js'
import RichTextEditor from '../components/RichTextEditor.jsx'

const newId = () => crypto.randomUUID()

const emptyPasso = () => ({ id: newId(), titulo: '', hint: '' })

const emptyDraft = () => ({ id: null, nome: '', descricao: '', passos: [emptyPasso()] })

function validate(draft, jornadas) {
  const errors = {}
  const nome = draft.nome.trim()
  if (!nome) {
    errors.nome = 'Campo obrigatório.'
  } else if (jornadas.some((j) => j.id !== draft.id && j.nome.toLowerCase() === nome.toLowerCase())) {
    errors.nome = 'Já existe uma jornada com esse nome.'
  }
  if (!draft.descricao.trim()) {
    errors.descricao = 'Campo obrigatório.'
  }
  if (draft.passos.length === 0) {
    errors.passos = 'Adicione pelo menos um passo.'
  } else if (draft.passos.some((p) => !p.titulo.trim())) {
    errors.passos = 'Todo passo precisa de um título.'
  }
  return errors
}

export default function Configuracoes() {
  const { jornadas, setJornadas, loading, error } = useJornadas()
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState(null)
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('')
  const [expandedPassoId, setExpandedPassoId] = useState(null)
  // Só o passo recém-adicionado recebe foco; na jornada nova o foco fica no nome.
  const addedPassoIdRef = useRef(null)

  function openDraft(jornada) {
    const next = jornada ? structuredClone(jornada) : emptyDraft()
    setDraft(next)
    setExpandedPassoId(jornada ? null : next.passos[0].id)
    setErrors({})
    setStatus('')
  }

  function updatePassos(updater) {
    setDraft((d) => ({ ...d, passos: updater(d.passos) }))
  }

  function updatePasso(id, field, value) {
    updatePassos((passos) => passos.map((p) => (p.id === id ? { ...p, [field]: value } : p)))
  }

  function addPasso() {
    const passo = emptyPasso()
    addedPassoIdRef.current = passo.id
    updatePassos((passos) => [...passos, passo])
    setExpandedPassoId(passo.id)
  }

  function togglePasso(id) {
    setExpandedPassoId((current) => (current === id ? null : id))
  }

  function movePasso(index, delta) {
    updatePassos((passos) => {
      const next = [...passos]
      const [item] = next.splice(index, 1)
      next.splice(index + delta, 0, item)
      return next
    })
  }

  async function handleSave(e) {
    e.preventDefault()
    const found = validate(draft, jornadas)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      const semTitulo = draft.passos.find((p) => !p.titulo.trim())
      if (semTitulo) setExpandedPassoId(semTitulo.id)
      return
    }

    const dados = {
      nome: draft.nome.trim(),
      descricao: draft.descricao,
      passos: draft.passos.map((p) => ({ ...p, titulo: p.titulo.trim(), hint: p.hint.trim() })),
    }
    setSaving(true)
    try {
      const salva = draft.id ? await atualizarJornada(draft.id, dados) : await criarJornada(dados)
      setJornadas((atual) => (draft.id ? atual.map((j) => (j.id === salva.id ? salva : j)) : [...atual, salva]))
      setStatus(`Jornada "${salva.nome}" salva.`)
      setDraft(null)
    } catch (err) {
      if (err.status === 409) setErrors({ nome: err.message })
      else setStatus(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(jornada) {
    if (!window.confirm(`Excluir a jornada "${jornada.nome}"?`)) return
    try {
      await excluirJornada(jornada.id)
      setJornadas((atual) => atual.filter((j) => j.id !== jornada.id))
      setStatus(`Jornada "${jornada.nome}" excluída.`)
      if (draft?.id === jornada.id) setDraft(null)
    } catch (err) {
      setStatus(err.message)
    }
  }

  return (
    <>
      <header className="hero">
        <h1>Configurações</h1>
        <p>Cadastre as jornadas e o passo a passo de cada uma.</p>
      </header>

      <section className="card">
        <div className="form-header-row">
          <h2>Cadastro de Jornada</h2>
          <button type="button" className="primary-btn" onClick={() => openDraft(null)}>
            Nova jornada
          </button>
        </div>

        {loading ? (
          <p className="muted list-empty">Carregando jornadas...</p>
        ) : error ? (
          <p className="field-error list-empty" role="alert">{error}</p>
        ) : jornadas.length === 0 ? (
          <p className="muted list-empty">Nenhuma jornada cadastrada.</p>
        ) : (
          <ul className="jornada-list">
            {jornadas.map((j) => (
              <li key={j.id} className={`jornada-item${draft?.id === j.id ? ' selected' : ''}`}>
                <div>
                  <strong>{j.nome}</strong>
                  <span className="muted">
                    {j.passos.length} {j.passos.length === 1 ? 'passo' : 'passos'}
                  </span>
                </div>
                <div className="row-actions">
                  <button type="button" className="btn-limpar" onClick={() => openDraft(j)}>
                    Editar
                  </button>
                  <button type="button" className="btn-danger" onClick={() => handleDelete(j)}>
                    Excluir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {status && <p className="status">{status}</p>}
      </section>

      {draft && (
        <form className="card" onSubmit={handleSave} noValidate>
          <h2>{draft.id ? 'Editar jornada' : 'Nova jornada'}</h2>

          <div className="field form-section">
            <label htmlFor="jornada-nome">Nome da Jornada</label>
            <input
              id="jornada-nome"
              value={draft.nome}
              onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))}
              placeholder="Ex: Instalação Solar"
              aria-invalid={Boolean(errors.nome)}
              autoFocus
            />
            {errors.nome && <span className="field-error">{errors.nome}</span>}
          </div>

          <div className="field form-section">
            <label id="jornada-descricao-label">Descrição</label>
            <RichTextEditor
              labelId="jornada-descricao-label"
              value={draft.descricao}
              onChange={(descricao) => setDraft((d) => ({ ...d, descricao }))}
              invalid={Boolean(errors.descricao)}
            />
            {errors.descricao && <span className="field-error">{errors.descricao}</span>}
          </div>

          <div className="form-section">
            <h3>Passo a Passo</h3>
            <ol className="passo-list">
              {draft.passos.map((passo, i) => {
                const expanded = expandedPassoId === passo.id
                const bodyId = `passo-body-${passo.id}`
                return (
                  <li key={passo.id} className={`passo-item${expanded ? ' expanded' : ''}`}>
                    <div className="passo-header">
                      <button type="button" className="passo-toggle" onClick={() => togglePasso(passo.id)}
                        aria-expanded={expanded} aria-controls={bodyId}>
                        <span className="passo-num">{i + 1}</span>
                        <span className={`passo-label${passo.titulo.trim() ? '' : ' muted'}`}>
                          {passo.titulo.trim() || 'Sem título'}
                        </span>
                        <span className="passo-chevron" aria-hidden="true">▾</span>
                      </button>
                      <div className="passo-actions">
                        <button type="button" className="icon-btn" onClick={() => movePasso(i, -1)}
                          disabled={i === 0} aria-label={`Mover passo ${i + 1} para cima`}>↑</button>
                        <button type="button" className="icon-btn" onClick={() => movePasso(i, 1)}
                          disabled={i === draft.passos.length - 1} aria-label={`Mover passo ${i + 1} para baixo`}>↓</button>
                        <button type="button" className="icon-btn"
                          onClick={() => updatePassos((passos) => passos.filter((p) => p.id !== passo.id))}
                          aria-label={`Remover passo ${i + 1}`}>×</button>
                      </div>
                    </div>
                    {expanded && (
                      <div id={bodyId} className="passo-fields">
                        <input
                          className="passo-titulo"
                          value={passo.titulo}
                          onChange={(e) => updatePasso(passo.id, 'titulo', e.target.value)}
                          placeholder="Título do passo"
                          aria-label={`Título do passo ${i + 1}`}
                          autoFocus={addedPassoIdRef.current === passo.id}
                        />
                        <textarea
                          rows={3}
                          value={passo.hint}
                          onChange={(e) => updatePasso(passo.id, 'hint', e.target.value)}
                          placeholder="Hint (descrição do passo)"
                          aria-label={`Hint do passo ${i + 1}`}
                        />
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>
            {errors.passos && <span className="field-error">{errors.passos}</span>}
            <div className="form-actions">
              <button type="button" className="btn-limpar" onClick={addPasso}>
                + Adicionar passo
              </button>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="primary-btn" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar jornada'}
            </button>
            <button type="button" className="btn-limpar" onClick={() => setDraft(null)}>Cancelar</button>
          </div>
        </form>
      )}
    </>
  )
}
