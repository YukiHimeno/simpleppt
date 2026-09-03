import { useApp } from '../lib/app-context'
import { STEPS } from '../lib/steps'
import { cn } from './ui'

/** 五阶段竖向导航。桌面是右侧完整面板；移动端收成右缘一排可点的圆点刻度。 */
export function StageRail({ onNavigate }: { onNavigate?: () => void }) {
  const { project, go } = useApp()

  const unlocked: string[] = ['interview']
  if (project.interview.questionsDone || project.outline) unlocked.push('outline')
  if (project.outline) unlocked.push('research', 'plan')
  if (project.plan.length > 0) unlocked.push('slides')
  const curIdx = Math.max(
    0,
    STEPS.findIndex((s) => s.id === project.stage),
  )

  return (
    <nav
      aria-label="阶段导航"
      className="flex w-10 flex-col items-center rounded-full bg-background/70 py-3 backdrop-blur lg:w-48 lg:items-stretch lg:rounded-md lg:border lg:border-border lg:bg-card/95 lg:p-3 lg:shadow-lg"
    >
      <p className="mb-2 hidden w-full px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground lg:block">制作流程</p>
      <ol className="relative flex w-full flex-col items-center gap-2 lg:block lg:space-y-1">
        <span aria-hidden className="absolute bottom-2 left-[9px] top-2 hidden w-px bg-border lg:block" />
        {STEPS.map((s, i) => {
          const enabled = unlocked.includes(s.id)
          const cur = s.id === project.stage
          const done = !cur && i < curIdx && enabled
          return (
            <li key={s.id} className="lg:flex lg:items-center lg:gap-2.5">
              <button
                disabled={!enabled}
                onClick={() => {
                  go(s.id)
                  onNavigate?.()
                }}
                className="group flex flex-col items-center py-1 lg:flex-1 lg:flex-row lg:items-center lg:gap-2.5 lg:py-1.5 lg:text-left"
              >
                <span
                  aria-hidden
                  className={cn(
                    'flex h-2.5 w-2.5 items-center justify-center rounded-full transition-all lg:h-[18px] lg:w-[18px] lg:text-[9px] lg:font-semibold',
                    cur
                      ? 'scale-125 bg-primary ring-2 ring-primary/30 lg:scale-100'
                      : done
                        ? 'bg-primary/50 lg:bg-primary/15'
                        : enabled
                          ? 'bg-muted-foreground/45 lg:border lg:border-border lg:bg-card lg:text-muted-foreground'
                          : 'bg-muted-foreground/15 lg:border lg:border-border lg:bg-card lg:text-muted-foreground/40',
                  )}
                >
                  <span className="hidden lg:inline">
                    <s.icon className="h-3 w-3" strokeWidth={2.5} />
                  </span>
                </span>
                <span
                  className={cn(
                    'hidden text-xs leading-tight lg:inline',
                    cur
                      ? 'font-semibold text-foreground'
                      : enabled
                        ? 'text-muted-foreground transition-colors group-hover:text-foreground'
                        : 'text-muted-foreground/40',
                  )}
                >
                  {s.label}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
