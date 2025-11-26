import React from 'react'

export default function Footer(){
  return (
    <footer className="border-t bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto px-4 py-6 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} TrueHire • AI Skill Tests
      </div>
    </footer>
  )
}
