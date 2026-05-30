import { useState, useEffect } from 'react'

export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    function checkMobile() {
      const userAgent = typeof window.navigator === 'undefined' ? '' : navigator.userAgent
      const mobileRegEx = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
      const isSmallScreen = window.innerWidth <= 768
      
      setIsMobile(mobileRegEx.test(userAgent) || isSmallScreen)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return isMobile
}
