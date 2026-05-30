import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
  const navigate = useNavigate()
  
  // User Session
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('truehire_user')
      return raw ? JSON.parse(raw) : null
    } catch (e) { return null }
  })
  const [results, setResults] = useState([])
  const [usingFallback, setUsingFallback] = useState(false)
  const [interviews, setInterviews] = useState([])
  
  // AI Matchmaker state
  const [searchQuery, setSearchQuery] = useState('')
  const [aiMatches, setAiMatches] = useState([])
  const [isSearching, setIsSearching] = useState(false)

  // Modal & AI Candidate Insight state
  const [selectedCandidateInsight, setSelectedCandidateInsight] = useState(null)
  const [insightSummary, setInsightSummary] = useState('')
  const [loadingInsight, setLoadingInsight] = useState(false)
  const [insightPlaygroundStats, setInsightPlaygroundStats] = useState(null)

  useEffect(() => {
    if (!selectedCandidateInsight) {
      setInsightSummary('')
      setInsightPlaygroundStats(null)
      return
    }

    // Load playground stats for this candidate
    try {
      const pgRaw = localStorage.getItem(`truehire_pg_${selectedCandidateInsight.userEmail}`)
      if (pgRaw) {
        setInsightPlaygroundStats(JSON.parse(pgRaw))
      }
    } catch (e) {}

    async function fetchSummary() {
      setLoadingInsight(true)
      try {
        let skillsList = ''
        try {
          const rawUsers = localStorage.getItem('truehire_users')
          const users = rawUsers ? JSON.parse(rawUsers) : []
          const found = users.find(u => u.email === selectedCandidateInsight.userEmail)
          if (found) {
            skillsList = found.website || ''
          }
        } catch (e) {}

        const res = await fetch('http://localhost:4000/api/generate/candidate-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: selectedCandidateInsight.userEmail,
            name: selectedCandidateInsight.userName,
            skills: skillsList
          })
        })
        if (res.ok) {
          const data = await res.json()
          if (data.ok) {
            setInsightSummary(data.summary)
          }
        }
      } catch (e) {
        console.error('Failed to fetch candidate summary:', e)
      }
      setLoadingInsight(false)
    }

    fetchSummary()
  }, [selectedCandidateInsight])

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    setResults([])
    setUsingFallback(false)

    const rawUser = localStorage.getItem('truehire_user')
    const parsedUser = rawUser ? JSON.parse(rawUser) : null
    setUser(parsedUser)

    if (parsedUser) {
      fetchInterviews(parsedUser.email)
    }

    const base = 'http://localhost:4000'
    const endpoint = parsedUser && parsedUser.role === 'candidate' && parsedUser.email
      ? `${base}/api/results/user/${encodeURIComponent(parsedUser.email)}`
      : `${base}/api/results`

    try {
      const resp = await fetch(endpoint)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const payload = await resp.json()

      let normalized = []
      if (Array.isArray(payload)) normalized = payload
      else if (payload && Array.isArray(payload.results)) normalized = payload.results

      setResults(normalized)
    } catch (err) {
      console.warn('Dashboard: server offline, loading local results', err)
      try {
        const rawR = localStorage.getItem('truehire_results')
        const arr = rawR ? JSON.parse(rawR) : []
        if (parsedUser && parsedUser.role === 'candidate') {
          setResults(arr.filter((r) => r.userEmail === parsedUser.email))
        } else {
          setResults(arr)
        }
        setUsingFallback(true)
      } catch (e) {
        setResults([])
      }
    }
  }

  // Fetch interviews
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

  // AI Matchmaker search
  async function handleAIMatch(e) {
    if (e) e.preventDefault()
    if (!searchQuery.trim()) {
      setAiMatches([])
      return
    }

    setIsSearching(true)
    try {
      const res = await fetch('http://localhost:4000/api/generate/match-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery })
      })

      if (res.ok) {
        const payload = await res.json()
        if (payload.ok && payload.matches) {
          setAiMatches(payload.matches)
        }
      }
    } catch (err) {
      console.error('Failed to run AI Matchmaking:', err)
      alert('AI Matchmaker offline. Start the backend server.')
    }
    setIsSearching(false)
  }


  // Combine results with Matchmaking scores
  const processedResults = results.map((r) => {
    const aiScore = aiMatches.find((match) => match.email === r.userEmail)
    return {
      ...r,
      matchPercent: aiScore ? aiScore.matchPercent : null,
      reasoning: aiScore ? aiScore.reasoning : null
    }
  })

  // Sort candidates: matchPercent DESC, score DESC
  if (aiMatches.length > 0) {
    processedResults.sort((a, b) => {
      const ma = a.matchPercent || 0
      const mb = b.matchPercent || 0
      return mb - ma
    })
  }

  const myResults = user && user.role === 'candidate'
    ? processedResults.filter((r) => r.userEmail === user.email)
    : processedResults

  // Hours for timeline grid (Image 1 style)
  const timelineHours = ['9 AM', '11 AM', '1 PM', '3 PM', '5 PM', '7 PM']

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 relative space-y-8">
      

      {/* Main Grid */}
      <div className={`grid ${user && user.role === 'employer' ? 'md:grid-cols-[1.3fr,0.7fr]' : 'grid-cols-1'} gap-8`}>
        
        {/* Results history board */}
        <div className="space-y-8">
          
          {/* Header Panel */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">Platform Analytics</h2>
              <p className="text-xs text-[var(--text-secondary)] mt-1">Verified skill assessments & active matches</p>
            </div>
            {usingFallback && (
              <span className="chip bg-amber-50 text-amber-800 border-amber-200">Offline Fallback Database</span>
            )}
          </div>

          {/* Image 1 style: Timeline / Interview Management Grid */}
          <div className="neo-card p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <span className="text-xl">📅</span>
                <h3 className="font-bold text-base text-[var(--text-primary)]">Interview Pipeline Track</h3>
              </div>
              <span className="text-xs text-[var(--text-muted)] font-medium">Daily Schedule Grid</span>
            </div>

            {interviews.length === 0 ? (
              <div className="text-center py-10 text-[var(--text-muted)] text-sm">
                No active interviews scheduled for this period.
              </div>
            ) : (
              <div className="relative">
                {/* Horizontal Timeline Track */}
                <div className="grid grid-cols-6 gap-2 text-center text-[10px] text-[var(--text-muted)] font-semibold mb-4 border-b border-[var(--border)] pb-2">
                  {timelineHours.map((h) => <div key={h}>{h}</div>)}
                </div>

                {/* Timeline Grid Rows */}
                <div className="space-y-4 max-h-[250px] overflow-y-auto pr-1">
                  {interviews.map((inv, idx) => {
                    const dateObj = new Date(inv.dateTime)
                    const hour = dateObj.getHours()
                    // Rough mapping to columns: 9 AM to 7 PM
                    let colStart = 1
                    if (hour >= 19) colStart = 6
                    else if (hour >= 17) colStart = 5
                    else if (hour >= 15) colStart = 4
                    else if (hour >= 13) colStart = 3
                    else if (hour >= 11) colStart = 2

                    return (
                      <div key={inv.id} className="relative rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border)] p-4 hover:shadow-sm transition-all duration-200">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="text-xs font-bold text-[var(--text-primary)]">
                              {dateObj.toLocaleDateString()} at {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                              {user.role === 'employer' ? `Candidate: ${inv.candidateEmail}` : `Employer: ${inv.employerEmail}`}
                            </div>
                            {inv.notes && (
                              <div className="text-[10px] italic text-[var(--text-secondary)] mt-1">Notes: "{inv.notes}"</div>
                            )}
                          </div>
                          <span className="chip text-[10px] uppercase font-bold text-indigo-700 bg-indigo-50 border-indigo-100">
                            Booked
                          </span>
                        </div>

                        {/* Visual timeline bar placement indicators */}
                        <div className="w-full bg-slate-200 h-1.5 rounded-full mt-3 overflow-hidden relative">
                          <div 
                            className="bg-indigo-600 h-full absolute rounded-full transition-all duration-300"
                            style={{ 
                              left: `${(colStart - 1) * 16.6}%`, 
                              width: '16.6%' 
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Leaderboard Table Widget */}
          <div className="neo-card p-8">
            <h3 className="font-bold text-[var(--text-primary)] text-base mb-4 flex items-center gap-2">
              <span>🏆</span> Candidate Assessment Results
            </h3>
            
            {myResults.length === 0 ? (
              <div className="text-center py-8 text-[var(--text-muted)] text-sm">
                No attempt results logged.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse text-left">
                  <thead>
                    <tr className="text-[var(--text-muted)] border-b border-[var(--border)] font-semibold text-xs uppercase tracking-wider">
                      <th className="pb-3">Candidate</th>
                      <th className="pb-3">Domain</th>
                      <th className="pb-3">Stage</th>
                      <th className="pb-3">Score</th>
                      <th className="pb-3 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myResults.map((r, idx) => (
                      <tr key={idx} className="border-b border-[var(--border)] hover:bg-[var(--bg-elevated)]/50 transition-colors">
                        <td className="py-4 relative">
                          <div 
                            className="font-bold text-[var(--text-primary)] cursor-pointer hover:text-[var(--accent)] hover:underline inline-block"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedCandidateInsight({ userEmail: r.userEmail, userName: r.userName })
                            }}
                          >
                            {r.userName || 'Candidate'}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)] font-medium">{r.userEmail}</div>
                        </td>
                        <td className="py-4">
                          <span className="chip">{r.skill}</span>
                        </td>
                        <td className="py-4 font-semibold text-[var(--text-primary)]">
                          {r.difficulty === '3' ? 'Stage 3' : r.difficulty === '2' ? 'Stage 2' : 'Stage 1'}
                        </td>
                        <td className="py-4">
                          <div className="font-bold text-[var(--text-primary)]">{r.score} / {r.total}</div>
                          <div className="text-[10px] text-[var(--text-muted)] font-medium">
                            {Math.round((r.score / Math.max(1, r.total)) * 100)}%
                          </div>
                        </td>
                        <td className="py-4 text-right text-[var(--text-muted)] text-xs">
                          {r.date ? new Date(r.date).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* Employer Side Panel: AI Matchmaker & Scheduler */}
        {user && user.role === 'employer' && (
          <aside className="space-y-6">
            
            {/* Image 1 style: High Contrast Dark Widget for AI Matchmaker */}
            <div className="dark-widget space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <span>🤖</span> AI Matchmaker
                </h3>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Active</span>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Describe your target profile in standard search phrases:
              </p>
              
              <form onSubmit={handleAIMatch} className="space-y-3">
                <input
                  className="w-full rounded-full border border-white/15 bg-white/5 text-white px-5 py-3 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/30 text-xs"
                  placeholder="e.g. React dev with SQL knowledge..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button
                  type="submit"
                  className="w-full rounded-full py-3 font-semibold text-xs bg-emerald-500 text-neutral-950 shadow-lg shadow-emerald-500/10 hover:bg-emerald-400 active:scale-95 transition-all duration-200"
                  disabled={isSearching}
                >
                  {isSearching ? 'Parsing profiles...' : 'Find Matches'}
                </button>
              </form>
            </div>

            {/* Candidate Search / Evaluation Panel */}
            <div className="neo-card p-6 space-y-4">
              <h3 className="font-bold text-[var(--text-primary)] text-sm">Recruiting Ranks</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">Candidates ranked by semantic AI score relevance</p>
              
              {processedResults.length === 0 ? (
                <div className="text-xs text-[var(--text-muted)] italic">No candidates registered.</div>
              ) : (
                <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                  {processedResults.map((cand, idx) => (
                    <div key={idx} className="p-4 rounded-[20px] border border-[var(--border)] bg-[var(--bg-elevated)] space-y-3 hover:border-[var(--accent)] hover:bg-[var(--bg-surface)] transition-all duration-200">
                      <div className="flex items-start justify-between gap-3">
                        <div className="relative">
                          <h4 
                            className="font-bold text-sm text-[var(--text-primary)] cursor-pointer hover:text-[var(--accent)] hover:underline inline-block"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedCandidateInsight({ userEmail: cand.userEmail, userName: cand.userName })
                            }}
                          >
                            {cand.userName || 'Candidate'}
                          </h4>
                          <span className="text-[10px] text-[var(--text-muted)] block -mt-0.5">{cand.userEmail}</span>
                        </div>
                        {cand.matchPercent !== null && (
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${cand.matchPercent >= 80 ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : cand.matchPercent >= 50 ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-neutral-100 text-neutral-600 border border-neutral-200'}`}>
                            {cand.matchPercent}% Match
                          </span>
                        )}
                      </div>

                      {cand.reasoning && (
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed italic bg-[var(--bg-elevated)] p-2.5 rounded-xl border border-[var(--border)]">
                          "{cand.reasoning}"
                        </p>
                      )}

                      <div className="flex items-center gap-2 pt-1.5">
                        <button
                          type="button"
                          onClick={() => navigate(`/chat?peer=${encodeURIComponent(cand.userEmail)}`)}
                          className="btn text-[10px] py-1.5 px-3 rounded-lg border border-[var(--border-strong)] hover:border-[var(--accent)] text-center"
                        >
                          Message
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </aside>
        )}

      </div>

      {/* AI Candidate Insight Modal */}
      {selectedCandidateInsight && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedCandidateInsight(null)}>
          <div 
            className="card p-8 max-w-lg w-full relative space-y-6 overflow-hidden animate-scale-up text-left shadow-2xl" 
            onClick={(e) => e.stopPropagation()}
            style={{ borderTop: '6px solid var(--accent)', background: 'var(--bg-surface)' }}
          >
            {/* Header info */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">AI Candidate Insight</span>
                <button 
                  type="button" 
                  className="text-neutral-400 hover:text-neutral-600 text-sm font-bold p-1" 
                  onClick={() => setSelectedCandidateInsight(null)}
                >
                  ✕
                </button>
              </div>
              <h3 className="text-2xl font-black mt-1" style={{ color: 'var(--text-primary)' }}>{selectedCandidateInsight.userName}</h3>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{selectedCandidateInsight.userEmail}</p>
            </div>

            {/* Test History Section */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Verified Test Performance</h4>
              <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                {results.filter(r => r.userEmail === selectedCandidateInsight.userEmail).length === 0 ? (
                  <div className="text-xs italic" style={{ color: 'var(--text-muted)' }}>No completed test attempts logged yet.</div>
                ) : (
                  results
                    .filter(r => r.userEmail === selectedCandidateInsight.userEmail)
                    .map((attempt, index) => (
                      <div key={index} className="flex justify-between items-center p-2.5 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
                        <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {attempt.skill} <span className="opacity-60">({attempt.difficulty === '3' ? 'Stage 3' : attempt.difficulty === '2' ? 'Stage 2' : 'Stage 1'})</span>
                        </div>
                        <div className="text-xs font-bold" style={{ color: 'var(--accent)' }}>
                          {attempt.score} / {attempt.total} ({Math.round((attempt.score / attempt.total) * 100)}%)
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Playground Stats Section */}
            {insightPlaygroundStats && insightPlaygroundStats.solved > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Playground Competitive Rank</h4>
                <div className="flex justify-between items-center p-2.5 rounded-xl border bg-emerald-50/5" style={{ borderColor: 'var(--border)' }}>
                  <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Challenges Solved: <span className="font-bold text-emerald-500">{insightPlaygroundStats.solved}</span>
                  </div>
                  <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                    Fastest: <span className="text-emerald-500 font-mono">{Math.floor(insightPlaygroundStats.fastest / 60)}:{(insightPlaygroundStats.fastest % 60).toString().padStart(2, '0')}</span>
                  </div>
                </div>
              </div>
            )}

            {/* AI Summary Section */}
            <div className="p-5 rounded-xl border bg-indigo-50/10" style={{ borderColor: 'rgba(99, 102, 241, 0.15)' }}>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-base">🤖</span>
                <h4 className="font-bold text-xs uppercase tracking-wider" style={{ color: 'var(--accent)' }}>AI Recruiting Recommendation</h4>
              </div>
              
              {loadingInsight ? (
                <div className="py-4 flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Synthesizing assessment telemetry...</span>
                </div>
              ) : (
                <p className="text-xs leading-relaxed italic" style={{ color: 'var(--text-secondary)' }}>
                  "{insightSummary || 'Failed to fetch candidate insights summary.'}"
                </p>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-between items-center pt-2">
              <button 
                type="button" 
                className="btn-ghost text-xs" 
                onClick={() => setSelectedCandidateInsight(null)}
              >
                Close
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCandidateInsight(null)
                    navigate(`/chat?peer=${encodeURIComponent(selectedCandidateInsight.userEmail)}`)
                  }}
                  className="btn text-xs py-2 px-4 border border-[var(--border-strong)] hover:border-[var(--accent)] text-center"
                >
                  💬 Message
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCandidateInsight(null)
                    navigate(`/profile?email=${encodeURIComponent(selectedCandidateInsight.userEmail)}`)
                  }}
                  className="btn text-xs py-2 px-4"
                >
                  👤 See Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
