import { useNavigate } from 'react-router-dom'
import { useMemo, useState, useEffect } from 'react'

const JOBS = [
  {
    title: 'Frontend Developer (React)',
    company: 'Craftly',
    location: 'Remote / Pune',
    type: 'Full-time',
    tags: ['React', 'TypeScript', 'Tailwind'],
    blurb: 'Build delightful UIs. Degree not required — show us your verified assessment score and a small take-home.',
    accent: '#6366f1',
  },
  {
    title: 'Solar Installation Technician',
    company: 'SunLeaf Energy',
    location: 'Nashik',
    type: 'On-site',
    tags: ['Electrical', 'Safety', 'Field Work'],
    blurb: 'Hands-on green-jobs track. Training provided. Assessments validate practical skills over credentials.',
    accent: '#10b981',
  },
  {
    title: 'Data Associate',
    company: 'InsightOps',
    location: 'Mumbai',
    type: 'Hybrid',
    tags: ['Excel', 'SQL', 'Python'],
    blurb: 'Clean and label datasets. Clear growth path to Data Analyst with skill-verified promotions.',
    accent: '#f59e0b',
  },
  {
    title: 'Full Stack Engineer',
    company: 'DevHouse Labs',
    location: 'Remote',
    type: 'Full-time',
    tags: ['Node.js', 'React', 'PostgreSQL'],
    blurb: 'Ship features end-to-end. We score you on what you build, not where you studied.',
    accent: '#8b5cf6',
  },
]

export default function Jobs() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [skillFilter, setSkillFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [matches, setMatches] = useState([])
  const [loadingMatches, setLoadingMatches] = useState(false)

  // Load user session
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('truehire_user')
      return raw ? JSON.parse(raw) : null
    } catch (e) { return null }
  })
  useEffect(() => {
    // Keep in sync with storage updates
    function sync() {
      try {
        const raw = localStorage.getItem('truehire_user')
        setUser(raw ? JSON.parse(raw) : null)
      } catch (e) {}
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  useEffect(() => {
    if (!user || user.role !== 'candidate') {
      setMatches([])
      return
    }

    async function fetchMatches() {
      setLoadingMatches(true)
      try {
        const res = await fetch('http://localhost:4000/api/generate/match-jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userEmail: user.email,
            skills: user.website || '',
            jobs: JOBS
          })
        })
        if (res.ok) {
          const data = await res.json()
          if (data.ok && Array.isArray(data.matches)) {
            setMatches(data.matches)
          }
        }
      } catch (e) {
        console.error('Failed to fetch job matches:', e)
      }
      setLoadingMatches(false)
    }

    fetchMatches()
  }, [user])

  const skills = useMemo(() => {
    const s = new Set()
    JOBS.forEach(j => j.tags.forEach(t => s.add(t)))
    return Array.from(s)
  }, [])

  const types = useMemo(() => [...new Set(JOBS.map(j => j.type))], [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return JOBS.filter(j => {
      if (skillFilter && !j.tags.some(t => t.toLowerCase() === skillFilter.toLowerCase())) return false
      if (typeFilter && j.type !== typeFilter) return false
      if (!q) return true
      return (
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.tags.some(t => t.toLowerCase().includes(q))
      )
    })
  }, [query, skillFilter, typeFilter])

  return (
    <section className="mx-auto max-w-5xl px-6 py-10 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Verified Job Opportunities
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          All listings value skills over degrees. Complete an assessment to boost your ranking.
        </p>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <input
          className="input flex-1 min-w-48"
          placeholder="🔍 Search by role, company or skill…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <select
          className="chip cursor-pointer px-4 py-3 text-sm"
          style={{ background: 'var(--input-bg)', color: 'var(--text-secondary)' }}
          value={skillFilter}
          onChange={e => setSkillFilter(e.target.value)}
        >
          <option value="">All Skills</option>
          {skills.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          className="chip cursor-pointer px-4 py-3 text-sm"
          style={{ background: 'var(--input-bg)', color: 'var(--text-secondary)' }}
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
        >
          <option value="">All Types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Job cards */}
      <div className="grid gap-4">
        {filtered.length === 0 && (
          <div className="card p-12 text-center" style={{ color: 'var(--text-muted)' }}>
            <div className="text-4xl mb-3">🔍</div>
            <div className="font-semibold">No matching jobs found</div>
            <div className="text-xs mt-1">Try adjusting your search filters</div>
          </div>
        )}
        {filtered.map((j, i) => {
          const originalIndex = JOBS.indexOf(j)
          const jobMatch = matches[originalIndex]

          return (
            <div key={i} className="card p-6 flex items-start justify-between gap-6">
              <div className="flex-1 space-y-3">
                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 items-center">
                  {j.tags.map(t => (
                    <span
                      key={t}
                      className="chip text-[11px] px-3 py-1 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setSkillFilter(t)}
                      title={`Filter by ${t}`}
                    >
                      {t}
                    </span>
                  ))}
                  <span
                    className="chip text-[11px] px-3 py-1"
                    style={{ borderColor: j.accent, color: j.accent, background: `${j.accent}18` }}
                  >
                    {j.type}
                  </span>
                  
                  {jobMatch && (
                    <span
                      className="chip text-[11px] px-3 py-1 border border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 cursor-help relative group"
                      title={jobMatch.reasoning}
                    >
                      ✨ {jobMatch.matchPercent}% Match
                      {/* Tooltip on hover */}
                      <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2.5 bg-neutral-900 text-white text-[10px] font-normal rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20 whitespace-normal leading-normal">
                        {jobMatch.reasoning}
                      </span>
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>{j.title}</h3>
                  <div className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {j.company} · {j.location}
                  </div>
                </div>

                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{j.blurb}</p>
              </div>

              {(!user || user.role !== 'employer') && (
                <button
                  className="btn flex items-center gap-2 shrink-0 self-center text-sm px-6"
                  style={{ background: j.accent, color: '#fff' }}
                  onClick={() => {
                    if (!user) navigate('/sign')
                    else navigate('/assessment')
                  }}
                >
                  Apply ✈️
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Tip card */}
      <div
        className="card p-6"
        style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <div className="font-bold text-sm mb-2" style={{ color: 'var(--text-primary)' }}>Stand out from the crowd</div>
            <ul className="text-xs space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
              <li>✅ Complete the skill assessment to get a verified badge shown on your profile</li>
              <li>✅ Higher scores rank you above other applicants in employer search</li>
              <li>✅ Pass Stage 3 (Hard) to unlock premium listings with higher salaries</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
