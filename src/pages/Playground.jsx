import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const DAILY_CHALLENGES = [
  {
    id: 'd1',
    title: 'Daily #1: The Anagram Group',
    description: 'Write a function that takes an array of strings and groups anagrams together. Return an array of arrays.',
    language: 'javascript',
    template: 'function groupAnagrams(strs) {\n  // your code here\n}',
    correctAnswer: 'function groupAnagrams(strs) {\n  const map = new Map();\n  for (let s of strs) {\n    let key = s.split("").sort().join("");\n    if (!map.has(key)) map.set(key, []);\n    map.get(key).push(s);\n  }\n  return Array.from(map.values());\n}'
  },
  {
    id: 'd2',
    title: 'Daily #2: Deep Clone Object',
    description: 'Write a function that deeply clones a nested JavaScript object, handling arrays and nested objects without using JSON.parse(JSON.stringify).',
    language: 'javascript',
    template: 'function deepClone(obj) {\n  // your code here\n}',
    correctAnswer: 'function deepClone(obj) {\n  if (obj === null || typeof obj !== "object") return obj;\n  if (Array.isArray(obj)) return obj.map(deepClone);\n  const copy = {};\n  for (let key in obj) {\n    if (Object.hasOwn(obj, key)) copy[key] = deepClone(obj[key]);\n  }\n  return copy;\n}'
  },
  {
    id: 'd3',
    title: 'Daily #3: Debounce Function',
    description: 'Implement a debounce function that delays invoking the provided function until after `wait` milliseconds have elapsed since the last time the debounced function was invoked.',
    language: 'javascript',
    template: 'function debounce(func, wait) {\n  // your code here\n}',
    correctAnswer: 'function debounce(func, wait) {\n  let timeout;\n  return function(...args) {\n    clearTimeout(timeout);\n    timeout = setTimeout(() => func.apply(this, args), wait);\n  }\n}'
  }
]

const WEEKLY_CHALLENGES = [
  {
    id: 'w1',
    title: 'Weekly #1: Optimize React Renders',
    description: 'You have a large list component that re-renders every time a parent state changes. Write the structure using React.memo and useCallback to prevent unnecessary renders.',
    language: 'jsx',
    template: 'import { memo, useCallback } from "react";\n\n// Write your optimized components here\n',
    correctAnswer: 'import { memo, useCallback } from "react";\n\nconst ListItem = memo(({ item, onClick }) => {\n  return <div onClick={() => onClick(item.id)}>{item.name}</div>;\n});\n\nfunction List({ items, onSelect }) {\n  const handleSelect = useCallback((id) => {\n    onSelect(id);\n  }, [onSelect]);\n\n  return items.map(item => <ListItem key={item.id} item={item} onClick={handleSelect} />);\n}'
  },
  {
    id: 'w2',
    title: 'Weekly #2: LRU Cache Implementation',
    description: 'Design a Least Recently Used (LRU) cache class. It should support get(key) and put(key, value) operations in O(1) time complexity.',
    language: 'javascript',
    template: 'class LRUCache {\n  constructor(capacity) {\n    this.capacity = capacity;\n  }\n  get(key) {\n    // your code\n  }\n  put(key, value) {\n    // your code\n  }\n}',
    correctAnswer: 'class LRUCache {\n  constructor(capacity) {\n    this.capacity = capacity;\n    this.cache = new Map();\n  }\n  get(key) {\n    if (!this.cache.has(key)) return -1;\n    const val = this.cache.get(key);\n    this.cache.delete(key);\n    this.cache.set(key, val);\n    return val;\n  }\n  put(key, value) {\n    if (this.cache.has(key)) this.cache.delete(key);\n    this.cache.set(key, value);\n    if (this.cache.size > this.capacity) {\n      this.cache.delete(this.cache.keys().next().value);\n    }\n  }\n}'
  },
  {
    id: 'w3',
    title: 'Weekly #3: SQL Recursive CTE',
    description: 'Write a SQL query using a Recursive CTE to find all subordinates of an employee with id = 1 from an "employees" table (id, name, manager_id).',
    language: 'sql',
    template: '-- Write your SQL query here\n',
    correctAnswer: 'WITH RECURSIVE subordinates AS (\n  SELECT id, name, manager_id\n  FROM employees\n  WHERE id = 1\n  UNION ALL\n  SELECT e.id, e.name, e.manager_id\n  FROM employees e\n  INNER JOIN subordinates s ON s.id = e.manager_id\n)\nSELECT * FROM subordinates;'
  }
]

