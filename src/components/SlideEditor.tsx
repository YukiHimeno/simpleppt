// In-browser editor for AI-generated slides.
// Slides are plain SVG (shapes + text): each <text> becomes selectable,
// draggable, editable (text/size/color/bold/highlight/delete), then the
// result feeds straight into the export pipeline on save.
// The edited SVG source is the single source of truth, so no x2t round trip
// is needed for WYSIWYG editing.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Bold, Check, Highlighter, Minus, Plus, Redo2, Trash2, Undo2, X } from 'lucide-react'
import { sanitizeSvg } from '../lib/exporter'
import { Button, cn } from './ui'
import type { SlideStyle } from 'shared/types'

interface Props {
  svg: string
  style: SlideStyle
  ratio: '16:9' | '4:3'
  onSave: (svg: string) => void
  onCancel: () => void
}

export function SlideEditor({ svg, style, ratio, onSave, onCancel }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [selected, setSelected] = useState<SVGTextElement | null>(null)
  const [editBox, setEditBox] = useState<{ x: number; y: number; w: number; h: number; value: string; size: number } | null>(null)
  const historyRef = useRef<string[]>([])
  const futureRef = useRef<string[]>([])
  const dragRef = useRef<{ el: SVGTextElement; startX: number; startY: number; origX: number; origY: number } | null>(null)
  const [, force] = useState(0)
  const [tick, setTick] = useState(0)

  const getSvgEl = (): SVGSVGElement | null => wrapRef.current?.querySelector('svg') ?? null
  const serialize = (): string => {
    const el = getSvgEl()
    if (!el) return svg
    // The selection outline (stroke = accent) is ephemeral UI; it must never
    // leak into history or the saved SVG. Strip it, serialize, then restore.
    const saved: { el: SVGTextElement; stroke: string | null; sw: string }[] = []
    for (const [textEl, orig] of prevStroke.current) {
      saved.push({ el: textEl, stroke: textEl.getAttribute('stroke'), sw: textEl.style.strokeWidth })
      if (orig) textEl.setAttribute('stroke', orig)
      else textEl.removeAttribute('stroke')
      textEl.style.strokeWidth = ''
    }
    const out = new XMLSerializer().serializeToString(el)
    for (const { el: textEl, stroke, sw } of saved) {
      if (stroke) textEl.setAttribute('stroke', stroke)
      else textEl.removeAttribute('stroke')
      textEl.style.strokeWidth = sw
    }
    return out
  }
  const pushHistory = useCallback(() => {
    historyRef.current.push(serialize())
    if (historyRef.current.length > 40) historyRef.current.shift()
    futureRef.current = []
  }, [])
  const setInner = (s: string) => {
    const el = getSvgEl()
    if (el) el.outerHTML = s
  }

  // Mount the SVG outside React rendering so state updates never reset edits.
  useEffect(() => {
    if (!wrapRef.current) return
    wrapRef.current.innerHTML = sanitizeSvg(svg)
    historyRef.current = [svg]
    futureRef.current = []
    setSelected(null)
    setEditBox(null)
  }, [svg])

  const prevStroke = useRef<Map<SVGTextElement, string>>(new Map())

  const deselect = useCallback(() => {
    for (const [el, s] of prevStroke.current) {
      if (s) el.setAttribute('stroke', s)
      else el.removeAttribute('stroke')
      el.style.strokeWidth = ''
    }
    prevStroke.current.clear()
    setSelected(null)
    setEditBox(null)
  }, [])

  const select = useCallback(
    (el: SVGTextElement | null) => {
      deselect()
      if (!el) return
      prevStroke.current.set(el, el.getAttribute('stroke') ?? '')
      el.setAttribute('stroke', style.accent)
      el.style.strokeWidth = '1.5px'
      setSelected(el)
    },
    [deselect, style.accent],
  )

  // Event delegation: click-select, double-click to edit, drag to move.
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return

    const findText = (target: EventTarget | null): SVGTextElement | null => {
      const el = target as Element | null
      if (!el) return null
      const t = el.closest('text')
      if (t && t.ownerSVGElement && t.ownerSVGElement.parentElement === wrap) return t as SVGTextElement
      return null
    }

    const scale = () => {
      const svgEl = getSvgEl()
      if (!svgEl) return 1
      return svgEl.viewBox.baseVal.width / Math.max(1, svgEl.getBoundingClientRect().width)
    }

    const onMouseDown = (e: MouseEvent) => {
      const t = findText(e.target)
      if (!t) {
        if (!editBox) deselect()
        return
      }
      select(t)
      dragRef.current = {
        el: t,
        startX: e.clientX,
        startY: e.clientY,
        origX: Number(t.getAttribute('x') ?? 0),
        origY: Number(t.getAttribute('y') ?? 0),
      }
      e.preventDefault()
    }

    const onMouseMove = (e: MouseEvent) => {
      const d = dragRef.current
      if (!d) return
      const f = scale()
      const dx = (e.clientX - d.startX) * f
      const dy = (e.clientY - d.startY) * f
      d.el.setAttribute('x', String(Math.round(d.origX + dx)))
      d.el.setAttribute('y', String(Math.round(d.origY + dy)))
      // AI output often puts x on tspan elements, so move those together.
      d.el.querySelectorAll('tspan').forEach((ts) => {
        if (ts.getAttribute('x')) ts.setAttribute('x', String(Number(ts.getAttribute('x')) + Math.round(dx)))
      })
    }

    const onMouseUp = () => {
      const d = dragRef.current
      if (d) {
        const dx = (d.el.getAttribute('x') ? Number(d.el.getAttribute('x')) : 0) - d.origX
        const dy = (d.el.getAttribute('y') ? Number(d.el.getAttribute('y')) : 0) - d.origY
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) pushHistory()
      }
      dragRef.current = null
    }

    const onDblClick = (e: MouseEvent) => {
      const t = findText(e.target)
      if (!t) return
      e.preventDefault()
      startEdit(t)
    }

    wrap.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    wrap.addEventListener('dblclick', onDblClick)
    return () => {
      wrap.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      wrap.removeEventListener('dblclick', onDblClick)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editBox, select, deselect, pushHistory])

  const startEdit = (t: SVGTextElement) => {
    select(t)
    const wrapRect = wrapRef.current!.getBoundingClientRect()
    const r = t.getBoundingClientRect()
    const first = t.querySelector('tspan') ?? t
    const size = Number(t.getAttribute('font-size') || first.getAttribute('font-size') || 16)
    setEditBox({
      x: r.left - wrapRect.left,
      y: r.top - wrapRect.top,
      w: Math.max(80, r.width),
      h: Math.max(24, r.height),
      value: t.textContent ?? '',
      size,
    })
    requestAnimationFrame(() => taRef.current?.focus())
  }

  const commitEdit = () => {
    if (!editBox || !selected) return
    const tspans = [...selected.querySelectorAll('tspan')]
    if (tspans.length > 0) {
      tspans[0].textContent = editBox.value
      tspans.slice(1).forEach((ts) => ts.remove())
    } else {
      selected.textContent = editBox.value
    }
    pushHistory()
    setEditBox(null)
    setTick((n) => n + 1)
  }

  const mutate = (fn: (el: SVGTextElement) => void) => {
    if (!selected) return
    fn(selected)
    pushHistory()
    setTick((n) => n + 1)
  }

  const changeSize = (mult: number) =>
    mutate((el) => {
      const cur = Number(el.getAttribute('font-size') || 16)
      el.setAttribute('font-size', String(Math.min(120, Math.max(8, Math.round(cur * mult)))))
    })

  const toggleBold = () =>
    mutate((el) => {
      const cur = el.getAttribute('font-weight') ?? ''
      el.setAttribute('font-weight', cur === '700' ? 'normal' : '700')
    })

  const setFill = (color: string) => mutate((el) => el.setAttribute('fill', color))

  const addHighlight = () =>
    mutate((el) => {
      const bb = el.getBBox()
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      rect.setAttribute('x', String(bb.x - 4))
      rect.setAttribute('y', String(bb.y + bb.height * 0.12))
      rect.setAttribute('width', String(bb.width + 8))
      rect.setAttribute('height', String(bb.height * 1.05))
      rect.setAttribute('rx', '2')
      rect.setAttribute('fill', style.highlight)
      rect.setAttribute('opacity', '0.85')
      el.parentNode?.insertBefore(rect, el)
    })

  const removeEl = () => {
    if (!selected) return
    const el = selected
    deselect()
    el.remove()
    pushHistory()
  }

  const undo = () => {
    if (historyRef.current.length <= 1) return
    futureRef.current.push(historyRef.current.pop()!)
    deselect()
    setInner(historyRef.current[historyRef.current.length - 1])
    setTick((n) => n + 1)
  }
  const redo = () => {
    const nxt = futureRef.current.pop()
    if (!nxt) return
    deselect()
    historyRef.current.push(nxt)
    setInner(nxt)
    setTick((n) => n + 1)
  }

  return (
    <div className="space-y-3" data-tick={tick}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 border border-border bg-card p-2">
        <Button variant="ghost" size="sm" onClick={undo} disabled={historyRef.current.length <= 1} title="撤销">
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" onClick={redo} disabled={futureRef.current.length === 0} title="重做">
          <Redo2 className="h-3.5 w-3.5" />
        </Button>
        <span className="mx-1 h-4 w-px bg-border" />
        {selected ? (
          <>
            <Button variant="outline" size="sm" onClick={() => selected && startEdit(selected)}>
              编辑文字
            </Button>
            <Button variant="ghost" size="sm" onClick={() => changeSize(1 / 1.12)} title="缩小字号">
              <Minus className="h-3.5 w-3.5" />A
            </Button>
            <Button variant="ghost" size="sm" onClick={() => changeSize(1.12)} title="放大字号">
              <Plus className="h-3.5 w-3.5" />A
            </Button>
            <Button variant="ghost" size="sm" onClick={toggleBold} title="加粗">
              <Bold className="h-3.5 w-3.5" />
            </Button>
            <span className="mx-1 h-4 w-px bg-border" />
            {[
              ['正文', style.fg],
              ['强调', style.accent],
              ['次要', style.muted],
            ].map(([label, color]) => (
              <button
                key={label}
                title={`文字颜色：${label}`}
                onClick={() => setFill(color)}
                className="flex h-8 items-center gap-1.5 px-2 text-xs hover:bg-muted"
              >
                <span className="inline-block h-3.5 w-3.5 border border-border" style={{ background: color }} />
                {label}
              </button>
            ))}
            <Button variant="ghost" size="sm" onClick={addHighlight} title="加黄色荧光笔">
              <Highlighter className="h-3.5 w-3.5" />荧光笔
            </Button>
            <span className="mx-1 h-4 w-px bg-border" />
            <Button variant="ghost" size="sm" onClick={removeEl} className="text-destructive hover:bg-destructive/10" title="删除该文字">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <span className="px-1 text-xs text-muted-foreground">点击页面上的文字进行选择；拖动可移动；双击直接改字</span>
        )}
        <span className="ml-auto flex gap-1.5">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-3.5 w-3.5" />放弃修改
          </Button>
          <Button size="sm" onClick={() => onSave(serialize())}>
            <Check className="h-3.5 w-3.5" />保存修改
          </Button>
        </span>
      </div>

      {/* Canvas */}
      <div
        ref={wrapRef}
        className={cn(
          'relative mx-auto w-full select-none border border-border bg-card shadow-xl [&>svg]:block [&>svg]:h-auto [&>svg]:w-full [&_text]:cursor-text',
        )}
        style={{ maxWidth: ratio === '4:3' ? 'min(100%, calc((100vh - 320px) * 4 / 3))' : 'min(100%, calc((100vh - 320px) * 16 / 9))' }}
      />
      {editBox && (
        <div className="fixed inset-0 z-[65]" onClick={commitEdit}>
          <textarea
            ref={taRef}
            value={editBox.value}
            onChange={(e) => setEditBox({ ...editBox, value: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                commitEdit()
              }
              if (e.key === 'Escape') setEditBox(null)
            }}
            className="absolute z-10 resize-none border-2 border-primary bg-background/95 p-0.5 text-center leading-tight shadow-xl outline-none"
            style={{
              left: editBox.x,
              top: editBox.y,
              width: Math.max(120, editBox.w + 24),
              height: Math.max(30, editBox.h + 8),
              fontSize: Math.max(12, editBox.size),
            }}
          />
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-white/70">Enter 确认 · Esc 取消</div>
        </div>
      )}
    </div>
  )
}
