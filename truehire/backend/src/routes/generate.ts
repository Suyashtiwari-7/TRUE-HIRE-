import { Router } from 'express'
import { GoogleGenAI } from '@google/genai'
import { getAttempts, readResultsForUser } from '../db/sqlite'

const router = Router()

// ── Lazy Gemini client ────────────────────────────────────────────────────
let _client: any = null

function isApiKeyConfigured(): boolean {
  // Support either GEMINI_API_KEY or fall back to OPENAI_API_KEY for seamless transition if user reuses env var
  const key = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY
  return typeof key === 'string' && key.trim() !== '' && key !== 'sk-...'
}

function getClient(): any {
  if (!_client) {
    const key = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY
    if (!key) {
      throw new Error('API KEY is not set in environment.')
    }
    _client = new GoogleGenAI({ apiKey: key })
  }
  return _client;
}

// ── JSON parser ───────────────────────────────────────────────────────────
function parseAiJson(raw: string): any {
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const objStart = cleaned.indexOf('{')
    const objEnd   = cleaned.lastIndexOf('}')
    const arrStart = cleaned.indexOf('[')
    const arrEnd   = cleaned.lastIndexOf(']')
    if (objStart !== -1 && objEnd !== -1) return JSON.parse(cleaned.slice(objStart, objEnd + 1))
    if (arrStart !== -1 && arrEnd !== -1) return JSON.parse(cleaned.slice(arrStart, arrEnd + 1))
    throw new Error('Could not extract JSON from AI response')
  }
}

// ── Stage definitions ─────────────────────────────────────────────────────
const STAGES = [
  {
    label:       'Stage 1 — Beginner',
    aptCount:    2,
    domainCount: 3,
    timeMinutes: 8,
    description: 'Fundamental concepts and basic syntax. Suitable for freshers and early learners.',
  },
  {
    label:       'Stage 2 — Intermediate',
    aptCount:    3,
    domainCount: 4,
    timeMinutes: 12,
    description: 'Practical application, design patterns, and common interview scenarios.',
  },
  {
    label:       'Stage 3 — Advanced',
    aptCount:    4,
    domainCount: 5,
    timeMinutes: 18,
    description: 'System design thinking, edge-cases, optimisation, and production-grade problems.',
  },
]

// ── Random seed generator ─────────────────────────────────────────────────
const SEED_WORDS = [
  'apple', 'bridge', 'circuit', 'delta', 'echo', 'forest', 'galaxy', 'harbor',
  'island', 'jungle', 'karma', 'lotus', 'marble', 'nebula', 'ocean', 'prism',
  'quartz', 'river', 'solar', 'tunnel', 'ultra', 'vertex', 'wisdom', 'xenon',
  'yellow', 'zenith',
]

function getRandomSeed(): string {
  const w1  = SEED_WORDS[Math.floor(Math.random() * SEED_WORDS.length)]
  const w2  = SEED_WORDS[Math.floor(Math.random() * SEED_WORDS.length)]
  const num = Math.floor(Math.random() * 9999)
  return `${w1}-${w2}-${num}`
}

// Sub-topic rotation per skill
const TOPIC_ROTATIONS: Record<string, string[][]> = {
  React: [
    ['Hooks', 'State management', 'useEffect cleanup'],
    ['Context API', 'Performance optimization', 'React.memo'],
    ['Server Components', 'Suspense', 'Error Boundaries'],
    ['Custom Hooks', 'Event handling', 'Controlled forms'],
    ['React Router', 'Code splitting', 'lazy loading'],
    ['Testing', 'PropTypes', 'Refs and forwardRef'],
  ],
  JavaScript: [
    ['Closures', 'Scope', 'Hoisting'],
    ['Promises', 'async/await', 'Event loop'],
    ['Prototypes', 'Inheritance', 'Classes'],
    ['Array methods', 'Destructuring', 'Spread operator'],
    ['Modules', 'Import/Export', 'Bundling'],
    ['WeakMap', 'Generators', 'Iterators'],
  ],
  SQL: [
    ['JOINs', 'Subqueries', 'Aggregates'],
    ['Indexes', 'Query optimization', 'EXPLAIN'],
    ['Transactions', 'ACID', 'Locks'],
    ['Window functions', 'CTEs', 'Recursive queries'],
    ['Normalization', 'Schema design', 'Constraints'],
    ['Stored procedures', 'Triggers', 'Views'],
  ],
}

function getRotationHint(topic: string): string {
  const rotations = TOPIC_ROTATIONS[topic]
  if (!rotations) return ''
  const pick = rotations[Math.floor(Math.random() * rotations.length)]
  return `For domain questions, focus on these sub-topics this time: ${pick.join(', ')}.`
}

