import { useEffect, useRef } from 'react'

// Monitors a <video> element, checks brightness and frame-change to detect dark or frozen camera.
// onWarn is called with types: 'camera-dark' | 'camera-frozen'
export default function useCameraMonitor(videoRef, { onWarn, onMetrics, sampleMs = 500, width = 96, height = 54, darkThreshold = 20, darkFrames = 8, stillThreshold = 4, stillFrames = 10, blackPixelThreshold = 30, blackPixelPercent = 0.6 } = {}){
  const darkCountRef = useRef(0)
  const stillCountRef = useRef(0)
  const lastFrameRef = useRef(null)
  const warnedRef = useRef({ dark: false, frozen: false })
  const timerRef = useRef(null)

  useEffect(() => {
    if (!videoRef || !videoRef.current) {
      return
    }

    function start(){
      stop()
      timerRef.current = setInterval(() => {
        const video = videoRef?.current
        if (!video || video.readyState < 2 || video.paused) return
        
        const cw = width
        const ch = height
        const canvas = document.createElement('canvas')
        canvas.width = cw
        canvas.height = ch
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        
        try {
          ctx.drawImage(video, 0, 0, cw, ch)
        } catch (e) {
          return // video not ready
        }
        
  const { data } = ctx.getImageData(0, 0, cw, ch)
        
        // Avg brightness and black-pixel percent (to detect covered cams despite auto-exposure)
        let sum = 0
        let black = 0
        for (let i = 0; i < data.length; i += 4){
          const r = data[i], g = data[i+1], b = data[i+2]
          const y = 0.2126*r + 0.7152*g + 0.0722*b
          sum += y
          if (y < blackPixelThreshold) black += 1
        }
        const avg = sum / (data.length / 4)
        const blackPercent = black / (data.length / 4)

        // Use blackPercent for dark detection as it's more robust when camera auto-exposure keeps avg non-zero.
        if (blackPercent >= blackPixelPercent){
          darkCountRef.current += 1
          if (!warnedRef.current.dark && darkCountRef.current >= darkFrames){
            warnedRef.current.dark = true
            onWarn?.('camera-dark')
          }
        } else {
          darkCountRef.current = 0
          warnedRef.current.dark = false
        }
        
        // Frozen detection via frame diff
        let norm = null
        if (lastFrameRef.current){
          let diff = 0
          const prev = lastFrameRef.current
          const len = Math.min(prev.length, data.length)
          for (let i = 0; i < len; i += 4){
            diff += Math.abs(data[i] - prev[i]) + Math.abs(data[i+1] - prev[i+1]) + Math.abs(data[i+2] - prev[i+2])
          }
          norm = diff / (len / 4)
          if (norm < stillThreshold){
            stillCountRef.current += 1
            if (!warnedRef.current.frozen && stillCountRef.current >= stillFrames){
              warnedRef.current.frozen = true
              onWarn?.('camera-frozen')
            }
          } else {
            stillCountRef.current = 0
            warnedRef.current.frozen = false
          }
        }
        // copy frame data for next comparison
        // copy frame data for next comparison (slice for a real copy)
        try{
          lastFrameRef.current = data.slice()
        }catch(e){
          lastFrameRef.current = null
        }

        // emit metrics for debugging/observability
        try{
          onMetrics?.({ avg, blackPercent, norm, darkCount: darkCountRef.current, stillCount: stillCountRef.current })
        }catch(e){ /* swallow */ }
      }, sampleMs)
    }

    function stop(){
      if (timerRef.current){
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      darkCountRef.current = 0
      stillCountRef.current = 0
      lastFrameRef.current = null
      warnedRef.current = { dark: false, frozen: false }
    }

    start()
    return () => stop()
  }, [videoRef, onWarn, sampleMs, width, height, darkThreshold, darkFrames, stillThreshold, stillFrames])
}
