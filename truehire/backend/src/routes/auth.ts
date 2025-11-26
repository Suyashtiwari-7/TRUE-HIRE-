import { Router } from 'express'

const router = Router()

// Lightweight auth router kept for compatibility during local development.
// Replace with real auth logic when integrating a user system.
router.get('/health', (req, res) => res.json({ ok: true, route: 'auth' }))

router.post('/login', (req, res) => res.json({ ok: true, message: 'login placeholder' }))
router.post('/register', (req, res) => res.json({ ok: true, message: 'register placeholder' }))

export default router
