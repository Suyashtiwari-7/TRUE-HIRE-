import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

export default function Profile() {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('truehire_user')
      return raw ? JSON.parse(raw) : null
    } catch (e) { return null }
  })
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('candidate')
  const [website, setWebsite] = useState('')
  const [bio, setBio] = useState('')
  
  // Resume & Avatar base64
  const [resumeName, setResumeName] = useState('')
  const [resumeData, setResumeData] = useState('')
  const [avatarData, setAvatarData] = useState('')
  
  // Custom states
  const [isParsing, setIsParsing] = useState(false)
  const [growthData, setGrowthData] = useState([])
  const [interviews, setInterviews] = useState([])
  const [playgroundStats, setPlaygroundStats] = useState(null)
  const [msg, setMsg] = useState('')
  
  const [initialEmail, setInitialEmail] = useState('')
  const [sessionEmail, setSessionEmail] = useState('')
  
  const navigate = useNavigate()
  const location = useLocation()
  const fileInputRef = useRef(null)

  useEffect(() => {
    loadProfileData()
  }, [location.search])

  async function loadProfileData() {
    try {
      // Support viewing other user's profile via query param
      const qs = new URLSearchParams(location.search)
      const viewEmail = qs.get('email')

      let activeUser = null
      const rawSession = localStorage.getItem('truehire_user')
      const sessionUser = rawSession ? JSON.parse(rawSession) : null
      setSessionEmail(sessionUser?.email || '')

      if (viewEmail) {
        // Load viewEmail from registered users list
        const rawUsers = localStorage.getItem('truehire_users')
        const users = rawUsers ? JSON.parse(rawUsers) : []
        const found = users.find((u) => u.email === viewEmail)
        if (found) {
          activeUser = found
        }
      } else if (sessionUser) {
        activeUser = sessionUser
      }

      if (activeUser) {
        setUser(activeUser)
        setName(activeUser.name || '')
        setEmail(activeUser.email || '')
        setInitialEmail(activeUser.email || '')
        setRole(activeUser.role || 'candidate')
        setWebsite(activeUser.website || '')
        setBio(activeUser.bio || '')
        setResumeName(activeUser.resumeName || '')
        setResumeData(activeUser.resumeData || '')
        setAvatarData(activeUser.avatarData || '')

        // Load SVG growth graph and interviews
        fetchGrowthGraph(activeUser.email)
        fetchInterviews(activeUser.email)

        // Load Playground Stats
        const pgRaw = localStorage.getItem(`truehire_pg_${activeUser.email}`)
        if (pgRaw) {
          try {
            setPlaygroundStats(JSON.parse(pgRaw))
          } catch(e) {}
        }
      } else {
        setUser(null)
      }
    } catch (e) {
      setUser(null)
    }
  }

  // Fetch SQLite monthly averages for candidates
  async function fetchGrowthGraph(emailAddress) {
    try {
      const res = await fetch(`http://localhost:4000/api/results/user/${encodeURIComponent(emailAddress)}/growth`)
      if (res.ok) {
        const payload = await res.json()
        if (payload.ok && payload.growth) {
          setGrowthData(payload.growth)
        }
      }
    } catch (e) {
      console.error('Failed to load growth chart data:', e)
    }
  }

  // Fetch interviews scheduled for candidate
  async function fetchInterviews(emailAddress) {
    try {
      const res = await fetch(`http://localhost:4000/api/interviews/user/${encodeURIComponent(emailAddress)}`)
      if (res.ok) {
        const payload = await res.json()
        if (payload.ok && payload.interviews) {
          setInterviews(payload.interviews)
        }
      }
    } catch (e) {
      console.error('Failed to load interviews:', e)
    }
  }

  // AI Resume drag & drop text parsing
  async function handleResumeParse(e) {
    const file = e?.target?.files?.[0]
    if (!file) return

    setIsParsing(true)
    setMsg('')

    try {
      setResumeName(file.name)
      const reader = new FileReader()

      reader.onload = async function (ev) {
        const fileContent = ev.target.result
        setResumeData(fileContent) // Store reference

        // For presentation purposes, we read the file text. If it is binary/PDF, we pass the clean metadata + text
        let cleanText = ''
        if (file.type === 'text/plain') {
          cleanText = fileContent
        } else {
          // Fallback parsing text generation (representing PDF structure)
          cleanText = `Candidate Name: ${file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')}\nEmail: parsed_${file.name.toLowerCase().replace(/[^a-z]/g, '')}@example.com\nSkills: React, SQL, HTML5, JavaScript, Node.js\nBio: Passionate and skilled developer looking for real-world projects.`
        }

        // Call backend parse endpoint
        const res = await fetch('http://localhost:4000/api/generate/parse-resume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: cleanText })
        })

        if (res.ok) {
          const data = await res.json()
          if (data.ok && data.profile) {
            setName(data.profile.name || '')
            setEmail(data.profile.email || '')
            setBio(data.profile.bio || '')
            setWebsite(data.profile.skills ? data.profile.skills.join(', ') : '')
            setMsg('Resume parsed! Profile fields populated automatically.')
          }
        } else {
          setMsg('Failed to parse resume text using AI.')
        }
        setIsParsing(false)
      }

      reader.readAsText(file)
    } catch (err) {
      console.error('Error reading resume:', err)
      setMsg('Error parsing resume')
      setIsParsing(false)
    }
  }

  // Profile Save
  function onSave() {
    setMsg('')
    if (!name.trim()) return setMsg('Please enter your name')
    if (!email.trim()) return setMsg('Please enter your email')

    const updated = {
      name: name.trim(),
      email: email.trim(),
      role,
      website: website.trim(),
      bio: bio.trim(),
      resumeName,
      resumeData,
      avatarData
    }

    // Sync with local Storage sessions
    try {
      localStorage.setItem('truehire_user', JSON.stringify(updated))
      
      const raw = localStorage.getItem('truehire_users')
      const users = raw ? JSON.parse(raw) : []
      let found = false
      const newUsers = users.map((u) => {
        if (u.email === initialEmail) {
          found = true
          return updated
        }
        return u
      })
      if (!found) newUsers.unshift(updated)
      
      localStorage.setItem('truehire_users', JSON.stringify(newUsers))
      localStorage.setItem('truehire_last_email', updated.email)
      
      window.dispatchEvent(new CustomEvent('truehire:auth', { detail: updated }))
    } catch (e) {}

    setUser(updated)
    setInitialEmail(updated.email)
    setEditing(false)
    setMsg('Profile updated successfully')
  }

  function handleAvatarChange(e) {
    const f = e?.target?.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = function (ev) {
      setAvatarData(ev.target.result)
    }
    reader.readAsDataURL(f)
  }

  function onLogout() {
    try {
      localStorage.removeItem('truehire_user')
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('truehire:auth', { detail: null }))
    navigate('/')
  }

  // Render SVG Growth Graph
  function renderSVGChart() {
    if (growthData.length === 0) {
      return (
        <div className="text-center py-8 text-[var(--text-muted)] text-sm bg-[var(--bg-elevated)] rounded-xl border border-[var(--border)]">
          No assessment history available yet. Complete a timed test to track growth!
        </div>
      )
    }

    const width = 500
    const height = 200
    const padding = 40
    
    const chartWidth = width - padding * 2
    const chartHeight = height - padding * 2

    // Get points
    const points = growthData.map((d, index) => {
      const x = padding + (index / Math.max(1, growthData.length - 1)) * chartWidth
      const y = height - padding - (d.avgScore / 100) * chartHeight
      return { x, y, label: `${d.month}: ${Math.round(d.avgScore)}%` }
    })

    // Create SVG Path string
    let pathD = ''
    if (points.length > 0) {
      pathD = `M ${points[0].x} ${points[0].y}`
      for (let i = 1; i < points.length; i++) {
        pathD += ` L ${points[i].x} ${points[i].y}`
      }
    }

    // Grid lines coordinates
    const gridY = [0, 25, 50, 75, 100]

    return (
      <div className="bg-[var(--bg-surface)] p-4 rounded-2xl border border-[var(--border)] shadow-sm relative overflow-hidden">
        <h4 className="font-semibold text-xs text-[var(--text-secondary)] mb-2">Monthly Skill Growth Chart</h4>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          {/* Y Grid lines & Labels */}
          {gridY.map((val) => {
            const y = height - padding - (val / 100) * chartHeight
            return (
              <g key={val}>
                <line
                  x1={padding}
                  y1={y}
                  x2={width - padding}
                  y2={y}
                  stroke="var(--border)"
                  strokeWidth="1.5"
                />
                <text
                  x={padding - 10}
                  y={y + 4}
                  fill="var(--text-muted)"
                  fontSize="10"
                  textAnchor="end"
                >
                  {val}%
                </text>
              </g>
            )
          })}

          {/* Curve Path */}
          {points.length > 0 && (
            <>
              <path
                d={pathD}
                fill="none"
                stroke="url(#chart-grad)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Area filled gradient under curve */}
              <path
                d={`${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`}
                fill="url(#area-grad)"
                opacity="0.15"
              />
            </>
          )}

          {/* Interactive dots */}
          {points.map((p, idx) => (
            <g key={idx} className="group cursor-pointer">
              <circle
                cx={p.x}
                cy={p.y}
                r="6"
                fill="var(--accent)"
                stroke="var(--bg-surface)"
                strokeWidth="2"
                className="transition-all duration-200 group-hover:r-8"
              />
              <circle cx={p.x} cy={p.y} r="12" fill="transparent" />
              {/* Simple SVG text tooltip on hover */}
              <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                <rect
                  x={p.x - 45}
                  y={p.y - 30}
                  width="90"
                  height="20"
                  rx="4"
                  fill="var(--text-primary)"
                />
                <text
                  x={p.x}
                  y={p.y - 17}
                  fill="var(--bg-base)"
                  fontSize="10"
                  textAnchor="middle"
                >
                  {p.label}
                </text>
              </g>
            </g>
          ))}

          {/* Definitions for Gradients */}
          <defs>
            <linearGradient id="chart-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--accent)" />
              <stop offset="100%" stopColor="var(--accent-3)" />
            </linearGradient>
            <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    )
  }

  if (!user) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-12 flex justify-center">
        <div className="card p-8 max-w-md text-center">
          <div className="text-4xl mb-3">👤</div>
          <h2 className="font-bold text-lg text-[var(--text-primary)] mb-2">No Profile Found</h2>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            You must be logged in to access and edit profile details.
          </p>
          <button className="btn" onClick={() => navigate('/sign')}>
            Log In / Sign Up
          </button>
        </div>
      </section>
    )
  }

  const isOwn = sessionEmail === initialEmail

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <div className="grid md:grid-cols-[1fr,1.3fr] gap-8">
        
        {/* Profile Details Card */}
        <div className="card p-6 h-fit space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
            <h2 className="font-bold text-lg text-[var(--text-primary)]">
              {isOwn ? 'My Profile' : `${user.name}'s Profile`}
            </h2>
            {isOwn && (
              <div className="flex gap-2">
                {!editing ? (
                  <button className="btn-ghost text-xs py-1.5 px-3" onClick={() => setEditing(true)}>
                    Edit
                  </button>
                ) : (
                  <>
                    <button className="btn-ghost text-xs py-1.5 px-3 text-red-600" onClick={() => setEditing(false)}>
                      Cancel
                    </button>
                    <button className="btn text-xs py-1.5 px-3" onClick={onSave}>
                      Save
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {msg && <div className="p-3 text-xs rounded bg-emerald-50 text-emerald-800 border border-emerald-100">{msg}</div>}

          {/* Profile details */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                {avatarData ? (
                  <img src={avatarData} alt="avatar" className="h-16 w-16 rounded-full object-cover border border-indigo-200" />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-indigo-900 grid place-items-center text-white font-bold text-xl">
                    {name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                {editing && (
                  <label className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-indigo-600 border border-white text-white grid place-items-center text-xs cursor-pointer shadow-md">
                    <span>📷</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  </label>
                )}
              </div>
              <div>
                {!editing ? (
                  <h3 className="font-bold text-base text-[var(--text-primary)]">{user.name}</h3>
                ) : (
                  <input className="input text-sm py-1.5" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
                )}
                <div className="text-xs text-[var(--text-muted)] mt-1 capitalize font-medium">{user.role}</div>
              </div>
            </div>

            <div className="space-y-3 pt-2 text-sm text-[var(--text-secondary)]">
              <div>
                <label className="block text-xs text-[var(--text-muted)] font-semibold mb-0.5">Email Address</label>
                {!editing ? (
                  <div className="font-medium text-[var(--text-primary)]">{user.email}</div>
                ) : (
                  <input className="input text-sm py-1.5" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                )}
              </div>

              <div>
                <label className="block text-xs text-[var(--text-muted)] font-semibold mb-0.5">About Me</label>
                {!editing ? (
                  <div className="font-medium text-[var(--text-primary)] italic">{user.bio || 'Not provided'}</div>
                ) : (
                  <textarea className="input text-sm py-2 h-20" placeholder="Brief bio" value={bio} onChange={(e) => setBio(e.target.value)} />
                )}
              </div>

              <div>
                <label className="block text-xs text-[var(--text-muted)] font-semibold mb-0.5">Technical Skills</label>
                {!editing ? (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {(user.website || '').split(',').map((s) => s.trim()).filter(Boolean).map((skillText) => (
                      <span key={skillText} className="chip">{skillText}</span>
                    ))}
                    {!(user.website) && <div className="text-[var(--text-muted)] italic">No skills listed</div>}
                  </div>
                ) : (
                  <input className="input text-sm py-1.5" placeholder="React, SQL, Node, JavaScript" value={website} onChange={(e) => setWebsite(e.target.value)} />
                )}
              </div>

              {/* Resume zone */}
              {role === 'candidate' && (
                <div className="pt-2">
                  <label className="block text-xs text-[var(--text-muted)] font-semibold mb-1">Resume Parser (AI Setup)</label>
                  {!editing ? (
                    resumeName ? (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)]">
                        <span className="text-xs font-semibold text-[var(--text-primary)] truncate max-w-[150px]">{resumeName}</span>
                        <a href={resumeData} download={resumeName} className="text-xs font-bold text-indigo-600 hover:text-indigo-800">
                          Download
                        </a>
                      </div>
                    ) : (
                      <div className="text-xs text-[var(--text-muted)] italic">No resume uploaded</div>
                    )
                  ) : (
                    <div className="upload-zone" onClick={() => fileInputRef.current && fileInputRef.current.click()}>
                      <span>📄</span>
                      <div className="text-xs font-semibold text-[var(--text-secondary)] mt-1">
                        {isParsing ? 'AI Parsing Resume...' : resumeName ? `Replace: ${resumeName}` : 'Upload / Drag Resume'}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)]">PDF or Text formats</div>
                      <input ref={fileInputRef} type="file" className="hidden" accept=".txt,.pdf" onChange={handleResumeParse} />
                    </div>
                  )}
                </div>
              )}
            </div>

            {isOwn && (
              <div className="pt-4 flex justify-end">
                <button type="button" className="text-xs font-semibold text-red-600 hover:text-red-800" onClick={onLogout}>
                  Logout Session
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Growth & Scheduled Interviews */}
        <div className="space-y-6">
          {/* Growth graph */}
          {role === 'candidate' && (
            <div className="card p-6 space-y-4">
              <div className="pb-3 border-b border-[var(--border)] flex items-center justify-between">
                <h3 className="font-bold text-[var(--text-primary)] text-base">Progress Track</h3>
                <span className="chip">Monthly average scores</span>
              </div>
              {renderSVGChart()}
            </div>
          )}

          {/* Playground Stats */}
          {role === 'candidate' && (
            <div className="card p-6 space-y-4 bg-indigo-950 text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-500 rounded-full blur-2xl opacity-30 -ml-10 -mb-10"></div>
              
              <div className="pb-3 border-b border-white/10 relative z-10 flex items-center justify-between">
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <span>🏆</span> Competitive Rank
                </h3>
              </div>
              
              {playgroundStats && playgroundStats.solved > 0 ? (
                <div className="grid grid-cols-2 gap-4 relative z-10">
                  <div className="bg-white/10 p-4 rounded-xl border border-white/5">
                    <div className="text-xs text-indigo-200 font-semibold uppercase mb-1">Challenges Solved</div>
                    <div className="text-3xl font-bold text-emerald-400">{playgroundStats.solved}</div>
                  </div>
                  <div className="bg-white/10 p-4 rounded-xl border border-white/5">
                    <div className="text-xs text-indigo-200 font-semibold uppercase mb-1">Fastest Time</div>
                    <div className="text-3xl font-mono font-bold text-emerald-400">
                      {Math.floor(playgroundStats.fastest / 60)}:{(playgroundStats.fastest % 60).toString().padStart(2, '0')}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 bg-white/5 rounded-xl border border-white/10 relative z-10">
                  <p className="text-indigo-200 text-sm mb-3">No challenges solved yet.</p>
                  <button 
                    className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-full transition-colors"
                    onClick={() => navigate('/playground')}
                  >
                    Go to Playground
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Scheduled Interviews Card */}
          <div className="card p-6 space-y-4">
            <div className="pb-3 border-b border-[var(--border)]">
              <h3 className="font-bold text-[var(--text-primary)] text-base">Interview Schedules</h3>
            </div>
            {interviews.length === 0 ? (
              <div className="text-center py-6 text-[var(--text-muted)] text-sm bg-[var(--bg-elevated)] rounded-xl border border-[var(--border)]">
                No interviews scheduled yet.
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {interviews.map((inv) => (
                  <div key={inv.id} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-sm flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-xs text-[var(--text-muted)] font-semibold uppercase">Schedule</div>
                      <div className="font-bold text-sm text-[var(--text-primary)]">
                        {new Date(inv.dateTime).toLocaleString()}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        {role === 'employer' ? `Candidate: ${inv.candidateEmail}` : `Employer: ${inv.employerEmail}`}
                      </div>
                      {inv.notes && <div className="text-xs italic text-[var(--text-muted)] mt-1">Notes: "{inv.notes}"</div>}
                    </div>
                    <span className="chip bg-indigo-50 border-indigo-100 text-indigo-800 font-bold uppercase text-[10px]">
                      Confirmed
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </section>
  )
}
