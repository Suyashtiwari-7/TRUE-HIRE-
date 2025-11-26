import { useEffect } from 'react'

export default function useTabWarning(onWarn){
  useEffect(()=>{
    function handle(){
      if (document.hidden) onWarn?.('tab-hidden')
    }
    document.addEventListener('visibilitychange', handle)
    return ()=> document.removeEventListener('visibilitychange', handle)
  },[onWarn])
}
