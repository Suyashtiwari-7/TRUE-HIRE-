import React from 'react'
import Hero from '../components/Hero'

function FeatureCard({ title, desc }: { title: string, desc: string }){
  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-slate-600 text-sm">{desc}</p>
    </div>
  )
}

export default function Home(){
  return (
    <div>
      <Hero />
      <section className="pb-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard title="AI Questions" desc="Auto-generate or curate questions using modern AI models." />
          <FeatureCard title="Proctoring" desc="Webcam presence, tab-switch, and face detection warnings." />
          <FeatureCard title="Results & Scoring" desc="Clear scores with rule-based weighting and reviewable answers." />
        </div>
      </section>
    </div>
  )
}
