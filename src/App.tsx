import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Github, Monitor, Moon, Palette, RotateCcw, Settings2, Sun, Upload } from 'lucide-react'
import { AppCtx, type AppCtxValue, type Stage } from './lib/app-context'
import {
  clearProject,
  emptyProject,
  loadProject,
  loadSettings,
  loadTheme,
  saveProject,
  saveSettings,
  saveTheme,
  type ThemeMode,
} from './lib/store'
import { exportProjectFile, readProjectFile } from './lib/project-io'
import { Badge, Button, Dialog, ToastProvider, cn } from './components/ui'
import { Logo } from './components/Logo'
import { SettingsDialog } from './components/SettingsDialog'
import { StyleEditor } from './components/StyleEditor'
import { StageRail } from './components/StageRail'
import { ThinkingChain } from './components/ThinkingChain'
import { Home } from './components/Home'
import { StageInterview } from './stages/StageInterview'
import { StageOutline } from './stages/StageOutline'
import { StageResearch } from './stages/StageResearch'
import { StagePlan } from './stages/StagePlan'
import { StageSlides } from './stages/StageSlides'
import type { Project, Settings } from 'shared/types'

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [theme, setTheme] = useState<ThemeMode>(loadTheme)
  const [systemDark, setSystemDark] = useState(false)
  const [project, setProject] = useState<Project>(() => loadProject() ?? emptyProject())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'api' | 'search'>('api')
  const [styleOpen, setStyleOpen] = useState(false)
  const [confirmNew, setConfirmNew] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [imported, setImported] = useState<Project | null>(null)
  const [importError, setImportError] = useState('')
  const importInputRef = useRef<HTMLInputElement>(null)

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      setImported(await readProjectFile(file))
      setImportError('')
    } catch (err: any) {
      setImportError(err?.message ?? String(err))
    }
  }

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  useEffect(() => {
    saveTheme(theme)
    const resolved = theme === 'auto' ? systemDark : theme === 'dark'
    document.documentElement.classList.toggle('dark', resolved)
  }, [theme, systemDark])

  // 自动主题：跟随系统深浅色变化
  useEffect(() => {
    if (theme !== 'auto') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    setSystemDark(mq.matches)
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [theme])

  useEffect(() => {
    const t = setTimeout(() => saveProject(project), 400)
    return () => clearTimeout(t)
  }, [project])

  // 点击底栏菜单外部时收起
  useEffect(() => {
    if (!menuOpen) return
    const h = (e: MouseEvent) => {
      const el = e.target as Element | null
      if (el && !el.closest('[data-settings-trigger]') && !el.closest('[data-settings-menu]')) setMenuOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [menuOpen])

  const patch = useCallback((fn: (p: Project) => Project) => setProject((p) => ({ ...fn(p), updatedAt: Date.now() })), [])
  const go = useCallback((stage: Stage) => setProject((p) => ({ ...p, stage, updatedAt: Date.now() })), [])
  const openSettings = useCallback((tab: 'api' | 'search' = 'api') => {
    setSettingsTab(tab)
    setSettingsOpen(true)
  }, [])
  const openStyle = useCallback(() => setStyleOpen(true), [])

  const ctx: AppCtxValue = { project, patch, settings, setSettings, go, openSettings, openStyle }

  const closeMenu = () => setMenuOpen(false)

  return (
    <AppCtx.Provider value={ctx}>
      <ToastProvider>
        <div className="min-h-screen pb-16">
          {project.stage === 'home' ? (
            <Home />
          ) : (
            <main key={project.stage} className="mx-auto max-w-6xl px-4 pb-8 pt-8">
              <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-8">
                <div className="min-w-0">
                  {project.stage === 'interview' && <StageInterview />}
                  {project.stage === 'outline' && <StageOutline />}
                  {project.stage === 'research' && <StageResearch />}
                  {project.stage === 'plan' && <StagePlan />}
                  {project.stage === 'slides' && <StageSlides />}
                </div>
                <aside className="hidden self-start lg:sticky lg:top-6 lg:block">
                  <StageRail />
                </aside>
              </div>
            </main>
          )}
        </div>

        {/* 移动端：右缘浮动的圆点刻度（完整面板在 lg+ 时随内容栏显示） */}
        {project.stage !== 'home' && (
          <div className="fixed right-1.5 top-1/2 z-30 -translate-y-1/2 lg:hidden">
            <StageRail />
          </div>
        )}

        {/* 底栏 */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/90 backdrop-blur">
          <div className="relative mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
            <button className="flex min-w-0 items-center gap-2" onClick={() => go('home')}>
              <Logo size={22} />
              <span className="hidden text-sm font-bold tracking-tight min-[420px]:inline">SimplePPT</span>
            </button>
            <Badge tone="outline" className="hidden xl:inline-flex">
              v0.1
            </Badge>
            {settings.mock && (
              <Badge tone="warn" className="hidden sm:inline-flex">
                演示模式
              </Badge>
            )}

            {/* 底栏中间：只放幽灵 AI 思维链（大屏文字流光，小屏三个闪烁点） */}
            <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center px-14 sm:px-24">
              <ThinkingChain />
            </div>

            <div className="ml-auto flex items-center gap-2">
              <span className="relative">
                <Button data-settings-trigger variant="secondary" className="px-3 sm:px-4" onClick={() => setMenuOpen((v) => !v)}>
                  <Settings2 className="h-4 w-4" />
                  <span>设置</span>
                </Button>
                {menuOpen && (
                  <div data-settings-menu className="absolute bottom-full right-0 z-50 mb-2 w-60 rounded-md border border-border bg-popover p-1.5 text-sm shadow-2xl">
                    <div className="px-2.5 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">项目</div>
                    <button
                      className="flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left hover:bg-muted"
                      onClick={() => {
                        exportProjectFile(project)
                        closeMenu()
                      }}
                    >
                      <Download className="h-4 w-4" />
                      导出项目备份
                    </button>
                    <button
                      className="flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left hover:bg-muted"
                      onClick={() => {
                        closeMenu()
                        importInputRef.current?.click()
                      }}
                    >
                      <Upload className="h-4 w-4" />
                      导入项目备份
                    </button>
                    <div className="px-2.5 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">外观</div>
                    {[
                      { v: 'auto', icon: Monitor, label: '自动（跟随系统）' },
                      { v: 'light', icon: Sun, label: '浅色' },
                      { v: 'dark', icon: Moon, label: '深色' },
                    ].map((o) => (
                      <button
                        key={o.v}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left',
                          theme === o.v ? 'bg-muted font-medium text-foreground' : 'hover:bg-muted',
                        )}
                        onClick={() => {
                          setTheme(o.v as ThemeMode)
                          closeMenu()
                        }}
                      >
                        <o.icon className="h-4 w-4" />
                        {o.label}
                      </button>
                    ))}
                    <button
                      className="flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left hover:bg-muted"
                      onClick={() => {
                        closeMenu()
                        openStyle()
                      }}
                    >
                      <Palette className="h-4 w-4" />
                      风格工坊
                    </button>
                    <button
                      className="flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left hover:bg-muted"
                      onClick={() => {
                        closeMenu()
                        openSettings('api')
                      }}
                    >
                      <Settings2 className="h-4 w-4" />
                      模型与搜索设置
                    </button>
                  </div>
                )}
              </span>
              <Button className="px-3 sm:px-4" onClick={() => setConfirmNew(true)}>
                <RotateCcw className="h-4 w-4" />
                <span className="sm:hidden">新建</span>
                <span className="hidden sm:inline">新建项目</span>
              </Button>
              <a
                href="https://github.com/YukiHimeno/simpleppt"
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub 仓库（新窗口打开）"
                title="GitHub 仓库"
                className="flex h-9 w-9 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Github className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} onSave={setSettings} tab={settingsTab} />

        <StyleEditor open={styleOpen} onClose={() => setStyleOpen(false)} />

        <Dialog open={confirmNew} onClose={() => setConfirmNew(false)} title="新建项目？">
          <p className="text-sm leading-relaxed text-muted-foreground">
            当前项目（含访谈、大纲、检索资料与已生成的幻灯片）将被清空，此操作不可撤销。
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmNew(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                clearProject()
                setProject(emptyProject())
                setConfirmNew(false)
              }}
            >
              清空并新建
            </Button>
          </div>
        </Dialog>
        <input ref={importInputRef} type="file" accept="application/json,.json" className="hidden" onChange={onImportFile} />

        <Dialog open={imported !== null} onClose={() => setImported(null)} title="导入项目备份？">
          <p className="text-sm leading-relaxed text-muted-foreground">
            将用备份「{imported?.topic}」覆盖当前项目（含访谈、大纲、检索资料与已生成的幻灯片），此操作不可撤销。
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setImported(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (imported) setProject(imported)
                setImported(null)
              }}
            >
              覆盖导入
            </Button>
          </div>
        </Dialog>

        <Dialog open={importError !== ''} onClose={() => setImportError('')} title="导入失败">
          <p className="text-sm leading-relaxed text-muted-foreground">{importError}</p>
          <div className="mt-4 flex justify-end">
            <Button variant="secondary" onClick={() => setImportError('')}>
              知道了
            </Button>
          </div>
        </Dialog>
      </ToastProvider>
    </AppCtx.Provider>
  )
}
