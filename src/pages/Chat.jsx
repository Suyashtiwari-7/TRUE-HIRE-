import { useEffect, useState, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Peer from 'peerjs'

function loadMessages(){
  try{ const raw = localStorage.getItem('truehire_messages'); return raw ? JSON.parse(raw) : [] }catch(e){ return [] }
}

function saveMessages(arr){
  try{ localStorage.setItem('truehire_messages', JSON.stringify(arr)) }catch(e){}
}

function loadUsers(){
  try{ const raw = localStorage.getItem('truehire_users'); return raw ? JSON.parse(raw) : [] }catch(e){ return [] }
}

export default function Chat(){
  const loc = useLocation()
  const nav = useNavigate()
  const qs = new URLSearchParams(loc.search)
  const peerParam = qs.get('peer')

  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('truehire_user')
      return raw ? JSON.parse(raw) : null
    } catch (e) { return null }
  })
  const [contacts, setContacts] = useState([])
  const [messages, setMessages] = useState([])
  const [activePeer, setActivePeer] = useState(peerParam || '')
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const listRef = useRef()
  const bcRef = useRef(null)

  // Scheduling states
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [interviewDate, setInterviewDate] = useState('')
  const [interviewTime, setInterviewTime] = useState('')
  const [interviewNotes, setInterviewNotes] = useState('')
  const [scheduleMsg, setScheduleMsg] = useState('')

  // Video Call States
  const [videoCallActive, setVideoCallActive] = useState(false)
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [peerInstance, setPeerInstance] = useState(null)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const localStreamRef = useRef(null)
  const peerRef = useRef(null)

  useEffect(() => {
    try{
      setContacts(loadUsers())
      setMessages(loadMessages())
      if (peerParam) setActivePeer(peerParam)
    }catch(e){ setContacts([]); setMessages([]) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerParam])

  useEffect(() => {
    function sync() {
      try {
        const raw = localStorage.getItem('truehire_user')
        setUser(raw ? JSON.parse(raw) : null)
      } catch (e) {}
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  useEffect(() => {
    // set up BroadcastChannel if available for real-time cross-tab updates
    try{
      if ('BroadcastChannel' in window){
        bcRef.current = new BroadcastChannel('truehire_messages')
        bcRef.current.onmessage = () => {
          setMessages(loadMessages())
        }
      }

      function onStorage(e){
        if (e.key === 'truehire_messages') setMessages(loadMessages())
      }
      window.addEventListener('storage', onStorage)

      return () => {
        try{ if (bcRef.current) bcRef.current.close() }catch(e){}
        window.removeEventListener('storage', onStorage)
      }
    }catch(e){ /* ignore */ }
  }, [])

  useEffect(() => { // scroll on messages change
    try{ if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight }catch(e){}
  }, [messages, activePeer])

  // Attach video streams to refs when they update
  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream
    if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream
  }, [localStream, remoteStream, videoCallActive])

  function threads(){
    // build list of peers from messages and contacts
    const peers = new Map()
    messages.forEach(m => {
      const other = (m.from === user?.email) ? m.to : m.from
      if (!other) return
      const existing = peers.get(other) || { last: null, unread: 0 }
      if (!existing.last || new Date(m.date) > new Date(existing.last.date)) existing.last = m
      if (m.to === user?.email && !m.read) existing.unread = (existing.unread || 0) + 1
      peers.set(other, existing)
    })
    // include known users even without messages
    contacts.forEach(c => { if (c.email !== user?.email && !peers.has(c.email)) peers.set(c.email, { last: null, unread: 0 }) })
    // convert to array with user info
    const arr = Array.from(peers.entries()).map(([email, info]) => {
      const u = contacts.find(c => c.email === email) || { email }
      return { peer: email, user: u, last: info.last, unread: info.unread || 0 }
    })
    // sort by last message date
    arr.sort((a,b) => {
      const da = a.last ? new Date(a.last.date) : 0
      const db = b.last ? new Date(b.last.date) : 0
      return db - da
    })
    return arr
  }

  function openPeer(email){
    setActivePeer(email)
    // mark messages to this user as read
    if (!user) return
    const all = loadMessages()
    let changed = false
    for (let m of all){
      if (m.to === user.email && m.from === email && !m.read){ m.read = true; changed = true }
    }
    if (changed){ saveMessages(all); setMessages(all) }
    // update url
    try{ const url = new URL(window.location.href); url.searchParams.set('peer', email); window.history.replaceState({}, '', url) }catch(e){}
    // notify other tabs about read state change
    try{ if (bcRef.current) bcRef.current.postMessage({ type: 'update' }) }catch(e){ /* ignore */ }
  }

  function send(){
    if (!text.trim()) return
    if (!user) return nav('/sign')
    if (!activePeer) return alert('Select a contact to send message')
    const m = { from: user.email, to: activePeer, body: text.trim(), date: new Date().toISOString(), read: false }
    const all = loadMessages()
    all.push(m)
    saveMessages(all)
    setMessages(all)
    setText('')
    // broadcast to other tabs
    try{ if (bcRef.current) bcRef.current.postMessage({ type: 'new', message: m }) }catch(e){ /* ignore */ }
  }

  async function initVideoCall(isInitiator, targetPeerId = null) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      localStreamRef.current = stream
      setLocalStream(stream)
      setVideoCallActive(true)

      const peer = new Peer()
      peerRef.current = peer
      setPeerInstance(peer)

      if (isInitiator) {
        peer.on('open', (id) => {
          const m = { from: user.email, to: activePeer, body: `[CALL_INITIATED:${id}]`, date: new Date().toISOString(), read: false }
          const all = loadMessages()
          all.push(m)
          saveMessages(all)
          setMessages(all)
          try{ if (bcRef.current) bcRef.current.postMessage({ type: 'new', message: m }) }catch(e){}
        })

        peer.on('call', (call) => {
          call.answer(stream)
          call.on('stream', (rStream) => {
            setRemoteStream(rStream)
          })
          call.on('close', () => {
            endCall()
          })
          call.on('error', () => {
            endCall()
          })
        })
      } else {
        peer.on('open', () => {
          const call = peer.call(targetPeerId, stream)
          call.on('stream', (rStream) => {
            setRemoteStream(rStream)
          })
          call.on('close', () => {
            endCall()
          })
          call.on('error', () => {
            endCall()
          })
        })
      }
    } catch (err) {
      alert('Failed to access camera/microphone. Check permissions.')
      console.error(err)
    }
  }

  function endCall() {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop())
      localStreamRef.current = null
    }
    if (peerRef.current) {
      try {
        peerRef.current.destroy()
      } catch (e) {}
      peerRef.current = null
    }
    setVideoCallActive(false)
    setLocalStream(null)
    setRemoteStream(null)
  }

  async function handleSchedule(e) {
    if (e) e.preventDefault()
    if (!interviewDate || !interviewTime) {
      setScheduleMsg('Please fill in Date and Time')
      return
    }
    const dateTimeStr = new Date(`${interviewDate}T${interviewTime}`).toISOString()
    try {
      const res = await fetch('http://localhost:4000/api/interviews/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employerEmail: user.email,
          candidateEmail: activePeer,
          dateTime: dateTimeStr,
          notes: interviewNotes
        })
      })
      if (res.ok) {
        const payload = await res.json()
        if (payload.ok) {
          const autoMsg = {
             from: user.email,
             to: activePeer,
             body: `📅 INTERVIEW SCHEDULED\nDate & Time: ${new Date(dateTimeStr).toLocaleString()}\nNotes: "${interviewNotes || 'None'}"`,
             date: new Date().toISOString(),
             read: false
          }
          const all = loadMessages()
          all.push(autoMsg)
          saveMessages(all)
          setMessages(all)
          setScheduleMsg('Interview scheduled successfully!')

          // Notify other tabs
          try { if (bcRef.current) bcRef.current.postMessage({ type: 'new', message: autoMsg }) } catch(e){}

          setTimeout(() => {
            setShowScheduleModal(false)
            setScheduleMsg('')
            setInterviewDate('')
            setInterviewTime('')
            setInterviewNotes('')
          }, 1500)
        }
      }
    } catch (err) {
      setScheduleMsg('Failed to schedule interview')
    }
  }

  if (!user) return (
    <section className="mx-auto max-w-6xl px-4 py-12 grid place-items-center">
      <div className="card p-6 max-w-md text-center">
        <div className="font-semibold mb-2 text-[var(--text-primary)]">Please sign in to use chat</div>
        <div className="text-sm text-[var(--text-secondary)] mb-4">Sign in as candidate or employer and come back to message users.</div>
        <div className="flex items-center justify-center gap-2">
          <button className="btn" onClick={()=>nav('/sign')}>Sign in</button>
        </div>
      </div>
    </section>
  )

  const list = threads()
  const filtered = list.filter(item => {
    if (!search) return true
    const s = search.toLowerCase()
    return (item.user.name || '').toLowerCase().includes(s) || (item.user.email || '').toLowerCase().includes(s) || (item.last?.body || '').toLowerCase().includes(s)
  })

  const activeUser = contacts.find(c => c.email === activePeer)
  const convo = messages.filter(m => (m.from === user.email && m.to === activePeer) || (m.from === activePeer && m.to === user.email))

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <div className="card p-0 overflow-hidden">
        <div className="grid md:grid-cols-[320px,1fr]">
          <div className="p-4 border-r border-[var(--border)]">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-[var(--text-primary)]">Messages</div>
              <div className="text-sm text-[var(--text-secondary)]">{user.name}</div>
            </div>

            <div className="mb-3">
              <input className="input w-full" placeholder="Search" value={search} onChange={e=>setSearch(e.target.value)} />
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {filtered.map(item => (
                <button key={item.peer} type="button" className={`w-full text-left p-2 rounded hover:bg-[var(--bg-elevated)] flex items-center gap-3 ${activePeer===item.peer?'bg-[var(--bg-elevated)]':''}`} onClick={()=>openPeer(item.peer)}>
                  <div className="h-10 w-10 rounded-full bg-[var(--text-primary)] grid place-items-center text-[var(--bg-base)] text-sm">{(item.user.name||item.user.email||'U').slice(0,1)}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm text-[var(--text-primary)]">{item.user.name || item.user.email}</div>
                      {item.unread > 0 && <div className="text-xs bg-[var(--accent)] text-white px-2 py-0.5 rounded-full">{item.unread}</div>}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] truncate">{item.last ? item.last.body : 'No messages yet'}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="p-4">
            {!activePeer ? (
              <div className="h-[60vh] flex items-center justify-center text-[var(--text-secondary)]">Select a conversation to start chatting</div>
            ) : (
              <div className="flex flex-col h-[60vh]">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-medium text-[var(--text-primary)]">{activeUser?.name || activePeer}</div>
                      <div className="text-xs text-[var(--text-secondary)]">{activePeer}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn text-[10px] py-1.5 px-3 rounded-lg shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                        onClick={() => initVideoCall(true)}
                      >
                        📹 Video Call
                      </button>
                      {user?.role === 'employer' && (activeUser?.role === 'candidate' || !activeUser) && (
                        <button
                          type="button"
                          className="btn text-[10px] py-1.5 px-3 rounded-lg shadow-sm"
                          onClick={() => setShowScheduleModal(true)}
                        >
                          📅 Schedule Meeting
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-[var(--text-secondary)]">Role: {activeUser?.role || 'candidate'}</div>
                </div>

                <div ref={listRef} className="flex-1 overflow-y-auto mb-3 px-1">
                  {convo.length === 0 ? (
                    <div className="text-[var(--text-secondary)] text-sm">No messages yet. Say hello 👋</div>
                  ) : (
                    convo.map((m, i) => (
                      <div key={i} className={`mb-3 flex ${m.from === user.email ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] p-3 rounded-2xl ${m.from === user.email ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'}`}>
                          
                          <div className="text-sm">
                            {m.body.startsWith('[CALL_INITIATED:') ? (
                              <div className={`flex flex-col gap-2 p-2 rounded border ${m.from === user.email ? 'bg-indigo-700/50 border-indigo-500 text-indigo-50' : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-900 dark:text-emerald-100'}`}>
                                <div className="font-bold flex items-center gap-2"><span>📹</span> Video Call</div>
                                {m.from !== user.email && (
                                   <button className="btn bg-emerald-600 hover:bg-emerald-700 py-1.5 px-4 text-xs font-bold shadow shadow-emerald-500/30" onClick={() => initVideoCall(false, m.body.split(':')[1].replace(']',''))}>Join Call</button>
                                )}
                                {m.from === user.email && <div className="text-xs opacity-80">Waiting for {activeUser?.name || 'them'} to join...</div>}
                              </div>
                            ) : (
                              m.body
                            )}
                          </div>
                          
                          <div className="text-[10px] text-[var(--text-muted)] mt-1 opacity-80">{new Date(m.date).toLocaleString()}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-auto">
                  <div className="flex gap-2">
                    <input className="input flex-1" value={text} onChange={e=>setText(e.target.value)} placeholder="Write a message..." onKeyDown={e=>{ if (e.key==='Enter') send() }} />
                    <button className="btn" onClick={send}>Send</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="neo-card p-8 max-w-md w-full relative">
            <h3 className="font-bold text-[var(--text-primary)] text-base mb-1">Schedule a Meeting</h3>
            <p className="text-xs text-[var(--text-secondary)] mb-4">
              Booking interview session with <span className="font-semibold text-[var(--text-primary)]">{activeUser?.name || activePeer}</span>
            </p>

            {scheduleMsg && (
              <div className={`p-3 text-xs rounded mb-4 border ${scheduleMsg.includes('success') ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : 'bg-red-50 text-red-800 border-red-100'}`}>
                {scheduleMsg}
              </div>
            )}

            <form onSubmit={handleSchedule} className="space-y-4 text-sm text-[var(--text-secondary)]">
              <div>
                <label className="block text-xs text-[var(--text-muted)] font-semibold mb-1">Select Date</label>
                <input
                  type="date"
                  className="input text-sm py-2.5"
                  value={interviewDate}
                  onChange={(e) => setInterviewDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-[var(--text-muted)] font-semibold mb-1">Select Time</label>
                <input
                  type="time"
                  className="input text-sm py-2.5"
                  value={interviewTime}
                  onChange={(e) => setInterviewTime(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-[var(--text-muted)] font-semibold mb-1">Meeting Notes</label>
                <textarea
                  className="input text-sm py-2 h-20"
                  placeholder="Share meeting link / agenda..."
                  value={interviewNotes}
                  onChange={(e) => setInterviewNotes(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="btn-ghost text-xs py-2 px-4"
                  onClick={() => { setShowScheduleModal(false); setScheduleMsg(''); setInterviewDate(''); setInterviewTime(''); setInterviewNotes('') }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn text-xs py-2 px-4">
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {videoCallActive && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 animate-fade-in">
          <div className="flex flex-col md:flex-row gap-4 w-full max-w-6xl h-[70vh] mb-8">
            <div className="flex-1 bg-neutral-900 rounded-3xl overflow-hidden relative shadow-2xl border border-neutral-800">
              <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-xs font-bold border border-white/10 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> You
              </div>
            </div>
            <div className="flex-1 bg-neutral-900 rounded-3xl overflow-hidden relative shadow-2xl border border-neutral-800">
              {remoteStream ? (
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-neutral-500 gap-4">
                  <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  Waiting for connection...
                </div>
              )}
              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-xs font-bold border border-white/10 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${remoteStream ? 'bg-emerald-500' : 'bg-amber-500'}`}></span> Remote Peer
              </div>
            </div>
          </div>
          <button className="bg-red-600 hover:bg-red-700 text-white rounded-full px-10 py-4 font-bold shadow-2xl shadow-red-600/30 transition-all flex items-center gap-3 hover:-translate-y-1 active:translate-y-0" onClick={endCall}>
            <span className="text-xl">✖</span> End Call
          </button>
        </div>
      )}

    </section>
  )
}
