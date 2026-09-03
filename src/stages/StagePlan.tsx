// 阶段 4：页面策划稿（中间层）。AI 拿到资料后不直接做漂亮 PPT，
// 而是先产出每页的策划稿：放什么内容、内容什么关系、用什么版式（12×4 便当网格）。
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, RefreshCw, Star } from 'lucide-react'
import { api, pMap } from '../lib/api'
import { useApp } from '../lib/app-context'
import { delay, mockPlans } from '../lib/mock-data'
import { enrichPlan } from 'shared/bento'
import { Badge, Button, Card, Dialog, Field, Spinner, StatusDot, Textarea, useToast } from '../components/ui'
import { StageHeader } from '../components/StageHeader'
import { BentoPreview } from '../components/BentoPreview'
import type { PagePlan, StickyPage } from 'shared/types'

const KIND_LABEL: Record<string, string> = {
  stat: '数字',
  text: '文本',
  bullets: '要点',
  compare: '对比',
  timeline: '时间线',
  table: '表格',
  'chart-bar': '柱状图',
  'chart-line': '折线图',
  'chart-donut': '环形图',
  highlight: '金句',
}

const TYPE_LABEL: Record<string, string> = { cover: '封面', agenda: '目录', content: '论述', data: '数据', quote: '金句', ending: '结尾' }

