import { useEffect, useState } from 'react'
import { api, SESSAO_EXPIRADA } from './api.js'
import Sidebar from './components/Sidebar.jsx'
import Bateria from './pages/Bateria.jsx'
import Configuracoes from './pages/Configuracoes.jsx'
import Inicio from './pages/Inicio.jsx'
import Login from './pages/Login.jsx'
import Validacao from './pages/Validacao.jsx'

const PAGES = {
  inicio: Inicio,
  configuracoes: Configuracoes,
  bateria: Bateria,
  validacao: Validacao,
}

// Páginas sem item próprio no menu destacam o item de origem.
const MENU_ITEM = { bateria: 'inicio', validacao: 'inicio' }

export default function App() {
  // undefined = verificando sessão; null = deslogado.
  const [user, setUser] = useState(undefined)
  const [route, setRoute] = useState({ page: 'inicio', params: {} })
  const navigate = (page, params = {}) => setRoute({ page, params })

  useEffect(() => {
    api('me').then((d) => setUser(d.user ?? null)).catch(() => setUser(null))
    const expirou = () => setUser(null)
    window.addEventListener(SESSAO_EXPIRADA, expirou)
    return () => window.removeEventListener(SESSAO_EXPIRADA, expirou)
  }, [])

  async function handleLogout() {
    await api('logout', { method: 'POST' }).catch(() => {})
    setUser(null)
    navigate('inicio')
  }

  if (user === undefined) return null
  if (user === null) return <Login onLogin={setUser} />

  // Configurações é só para admin (o servidor também bloqueia as alterações).
  const page = route.page === 'configuracoes' && !user.admin ? 'inicio' : route.page
  const Page = PAGES[page]

  return (
    <div className="app-shell">
      <Sidebar active={MENU_ITEM[page] ?? page} onNavigate={navigate}
        user={user} onLogout={handleLogout} />
      <main className="layout">
        <Page key={JSON.stringify(route)} {...route.params} user={user} onNavigate={navigate} />
      </main>
    </div>
  )
}
