import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import bodyParser from 'body-parser'
import usersRoutes from './routes/users'
import generateRoutes from './routes/generate'
import resultsRoutes from './routes/results'
import interviewsRoutes from './routes/interviews'
import proctorRoutes from './routes/proctor'

// Load environment variables before routes use them
dotenv.config()

const app = express()

app.use(cors())
app.use(bodyParser.json())

// Health check
app.get('/', (_req, res) => res.json({ ok: true, service: 'True Hire API', version: '1.0.0' }))

// API Routes
app.use('/api/users',      usersRoutes)
app.use('/api/generate',   generateRoutes)
app.use('/api/results',    resultsRoutes)
app.use('/api/interviews', interviewsRoutes)
app.use('/api/proctor',    proctorRoutes)

const port = process.env.BACKEND_PORT || 4000
app.listen(port, () => console.log(`✅ True Hire backend listening on port ${port}`))
