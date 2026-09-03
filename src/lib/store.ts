import { DEFAULT_SETTINGS, type Project, type Settings } from 'shared/types'

const SETTINGS_KEY = 'simpleppt.settings.v1'
const PROJECT_KEY = 'simpleppt.project.v1'
const THEME_KEY = 'simpleppt.theme.v1'

export function emptyProject(topic = ''): Project {
  return {
    topic,
    stage: 'home',
    interview: { questions: [], questionsDone: false, summary: null, summaryDone: false },
    referenceFiles: [],
    background: null,
    backgroundStatus: 'pending',
    searchDegraded: null,
    outline: null,
    outlineStatus: 'pending',
    research: {},
    plan: [],
    planStatus: {},
    slides: {},
    updatedAt: Date.now(),
  }
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_SETTINGS }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

/** 运行中的状态重置为待执行（刷新后 / 导入备份后共用） */
export function resetTransientState(p: Project): Project {
  const q: Project = { ...p, planStatus: {}, research: { ...(p.research ?? {}) }, slides: { ...(p.slides ?? {}) } }
  for (const k of Object.keys(q.research)) {
    if (q.research[k].status === 'running') q.research[k] = { ...q.research[k], status: 'pending' }
  }
  for (const k of Object.keys(q.slides)) {
    if (q.slides[k].status === 'running') q.slides[k] = { ...q.slides[k], status: 'pending' }
  }
  return q
}

export function loadProject(): Project | null {
  try {
    const raw = localStorage.getItem(PROJECT_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Project
      return resetTransientState(p)
    }
  } catch {
    /* ignore */
  }
  return null
}

export function saveProject(p: Project) {
  try {
    localStorage.setItem(PROJECT_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

export function clearProject() {
  try {
    localStorage.removeItem(PROJECT_KEY)
  } catch {
    /* ignore */
  }
}

export type ThemeMode = 'light' | 'dark' | 'auto'

export function loadTheme(): ThemeMode {
  try {
    const t = localStorage.getItem(THEME_KEY)
    if (t === 'light' || t === 'dark' || t === 'auto') return t
  } catch {
    /* ignore */
  }
  return 'auto'
}

export function saveTheme(t: ThemeMode) {
  try {
    localStorage.setItem(THEME_KEY, t)
  } catch {
    /* ignore */
  }
}
