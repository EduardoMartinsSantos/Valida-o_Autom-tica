import { useEffect, useRef, useState } from 'react'
import { api, apiBlob, useCarregar } from '../api.js'
import { useJornadas } from '../jornadas.js'
import { comprimirImagem, gerarPdfValidacao } from '../pdf.js'
import RichTextEditor from '../components/RichTextEditor.jsx'

const MAX_PRINT_BYTES = 10 * 1024 * 1024
// Limite do servidor (server/baterias.js).
const MAX_PDF_BYTES = 3 * 1024 * 1024

function blobParaBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function imageFrom(dataTransfer) {
  return [...(dataTransfer?.files ?? [])].find((f) => f.type.startsWith('image/')) ?? null
}

function LampadaIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18h6M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" />
    </svg>
  )
}

function PrintField({ numero, print, enviando, onFile, onRemove }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  function handlePaste(e) {
    if (enviando) return
    const file = imageFrom(e.clipboardData)
    if (!file) return
    e.preventDefault()
    onFile(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    if (enviando) return
    const file = imageFrom(e.dataTransfer)
    if (file) onFile(file)
  }

  if (enviando) return <p className="print-enviando" role="status">Salvando print...</p>

  if (print) {
    return (
      <div className="print-preview">
        <img src={print.url} alt={`Print do passo ${numero}`} />
        <button type="button" className="btn-danger" onClick={onRemove}>Remover print</button>
      </div>
    )
  }

  return (
    <div
      className={`print-dropzone${dragging ? ' dragging' : ''}`}
      tabIndex={0}
      role="group"
      aria-label={`Print do passo ${numero}: clique aqui e cole com Ctrl+V`}
      onPaste={handlePaste}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <span>Clique aqui e cole o print (<kbd>Ctrl</kbd>+<kbd>V</kbd>) ou arraste a imagem.</span>
      <button type="button" className="btn-limpar" onClick={() => inputRef.current.click()}>
        Selecionar arquivo
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          if (e.target.files[0]) onFile(e.target.files[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}

export default function Validacao({ bateriaId, jornadaId, execucaoId, user, onNavigate }) {
  const { jornadas, loading, error } = useJornadas()
  const { data: bateria, loading: carregandoBateria } = useCarregar(
    () => api(`baterias/${bateriaId}`).then((d) => d.bateria),
    [bateriaId],
  )
  const jornada = jornadas.find((j) => j.id === jornadaId)
  // passoId -> { blob, url }
  const [prints, setPrints] = useState({})
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [hintsAbertos, setHintsAbertos] = useState({})
  const [carregandoPrints, setCarregandoPrints] = useState(true)
  const [enviando, setEnviando] = useState({}) // passoId -> true enquanto salva/remove

  const printsRef = useRef(prints)
  printsRef.current = prints
  useEffect(() => () => Object.values(printsRef.current).forEach((p) => URL.revokeObjectURL(p.url)), [])

  // Recupera os prints já salvos desta validação (rascunho no servidor).
  useEffect(() => {
    let ativo = true
    const base = `prints?execucaoId=${encodeURIComponent(execucaoId)}`
    api(base)
      .then(({ passos }) => Promise.all(passos.map(async (passoId) => {
        const blob = await apiBlob(`${base}&passoId=${encodeURIComponent(passoId)}`)
        return [passoId, { blob, url: URL.createObjectURL(blob) }]
      })))
      .then((lista) => {
        if (ativo) setPrints(Object.fromEntries(lista))
        else lista.forEach(([, p]) => URL.revokeObjectURL(p.url))
      })
      .catch((err) => ativo && setStatus(`Não foi possível carregar os prints salvos: ${err.message}`))
      .finally(() => ativo && setCarregandoPrints(false))
    return () => { ativo = false }
  }, [execucaoId])

  if (loading || carregandoBateria || carregandoPrints) return <p className="muted">Carregando validação...</p>

  const voltar = () => onNavigate('bateria', { bateriaId })

  if (!jornada || !bateria) {
    return (
      <section className="card">
        <p className="muted list-empty">{error || 'Jornada ou bateria não encontrada.'}</p>
        <div className="form-actions">
          <button type="button" className="btn-limpar" onClick={voltar}>Voltar</button>
        </div>
      </section>
    )
  }

  const total = jornada.passos.length
  const concluidos = jornada.passos.filter((p) => prints[p.id]).length
  const percentual = total ? Math.round((concluidos / total) * 100) : 0
  const completo = total > 0 && concluidos === total

  const marcarEnvio = (passoId, ativo) => setEnviando((atual) => ({ ...atual, [passoId]: ativo }))

  // Comprime, salva no servidor e só então mostra: o print sobrevive a sair e voltar.
  async function setPrint(passoId, file) {
    if (!file.type.startsWith('image/')) {
      setStatus('O arquivo precisa ser uma imagem.')
      return
    }
    if (file.size > MAX_PRINT_BYTES) {
      setStatus('A imagem passa de 10 MB.')
      return
    }
    setStatus('')
    marcarEnvio(passoId, true)
    try {
      const blob = await comprimirImagem(file)
      await api('prints', {
        method: 'PUT',
        body: { execucaoId, passoId, tipo: blob.type, imagemBase64: await blobParaBase64(blob) },
      })
      setPrints((current) => {
        if (current[passoId]) URL.revokeObjectURL(current[passoId].url)
        return { ...current, [passoId]: { blob, url: URL.createObjectURL(blob) } }
      })
    } catch (err) {
      setStatus(`Print não salvo: ${err.message}`)
    } finally {
      marcarEnvio(passoId, false)
    }
  }

  function toggleHint(passoId) {
    setHintsAbertos((current) => ({ ...current, [passoId]: !current[passoId] }))
  }

  async function removePrint(passoId) {
    setStatus('')
    marcarEnvio(passoId, true)
    try {
      await api(`prints?execucaoId=${encodeURIComponent(execucaoId)}&passoId=${encodeURIComponent(passoId)}`, {
        method: 'DELETE',
      })
      setPrints((current) => {
        const { [passoId]: removed, ...rest } = current
        if (removed) URL.revokeObjectURL(removed.url)
        return rest
      })
    } catch (err) {
      setStatus(`Não foi possível remover o print: ${err.message}`)
    } finally {
      marcarEnvio(passoId, false)
    }
  }

  // Abre o documento como ficará, sem concluir a validação.
  async function handleVisualizar() {
    // A aba abre já no clique; senão o navegador bloqueia como pop-up.
    const aba = window.open('', '_blank')
    setStatus('')
    try {
      const pdf = await gerarPdfValidacao({ jornada, prints, usuario: user, data: new Date(), gml: bateria.gml })
      const url = URL.createObjectURL(pdf)
      if (aba) aba.location.href = url
      else window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      aba?.close()
      console.error(err)
      setStatus('Não foi possível gerar a visualização do documento.')
    }
  }

  async function handleSave() {
    const data = new Date()
    setStatus('')
    setSaving(true)
    try {
      const pdf = await gerarPdfValidacao({ jornada, prints, usuario: user, data, gml: bateria.gml })
      if (pdf.size > MAX_PDF_BYTES) {
        setStatus('O PDF passou de 3 MB. Use prints menores ou recortados.')
        return
      }
      await api(`execucoes/${execucaoId}`, {
        method: 'PUT',
        body: {
          pdfBase64: await blobParaBase64(pdf),
          progresso: {
            passos: jornada.passos.map((p) => ({ id: p.id, titulo: p.titulo, concluido: Boolean(prints[p.id]) })),
          },
        },
      })
      voltar()
    } catch (err) {
      console.error(err)
      setStatus(err.message || 'Não foi possível gerar ou salvar o PDF.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <header className="hero">
        <button type="button" className="btn-limpar" onClick={voltar}>← Voltar</button>
        <h1>{jornada.nome}</h1>
        <p>GML {bateria.gml} · em validação por você</p>
      </header>

      <div className="validacao-layout">
        <div className="validacao-main">
          <section className="card">
            <h2>Descrição</h2>
            {jornada.descricao ? (
              <RichTextEditor value={jornada.descricao} readOnly />
            ) : (
              <p className="muted">
                Sem descrição cadastrada.{' '}
                <button type="button" className="link-btn" onClick={() => onNavigate('configuracoes')}>
                  Cadastrar em Configurações
                </button>
              </p>
            )}
          </section>

          <section className="card">
            <h2>Passos de validação</h2>
            <ol className="validacao-passos">
              {jornada.passos.map((p, i) => (
                <li key={p.id} id={`passo-${p.id}`} className={prints[p.id] ? 'done' : ''}>
                  <div className="validacao-passo-header">
                    <span className="passo-num">{i + 1}</span>
                    <h3>{p.titulo}</h3>
                    {p.hint && (
                      <button type="button" className={`hint-btn${hintsAbertos[p.id] ? ' active' : ''}`}
                        onClick={() => toggleHint(p.id)} title="Ver dica"
                        aria-label={`Dica do passo ${i + 1}`} aria-expanded={Boolean(hintsAbertos[p.id])}
                        aria-controls={`hint-${p.id}`}>
                        <LampadaIcon />
                      </button>
                    )}
                  </div>
                  {p.hint && hintsAbertos[p.id] && (
                    <p id={`hint-${p.id}`} className="validacao-hint">{p.hint}</p>
                  )}
                  <PrintField
                    numero={i + 1}
                    print={prints[p.id]}
                    enviando={Boolean(enviando[p.id])}
                    onFile={(file) => setPrint(p.id, file)}
                    onRemove={() => removePrint(p.id)}
                  />
                </li>
              ))}
            </ol>

            <div className="form-actions">
              <button type="button" className="btn-limpar" onClick={handleVisualizar} disabled={concluidos === 0}>
                Visualizar documento
              </button>
              <button type="button" className="primary-btn" onClick={handleSave}
                disabled={!completo || saving || Object.values(enviando).some(Boolean)}>
                {saving ? 'Salvando...' : 'Finalizar validação'}
              </button>
            </div>
            <p className="muted">
              Os prints ficam salvos: você pode sair e continuar depois.
              {!completo && ' Anexe o print de todos os passos para finalizar.'}
            </p>
            {status && <p className="status" role="status">{status}</p>}
          </section>
        </div>

        <aside className="validacao-aside">
          <section className="card">
            <div className="form-header-row">
              <h2>Progresso</h2>
              <strong>{concluidos} de {total} ({percentual}%)</strong>
            </div>
            <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total}
              aria-valuenow={concluidos} aria-label="Progresso da validação">
              <div className="progress-bar" style={{ width: `${percentual}%` }} />
            </div>
            <ul className="checklist">
              {jornada.passos.map((p, i) => (
                <li key={p.id} className={prints[p.id] ? 'done' : ''}>
                  <a href={`#passo-${p.id}`}>
                    <span className="check" aria-hidden="true">{prints[p.id] ? '✓' : i + 1}</span>
                    <span>{p.titulo}</span>
                    <span className="check-status">{prints[p.id] ? 'Concluído' : 'Pendente'}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </>
  )
}
