import { Router } from 'express'

const router = Router()

// Simple test routes used in local development.
router.get('/', (req, res) => res.json({ ok: true, route: 'test' }))
router.get('/ping', (req, res) => res.json({ ok: true, pong: Date.now() }))

export default router