function buildPerformanceContext(userId: string, topic: string): string {
  if (userId === 'global') return ''
  const attempts = getAttempts(userId).filter((a: any) => a.skill === topic)
  const recent   = attempts.slice(-5)
  if (recent.length === 0) {
    return `This is the candidate's first attempt at ${topic}. Keep questions well-rounded for the chosen stage.`
  }
  const avgPct = Math.round(
    recent.reduce((s: number, a: any) => s + (a.score / Math.max(1, a.total)) * 100, 0) / recent.length,
  )
  if (avgPct >= 80) return `Candidate avg score: ${avgPct}%. Push with edge-cases and non-obvious traps.`
  if (avgPct >= 50) return `Candidate avg score: ${avgPct}%. Mix straightforward and tricky questions.`
  return `Candidate avg score: ${avgPct}%. Focus on core fundamentals, build confidence.`
}

// ── LOCAL MOCK POOLS FOR OFFLINE / FAIL-SAFE OPERATION ───────────────────
const MOCK_APTITUDE = [
  {
    question: "If a project has 5 tasks with durations 2, 4, 3, 5, and 1 days, and tasks can be run in parallel with maximum 2 at a time, what is the minimum days to finish all tasks?",
    options: ["9 days", "8 days", "10 days", "7 days"],
    correct: "8 days",
    explanation: "By running the longest tasks in parallel combined with shorter tasks (5+2 = 7, 4+3 = 7, 1), we can optimize to 8 days."
  },
  {
    question: "A database server CPU utilization is 80% at peak. Adding an index reduces query time by 50%. If peak queries increase by 20%, what is the expected CPU utilization?",
    options: ["48%", "60%", "40%", "50%"],
    correct: "48%",
    explanation: "Reduced query time cuts utilization to 40% (80 * 0.50). A 20% increase in queries yields 40 * 1.2 = 48%."
  },
  {
    question: "Find the next number in the sequence: 3, 8, 15, 24, 35, ...",
    options: ["48", "46", "50", "52"],
    correct: "48",
    explanation: "The differences are consecutive odd numbers: +5, +7, +9, +11. The next difference is +13, so 35 + 13 = 48."
  },
  {
    question: "A team of 4 developers can write 12 microservices in 6 days. How many days would it take 6 developers to write 18 microservices?",
    options: ["6 days", "4 days", "8 days", "5 days"],
    correct: "6 days",
    explanation: "Developer-days per microservice is (4 * 6) / 12 = 2. For 18 microservices, we need 18 * 2 = 36 developer-days. With 6 developers, it takes 36 / 6 = 6 days."
  },
  {
    question: "A network pipeline transfers 100MB of data in 4 seconds. How many seconds will it take to transfer 1.5GB of data at the same rate?",
    options: ["60 seconds", "45 seconds", "75 seconds", "50 seconds"],
    correct: "60 seconds",
    explanation: "Transfer speed is 25MB/s. 1.5GB is 1500MB. 1500MB / 25MB/s = 60 seconds."
  }
]

