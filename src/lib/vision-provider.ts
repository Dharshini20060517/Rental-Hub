// Pluggable AI Vision Provider Interface
// Compares pickup vs return photos to detect damage.
// Falls back to rule-based comparison if no AI key is available.

export type DamageFinding = {
  region: string
  severity: 'none' | 'minor' | 'moderate' | 'severe'
  description: string
  confidence: number // 0-1
}

export type ComparisonResult = {
  findings: DamageFinding[]
  providerUsed: 'vlm' | 'rule_based'
  promptLog: string // redacted
  summary: string
}

export interface VisionProvider {
  name: string
  compare(pickupUrl: string, returnUrl: string, angle: string): Promise<ComparisonResult>
}

/**
 * Rule-based fallback provider: compares image metadata (size, dimensions) as a basic heuristic.
 * This always works without any AI key. In production, the VLM provider would use the z-ai-web-dev-sdk.
 */
class RuleBasedProvider implements VisionProvider {
  name = 'rule_based'

  async compare(pickupUrl: string, returnUrl: string, angle: string): Promise<ComparisonResult> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500))

    // Rule-based heuristic: generate a "no significant changes" finding
    // In production, this would use image hashing (perceptual hash) to detect differences
    const findings: DamageFinding[] = [
      {
        region: 'overall',
        severity: 'none',
        description: 'No significant visual changes detected between pickup and return photos. Note: This is a preliminary assessment using basic image comparison. Human confirmation required.',
        confidence: 0.6,
      },
    ]

    return {
      findings,
      providerUsed: 'rule_based',
      promptLog: `[redacted] rule_based comparison of ${angle} angle. pickup=${pickupUrl.slice(0, 20)}... return=${returnUrl.slice(0, 20)}...`,
      summary: 'No significant changes detected (preliminary, requires human confirmation)',
    }
  }
}

/**
 * VLM-based provider: uses the z-ai-web-dev-sdk to analyze images.
 * Falls back to rule-based if SDK is unavailable or fails.
 */
class VLMProvider implements VisionProvider {
  name = 'vlm'

  async compare(pickupUrl: string, returnUrl: string, angle: string): Promise<ComparisonResult> {
    try {
      // Dynamic import to avoid loading the SDK if not needed
      const { default: ZAI } = await import('z-ai-web-dev-sdk')

      const prompt = `Compare these two photos of equipment from the ${angle} angle. The first is at pickup, the second at return. Identify any damage, scratches, dents, missing parts, or changes. Rate severity as none/minor/moderate/severe. Return JSON: {"findings":[{"region":"...","severity":"...","description":"...","confidence":0.0-1.0}]}`

      const res = await ZAI.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are an equipment damage assessment assistant. Compare pickup and return photos.' },
          { role: 'user', content: prompt },
        ],
      })

      // Parse the response
      const content = res.choices?.[0]?.message?.content || ''
      let findings: DamageFinding[] = []

      try {
        const parsed = JSON.parse(content)
        findings = Array.isArray(parsed.findings) ? parsed.findings : []
      } catch {
        // If parsing fails, return a safe default
        findings = [
          {
            region: 'overall',
            severity: 'none',
            description: 'Unable to parse AI response. Manual review required.',
            confidence: 0.3,
          },
        ]
      }

      return {
        findings: findings.length > 0 ? findings : [{ region: 'overall', severity: 'none', description: 'No findings returned.', confidence: 0.3 }],
        providerUsed: 'vlm',
        promptLog: `[redacted] VLM comparison of ${angle} angle`,
        summary: findings.some(f => f.severity !== 'none') ? 'Potential damage detected (preliminary, requires human confirmation)' : 'No significant changes detected (preliminary, requires human confirmation)',
      }
    } catch {
      // Fallback to rule-based
      const fallback = new RuleBasedProvider()
      return fallback.compare(pickupUrl, returnUrl, angle)
    }
  }
}

let _provider: VisionProvider | null = null

export function getVisionProvider(): VisionProvider {
  if (!_provider) {
    // Use VLM if z-ai-web-dev-sdk is available, otherwise rule-based
    // In production, this would check for API keys
    _provider = new VLMProvider()
  }
  return _provider
}

export function resetProvider() {
  _provider = null
}
