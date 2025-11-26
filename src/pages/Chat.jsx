import { useEffect, useState, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

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

  const [user, setUser] = useState(null)
  const [contacts, setContacts] = useState([])
  const [messages, setMessages] = useState([])
  const [activePeer, setActivePeer] = useState(peerParam || '')
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const listRef = useRef()
  const bcRef = useRef(null)

  useEffect(() => {
    try{
      const raw = localStorage.getItem('truehire_user')
      const me = raw ? JSON.parse(raw) : null
      setUser(me)
      setContacts(loadUsers())
      setMessages(loadMessages())
      if (peerParam) setActivePeer(peerParam)
    }catch(e){ setUser(null); setContacts([]); setMessages([]) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerParam])

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

  if (!user) return (
    <section className="mx-auto max-w-6xl px-4 py-12 grid place-items-center">
      <div className="card p-6 max-w-md text-center">
        <div className="font-semibold mb-2">Please sign in to use chat</div>
        <div className="text-sm text-neutral-600 mb-4">Sign in as candidate or employer and come back to message users.</div>
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
          <div className="p-4 border-r">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Messages</div>
              <div className="text-sm text-neutral-500">{user.name}</div>
            </div>

            <div className="mb-3">
              <input className="input w-full" placeholder="Search" value={search} onChange={e=>setSearch(e.target.value)} />
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {filtered.map(item => (
                <button key={item.peer} type="button" className={`w-full text-left p-2 rounded hover:bg-neutral-100 flex items-center gap-3 ${activePeer===item.peer?'bg-neutral-50':''}`} onClick={()=>openPeer(item.peer)}>
                  <div className="h-10 w-10 rounded-full bg-neutral-900 grid place-items-center text-white text-sm">{(item.user.name||item.user.email||'U').slice(0,1)}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm">{item.user.name || item.user.email}</div>
                      {item.unread > 0 && <div className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">{item.unread}</div>}
                    </div>
                    <div className="text-xs text-neutral-500 truncate">{item.last ? item.last.body : 'No messages yet'}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="p-4">
            {!activePeer ? (
              <div className="h-[60vh] flex items-center justify-center text-neutral-500">Select a conversation to start chatting</div>
            ) : (
              <div className="flex flex-col h-[60vh]">
                <div className="flex items-center justify-between border-b pb-3 mb-3">
                  <div>
                    <div className="font-medium">{activeUser?.name || activePeer}</div>
                    <div className="text-xs text-neutral-500">{activePeer}</div>
                  </div>
                  <div className="text-sm text-neutral-500">Role: {activeUser?.role || 'candidate'}</div>
                </div>

                <div ref={listRef} className="flex-1 overflow-y-auto mb-3 px-1">
                  {convo.length === 0 ? (
                    <div className="text-neutral-500 text-sm">No messages yet. Say hello 👋</div>
                  ) : (
                    convo.map((m, i) => (
                      <div key={i} className={`mb-3 flex ${m.from === user.email ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] p-3 rounded ${m.from === user.email ? 'bg-blue-600 text-white' : 'bg-neutral-100 text-neutral-900'}`}>
                          <div className="text-sm">{m.body}</div>
                          <div className="text-xs text-neutral-400 mt-1">{new Date(m.date).toLocaleString()}</div>
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
    </section>
  )
}
