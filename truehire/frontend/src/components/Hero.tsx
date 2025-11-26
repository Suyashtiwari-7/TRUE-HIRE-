import React from 'react'
import { Link } from 'react-router-dom'
import Button from './Button'

export default function Hero(){
  return (
    <section className="py-14">
      <div className="text-center max-w-3xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
          TrueHire — AI Skill Tests
        </h1>
        <p className="mt-4 text-slate-600">
          Create or take proctored skill assessments powered by AI. Web-based, fast, and privacy-conscious.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link to="/test">
            <Button variant="primary">Start a Test</Button>
          </Link>
          <Link to="/login">
            <Button variant="secondary">Sign In</Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
