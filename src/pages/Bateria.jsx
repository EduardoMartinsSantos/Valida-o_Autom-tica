import { useState } from 'react'
import { api, apiBlob, useCarregar } from '../api.js'
import { gerarZipBateria, nomePasta, statusBateria } from '../baterias.js'
import { useJornadas } from '../jornadas.js'
import { nomeArquivoPdf } from '../pdf.js'
import { escolherDestino, gravar, ZIP } from '../salvarArquivo.js'

const dataHora = (valor) => new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

const STATUS = {
  pendente: { label: 'Pendente', className: 'status-pendente' },
  em_validacao: { label: 'Em validação', className: 'status-andamento' },
  concluida: { label: 'Concluída', className: 'status-concluida' },
}

export default function Bateria({ bateriaId, user, onNavigate }) {
  const { data: bateria, loading, error, recarregar } = useCarregar(
    () => api(`baterias/${bateriaId}`).then((d) => d.bateria),
    [bateriaId],
  )
  const { jornadas, loading: carregandoJornadas, error: erroJornadas } = useJornadas()
  const [status, setStatus] = useState('')
  const [ocupado, setOcupado] = useState(null) // jornada (ou 'pasta'/'link') com ação em andamento
  const [link, setLink] = useState('')

  if (loading || carregandoJornadas) return <p className="muted">Carregando bateria...</p>
  if (error || erroJornadas || !bateria) {
    return (
      <section className="card">
        <p className="field-error list-empty" role="alert">{error || erroJornadas}</p>
        <div className="form-actions">
          <button type="button" className="btn-limpar" onClick={() => onNavigate('inicio')}>Voltar</button>
        </div>
      </section>
    )
  }

  const linhas = jornadas.map((jornada) => ({
    jornada,
    execucao: bateria.execucoes.find((e) => e.jornada_id === jornada.id) ?? null,
  }))
  const concluidas = linhas.filter((l) => l.execucao?.status === 'concluida').length
  const percentual = linhas.length ? Math.round((concluidas / linhas.length) * 100) : 0
  const stBateria = statusBateria({ link_pasta: bateria.link_pasta, total: linhas.length, concluidas })
  const fechada = Boolean(bateria.link_pasta)

  const abrirValidacao = (jornadaId, execucaoId) =>
    onNavigate('validacao', { bateriaId, jornadaId, execucaoId })

  async function acao(jornadaId, fn) {
    setStatus('')
    setOcupado(jornadaId)
    try {
      await fn()
    } catch (err) {
      setStatus(err.message)
      recarregar()
    } finally {
      setOcupado(null)
    }
  }

  const iniciar = (jornada) => acao(jornada.id, async () => {
    const { execucao } = await api('execucoes', {
      method: 'POST',
      body: { bateriaId, jornadaId: jornada.id },
    })
    abrirValidacao(jornada.id, execucao.id)
  })

  const liberar = (jornada, execucao) => {
    if (!window.confirm(`Liberar a validação de "${jornada.nome}"? Ela volta para Pendente.`)) return
    acao(jornada.id, async () => {
      await api(`execucoes/${execucao.id}`, { method: 'DELETE' })
      recarregar()
    })
  }

  const reabrir = (jornada, execucao) => {
    if (!window.confirm(`Reabrir a validação de "${jornada.nome}"? Ela volta para "Em validação" no seu nome; `
      + 'os prints continuam e o PDF será gerado de novo ao finalizar.')) return
    acao(jornada.id, async () => {
      await api(`execucoes/${execucao.id}`, { method: 'PATCH' })
      abrirValidacao(jornada.id, execucao.id)
    })
  }

  const baixarPdf = (jornada, execucao) => acao(jornada.id, async () => {
    // A janela "Salvar como" abre primeiro: o navegador só a permite logo após o clique.
    const destino = await escolherDestino(nomeArquivoPdf(execucao.jornada_nome, bateria.gml, execucao.concluido_em))
    if (!destino) return
    await gravar(destino, await apiBlob(`execucoes/${execucao.id}`))
  })

  const baixarPasta = () => acao('pasta', async () => {
    const destino = await escolherDestino(`${nomePasta(bateria.gml)}.zip`, ZIP)
    if (!destino) return
    await gravar(destino, await gerarZipBateria(bateria))
  })

  function salvarLink(e) {
    e.preventDefault()
    if (!window.confirm('Salvar o link e APAGAR do sistema os PDFs e prints desta bateria?\n\n'
      + 'Confirme que a pasta já foi enviada ao SharePoint.')) return
    acao('link', async () => {
      await api(`baterias/${bateria.id}`, { method: 'PUT', body: { linkPasta: link } })
      setLink('')
      recarregar()
    })
  }

  return (
    <>
      <header className="hero">
        <button type="button" className="btn-limpar" onClick={() => onNavigate('inicio')}>← Voltar</button>
        <div className="titulo-status">
          <h1>GML {bateria.gml}</h1>
          <span className={`status-badge ${stBateria.className}`}>{stBateria.label}</span>
        </div>
        <p>Criada em {dataHora(bateria.criado_em)} por {bateria.criado_por}</p>
      </header>

      {stBateria.id === 'aguardando_upload' && (
        <section className="card card-destaque">
          <h2>Pasta da bateria</h2>
          <ol className="passos-upload">
            <li>Baixe a pasta com os PDFs de todas as jornadas.</li>
            <li>Envie a pasta para o SharePoint.</li>
            <li>Cole aqui o link da pasta e salve. Os PDFs e prints serão apagados do sistema.</li>
          </ol>
          <div className="form-actions">
            <button type="button" className="primary-btn" onClick={baixarPasta} disabled={ocupado === 'pasta'}>
              {ocupado === 'pasta' ? 'Gerando pasta...' : 'Baixar pasta (.zip)'}
            </button>
          </div>
          <form className="link-form" onSubmit={salvarLink}>
            <div className="field">
              <label htmlFor="link-pasta">Link da pasta no SharePoint</label>
              <input id="link-pasta" type="url" required placeholder="https://..."
                value={link} onChange={(e) => setLink(e.target.value)} />
            </div>
            <button type="submit" className="primary-btn" disabled={!link.trim() || ocupado === 'link'}>
              {ocupado === 'link' ? 'Salvando...' : 'Salvar link'}
            </button>
          </form>
        </section>
      )}

      {fechada && (
        <section className="card">
          <h2>Pasta da bateria</h2>
          <p>
            <a href={bateria.link_pasta} target="_blank" rel="noopener noreferrer" className="link-pasta">
              Abrir pasta no SharePoint
            </a>
          </p>
          <p className="muted">
            Link salvo em {dataHora(bateria.finalizada_em)} por {bateria.finalizada_por}.
            Os PDFs e prints foram removidos do sistema.
          </p>
        </section>
      )}

      <section className="card">
        <div className="form-header-row">
          <h2>Validações</h2>
          <strong>{concluidas} de {linhas.length} concluídas ({percentual}%)</strong>
        </div>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={linhas.length}
          aria-valuenow={concluidas} aria-label="Validações concluídas">
          <div className="progress-bar" style={{ width: `${percentual}%` }} />
        </div>

        {linhas.length === 0 ? (
          <p className="muted">Nenhuma jornada cadastrada. Cadastre em Configurações.</p>
        ) : (
          <ul className="execucao-list">
            {linhas.map(({ jornada, execucao }) => {
              const st = STATUS[execucao?.status ?? 'pendente']
              const minha = execucao?.responsavel_email === user.email
              const quem = execucao && (execucao.responsavel_nome ?? execucao.responsavel_email)
              const desabilitado = ocupado === jornada.id
              // Ação ao clicar na linha, conforme o status.
              const abrir =
                !execucao && !fechada ? { titulo: 'Clique para iniciar a validação', fn: () => iniciar(jornada) }
                : execucao?.status === 'em_validacao' && minha
                  ? { titulo: 'Clique para continuar a validação', fn: () => abrirValidacao(jornada.id, execucao.id) }
                : execucao?.status === 'concluida' && !fechada
                  ? { titulo: 'Clique para reabrir a validação', fn: () => reabrir(jornada, execucao) }
                : null
              return (
                <li key={jornada.id} className="execucao-item">
                  <button type="button" className="execucao-abrir" onClick={abrir?.fn}
                    disabled={!abrir || desabilitado} title={abrir?.titulo}>
                    <span className="execucao-info">
                      <strong>{jornada.nome}</strong>
                      <span className="muted">
                        {!execucao && `${jornada.passos.length} ${jornada.passos.length === 1 ? 'passo' : 'passos'}`}
                        {execucao?.status === 'em_validacao' && `${minha ? 'Você' : quem} · desde ${dataHora(execucao.iniciado_em)}`}
                        {execucao?.status === 'concluida' &&
                          `${quem} · ${dataHora(execucao.concluido_em)} · ${execucao.progresso.concluidos}/${execucao.progresso.total} passos`}
                      </span>
                    </span>
                    <span className={`status-badge ${st.className}`}>{st.label}</span>
                  </button>
                  {((execucao?.status === 'em_validacao' && minha) || (execucao?.status === 'concluida' && !fechada)) && (
                    <div className="row-actions">
                      {execucao.status === 'em_validacao' ? (
                        <button type="button" className="btn-limpar" disabled={desabilitado}
                          onClick={() => liberar(jornada, execucao)}>
                          Liberar
                        </button>
                      ) : (
                        <button type="button" className="btn-limpar" disabled={desabilitado}
                          onClick={() => baixarPdf(jornada, execucao)}>
                          Baixar PDF
                        </button>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {status && <p className="status" role="status">{status}</p>}
      </section>
    </>
  )
}
