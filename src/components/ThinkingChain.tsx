import { useApp } from '../lib/app-context'
import { cn } from './ui'

/** 底栏中间：只保留幽灵思维链提示，不显示五环节文案 */
export function ThinkingChain() {
  const { project } = useApp()
  const running =
    project.backgroundStatus === 'running' ||
    project.outlineStatus === 'running' ||
    Object.values(project.planStatus).includes('running') ||
    Object.values(project.research).some((r) => r.status === 'running') ||
    Object.values(project.slides).some((s) => s.status === 'running')

  return (
    <div className="flex min-w-0 items-center justify-center gap-2 text-xs">
      {/* 小屏：三个幽灵小点 */}
      <span className="flex items-center gap-1 sm:hidden">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn('h-1.5 w-1.5 rounded-full bg-muted-foreground/60', running && 'ghost-breathe')}
            style={running ? { animationDelay: `${i * 0.22}s` } : undefined}
          />
        ))}
      </span>
      {/* 大屏：内容已就绪不闪动；生成中闪动 */}
      {running ? (
        <span className="ghost-shimmer hidden whitespace-nowrap sm:inline">正在组织内容…</span>
      ) : (
        <span className="hidden whitespace-nowrap text-muted-foreground/75 sm:inline">内容已就绪</span>
      )}
    </div>
  )
}
