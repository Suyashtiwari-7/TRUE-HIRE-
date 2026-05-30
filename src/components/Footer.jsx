export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-surface)', transition: 'all 0.35s ease' }}>
      <div className="mx-auto max-w-6xl px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className="h-7 w-7 rounded-full grid place-items-center text-sm"
            style={{ background: 'var(--text-primary)', color: 'var(--bg-base)' }}
          >
            🎓
          </div>
          <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>TRUE HIRE</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>— Final Year Project MVP</span>
        </div>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          © 2025 True Hire · Built with React + TensorFlow.js + AI
        </div>
      </div>
    </footer>
  )
}