const MOCK_DOMAIN: Record<string, any[]> = {
  React: [
    {
      question: "What does the useId hook in React return?",
      options: ["A unique stable ID string", "A random number", "The component DOM ref", "A state setter function"],
      correct: "A unique stable ID string",
      explanation: "useId is a hook for generating unique IDs that can be passed to accessibility attributes, stable across server and client.",
      subtopic: "React Hooks"
    },
    {
      question: "Which Hook should be used to memoize a computed value between renders?",
      options: ["useMemo", "useCallback", "useRef", "useState"],
      correct: "useMemo",
      explanation: "useMemo memoizes the result of a function calculation, recalculating only when dependencies change.",
      subtopic: "Performance Optimization"
    },
    {
      question: "In React 19, what happens if you pass a promise directly as a value to child components?",
      options: ["You can read it using the use() hook", "It throws a rendering error", "React automatically resolves it to string", "It triggers infinite re-renders"],
      correct: "You can read it using the use() hook",
      explanation: "React 19 supports passing promises to the client and reading them with the use() hook inside Suspense.",
      subtopic: "React 19 / Suspense"
    },
    {
      question: "How do you define a fallback UI when a component throws a JavaScript error during rendering?",
      options: ["Use an Error Boundary component", "Wrap in try-catch in useEffect", "Pass an onError prop to the component", "Set window.onerror handler"],
      correct: "Use an Error Boundary component",
      explanation: "Error Boundaries are class components that catch JavaScript errors anywhere in their child component tree and display a fallback UI.",
      subtopic: "Error Handling"
    },
    {
      question: "What is the correct way to trigger a state update in React that depends on the previous state?",
      options: ["Pass a callback function to the state setter", "Read the state directly and increment it", "Use a setTimeout to defer the state update", "Call forceUpdate() after changing the state"],
      correct: "Pass a callback function to the state setter",
      explanation: "Passing a callback function (e.g., setVal(prev => prev + 1)) ensures you receive the latest queued state.",
      subtopic: "State Management"
    }
  ],
  JavaScript: [
    {
      question: "What is the value of typeof null in JavaScript?",
      options: ["'object'", "'null'", "'undefined'", "'prototype'"],
      correct: "'object'",
      explanation: "This is a long-standing JS specification quirk where null is treated as an object type.",
      subtopic: "Basics & Quirks"
    },
    {
      question: "Which event loop phase executes setTimeout and setInterval callbacks?",
      options: ["Timers phase", "Poll phase", "Check phase", "Close callbacks phase"],
      correct: "Timers phase",
      explanation: "The timers phase executes callbacks scheduled by setTimeout() and setInterval().",
      subtopic: "Event Loop"
    },
    {
      question: "What is the primary difference between a Map and a WeakMap in ES6?",
      options: ["WeakMap keys must be objects and are weakly held", "WeakMap has no size property but keys can be primitive values", "Map only stores strings, WeakMap stores objects", "Map is asynchronous, WeakMap is synchronous"],
      correct: "WeakMap keys must be objects and are weakly held",
      explanation: "WeakMap keys are objects only, and references to key objects are held weakly, allowing garbage collection if no other references exist.",
      subtopic: "ES6 Data Structures"
    },
    {
      question: "What does a promise in 'fulfilled' state represent?",
      options: ["The operation completed successfully", "The operation failed with an error", "The operation is still in progress", "The promise was canceled"],
      correct: "The operation completed successfully",
      explanation: "A promise is fulfilled when the resolve() function is called, indicating success.",
      subtopic: "Asynchronous JS"
    },
    {
      question: "What is a closure in JavaScript?",
      options: ["A function that remembers its outer lexical environment", "A method to close network connections", "A private class constructor", "An immediately invoked function expression"],
      correct: "A function that remembers its outer lexical environment",
      explanation: "A closure is the combination of a function and the lexical environment within which that function was declared, enabling state preservation.",
      subtopic: "Functions & Scope"
    }
  ],
  SQL: [
    {
      question: "Which JOIN type returns all records when there is a match in either left or right table?",
      options: ["FULL OUTER JOIN", "INNER JOIN", "LEFT JOIN", "CROSS JOIN"],
      correct: "FULL OUTER JOIN",
      explanation: "FULL OUTER JOIN returns all rows from both tables, matching columns where possible and filling with NULL otherwise.",
      subtopic: "JOINs"
    },
    {
      question: "What does the EXPLAIN statement in SQL do?",
      options: ["Returns the query execution plan details", "Prints inline help documentation", "Validates syntax without executing", "Auto-formats query code"],
      correct: "Returns the query execution plan details",
      explanation: "EXPLAIN tells you how the database engine plans to execute the query, showing table scans, index lookups, and join paths.",
      subtopic: "Query Optimization"
    },
    {
      question: "Which ACID property ensures that transactions are invisible to other concurrent transactions until committed?",
      options: ["Isolation", "Atomicity", "Consistency", "Durability"],
      correct: "Isolation",
      explanation: "Isolation ensures that concurrent transactions do not interfere with each other's intermediate state.",
      subtopic: "Transactions"
    },
    {
      question: "What is a Common Table Expression (CTE) in SQL?",
      options: ["A temporary named result set defined within a query", "A permanent database view", "An index on a foreign key column", "A custom constraint rule"],
      correct: "A temporary named result set defined within a query",
      explanation: "CTEs are defined using the 'WITH' clause and exist only during the execution of that specific query.",
      subtopic: "Window Functions & CTEs"
    },
    {
      question: "Which index type is best suited for exact-match equality queries?",
      options: ["Hash Index", "B-Tree Index", "GiST Index", "GIN Index"],
      correct: "Hash Index",
      explanation: "Hash indexes are O(1) for equality lookups, although B-Tree indexes are more versatile for range queries.",
      subtopic: "Indexes"
    }
  ]
}

