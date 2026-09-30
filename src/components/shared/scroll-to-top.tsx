'use client'

import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 400)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Scroll to top"
      className="rh-fade-in fixed bottom-4 right-4 z-40 grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-110 hover:shadow-xl"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  )
}
