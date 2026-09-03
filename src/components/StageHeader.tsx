import type { ReactNode } from 'react'
import { STEPS } from '../lib/steps'

export function StageHeader({ step, title, desc, children }: { step: string; title: string; desc: string; children?: ReactNode }) {
  const Icon = STEPS[Number(step) - 1]?.icon
  return (
    <div className="mb-6 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-primary">
        {Icon && <Icon className="h-4 w-4" />}
        STEP {step} / 5
      </div>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{desc}</p>
      {children}
    </div>
  )
}
