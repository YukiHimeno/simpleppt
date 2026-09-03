// 阶段 5+6：Bento Grid / 朴素干货 视觉化 + 整页 SVG 生成。
// AI 按策划稿与风格令牌直接画出完整 SVG（无模板），服务端做 XML 校验、
// 纠错重试与数学公式渲染；这里负责编排、查看、直接编辑与导出。
import { useEffect, useRef, useState } from 'react'
import { api, pMap } from '../lib/api'
import { useApp } from '../lib/app-context'
import { delay, mockPlans, mockResearchMap, renderMockSlide } from '../lib/mock-data'
import { downloadBlob, downloadText } from '../lib/exporter'
import { buildSpeechMarkdown, speechFileName } from '../lib/notes-export'
import { resolveSlideImages } from '../lib/question-image'
import { exportNativePptx } from '../lib/exporter-editable'
import { SlideStage, type SlideItem } from '../components/SlideStage'
import { StageHeader } from '../components/StageHeader'
import { Badge, Button, Dialog, Field, Spinner, Textarea, useToast } from '../components/ui'
import type { PagePlan, StickyPage } from 'shared/types'

export function StageSlides() {
  const { project, patch, settings } = useApp()
  const { notify } = useToast()
  const startedRef = useRef(false)
  const runningRef = useRef(false)
  const [exporting, setExporting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [regenId, setRegenId] = useState<string | null>(null)
  const [advice, setAdvice] = useState('')

  const outline = project.outline
  const pages = outline?.pages ?? []
  const planOf = (id: string): PagePlan | undefined => project.plan.find((x) => x.pageId === id)

  async function runSlides(list: StickyPage[], adviceText?: string) {
    if (runningRef.current || list.length === 0) return
    runningRef.current = true
    const total = pages.length
    const core = outline?.coreMessage ?? ''
    await pMap(
      list,
      async (page) => {
        const plan = planOf(page.id)
        if (!plan) return
        const index = plan.index
        patch((p) => ({ ...p, slides: { ...p.slides, [page.id]: { status: 'running' } } }))
        try {
          let svg: string
          if (settings.mock) {
            await delay(500 + Math.random() * 400)
            svg = renderMockSlide(plan, settings.style, project.research[page.id]?.quote?.author)
          } else {
            const research = project.research[page.id]
            const r = await api.slidePage(settings, {
              topic: project.topic,
              plan,
              total,
              coreMessage: core,
              prevTitle: pages[index - 2]?.title,
              nextTitle: pages[index]?.title,
              style: settings.style,
              research: { facts: research?.facts ?? [], quote: research?.quote ?? null },
              advice: adviceText?.trim() || undefined,
            })
            svg = r.svg
          }
          if (!svg) throw new Error('生成内容为空')
          patch((p) => ({ ...p, slides: { ...p.slides, [page.id]: { status: 'done', svg } } }))
        } catch (e: any) {
          patch((p) => ({ ...p, slides: { ...p.slides, [page.id]: { status: 'error', error: e?.message ?? String(e) } } }))
        }
      },
      2,
    )
    runningRef.current = false
  }

  function confirmRegen() {
    if (!regenId) return
    const pg = pages.find((x) => x.id === regenId)
    if (pg) runSlides([pg], advice.trim() || undefined)
    setRegenId(null)
    setAdvice('')
  }

  useEffect(() => {
    if (startedRef.current || !outline) return
    startedRef.current = true
    const todo = pages.filter((pg) => {
      const s = project.slides[pg.id]
      return planOf(pg.id) && (!s || s.status === 'pending')
    })
    runSlides(todo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!outline) return null

  const items: SlideItem[] = pages.map((pg) => {
    const plan = planOf(pg.id)
    const s = project.slides[pg.id]
    return {
      pageId: pg.id,
      title: plan?.title ?? pg.title,
      svg: s?.svg ? resolveSlideImages(s.svg) : undefined,
      status: s?.status ?? 'pending',
      error: s?.error,
      note: plan?.speakerNote,
    }
  })
  const doneCount = items.filter((x) => x.svg).length

  async function doExportPptx() {
    const ready = items.filter((x) => x.svg)
    if (ready.length === 0) return
    setExporting(true)
    try {
      const blob = await exportNativePptx(
        ready.map((x) => ({ svg: x.svg!, note: x.note })),
        project.topic || 'SimplePPT',
        settings.style.ratio,
        settings.style,
      )
      const name = `${(project.topic || 'SimplePPT').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60)}.pptx`
      downloadBlob(blob, name)
      notify(`已导出 ${ready.length} 页可编辑 PPTX（${settings.style.ratio}）`, 'success')
    } catch (e: any) {
      notify(`导出失败：${e?.message ?? e}`, 'error')
    } finally {
      setExporting(false)
    }
  }

  function doExportSvg(idx: number) {
    const it = items[idx]
    if (!it?.svg) return
    downloadText(it.svg, `${project.topic || 'SimplePPT'}-${String(idx + 1).padStart(2, '0')}.svg`)
  }

  function doExportNotes() {
    downloadText(buildSpeechMarkdown(project), speechFileName(project.topic), 'text/markdown')
    notify(`讲稿已导出（${items.length} 页 Markdown）`, 'success')
  }

  return (
    <div className="animate-fade-up space-y-6">
      <StageHeader
        step="5"
        title="生成幻灯片"
        desc={`按「${settings.style.name}」风格的画布与配色令牌直接画出整页 SVG。生成后可以直接编辑页面上的文字与重点、单页重画、全屏演示、导出 PPTX。`}
      >
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge tone="primary">
            已生成 {doneCount} / {items.length} 页
          </Badge>
          <Badge tone="outline">
            {settings.style.name} · {settings.style.ratio}
          </Badge>
        </div>
      </StageHeader>

      <SlideStage
        slides={items}
        style={settings.style}
        editing={editing}
        onToggleEdit={setEditing}
        onSaveEdit={(pageId, svg) => {
          patch((p) => ({ ...p, slides: { ...p.slides, [pageId]: { status: 'done', svg } } }))
          notify('页面修改已保存', 'success')
        }}
        onRegenerate={(pageId) => {
          setEditing(false)
          setAdvice('')
          setRegenId(pageId)
        }}
        onExportPptx={doExportPptx}
        onExportSvg={doExportSvg}
        onExportNotes={doExportNotes}
        exporting={exporting}
      />

      <Dialog open={regenId !== null} onClose={() => setRegenId(null)} title="重新生成这一页">
        <div className="space-y-3">
          <Field label="修改建议" hint="例如：数字再突出一点；换个说法更口语；标题再短点；把要点精简成三条…（可留空，直接重新生成）">
            <Textarea value={advice} onChange={(e) => setAdvice(e.target.value)} className="min-h-[96px]" placeholder="这一页想怎么改？" />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setRegenId(null)}>
              取消
            </Button>
            <Button onClick={confirmRegen} disabled={runningRef.current}>
              {runningRef.current && <Spinner />}
              重新生成
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
