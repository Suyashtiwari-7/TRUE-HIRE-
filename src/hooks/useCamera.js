import { useEffect, useRef, useState } from 'react'

export default function useCamera(autoStart = false){
  const videoRef = useRef(null)
  const [active, setActive] = useState(false)
  const [error, setError] = useState('')

  async function start(){
    try{
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      if (videoRef.current){
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setActive(true)
      }
    }catch(e){
      setError(e?.message || 'Unable to access camera')
      setActive(false)
    }
  }

  function stop(){
    const v = videoRef.current
    const stream = v && v.srcObject
    if (stream){
      stream.getTracks().forEach(t => t.stop())
      v.srcObject = null
    }
    setActive(false)
  }

  useEffect(()=>{
    if (autoStart) start()
    return () => stop()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])

  return { videoRef, start, stop, active, error }
}
