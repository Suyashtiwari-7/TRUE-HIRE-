import { Router } from 'express'
import OpenAI from 'openai'
import crypto from 'crypto'
import { getSeenHashes, addSeenHash, saveGeneratedQuestion } from '../db/sqlite'

const router = Router()

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })


function hashText(text:string){
  return crypto.createHash('sha256').update(text).digest('hex')
}

router.post('/questions', async (req, res) => {
  const { topic = 'React', difficulty = '1', count = 5, userId = 'global' } = req.body || {}
  const userKey = String(userId || 'global')
  const seenHashes = getSeenHashes(userKey)

  // model prompt; we ask for JSON only and request uniqueness guidance
  const buildPrompt = (cnt:number) => `You are an exam generator. Produce ${cnt} multiple-choice questions about ${topic} at difficulty ${difficulty}. Return ONLY valid JSON: an array of objects with keys "question" (string), "options" (array of 4 strings), and "correct" (string that exactly matches one option). Make sure the questions are varied and do not repeat common phrasings. Do not add any explanatory text.`

  const maxAttempts = 5
  const collected: any[] = []

  try{
    for(let attempt=0; attempt<maxAttempts && collected.length < count; attempt++){
      const remaining = count - collected.length
      // on retries ask for a larger batch to improve chances of unseen items
      const requestCount = attempt === 0 ? remaining : Math.max(remaining * 3, remaining)
      const prompt = buildPrompt(requestCount)

      const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500,
        temperature: 0.85,
        top_p: 0.95
      })

      const text = (completion as any)?.choices?.[0]?.message?.content || (completion as any)?.choices?.[0]?.text || ''

      let parsed
      try{ parsed = JSON.parse(text) }catch(err){
        const start = text.indexOf('[')
        const end = text.lastIndexOf(']')
        if(start !== -1 && end !== -1){
          const sub = text.slice(start, end+1)
          parsed = JSON.parse(sub)
        } else {
          // if no JSON found, skip this attempt
          continue
        }
      }

      if(!Array.isArray(parsed)) continue

      // filter out items already seen by this user (using DB-backed seen hashes)
      for(const q of parsed){
        if(!q || !q.question) continue
        const qText = String(q.question)
        const h = hashText(qText)
        if(seenHashes.has(h)) continue
        const item = { question: qText, options: Array.isArray(q.options) ? q.options.slice(0,4).map(String) : [], correct: String(q.correct || '') }
        collected.push(item)
        // persist seen and the generated question
        try{ addSeenHash(userKey, h, qText); saveGeneratedQuestion(userKey, qText, item.options, item.correct); }catch(e){ }
        // also mark in-memory to avoid duplicates in this run
        seenHashes.add(h)
        if(collected.length >= count) break
      }
    }

    if(collected.length === 0){
      return res.status(500).json({ ok: false, error: 'no generated questions available' })
    }

    return res.json({ ok: true, questions: collected.slice(0, count) })
  }catch(err:any){
    console.error('generate questions error', err?.message || err)
    return res.status(500).json({ ok: false, error: String(err?.message || err) })
  }
})

export default router
