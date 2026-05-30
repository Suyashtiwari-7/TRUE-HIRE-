import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

export default function Sign() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('candidate')
  const [error, setError] = useState('')
  const [mode, setMode] = useState('register')
  const [knownUsers, setKnownUsers] = useState([])
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const q = searchParams.get('mode')
    if (q === 'login') setMode('login')
    try {
      const raw = localStorage.getItem('truehire_users')
      const users = raw ? JSON.parse(raw) : []
      setKnownUsers(users)
      const last = localStorage.getItem('truehire_last_email') || ''
      if (last) setEmail(last)
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function validateEmail(e) { return /\S+@\S+\.\S+/.test(e) }

  function onSubmit(e) {
    e.preventDefault()
    setError('')
    if (mode === 'register') {
      if (!name.trim()) return setError('Please enter your name')
      if (!validateEmail(email)) return setError('Please enter a valid email')
      const user = { name: name.trim(), email: email.trim(), role, website: '' }
      const exists = knownUsers.find(u => u.email === user.email)
      const updated = exists ? knownUsers.map(u => u.email === user.email ? user : u) : [user, ...knownUsers]
      try {
        localStorage.setItem('truehire_users', JSON.stringify(updated))
        localStorage.setItem('truehire_last_email', user.email)
        localStorage.setItem('truehire_user', JSON.stringify(user))
        window.dispatchEvent(new CustomEvent('truehire:auth', { detail: user }))
      } catch {}
      navigate('/dashboard')
    } else {
      if (!validateEmail(email)) return setError('Please enter a valid email')
      const u = knownUsers.find(x => x.email === email)
      if (!u) return setError('No account found for this email. Please register first.')
      try {
        localStorage.setItem('truehire_user', JSON.stringify(u))
        localStorage.setItem('truehire_last_email', u.email)
        window.dispatchEvent(new CustomEvent('truehire:auth', { detail: u }))
      } catch {}
      navigate('/dashboard')
    }
  }

  function toggleMode() { setError(''); setMode(m => m === 'register' ? 'login' : 'register') }
  function loginAs(u) {
    try {
      localStorage.setItem('truehire_user', JSON.stringify(u))
      localStorage.setItem('truehire_last_email', u.email)
      window.dispatchEvent(new CustomEvent('truehire:auth', { detail: u }))
    } catch {}
    navigate('/dashboard')
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-fade-in-up">

        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl text-3xl mb-4 shadow-lg"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            🎓
          </div>
          <h1 className="text-2xl font-extrabold mb-1" style={{ color: 'var(--text-primary)' }}>
            {mode === 'register' ? 'Join True Hire' : 'Welcome back'}
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {mode === 'register'
              ? 'Create your account and get verified today.'
              : 'Sign in to access your dashboard.'}
          </p>
        </div>

        {/* Card */}
        <div className="card p-8 space-y-5">

          {/* Mode toggle */}
          <div
            className="flex rounded-full p-1 text-xs font-semibold"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
          >
            {['register', 'login'].map(m => (
              <button
                key={m}
                type="button"
                onClick={() => { setError(''); setMode(m) }}
                className="flex-1 py-2 rounded-full capitalize transition-all duration-200"
                style={mode === m
                  ? { background: 'var(--accent)', color: '#fff', boxShadow: '0 2px 8px rgba(99,102,241,0.3)' }
                  : { color: 'var(--text-muted)' }
                }
              >
                {m === 'register' ? 'Create Account' : 'Sign In'}
              </button>
            ))}
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
            {error && (
              <div
                className="text-xs px-4 py-3 rounded-xl font-semibold"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}
              >
                ⚠️ {error}
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Full Name
                </label>
                <input
                  className="input"
                  placeholder="Your full name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoFocus
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Email Address
              </label>
              <input
                className="input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus={mode === 'login'}
              />
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                  I am a…
                </label>
                <div className="flex gap-2">
                  {['candidate', 'employer'].map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className="flex-1 py-3 rounded-2xl text-xs font-semibold capitalize transition-all duration-200 border"
                      style={role === r
                        ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)', boxShadow: '0 4px 12px rgba(99,102,241,0.25)' }
                        : { background: 'var(--bg-elevated)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }
                      }
                    >
                      {r === 'candidate' ? '🧑‍💻 Candidate' : '🏢 Employer'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              className="btn w-full py-3.5 text-sm mt-2"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {mode === 'register' ? 'Create my account →' : 'Sign in →'}
            </button>
          </form>

          {/* Quick login remembered accounts */}
          {mode === 'login' && knownUsers.length > 0 && (
            <div className="pt-2">
              <div className="text-[11px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                REMEMBERED ACCOUNTS
              </div>
              <div className="flex flex-col gap-2">
                {knownUsers.map(u => (
                  <button
                    key={u.email}
                    type="button"
                    onClick={() => loginAs(u)}
                    className="chip text-left px-4 py-3 hover:opacity-80 transition-opacity w-full"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="h-6 w-6 rounded-full grid place-items-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: 'var(--accent)' }}
                      >
                        {(u.name || 'U').slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{u.name}</div>
                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{u.email}</div>
                      </div>
                      <span className="ml-auto text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                        style={{
                          background: u.role === 'employer' ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.15)',
                          color: u.role === 'employer' ? 'var(--accent)' : 'var(--accent-3)'
                        }}>
                        {u.role}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  )
}
