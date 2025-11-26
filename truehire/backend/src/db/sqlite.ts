import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'truehire.db')

// initialize DB and tables
const db = new Database(DB_PATH)

// seen_questions: store user -> question_hash and text to avoid repeats
db.prepare(`CREATE TABLE IF NOT EXISTS seen_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user TEXT NOT NULL,
  question_hash TEXT NOT NULL,
  question_text TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`).run()

// generated_questions: store generated questions for audit/lookup
db.prepare(`CREATE TABLE IF NOT EXISTS generated_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user TEXT,
  question_text TEXT,
  options TEXT,
  correct TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`).run()

// results table for assessment attempts
db.prepare(`CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT,
  user_name TEXT,
  skill TEXT,
  difficulty TEXT,
  score INTEGER,
  total INTEGER,
  date TEXT
)`).run()

export function getSeenHashes(user: string){
  const rows = db.prepare('SELECT question_hash FROM seen_questions WHERE user = ?').all(user)
  return new Set(rows.map((r:any) => r.question_hash))
}

export function addSeenHash(user: string, hash: string, questionText?: string){
  try{
    db.prepare('INSERT INTO seen_questions(user, question_hash, question_text) VALUES (?, ?, ?)').run(user, hash, questionText || null)
  }catch(e){ /* ignore duplicate or constraint errors */ }
}

export function saveGeneratedQuestion(user: string, questionText: string, options: any[], correct: string){
  try{
    db.prepare('INSERT INTO generated_questions(user, question_text, options, correct) VALUES (?, ?, ?, ?)').run(user, questionText, JSON.stringify(options||[]), correct)
  }catch(e){ /* ignore */ }
}

export function saveResult(result: { userEmail?: string, userName?: string, skill?: string, difficulty?: string, score?: number, total?: number, date?: string }){
  try{
    db.prepare('INSERT INTO results(user_email, user_name, skill, difficulty, score, total, date) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(result.userEmail || null, result.userName || null, result.skill || null, result.difficulty || null, result.score || 0, result.total || 0, result.date || new Date().toISOString())
  }catch(e){}
}

export function getTopResultsBySkill(skill: string, limit = 5){
  const rows = db.prepare(`SELECT user_name, user_email, score, total, date FROM results WHERE skill = ? ORDER BY (CAST(score AS FLOAT) / NULLIF(total,0)) DESC, date DESC LIMIT ?`).all(skill, limit)
  return rows
}

export default db
