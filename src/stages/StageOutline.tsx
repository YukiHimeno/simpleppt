// 阶段 2：便利贴大纲。每页一张数字便利贴，金字塔原理组织：
// 结论先行、以上统下、归类分组、逻辑递进。
// 支持整体修改建议让 AI 重新生成，也支持单页按建议让 AI 重写。
import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUp, Pencil, Plus, RefreshCw, Sparkles, Trash2, Wand2 } from 'lucide-react'
import { api } from '../lib/api'
import { useApp } from '../lib/app-context'
import { delay, mockOutline, mockOutlineRegen, mockRewritePage } from '../lib/mock-data'
import { Badge, Button, Card, Dialog, Field, Input, Select, Spinner, Textarea, useToast } from '../components/ui'
import { StageHeader } from '../components/StageHeader'
import type { PageType, StickyPage } from 'shared/types'

const PAGE_TYPE_LABEL: Record<PageType, string> = {
  cover: '封面',
  agenda: '目录',
  content: '论述',
  data: '数据',
  quote: '金句',
  ending: '结尾',
}

export function StageOutline() {
  const { project, patch, settings, go } = useApp()
  const { notify } = useToast()
  const startedRef = useRef(false)
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [form, setForm] = useState({ title: '', takeaway: '', group: '', pageType: 'content' as PageType, keyPoints: '' })
  const [feedback, setFeedback] = useState('')
  const [regenBusy, setRegenBusy] = useState(false)
  const [rewriting, setRewriting] = useState<number | null>(null)
  const [advice, setAdvice] = useState('')
  const [rewriteBusy, setRewriteBusy] = useState(false)

  const outline = project.outline
  const pages = outline?.pages ?? []

  async function run(feedback?: string) {
    setRegenBusy(true)
    patch((p) => ({ ...p, outlineStatus: 'running' }))
    try {
      let o
      if (settings.mock) {
        await delay(1100)
        o = feedback ? mockOutlineRegen(feedback) : mockOutline
      } else {
        const r = await api.outline(settings, {
          topic: project.topic,
          summary: project.interview.summary ?? null,
          background: project.background,
          references: project.referenceFiles,
          pageCount: 10,
          feedback,
        })
        o = r.outline
      }
      if (!o.pages || o.pages.length === 0) throw new Error('模型没有返回大纲，请重试')
      patch((p) => ({ ...p, outline: o, outlineStatus: 'done' }))
      if (feedback) {
        setFeedback('')
        // 大纲变了，旧的检索/策划/幻灯片不再对应新结构
        patch((p) => ({ ...p, research: {}, plan: [], planStatus: {}, slides: {} }))
        notify('大纲已按建议重新生成，后续阶段需要重新执行', 'success')
      }
    } catch (e: any) {
      patch((p) => ({ ...p, outlineStatus: 'error' }))
      notify(e?.message ?? String(e), 'error')
    } finally {
      setRegenBusy(false)
    }
  }

  async function doRewrite(index: number) {
    if (!outline || !advice.trim()) return
    setRewriteBusy(true)
    try {
      let pg: StickyPage
      if (settings.mock) {
        await delay(800)
        pg = mockRewritePage(pages[index], advice)
      } else {
        const r = await api.rewritePage(settings, {
          page: pages[index],
          index: index + 1,
          total: pages.length,
          coreMessage: outline.coreMessage,
          summary: project.interview.summary ?? null,
          advice,
        })
        pg = { ...r.page, id: pages[index].id }
      }
      patch((p) => {
        const next = [...(p.outline?.pages ?? [])]
        next[index] = pg
        return { ...p, outline: p.outline ? { ...p.outline, pages: next } : p.outline }
      })
      setRewriting(null)
      setAdvice('')
      notify('本页已按建议重写', 'success')
    } catch (e: any) {
      notify(e?.message ?? String(e), 'error')
    } finally {
      setRewriteBusy(false)
    }
  }

  useEffect(() => {
    if (startedRef.current || project.outline) return
    startedRef.current = true
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const update = (i: number, part: Partial<StickyPage>) =>
    patch((p) => {
      const next = [...(p.outline?.pages ?? [])]
      next[i] = { ...next[i], ...part }
      return { ...p, outline: { ...(p.outline ?? { coreMessage: '', pages: [] }), pages: next } }
    })

  const move = (i: number, dir: -1 | 1) =>
    patch((p) => {
      const next = [...(p.outline?.pages ?? [])]
      const j = i + dir
      if (j < 0 || j >= next.length) return p
      ;[next[i], next[j]] = [next[j], next[i]]
      return { ...p, outline: { ...(p.outline ?? { coreMessage: '', pages: [] }), pages: next } }
    })

  const remove = (i: number) =>
    patch((p) => {
      const next = (p.outline?.pages ?? []).filter((_, k) => k !== i)
      return { ...p, outline: { ...(p.outline ?? { coreMessage: '', pages: [] }), pages: next } }
    })

  function openEdit(i: number | 'new') {
    if (i === 'new') {
      setForm({ title: '', takeaway: '', group: pages.at(-1)?.group ?? '', pageType: 'content', keyPoints: '' })
    } else {
      const pg = pages[i]
      setForm({ title: pg.title, takeaway: pg.takeaway, group: pg.group, pageType: pg.pageType, keyPoints: pg.keyPoints.join('\n') })
    }
    setEditing(i)
  }

  function saveEdit() {
    if (!form.title.trim()) {
      notify('标题不能为空', 'error')
      return
    }
    const kp = form.keyPoints.split('\n').map((s) => s.trim()).filter(Boolean)
    if (editing === 'new') {
      const pg: StickyPage = {
        id: `pn${Date.now().toString(36)}`,
        title: form.title.trim(),
        takeaway: form.takeaway.trim() || form.title.trim(),
        group: form.group.trim(),
        role: form.pageType === 'cover' ? 'cover' : form.pageType === 'ending' ? 'ending' : form.pageType === 'agenda' ? 'agenda' : 'support',
        pageType: form.pageType,
        keyPoints: kp,
      }
      patch((p) => ({ ...p, outline: { ...(p.outline ?? { coreMessage: '', pages: [] }), pages: [...(p.outline?.pages ?? []), pg] } }))
    } else if (typeof editing === 'number') {
      update(editing, { title: form.title.trim(), takeaway: form.takeaway.trim(), group: form.group.trim(), pageType: form.pageType, keyPoints: kp })
    }
    setEditing(null)
  }

  return (
    <div className="animate-fade-up space-y-6">
      <StageHeader
        step="2"
        title="便利贴大纲"
        desc="每一页就是一张便利贴。按金字塔原理排布：结论先行、以上统下、归类分组、逻辑递进。可以对整份大纲提修改建议重新生成，也可以单页重写。"
      />

      {!outline && project.outlineStatus === 'running' && (
        <Card className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <Spinner /> 正在贴便利贴…
        </Card>
      )}
      {!outline && project.outlineStatus === 'error' && (
        <Card className="flex items-center justify-center gap-3 p-10 text-sm text-muted-foreground">
          生成失败
          <Button variant="outline" size="sm" onClick={() => run()}>
            <RefreshCw className="h-3.5 w-3.5" /> 重试
          </Button>
        </Card>
      )}

      {outline && (
        <>
          <Card className="border-l-2 border-l-primary p-4">
            <div className="mb-1 text-xs font-medium text-primary">塔尖结论（金字塔顶）</div>
            <Input
              value={outline.coreMessage}
              onChange={(e) => patch((p) => ({ ...p, outline: p.outline ? { ...p.outline, coreMessage: e.target.value } : p.outline }))}
              className="border-0 bg-transparent px-0 text-base font-medium focus-visible:outline-0"
              placeholder="整份 PPT 的一句话结论"
            />
          </Card>

          {/* 整体修改建议 */}
          <Card className="space-y-2 p-4">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Wand2 className="h-4 w-4 text-primary" />
              整体修改建议
            </div>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="例如：面向技术团队调整口吻；去掉竞品对比；在「怎么落地」后面加一页组织保障；整体压缩到 10 页…"
              className="min-h-[64px]"
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">重新生成会替换整份大纲；已完成的检索、策划与幻灯片需要重新执行。</p>
              <Button
                variant="secondary"
                disabled={regenBusy || !feedback.trim()}
                onClick={() => run(feedback.trim())}
              >
                {regenBusy ? <Spinner /> : <Sparkles className="h-4 w-4" />}
                按建议重新生成
              </Button>
            </div>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pages.map((pg, i) => (
              <div
                key={pg.id}
                className={`group relative border border-amber-300/70 bg-amber-100/90 p-4 shadow-sm transition-transform hover:rotate-0 dark:border-amber-200/20 dark:bg-amber-200/10 ${
                  i % 2 === 0 ? 'rotate-[0.6deg]' : '-rotate-[0.5deg]'
                }`}
              >
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <Badge tone="default" className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    {String(i + 1).padStart(2, '0')} · {PAGE_TYPE_LABEL[pg.pageType]}
                  </Badge>
                  {pg.group && <Badge tone="outline">{pg.group}</Badge>}
                </div>
                <div className="text-[15px] font-semibold leading-snug">{pg.title}</div>
                <p className="mt-1.5 text-xs leading-relaxed text-amber-900/80 dark:text-amber-100/70">{pg.takeaway}</p>
                {pg.keyPoints.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-amber-900/60 dark:text-amber-100/50">
                    {pg.keyPoints.slice(0, 3).map((k, j) => (
                      <li key={j}>· {k}</li>
                    ))}
                  </ul>
                )}
                <div className="absolute right-1.5 top-1.5 flex gap-0.5">
                  <button className="p-1 hover:bg-amber-500/15" onClick={() => move(i, -1)} disabled={i === 0} title="前移">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button className="p-1 hover:bg-amber-500/15" onClick={() => move(i, 1)} disabled={i === pages.length - 1} title="后移">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button className="p-1 hover:bg-amber-500/15" onClick={() => openEdit(i)} title="手动编辑">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="p-1 text-primary hover:bg-amber-500/15"
                    onClick={() => {
                      setAdvice('')
                      setRewriting(i)
                    }}
                    title="按建议重写本页"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                  </button>
                  <button className="p-1 hover:bg-destructive/15 hover:text-destructive" onClick={() => remove(i)} title="删除">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={() => openEdit('new')}
              className="flex min-h-32 items-center justify-center border border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              <span className="flex items-center gap-1.5">
                <Plus className="h-4 w-4" /> 添加便利贴
              </span>
            </button>
          </div>

          <div className="flex flex-wrap justify-between gap-2 pt-2">
            <Button variant="outline" onClick={() => run()} disabled={regenBusy}>
              <RefreshCw className="h-4 w-4" /> 重新生成大纲
            </Button>
            <Button size="lg" onClick={() => go('research')} disabled={pages.length < 2}>
              进入资料检索
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}

      {/* 手动编辑对话框 */}
      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? '添加便利贴' : '编辑便利贴'}>
        <div className="space-y-3">
          <Field label="页标题">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="≤14 字" />
          </Field>
          <Field label="本页结论（判断句）">
            <Input value={form.takeaway} onChange={(e) => setForm({ ...form, takeaway: e.target.value })} placeholder="一个完整的句子，不是名词短语" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="章节">
              <Input value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} placeholder="留空表示不分组" />
            </Field>
            <Field label="页面类型">
              <Select value={form.pageType} onChange={(e) => setForm({ ...form, pageType: e.target.value as PageType })}>
                {(Object.keys(PAGE_TYPE_LABEL) as PageType[]).map((t) => (
                  <option key={t} value={t}>
                    {PAGE_TYPE_LABEL[t]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="要点（每行一条）">
            <Textarea value={form.keyPoints} onChange={(e) => setForm({ ...form, keyPoints: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setEditing(null)}>
              取消
            </Button>
            <Button onClick={saveEdit}>保存</Button>
          </div>
        </div>
      </Dialog>

      {/* AI 单页重写对话框 */}
      <Dialog open={rewriting !== null} onClose={() => setRewriting(null)} title={`重写：${rewriting !== null ? pages[rewriting]?.title ?? '' : ''}`}>
        <div className="space-y-3">
          {rewriting !== null && (
            <div className="border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
              <div className="font-medium text-foreground">当前这一页</div>
              <div className="mt-1">{pages[rewriting]?.takeaway}</div>
              {pages[rewriting]?.keyPoints.length > 0 && <div className="mt-1">要点：{pages[rewriting].keyPoints.join('；')}</div>}
            </div>
          )}
          <Field label="对这一页的修改建议" hint="会保持该页在整份大纲中的位置与章节归属，只按建议重写本页。">
            <Textarea value={advice} onChange={(e) => setAdvice(e.target.value)} placeholder="例如：改成用数据说话；突出成本结论；合并前两点；换成对管理层更有冲击力的说法…" />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setRewriting(null)}>
              取消
            </Button>
            <Button onClick={() => rewriting !== null && doRewrite(rewriting)} disabled={rewriteBusy || !advice.trim()}>
              {rewriteBusy ? <Spinner /> : <Sparkles className="h-4 w-4" />}
              重写本页
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
