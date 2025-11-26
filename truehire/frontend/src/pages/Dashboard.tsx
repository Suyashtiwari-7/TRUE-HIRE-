import React from 'react'
import { Link } from 'react-router-dom'

export default function Dashboard(){
  const cards = [
    { title: 'Take a New Test', desc: 'Pick a topic and start a proctored assessment.', to: '/test' },
    { title: 'Results', desc: 'Review scores and answers for completed tests.', to: '/result/123' },
    { title: 'Profile', desc: 'Update your details and preferences.', to: '/dashboard' }
  ]
  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(c => (
          <Link key={c.title} to={c.to} className="rounded-lg border bg-white p-5 shadow-sm hover:shadow transition-shadow">
            <div className="text-lg font-semibold text-slate-900">{c.title}</div>
            <div className="mt-1 text-slate-600 text-sm">{c.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
