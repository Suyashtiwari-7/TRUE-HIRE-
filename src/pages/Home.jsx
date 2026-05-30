import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'

const stats = [
  { value: '100%', label: 'Skills Verified', color: 'var(--accent-3)' },
  { value: 'Zero', label: 'Credential Bias', color: 'var(--accent)' },
  { value: 'Instant', label: 'AI Profile Parse', color: 'var(--accent-2)' },
  { value: '24 hr', label: 'Proctor Integrity', color: '#f59e0b' },
]

const features = [
  {
    icon: '🧠',
    title: 'AI Assessment',
    description: 'Three-part timed exams: Quantitative Aptitude, Domain MCQs, and interactive code debugging — all AI-generated and unique per candidate.',
    link: '/assessment',
    linkLabel: 'Start Exam →',
    colorClass: 'rgba(99,102,241,0.12)',
    textColor: 'var(--accent)',
  },
  {
    icon: '🔒',
    title: 'Smart Proctoring',
    description: 'TensorFlow.js client-side model detects phone usage, multiple people, and gaze deviation. Web Audio API flags talking in real time.',
    link: '/assessment',
    linkLabel: 'View Security →',
    colorClass: 'rgba(139,92,246,0.12)',
    textColor: 'var(--accent-2)',
  },
  {
    icon: '🤝',
    title: 'AI Matchmaker',
    description: 'Employers describe requirements in plain English. The AI semantically ranks candidates by verified skill scores and profile insights.',
    link: '/dashboard',
    linkLabel: 'Open Dashboard →',
    colorClass: 'rgba(16,185,129,0.12)',
    textColor: 'var(--accent-3)',
  },
]

const howItWorks = [
  { step: '01', title: 'Register & Upload Resume', desc: 'Create your account in seconds. Upload your resume — AI automatically extracts skills and builds your verified profile.' },
  { step: '02', title: 'Take the Proctored Test', desc: 'Choose your skill domain and difficulty. Complete the timed, camera-monitored assessment to earn a verified score badge.' },
  { step: '03', title: 'Get Matched', desc: 'Your score appears in employer search results ranked by AI. Receive interview invites directly through the platform.' },
]

export default function Home({ user }) {
  const [tick, setTick] = useState(0)

  // Animate counters only once on load
  useEffect(() => {
    const t = setTimeout(() => setTick(1), 150)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="space-y-24 pb-24">

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pt-12 text-center space-y-8 animate-fade-in-up">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold"
          style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: 'var(--accent)' }}>
          🚀 Next-Generation Hiring Pipeline
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-tight" style={{ color: 'var(--text-primary)' }}>
          Hire for
          <span style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #10b981 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}> Talent,</span>
          <br />Not Degrees.
        </h1>

        <p className="text-lg md:text-xl max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          True Hire verifies real-world skills through AI-proctored assessments.
          Connect practical talent directly with employers who care about what you <em>can do</em>, not where you studied.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          {user ? (
            <>
              <Link to="/assessment" className="btn flex items-center gap-2 text-sm px-8 py-4"
                style={{ background: 'var(--accent)', color: '#fff' }}>
                Take Assessment ▶️
              </Link>
              <Link to="/dashboard" className="btn-ghost flex items-center gap-2 text-sm px-8 py-4">
                Open Dashboard 📊
              </Link>
            </>
          ) : (
            <>
              <Link to="/sign" className="btn flex items-center gap-2 text-sm px-8 py-4"
                style={{ background: 'var(--accent)', color: '#fff' }}>
                Get Started Free →
              </Link>
            </>
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
          {['Skills-Validated', 'AI Proctoring', 'Zero Bias', 'Auto Scheduling', 'LLM Feedback'].map(t => (
            <span key={t} className="chip px-4 py-2 font-medium text-xs">✨ {t}</span>
          ))}
        </div>
      </section>

      {/* ── Stats Row ─────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <div
              key={i}
              className="card p-6 text-center"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="text-3xl font-extrabold mb-1" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Feature Cards ─────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold tracking-tight mb-3" style={{ color: 'var(--text-primary)' }}>
            Everything you need to hire smarter
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Built from the ground up with AI at every step.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div key={i} className="card p-8 flex flex-col justify-between space-y-5">
              <div className="space-y-3">
                <div
                  className="h-12 w-12 rounded-2xl text-2xl grid place-items-center"
                  style={{ background: f.colorClass }}
                >
                  {f.icon}
                </div>
                <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{f.description}</p>
              </div>
              <Link
                to={f.link}
                className="text-xs font-bold flex items-center gap-1.5 group transition-all duration-200 hover:gap-2.5"
                style={{ color: f.textColor }}
              >
                {f.linkLabel}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6">
        <div className="card p-10 md:p-14" style={{ background: 'linear-gradient(135deg, #0b0f19, #111827)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-white tracking-tight mb-3">How it works</h2>
            <p className="text-sm text-neutral-400">Three simple steps to your next hire.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {howItWorks.map((h, i) => (
              <div key={i} className="flex flex-col gap-3">
                <div
                  className="text-4xl font-black"
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {h.step}
                </div>
                <h3 className="font-bold text-white">{h.title}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">{h.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              to={user ? '/assessment' : '/sign'}
              className="inline-flex items-center gap-2 btn px-8 py-4 text-sm"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {user ? 'Take Your First Assessment ▶️' : 'Create Free Account →'}
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
