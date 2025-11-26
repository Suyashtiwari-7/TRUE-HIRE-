import { useCallback, useState, useEffect } from 'react'
import useTabWarning from '../hooks/useTabWarning'
import useCamera from '../hooks/useCamera'
import useCameraMonitor from '../hooks/useCameraMonitor'

export default function Assessment() {
  const [started, setStarted] = useState(false)
  const [skill, setSkill] = useState('React')
  const [difficulty, setDifficulty] = useState('1')
  const [questions, setQuestions] = useState([]) // {question, options, correct}
  const [answers, setAnswers] = useState({})     // index -> value
  const [score, setScore] = useState(() => Number(localStorage.getItem('score')||0))
  const [warnings, setWarnings] = useState(() => Number(localStorage.getItem('warnings')||0))
  const [warnLog, setWarnLog] = useState([])
  const limit = 3
  const { videoRef, start: startCam, stop: stopCam, active: camActive, error: camError } = useCamera(false)
  // predefined monitor settings (tuned for coverage detection)
  const monitorOptions = {
    sampleMs: 400,
    darkThreshold: 20,
    darkFrames: 2,
    stillThreshold: 4,
    stillFrames: 6,
    blackPixelThreshold: 45,
    blackPixelPercent: 0.25
  }

  const setAns = useCallback((idx, val) => setAnswers(a => ({ ...a, [idx]: val })), [])

  function getStoredUser(){
    try{
      const raw = localStorage.getItem('truehire_user')
      return raw ? JSON.parse(raw) : null
    }catch(e){ return null }
  }

  const registerWarning = useCallback((type) => {
    // locally increment/show the warning
    setWarnings(w => {
      const nw = w + 1
      try{ localStorage.setItem('warnings', String(nw)) }catch(e){}

      // attempt to persist warning to backend for the user (best-effort)
      try{
        const user = getStoredUser()
        if(user?.email){
          fetch('http://localhost:4000/api/users/warn', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email })
          }).catch(()=>{})
        }
      }catch(e){}

      return nw
    })
    setWarnLog(log => [{ type, at: new Date().toLocaleTimeString() }, ...log].slice(0, 6))
  },[])

  useTabWarning(useCallback(() => {
    registerWarning('tab-hidden')
  },[registerWarning]))

  useEffect(()=>{ localStorage.setItem('score', String(score)) },[score])

  // Monitor camera when started using predefined options
  useCameraMonitor(started && camActive ? videoRef : null, {
    onWarn: registerWarning,
    ...monitorOptions
  })

  function onSubmit(e){
    e.preventDefault()
    let s = 0
    questions.forEach((q, i) => { if (answers[i] === q.correct) s += 1 })
    setScore(s)
    // persist result for dashboard
    try{
      const user = getStoredUser()
      const res = {
        userEmail: user?.email || null,
        userName: user?.name || null,
        skill,
        difficulty,
        score: s,
        total: questions.length,
        date: new Date().toISOString()
      }

      // local fallback
      const raw = localStorage.getItem('truehire_results')
      const arr = raw ? JSON.parse(raw) : []
      arr.unshift(res)
      localStorage.setItem('truehire_results', JSON.stringify(arr))

      // best-effort: send result to backend
      try{
        fetch('http://localhost:4000/api/results', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(res)
        }).catch(()=>{})
      }catch(e){}
    }catch(err){ /* ignore */ }
  }

  const disabled = warnings >= limit
  async function generateQuestions(topic, diff, count = 5){
    // Try backend-generated questions first (requires backend running with OPENAI_API_KEY)
    try{
      // include an identifier for the current user (if available) so the backend
      // can provide per-user deduplication of generated questions
      let userEmail = null
      try{
        const rawUser = localStorage.getItem('truehire_user')
        const user = rawUser ? JSON.parse(rawUser) : null
        userEmail = user?.email || null
      }catch(e){ userEmail = null }

      const res = await fetch('http://localhost:4000/api/generate/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, difficulty: diff, count, userId: userEmail })
      })
      if(res.ok){
        const j = await res.json()
        if(j?.ok && Array.isArray(j.questions) && j.questions.length > 0){
          // Ensure shape: {question, options, correct}
          return j.questions.map(q => ({ question: q.question, options: q.options, correct: q.correct }))
        }
      }
    }catch(e){
      // network or backend not available - fall back to local bank
    }

    const banks = {
      React: [
        { question: 'Which HTML tag typically wraps the React root?', options: ['<main>','<div>','<app>','<root>'], correct: '<div>' },
        { question: 'Which hook manages local state?', options: ['useEffect','useMemo','useState','useRef'], correct: 'useState' },
        { question: 'What enables component re-render tracking in dev?', options: ['StrictMode','Profiler','Suspense','Fragment'], correct: 'StrictMode' },
        { question: 'Which library is commonly used for routing?', options: ['react-router-dom','redux','axios','zod'], correct: 'react-router-dom' },
        { question: 'What prop is required for list items?', options: ['id','key','index','ref'], correct: 'key' }
      ],
      SQL: [
        { question: 'Which clause filters groups?', options: ['WHERE','HAVING','GROUP BY','ORDER BY'], correct: 'HAVING' },
        { question: 'Which join returns all rows from left?', options: ['INNER','RIGHT','LEFT','CROSS'], correct: 'LEFT' },
        { question: 'Which aggregates values?', options: ['COUNT()','LIMIT','JOIN','DISTINCT'], correct: 'COUNT()' },
        { question: 'Which sorts results?', options: ['ORDER BY','GROUP BY','HAVING','UNION'], correct: 'ORDER BY' },
        { question: 'Which removes duplicates?', options: ['DISTINCT','UNIQUE','DELETE','TRIM'], correct: 'DISTINCT' }
      ],
      JavaScript: [
        { question: 'const x = {}; x.a = 1 is...', options: ['Invalid','Valid','Throws','Crashes'], correct: 'Valid' },
        { question: 'Which is NOT primitive?', options: ['number','object','string','boolean'], correct: 'object' },
        { question: 'Which checks type?', options: ['typeof','instanceof','both','neither'], correct: 'both' },
        { question: 'Promise.allSettled returns...', options: ['values','errors','statuses','undefined'], correct: 'statuses' },
        { question: 'Array immutably add item?', options: ['push','unshift','concat','pop'], correct: 'concat' }
      ]
    }
  const src = banks[topic] || banks.React
    const n = Math.min(count, src.length)

    // persist seen questions per topic to avoid repeating until bank exhausted
    // structure in localStorage: { [topic]: [questionText, ...] }
    const KEY = 'truehire_seen_questions'
    let seenStore = {}
    try{
      const raw = localStorage.getItem(KEY)
      seenStore = raw ? JSON.parse(raw) : {}
    }catch(e){ seenStore = {} }
    const seenForTopic = new Set(seenStore[topic] || [])

    // pick questions not yet seen for this topic
    let available = src.filter(q => !seenForTopic.has(q.question))

    // if not enough unseen questions, allow wrapping: clear seen for topic and start fresh
    if(available.length < n){
      // if nothing left unseen, reset seen for this topic
      if(available.length === 0){
        seenForTopic.clear()
        available = [...src]
      } else {
        // take all available, then reset and take remaining from full bank (without duplicates)
        const needed = n - available.length
        // prepare pool from full src excluding those already selected
        const pool = src.filter(q => !available.includes(q))
        // shuffle pool and take needed
        const extra = [...pool].sort(() => Math.random() - 0.5).slice(0, needed)
        available = [...available, ...extra]
        // after this attempt we'll consider bank partially exhausted and mark seen accordingly
      }
    }

    // shuffle available and pick n
    const picked = [...available].sort(() => Math.random() - 0.5).slice(0, n)

    // shuffle options within each picked question and mark questions as seen
    const result = picked.map(q => ({
      question: q.question,
      options: [...q.options].sort(() => Math.random() - 0.5),
      correct: q.correct
    }))

    // update seenStore and persist
    try{
      const add = seenStore[topic] ? new Set(seenStore[topic]) : new Set()
      result.forEach(r => add.add(r.question))
      seenStore[topic] = Array.from(add)
      localStorage.setItem(KEY, JSON.stringify(seenStore))
    }catch(e){ /* ignore persistence errors */ }

    return result
  }

  async function onStart(){
    // mount video element first so videoRef is available for attaching the stream
    setStarted(true)
    // small tick to allow video element to mount
    await new Promise((r) => setTimeout(r, 60))
    await startCam()
  const qs = await generateQuestions(skill, difficulty, 5)
  setQuestions(qs)
    setAnswers({})
    setScore(0)
    // reset warnings for a fresh attempt
    setWarnings(0)
    try{ localStorage.setItem('warnings', '0') }catch(e){}
    // attempt to reset server-side warnings (best-effort)
    try{
      const user = getStoredUser()
      if(user?.email){
        fetch('http://localhost:4000/api/users/reset-warnings', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email })
        }).catch(()=>{})
      }
    }catch(e){}
  }

  function onEnd(){
    stopCam()
    setStarted(false)
  }
  return (
    <section className="mx-auto max-w-6xl px-4 py-8 grid md:grid-cols-[1.2fr,0.8fr] gap-6">
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <span>▶️</span>
          <h2 className="font-semibold text-lg">Skill Assessment</h2>
        </div>
        {/* Controls */}
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label className="block text-sm mb-1">Skill</label>
            <select className="chip" value={skill} onChange={e=>setSkill(e.target.value)}>
              {['React','SQL','JavaScript'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Difficulty</label>
            <select className="chip" value={difficulty} onChange={e=>setDifficulty(e.target.value)}>
              {['1','2','3'].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          {!started ? (
            <button className="btn" onClick={onStart}>Start</button>
          ) : (
            <button className="btn-ghost" onClick={onEnd}>End</button>
          )}
        </div>

        {/* Camera */}
        {started && (
          <div className="mb-4">
            <div className="text-sm text-neutral-600 mb-1">Camera preview</div>
            <div className="card p-2">
              <video ref={videoRef} playsInline muted className="w-full rounded-xl bg-black aspect-video" />
            </div>
            {camError && <div className="mt-2 text-sm text-red-600">{camError}</div>}
            {warnLog.length > 0 && (
              <div className="mt-2 text-sm">
                <div className="font-medium text-neutral-700 mb-1">Recent warnings</div>
                <ul className="list-disc pl-5 space-y-1 text-neutral-600">
                  {warnLog.map((w, i) => (
                    <li key={i}>
                      <span className={w.type==='camera-dark' ? 'text-red-600' : w.type==='camera-frozen' ? 'text-amber-600' : 'text-neutral-700'}>
                        {w.type.replace('camera-','camera ')}
                      </span> <span className="text-neutral-400">• {w.at}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* debug UI removed - monitor uses predefined settings */}
          </div>
        )}
        {disabled && (
          <div className="mb-4 rounded-md bg-red-50 text-red-700 border border-red-200 p-3 text-sm">
            too may malasious activities
          </div>
        )}

        <form className="space-y-6" onSubmit={onSubmit}>
          {questions.length === 0 && (
            <div className="text-neutral-600 text-sm">Generate questions by clicking Start. Choose skill and difficulty above.</div>
          )}
          {questions.map((q, i) => (
            <div key={i} className="space-y-3">
              <p className="font-medium">Q{i+1}. {q.question}</p>
              <div className="grid md:grid-cols-2 gap-3">
                {q.options.map((o) => (
                  <label key={o} className="chip justify-start gap-3 cursor-pointer">
                    <input type="radio" name={`q${i}`} value={o} checked={answers[i]===o} onChange={()=>setAns(i, o)} /> <span>{o}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div className="flex justify-end">
            <button type="submit" className="btn" disabled={disabled || questions.length === 0}>
              {disabled ? 'Submission blocked' : 'Submit'}
            </button>
          </div>
          <p className="text-sm text-neutral-500">Answer all questions and submit.</p>
        </form>
      </div>

      <aside className="card p-6 h-fit">
        <div className="text-right">
          <div className="inline-flex items-center justify-center chip text-2xl px-5 py-3">{score} / {questions.length || 0}</div>
          <div className="mt-2 text-neutral-500">Your Score</div>
        </div>

        <div className="mt-6">
          <div className="text-sm text-neutral-600">Tab warnings: <span className={warnings>0? 'text-red-600 font-semibold':''}>{warnings}</span> / {limit}</div>
        </div>

        <div className="mt-6 space-y-3">
          {/* Show recommended courses only after the user has taken the test and scored below 70% */}
          {questions.length > 0 && (
            (() => {
              const pct = questions.length ? (score / questions.length) * 100 : 0
              if (pct >= 70) return (
                <div className="text-sm text-neutral-600">Good job — no additional course recommendations needed.</div>
              )

              // For mid-range scores (50-69) show general recommendations (mixed providers)
              if (pct >= 50 && pct < 70) {
                const mapping = {
                  React: [
                    { title: 'React Basics', provider: 'Coursera • React', url: 'https://www.coursera.org/search?query=react' },
                    { title: 'Advanced React Patterns', provider: 'Frontend Masters • React', url: 'https://frontendmasters.com/courses/' }
                  ],
                  SQL: [
                    { title: 'Intro to SQL', provider: 'Khan Academy • SQL', url: 'https://www.coursera.org/search?query=sql' },
                    { title: 'SQL for Data Analysis', provider: 'DataCamp • SQL', url: 'https://www.datacamp.com/' }
                  ],
                  JavaScript: [
                    { title: 'JavaScript Fundamentals', provider: 'freeCodeCamp • JS', url: 'https://www.coursera.org/search?query=javascript' },
                    { title: 'Modern JavaScript', provider: 'Udemy • JS', url: 'https://www.udemy.com/' }
                  ]
                }
                const list = mapping[skill] || mapping['React']
                return (
                  <div>
                    <h3 className="font-semibold">Recommended Courses</h3>
                    {list.map((c) => (
                      <div key={c.title} className="card p-4 flex items-center justify-between">
                        <div>
                          <div className="font-medium">{c.title}</div>
                          <div className="text-sm text-neutral-500">{c.provider}</div>
                        </div>
                        <a href={c.url || '#'} target="_blank" rel="noreferrer" className="btn-ghost">Explore</a>
                      </div>
                    ))}
                  </div>
                )
              }

              // For low scores (<50) show Coursera-specific recommendations for the selected skill
              if (pct < 50) {
                const coursera = {
                  React: [
                    { title: 'Front-End Web Development with React', provider: 'Coursera', url: `https://www.coursera.org/search?query=react%20development` },
                    { title: 'React Fundamentals', provider: 'Coursera', url: `https://www.coursera.org/search?query=react%20fundamentals` }
                  ],
                  SQL: [
                    { title: 'Databases and SQL for Data Science', provider: 'Coursera', url: `https://www.coursera.org/search?query=sql%20for%20data%20science` },
                    { title: 'SQL for Data Science', provider: 'Coursera', url: `https://www.coursera.org/search?query=sql` }
                  ],
                  JavaScript: [
                    { title: 'JavaScript Basics', provider: 'Coursera', url: `https://www.coursera.org/search?query=javascript%20basics` },
                    { title: 'Programming Foundations with JavaScript', provider: 'Coursera', url: `https://www.coursera.org/search?query=programming%20javascript` }
                  ]
                }
                const list = coursera[skill] || coursera['React']
                return (
                  <div>
                    <h3 className="font-semibold">Coursera Recommendations</h3>
                    <div className="text-sm text-neutral-500 mb-3">Based on your score &mdash; curated Coursera courses to strengthen fundamentals.</div>
                    {list.map((c) => (
                      <div key={c.title} className="card p-4 flex items-center justify-between">
                        <div>
                          <div className="font-medium">{c.title}</div>
                          <div className="text-sm text-neutral-500">{c.provider}</div>
                        </div>
                        <a href={c.url} target="_blank" rel="noreferrer" className="btn">View on Coursera</a>
                      </div>
                    ))}
                  </div>
                )
              }

              return null
            })()
          )}
        </div>
      </aside>
    </section>
  )
}
