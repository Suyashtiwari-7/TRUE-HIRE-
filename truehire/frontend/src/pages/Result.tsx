import React from 'react'

export default function Result(){
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">Result</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-white p-6 text-center shadow-sm">
          <div className="text-sm text-slate-500">Overall Score</div>
          <div className="mt-2 text-4xl font-extrabold text-slate-900">78</div>
        </div>
        <div className="rounded-lg border bg-white p-6 shadow-sm">Chart (coming soon)</div>
      </div>
      <div className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold text-slate-700">Breakdown</div>
        <ul className="mt-2 list-disc pl-5 text-sm text-slate-600 space-y-1">
          <li>Correct answers: 15/20</li>
          <li>Proctoring flags: 0</li>
          <li>Time taken: 11m 40s</li>
        </ul>
      </div>
    </div>
  )
}
