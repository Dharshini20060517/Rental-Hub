'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type LightboxImage = { id: string; url: string; caption?: string }

export function Lightbox({
  images,
  index,
  open,
  onClose,
}: {
  images: LightboxImage[]
  index: number
  open: boolean
  onClose: () => void
}) {
  const [current, setCurrent] = useState(index)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrent(index)
  }, [index, open])

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % images.length)
  }, [images.length])
  const prev = useCallback(() => {
    setCurrent((c) => (c - 1 + images.length) % images.length)
  }, [images.length])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
    }
    document.addEventListener('keydown', onKey)
    // lock scroll
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, next, prev, onClose])

  if (!open || images.length === 0) return null
  const img = images[current]

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm rh-fade-in"
      onClick={onClose}
      role="dialog"
      aria-label="Image lightbox"
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Counter */}
      <div className="absolute left-4 top-4 z-10 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white">
        {current + 1} / {images.length}
      </div>

      {/* Prev */}
      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); prev() }}
          className="absolute left-4 z-10 grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          aria-label="Previous"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Image */}
      <div className="max-h-[85vh] max-w-[90vw] p-8" onClick={(e) => e.stopPropagation()}>
        { }
        <img
          src={img.url}
          alt={img.caption || ''}
          className="mx-auto max-h-full max-w-full rounded-lg object-contain shadow-2xl"
        />
        {img.caption && <p className="mt-3 text-center text-sm text-white/80">{img.caption}</p>}
      </div>

      {/* Next */}
      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); next() }}
          className="absolute right-4 z-10 grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          aria-label="Next"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 z-10 flex max-w-[90vw] -translate-x-1/2 gap-2 overflow-x-auto rh-scroll rounded-lg bg-black/40 p-2">
          {images.map((im, i) => (
            <button
              key={im.id}
              onClick={(e) => { e.stopPropagation(); setCurrent(i) }}
              className={cn(
                'h-14 w-20 shrink-0 overflow-hidden rounded-md border-2 transition',
                i === current ? 'border-primary opacity-100' : 'border-transparent opacity-50 hover:opacity-80',
              )}
            >
              { }
              <img src={im.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
