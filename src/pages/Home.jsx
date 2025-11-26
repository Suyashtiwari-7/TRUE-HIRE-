import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 grid md:grid-cols-[1.2fr,0.8fr] gap-6">
      <div className="card p-8">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
          A platform to empower non-degree candidates
        </h1>
        <p className="text-neutral-600 mb-6">
          Showcase real skills with assessments, get matched to roles, and grow with targeted learning.
          Employers hire fairly, faster.
        </p>

        <div className="flex items-center gap-3 mb-4">
          <Link to="/jobs" className="btn-ghost flex items-center gap-2">Browse Jobs <span>👜</span></Link>
          <Link to="/assessment" className="btn flex items-center gap-2">Take Assessment <span>▶️</span></Link>
        </div>

        <div className="flex flex-wrap gap-2">
          {['Skills-based hiring','AI-friendly design','No degree required'].map((t) => (
            <span key={t} className="chip">{t}</span>
          ))}
        </div>
      </div>

      <aside className="card p-6 h-fit">
        <div className="flex items-center gap-2 mb-3">
          <span>🔔</span>
          <h3 className="font-semibold">Why True Hire?</h3>
        </div>
        <p className="text-neutral-600 mb-6">
          Reduce bias, validate skills, and discover hidden talent through fair, practical evaluations.
        </p>

        <h4 className="font-semibold mb-3">Sectors trending without degree filters</h4>
        <div className="flex flex-wrap gap-2">
          {['Web Dev','Green Jobs','Operations','Support','Sales'].map((t) => (
            <span key={t} className="chip">{t}</span>
          ))}
        </div>
      </aside>
    </section>
  )
}
