'use client'

import { useState } from 'react'
import { ChevronDown, HelpCircle } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const FAQS = [
  {
    q: 'How do I rent this equipment?',
    a: 'Click "Book now" to select your dates and request a rental. The owner will confirm availability, and you\'ll receive pickup instructions. Payments are processed securely through RentalHub.',
  },
  {
    q: 'What is the security deposit?',
    a: 'A refundable security deposit is held for the duration of your rental. It\'s released automatically once the equipment is returned in good condition. The deposit amount is shown in the pricing section.',
  },
  {
    q: 'Can I rent for less than a day?',
    a: 'Hourly pricing is available for some listings. Check the Pricing tab for hourly rates. If hourly pricing isn\'t listed, the minimum rental period is one day.',
  },
  {
    q: 'What if the equipment breaks during my rental?',
    a: 'Contact the owner immediately through the "Contact owner" button. If the damage is pre-existing or normal wear, you\'re not liable. For accidental damage, the security deposit may be partially withheld. RentalHub mediates all disputes.',
  },
  {
    q: 'How does dynamic pricing work?',
    a: 'Owners can set weekend surcharges, long-rental discounts, and seasonal pricing. The Pricing tab includes a calculator that shows the exact cost for your selected dates, including all applicable surcharges and discounts.',
  },
  {
    q: 'Can I pick up the equipment or get it delivered?',
    a: 'Pickup is available from the owner\'s location. Some owners offer delivery for an additional fee. Contact the owner to arrange delivery options.',
  },
  {
    q: 'What if I need to cancel?',
    a: 'Cancellations made 48+ hours before the rental start are fully refunded. Within 48 hours, a 50% fee applies. See our cancellation policy for full details.',
  },
]

export function FaqSection() {
  return (
    <section className="mt-10">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
        <HelpCircle className="h-5 w-5 text-primary" />
        Frequently asked questions
      </h2>
      <Accordion type="single" collapsible className="rounded-xl border bg-card">
        {FAQS.map((faq, i) => (
          <AccordionItem key={i} value={`item-${i}`} className="border-b last:border-0">
            <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
              {faq.q}
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-3 text-sm text-muted-foreground">
              {faq.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}
