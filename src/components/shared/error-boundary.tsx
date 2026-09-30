'use client'

import { Component, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message: string }> {
  state = { hasError: false, message: '' }
  static getDerivedStateFromError(err: unknown) {
    return { hasError: true, message: err instanceof Error ? err.message : 'Unexpected error' }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <h2 className="text-lg font-semibold">This view crashed</h2>
          <p className="text-sm text-muted-foreground">{this.state.message}</p>
          <Button variant="outline" onClick={() => this.setState({ hasError: false, message: '' })}>Try again</Button>
        </div>
      )
    }
    return this.props.children
  }
}
