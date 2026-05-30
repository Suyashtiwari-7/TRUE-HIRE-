import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(__dirname, '..', '..', 'data')
const DB_FILE = path.join(DATA_DIR, 'db.json')

// Ensure directory and db.json exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

interface Schema {
  results: any[]
  user_bans: any[]
  attempts: any[]
  interviews: any[]
}

function readDb(): Schema {
  if (!fs.existsSync(DB_FILE)) {
    const init: Schema = {
      results: [],
      user_bans: [],
      attempts: [],
      interviews: []
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(init, null, 2))
    return init
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'))
  } catch (e) {
    return {
      results: [],
      user_bans: [],
      attempts: [],
      interviews: []
    }
  }
}

function writeDb(data: Schema) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2))
}

// ── Results ──────────────────────────────────────────────────────────────
export function saveResult(result: { userEmail?: string; userName?: string; skill?: string; difficulty?: string; score?: number; total?: number; date?: string }) {
  try {
    const data = readDb()
    data.results.push({
      id: Date.now() + Math.random(),
      user_email: result.userEmail || null,
      user_name: result.userName || null,
      skill: result.skill || null,
      difficulty: result.difficulty || null,
      score: result.score || 0,
      total: result.total || 0,
      date: result.date || new Date().toISOString()
    })
    writeDb(data)
  } catch (e) {}
}

export function getTopResultsBySkill(skill: string, limit = 5) {
  const data = readDb()
  const rows = data.results.filter((r) => r.skill === skill)
  
  rows.sort((a, b) => {
    const pa = a.score / Math.max(1, a.total)
    const pb = b.score / Math.max(1, b.total)
    if (pa === pb) return new Date(b.date).getTime() - new Date(a.date).getTime()
    return pb - pa
  })

  return rows.slice(0, limit).map((r) => ({
    user_name: r.user_name,
    user_email: r.user_email,
    score: r.score,
    total: r.total,
    date: r.date
  }))
}

/** Read all results (email = null) or filtered by a specific user email */
export function readResultsForUser(email: string | null) {
  const data = readDb()
  if (!email) return data.results
  return data.results.filter((r) => r.user_email === email)
}


// Ban helper functions
export function banUser(email: string, durationHours: number) {
  const data = readDb()
  const until = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString()
  
  const idx = data.user_bans.findIndex((b) => b.email === email)
  if (idx !== -1) {
    data.user_bans[idx].banned_until = until
  } else {
    data.user_bans.push({ email, banned_until: until })
  }
  
  writeDb(data)
}

export function checkBanStatus(email: string): { banned: boolean; remainingMs: number } {
  const data = readDb()
  const ban = data.user_bans.find((b) => b.email === email)
  if (!ban) return { banned: false, remainingMs: 0 }
  
  const expiry = new Date(ban.banned_until).getTime()
  const now = Date.now()
  if (expiry > now) {
    return { banned: true, remainingMs: expiry - now }
  } else {
    // Ban expired, remove record
    data.user_bans = data.user_bans.filter((b) => b.email !== email)
    writeDb(data)
    return { banned: false, remainingMs: 0 }
  }
}

// Attempts helper functions
export function saveAttempt(email: string, skill: string, stage: number, score: number, total: number, date: string) {
  try {
    const data = readDb()
    data.attempts.push({
      id: Date.now() + Math.random(),
      email,
      skill,
      stage,
      score,
      total,
      date
    })
    writeDb(data)
  } catch (e) {}
}

export function getAttempts(email: string) {
  const data = readDb()
  return data.attempts.filter((a) => a.email === email)
}

export function getMonthlyAverages(email: string) {
  const data = readDb()
  const userAttempts = data.attempts.filter((a) => a.email === email)
  
  // Group by month
  const monthlyGroups: { [month: string]: { sum: number; count: number } } = {}
  
  userAttempts.forEach((a) => {
    try {
      const month = new Date(a.date).toISOString().substring(0, 7) // YYYY-MM
      const pct = (a.score / Math.max(1, a.total)) * 100
      if (!monthlyGroups[month]) {
        monthlyGroups[month] = { sum: 0, count: 0 }
      }
      monthlyGroups[month].sum += pct
      monthlyGroups[month].count += 1
    } catch (e) {}
  })

  // Format array
  const rows = Object.keys(monthlyGroups).map((month) => ({
    month,
    avgScore: monthlyGroups[month].sum / monthlyGroups[month].count
  }))

  rows.sort((a, b) => a.month.localeCompare(b.month))
  return rows
}

// Interviews helper functions
export function scheduleInterview(employer: string, candidate: string, dateTime: string, notes?: string) {
  try {
    const data = readDb()
    data.interviews.push({
      id: Date.now() + Math.random(),
      employer_email: employer,
      candidate_email: candidate,
      date_time: dateTime,
      notes: notes || null,
      created_at: new Date().toISOString()
    })
    writeDb(data)
  } catch (e) {}
}

// SQLite prepare emulation layer for users.ts and results.ts
export const db = {
  prepare(sql: string) {
    return {
      all(...args: any[]) {
        const data = readDb()
        
        if (sql.includes('FROM results') && sql.includes('WHERE user_email = ?')) {
          const email = args[0]
          return data.results
            .filter((r) => r.user_email === email)
            .map((r) => ({
              userEmail: r.user_email,
              userName: r.user_name,
              skill: r.skill,
              difficulty: r.difficulty,
              score: r.score,
              total: r.total,
              date: r.date
            }))
        }
        
        if (sql.includes('FROM results')) {
          return data.results.map((r) => ({
            userEmail: r.user_email,
            userName: r.user_name,
            skill: r.skill,
            difficulty: r.difficulty,
            score: r.score,
            total: r.total,
            date: r.date
          }))
        }

        if (sql.includes('FROM interviews') && (sql.includes('employer_email = ?') || sql.includes('candidate_email = ?'))) {
          const email = args[0]
          return data.interviews
            .filter((i) => i.employer_email === email || i.candidate_email === email)
            .map((i) => ({
              id: i.id,
              employerEmail: i.employer_email,
              candidateEmail: i.candidate_email,
              dateTime: i.date_time,
              notes: i.notes
            }))
        }

        if (sql.includes('FROM interviews')) {
          return data.interviews.map((i) => ({
            id: i.id,
            employerEmail: i.employer_email,
            candidateEmail: i.candidate_email,
            dateTime: i.date_time,
            notes: i.notes
          }))
        }

        return []
      },
      
      run(...args: any[]) {
        const data = readDb()
        
        if (sql.includes('DELETE FROM results WHERE user_email = ?')) {
          const email = args[0]
          data.results = data.results.filter((r) => r.user_email !== email)
        }

        writeDb(data)
        return { changes: 1 }
      }
    }
  }
}

export default db