export function StagePlan() {
  const { project, patch, settings, go } = useApp()
  const { notify } = useToast()
  const startedRef = useRef(false)
  const runningRef = useRef(false)
  const [regen, setRegen] = useState<{ mode: 'page' | 'all'; pageId?: string } | null>(null)
  const [advice, setAdvice] = useState('')
  const outline = project.outline
  const pages = outline?.pages ?? []

  async function runPages(list: StickyPage[], adviceText?: string) {
    if (runningRef.current || list.length === 0) return
    runningRef.current = true
    const total = pages.length
    const core = outline?.coreMessage ?? ''
    await pMap(
      list,
      async (page) => {
        const index = pages.indexOf(page) + 1
        patch((p) => ({ ...p, planStatus: { ...p.planStatus, [page.id]: 'running' } }))
        try {
          let plan: PagePlan
          if (settings.mock) {
            await delay(500 + Math.random() * 400)
            plan = mockPlans().find((x) => x.pageId === page.id) ?? {
              pageId: page.id, index, title: page.title, kicker: page.group, message: page.takeaway,
              pageType: page.pageType, cards: [],
            }
          } else {
            const research = project.research[page.id]
            const r = await api.planPage(settings, {
              page,
              index,
              total,
              coreMessage: core,
              research: {
                facts: research?.facts ?? [],
                quote: research?.quote ?? null,
              },
              references: project.referenceFiles,
              advice: adviceText?.trim() || undefined,
            })
            plan = enrichPlan(r.plan, settings.style.ratio)
          }
          patch((p) => {
            const rest = p.plan.filter((x) => x.pageId !== page.id)
            return {
              ...p,
              plan: [...rest, plan].sort((a, b) => a.index - b.index),
              planStatus: { ...p.planStatus, [page.id]: 'done' },
            }
          })
        } catch (e: any) {
          patch((p) => ({ ...p, planStatus: { ...p.planStatus, [page.id]: 'error' } }))
          notify(`第 ${index} 页策划失败：${e?.message ?? e}`, 'error')
        }
      },
      2,
    )
    runningRef.current = false
  }

  function confirmRegen() {
    if (!regen) return
    const a = advice.trim() || undefined
    if (regen.mode === 'all') {
      patch((p) => ({ ...p, plan: [], planStatus: {} }))
      runPages(pages, a)
    } else {
      const pg = pages.find((x) => x.id === regen.pageId)
      if (pg) runPages([pg], a)
    }
    setRegen(null)
    setAdvice('')
  }

  useEffect(() => {
    if (startedRef.current || !outline) return
    startedRef.current = true
    const todo = pages.filter((pg) => !project.plan.some((pl) => pl.pageId === pg.id))
    runPages(todo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!outline) return null

  const allDone = pages.every((pg) => project.plan.some((pl) => pl.pageId === pg.id))
  const doneCount = pages.filter((pg) => project.plan.some((pl) => pl.pageId === pg.id)).length

  return (
    <div className="animate-fade-up space-y-6">
      <StageHeader
        step="4"
        title="页面策划稿"
        desc="不急着把资料直接做成漂亮 PPT。先确认这份策划稿：每页放什么、内容之间什么关系、用 12×4 便当网格的哪种版式。确认无误再进入视觉设计。"
      >
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge tone="primary">
            {doneCount} / {pages.length} 页完成
          </Badge>
        </div>
      </StageHeader>

      <div className="space-y-4">
        {pages.map((pg) => {
          const plan = project.plan.find((x) => x.pageId === pg.id)
          const status = project.planStatus[pg.id] ?? (plan ? 'done' : 'pending')
          return (
            <Card key={pg.id} className="p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <StatusDot status={status} />
                <span className="text-xs text-muted-foreground">第 {pages.indexOf(pg) + 1} 页</span>
                <Badge tone="outline">{TYPE_LABEL[pg.pageType] ?? pg.pageType}</Badge>
                {plan?.kicker && <Badge tone="default">{plan.kicker}</Badge>}
                <span className="font-semibold">{plan?.title ?? pg.title}</span>
                {status === 'running' && <Spinner className="h-3.5 w-3.5" />}
                <span className="ml-auto text-xs text-muted-foreground">{pg.takeaway}</span>
              </div>

              {status === 'pending' && <p className="text-sm text-muted-foreground">排队中…</p>}
              {status === 'error' && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  策划失败
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAdvice('')
                      setRegen({ mode: 'page', pageId: pg.id })
                    }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> 重试
                  </Button>
                </div>
              )}

              {plan && (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
                  <div className="space-y-3">
                    <p className="border-l-2 border-primary pl-2.5 text-sm leading-relaxed">{plan.message || pg.takeaway}</p>
                    <BentoPreview plan={plan} ratio={settings.style.ratio} />
                  </div>
                  <div className="space-y-2">
                    {plan.cards.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        {plan.pageType === 'cover' ? '封面：整页大字构图' : plan.pageType === 'quote' ? '金句：整页居中构图' : '结尾：整页居中构图'}
                      </p>
                    )}
                    {plan.cards.map((c, i) => (
                      <div key={i} className="border border-border p-2.5 text-xs leading-relaxed">
                        <div className="mb-1 flex flex-wrap items-center gap-1.5">
                          <Badge tone={c.accent ? 'primary' : 'default'}>{KIND_LABEL[c.kind] ?? c.kind}</Badge>
                          <span className="text-muted-foreground">
                            {c.col}列+{c.colSpan} · {c.row}行+{c.rowSpan}
                          </span>
                          {c.accent && <Star className="h-3 w-3 fill-primary text-primary" />}
                          {c.title && <span className="font-medium">{c.title}</span>}
                        </div>
                        <div className="text-muted-foreground">
                          {Array.isArray(c.content) ? c.content.join('；') : c.content}
                          {c.data && c.data.length > 0 && (
                            <span className="text-primary"> 〔数据：{c.data.map((d) => `${d.label} ${d.value}`).join('，')}〕</span>
                          )}
                        </div>
                      </div>
                    ))}
                    {plan.speakerNote && <p className="text-xs italic text-muted-foreground">讲者备注：{plan.speakerNote}</p>}
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={status === 'running' || runningRef.current}
                        onClick={() => {
                          setAdvice('')
                          setRegen({ mode: 'page', pageId: pg.id })
                        }}
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> 重新策划本页
                      </Button>
                    </div>
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
            setAdvice('')
            setRegen({ mode: 'all' })
          }}
        >
          <RefreshCw className="h-4 w-4" /> 重新策划全部
        </Button>
        <Button size="lg" onClick={() => go('slides')} disabled={!allDone}>
          生成幻灯片
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={regen !== null} onClose={() => setRegen(null)} title={regen?.mode === 'all' ? '重新策划全部' : '重新策划本页'}>
        <div className="space-y-3">
          <Field label="修改建议" hint="例如：把结论放上面；这一页改用对比；数字太少，加点数据；删掉竞品对比…（可留空，直接重新策划）">
            <Textarea value={advice} onChange={(e) => setAdvice(e.target.value)} className="min-h-[96px]" placeholder="对这一页 / 全部页面想怎么改？" />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setRegen(null)}>
              取消
            </Button>
            <Button onClick={confirmRegen} disabled={runningRef.current}>
              {runningRef.current && <Spinner />}
              重新策划
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
