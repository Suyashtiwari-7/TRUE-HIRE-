import React from 'react'
import { Link } from 'react-router-dom'

export default function Navbar(){
  return (
    <header className="bg-white shadow-sm">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="text-xl font-extrabold text-slate-900">TrueHire</Link>
        <nav className="space-x-4 text-sm">
          <Link to="/" className="text-slate-600 hover:text-slate-900">Home</Link>
          <Link to="/dashboard" className="text-slate-600 hover:text-slate-900">Dashboard</Link>
          <Link to="/test" className="text-slate-600 hover:text-slate-900">Take Test</Link>
          <Link to="/login" className="text-slate-600 hover:text-slate-900">Login</Link>
        </nav>
      </div>
    </header>
  )
}
