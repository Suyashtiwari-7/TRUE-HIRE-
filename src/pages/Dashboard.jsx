import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [results, setResults] = useState([])
  const [usingFallback, setUsingFallback] = useState(false)

  useEffect(() => {
    // Clear previous state to avoid stale data
    setResults([])
    setUser(null)
    setUsingFallback(false)

    let mounted = true

    async function fetchResults() {
      // read user from localStorage only to determine which endpoint to call
      const rawUser = (() => {
        try {
          return localStorage.getItem('truehire_user')
        } catch (_) { return null }
      })()
      const parsedUser = rawUser ? JSON.parse(rawUser) : null
      if (!mounted) return
      setUser(parsedUser)

      const base = 'http://localhost:4000'
      const endpoint = parsedUser && parsedUser.role === 'candidate' && parsedUser.email
        ? `${base}/api/results/user/${encodeURIComponent(parsedUser.email)}`
        : `${base}/api/results`

      try {
        const resp = await fetch(endpoint)
        if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`)
        const payload = await resp.json()

        // Normalize shapes: either an array, or { ok: true, results: [...] }
        let normalized = []
        if (Array.isArray(payload)) normalized = payload
        else if (payload && Array.isArray(payload.results)) normalized = payload.results
        else normalized = [] // server returned 200 but no results array — treat as empty

        if (!mounted) return
        setResults(normalized)
        setUsingFallback(false)
      } catch (err) {
        // Only fall back to localStorage if fetch throws (network/server unreachable or non-2xx handled above)
        console.error('Dashboard: failed to fetch results from backend — falling back to localStorage', err)
        try {
          const rawR = localStorage.getItem('truehire_results')
          const arr = rawR ? JSON.parse(rawR) : []
          if (!mounted) return
          if (parsedUser && parsedUser.role === 'candidate' && parsedUser.email) {
            setResults(arr.filter(r => r.userEmail === parsedUser.email))
          } else {
            setResults(arr)
          }
          setUsingFallback(true)
        } catch (e) {
          console.error('Dashboard: failed to read fallback localStorage results', e)
          if (!mounted) return
          setResults([])
          setUsingFallback(true)
        }
      }
    }

    fetchResults()

    return () => { mounted = false }
  }, [])

  const myResults = user ? results.filter(r => r.userEmail === user.email) : results

  return (
    <section className={`mx-auto max-w-6xl px-4 py-10 ${user && user.role === 'employer' ? 'grid md:grid-cols-[1.2fr,0.8fr] gap-6' : ''}`}>
      <div className="card p-6">
        <h2 className="text-2xl font-bold mb-2">Dashboard</h2>
        <p className="text-neutral-600 mb-4">Recent assessment attempts</p>

        {myResults.length === 0 ? (
          <div className="text-neutral-500">No assessment results yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-auto border-collapse">
              <thead>
                <tr className="text-left">
                  <th className="p-2">Date</th>
                  <th className="p-2">Candidate</th>
                  <th className="p-2">Skill</th>
                  <th className="p-2">Difficulty</th>
                  <th className="p-2">Score</th>
                </tr>
              </thead>
              <tbody>
                {myResults.map((r, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="p-2 align-top">{r.date ? new Date(r.date).toLocaleString() : '—'}</td>
                    <td className="p-2 align-top">{r.userName || r.userEmail || '—'}</td>
                    <td className="p-2 align-top">{r.skill || '—'}</td>
                    <td className="p-2 align-top">{r.difficulty || '—'}</td>
                    <td className="p-2 align-top">{(typeof r.score !== 'undefined' ? r.score : '—')}/{(typeof r.total !== 'undefined' ? r.total : '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {user && user.role === 'employer' && (
        <aside className="card p-6 h-fit">
          <EmployerPanel results={results} />
        </aside>
      )}

    </section>
  )
}

function EmployerPanel({ results }){
  const [skill, setSkill] = useState('')
  const [top, setTop] = useState(null)
  const navigate = useNavigate()

  const skills = Array.from(new Set((results || []).map(r => r.skill).filter(Boolean)))

  function findTop(s){
    if (!s) { setTop(null); return }
    const filtered = (results || []).filter(r => r.skill === s)
    if (filtered.length === 0) { setTop(null); return }
    filtered.sort((a,b) => {
      const pa = (a.score / Math.max(1, a.total))
      const pb = (b.score / Math.max(1, b.total))
      if (pa === pb) return new Date(b.date) - new Date(a.date)
      return pb - pa
    })
    setTop(filtered[0])
  }

  return (
    <div>
      <div className="text-sm text-neutral-500 mb-2">Select a skill</div>
      <select className="input mb-3" value={skill} onChange={e => { setSkill(e.target.value); findTop(e.target.value) }}>
        <option value="">-- choose skill --</option>
        {skills.map(s => <option key={s} value={s}>{s}</option>)}
      </select>

      {!skill ? (
        <div className="text-neutral-500 text-sm">No skill selected.</div>
      ) : !top ? (
        <div className="text-neutral-500 text-sm">No attempts found for this skill yet.</div>
      ) : (
        <div className="border rounded p-3">
          <div className="text-sm text-neutral-500">Top scorer</div>
          <div className="font-medium mt-1">{top.userName || top.userEmail}</div>
          <div className="text-xs text-neutral-500">{top.userEmail}</div>
          <div className="mt-2 text-sm">Score: {top.score}/{top.total} ({Math.round((top.score/top.total)*100)}%)</div>
          <div className="flex gap-2 mt-3">
            <button className="btn" onClick={() => navigate(`/profile?email=${encodeURIComponent(top.userEmail)}`)}>View profile</button>
            <button className="btn-ghost" onClick={() => navigate(`/chat?peer=${encodeURIComponent(top.userEmail)}`)}>Message</button>
          </div>
        </div>
      )}
    </div>
  )
}
