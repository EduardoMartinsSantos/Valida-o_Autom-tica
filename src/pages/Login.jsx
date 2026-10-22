import { useState } from 'react'
import { api } from '../api.js'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { user } = await api('login', { method: 'POST', body: { email, password } })
      onLogin(user)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <form className="card login-card" onSubmit={handleSubmit}>
        <h1>Validação Automática</h1>
        <p className="muted">Entre com seu e-mail e senha do Mops-Escala.</p>
        <div className="field">
          <label htmlFor="login-email">E-mail</label>
          <input id="login-email" type="email" autoComplete="username" required autoFocus
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="login-senha">Senha</label>
          <input id="login-senha" type="password" autoComplete="current-password" required
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <button type="submit" className="primary-btn" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
