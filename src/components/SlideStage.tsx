import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Maximize2, Pencil, RotateCcw, StickyNote } from 'lucide-react'
import type { RunStatus, SlideStyle } from 'shared/types'
import { sanitizeSvg } from '../lib/exporter'
import { SlideEditor } from './SlideEditor'
import { Button, cn, Spinner, StatusDot } from './ui'

/** 渲染一页 SVG 幻灯片（先做轻量消毒） */
export function SlideSvg({ svg, className }: { svg: string; className?: string }) {
  const clean = useMemo(() => sanitizeSvg(svg), [svg])
  return <div className={cn('overflow-hidden [&>svg]:block [&>svg]:h-auto [&>svg]:w-full', className)} dangerouslySetInnerHTML={{ __html: clean }} />
}

export interface SlideItem {
  pageId: string
  title: string
  svg?: string
  status: RunStatus
  error?: string
  note?: string
}

const aspect = (ratio: '16:9' | '4:3') => (ratio === '4:3' ? '4 / 3' : '16 / 9')

export function SlideStage({
  slides,
  style,
  editing,
  onToggleEdit,
  onSaveEdit,
  onRegenerate,
  onExportPptx,
  onExportSvg,
  onExportNotes,
  exporting,
}: {
  slides: SlideItem[]
  style: SlideStyle
  editing: boolean
  onToggleEdit: (on: boolean) => void
  onSaveEdit: (pageId: string, svg: string) => void
  onRegenerate?: (pageId: string) => void
  onExportPptx?: () => void
  onExportSvg?: (index: number) => void
  onExportNotes?: () => void
  exporting?: boolean
}) {
  const [active, setActive] = useState(0)
  const [present, setPresent] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const idx = Math.min(active, slides.length - 1)
  const cur = slides[idx]
  const doneCount = slides.filter((s) => s.svg).length
  const ar = aspect(style.ratio)

  useEffect(() => {
    if (!present) return
    setElapsed(0)
    const t = setInterval(() => setElapsed((v) => v + 1), 1000)
    return () => clearInterval(t)
  }, [present])

  useEffect(() => {
    if (!present) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPresent(false)
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        setActive((a) => Math.min(a + 1, slides.length - 1))
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') setActive((a) => Math.max(a - 1, 0))
      if (e.key === 'Home') setActive(0)
      if (e.key === 'End') setActive(slides.length - 1)
      if (e.key === 'n' || e.key === 'N') setNotesOpen((v) => !v)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [present, slides.length])

  if (slides.length === 0) return null

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold">{cur?.title ?? ''}</span>
          <span className="text-xs text-muted-foreground">
            {idx + 1} / {slides.length} · 已生成 {doneCount} 页
          </span>
          <span className="hidden text-xs text-muted-foreground sm:inline">风格：{style.name}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {cur?.svg && (
            <Button variant={editing ? 'primary' : 'outline'} size="sm" onClick={() => onToggleEdit(!editing)}>
              <Pencil className="h-3.5 w-3.5" />
              {editing ? '退出编辑' : '编辑页面'}
            </Button>
          )}
          {!editing && cur?.status === 'error' && onRegenerate && (
            <Button variant="outline" size="sm" onClick={() => onRegenerate(cur.pageId)}>
              <RotateCcw className="h-3.5 w-3.5" />
              重试本页
            </Button>
          )}
          {!editing && cur?.svg && onRegenerate && (
            <Button variant="ghost" size="sm" onClick={() => onRegenerate(cur.pageId)} title="重新生成本页">
              <RotateCcw className="h-3.5 w-3.5" />
              重新生成本页
            </Button>
          )}
          {!editing && cur?.svg && onExportSvg && (
            <Button variant="ghost" size="sm" onClick={() => onExportSvg(idx)}>
              下载本页 SVG
            </Button>
          )}
          {!editing && onExportNotes && (
            <Button variant="ghost" size="sm" onClick={onExportNotes} title="把每页一句话信息与讲者备注导出为 Markdown 讲稿">
              导出讲稿
            </Button>
          )}
          {!editing && onExportPptx && (
            <Button size="sm" onClick={onExportPptx} disabled={doneCount === 0 || exporting}>
              {exporting ? <Spinner /> : null}
              导出 PPTX
            </Button>
          )}
          {!editing && (
            <Button variant="secondary" size="sm" onClick={() => setPresent(true)} disabled={!cur?.svg}>
              <Maximize2 className="h-3.5 w-3.5" />
              演示
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-4">
        {/* 缩略图栏 */}
        <div className="hidden w-44 shrink-0 space-y-2 overflow-y-auto pr-1 sm:block sm:max-h-[62vh]">
          {slides.map((s, i) => (
            <button
              key={s.pageId}
              onClick={() => {
                setActive(i)
                onToggleEdit(false)
              }}
              className={cn(
                'group relative block w-full border bg-card text-left transition-colors',
                i === idx ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-muted-foreground/50',
              )}
            >
              <div style={{ aspectRatio: ar }}>
                {s.svg ? (
                  <SlideSvg svg={s.svg} />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    {s.status === 'running' ? <Spinner /> : s.status === 'error' ? <span className="px-2 text-center text-[10px] text-destructive">生成失败</span> : <span className="text-[10px]">待生成</span>}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 border-t border-border px-2 py-1 text-[10px] text-muted-foreground">
                <StatusDot status={s.status} />
                <span className="truncate">
                  {i + 1}. {s.title}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* 主舞台 */}
        <div className="flex min-w-0 flex-1 flex-col items-center gap-3">
          {editing && cur?.svg ? (
            <SlideEditor
              key={cur.pageId}
              svg={cur.svg}
              style={style}
              ratio={style.ratio}
              onSave={(svg) => {
                onSaveEdit(cur.pageId, svg)
                onToggleEdit(false)
              }}
              onCancel={() => onToggleEdit(false)}
            />
          ) : (
            <>
              <div
                className="w-full border border-border bg-card shadow-xl"
                style={{ maxWidth: `min(100%, calc((100vh - 300px) * ${style.ratio === '4:3' ? '4 / 3' : '16 / 9'}))`, minWidth: 280 }}
              >
                {cur?.svg ? (
                  <SlideSvg svg={cur.svg} />
                ) : (
                  <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ aspectRatio: ar }}>
                    {cur?.status === 'running' ? (
                      <span className="flex items-center gap-2">
                        <Spinner /> 正在绘制第 {idx + 1} 页…
                      </span>
                    ) : cur?.status === 'error' ? (
                      <span className="max-w-md px-6 text-center text-destructive">{cur.error}</span>
                    ) : (
                      '排队中…'
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" onClick={() => setActive(Math.max(0, idx - 1))} disabled={idx === 0} aria-label="上一页">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  {idx + 1} / {slides.length}
                </span>
                <Button variant="outline" size="icon" onClick={() => setActive(Math.min(slides.length - 1, idx + 1))} disabled={idx === slides.length - 1} aria-label="下一页">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              {cur?.note && <p className="max-w-xl text-center text-xs text-muted-foreground">讲者备注：{cur.note}</p>}
            </>
          )}
        </div>
      </div>

      {/* 演示模式（演示者视图：N 呼出讲者备注，右上角计时） */}
      {present &&
        cur?.svg &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center overflow-y-auto bg-black p-4" onClick={() => setPresent(false)}>
            <div className="w-full" style={{ maxWidth: `min(100%, calc((100vh - 110px) * ${style.ratio === '4:3' ? '4 / 3' : '16 / 9'}))` }} onClick={(e) => e.stopPropagation()}>
              <SlideSvg svg={cur.svg} className="shadow-2xl ring-1 ring-white/10" />
              <div className="mt-3 flex items-center justify-between text-xs text-white/50">
                <span>
                  {idx + 1} / {slides.length} · {cur.title}
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-mono text-white/70" title="演讲计时">
                    {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
                  </span>
                  <span className="hidden sm:inline">空格 / ← → 翻页 · N 备注 · Esc 退出</span>
                </span>
              </div>
              <div className="mt-2 flex justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setActive(Math.max(0, idx - 1))}
                  disabled={idx === 0}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={notesOpen ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setNotesOpen((v) => !v)}
                  title="讲者备注（N）"
                >
                  <StickyNote className="h-3.5 w-3.5" />
                  讲者备注
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setActive(Math.min(slides.length - 1, idx + 1))}
                  disabled={idx === slides.length - 1}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
              {notesOpen && (
                <div className="mt-3 max-h-40 overflow-y-auto rounded-md bg-white/5 p-3 text-sm leading-relaxed text-white/80 ring-1 ring-white/10">
                  {cur.note || '本页没有讲者备注。'}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
