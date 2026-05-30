import { Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import Home from './pages/Home.jsx'
import Jobs from './pages/Jobs.jsx'
import Assessment from './pages/Assessment.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Sign from './pages/Sign.jsx'
import Profile from './pages/Profile.jsx'
import Chat from './pages/Chat.jsx'
import Playground from './pages/Playground.jsx'
import Footer from './components/Footer.jsx'

/* ── Dark / Light Mode Hook ─────────────────────────────── */
function useTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('truehire_theme') || 'light' } catch { return 'light' }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('truehire_theme', theme) } catch {}
  }, [theme])

  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark')
  return { theme, toggle }
}

/* ── Theme Toggle Button ─────────────────────────────────── */
function ThemeToggle({ theme, toggle }) {
  return (
    <button
      type="button"
      onClick={toggle}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      aria-label="Toggle dark/light mode"
      className="relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 hover:scale-110 active:scale-95"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        color: 'var(--text-primary)'
      }}
    >
      <span className="text-base select-none" aria-hidden>
        {theme === 'dark' ? '☀️' : '🌙'}
      </span>
    </button>
  )
}

/* ── Navbar ─────────────────────────────────────────────── */
function Navbar({ user, onLogout, onDeleteAccount, theme, toggleTheme }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const bcRef = useRef(null)

  useEffect(() => {
    function updateUnread() {
      try {
        const raw = localStorage.getItem('truehire_messages')
        const msgs = raw ? JSON.parse(raw) : []
        const meRaw = localStorage.getItem('truehire_user')
        const me = meRaw ? JSON.parse(meRaw) : null
        if (!me) { setUnread(0); return }
        setUnread(msgs.filter(m => m.to === me.email && !m.read).length)
      } catch { setUnread(0) }
    }
    updateUnread()

    try {
      if ('BroadcastChannel' in window) {
        bcRef.current = new BroadcastChannel('truehire_messages')
        bcRef.current.onmessage = updateUnread
      }
    } catch {}

    window.addEventListener('storage', updateUnread)
    return () => {
      window.removeEventListener('storage', updateUnread)
      try { if (bcRef.current) bcRef.current.close() } catch {}
    }
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!menuOpen) return
    const close = () => setMenuOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  const active = ({ isActive }) =>
    isActive ? 'pill pill-active flex items-center gap-2' : 'pill flex items-center gap-2'

  return (
    <header className="sticky top-0 z-30 w-full px-4 pt-4 pb-2">
      <div className="mx-auto max-w-6xl h-14 flex items-center justify-between floating-nav">
        {/* Logo */}
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          aria-label="Go to home"
        >
          <div
            className="h-9 w-9 rounded-full grid place-items-center text-lg font-bold shadow-md"
            style={{ background: 'var(--text-primary)', color: 'var(--bg-base)' }}
          >
            🎓
          </div>
          <div className="leading-tight text-left">
            <div className="font-extrabold text-sm tracking-tight" style={{ color: 'var(--text-primary)' }}>
              TRUE HIRE
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Talent over degree
            </div>
          </div>
        </button>

        {/* Nav Links */}
        <nav className="hidden md:flex items-center gap-1.5">
          <NavLink to="/" className={active}>
            <span>🏠</span><span>Home</span>
          </NavLink>
          <NavLink to="/jobs" className={active}>
            <span>👜</span><span>Jobs</span>
          </NavLink>
          {user?.role !== 'employer' && (
            <NavLink to="/assessment" className={active}>
              <span>▶️</span><span>Assessment</span>
            </NavLink>
          )}
          <NavLink to="/playground" className={active}>
            <span>🎮</span><span>Playground</span>
          </NavLink>
          <NavLink to="/dashboard" className={active}>
            <span>📊</span><span>Dashboard</span>
          </NavLink>
          <NavLink to="/chat" className={active}>
            <span>💬</span><span>Messages</span>
            {unread > 0 && (
              <span className="ml-1 inline-block text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                {unread}
              </span>
            )}
          </NavLink>
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} toggle={toggleTheme} />

          {user ? (
            <div className="relative">
              <button
                type="button"
                className="chip flex items-center gap-2 transition-all duration-200 hover:opacity-80"
                onClick={() => setMenuOpen(v => !v)}
                aria-label="User menu"
              >
                <div
                  className="h-7 w-7 rounded-full grid place-items-center text-white text-xs font-bold"
                  style={{ background: 'var(--accent)' }}
                >
                  {(user.name || 'U').slice(0, 1).toUpperCase()}
                </div>
                <span className="text-xs font-semibold hidden sm:block" style={{ color: 'var(--text-primary)' }}>
                  {user.name}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>▾</span>
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 mt-2 w-52 rounded-2xl shadow-2xl py-2 z-50 overflow-hidden animate-fade-in-up"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    backdropFilter: 'blur(16px)'
                  }}
                  onMouseDown={e => e.stopPropagation()}
                >
                  <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                    <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{user.name}</div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{user.email}</div>
                    <span
                      className="inline-block mt-1 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full"
                      style={{
                        background: user.role === 'employer' ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.15)',
                        color: user.role === 'employer' ? 'var(--accent)' : 'var(--accent-3)'
                      }}
                    >
                      {user.role}
                    </span>
                  </div>
                  <button
                    className="w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors hover:bg-[rgba(0,0,0,0.04)]"
                    style={{ color: 'var(--text-primary)' }}
                    onClick={() => { setMenuOpen(false); navigate('/profile') }}
                  >
                    👤 Profile
                  </button>
                  <button
                    className="w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors hover:bg-[rgba(0,0,0,0.04)]"
                    style={{ color: '#ef4444' }}
                    onClick={() => { setMenuOpen(false); onLogout() }}
                  >
                    🚪 Logout
                  </button>
                  <button
                    className="w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors hover:bg-[rgba(239,68,68,0.06)]"
                    style={{ color: '#ef4444' }}
                    onClick={() => { setMenuOpen(false); onDeleteAccount() }}
                  >
                    🗑️ Delete account
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <NavLink
                to="/sign"
                className="btn text-xs py-2 px-5"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                Sign in
              </NavLink>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

/* ── Pre-login minimal top bar ───────────────────────────── */
function MinimalTopBar({ theme, toggleTheme }) {
  const navigate = useNavigate()
  return (
    <header className="w-full px-6 py-4 flex items-center justify-between">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
      >
        <div
          className="h-9 w-9 rounded-full grid place-items-center text-lg shadow-md"
          style={{ background: 'var(--text-primary)', color: 'var(--bg-base)' }}
        >
          🎓
        </div>
        <div className="leading-tight">
          <div className="font-extrabold text-sm tracking-tight" style={{ color: 'var(--text-primary)' }}>TRUE HIRE</div>
          <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Talent over degree</div>
        </div>
      </button>
      <div className="flex items-center gap-3">
        <ThemeToggle theme={theme} toggle={toggleTheme} />
        <NavLink to="/sign" className="btn text-xs py-2 px-5" style={{ background: 'var(--accent)', color: '#fff' }}>
          Sign in →
        </NavLink>
      </div>
    </header>
  )
}

/* ── Root App ─────────────────────────────────────────────── */
export default function App() {
  const { theme, toggle: toggleTheme } = useTheme()
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('truehire_user')
      return raw ? JSON.parse(raw) : null
    } catch (e) { return null }
  })

  // Load user from storage
  useEffect(() => {
    function load() {
      try {
        const raw = localStorage.getItem('truehire_user')
        if (raw) {
          const parsed = JSON.parse(raw)
          if (parsed && typeof parsed === 'object' && !('website' in parsed)) parsed.website = ''
          setUser(parsed)
        } else {
          setUser(null)
        }

        // Normalize users list
        const rawUsers = localStorage.getItem('truehire_users')
        if (rawUsers) {
          try {
            const users = JSON.parse(rawUsers)
            let changed = false
            const normalized = users.map(u => {
              if (!('website' in u)) { changed = true; return { ...u, website: '' } }
              return u
            })
            if (changed) localStorage.setItem('truehire_users', JSON.stringify(normalized))
          } catch {}
        }
      } catch { setUser(null) }
    }

    load()

    function onAuth(e) {
      const d = e?.detail
      if (d) setUser(d)
      else load()
    }

    window.addEventListener('truehire:auth', onAuth)
    window.addEventListener('storage', load)
    return () => {
      window.removeEventListener('truehire:auth', onAuth)
      window.removeEventListener('storage', load)
    }
  }, [])

  function onLogout() {
    try { localStorage.removeItem('truehire_user') } catch {}
    setUser(null)
    window.location.href = '/'
  }

  async function onDeleteAccount() {
    if (!user?.email) return
    const ok = window.confirm('Delete your account? This is irreversible.')
    if (!ok) return
    try {
      const resp = await fetch(`http://localhost:4000/api/users/${encodeURIComponent(user.email)}`, { method: 'DELETE' })
      if (!resp.ok) {
        alert('Failed to delete account on server.')
        return
      }
      try { localStorage.removeItem('truehire_user') } catch {}
      setUser(null)
      window.location.href = '/'
    } catch (err) {
      console.error('Error deleting account:', err)
      alert('An error occurred. See console for details.')
    }
  }

  const [globalBan, setGlobalBan] = useState(false)
  const [globalBanTimeRemaining, setGlobalBanTimeRemaining] = useState(0)

  useEffect(() => {
    if (!user || !user.email) {
      setGlobalBan(false)
      setGlobalBanTimeRemaining(0)
      return
    }

    async function checkBan() {
      try {
        const res = await fetch(`http://localhost:4000/api/results/user/${encodeURIComponent(user.email)}/ban-status`)
        if (res.ok) {
          const data = await res.json()
          if (data.banned) {
            setGlobalBan(true)
            setGlobalBanTimeRemaining(Math.ceil(data.remainingMs / 1000))
          } else {
            setGlobalBan(false)
            setGlobalBanTimeRemaining(0)
          }
        }
      } catch (e) {
        console.error('Failed to query ban status from server:', e)
      }
    }

    checkBan()
  }, [user])

  useEffect(() => {
    if (globalBan && globalBanTimeRemaining > 0) {
      const interval = setInterval(() => {
        setGlobalBanTimeRemaining((t) => {
          if (t <= 1) {
            setGlobalBan(false)
            clearInterval(interval)
            return 0
          }
          return t - 1
        })
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [globalBan, globalBanTimeRemaining])

  function formatBanTime(seconds) {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0')
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      {globalBan && (
        <div className="dark-starry-bg fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="flex flex-col items-center max-w-lg text-center space-y-8 animate-orb-pulse">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-white mb-1">True Proctor Lock</h2>
              <p className="text-xs text-neutral-400">Security Protocol Active</p>
            </div>

            {/* Glowing Circular Orb */}
            <div className="glass-orb">
              <div className="orb-progress-ring" />
              <div 
                className="orb-progress-ring-glow"
                style={{
                  transform: `rotate(${(globalBanTimeRemaining / 86400) * 360}deg)`,
                  transition: 'transform 1s linear'
                }}
              />
              
              <div className="orb-inner-content">
                <div className="text-xs text-neutral-400 font-semibold mb-1">⏳ Time to Unlock</div>
                <div className="text-4xl font-bold tracking-tight font-mono text-white mb-2">
                  {formatBanTime(globalBanTimeRemaining)}
                </div>
                <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                  98% Integrity Score
                </span>
              </div>
            </div>

            {/* Violation day-style indicators */}
            <div className="space-y-4">
              <div className="text-xs text-neutral-400 font-semibold">Proctor Violation Trigger Logs</div>
              <div className="flex justify-center gap-3">
                {[
                  { key: 'T', name: 'Tab Hide', active: (() => {
                    try {
                      const logs = JSON.parse(localStorage.getItem(`truehire_warn_log_${user?.email}`) || '[]');
                      return logs.some(l => l.type === 'tab-hidden' || l.type === 'window-blur' || l.type === 'Looked away from screen');
                    } catch(e) { return false; }
                  })() },
                  { key: 'M', name: 'Mic Voice', active: (() => {
                    try {
                      const logs = JSON.parse(localStorage.getItem(`truehire_warn_log_${user?.email}`) || '[]');
                      return logs.some(l => l.type === 'Speaking / Voice noise detected');
                    } catch(e) { return false; }
                  })() },
                  { key: 'C', name: 'Camera Covered', active: (() => {
                    try {
                      const logs = JSON.parse(localStorage.getItem(`truehire_warn_log_${user?.email}`) || '[]');
                      return logs.some(l => l.type === 'No candidate detected' || l.type === 'Camera covered / too dark');
                    } catch(e) { return false; }
                  })() },
                  { key: 'P', name: 'Phone Usage', active: (() => {
                    try {
                      const logs = JSON.parse(localStorage.getItem(`truehire_warn_log_${user?.email}`) || '[]');
                      return logs.some(l => l.type === 'Cell phone / laptop detected');
                    } catch(e) { return false; }
                  })() },
                  { key: 'F', name: 'Face Away', active: (() => {
                    try {
                      const logs = JSON.parse(localStorage.getItem(`truehire_warn_log_${user?.email}`) || '[]');
                      return logs.some(l => l.type === 'Looked away from screen');
                    } catch(e) { return false; }
                  })() },
                  { key: 'S', name: 'Second Person', active: (() => {
                    try {
                      const logs = JSON.parse(localStorage.getItem(`truehire_warn_log_${user?.email}`) || '[]');
                      return logs.some(l => l.type === 'Multiple people detected');
                    } catch(e) { return false; }
                  })() }
                ].map((item, idx) => (
                  <div 
                    key={idx} 
                    className={`status-circle-indicator ${item.active ? 'status-circle-indicator-active' : ''}`}
                    title={item.name}
                  >
                    <span>{item.key}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-neutral-500 max-w-sm mx-auto leading-relaxed">
                Highlighting violations recorded by TensorFlow & Audio Analyser. Avoid tab switching, secondary devices, or leaving camera view on retakes.
              </p>
            </div>
            
            <button 
              type="button" 
              className="btn text-xs bg-white text-neutral-900 shadow-xl hover:bg-neutral-100"
              onClick={onLogout}
            >
              Log Out Session
            </button>
          </div>
        </div>
      )}

      {user ? (
        <Navbar
          user={user}
          onLogout={onLogout}
          onDeleteAccount={onDeleteAccount}
          theme={theme}
          toggleTheme={toggleTheme}
        />
      ) : (
        <MinimalTopBar theme={theme} toggleTheme={toggleTheme} />
      )}

      <main className="flex-1">
        <Routes>
          <Route path="/"           element={<Home user={user} />} />
          <Route path="/jobs"       element={<Jobs />} />
          <Route path="/assessment" element={<Assessment />} />
          <Route path="/dashboard"  element={<Dashboard />} />
          <Route path="/profile"    element={<Profile />} />
          <Route path="/chat"       element={<Chat />} />
          <Route path="/playground" element={<Playground />} />
          <Route path="/sign"       element={<Sign />} />
        </Routes>
      </main>

      <Footer />
    </div>
  )
}
