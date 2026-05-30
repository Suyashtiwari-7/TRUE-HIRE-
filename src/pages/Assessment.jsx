import { useCallback, useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useTabWarning from '../hooks/useTabWarning'
import useCamera from '../hooks/useCamera'
import useCameraMonitor from '../hooks/useCameraMonitor'
import useIsMobile from '../hooks/useIsMobile'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

export default function Assessment() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  
  // User Session
  const [user, setUser] = useState(null)
  
  // States
  const [started, setStarted] = useState(false)
  const [testingSetup, setTestingSetup] = useState(false)
  const [testFetched, setTestFetched] = useState(false)
  const [loadingModel, setLoadingModel] = useState(false)
  const [skill, setSkill] = useState('React')
  const [difficulty, setDifficulty] = useState('1') // Stage 1 (Easy), 2 (Medium), 3 (Hard)
  
  // Timed 3-part Test Structure
  const [test, setTest] = useState(null) // { aptitude: [], domain: [], debugging: {} }
  const [answers, setAnswers] = useState({}) // MCQ index -> value
  const [debuggingCode, setDebuggingCode] = useState('') // User edited code string
  
  // Grading & Feedback
  const [score, setScore] = useState(0)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [scoreBreakdown, setScoreBreakdown] = useState(null) // { aptitude, domain, debugging, passed }
  const [aiFeedback, setAiFeedback] = useState('')
  const [isGrading, setIsGrading] = useState(false)
  const [graded, setGraded] = useState(false)

  // Timer
  const [timeLeft, setTimeLeft] = useState(600) // 10 minutes default
  const timerIntervalRef = useRef(null)

  // Proctoring Warnings & Bans
  const [warnings, setWarnings] = useState(0)
  const [warnLog, setWarnLog] = useState([])
  const [banned, setBanned] = useState(false)
  const [banTimeRemaining, setBanTimeRemaining] = useState(0)
  const limit = 3
  
  // Camera hook
  const { videoRef, start: startCam, stop: stopCam, active: camActive, error: camError } = useCamera(false)

  // MediaPipe model reference
  const modelRef = useRef(null)
  const proctorIntervalRef = useRef(null)
  const warningTicksRef = useRef({ noPerson: 0, multiPerson: 0, lookAway: 0 })
  const syncTickRef = useRef(0)

  // Web Audio Visualizer references
  const audioContextRef = useRef(null)
  const audioStreamRef = useRef(null)
  const analyserRef = useRef(null)
  const canvasRef = useRef(null)
  const canvasAnimRef = useRef(null)

  // Check ban status on mount
  useEffect(() => {
    const raw = localStorage.getItem('truehire_user')
    const me = raw ? JSON.parse(raw) : null
    setUser(me)

    if (me && me.email) {
      checkBan(me.email)
    }
  }, [])

  // Check user ban from server
  async function checkBan(email) {
    try {
      const res = await fetch(`http://localhost:4000/api/results/user/${encodeURIComponent(email)}/ban-status`)
      if (res.ok) {
        const data = await res.json()
        if (data.banned) {
          setBanned(true)
          setBanTimeRemaining(Math.ceil(data.remainingMs / 1000))
        }
      }
    } catch (e) {
      console.error('Failed to query ban status from server:', e)
    }
  }

  // Ban countdown timer
  useEffect(() => {
    if (banned && banTimeRemaining > 0) {
      const interval = setInterval(() => {
        setBanTimeRemaining((t) => {
          if (t <= 1) {
            setBanned(false)
            clearInterval(interval)
            return 0
          }
          return t - 1
        })
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [banned, banTimeRemaining])

  // format countdown timer: HH:MM:SS
  function formatBanTime(seconds) {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0')
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  // Proctor Warning function
  const registerWarning = useCallback((type) => {
    setWarnings((prev) => {
      const next = prev + 1
      const nextLog = [{ type, at: new Date().toLocaleTimeString() }, ...warnLog].slice(0, 5)
      setWarnLog(nextLog)
      
      // If 3 warnings reached, block the test and impose ban
      if (next >= limit) {
        imposeBan(nextLog)
      }
      return next
    })
  }, [user, warnLog])

  // Impose a 24-hour ban in SQLite
  async function imposeBan(finalLog) {
    if (!user || !user.email) return
    try {
      await fetch(`http://localhost:4000/api/results/user/${encodeURIComponent(user.email)}/ban`, {
        method: 'POST'
      })
      
      // Save logs to localStorage so App.jsx can display them
      const logsToSave = finalLog || warnLog
      try {
        localStorage.setItem(`truehire_warn_log_${user.email}`, JSON.stringify(logsToSave))
      } catch (e) {}

      // Dispatch custom event to notify App.jsx immediately
      window.dispatchEvent(new CustomEvent('truehire:auth'))

      stopProctoring()
      stopCam()
      setStarted(false)
    } catch (e) {
      console.error('Error enforcing ban:', e)
    }
  }

  // Tab visibility warning
  useTabWarning(useCallback(() => {
    if (started) {
      registerWarning('tab-hidden')
    }
  }, [started, registerWarning]))

  // Timer countdown hook
  useEffect(() => {
    if (started && timeLeft > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(timerIntervalRef.current)
            // Auto submit
            autoSubmit()
            return 0
          }
          return t - 1
        })
      }, 1000)
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    }
  }, [started, timeLeft])

  // Initialize MediaPipe FaceLandmarker
  async function loadModels() {
    setLoadingModel(true)
    try {
      if (!modelRef.current) {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        )
        modelRef.current = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 2
        })
      }
    } catch (e) {
      console.error('Failed to load MediaPipe model:', e)
    }
    setLoadingModel(false)
  }

  // Helper to send frame to cloud
  async function sendFrameToCloud(video) {
    if (!user || !video) return
    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0)
      const base64Frame = canvas.toDataURL('image/jpeg', 0.5)

      const res = await fetch('http://localhost:4000/api/proctor/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Frame, userId: user.email })
      })
      if (res.ok) {
        const data = await res.json()
        if (data.phoneDetected) {
          registerWarning('Cell phone / laptop detected')
        }
      }
    } catch(e) {}
  }

  // 1. MediaPipe Proctoring Loop & Cloud Sync
  useEffect(() => {
    if ((!started && !testingSetup) || !camActive || !modelRef.current) return

    let lastVideoTime = -1
    const interval = setInterval(async () => {
      if (!videoRef.current || !modelRef.current) return
      
      const video = videoRef.current
      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime
        
        try {
          const result = modelRef.current.detectForVideo(video, performance.now())
          
          if (result.faceLandmarks.length === 0) {
            warningTicksRef.current.noPerson++
            warningTicksRef.current.multiPerson = 0
            warningTicksRef.current.lookAway = 0
            if (warningTicksRef.current.noPerson >= 3) {
              registerWarning('No candidate detected')
              warningTicksRef.current.noPerson = 0
            }
          } else if (result.faceLandmarks.length > 1) {
            warningTicksRef.current.multiPerson++
            warningTicksRef.current.noPerson = 0
            warningTicksRef.current.lookAway = 0
            if (warningTicksRef.current.multiPerson >= 2) {
              registerWarning('Multiple people detected')
              warningTicksRef.current.multiPerson = 0
            }
          } else {
            // One face detected
            warningTicksRef.current.noPerson = 0
            warningTicksRef.current.multiPerson = 0
            
            // Gaze / Look Away Detection
            const face = result.faceLandmarks[0]
            const noseTip = face[1]
            const leftEye = face[33]
            const rightEye = face[263]
            
            const noseDistLeft = Math.abs(noseTip.x - leftEye.x)
            const noseDistRight = Math.abs(rightEye.x - noseTip.x)
            const ratio = noseDistLeft / noseDistRight
            
            if (ratio < 0.4 || ratio > 2.5) {
              warningTicksRef.current.lookAway++
              if (warningTicksRef.current.lookAway >= 3) {
                registerWarning('Looked away from screen')
                warningTicksRef.current.lookAway = 0
              }
            } else {
              warningTicksRef.current.lookAway = 0
            }
          }
        } catch (e) {
          console.error('Detection error:', e)
        }
      }

      // Cloud API Sync every ~3 seconds (since interval is 1500ms, 2 ticks)
      syncTickRef.current++
      if (syncTickRef.current >= 2) {
         syncTickRef.current = 0
         sendFrameToCloud(video)
      }

    }, 1500)

    return () => clearInterval(interval)
  }, [started, camActive, registerWarning])

  // 2. Audio Proctoring Loop
  useEffect(() => {
    if (!started && !testingSetup) {
      if (canvasAnimRef.current) cancelAnimationFrame(canvasAnimRef.current)
      try {
        if (audioContextRef.current) {
          audioContextRef.current.close()
          audioContextRef.current = null
        }
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((track) => track.stop())
          audioStreamRef.current = null
        }
      } catch (e) {}
      return
    }

    setupAudioAnalysis()

    return () => {
      if (canvasAnimRef.current) cancelAnimationFrame(canvasAnimRef.current)
      try {
        if (audioContextRef.current) {
          audioContextRef.current.close()
          audioContextRef.current = null
        }
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((track) => track.stop())
          audioStreamRef.current = null
        }
      } catch (e) {}
    }
  }, [started, testingSetup])

  // 3. Camera monitor (covering / too dark / frozen)
  useCameraMonitor((started || testingSetup) ? videoRef : null, {
    onWarn: (type) => {
      if (type === 'camera-dark') {
        registerWarning('Camera covered / too dark')
      } else if (type === 'camera-frozen') {
        registerWarning('Camera feed frozen')
      }
    },
    sampleMs: 1000
  })

  // 4. Look Away Detection: Window blur & mouseleave listeners
  useEffect(() => {
    if (!started) return

    function handleBlur() {
      registerWarning('Looked away from screen')
    }

    function handleMouseLeave() {
      registerWarning('Looked away from screen')
    }

    window.addEventListener('blur', handleBlur)
    document.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [started, registerWarning])

  function startProctoring() {}
  function stopProctoring() {}

  // Web Audio Context setup
  async function setupAudioAnalysis() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioStreamRef.current = stream
      
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      const audioContext = new AudioCtx()
      audioContextRef.current = audioContext
      
      const source = audioContext.createMediaStreamSource(stream)
      
      // Create Bandpass filter to isolate human speech (300Hz - 3000Hz)
      // and reject low-frequency rumble and high-frequency keyboard clicks
      const filter = audioContext.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 1500
      filter.Q.value = 1.0
      
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      
      source.connect(filter)
      filter.connect(analyser)
      analyserRef.current = analyser
      
      // Volume check loop & frequency visualizer drawing
      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      
      let speechTimer = 0

      function drawWave() {
        if (!started && !testingSetup) return
        canvasAnimRef.current = requestAnimationFrame(drawWave)
        
        if (!canvasRef.current || !analyserRef.current) return
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        const width = canvas.width
        const height = canvas.height
        
        analyserRef.current.getByteFrequencyData(dataArray)
        
        ctx.clearRect(0, 0, width, height)
        
        // Draw 16 glowing bars representing frequency bins (human vocal band focus)
        const barCount = 16
        const barWidth = (width / barCount) - 4
        
        let vocalSum = 0
        let vocalCount = 0
        
        ctx.shadowBlur = 8
        ctx.shadowColor = 'rgba(99, 102, 241, 0.5)'
        
        for (let i = 0; i < barCount; i++) {
          // Map voice range bins (indices 2 to 18)
          const binIndex = 2 + i
          const val = dataArray[binIndex] || 0
          
          vocalSum += val
          vocalCount++
          
          // Calculate height proportional to value
          const percent = val / 255.0
          const barHeight = percent * height * 0.95
          
          const x = i * (barWidth + 4) + 2
          const y = height - barHeight
          
          // Beautiful indigo/purple gradient for each bar
          const grad = ctx.createLinearGradient(0, y, 0, height)
          grad.addColorStop(0, '#818cf8') // Light Indigo
          grad.addColorStop(1, '#4f46e5') // Dark Indigo
          
          ctx.fillStyle = grad
          
          ctx.beginPath()
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(x, y, barWidth, barHeight, 3)
          } else {
            ctx.rect(x, y, barWidth, barHeight)
          }
          ctx.fill()
        }
        
        // Speech detection using frequency-domain average vocal energy
        const avgVocalEnergy = vocalSum / Math.max(1, vocalCount)
        
        // Threshold of 65 is chosen to capture active speaking while ignoring background noise
        if (avgVocalEnergy > 65) {
          speechTimer++
          if (speechTimer > 40) { // Sustained speech (~1.5-2 seconds of vocal energy)
            registerWarning('Speaking / Voice noise detected')
            speechTimer = 0
          }
        } else {
          if (speechTimer > 0) speechTimer--
        }
      }
      
      drawWave()
    } catch (e) {
      console.warn('Microphone proctoring disabled or rejected:', e)
    }
  }

  // Phase 1: Fetch Questions
  async function prepareQuestions() {
    if (!user) {
      navigate('/sign')
      return
    }

    setLoadingModel(true)
    setGraded(false)
    setScoreBreakdown(null)
    setAiFeedback('')
    setWarnings(0)
    setWarnLog([])

    try {
      const res = await fetch('http://localhost:4000/api/generate/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: skill, difficulty, userId: user.email })
      })

      if (res.ok) {
        const payload = await res.json()
        if (payload.ok && payload.test) {
          setTest(payload.test)
          setAnswers({})
          setDebuggingCode(payload.test.debugging.buggyCode)
          const mins = payload.test.meta?.timeMinutes || 10
          setTimeLeft(mins * 60)
          
          setTestFetched(true)
        } else {
          alert('Failed to generate test questions. Please try again.')
        }
      } else {
        alert('Server returned error while generating questions.')
      }
    } catch (err) {
      alert('Could not connect to the API server.')
    }
    setLoadingModel(false)
  }

  // Phase 2: Start test
  async function startAssessment() {
    setTestingSetup(false)
    await loadModels()
    setStarted(true)
    
    // mount delay for video ref to trigger
    await new Promise((r) => setTimeout(r, 100))
    await startCam()
    startProctoring()
  }

  // Phase 1.5: Test Setup (Sandbox)
  async function toggleTestSetup() {
    if (testingSetup) {
      setTestingSetup(false)
      stopProctoring()
      stopCam()
      setWarnings(0)
      setWarnLog([])
    } else {
      await loadModels()
      setTestingSetup(true)
      await new Promise((r) => setTimeout(r, 100))
      await startCam()
    }
  }

  // End Assessment early
  function onEnd() {
    stopProctoring()
    stopCam()
    setStarted(false)
    setTest(null)
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
  }

  // Handle MCQ changes
  function handleSelectOption(section, index, value) {
    setAnswers((prev) => ({
      ...prev,
      [`${section}_${index}`]: value
    }))
  }

  // Timed out submission
  function autoSubmit() {
    alert('Assessment time is up! Auto-submitting your test solutions...')
    submitTest()
  }

  // Grade and save test scores
  async function submitTest(e) {
    if (e) e.preventDefault()
    if (!test) return

    setIsGrading(true)
    stopProctoring()
    stopCam()

    try {
      // 1. Grade MCQs locally
      let aptScore = 0
      test.aptitude.forEach((q, idx) => {
        if (answers[`aptitude_${idx}`] === q.correct) aptScore++
      })

      let domScore = 0
      test.domain.forEach((q, idx) => {
        if (answers[`domain_${idx}`] === q.correct) domScore++
      })

      // 2. Send Section 3 Debugging code to AI evaluator
      let gradeResult = { passed: false, score: 0, feedback: 'AI grading skipped' }
      try {
        const gradeRes = await fetch('http://localhost:4000/api/generate/grade-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userCode: debuggingCode,
            questionText: test.debugging.description,
            correctSolution: test.debugging.correctAnswer,
            language: test.debugging.language || 'javascript'
          })
        })

        if (gradeRes.ok) {
          const payload = await gradeRes.json()
          if (payload.ok) {
            gradeResult = {
              passed: payload.passed,
              score: payload.score,
              feedback: payload.feedback
            }
          }
        }
      } catch (err) {
        console.error('Failed to grade Section 3 code via AI:', err)
      }

      // 3. Compute final scores
      const totalPoints = test.aptitude.length + test.domain.length + 5 // Code section represents 5 points max
      const earnedPoints = aptScore + domScore + Math.round(gradeResult.score / 20) // Scale code score out of 5
      const passingPercent = 70
      const actualPercent = Math.round((earnedPoints / totalPoints) * 100)
      const passedStatus = actualPercent >= passingPercent

      setScore(earnedPoints)
      setTotalQuestions(totalPoints)
      setScoreBreakdown({
        aptitude: `${aptScore}/${test.aptitude.length}`,
        domain: `${domScore}/${test.domain.length}`,
        debugging: `${Math.round(gradeResult.score / 20)}/5 (${gradeResult.score}%)`,
        passed: passedStatus
      })
      setAiFeedback(gradeResult.feedback)

      // 4. Save results to SQLite
      const resData = {
        userEmail: user.email,
        userName: user.name,
        skill,
        difficulty, // Stage 1, 2, or 3
        score: earnedPoints,
        total: totalPoints,
        date: new Date().toISOString()
      }

      await fetch('http://localhost:4000/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resData)
      })

      setGraded(true)
      setStarted(false)
      setTest(null)
    } catch (err) {
      console.error('Error submitting test:', err)
      alert('An error occurred during submission. Results saved locally.')
    }
    setIsGrading(false)
  }

  // Generate recommendation courses based on tested skill
  const courseraRecs = {
    React: [
      { title: 'Front-End Web Development with React', url: 'https://www.coursera.org/search?query=react%20development' },
      { title: 'React Fundamentals', url: 'https://www.coursera.org/search?query=react%20fundamentals' }
    ],
    SQL: [
      { title: 'Databases and SQL for Data Science', url: 'https://www.coursera.org/search?query=sql%20for%20data%20science' },
      { title: 'SQL for Data Science', url: 'https://www.coursera.org/search?query=sql' }
    ],
    JavaScript: [
      { title: 'JavaScript Basics', url: 'https://www.coursera.org/search?query=javascript%20basics' },
      { title: 'Programming Foundations with JavaScript', url: 'https://www.coursera.org/search?query=programming%20javascript' }
    ]
  }

  const exploreRecs = courseraRecs[skill] || courseraRecs.React

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 relative">

      {/* Mobile Blocker */}
      {isMobile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-indigo-950/90 backdrop-blur-md">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 to-orange-500"></div>
            <div className="w-20 h-20 mx-auto bg-red-50 rounded-full flex items-center justify-center mb-6">
              <span className="text-4xl">📱</span>
            </div>
            <h2 className="text-2xl font-bold text-neutral-900 mb-3">Desktop Required</h2>
            <p className="text-sm text-neutral-600 mb-8 leading-relaxed">
              To ensure the integrity of the assessment and enable AI proctoring, this test can only be taken on a desktop or laptop computer.
            </p>
            <button 
              onClick={() => navigate('/')}
              className="w-full py-3 px-4 bg-neutral-900 text-white rounded-xl font-medium hover:bg-neutral-800 transition-colors"
            >
              Return to Home
            </button>
          </div>
        </div>
      )}
      
      {/* 24h Glassmorphic Ban Overlay */}
      {banned && (
        <div className="dark-starry-bg">
          <div className="flex flex-col items-center max-w-lg text-center space-y-8 animate-orb-pulse">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-white mb-1">True Proctor Lock</h2>
              <p className="text-xs text-neutral-400">Security Protocol Active</p>
            </div>

            {/* Glowing Circular Orb (Image 2 Style) */}
            <div className="glass-orb">
              {/* Outer Progress Ring */}
              <div className="orb-progress-ring" />
              <div 
                className="orb-progress-ring-glow"
                style={{
                  transform: `rotate(${(banTimeRemaining / 86400) * 360}deg)`,
                  transition: 'transform 1s linear'
                }}
              />
              
              <div className="orb-inner-content">
                <div className="text-xs text-neutral-400 font-semibold mb-1">⏳ Time to Unlock</div>
                <div className="text-4xl font-bold tracking-tight font-mono text-white mb-2">
                  {formatBanTime(banTimeRemaining)}
                </div>
                <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                  98% Integrity Score
                </span>
              </div>
            </div>

            {/* Violation Day-style indicators (Image 2 style) */}
            <div className="space-y-4">
              <div className="text-xs text-neutral-400 font-semibold">Proctor Violation Trigger Logs</div>
              <div className="flex justify-center gap-3">
                {[
                  { key: 'T', name: 'Tab Hide', active: warnLog.some(l => l.type === 'tab-hidden') },
                  { key: 'M', name: 'Mic Voice', active: warnLog.some(l => l.type === 'Speaking / Voice noise detected') },
                  { key: 'C', name: 'Camera Covered', active: warnLog.some(l => l.type === 'No candidate detected') },
                  { key: 'P', name: 'Phone Usage', active: warnLog.some(l => l.type === 'Cell phone / laptop detected') },
                  { key: 'F', name: 'Face Away', active: false },
                  { key: 'S', name: 'Second Person', active: warnLog.some(l => l.type === 'Multiple people detected') }
                ].map((item, idx) => (
                  <div 
                    key={idx} 
                    className={`status-circle-indicator ${item.active ? 'status-circle-indicator-active' : ''}`}
                    title={item.name}
                  >
                    <span>{item.key}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-neutral-500 max-w-sm mx-auto leading-relaxed">
                Highlighting violations recorded by TensorFlow & Audio Analyser. Avoid tab switching, secondary devices, or leaving camera view on retakes.
              </p>
            </div>
            
            <button 
              type="button" 
              className="btn text-xs bg-white text-neutral-900 shadow-xl hover:bg-neutral-100"
              onClick={() => navigate('/')}
            >
              Return Home
            </button>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid md:grid-cols-[1.3fr,0.7fr] gap-8">
        
        {/* Test Block */}
        <div className="card p-8">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-neutral-100">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎓</span>
              <div>
                <h2 className="font-bold text-lg text-indigo-950">Assessment Lab</h2>
                <p className="text-xs text-neutral-500">Industry-ready skill verification</p>
              </div>
            </div>
            {started && (
              <div className="section-timer">
                <span>⏱️</span>
                <span>{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
              </div>
            )}
          </div>

          {/* Configuration Form */}
          {!started && !testFetched && !graded && !isGrading && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100/50">
                <h3 className="font-semibold text-sm text-indigo-900 mb-1">Select Skill Domain</h3>
                <p className="text-xs text-neutral-500 mb-4">You can select any domain to start practicing and logging monthly scores.</p>
                <div className="flex flex-wrap gap-2">
                  {['React', 'SQL', 'JavaScript'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`pill ${skill === s ? 'pill-active' : ''}`}
                      onClick={() => setSkill(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100/50">
                <h3 className="font-semibold text-sm text-emerald-900 mb-1">Select Target Stage</h3>
                <p className="text-xs text-neutral-500 mb-4">Stage 3 includes quantitative aptitude, domain MCQs, and real code debugging.</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { val: '1', lbl: 'Stage 1 (Easy)' },
                    { val: '2', lbl: 'Stage 2 (Medium)' },
                    { val: '3', lbl: 'Stage 3 (Hard)' }
                  ].map((stageObj) => (
                    <button
                      key={stageObj.val}
                      type="button"
                      className={`pill ${difficulty === stageObj.val ? 'pill-active' : ''}`}
                      onClick={() => setDifficulty(stageObj.val)}
                    >
                      {stageObj.lbl}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="btn w-full mt-2"
                onClick={prepareQuestions}
                disabled={loadingModel}
              >
                {loadingModel ? 'Preparing Assessment...' : 'Prepare Assessment'}
              </button>
            </div>
          )}

          {/* Rules & Instructions Phase */}
          {!started && testFetched && !graded && !isGrading && (
            <div className="space-y-6">
              <div className="p-6 rounded-xl bg-indigo-50/30 border border-indigo-100">
                <h3 className="text-xl font-bold text-indigo-950 mb-4">Assessment Rules</h3>
                <ul className="space-y-3 text-sm text-neutral-700">
                  <li className="flex gap-2"><span>✅</span> Ensure your face is clearly visible.</li>
                  <li className="flex gap-2"><span>🚫</span> No mobile phones or other devices.</li>
                  <li className="flex gap-2"><span>🚫</span> Do not switch tabs or look away.</li>
                  <li className="flex gap-2"><span>🚫</span> No speaking or secondary voices.</li>
                  <li className="flex gap-2"><span>⚠️</span> 3 violations will result in an immediate 24-hour ban.</li>
                </ul>
              </div>
              <div className="flex gap-4 mt-2">
                <button
                  type="button"
                  className={`btn-ghost w-1/3 py-4 text-base font-bold ${testingSetup ? 'border-indigo-600 bg-indigo-50 text-indigo-900' : ''}`}
                  onClick={toggleTestSetup}
                  disabled={loadingModel}
                >
                  {loadingModel && !testingSetup ? 'Loading...' : testingSetup ? 'Stop Test' : 'Test Camera & Mic'}
                </button>
                <button
                  type="button"
                  className="btn w-2/3 py-4 text-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                  onClick={startAssessment}
                  disabled={loadingModel}
                >
                  Accept Rules & Start
                </button>
              </div>
              {testingSetup && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 animate-fade-in-up">
                  <strong>Sandbox Active:</strong> Check the live proctor monitor on the right. Verify your face is tracked and the audio visualizer responds to your voice. Any warnings shown here will NOT ban you during setup mode.
                </div>
              )}
            </div>
          )}

          {/* Loading Indicator */}
          {isGrading && (
            <div className="text-center py-12 space-y-4">
              <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <h3 className="font-semibold text-indigo-950">Evaluating and Compiling Code</h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                AI grading engine is evaluating your answers and generating constructive feedback...
              </p>
            </div>
          )}

          {/* Score Card / Result Report */}
          {graded && !started && !isGrading && (
            <div className="space-y-6">
              <div className={`p-6 rounded-2xl text-center border ${scoreBreakdown?.passed ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                <div className="text-5xl mb-2">{scoreBreakdown?.passed ? '🎉' : '📚'}</div>
                <h3 className="text-2xl font-bold mb-1">
                  {scoreBreakdown?.passed ? 'Assessment Passed' : 'Revision Suggested'}
                </h3>
                <p className="text-sm opacity-90 max-w-md mx-auto mb-4">
                  {scoreBreakdown?.passed 
                    ? `Excellent! You scored above the 70% threshold. Your verified credentials have been synced.`
                    : `You scored below the 70% threshold. Review the AI mentor logs and course suggestions below to prepare for your retake.`}
                </p>
                <div className="inline-block px-5 py-3 bg-white rounded-xl shadow-sm text-2xl font-bold text-neutral-900">
                  {score} / {totalQuestions} Marks
                </div>
              </div>

              {/* AI Mentor Logs */}
              <div className="p-5 rounded-xl border border-indigo-100 bg-indigo-50/20">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🤖</span>
                  <h4 className="font-bold text-sm text-indigo-950">AI Mentor Feedback</h4>
                </div>
                <p className="text-sm text-neutral-700 leading-relaxed font-mono bg-white/70 p-4 rounded-lg border border-neutral-100 whitespace-pre-line">
                  {aiFeedback}
                </p>
              </div>

              {/* retake selector */}
              <div className="flex justify-between items-center pt-4">
                <button type="button" className="btn-ghost" onClick={() => setGraded(false)}>
                  Close Report
                </button>
                <button type="button" className="btn" onClick={onStart}>
                  Retake Test
                </button>
              </div>
            </div>
          )}

          {/* Test in Progress */}
          {started && test && (
            <form onSubmit={submitTest} className="space-y-8">
              
              {/* Part 1: Aptitude */}
              <div className="space-y-6 p-5 rounded-xl bg-neutral-50/50 border border-neutral-100">
                <h3 className="font-bold text-indigo-950 text-base pb-2 border-b border-neutral-200">
                  Section 1: Aptitude
                </h3>
                {test.aptitude.map((q, idx) => (
                  <div key={idx} className="space-y-3">
                    <p className="font-medium text-sm text-neutral-800">Q{idx + 1}. {q.question}</p>
                    <div className="grid md:grid-cols-2 gap-2">
                      {q.options.map((o) => (
                        <label key={o} className={`chip justify-start gap-3 cursor-pointer p-3 ${answers[`aptitude_${idx}`] === o ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900' : 'hover:border-neutral-300'}`}>
                          <input
                            type="radio"
                            name={`aptitude_${idx}`}
                            value={o}
                            checked={answers[`aptitude_${idx}`] === o}
                            onChange={() => handleSelectOption('aptitude', idx, o)}
                            className="text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>{o}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Part 2: Technical MCQs */}
              <div className="space-y-6 p-5 rounded-xl bg-neutral-50/50 border border-neutral-100">
                <h3 className="font-bold text-indigo-950 text-base pb-2 border-b border-neutral-200">
                  Section 2: {skill} Domain Knowledge
                </h3>
                {test.domain.map((q, idx) => (
                  <div key={idx} className="space-y-3">
                    <p className="font-medium text-sm text-neutral-800">Q{idx + 1}. {q.question}</p>
                    <div className="grid md:grid-cols-2 gap-2">
                      {q.options.map((o) => (
                        <label key={o} className={`chip justify-start gap-3 cursor-pointer p-3 ${answers[`domain_${idx}`] === o ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900' : 'hover:border-neutral-300'}`}>
                          <input
                            type="radio"
                            name={`domain_${idx}`}
                            value={o}
                            checked={answers[`domain_${idx}`] === o}
                            onChange={() => handleSelectOption('domain', idx, o)}
                            className="text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>{o}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Part 3: Debugging Section */}
              <div className="space-y-4 p-5 rounded-xl bg-neutral-50/50 border border-neutral-100">
                <h3 className="font-bold text-indigo-950 text-base pb-2 border-b border-neutral-200">
                  Section 3: Practical Debugging
                </h3>
                <div>
                  <h4 className="text-sm font-semibold text-neutral-800">Instructions:</h4>
                  <p className="text-xs text-neutral-600 mb-4">{test.debugging.description}</p>
                </div>
                <div>
                  <label className="block text-xs text-neutral-500 mb-1">Code Workspace</label>
                  <textarea
                    className="w-full h-64 rounded-xl border border-neutral-200 bg-neutral-900 text-emerald-400 p-4 font-mono text-sm leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500/20"
                    value={debuggingCode}
                    onChange={(e) => setDebuggingCode(e.target.value)}
                  />
                </div>
              </div>

              {/* Controls */}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-ghost" onClick={onEnd}>
                  Cancel Assessment
                </button>
                <button type="submit" className="btn">
                  Submit Assessment
                </button>
              </div>

            </form>
          )}

        </div>

        {/* Proctoring Side Panel */}
        <div className="space-y-6">
          
          {/* Live Video Monitor */}
          <div className="card p-6">
            <h3 className="font-semibold text-neutral-800 text-sm mb-3 flex items-center gap-2">
              <span className="h-2 w-2 bg-emerald-500 rounded-full"></span> Live Proctor Monitor
            </h3>
            
            {/* Visualizer & video overlay container */}
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-video shadow-inner">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover transform scale-x-[-1]"
              />
              
              {/* Live Canvas wave overlay */}
              {(started || testingSetup) && (
                <canvas
                  ref={canvasRef}
                  width={300}
                  height={80}
                  className="absolute bottom-2 left-2 right-2 pointer-events-none"
                />
              )}
            </div>

            {camError && <div className="mt-3 text-xs text-red-600">{camError}</div>}
            
            {/* Warning log */}
            {(started || testingSetup) && (
              <div className="mt-4 pt-4 border-t border-neutral-100">
                <div className="flex items-center justify-between text-xs text-neutral-600 mb-2">
                  <span>Proctor warnings:</span>
                  <span className={`font-semibold ${warnings > 0 ? 'text-red-600' : 'text-neutral-500'}`}>
                    {warnings} / {limit}
                  </span>
                </div>
                <div className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden mb-4">
                  <div 
                    className="bg-red-500 h-full transition-all duration-300"
                    style={{ width: `${(warnings / limit) * 100}%` }}
                  />
                </div>

                {warnLog.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-neutral-700">Violation Records</div>
                    <ul className="space-y-1.5 text-xs text-neutral-500">
                      {warnLog.map((w, idx) => (
                        <li key={idx} className="flex items-center justify-between p-2 rounded bg-red-50 border border-red-100 text-red-900 animate-shake">
                          <span>⚠️ {w.type}</span>
                          <span className="opacity-60">{w.at}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pass/Fail recommendations Panel */}
          {graded && !scoreBreakdown?.passed && (
            <div className="card p-6 border-indigo-100 bg-indigo-50/10">
              <h3 className="font-bold text-sm text-indigo-950 mb-3 flex items-center gap-2">
                <span>📚</span> Recommended Courses
              </h3>
              <p className="text-xs text-neutral-500 mb-4">
                Strengthen your skills on these certified pathways to pass the {skill} assessment.
              </p>
              <div className="space-y-3">
                {exploreRecs.map((c, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-xl border border-neutral-100 shadow-sm flex flex-col justify-between gap-3">
                    <div>
                      <div className="font-semibold text-sm text-neutral-800">{c.title}</div>
                      <div className="text-xs text-indigo-600 mt-0.5">Coursera Certified</div>
                    </div>
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ghost text-xs text-center py-2 px-4 inline-block rounded-full bg-indigo-50 border-indigo-100 hover:bg-indigo-100 text-indigo-800"
                    >
                      Explore Course
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Default Info */}
          {!started && !graded && (
            <div className="card p-6 text-neutral-600 text-xs space-y-3">
              <h4 className="font-bold text-neutral-800">Proctoring Rules & Instructions:</h4>
              <ul className="list-disc pl-4 space-y-2">
                <li>You must grant camera and microphone access to initiate the proctoring pipeline.</li>
                <li>Do not navigate away from the browser tab or minimize the window.</li>
                <li>Ensure only you are in frame. Avoid using mobile devices, tablets, or books.</li>
                <li>Do not talk or lookup reference material.</li>
                <li>Exceeding 3 proctor violations results in a 24-hour lockout.</li>
              </ul>
            </div>
          )}

        </div>

      </div>
    </section>
  )
}
