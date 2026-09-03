// 阶段 3：逐页资料检索。把每个页面主题交给带 web_search 的模型搜集整理，
// 数字带出处；接口不支持联网时降级为模型知识并显著提示（原则 3）。
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { api, pMap } from '../lib/api'
import { useApp } from '../lib/app-context'
import { delay, mockResearchMap } from '../lib/mock-data'
import { Badge, Button, Card, cn, Spinner, StatusDot, useToast } from '../components/ui'
import { StageHeader } from '../components/StageHeader'
import type { PageResearch, StickyPage } from 'shared/types'

const CONF_COLOR: Record<string, string> = {
  high: 'bg-green-500',
  medium: 'bg-amber-500',
  low: 'bg-muted-foreground/50',
}

export function StageResearch() {
  const { project, patch, settings, go } = useApp()
  const { notify } = useToast()
  const startedRef = useRef(false)
  const runningRef = useRef(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const outline = project.outline
  const pages = outline?.pages ?? []

  async function runPages(list: StickyPage[]) {
    if (runningRef.current || list.length === 0) return
    runningRef.current = true
    const total = pages.length
    const core = outline?.coreMessage ?? ''
    await pMap(
      list,
      async (page) => {
        const index = pages.indexOf(page) + 1
        patch((p) => ({
          ...p,
          research: { ...p.research, [page.id]: { pageId: page.id, facts: [], quote: null, status: 'running' } },
        }))
        try {
          let research: PageResearch
          if (settings.mock) {
            await delay(700 + Math.random() * 600)
            research = mockResearchMap()[page.id] ?? { pageId: page.id, facts: [], quote: null, status: 'done' }
          } else {
            const r = await api.researchPage(settings, page, index, total, core, project.referenceFiles)
            research = { ...r.research, status: 'done' as const, sources: r.searchSources }
          }
          patch((p) => ({ ...p, research: { ...p.research, [page.id]: research } }))
        } catch (e: any) {
          patch((p) => ({
            ...p,
            research: { ...p.research, [page.id]: { pageId: page.id, facts: [], quote: null, status: 'error', error: e?.message ?? String(e) } },
          }))
        }
      },
      2,
    )
    runningRef.current = false
  }

  useEffect(() => {
    if (startedRef.current || !outline) return
    startedRef.current = true
    const todo = pages.filter((pg) => {
      const r = project.research[pg.id]
      return !r || r.status === 'pending'
    })
    runPages(todo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!outline) return null

  const doneCount = pages.filter((pg) => project.research[pg.id]?.status === 'done').length
  const allSettled = pages.every((pg) => ['done', 'error'].includes(project.research[pg.id]?.status ?? 'pending'))

  const toggle = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return (
    <div className="animate-fade-up space-y-6">
      <StageHeader
        step="3"
        title="资料检索"
        desc="大纲只是骨架。带着每一页的主题去检索真实资料——事实、数据、案例与引言，逐条标注来源与可信度。"
      >
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge tone="primary">
            {doneCount} / {pages.length} 页完成
          </Badge>
          {project.searchDegraded && <Badge tone="warn">{project.searchDegraded}</Badge>}
        </div>
      </StageHeader>

      <div className="space-y-2">
        {pages.map((pg, i) => {
          const r = project.research[pg.id]
          const status = r?.status ?? 'pending'
          const open = expanded.has(pg.id)
          return (
            <Card key={pg.id} className="overflow-hidden">
              <button className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50" onClick={() => toggle(pg.id)}>
                <StatusDot status={status} />
                <span className="text-xs text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{pg.title}</span>
                <span className="hidden max-w-[40%] truncate text-xs text-muted-foreground md:block">{pg.takeaway}</span>
                {status === 'running' && <Spinner className="h-3.5 w-3.5" />}
                {status === 'error' && <span className="text-xs text-destructive">失败</span>}
                {status === 'done' && <span className="text-xs text-muted-foreground">{r.facts.length} 条资料</span>}
                {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </button>
              {open && (
                <div className="space-y-3 border-t border-border px-4 py-3">
                  {r?.summary && <p className="text-sm text-muted-foreground">{r.summary}</p>}
                  {status === 'error' && <p className="text-sm text-destructive">{r?.error}</p>}
                  {r?.facts.map((f, j) => (
                    <div key={j} className="flex gap-2 text-sm leading-relaxed">
                      <span className={cn('mt-2 h-1.5 w-1.5 shrink-0 rounded-full', CONF_COLOR[f.confidence ?? 'medium'])} title={`可信度：${f.confidence ?? 'medium'}`} />
                      <span>
                        {f.text}
                        {f.source && (
                          <a href={f.source} target="_blank" rel="noreferrer" className="ml-1 text-primary hover:underline">
                            [来源]
                          </a>
                        )}
                      </span>
                    </div>
                  ))}
                  {r?.quote && (
                    <blockquote className="border-l-2 border-primary pl-3 text-sm text-muted-foreground">
                      「{r.quote.text}」{r.quote.author && <span className="text-xs">—— {r.quote.author}</span>}
                    </blockquote>
                  )}
                  {(!r || (r.facts.length === 0 && status === 'done')) && <p className="text-xs text-muted-foreground">本页无需检索资料。</p>}
                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={status === 'running' || runningRef.current}
                      onClick={() => {
                        patch((p) => ({ ...p, research: { ...p.research, [pg.id]: { pageId: pg.id, facts: [], quote: null, status: 'pending' } } }))
                        runPages([pg])
                      }}
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> 重新检索本页
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      <div className="flex flex-wrap justify-between gap-2 pt-2">
        <Button
          variant="outline"
          disabled={runningRef.current}
          onClick={() => {
            const todo = pages.filter((pg) => ['done', 'error'].includes(project.research[pg.id]?.status ?? 'pending'))
            runPages(todo)
          }}
        >
          <RefreshCw className="h-4 w-4" /> 全部重新检索
        </Button>
        <Button size="lg" onClick={() => go('plan')} disabled={!allSettled}>
          生成页面策划稿
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
