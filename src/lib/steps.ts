import type { LucideIcon } from 'lucide-react'
import { ClipboardList, MessagesSquare, Presentation, Search, StickyNote } from 'lucide-react'
import type { Stage } from './app-context'

export interface StepMeta {
  id: Stage
  label: string
  icon: LucideIcon
}

/** 五个生成阶段的统一图标与名称：顶栏导航、阶段页头、首页磁贴共用同一套。 */
export const STEPS: StepMeta[] = [
  { id: 'interview', label: '需求访谈', icon: MessagesSquare },
  { id: 'outline', label: '便利贴大纲', icon: StickyNote },
  { id: 'research', label: '资料检索', icon: Search },
  { id: 'plan', label: '页面策划', icon: ClipboardList },
  { id: 'slides', label: '生成幻灯片', icon: Presentation },
]

export const STEP_BY_ID: Record<Stage, StepMeta> = Object.fromEntries(STEPS.map((s) => [s.id, s])) as Record<Stage, StepMeta>
