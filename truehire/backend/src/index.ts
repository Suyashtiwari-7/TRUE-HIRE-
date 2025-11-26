import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import bodyParser from 'body-parser'

// load environment variables first so route modules (which may read process.env)
// receive the values when they are required below.
dotenv.config()

// require routes after dotenv.config() so any route module that instantiates
// clients using env vars (e.g. OpenAI) will see the loaded variables.
let authRoutes: any
let testRoutes: any
let generateRoutes: any
let usersRoutes: any
try {
	// Use require to defer module evaluation until after dotenv.config()
	// (this avoids importing modules that expect env vars before dotenv runs)
	// TypeScript transpiles these requires correctly under ts-node-dev.
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	authRoutes = require('./routes/auth').default
} catch (e) {
	// fallback to a minimal router if file missing
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const expressReq = require('express')
	authRoutes = expressReq.Router()
	authRoutes.get('/', (req: any, res: any) => res.json({ ok: true }))
}

try {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	usersRoutes = require('./routes/users').default
} catch (e) {
	const expressReq = require('express')
	usersRoutes = expressReq.Router()
	usersRoutes.delete('/:email', (req: any, res: any) => res.status(501).json({ ok: false, error: 'users route not implemented' }))
}

try {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	testRoutes = require('./routes/test').default
} catch (e) {
	// fallback minimal
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const expressReq = require('express')
	testRoutes = expressReq.Router()
	testRoutes.get('/ping', (req: any, res: any) => res.json({ ok: true, pong: Date.now() }))
}

try {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	generateRoutes = require('./routes/generate').default
} catch (e) {
	// if generate route is missing, provide a 501 placeholder
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const expressReq = require('express')
	generateRoutes = expressReq.Router()
	generateRoutes.post('/questions', (req: any, res: any) => res.status(501).json({ ok: false, error: 'generate route not available' }))
}

const app = express()
app.use(cors())
app.use(bodyParser.json())

app.use('/api/auth', authRoutes)
app.use('/api/test', testRoutes)
app.use('/api/generate', generateRoutes)
app.use('/api/users', usersRoutes)

app.get('/', (req,res)=> res.json({ ok: true }))

const port = process.env.BACKEND_PORT || 4000
app.listen(port, ()=> console.log(`Backend listening on ${port}`))
