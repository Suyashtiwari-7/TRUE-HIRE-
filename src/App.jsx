import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import Home from './pages/Home.jsx'
import Jobs from './pages/Jobs.jsx'
import Assessment from './pages/Assessment.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Sign from './pages/Sign.jsx'
import Profile from './pages/Profile.jsx'
import Chat from './pages/Chat.jsx'
import Footer from './components/Footer.jsx'

function Navbar() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const bcRef = useRef(null)

  useEffect(() => {
    function load(){
      try{
        const raw = localStorage.getItem('truehire_user')
        if (raw){
          const parsed = JSON.parse(raw)
          // ensure website field exists
          if (parsed && typeof parsed === 'object' && !('website' in parsed)) parsed.website = ''
          setUser(parsed)
        } else {
          setUser(null)
        }

        // normalize saved users list so profile always has website property
        const rawUsers = localStorage.getItem('truehire_users')
        if (rawUsers){
          try{
            const users = JSON.parse(rawUsers)
            let changed = false
            const normalized = users.map(u => {
              if (!('website' in u)) { changed = true; return { ...u, website: '' } }
              return u
            })
            if (changed) localStorage.setItem('truehire_users', JSON.stringify(normalized))
          }catch(e){ /* ignore */ }
        }
      }catch(e){ setUser(null) }
    }

    load()

    function onAuth(e){
      // custom event detail or fall back to reading storage
      const detailUser = e?.detail
      if (detailUser) setUser(detailUser)
      else load()
    }

    window.addEventListener('truehire:auth', onAuth)
    // storage event for other tabs
    function onStorage(){ load() }

    function updateUnread(){
      try{
        const raw = localStorage.getItem('truehire_messages')
        const msgs = raw ? JSON.parse(raw) : []
        const meRaw = localStorage.getItem('truehire_user')
        const me = meRaw ? JSON.parse(meRaw) : null
        if (!me) { setUnread(0); return }
        const u = msgs.filter(m => m.to === me.email && !m.read).length
        setUnread(u)
      }catch(e){ setUnread(0) }
    }

    updateUnread()
    try{
      if ('BroadcastChannel' in window){
        bcRef.current = new BroadcastChannel('truehire_messages')
        bcRef.current.onmessage = () => { updateUnread(); load() }
      }
    }catch(e){}

    window.addEventListener('storage', onStorage)
    window.addEventListener('storage', updateUnread)
    return () => {
      window.removeEventListener('truehire:auth', onAuth)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('storage', updateUnread)
      try{ if (bcRef.current) bcRef.current.close() }catch(e){}
    }
  }, [])

  function onLogout(){
    try{ localStorage.removeItem('truehire_user') }catch(e){}
    setUser(null)
    navigate('/')
  }
  async function onDeleteAccount(){
    if (!user || !user.email) return
    const ok = window.confirm('Delete your account? This is irreversible and will remove your data from the server.')
    if (!ok) return
    try{
      const resp = await fetch(`http://localhost:4000/api/users/${encodeURIComponent(user.email)}`, { method: 'DELETE' })
      if (!resp.ok) {
        const txt = await resp.text().catch(()=>null)
        console.error('Failed to delete account', resp.status, resp.statusText, txt)
        alert('Failed to delete account on server. See console for details.')
        return
      }
      // remove local session and navigate home
      try{ localStorage.removeItem('truehire_user') }catch(e){}
      setUser(null)
      navigate('/')
    }catch(err){
      console.error('Error deleting account:', err)
      alert('An error occurred while deleting the account. See console for details.')
    }
  }
  const linkBase = 'pill flex items-center gap-2'
  const active = ({ isActive }) => isActive ? 'pill pill-active flex items-center gap-2' : linkBase

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b border-neutral-200">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-neutral-900 grid place-items-center text-white">🎓</div>
          <div className="leading-tight">
            <div className="font-semibold">TRUE HIRE</div>
            <div className="text-xs text-neutral-500 -mt-0.5">Talent over degree</div>
          </div>
        </div>

        <nav className="flex items-center gap-3">
          <NavLink to="/" className={active}>
            <span>🏠</span> <span>Home</span>
          </NavLink>
          <NavLink to="/jobs" className={active}>
            <span>👜</span> <span>Jobs</span>
          </NavLink>
          {user?.role !== 'employer' && (
            <NavLink to="/assessment" className={active}>
              <span>▶️</span> <span>Assessment</span>
            </NavLink>
          )}
          <NavLink to="/dashboard" className={active}>
            <span>📊</span> <span>Dashboard</span>
          </NavLink>
          <NavLink to="/chat" className={active}>
            <span>💬</span> <span>Messages</span>
            {unread > 0 && <span className="ml-2 inline-block text-xs bg-red-600 text-white px-2 py-0.5 rounded">{unread}</span>}
          </NavLink>
        </nav>

        {user ? (
          <div className="relative">
            <button className="chip flex items-center gap-2" onClick={() => setMenuOpen(v => !v)}>
              <div className="h-7 w-7 rounded-full bg-neutral-900 grid place-items-center text-white text-sm">{(user.name||'U').slice(0,1)}</div>
              <div className="text-sm">{user.name}</div>
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-neutral-200 rounded shadow-sm py-2">
                <button className="w-full text-left px-3 py-2 hover:bg-neutral-50" onClick={() => { setMenuOpen(false); navigate('/profile') }}>Profile</button>
                <button className="w-full text-left px-3 py-2 text-red-600 hover:bg-neutral-50" onClick={() => { setMenuOpen(false); onLogout() }}>Logout</button>
                <button className="w-full text-left px-3 py-2 text-red-600 hover:bg-neutral-50" onClick={() => { setMenuOpen(false); onDeleteAccount() }}>Delete account</button>
              </div>
            )}
          </div>
        ) : (
          <NavLink to="/sign" className="btn">Sign in / Login</NavLink>
        )}
      </div>
    </header>
  )
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/assessment" element={<Assessment />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/sign" element={<Sign />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
