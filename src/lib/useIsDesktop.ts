import { useState, useEffect } from 'react'

const MOBILE_BP = 1024

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= MOBILE_BP)
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= MOBILE_BP)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isDesktop
}