export default function Playground() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  
  const [activeTab, setActiveTab] = useState('daily')
  const [selectedChallenge, setSelectedChallenge] = useState(null)
  const [code, setCode] = useState('')
  
  const [startTime, setStartTime] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef(null)
  
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    const raw = localStorage.getItem('truehire_user')
    const me = raw ? JSON.parse(raw) : null
    setUser(me)
  }, [])

  useEffect(() => {
    if (selectedChallenge && !result) {
      setStartTime(Date.now())
      setElapsed(0)
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000))
      }, 1000)

      // Anti-cheat: fail immediately if they switch tabs or leave window
      const handleCheat = () => {
        if (!result && !isEvaluating) {
          setResult({
            passed: false,
            feedback: "🚨 CHEATING DETECTED: You switched tabs or moved your mouse outside the window! The test has been terminated."
          })
          if (timerRef.current) clearInterval(timerRef.current)
        }
      }

      window.addEventListener('blur', handleCheat)
      document.addEventListener('mouseleave', handleCheat)
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) handleCheat()
      })

      return () => {
        window.removeEventListener('blur', handleCheat)
        document.removeEventListener('mouseleave', handleCheat)
        document.removeEventListener('visibilitychange', handleCheat)
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [selectedChallenge, result, startTime, isEvaluating])

  const handleSelect = (challenge) => {
    setSelectedChallenge(challenge)
    setCode(challenge.template)
    setResult(null)
  }

  const handleBack = () => {
    setSelectedChallenge(null)
    setResult(null)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const handleSubmit = async () => {
    if (!selectedChallenge || !user) return
    setIsEvaluating(true)
    
    try {
      const res = await fetch('http://localhost:4000/api/generate/grade-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userCode: code,
          questionText: selectedChallenge.description,
          correctSolution: selectedChallenge.correctAnswer,
          language: selectedChallenge.language
        })
      })

      if (res.ok) {
        const payload = await res.json()
        setResult(payload)

        // Save stats to local storage if passed
        if (payload.passed) {
          const statsRaw = localStorage.getItem(`truehire_pg_${user.email}`) || '{"solved":0, "fastest":9999}'
          const stats = JSON.parse(statsRaw)
          stats.solved += 1
          if (elapsed < stats.fastest) stats.fastest = elapsed
          localStorage.setItem(`truehire_pg_${user.email}`, JSON.stringify(stats))
        }
      } else {
        alert('Failed to evaluate code')
      }
    } catch (e) {
      alert('Error contacting grading server')
    }
    
    setIsEvaluating(false)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0')
    const s = (sec % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h2 className="text-2xl font-bold mb-4">Login Required</h2>
        <p className="text-neutral-500 mb-6">You must be signed in to access the Playground.</p>
        <button className="btn" onClick={() => navigate('/sign')}>Sign In</button>
      </div>
    )
  }

  const list = activeTab === 'daily' ? DAILY_CHALLENGES : WEEKLY_CHALLENGES

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      
      {!selectedChallenge ? (
        <div className="space-y-8 animate-fade-in-up">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold text-indigo-950 mb-2">Code Playground</h1>
            <p className="text-neutral-500 text-sm max-w-lg mx-auto">
              Compete on daily and weekly challenges to rank up your profile. The faster you solve it correctly, the higher your ranking!
            </p>
          </div>

          <div className="flex justify-center gap-4">
            <button 
              className={`px-6 py-2 rounded-full font-bold text-sm transition-all ${activeTab === 'daily' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-neutral-600 border border-neutral-200'}`}
              onClick={() => setActiveTab('daily')}
            >
              Daily Challenges
            </button>
            <button 
              className={`px-6 py-2 rounded-full font-bold text-sm transition-all ${activeTab === 'weekly' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-neutral-600 border border-neutral-200'}`}
              onClick={() => setActiveTab('weekly')}
            >
              Weekly Challenges
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mt-8">
            {list.map((c, i) => (
              <div key={c.id} className="card p-6 hover:-translate-y-1 transition-transform cursor-pointer border border-indigo-50" onClick={() => handleSelect(c)}>
                <div className="text-xs font-bold text-indigo-500 mb-2 uppercase tracking-wide">Challenge #{i+1}</div>
                <h3 className="font-bold text-lg text-neutral-900 mb-2">{c.title}</h3>
                <p className="text-sm text-neutral-500 line-clamp-2">{c.description}</p>
                <div className="mt-4 pt-4 border-t border-neutral-100 flex justify-between items-center">
                  <span className="text-xs font-mono bg-neutral-100 px-2 py-1 rounded text-neutral-600">{c.language}</span>
                  <span className="text-indigo-600 text-sm font-semibold">Start &rarr;</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-[1fr,2fr] gap-6 animate-fade-in-up h-[75vh]">
          {/* Sidebar */}
          <div className="card p-6 flex flex-col h-full bg-indigo-950 text-white shadow-2xl">
            <button className="text-indigo-300 text-sm mb-6 self-start hover:text-white flex items-center gap-2" onClick={handleBack}>
              &larr; Back to list
            </button>
            <h2 className="text-2xl font-bold mb-4">{selectedChallenge.title}</h2>
            <div className="bg-white/10 p-4 rounded-xl mb-6">
              <p className="text-sm text-indigo-100 leading-relaxed">{selectedChallenge.description}</p>
            </div>
            
            <div className="mt-auto flex justify-between items-center bg-black/30 p-4 rounded-2xl">
              <div className="text-sm text-indigo-200 font-semibold">Time Elapsed</div>
              <div className="text-3xl font-mono font-bold text-emerald-400">
                {formatTime(elapsed)}
              </div>
            </div>
          </div>

          {/* Editor Area */}
          <div className="card p-0 flex flex-col h-full overflow-hidden border border-neutral-200">
            <div className="bg-neutral-900 px-4 py-3 border-b border-neutral-800 flex justify-between items-center">
              <span className="text-neutral-400 text-xs font-mono uppercase tracking-widest">{selectedChallenge.language} workspace</span>
              {result && (
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${result.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {result.passed ? 'PASSED' : 'REVISION NEEDED'}
                </span>
              )}
            </div>
            
            <textarea 
              className="flex-1 w-full bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm p-6 outline-none resize-none leading-loose"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck="false"
              disabled={isEvaluating || (result && result.passed)}
            />

            <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex flex-col gap-4">
              {result && (
                <div className={`p-4 rounded-xl text-sm ${result.passed ? 'bg-emerald-100 text-emerald-900 border border-emerald-200' : 'bg-red-50 text-red-900 border border-red-200'}`}>
                  <strong className="block mb-1">{result.passed ? '🎉 Success!' : '❌ AI Evaluator Feedback:'}</strong>
                  {result.feedback}
                </div>
              )}
              
              <div className="flex justify-end gap-3">
                <button className="btn-ghost" onClick={() => setCode(selectedChallenge.template)} disabled={isEvaluating}>Reset Code</button>
                <button className="btn bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/30" onClick={handleSubmit} disabled={isEvaluating || (result && result.passed)}>
                  {isEvaluating ? 'Evaluating...' : result && !result.passed ? 'Retry Submission' : 'Submit Solution'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
