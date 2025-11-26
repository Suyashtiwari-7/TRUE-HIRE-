import { useNavigate } from 'react-router-dom'
import { useMemo, useState } from 'react'

export default function Jobs() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [skillFilter, setSkillFilter] = useState('')
  const jobs = [
    {
      title: 'Frontend Developer (React)',
      company: 'Craftly • Remote / Pune',
      tags: ['React','TypeScript','Tailwind','Degree not required'],
      blurb: 'Build delightful UIs. Degree not required—show us your GitHub and a small take-home.'
    },
    {
      title: 'Solar Installation Technician',
      company: 'SunLeaf Energy • Nashik',
      tags: ['Electrical','Safety','Field Work','Degree not required'],
      blurb: 'Hands-on green-jobs track. Training provided. Assessments validate practical skills.'
    },
    {
      title: 'Data Associate',
      company: 'InsightOps • Mumbai',
      tags: ['Excel','SQL','Python','Degree not required'],
      blurb: 'Clean and label datasets. Growth path to Data Analyst.'
    }
  ]

  const skills = useMemo(() => {
    const s = new Set()
    jobs.forEach(j => j.tags.forEach(t => s.add(t)))
    return Array.from(s)
  }, [jobs])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return jobs.filter(j => {
      // skill filter takes precedence
      if (skillFilter) {
        if (!j.tags.some(t => t.toLowerCase() === skillFilter.toLowerCase())) return false
      }
      if (!q) return true
      if (j.title.toLowerCase().includes(q)) return true
      if (j.company.toLowerCase().includes(q)) return true
      if (j.tags.some(t => t.toLowerCase().includes(q))) return true
      return false
    })
  }, [query, skillFilter, jobs])

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 grid md:grid-cols-[1.2fr,0.8fr] gap-6">
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <input
            className="input"
            placeholder="Search by role, company or skill"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <select className="chip" value={skillFilter} onChange={e => setSkillFilter(e.target.value)}>
            <option value="">All skills</option>
            {skills.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="space-y-4">
          {filtered.map((j, i) => {
            // choose a matching tag (skill) first if query matches a tag
            const q = query.trim().toLowerCase()
            const matchTag = q ? j.tags.find(t => t.toLowerCase().includes(q)) : null
            const primary = matchTag || j.tags[0]
            const other = j.tags.filter(t => t !== primary)
            return (
              <div key={i} className="card p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="chip">{primary}</span>
                      {other.map(t => <span key={t} className="chip">{t}</span>)}
                    </div>
                    <h3 className="text-xl font-semibold mb-1">{j.title}</h3>
                    <div className="text-neutral-500 text-sm mb-2">{j.company}</div>
                    <p className="text-neutral-700">{j.blurb}</p>
                  </div>
                  <button
                    className="btn flex items-center gap-2 shrink-0 self-center"
                    onClick={() => navigate('/sign')}
                  >
                    ✈️ Apply
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <aside className="card p-6 h-fit">
        <h3 className="font-semibold mb-3">Tips</h3>
        <ul className="list-disc pl-5 text-neutral-700 space-y-2">
          <li>Complete the assessment to rank higher.</li>
          <li>Keep skills concise: e.g. React, SQL, Safety.</li>
          <li>Upload a focused 1-page resume.</li>
        </ul>
      </aside>
    </section>
  )
}
