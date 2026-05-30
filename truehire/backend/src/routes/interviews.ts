import { Router } from 'express'
import db, { scheduleInterview } from '../db/sqlite'

const router = Router()

// GET /api/interviews - List all scheduled interviews (for dev/audits)
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT id, employer_email AS employerEmail, candidate_email AS candidateEmail, date_time AS dateTime, notes FROM interviews ORDER BY date_time ASC').all()
    return res.json({ ok: true, interviews: rows })
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Database query failed' })
  }
})

// GET /api/interviews/user/:email - Retrieve interviews for a candidate or employer
router.get('/user/:email', (req, res) => {
  try {
    const email = req.params.email
    if (!email) return res.status(400).json({ ok: false, error: 'Missing email' })
    
    const rows = db.prepare(`
      SELECT id, employer_email AS employerEmail, candidate_email AS candidateEmail, date_time AS dateTime, notes 
      FROM interviews 
      WHERE employer_email = ? OR candidate_email = ? 
      ORDER BY date_time ASC
    `).all(email, email)
    return res.json({ ok: true, interviews: rows })
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Database query failed' })
  }
})

// POST /api/interviews/schedule - Schedule a new interview slot
router.post('/schedule', (req, res) => {
  try {
    const { employerEmail, candidateEmail, dateTime, notes } = req.body || {}
    if (!employerEmail || !candidateEmail || !dateTime) {
      return res.status(400).json({ ok: false, error: 'Missing employerEmail, candidateEmail, or dateTime' })
    }

    scheduleInterview(employerEmail, candidateEmail, dateTime, notes)
    return res.json({ ok: true, message: 'Interview scheduled successfully' })
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Database insert failed' })
  }
})

export default router
