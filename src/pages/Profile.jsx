import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

export default function Profile(){
  const [user, setUser] = useState(null)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('candidate')
  const [website, setWebsite] = useState('')
    const [resumeName, setResumeName] = useState('')
    const [resumeData, setResumeData] = useState('')
    const [resumeChanged, setResumeChanged] = useState(false)
    const [avatarName, setAvatarName] = useState('')
    const [avatarData, setAvatarData] = useState('')
    const [avatarChanged, setAvatarChanged] = useState(false)
  const [msg, setMsg] = useState('')
  const [initialEmail, setInitialEmail] = useState('')
  const [sessionEmail, setSessionEmail] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const isOwn = sessionEmail === initialEmail
  const resumeInputRef = useRef(null)

  useEffect(()=>{
    try{
      // support viewing another user's profile via ?email=someone@example.com
      const qs = new URLSearchParams(location.search)
      const viewEmail = qs.get('email')

      if (viewEmail) {
        const rawUsers = localStorage.getItem('truehire_users')
        if (rawUsers){
          try{
            const users = JSON.parse(rawUsers)
            const found = users.find(u => u.email === viewEmail)
            if (found){
              setUser(found)
              setName(found.name || '')
              setEmail(found.email || '')
              setInitialEmail(found.email || '')
              setRole(found.role || 'candidate')
              setWebsite(found.website || '')
              return
            }
          }catch(e){ /* ignore */ }
        }
        // if not found, fallthrough to current session behavior
      }

      const rawSession = localStorage.getItem('truehire_user')
      const sessionUser = rawSession ? JSON.parse(rawSession) : null
      setSessionEmail(sessionUser?.email || '')
      if (rawSession){
        const u = sessionUser
        setUser(u)
        setName(u.name || '')
        setEmail(u.email || '')
        setInitialEmail(u.email || '')
        setRole(u.role || 'candidate')
        setWebsite(u.website || '')
  setResumeName(u.resumeName || '')
  setResumeData(u.resumeData || '')
  setAvatarName(u.avatarName || '')
  setAvatarData(u.avatarData || '')
      } else {
        // fallback: try to load last known user from users list
        const last = localStorage.getItem('truehire_last_email')
        const rawUsers = localStorage.getItem('truehire_users')
        if (last && rawUsers){
          try{
            const users = JSON.parse(rawUsers)
            const found = users.find(u => u.email === last)
            if (found){
              setUser(found)
              setName(found.name || '')
              setEmail(found.email || '')
              setInitialEmail(found.email || '')
              setRole(found.role || 'candidate')
              setWebsite(found.website || '')
              setResumeName(found.resumeName || '')
              setResumeData(found.resumeData || '')
              setAvatarName(found.avatarName || '')
              setAvatarData(found.avatarData || '')
              return
            }
          }catch(e){ /* ignore */ }
        }
        setUser(null)
      }
    }catch(e){ setUser(null) }
  },[])

  function validateEmail(e){
    return /\S+@\S+\.\S+/.test(e)
  }

  function onSave(){
    setMsg('')
    if (!name.trim()) return setMsg('Please enter your name')
    if (!validateEmail(email)) return setMsg('Please enter a valid email')

    const updated = { name: name.trim(), email: email.trim(), role, website: website.trim() }
      if (resumeChanged) {
        updated.resumeName = resumeName || ''
        updated.resumeData = resumeData || ''
      } else {
        // preserve existing resume if present
        try{
          const rawSession = localStorage.getItem('truehire_user')
          const sess = rawSession ? JSON.parse(rawSession) : null
          if (sess && sess.resumeData) { updated.resumeName = sess.resumeName; updated.resumeData = sess.resumeData }
        }catch(e){}
      }
      if (avatarChanged) {
        updated.avatarName = avatarName || ''
        updated.avatarData = avatarData || ''
      } else {
        try{
          const rawSession = localStorage.getItem('truehire_user')
          const sess = rawSession ? JSON.parse(rawSession) : null
          if (sess && sess.avatarData) { updated.avatarName = sess.avatarName; updated.avatarData = sess.avatarData }
        }catch(e){}
      }

    // update current session
    try{ localStorage.setItem('truehire_user', JSON.stringify(updated)) }catch(e){}

    // update saved users list
    try{
      const raw = localStorage.getItem('truehire_users')
      const users = raw ? JSON.parse(raw) : []
      let found = false
      const newUsers = users.map(u => {
        if (u.email === initialEmail) { found = true; return updated }
        return u
      })
      if (!found) newUsers.unshift(updated)
      localStorage.setItem('truehire_users', JSON.stringify(newUsers))
      localStorage.setItem('truehire_last_email', updated.email)
    }catch(e){ /* ignore */ }

    // notify other parts of app
    try{ window.dispatchEvent(new CustomEvent('truehire:auth', { detail: updated })) }catch(e){}

    setUser(updated)
    setInitialEmail(updated.email)
    setEditing(false)
    setResumeChanged(false)
    setAvatarChanged(false)
    setMsg('Profile updated')
  }

  function onFileChange(e){
    const f = e?.target?.files?.[0]
    if (!f) return
    setResumeName(f.name)
    const reader = new FileReader()
    reader.onload = function(ev){
      setResumeData(ev.target.result)
      setResumeChanged(true)
    }
    reader.readAsDataURL(f)
  }

  function removeResume(){
    setResumeName('')
    setResumeData('')
    setResumeChanged(true)
  }

  function onAvatarChange(e){
    const f = e?.target?.files?.[0]
    if (!f) return
    setAvatarName(f.name)
    const reader = new FileReader()
    reader.onload = function(ev){
      setAvatarData(ev.target.result)
      setAvatarChanged(true)
    }
    reader.readAsDataURL(f)
  }

  function removeAvatar(){
    setAvatarName('')
    setAvatarData('')
    setAvatarChanged(true)
  }

  function onLogout(){
    try{ localStorage.removeItem('truehire_user') }catch(e){}
    try{ window.dispatchEvent(new CustomEvent('truehire:auth', { detail: null })) }catch(e){}
    navigate('/')
  }

  async function onDeleteAccount(){
    // double confirm
    const ok = window.confirm('Delete your account? This action is irreversible and will remove your data from the server.')
    if (!ok) return

    try{
      // attempt server delete
      if (user && user.email) {
        const endpoint = `http://localhost:4000/api/users/${encodeURIComponent(user.email)}`
        const resp = await fetch(endpoint, { method: 'DELETE' })
        if (!resp.ok) {
          const txt = await resp.text().catch(()=>null)
          console.error('Failed to delete account on server', resp.status, txt)
          setMsg('Failed to delete account on server')
          return
        }
      }

      // remove local session and user entries
      try{ localStorage.removeItem('truehire_user') }catch(e){}
      try{
        const raw = localStorage.getItem('truehire_users')
        const users = raw ? JSON.parse(raw) : []
        const filtered = users.filter(u => u.email !== (user?.email))
        localStorage.setItem('truehire_users', JSON.stringify(filtered))
      }catch(e){}

      try{ window.dispatchEvent(new CustomEvent('truehire:auth', { detail: null })) }catch(e){}
      setMsg('Account deleted')
      navigate('/')
    }catch(err){
      console.error('Error deleting account', err)
      setMsg('Error deleting account')
    }
  }

  if (!user) return (
    <section className="mx-auto max-w-6xl px-4 py-12 grid place-items-center">
      <div className="card p-6 max-w-md text-center">
        <div className="font-semibold mb-2">No profile found</div>
        <div className="text-sm text-neutral-600 mb-4">You are not signed in. Please sign in or create an account to view your profile.</div>
        <div className="flex items-center justify-center gap-2">
          <button className="btn" onClick={()=>navigate('/sign')}>Sign in / Register</button>
          <button className="btn-ghost" onClick={()=>navigate('/')}>Go home</button>
        </div>
      </div>
    </section>
  )

  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <div className="card p-6 max-w-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">{sessionEmail === initialEmail ? 'My Profile' : (user.name ? `${user.name}'s Profile` : 'Profile')}</h2>
          <div className="flex items-center gap-2">
            {/* If signed-in user is viewing someone else's profile, show a Message button.
                Label varies slightly for employers viewing candidates. */}
            {sessionEmail && user && sessionEmail !== initialEmail && (() => {
              try{
                const raw = localStorage.getItem('truehire_user')
                const sess = raw ? JSON.parse(raw) : null
                const isEmployerViewingCandidate = sess && sess.role === 'employer' && (user.role || 'candidate') === 'candidate'
                const label = isEmployerViewingCandidate ? 'Message candidate' : 'Message'
                return (
                  <button className="btn" onClick={()=>navigate(`/chat?peer=${encodeURIComponent(user.email)}`)}>{label}</button>
                )
              }catch(e){ return null }
            })()}
            {!editing ? (
              // only allow editing if viewing own profile
              (sessionEmail === initialEmail) ? (
                <button className="btn-ghost" onClick={()=>setEditing(true)}>Edit</button>
              ) : null
            ) : (
              <>
                <button className="btn-ghost" onClick={()=>{ setEditing(false); setMsg(''); // reset fields
                  const raw = localStorage.getItem('truehire_user'); if (raw) {
                    const u = JSON.parse(raw); setName(u.name||''); setEmail(u.email||''); setRole(u.role||'candidate'); setWebsite(u.website||''); setResumeName(u.resumeName||''); setResumeData(u.resumeData||'') }
                }}>Cancel</button>
                <button className="btn" onClick={onSave}>Save</button>
              </>
            )}
            <button className="btn-ghost text-red-600" onClick={onLogout}>Logout</button>
            {sessionEmail === initialEmail && (
              <button className="btn-ghost text-red-600" onClick={onDeleteAccount}>Delete account</button>
            )}
          </div>
        </div>

        {msg && <div className="mb-3 text-sm text-green-600">{msg}</div>}

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-neutral-500">Name</div>
              {!editing ? <div className="font-medium">{user.name}</div> : <input className="input" value={name} onChange={e=>setName(e.target.value)} />}
            </div>
            {/* Role badge */}
            <div>
              <div className="text-xs text-neutral-500">Role</div>
              <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
                   style={{background: (role||user.role) === 'candidate' ? '#ecfccb' : '#e0f2fe', color: (role||user.role) === 'candidate' ? '#166534' : '#0369a1'}}>
                {(role||user.role) === 'candidate' ? 'Candidate' : 'Employer'}
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs text-neutral-500">Email</div>
            {!editing ? <div className="font-medium">{user.email}</div> : <input className="input" value={email} onChange={e=>setEmail(e.target.value)} />}
          </div>

          {/* role section moved up into header area */}

          <div>
            <div className="text-xs text-neutral-500">Website</div>
            {!editing ? (
              <div className="font-medium flex items-center gap-3">
                {user.avatarData ? (
                  <img src={user.avatarData} alt="avatar" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-neutral-900 grid place-items-center text-white">{(user.name||'U').slice(0,1)}</div>
                )}
                <div><a className="text-blue-600" href={user.website || '#'} target="_blank" rel="noreferrer">{user.website || 'Not provided'}</a></div>
              </div>
            ) : (
              <input className="input" value={website} onChange={e=>setWebsite(e.target.value)} placeholder="https://your-site.com" />
            )}
          </div>

            <div>
              <div className="text-xs text-neutral-500">Resume / CV</div>
              {!editing ? (
                <div className="font-medium">
                  {user.role === 'candidate' ? (
                    user.resumeData ? (
                      <div className="flex items-center gap-3">
                        <a className="text-blue-600" href={user.resumeData} download={user.resumeName || 'resume'}>Download {user.resumeName || 'resume'}</a>
                            {sessionEmail !== initialEmail && (
                              <a className="text-sm btn-ghost" href={`/chat?peer=${encodeURIComponent(user.email)}`}>Message</a>
                            )}
                            {isOwn && (
                              <button type="button" className="btn-ghost" onClick={() => resumeInputRef.current && resumeInputRef.current.click()}>Upload</button>
                            )}
                      </div>
                    ) : (
                        <div className="flex items-center gap-3">
                          <div>Not provided</div>
                          {isOwn && <button type="button" className="btn-ghost" onClick={() => resumeInputRef.current && resumeInputRef.current.click()}>Upload</button>}
                        </div>
                    )
                  ) : (
                    <div className="text-neutral-500">Resume upload is for candidates only.</div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {role === 'candidate' ? (
                    <>
                      <input type="file" accept=".pdf,.doc,.docx" onChange={onFileChange} />
                      {resumeName && (
                        <div className="flex items-center gap-2">
                          <div className="text-sm">{resumeName}</div>
                          <button className="btn-ghost text-red-600" onClick={removeResume}>Remove</button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-neutral-500">Only candidates can upload a resume.</div>
                  )}
                </div>
              )}
              {/* hidden file input for quick upload */}
              <input ref={resumeInputRef} type="file" accept=".pdf,.doc,.docx" style={{display:'none'}} onChange={async (e)=>{
                const f = e?.target?.files?.[0]; if (!f) return;
                // small client-side size guard (2MB)
                if (f.size > 2 * 1024 * 1024) { setMsg('File too large (max 2MB)'); return }
                const reader = new FileReader()
                reader.onload = function(ev){
                  const data = ev.target.result
                  const updated = { ...(user||{}), resumeName: f.name, resumeData: data }
                  try{ localStorage.setItem('truehire_user', JSON.stringify(updated)) }catch(e){}
                  try{
                    const raw = localStorage.getItem('truehire_users')
                    const users = raw ? JSON.parse(raw) : []
                    let found = false
                    const newUsers = users.map(u => { if (u.email === updated.email) { found = true; return updated } return u })
                    if (!found) newUsers.unshift(updated)
                    localStorage.setItem('truehire_users', JSON.stringify(newUsers))
                  }catch(e){}
                  try{ window.dispatchEvent(new CustomEvent('truehire:auth', { detail: updated })) }catch(e){}
                  setResumeName(f.name); setResumeData(data); setMsg('Resume uploaded')
                }
                reader.readAsDataURL(f)
              }} />
            </div>

          <div>
            <div className="text-xs text-neutral-500">Profile image</div>
            {!editing ? (
              <div className="font-medium">
                {user.avatarData ? (
                  <div className="flex items-center gap-3">
                    <img src={user.avatarData} alt="avatar" className="h-16 w-16 rounded-full object-cover" />
                    {sessionEmail !== initialEmail && (
                      <a className="text-sm btn-ghost" href={`/chat?peer=${encodeURIComponent(user.email)}`}>Message</a>
                    )}
                  </div>
                ) : (
                  'No profile image'
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <input type="file" accept="image/*" onChange={onAvatarChange} />
                {avatarName && (
                  <div className="flex items-center gap-2">
                    <img src={avatarData} alt="preview" className="h-10 w-10 rounded-full object-cover" />
                    <div className="text-sm">{avatarName}</div>
                    <button className="btn-ghost text-red-600" onClick={removeAvatar}>Remove</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
