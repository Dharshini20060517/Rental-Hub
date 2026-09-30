'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { useRouterStore } from '@/store/router'
import { Toaster } from '@/components/ui/sonner'

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )
  const initAuth = useAuthStore((s) => s.init)
  const initFromUrl = useRouterStore((s) => s.initFromUrl)

  useEffect(() => {
    initFromUrl()
    initAuth()
    const onPop = () => initFromUrl()
    window.addEventListener('popstate', onPop)
    const onExpired = () => {
      useAuthStore.setState({ user: null, status: 'unauthenticated' })
      useRouterStore.getState().navigate('login', { reason: 'expired' })
    }
    window.addEventListener('rh:session-expired', onExpired as EventListener)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('rh:session-expired', onExpired as EventListener)
    }
  }, [initAuth, initFromUrl])

  return (
    <QueryClientProvider client={qc}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        {children}
        <Toaster richColors position="top-right" closeButton />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