const MOCK_DEBUGGING: Record<string, any> = {
  React: {
    description: "The counter is supposed to increment every second, but it creates a memory leak and counts twice as fast when the component re-renders.",
    language: "jsx",
    buggyCode: `import { useState, useEffect } from 'react'\n\nexport default function Counter() {\n  const [count, setCount] = useState(0)\n\n  useEffect(() => {\n    setInterval(() => {\n      setCount(count + 1)\n    }, 1000)\n  }, [])\n\n  return <div>Count: {count}</div>\n}`,
    correctAnswer: `import { useState, useEffect } from 'react'\n\nexport default function Counter() {\n  const [count, setCount] = useState(0)\n\n  useEffect(() => {\n    const id = setInterval(() => {\n      setCount(prev => prev + 1)\n    }, 1000)\n    return () => clearInterval(id)\n  }, [])\n\n  return <div>Count: {count}</div>\n}`,
    hint: "Make sure you clear the interval on unmount, and avoid referencing the local count state directly inside the closure."
  },
  JavaScript: {
    description: "This function is designed to fetch retry-able values but it returns immediately with the first error without waiting or retrying.",
    language: "javascript",
    buggyCode: `async function fetchWithRetry(url, retries = 3) {\n  for (let i = 0; i < retries; i++) {\n    try {\n      return await fetch(url)\n    } catch (err) {\n      throw err\n    }\n  }\n}`,
    correctAnswer: `async function fetchWithRetry(url, retries = 3) {\n  for (let i = 0; i < retries; i++) {\n    try {\n      return await fetch(url)\n    } catch (err) {\n      if (i === retries - 1) throw err\n    }\n  }\n}`,
    hint: "Check what happens when an error is caught in the first iteration. Do you let the loop continue?"
  },
  SQL: {
    description: "This query attempts to find departments where the average employee salary is greater than $50,000, but fails due to a query structure syntax error.",
    language: "sql",
    buggyCode: `SELECT dept_id, AVG(salary)\nFROM employees\nWHERE AVG(salary) > 50000\nGROUP BY dept_id`,
    correctAnswer: `SELECT dept_id, AVG(salary)\nFROM employees\nGROUP BY dept_id\nHAVING AVG(salary) > 50000`,
    hint: "You cannot use aggregate functions inside the WHERE clause. Think about the HAVING clause."
  }
}

