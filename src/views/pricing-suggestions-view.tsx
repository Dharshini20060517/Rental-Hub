'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFns, type ApiError } from '@/lib/api-client'
import { CardGridSkeleton } from '@/components/shared/states'
import { EmptyState } from '@/components/shared/feedback'
import { Button } from '@/components/ui/button'
import { Lightbulb, TrendingUp, TrendingDown, Check, X, Edit, Sparkles } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { toast } from 'sonner'

export function PricingSuggestionsView() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['pricing-suggestions'], queryFn: () => apiFns.getPricingSuggestions() })

  const suggestions = (data as { equipmentId: string; title: string; currentPrice: number; suggestedPrice: number; confidence: number; reasoning: string; inputs: { wishlistCount: number; reviewCount: number; bookingCount: number; categoryAverage: number; demandScore: number } }[]) || []

  async function handleAction(equipmentId: string, action: 'accept' | 'dismiss', editedPrice?: number) {
    try {
      if (action === 'accept') await apiFns.acceptPricingSuggestion(equipmentId, editedPrice)
      else await apiFns.dismissPricingSuggestion(equipmentId)
      qc.invalidateQueries({ queryKey: ['pricing-suggestions'] })
      toast.success(action === 'accept' ? 'Price updated' : 'Suggestion dismissed')
    } catch (err) {
      toast.error((err as ApiError).message)
    }
  }

  if (isLoading) return <div className="mx-auto max-w-4xl px-4 py-8"><CardGridSkeleton count={2} /></div>

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold tracking-tight"><Sparkles className="h-6 w-6 text-primary" /> Pricing suggestions</h1>
      <p className="mb-6 text-sm text-muted-foreground">AI-driven price recommendations based on demand, reviews, and market data</p>

      {suggestions.length === 0 ? <EmptyState title="No suggestions yet" description="Suggestions are generated based on your listing performance." icon={Lightbulb} /> : (
        <div className="space-y-3">
          {suggestions.map((s) => {
            const isIncrease = s.suggestedPrice > s.currentPrice
            const diff = Math.round(((s.suggestedPrice - s.currentPrice) / s.currentPrice) * 100)
            return (
              <div key={s.equipmentId} className="rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{s.title}</p>
                    <div className="mt-1 flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">{formatCurrency(s.currentPrice)}/day</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-bold text-primary">{formatCurrency(s.suggestedPrice)}/day</span>
                      <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-bold ${isIncrease ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
                        {isIncrease ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {diff > 0 ? '+' : ''}{diff}%
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${s.confidence >= 0.7 ? 'bg-emerald-500/10 text-emerald-600' : s.confidence >= 0.5 ? 'bg-amber-500/10 text-amber-600' : 'bg-muted text-muted-foreground'}`}>
                      {Math.round(s.confidence * 100)}% confidence
                    </span>
                  </div>
                </div>

                <p className="mt-2 text-sm text-muted-foreground">{s.reasoning}</p>

                {/* Inputs */}
                <div className="mt-3 grid grid-cols-4 gap-2 border-t pt-2 text-center text-xs">
                  <div><p className="font-bold">{s.inputs.wishlistCount}</p><p className="text-muted-foreground/70">Wishlists</p></div>
                  <div><p className="font-bold">{s.inputs.bookingCount}</p><p className="text-muted-foreground/70">Bookings</p></div>
                  <div><p className="font-bold">{formatCurrency(s.inputs.categoryAverage)}</p><p className="text-muted-foreground/70">Cat avg</p></div>
                  <div><p className="font-bold">{s.inputs.demandScore}</p><p className="text-muted-foreground/70">Demand</p></div>
                </div>

                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => handleAction(s.equipmentId, 'accept')}><Check className="mr-1 h-3.5 w-3.5" /> Accept</Button>
                  <Button size="sm" variant="outline" onClick={() => handleAction(s.equipmentId, 'dismiss')}><X className="mr-1 h-3.5 w-3.5" /> Dismiss</Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
