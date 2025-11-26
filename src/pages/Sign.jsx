import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

export default function Sign(){
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('candidate')
  const [error, setError] = useState('')
  const [mode, setMode] = useState('register')
  const [knownUsers, setKnownUsers] = useState([])
  const [lastEmail, setLastEmail] = useState('')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(()=>{
    const q = searchParams.get('mode')
    if (q === 'login') setMode('login')
    try{
      const raw = localStorage.getItem('truehire_users')
      const users = raw ? JSON.parse(raw) : []
      setKnownUsers(users)
      const last = localStorage.getItem('truehire_last_email') || ''
      setLastEmail(last)
      if (last) setEmail(last)
    }catch(e){ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])

  function validateEmail(e){
    return /\S+@\S+\.\S+/.test(e)
  }

  function onSubmit(e){
    e.preventDefault()
    setError('')
    if (mode === 'register'){
      if (!name.trim()) return setError('Please enter your name')
      if (!validateEmail(email)) return setError('Please enter a valid email')
      const user = { name: name.trim(), email: email.trim(), role }
      // append to known users if not exists
      const exists = knownUsers.find(u => u.email === user.email)
      const updated = exists ? knownUsers.map(u => u.email === user.email ? user : u) : [user, ...knownUsers]
  try{ localStorage.setItem('truehire_users', JSON.stringify(updated)); localStorage.setItem('truehire_last_email', user.email) }catch(e){}
  try{ localStorage.setItem('truehire_user', JSON.stringify(user)); window.dispatchEvent(new CustomEvent('truehire:auth', { detail: user })) }catch(e){}
      navigate('/dashboard')
    } else {
      // login by email - require known user
      if (!validateEmail(email)) return setError('Please enter a valid email')
      const u = knownUsers.find(x => x.email === email)
      if (!u) return setError('No account found for this email')
      try{ localStorage.setItem('truehire_user', JSON.stringify(u)); localStorage.setItem('truehire_last_email', u.email); window.dispatchEvent(new CustomEvent('truehire:auth', { detail: u })) }catch(e){}
      navigate('/dashboard')
    }
  }

  function toggleMode(){
    setError('')
    setMode(m => m === 'register' ? 'login' : 'register')
  }

  function loginAs(u){
    try{ localStorage.setItem('truehire_user', JSON.stringify(u)); localStorage.setItem('truehire_last_email', u.email) }catch(e){}
    navigate('/dashboard')
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 grid place-items-center">
      <div className="card w-full max-w-2xl p-8">
        <div className="flex items-center gap-2 mb-2">
          <span>↪️</span>
          <h2 className="font-semibold text-lg">{mode === 'register' ? 'Create account' : 'Login'}</h2>
        </div>
        <div className="mb-4 text-sm text-neutral-600">
          {mode === 'register' ? (
            <span>Already have an account? <button type="button" className="text-blue-600" onClick={toggleMode}>Login</button></span>
          ) : (
            <span>New here? <button type="button" className="text-blue-600" onClick={toggleMode}>Create account</button></span>
          )}
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          {error && <div className="text-sm text-red-600">{error}</div>}

          {mode === 'register' && (
            <div>
              <label className="block text-sm mb-1">Full Name</label>
              <input className="input" placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} />
            </div>
          )}


          <div>
            <label className="block text-sm mb-1">Email</label>
            <input className="input" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} />
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-sm mb-2">Role</label>
              <div className="flex gap-2">
                <button type="button" className={"pill " + (role==='candidate' ? 'pill-active' : '')} onClick={()=>setRole('candidate')}>Candidate</button>
                <button type="button" className={"pill " + (role==='employer' ? 'pill-active' : '')} onClick={()=>setRole('employer')}>Employer</button>
              </div>
            </div>
          )}

          <button type="submit" className="btn w-full">{mode === 'register' ? 'Create account' : 'Login'}</button>

          {mode === 'login' && knownUsers.length > 0 && (
            <div className="mt-3 text-sm">
              <div className="font-medium mb-2">Remembered accounts</div>
              <div className="flex flex-col gap-2">
                {knownUsers.map(u => (
                  <button key={u.email} type="button" className="chip text-left" onClick={() => loginAs(u)} title="Click to login as this user">{u.email}</button>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>
    </section>
  )
}