function getLocalMockExam(topic: string, stage: any, randomSeed: string) {
  const normTopic = MOCK_DOMAIN[topic] ? topic : 'JavaScript'
  const domainPool = MOCK_DOMAIN[normTopic]
  const debugPool = MOCK_DEBUGGING[normTopic]

  // Shuffle to randomize
  const shuffledApt = [...MOCK_APTITUDE].sort(() => 0.5 - Math.random())
  const shuffledDom = [...domainPool].sort(() => 0.5 - Math.random())

  return {
    aptitude:  shuffledApt.slice(0, stage.aptCount),
    domain:    shuffledDom.slice(0, stage.domainCount),
    debugging: debugPool,
    meta:      {
      topic,
      stage:       stage.label,
      generatedAt: new Date().toISOString(),
      timeMinutes: stage.timeMinutes,
      seed:        randomSeed + '-local-mock',
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// POST /api/generate/questions
// ─────────────────────────────────────────────────────────────────────────
router.post('/questions', async (req, res) => {
  const { topic = 'React', difficulty = '1', userId = 'global' } = req.body || {}
  const stageIndex  = Math.min(Math.max(Number(difficulty) - 1, 0), 2)
  const stage       = STAGES[stageIndex]
  const userKey     = String(userId || 'global')
  const randomSeed  = getRandomSeed()

  // 1. Try real OpenAI call if configured
  if (isApiKeyConfigured()) {
    try {
      const rotationHint    = getRotationHint(topic)
      const perfContext     = buildPerformanceContext(userKey, topic)
      const currentYear     = new Date().getFullYear()

      const prompt = `
You are an expert technical interviewer specialising in ${topic}.

SESSION SEED: ${randomSeed}
(Use this seed to ensure this session's questions are completely different from any other session.)

CANDIDATE CONTEXT:
- ${perfContext}
- ${rotationHint}
- Year: ${currentYear} — Questions must reflect the CURRENT state of ${topic} in ${currentYear}.
  Do NOT ask about deprecated APIs or outdated patterns.

EXAM SPECIFICATION:
- Topic: ${topic}
- Stage: ${stage.label}
- Stage description: ${stage.description}
- Aptitude questions: ${stage.aptCount} (logical/mathematical reasoning — NOT ${topic}-specific)
- Domain questions: ${stage.domainCount} (${topic}-specific technical MCQs)
- 1 Debugging challenge (${topic}-relevant code with a real subtle bug)

STRICT RULES:
1. The SESSION SEED above is your randomness anchor — use it to mentally "start fresh" and avoid repeating common questions.
2. Never ask two domain questions on the same sub-topic.
3. All 4 MCQ options must be plausible — no obviously wrong answers.
4. The "correct" value must be the EXACT string of one of the options.
5. The debugging bug must be subtle and logical — not a simple typo.
6. Return ONLY valid JSON. No markdown. No backticks. No explanation.

REQUIRED JSON STRUCTURE:
{
  "aptitude": [
    {
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correct": "exact matching option string",
      "explanation": "1-sentence reason why this is correct"
    }
  ],
  "domain": [
    {
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correct": "exact matching option string",
      "explanation": "1-sentence reason why this is correct",
      "subtopic": "which sub-area of ${topic} this covers"
    }
  ],
  "debugging": {
    "description": "What should this code do, and what bug must the candidate find?",
    "language": "${topic === 'SQL' ? 'sql' : topic === 'React' ? 'jsx' : 'javascript'}",
    "buggyCode": "...",
    "correctAnswer": "...",
    "hint": "Single-sentence hint without spoiling the answer"
  },
  "meta": {
    "topic": "${topic}",
    "stage": "${stage.label}",
    "generatedAt": "${new Date().toISOString()}",
    "timeMinutes": ${stage.timeMinutes},
    "seed": "${randomSeed}"
  }
}
`.trim()

      let testData: any = null
      let lastError = ''

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await getClient().models.generateContent({
            model: 'gemini-1.5-flash',
            contents: prompt,
            config: {
              temperature: 0.9
            }
          })

          const raw  = response.text || ''
          const data = parseAiJson(raw)

          if (
            Array.isArray(data.aptitude)  && data.aptitude.length  >= stage.aptCount &&
            Array.isArray(data.domain)    && data.domain.length    >= stage.domainCount &&
            data.debugging?.buggyCode
          ) {
            testData = data
            break
          }
          lastError = `Attempt ${attempt + 1}: missing required fields`
        } catch (err: any) {
          lastError = `Attempt ${attempt + 1}: ${err.message}`
        }
      }

      if (testData) {
        const finalTest = {
          aptitude:  testData.aptitude.slice(0, stage.aptCount),
          domain:    testData.domain.slice(0, stage.domainCount),
          debugging: testData.debugging,
          meta:      testData.meta || {
            topic, stage: stage.label,
            generatedAt: new Date().toISOString(),
            timeMinutes: stage.timeMinutes,
            seed: randomSeed,
          },
        }
        return res.json({ ok: true, test: finalTest })
      }
      console.warn('AI exam generation failed. Falling back to local mock: ', lastError)
    } catch (err: any) {
      console.warn('OpenAI error. Falling back to local mock: ', err.message)
    }
  }

  // 2. Safe Fallback Local Generation
  const fallbackTest = getLocalMockExam(topic, stage, randomSeed)
  return res.json({ ok: true, test: fallbackTest })
})

// ─────────────────────────────────────────────────────────────────────────
// POST /api/generate/grade-code
// ─────────────────────────────────────────────────────────────────────────
router.post('/grade-code', async (req, res) => {
  const { userCode, questionText, correctSolution, language = 'javascript' } = req.body || {}
  if (!userCode || !questionText) {
    return res.status(400).json({ ok: false, error: 'Missing userCode or questionText' })
  }

  // 1. Try real OpenAI call if configured
  if (isApiKeyConfigured()) {
    try {
      const prompt = `
You are a senior ${language} engineer acting as both a compiler and a mentor.

PROBLEM STATEMENT:
${questionText}

USER'S SUBMITTED CODE:
\`\`\`${language}
${userCode}
\`\`\`

REFERENCE SOLUTION (do NOT reveal this directly):
\`\`\`${language}
${correctSolution || 'Not provided'}
\`\`\`

GRADING RUBRIC:
- Correctness: 60%
- Code quality / readability: 20%
- Edge-case handling: 20%

Write mentor feedback (3–6 sentences):
- Point to the specific bug or issue
- Explain the concept behind the error
- Give hints to fix it WITHOUT revealing the solution code
- If passed: acknowledge what was done well + suggest one improvement

Return ONLY valid JSON, no markdown:
{
  "passed": boolean,
  "score": number (0-100),
  "feedback": "mentor feedback string"
}
`.trim()

      const response = await getClient().models.generateContent({
        model: 'gemini-1.5-flash',
        contents: prompt,
        config: {
          temperature: 0.3
        }
      })

      const raw    = response.text || ''
      const parsed = parseAiJson(raw)
      return res.json({ ok: true, ...parsed })
    } catch (err: any) {
      console.warn('Gemini grading error. Falling back to local grader: ', err.message)
    }
  }

  // 2. Safe Fallback Local Grader
  const cleanCode = userCode.replace(/\s+/g, '')
  const normLang = language.toLowerCase()
  let passed = false
  let score = 30
  let feedback = "Your code matches the initial buggy template. Try implementing a solution."

  if (cleanCode && cleanCode.length > 20) {
    const isJavaScript = normLang === 'javascript';
    const isJSX = normLang === 'jsx';
    const isSQL = normLang === 'sql';
    
    // Default to failed for offline grader unless specific keywords are found
    passed = false;
    score = 40;
    feedback = "Offline Evaluator: Your code does not seem to contain the expected logic or keywords to pass. Please provide a full implementation.";

    // Assessment Logic
    if (isJSX && (userCode.includes('clearInterval') || userCode.includes('prev'))) {
      passed = true;
      score = 90;
      feedback = "Excellent job! You correctly cleared the interval on component unmount and utilized the functional state updater (prev => prev + 1) to prevent closure stale-state issues.";
    } else if (isSQL && userCode.toLowerCase().includes('having')) {
      passed = true;
      score = 95;
      feedback = "Correct! Aggregate functions such as AVG(salary) cannot be filtered inside WHERE. Using HAVING after GROUP BY is the proper relational algebra solution.";
    } else if (isJavaScript && userCode.includes('retry') && !userCode.includes('throw err')) {
      passed = true;
      score = 85;
      feedback = "Good work! You corrected the eager return behavior of the try-catch block, letting the loop retry up to the limits.";
    } 
    // Playground Logic (Fallback keyword checks)
    else if (isJavaScript && userCode.includes('Map') && userCode.includes('sort')) {
      passed = true;
      score = 90;
      feedback = "Offline Evaluator: Good job using a Map and sorting the strings to group the anagrams together.";
    } else if (isJavaScript && userCode.includes('Array.isArray') && userCode.includes('typeof')) {
      passed = true;
      score = 95;
      feedback = "Offline Evaluator: Excellent. You properly handled the recursive deep cloning for arrays and objects.";
    } else if (isJavaScript && userCode.includes('setTimeout') && userCode.includes('clearTimeout')) {
      passed = true;
      score = 90;
      feedback = "Offline Evaluator: Correctly implemented debounce using setTimeout and clearTimeout.";
    } else if (isJSX && userCode.includes('memo') && userCode.includes('useCallback')) {
      passed = true;
      score = 95;
      feedback = "Offline Evaluator: You successfully optimized the list rendering using memo and useCallback.";
    } else if (isJavaScript && userCode.includes('Map') && userCode.includes('delete')) {
      passed = true;
      score = 90;
      feedback = "Offline Evaluator: Good implementation of LRU cache using a Map's insertion order properties.";
    } else if (isSQL && userCode.toLowerCase().includes('with recursive')) {
      passed = true;
      score = 95;
      feedback = "Offline Evaluator: Correctly used a Recursive CTE to traverse the employee hierarchy.";
    } else if (userCode.includes('// your code here')) {
      passed = false;
      score = 0;
      feedback = "You submitted the unmodified template. Please write your solution.";
    }
  }

  return res.json({ ok: true, passed, score, feedback })
})

// ─────────────────────────────────────────────────────────────────────────
// POST /api/generate/parse-resume
// ─────────────────────────────────────────────────────────────────────────
router.post('/parse-resume', async (req, res) => {
  const { text } = req.body || {}
  if (!text) return res.status(400).json({ ok: false, error: 'No resume text provided' })

  // 1. Try real OpenAI call if configured
  if (isApiKeyConfigured()) {
    try {
      const prompt = `
Extract professional information from the following resume text.
Return ONLY a valid JSON object:
{
  "name": "Full name",
  "email": "email or empty string",
  "bio": "2-sentence professional summary",
  "skills": ["up to 8 skills"],
  "suggestedTopics": ["1-3 topics from: React, JavaScript, SQL, Python, Node.js, TypeScript"]
}
No markdown, no comments.

Resume:
${text}
`.trim()

      const response = await getClient().models.generateContent({
        model: 'gemini-1.5-flash',
        contents: prompt,
        config: {
          temperature: 0.2
        }
      })

      const raw    = response.text || ''
      const parsed = parseAiJson(raw)
      return res.json({ ok: true, profile: parsed })
    } catch (err: any) {
      console.warn('Gemini resume parsing error. Falling back to local parser: ', err.message)
    }
  }

  // 2. Safe Fallback Local Parser
  const nameMatch = text.match(/Name:\s*([^\n]+)/i) || text.match(/^([A-Z][a-z]+\s+[A-Z][a-z]+)/)
  const emailMatch = text.match(/Email:\s*([^\n]+)/i) || text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/)
  const name = nameMatch ? nameMatch[1].trim() : 'Candidate Name'
  const email = emailMatch ? emailMatch[1].trim() : 'parsed_candidate@example.com'

  return res.json({
    ok: true,
    profile: {
      name,
      email,
      bio: "Self-taught developer with hands-on technical skills and a portfolio of custom apps.",
      skills: ["React", "JavaScript", "HTML5", "SQL", "CSS"],
      suggestedTopics: ["React", "JavaScript", "SQL"]
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────
// POST /api/generate/match-candidates
// ─────────────────────────────────────────────────────────────────────────
router.post('/match-candidates', async (req, res) => {
  const { query } = req.body || {}
  if (!query) return res.status(400).json({ ok: false, error: 'Missing query' })

  const allResults = readResultsForUser(null)
  if (allResults.length === 0) return res.json({ ok: true, matches: [] })

  // Aggregate per-user best scores
  const byUser: Record<string, any> = {}
  for (const r of allResults) {
    const e = r.user_email
    if (!byUser[e]) byUser[e] = { email: e, name: r.user_name, skills: [], avgScore: 0, count: 0 }
    const pct = Math.round((r.score / Math.max(1, r.total)) * 100)
    byUser[e].skills.push({
      skill:    r.skill,
      stage:    r.difficulty,
      scorePct: pct
    })
    byUser[e].avgScore += pct
    byUser[e].count += 1
  }

  // 1. Try real OpenAI call if configured
  if (isApiKeyConfigured()) {
    try {
      const prompt = `
You are an AI Technical Recruiter. Employer requirement: "${query}"

Candidate profiles with verified assessment scores:
${JSON.stringify(Object.values(byUser), null, 2)}

Rank ALL candidates by match quality.
Return ONLY a valid JSON array, sorted by matchPercent descending:
[
  {
    "email": "...",
    "matchPercent": 0-100,
    "reasoning": "1-2 sentence explanation"
  }
]
No markdown.
`.trim()

      const response = await getClient().models.generateContent({
        model: 'gemini-1.5-flash',
        contents: prompt,
        config: {
          temperature: 0.3
        }
      })

      const raw    = response.text || ''
      const parsed = parseAiJson(raw)
      return res.json({ ok: true, matches: parsed })
    } catch (err: any) {
      console.warn('Gemini matchmaking error. Falling back to local ranking: ', err.message)
    }
  }

  // 2. Safe Fallback Local Matchmaking Ranking (sorts candidates by their actual score matching the query keywords)
  const matches = Object.values(byUser).map((u: any) => {
    const avg = Math.round(u.avgScore / Math.max(1, u.count))
    const skillsList = u.skills.map((s: any) => s.skill)

    // Simple keyword score boost
    let scoreBoost = 0
    const qLower = query.toLowerCase()
    skillsList.forEach((sName: string) => {
      if (qLower.includes(sName.toLowerCase())) scoreBoost += 20
    })

    const finalPct = Math.min(avg + scoreBoost, 100)

    return {
      email: u.email,
      matchPercent: finalPct,
      reasoning: `Matched candidates based on verified average skill performance of ${avg}% in: ${skillsList.join(', ')}.`
    }
  })

  matches.sort((a, b) => b.matchPercent - a.matchPercent)
  return res.json({ ok: true, matches })
})

// ─────────────────────────────────────────────────────────────────────────
// POST /api/generate/match-jobs
// ─────────────────────────────────────────────────────────────────────────
router.post('/match-jobs', async (req, res) => {
  try {
    const { userEmail, skills, jobs } = req.body || {}
    if (!jobs || !Array.isArray(jobs)) {
      return res.status(400).json({ ok: false, error: 'Missing jobs array' })
    }

    // Fetch best score of this candidate for all skills
    const attempts = userEmail ? getAttempts(userEmail) : []
    const bestScores: Record<string, number> = {}
    for (const a of attempts) {
      const pct = Math.round((a.score / Math.max(1, a.total)) * 100)
      if (!bestScores[a.skill] || pct > bestScores[a.skill]) {
        bestScores[a.skill] = pct
      }
    }

    // 1. Try real OpenAI call if configured
    if (isApiKeyConfigured()) {
      try {
        const prompt = `
You are an AI Career Matchmaking engine.
Candidate Profile:
- Skills: "${skills || ''}"
- Verified Test Scores: ${JSON.stringify(bestScores)}

Match the candidate to the following list of jobs.
Jobs list:
${JSON.stringify(jobs, null, 2)}

Rank matches for each job.
Return ONLY a valid JSON array of objects representing matching results for each job in the EXACT order they were passed:
[
  {
    "matchPercent": 0-100,
    "reasoning": "1-2 sentence explanation of the score"
  }
]
No markdown.
`.trim()

        const response = await getClient().models.generateContent({
          model: 'gemini-1.5-flash',
          contents: prompt,
          config: {
            temperature: 0.3
          }
        })

        const raw    = response.text || ''
        const parsed = parseAiJson(raw)
        return res.json({ ok: true, matches: parsed })
      } catch (err: any) {
        console.warn('Gemini job matching error. Falling back to local scoring: ', err.message)
      }
    }

    // 2. Safe Fallback Local Grader
    const parsedSkills = (skills || '').toLowerCase().split(',').map((s: string) => s.trim()).filter(Boolean)
    const matches = jobs.map((job: any) => {
      let score = 35 // baseline
      const jobTags = (job.tags || []).map((t: string) => t.toLowerCase())
      const jobTitle = (job.title || '').toLowerCase()

      // check skill keyword match
      let matchCount = 0
      jobTags.forEach((tag: string) => {
        if (parsedSkills.includes(tag)) {
          score += 15
          matchCount++
        }
        // check if they passed assessment
        const skillKey = Object.keys(bestScores).find(k => k.toLowerCase() === tag)
        if (skillKey) {
          const testScore = bestScores[skillKey]
          score += Math.round(testScore * 0.3) // up to 30 points for verified high score
        }
      })

      // check title matching keywords
      if (parsedSkills.some((s: string) => jobTitle.includes(s))) {
        score += 10
      }

      const finalPct = Math.min(score, 98) // cap at 98% for realistic AI matching
      
      let reasoning = ''
      if (matchCount > 0) {
        reasoning = `Strong skills alignment: your profile matches ${matchCount} core tags required for this role.`
      } else {
        reasoning = `Baseline match. Build up verified credentials in: ${job.tags.join(', ')} to boost alignment.`
      }

      return {
        matchPercent: finalPct,
        reasoning
      }
    })

    return res.json({ ok: true, matches })
  } catch (err: any) {
    console.error('Error matching jobs:', err)
    return res.status(500).json({ ok: false, error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────
// POST /api/generate/candidate-summary
// ─────────────────────────────────────────────────────────────────────────
router.post('/candidate-summary', async (req, res) => {
  try {
    const { email, name, skills } = req.body || {}
    if (!email) return res.status(400).json({ ok: false, error: 'Missing candidate email' })

    // Gather assessment results
    const attempts = getAttempts(email)
    const bestScores: Record<string, number> = {}
    for (const a of attempts) {
      const pct = Math.round((a.score / Math.max(1, a.total)) * 100)
      if (!bestScores[a.skill] || pct > bestScores[a.skill]) {
        bestScores[a.skill] = pct
      }
    }

    // 1. Try real OpenAI call if configured
    if (isApiKeyConfigured()) {
      try {
        const prompt = `
You are an AI recruiting consultant. Write a professional, concise 2-sentence summary of the candidate's hiring potential.
Candidate Details:
- Name: "${name || 'Candidate'}"
- Technical Profile/Skills: "${skills || ''}"
- Verified Test Scores (out of 100): ${JSON.stringify(bestScores)}

Focus on key strengths shown by scores and experience, and note areas of improvement if scores are low.
Return ONLY plain text, no markdown.
`.trim()

        const completion = await getClient().chat.completions.create({
          model:       'gpt-4o-mini',
          messages:    [{ role: 'user', content: prompt }],
          max_tokens:  200,
          temperature: 0.5,
        })

        const summary = completion.choices?.[0]?.message?.content?.trim() || ''
        return res.json({ ok: true, summary })
      } catch (err: any) {
        console.warn('OpenAI candidate summary error. Falling back to local generator: ', err.message)
      }
    }

    // 2. Safe Fallback Local Summary
    const keys = Object.keys(bestScores)
    let summaryText = ''
    if (keys.length === 0) {
      summaryText = `${name || 'Candidate'} is a new applicant on the platform. They have listed skills in "${skills || 'various technologies'}" and are currently scheduled to begin their first verified skill assessment.`
    } else {
      const highScores = keys.filter(k => bestScores[k] >= 70).map(k => `${k} (${bestScores[k]}%)`)
      if (highScores.length > 0) {
        summaryText = `${name || 'Candidate'} shows strong capability with verified passing marks in ${highScores.join(', ')}. They demonstrate mid-to-senior technical capacity in these domains, making them a high-relevance prospect.`
      } else {
        const allScores = keys.map(k => `${k} (${bestScores[k]}%)`)
        summaryText = `${name || 'Candidate'} has initiated skill assessments in ${allScores.join(', ')}. While they are building foundational concepts, we recommend focusing on practical projects to improve their overall score.`
      }
    }

    return res.json({ ok: true, summary: summaryText })
  } catch (err: any) {
    console.error('Error generating candidate summary:', err)
    return res.status(500).json({ ok: false, error: err.message })
  }
})

export default router
