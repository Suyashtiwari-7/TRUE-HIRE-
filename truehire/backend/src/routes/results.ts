import { Router } from 'express'
import db, { saveResult, saveAttempt, banUser, checkBanStatus, getMonthlyAverages } from '../db/sqlite'

const router = Router()

// GET /api/results - Get all test results (ordered by date DESC)
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT user_email AS userEmail, user_name AS userName, skill, difficulty, score, total, date FROM results ORDER BY date DESC').all()
    return res.json({ ok: true, results: rows })
  } catch (err: any) {
    console.error('Error fetching results:', err)
    return res.status(500).json({ ok: false, error: 'Database query failed' })
  }
})

// GET /api/results/user/:email - Get test results for a specific candidate
router.get('/user/:email', (req, res) => {
  try {
    const email = req.params.email
    if (!email) {
      return res.status(400).json({ ok: false, error: 'Missing email' })
    }
    const rows = db.prepare('SELECT user_email AS userEmail, user_name AS userName, skill, difficulty, score, total, date FROM results WHERE user_email = ? ORDER BY date DESC').all(email)
    return res.json({ ok: true, results: rows })
  } catch (err: any) {
    console.error('Error fetching user results:', err)
    return res.status(500).json({ ok: false, error: 'Database query failed' })
  }
})

// GET /api/results/user/:email/ban-status - Check if user is currently proctor-banned
router.get('/user/:email/ban-status', (req, res) => {
  try {
    const email = req.params.email
    if (!email) return res.status(400).json({ ok: false, error: 'Missing email' })
    const status = checkBanStatus(email)
    return res.json({ ok: true, ...status })
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Failed to check ban status' })
  }
})

// POST /api/results/user/:email/ban - Impose a 24-hour proctoring ban on candidate
router.post('/user/:email/ban', (req, res) => {
  try {
    const email = req.params.email
    if (!email) return res.status(400).json({ ok: false, error: 'Missing email' })
    banUser(email, 24) // 24 hours ban
    return res.json({ ok: true, message: 'Candidate banned for 24 hours due to proctoring violation' })
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Failed to impose ban' })
  }
})

// GET /api/results/user/:email/growth - Fetch monthly averages for the growth chart
router.get('/user/:email/growth', (req, res) => {
  try {
    const email = req.params.email
    if (!email) return res.status(400).json({ ok: false, error: 'Missing email' })
    const rows = getMonthlyAverages(email)
    return res.json({ ok: true, growth: rows })
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Failed to fetch growth history' })
  }
})

// POST /api/results - Create/log a new test result
router.post('/', (req, res) => {
  try {
    const { userEmail, userName, skill, difficulty, score, total, date } = req.body || {}
    if (!userEmail) {
      return res.status(400).json({ ok: false, error: 'Missing userEmail' })
    }

    // Save in general results table
    saveResult({ userEmail, userName, skill, difficulty, score: Number(score || 0), total: Number(total || 0), date })

    // Also save in attempts logs for growth tracking
    // Difficulty is Stage (1: Easy, 2: Medium, 3: Hard)
    const stageNum = isNaN(Number(difficulty)) ? 1 : Number(difficulty)
    saveAttempt(userEmail, skill || 'General', stageNum, Number(score || 0), Number(total || 0), date || new Date().toISOString())

    return res.json({ ok: true })
  } catch (err: any) {
    console.error('Error saving result:', err)
    return res.status(500).json({ ok: false, error: 'Database save failed' })
  }
})

export default router
