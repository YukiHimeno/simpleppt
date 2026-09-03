import { createContext, useContext } from 'react'
import type { Project, Settings } from 'shared/types'

export type Stage = Project['stage']

export interface AppCtxValue {
  project: Project
  patch: (fn: (p: Project) => Project) => void
  settings: Settings
  setSettings: (s: Settings) => void
  go: (stage: Stage) => void
  openSettings: (tab?: 'api' | 'search') => void
  openStyle: () => void
}

export const AppCtx = createContext<AppCtxValue | null>(null)

export function useApp(): AppCtxValue {
  const v = useContext(AppCtx)
  if (!v) throw new Error('useApp must be used within AppCtx')
  return v
}
