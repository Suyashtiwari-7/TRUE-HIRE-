import React, { useState } from 'react'

export default function TestPage(){
  const [started, setStarted] = useState(false)
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">Take a Test</h1>
      {!started ? (
        <div className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
          <p className="text-slate-600">This is a quick preflight. We’ll request camera access when the test begins. Make sure your face is visible and you’re in a quiet place.</p>
          <button className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-700" onClick={() => setStarted(true)}>Start Test</button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="rounded-lg border bg-white p-4 shadow-sm">Camera preview (coming soon)</div>
          <div className="rounded-lg border bg-white p-4 shadow-sm">Question 1 (example)</div>
        </div>
      )}
    </div>
  )
}
