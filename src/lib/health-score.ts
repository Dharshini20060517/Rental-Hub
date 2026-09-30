// Listing health score — a 0-100 metric that helps owners understand how
// complete and optimized their listings are. Higher = better.

export type HealthCheck = {
  label: string
  passed: boolean
  points: number
  maxPoints: number
  hint?: string
}

export type HealthScore = {
  score: number // 0-100
  grade: 'A' | 'B' | 'C' | 'D'
  checks: HealthCheck[]
}

export function calculateHealthScore(opts: {
  status: string
  imageCount: number
  specCount: number
  hasPricingRules: boolean
  hasLocation: boolean
  reviewCount: number
  avgRating: number
  hasConditionNotes: boolean
  hasHourlyPrice: boolean
  hasReplacementValue: boolean
}): HealthScore {
  const checks: HealthCheck[] = []

  // Status: active (20 pts)
  checks.push({
    label: 'Listing is active',
    passed: opts.status === 'active',
    points: opts.status === 'active' ? 20 : 0,
    maxPoints: 20,
    hint: opts.status === 'active' ? undefined : 'Activate your listing to make it visible to customers',
  })

  // Images: at least 3 (15 pts)
  const imgScore = Math.min(15, opts.imageCount * 5)
  checks.push({
    label: `${opts.imageCount} image${opts.imageCount !== 1 ? 's' : ''} uploaded`,
    passed: opts.imageCount >= 3,
    points: imgScore,
    maxPoints: 15,
    hint: opts.imageCount < 3 ? `Add ${3 - opts.imageCount} more image${3 - opts.imageCount !== 1 ? 's' : ''} for best results` : undefined,
  })

  // Specs: at least 3 (10 pts)
  const specScore = Math.min(10, opts.specCount * 3)
  checks.push({
    label: `${opts.specCount} specification${opts.specCount !== 1 ? 's' : ''} listed`,
    passed: opts.specCount >= 3,
    points: specScore,
    maxPoints: 10,
    hint: opts.specCount < 3 ? 'Add more specifications (power, weight, brand, etc.)' : undefined,
  })

  // Pricing rules: dynamic pricing (10 pts)
  checks.push({
    label: 'Dynamic pricing rules configured',
    passed: opts.hasPricingRules,
    points: opts.hasPricingRules ? 10 : 0,
    maxPoints: 10,
    hint: opts.hasPricingRules ? undefined : 'Add weekend surcharge or long-rental discounts',
  })

  // Location (10 pts)
  checks.push({
    label: 'Location set',
    passed: opts.hasLocation,
    points: opts.hasLocation ? 10 : 0,
    maxPoints: 10,
    hint: opts.hasLocation ? undefined : 'Add city and coordinates for distance-based search',
  })

  // Reviews (15 pts) — 5 pts per review up to 3, plus 5 for avg rating >= 4
  const reviewPts = Math.min(10, opts.reviewCount * 5) + (opts.avgRating >= 4 && opts.reviewCount > 0 ? 5 : 0)
  checks.push({
    label: opts.reviewCount > 0 ? `${opts.reviewCount} review${opts.reviewCount !== 1 ? 's' : ''} · ${opts.avgRating.toFixed(1)}★ avg` : 'No reviews yet',
    passed: opts.reviewCount >= 1,
    points: reviewPts,
    maxPoints: 15,
    hint: opts.reviewCount === 0 ? 'Encourage customers to leave reviews after rentals' : undefined,
  })

  // Condition notes (5 pts)
  checks.push({
    label: 'Condition notes provided',
    passed: opts.hasConditionNotes,
    points: opts.hasConditionNotes ? 5 : 0,
    maxPoints: 5,
    hint: opts.hasConditionNotes ? undefined : 'Add service history or known wear notes',
  })

  // Hourly price (5 pts)
  checks.push({
    label: 'Hourly pricing available',
    passed: opts.hasHourlyPrice,
    points: opts.hasHourlyPrice ? 5 : 0,
    maxPoints: 5,
    hint: opts.hasHourlyPrice ? undefined : 'Add hourly pricing for short rentals',
  })

  // Replacement value (5 pts)
  checks.push({
    label: 'Replacement value set',
    passed: opts.hasReplacementValue,
    points: opts.hasReplacementValue ? 5 : 0,
    maxPoints: 5,
    hint: opts.hasReplacementValue ? undefined : 'Set replacement value for deposit calculation',
  })

  // Extra: has buffer time (5 pts)
  const score = checks.reduce((sum, c) => sum + c.points, 0)

  let grade: HealthScore['grade'] = 'D'
  if (score >= 85) grade = 'A'
  else if (score >= 70) grade = 'B'
  else if (score >= 50) grade = 'C'

  return { score, grade, checks }
}

export function gradeColor(grade: HealthScore['grade']): string {
  switch (grade) {
    case 'A': return 'text-emerald-600 bg-emerald-500/10 border-emerald-500/30'
    case 'B': return 'text-sky-600 bg-sky-500/10 border-sky-500/30'
    case 'C': return 'text-amber-600 bg-amber-500/10 border-amber-500/30'
    case 'D': return 'text-rose-600 bg-rose-500/10 border-rose-500/30'
  }
}
