import { useJornadas } from '../jornadas.js'

// A descrição é HTML; no card mostramos só o texto (textContent não executa nada).
function resumo(html) {
  return new DOMParser().parseFromString(html, 'text/html').body.textContent.trim()
}

export default function Inicio({ onNavigate }) {
  const { jornadas, loading, error } = useJornadas()

  return (
    <>
      <header className="hero">
        <h1>Jornadas para validação</h1>
        <p>Escolha a jornada que deseja validar.</p>
      </header>

      {loading ? (
        <p className="muted">Carregando jornadas...</p>
      ) : error ? (
        <p className="field-error" role="alert">{error}</p>
      ) : jornadas.length === 0 ? (
        <section className="card">
          <p className="muted list-empty">Nenhuma jornada cadastrada.</p>
          <div className="form-actions">
            <button type="button" className="primary-btn" onClick={() => onNavigate('configuracoes')}>
              Cadastrar jornada
            </button>
          </div>
        </section>
      ) : (
        <ul className="jornada-grid">
          {jornadas.map((j) => (
            <li key={j.id}>
              <button type="button" className="jornada-card"
                onClick={() => onNavigate('validacao', { jornadaId: j.id })}>
                <span className="jornada-card-title">{j.nome}</span>
                <span className="jornada-card-resumo">{resumo(j.descricao)}</span>
                <span className="jornada-card-meta">
                  {j.passos.length} {j.passos.length === 1 ? 'passo' : 'passos'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
