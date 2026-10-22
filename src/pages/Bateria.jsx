import { useState } from 'react'
import { api, apiBlob, useCarregar } from '../api.js'
import { useJornadas } from '../jornadas.js'
import { nomeArquivoPdf } from '../pdf.js'
import { escolherDestino, gravar } from '../salvarArquivo.js'

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
  const [ocupado, setOcupado] = useState(null) // id da jornada com ação em andamento

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

  const baixarPdf = (jornada, execucao) => acao(jornada.id, async () => {
    // A janela "Salvar como" abre primeiro: o navegador só a permite logo após o clique.
    const destino = await escolherDestino(nomeArquivoPdf(execucao.jornada_nome, bateria.gml, execucao.concluido_em))
    if (!destino) return
    await gravar(destino, await apiBlob(`execucoes/${execucao.id}`))
  })

  return (
    <>
      <header className="hero">
        <button type="button" className="btn-limpar" onClick={() => onNavigate('inicio')}>← Voltar</button>
        <h1>GML {bateria.gml}</h1>
        <p>Criada em {dataHora(bateria.criado_em)} por {bateria.criado_por}</p>
      </header>

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
              return (
                <li key={jornada.id} className="execucao-item">
                  <div className="execucao-info">
                    <strong>{jornada.nome}</strong>
                    <span className="muted">
                      {!execucao && `${jornada.passos.length} ${jornada.passos.length === 1 ? 'passo' : 'passos'}`}
                      {execucao?.status === 'em_validacao' && `${minha ? 'Você' : quem} · desde ${dataHora(execucao.iniciado_em)}`}
                      {execucao?.status === 'concluida' &&
                        `${quem} · ${dataHora(execucao.concluido_em)} · ${execucao.progresso.concluidos}/${execucao.progresso.total} passos`}
                    </span>
                  </div>
                  <span className={`status-badge ${st.className}`}>{st.label}</span>
                  <div className="row-actions">
                    {!execucao && (
                      <button type="button" className="primary-btn" disabled={desabilitado} onClick={() => iniciar(jornada)}>
                        Iniciar validação
                      </button>
                    )}
                    {execucao?.status === 'em_validacao' && minha && (
                      <>
                        <button type="button" className="primary-btn" disabled={desabilitado}
                          onClick={() => abrirValidacao(jornada.id, execucao.id)}>
                          Continuar
                        </button>
                        <button type="button" className="btn-limpar" disabled={desabilitado}
                          onClick={() => liberar(jornada, execucao)}>
                          Liberar
                        </button>
                      </>
                    )}
                    {execucao?.status === 'concluida' && (
                      <button type="button" className="btn-limpar" disabled={desabilitado}
                        onClick={() => baixarPdf(jornada, execucao)}>
                        Baixar PDF
                      </button>
                    )}
                  </div>
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
