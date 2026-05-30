import { Router } from 'express'
import db from '../db/sqlite'

const router = Router()

// Delete user-related data (results, seen_questions, generated_questions, messages if present)
router.delete('/:email', (req, res) => {
  try {
    const email = req.params.email
    if (!email) return res.status(400).json({ ok: false, error: 'missing email' })

    // delete from results
    try { db.prepare('DELETE FROM results WHERE user_email = ?').run(email) } catch (e) { /* ignore */ }
    // delete seen questions
    try { db.prepare('DELETE FROM seen_questions WHERE user = ?').run(email) } catch (e) { /* ignore */ }
    // delete generated questions
    try { db.prepare('DELETE FROM generated_questions WHERE user = ?').run(email) } catch (e) { /* ignore */ }
    // if there's a messages table, attempt to delete messages where from or to matches
    try { db.prepare("DELETE FROM messages WHERE from_email = ? OR to_email = ?").run(email, email) } catch (e) { /* ignore */ }

    return res.json({ ok: true })
  } catch (err) {
    console.error('Error deleting user data', err)
    return res.status(500).json({ ok: false, error: 'internal error' })
  }
})

export default router
