// 纯 Office 基础形状 PPTX 导出：把整页 SVG 的每个元素逐一定位还原成 pptxgenjs 原生形状，
// 完全不垫底图。这样在 Office 里每个文本框/矩形/椭圆/线条都能选中、改字、改色、移动。
//
// 元素映射：
//   <rect>          → 矩形形状（纯实心色）
//   <circle>        → 椭圆形状（实心或仅描边）
//   <ellipse>       → 椭圆形状（实心或仅描边）
//   <line>          → 水平/垂直→细矩形；斜线→ line 形状
//   <text>/<tspan>  → 原生文本框（可编辑文字）
//   <svg>（内嵌）   → MathJax 公式，光栅化为 PNG 嵌入图片
//   <image>         → 嵌入图片（问号小人等 data URL）
// 半透明的 rgba 填充（本应用里主要是卡片描边/浅色调）不还原，保证形状干净可选。
import PptxGenJS from 'pptxgenjs'
import type { CanvasRatio, SlideStyle } from 'shared/types'
import { RATIO_SIZE } from './exporter'

/** SVG 像素 → 英寸：pptxgenjs 的 x/y/w/h 以英寸为单位，96dpi 下 1px = 1/96in */
function pxToIn(px: number): number {
  return px / 96
}

/** SVG 字号(px) → pptx 字号(pt)：1px = 0.75pt */
function pxToPt(px: number): number {
  return px * 0.75
}

const CJK = /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFF60\u3000-\u303F]/

/** 用与渲染器一致的启发式估算一行文本的渲染宽度（px） */
function textWidthPx(s: string, sizePx: number): number {
  let w = 0
  for (const ch of s) w += CJK.test(ch) ? sizePx : sizePx * 0.52
  return w
}

function num(attr: string | null, fallback = 0): number {
  const n = parseFloat(attr ?? '')
  return Number.isFinite(n) ? n : fallback
}

/** 只认纯十六进制色（6 位或 3 位），其它格式（rgb/rgba/名字）返回空 → 由调用方决定保留/丢弃 */
function hexOf(fill: string): string {
  let c = (fill ?? '').trim()
  const rgb = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  if (rgb) c = [rgb[1], rgb[2], rgb[3]].map((n) => parseInt(n, 10).toString(16).padStart(2, '0')).join('')
  if (c.startsWith('#')) c = c.slice(1)
  if (/^[0-9a-fA-F]{3}$/.test(c)) c = c.split('').map((x) => x + x).join('')
  return /^[0-9a-fA-F]{6}$/.test(c) ? c : ''
}

export interface TextLine {
  x: number
  y: number // 基线 y
  text: string
  size: number
  fill: string
  bold: boolean
  anchor: 'start' | 'middle' | 'end'
  /** 文字描边（Office 艺术字的轮廓色/宽度） */
  stroke?: string
  strokeWidth?: number
}

export interface ImageRef {
  x: number
  y: number
  w: number
  h: number
  href: string
}

export interface NativeShape {
  kind: 'rect' | 'roundRect' | 'ellipse' | 'line' | 'polygon'
  x: number
  y: number
  w: number
  h: number
  fill?: string
  line?: string
  /** polygon 时：pptxgenjs 原生形状名（triangle/diamond/pentagon/…） */
  shapeName?: string
  /** roundRect 的圆角半径(px) */
  rx?: number
}

/**
 * 异步预处理：把无法用 Office 原生形状表达的复杂矢量元素光栅化为 PNG data URL <image>。
 * 两类元素：
 *  1) MathJax 公式内嵌 <svg>（含大量 <path>/<use>/<g>）；
 *  2) 无法分类成原生形状的 <polygon>/<polyline>（一般四边形、复杂折线等）。
 * 光栅化为图片是保证视觉保真的兜底做法；能映射为原生形状的元素留给 parseSvg 处理。
 */
export async function preprocessComplexShapes(svg: string): Promise<string> {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const root = doc.documentElement.tagName.toLowerCase() === 'svg' ? doc.documentElement : null
  if (!root) return svg

  // XMLSerializer 仅浏览器可用；Node 测试环境无此 API，延迟到真正需要时才实例化
  let _serial: XMLSerializer | null = null
  const serializer = () => _serial ?? (_serial = new XMLSerializer())
  const jobs: { original: string; replacement: string }[] = []

  // 1) MathJax 公式内嵌 <svg>
  const nestedSvgs = Array.from(root.querySelectorAll('svg'))
  for (const nsvg of nestedSvgs) {
    const x = num(nsvg.getAttribute('x'))
    const y = num(nsvg.getAttribute('y'))
    const w = num(nsvg.getAttribute('width'))
    const h = num(nsvg.getAttribute('height'))
    if (w <= 0 || h <= 0) continue
    const svgStr = serializer().serializeToString(nsvg)
    try {
      const dataUrl = await svgToDataUrl(svgStr)
      jobs.push({ original: svgStr, replacement: `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${dataUrl}" />` })
    } catch {
      jobs.push({ original: svgStr, replacement: '' })
    }
  }

  // 2) 无法分类成原生形状的多边形 / 复杂折线 → 光栅化
  for (const el of Array.from(root.querySelectorAll('polygon, polyline'))) {
    if (!isTopLevel(el, root)) continue
    const pts = parsePoints(el.getAttribute('points'))
    const isPolygon = el.tagName.toLowerCase() === 'polygon'
    const needsRaster = isPolygon ? !classifyPolygon(pts) : pts.length > 2
    if (!needsRaster) continue
    const bb = bboxOf(pts)
    if (!bb) continue
    const elStr = serializer().serializeToString(el)
    const wrapped = `<svg xmlns="http://www.w3.org/2000/svg" width="${bb.w}" height="${bb.h}" viewBox="${bb.minX} ${bb.minY} ${bb.w} ${bb.h}">${elStr}</svg>`
    try {
      const dataUrl = await svgToDataUrl(wrapped)
      jobs.push({ original: elStr, replacement: `<image x="${bb.minX}" y="${bb.minY}" width="${bb.w}" height="${bb.h}" href="${dataUrl}" />` })
    } catch {
      jobs.push({ original: elStr, replacement: '' })
    }
  }

  if (jobs.length === 0) return svg

  let out = svg
  for (const j of jobs) {
    if (out.includes(j.original)) {
      out = out.replace(j.original, j.replacement)
    } else {
      const stripped = j.original.replace(/\s+xmlns="[^"]*"/g, '')
      if (out.includes(stripped)) out = out.replace(stripped, j.replacement)
    }
  }
  return out
}


/** 把 SVG 字符串光栅化为 PNG data URL（浏览器端） */
function svgToDataUrl(svgStr: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth * 2
        canvas.height = img.naturalHeight * 2
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/png'))
      } catch (e) {
        reject(e)
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('SVG rasterize failed'))
    }
    img.src = url
  })
}

/** 判断元素是否位于内嵌 <svg>（MathJax 公式）内部——只处理顶层元素 */
function isTopLevel(el: Element, root: Element): boolean {
  let p: Element | null = el.parentElement
  while (p && p !== root) {
    if (p.tagName.toLowerCase() === 'svg') return false
    p = p.parentElement
  }
  return true
}



type Pt = { x: number; y: number }

/** 解析 SVG points 属性（"x1,y1 x2,y2 …" 或 "x1 y1, x2 y2"） */
function parsePoints(s: string | null): Pt[] {
  if (!s) return []
  const pts: Pt[] = []
  const pairs = s.trim().split(/[\s,]+/)
  for (let i = 0; i + 1 < pairs.length; i += 2) {
    const x = parseFloat(pairs[i])
    const y = parseFloat(pairs[i + 1])
    if (Number.isFinite(x) && Number.isFinite(y)) pts.push({ x, y })
  }
  // SVG 多边形常把首点重复一次来闭合（points 末尾 == 首点），去掉重复的闭合点
  if (pts.length > 1 && pts[0].x === pts[pts.length - 1].x && pts[0].y === pts[pts.length - 1].y) pts.pop()
  return pts
}

/** 点集包围盒；点数不足或退化返回 null */
function bboxOf(pts: Pt[]): { minX: number; minY: number; w: number; h: number } | null {
  if (pts.length === 0) return null
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of pts) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y)
  }
  const w = maxX - minX, h = maxY - minY
  if (w <= 0.5 || h <= 0.5) return null
  return { minX, minY, w, h }
}

function dist2(a: Pt, b: Pt): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2
}

/** ab 与 cd 是否平行（叉积≈0） */
function isParallel(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const abx = b.x - a.x, aby = b.y - a.y
  const cdx = d.x - c.x, cdy = d.y - c.y
  const cross = abx * cdy - aby * cdx
  return Math.abs(cross) < Math.max(4, Math.hypot(abx, aby) * Math.hypot(cdx, cdy) * 0.05)
}

/**
 * 把多边形点集分类为 pptxgenjs 原生形状名；无法可靠分类返回 null（调用方会光栅化）。
 * 覆盖：三角形/直角三角/菱形/平行四边形/梯形/五边形/六边形/七边形/八边形/十边形/五角星。
 */
function classifyPolygon(pts: Pt[]): string | null {
  const n = pts.length
  if (n < 3) return null
  const bb = bboxOf(pts)
  if (!bb) return null
  const { minX, maxX, minY, maxY } = { minX: bb.minX, maxX: bb.minX + bb.w, minY: bb.minY, maxY: bb.minY + bb.h }

  // 10 点：判断是五角星（内外半径交替）还是十边形
  if (n === 10) {
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
    const dists = pts.map((p) => Math.hypot(p.x - cx, p.y - cy)).sort((a, b) => a - b)
    const inner = (dists[0] + dists[1] + dists[2] + dists[3] + dists[4]) / 5
    const outer = (dists[5] + dists[6] + dists[7] + dists[8] + dists[9]) / 5
    if (outer > inner * 1.3) return 'star10'
    return 'decagon'
  }

  switch (n) {
    case 3: {
      const a2 = dist2(pts[0], pts[1])
      const b2 = dist2(pts[1], pts[2])
      const c2 = dist2(pts[2], pts[0])
      const s = [a2, b2, c2].sort((x, y) => x - y)
      if (Math.abs(s[2] - (s[0] + s[1])) < Math.max(4, s[2] * 0.05)) return 'rtTriangle'
      return 'triangle'
    }
    case 4: {
      const corners = [[minX, minY], [maxX, minY], [minX, maxY], [maxX, maxY]]
      const cornerHits = pts.filter((p) => corners.some((c) => Math.abs(p.x - c[0]) < 2 && Math.abs(p.y - c[1]) < 2)).length
      // 轴对齐矩形（含正方形）：4 个顶点都在包围盒角点
      if (cornerHits === 4) return 'rect'
      const d01 = dist2(pts[0], pts[1]), d12 = dist2(pts[1], pts[2])
      const d23 = dist2(pts[2], pts[3]), d30 = dist2(pts[3], pts[0])
      const sides = [d01, d12, d23, d30]
      const avg = sides.reduce((a, b) => a + b, 0) / 4
      const uniform = sides.every((s) => Math.abs(s - avg) < avg * 0.12)
      if (uniform && cornerHits === 0) return 'diamond'
      if (isParallel(pts[0], pts[1], pts[2], pts[3]) && isParallel(pts[1], pts[2], pts[3], pts[0])) return 'parallelogram'
      if (isParallel(pts[0], pts[1], pts[2], pts[3]) || isParallel(pts[1], pts[2], pts[3], pts[0])) return 'trapezoid'
      return null // 一般四边形 → 光栅化
    }
    case 5: return 'pentagon'
    case 6: return 'hexagon'
    case 7: return 'heptagon'
    case 8: return 'octagon'
    default: return null
  }
}

/** 解析 SVG：拆出可编辑文本框 + 基础形状 + 图片（排除内嵌公式 SVG 内部元素） */
export function parseSvg(svg: string): { texts: TextLine[]; shapes: NativeShape[]; images: ImageRef[] } {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const root = doc.documentElement.tagName.toLowerCase() === 'svg' ? (doc.documentElement as unknown as SVGSVGElement) : null
  const texts: TextLine[] = []
  const shapes: NativeShape[] = []
  const images: ImageRef[] = []
  if (!root) return { texts, shapes, images }

  // 内嵌公式 <svg> 已由 preprocessFormulas 光栅化为 <image>，此处无需再处理；
  // 只需确保内嵌公式 SVG 内部的 <text>/<rect> 等不会被误拾取。

  // ── 文本（只取顶层，跳过内嵌 <svg> 内部的） ──
  for (const el of Array.from(root.querySelectorAll('text'))) {
    if (!isTopLevel(el, root)) continue
    const baseX = num(el.getAttribute('x'))
    const baseY = num(el.getAttribute('y'))
    const size = num(el.getAttribute('font-size'), 16)
    const fill = el.getAttribute('fill') ?? ''
    const wt = el.getAttribute('font-weight') ?? ''
    const bold = wt === '700' || wt === 'bold' || Number(wt) >= 600
    const anchor = (el.getAttribute('text-anchor') ?? 'start') as 'start' | 'middle' | 'end'
    const stroke = el.getAttribute('stroke') ?? ''
    const strokeWidth = num(el.getAttribute('stroke-width'))
    const tspans = Array.from(el.querySelectorAll('tspan'))

    if (tspans.length > 0) {
      let ly = baseY
      let lx = baseX
      for (const ts of tspans) {
        const xAttr = ts.getAttribute('x')
        if (xAttr) lx = num(xAttr, lx)
        const dyAttr = ts.getAttribute('dy')
        if (dyAttr !== null) ly += num(dyAttr, 0)
        const txt = ts.textContent ?? ''
        if (txt.trim()) texts.push({ x: lx, y: ly, text: txt, size, fill, bold, anchor, stroke, strokeWidth })
      }
    } else {
      const txt = el.textContent ?? ''
      if (txt.trim()) texts.push({ x: baseX, y: baseY, text: txt, size, fill, bold, anchor, stroke, strokeWidth })
    }
  }

  // ── 基础形状（只取顶层 <rect>/<circle>/<ellipse>/<line>） ──
  for (const r of Array.from(root.querySelectorAll('rect'))) {
    if (!isTopLevel(r, root)) continue
    const x = num(r.getAttribute('x'))
    const y = num(r.getAttribute('y'))
    const w = num(r.getAttribute('width'))
    const h = num(r.getAttribute('height'))
    const rx = num(r.getAttribute('rx'))
    const fill = hexOf(r.getAttribute('fill') ?? '')
    if ((!fill && !hexOf(r.getAttribute('stroke') ?? '')) || w <= 0.5 || h <= 0.5) continue
    // rx>0 → 圆角矩形（卡片/荧光笔/柱状条都是圆角）
    shapes.push(rx > 0.5 ? { kind: 'roundRect', x, y, w, h, rx: Math.min(rx, w / 2, h / 2), fill: fill || undefined } : { kind: 'rect', x, y, w, h, fill: fill || undefined })
  }

  for (const c of Array.from(root.querySelectorAll('circle'))) {
    if (!isTopLevel(c, root)) continue
    const cx = num(c.getAttribute('cx'))
    const cy = num(c.getAttribute('cy'))
    const r = num(c.getAttribute('r'))
    const fill = hexOf(c.getAttribute('fill') ?? '')
    const stroke = hexOf(c.getAttribute('stroke') ?? '')
    if (r <= 0.5) continue
    shapes.push({
      kind: 'ellipse',
      x: cx - r,
      y: cy - r,
      w: r * 2,
      h: r * 2,
      fill: fill || undefined,
      line: stroke || undefined,
    })
  }

  // <ellipse>（渲染器的 redEllipse / 红圈圈）
  for (const el of Array.from(root.querySelectorAll('ellipse'))) {
    if (!isTopLevel(el, root)) continue
    const cx = num(el.getAttribute('cx'))
    const cy = num(el.getAttribute('cy'))
    const rx = num(el.getAttribute('rx'))
    const ry = num(el.getAttribute('ry'))
    if (rx <= 0.5 || ry <= 0.5) continue
    const fill = hexOf(el.getAttribute('fill') ?? '')
    const stroke = hexOf(el.getAttribute('stroke') ?? '')
    const strokeWidth = num(el.getAttribute('stroke-width'), 1)
    shapes.push({
      kind: 'ellipse',
      x: cx - rx,
      y: cy - ry,
      w: rx * 2,
      h: ry * 2,
      fill: fill || undefined,
      line: stroke || undefined,
    })
    if (stroke && strokeWidth > 1) {
      const last = shapes[shapes.length - 1]
      last.line = `${stroke};${(strokeWidth * 0.75).toFixed(1)}`
    }
  }

  for (const ln of Array.from(root.querySelectorAll('line'))) {
    if (!isTopLevel(ln, root)) continue
    const x1 = num(ln.getAttribute('x1'))
    const y1 = num(ln.getAttribute('y1'))
    const x2 = num(ln.getAttribute('x2'))
    const y2 = num(ln.getAttribute('y2'))
    const stroke = hexOf(ln.getAttribute('stroke') ?? '')
    if (!stroke) continue
    if (Math.abs(y2 - y1) < 0.5) {
      shapes.push({ kind: 'rect', x: Math.min(x1, x2), y: y1, w: Math.abs(x2 - x1), h: Math.max(0.5, num(ln.getAttribute('stroke-width'), 1.5)), fill: stroke })
    } else if (Math.abs(x2 - x1) < 0.5) {
      shapes.push({ kind: 'rect', x: x1, y: Math.min(y1, y2), w: Math.max(0.5, num(ln.getAttribute('stroke-width'), 1.5)), h: Math.abs(y2 - y1), fill: stroke })
    } else {
      shapes.push({ kind: 'line', x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), line: stroke })
    }
  }

  // <polygon>（三角形/菱形/五边形/六边形/… → 原生形状；无法分类的已由 preprocess 光栅化）
  for (const pg of Array.from(root.querySelectorAll('polygon'))) {
    if (!isTopLevel(pg, root)) continue
    const pts = parsePoints(pg.getAttribute('points'))
    const shapeName = classifyPolygon(pts)
    if (!shapeName) continue
    const bb = bboxOf(pts)
    if (!bb) continue
    const fill = hexOf(pg.getAttribute('fill') ?? '')
    const stroke = hexOf(pg.getAttribute('stroke') ?? '')
    shapes.push({ kind: 'polygon', shapeName, x: bb.minX, y: bb.minY, w: bb.w, h: bb.h, fill: fill || undefined, line: stroke || undefined })
  }

  // <polyline>（2 点 → 线；更复杂的已由 preprocess 光栅化）
  for (const pl of Array.from(root.querySelectorAll('polyline'))) {
    if (!isTopLevel(pl, root)) continue
    const pts = parsePoints(pl.getAttribute('points'))
    if (pts.length !== 2) continue
    const stroke = hexOf(pl.getAttribute('stroke') ?? '')
    if (!stroke) continue
    const x1 = pts[0].x, y1 = pts[0].y, x2 = pts[1].x, y2 = pts[1].y
    if (Math.abs(y2 - y1) < 0.5) {
      shapes.push({ kind: 'rect', x: Math.min(x1, x2), y: y1, w: Math.abs(x2 - x1), h: Math.max(0.5, num(pl.getAttribute('stroke-width'), 1.5)), fill: stroke })
    } else if (Math.abs(x2 - x1) < 0.5) {
      shapes.push({ kind: 'rect', x: x1, y: Math.min(y1, y2), w: Math.max(0.5, num(pl.getAttribute('stroke-width'), 1.5)), h: Math.abs(y2 - y1), fill: stroke })
    } else {
      shapes.push({ kind: 'line', x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), line: stroke })
    }
  }

  // ── 图片（问号小人 + 公式光栅化后的 <image>） ──
  for (const im of Array.from(root.querySelectorAll('image'))) {
    if (!isTopLevel(im, root)) continue
    const x = num(im.getAttribute('x'))
    const y = num(im.getAttribute('y'))
    const w = num(im.getAttribute('width'))
    const h = num(im.getAttribute('height'))
    const href = im.getAttribute('href') ?? im.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ?? ''
    if (!href || w <= 0 || h <= 0) continue
    images.push({ x, y, w, h, href })
  }

  return { texts, shapes, images }
}


/** 朴素干货风格使用等线，其他风格使用 PingFang SC */
function fontFamily(style: SlideStyle): string {
  return style.carded ? 'PingFang SC' : '等线'
}

/** 导出纯基础形状 PPTX（无位图底） */
export async function exportNativePptx(
  slides: { svg: string; note?: string }[],
  title: string,
  ratio: CanvasRatio,
  style: SlideStyle,
  onProgress?: (i: number, n: number) => void,
): Promise<Blob> {
  const size = RATIO_SIZE[ratio]
  const W = size.w
  const H = size.h
  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'SimplePPT', width: size.inches.w, height: size.inches.h })
  pptx.layout = 'SimplePPT'
  pptx.title = title
  pptx.author = 'SimplePPT'

  const font = fontFamily(style)

  for (let i = 0; i < slides.length; i++) {
    onProgress?.(i, slides.length)
    const { svg: rawSvg, note } = slides[i]
    const s = pptx.addSlide()
    // 背景色：取 SVG 里铺满整页的矩形填充，作为幻灯片背景
    const bgFill = detectBackgroundFill(rawSvg, W, H)
    if (bgFill) s.background = { color: bgFill }

    // 光栅化公式 / 复杂形状（MathJax 内嵌 <svg>、无法分类的多边形等）→ <image> data URL
    const svg = await preprocessComplexShapes(rawSvg)

    const { texts, shapes, images } = parseSvg(svg)

    // 基础形状（先画，文本叠在上层）
    for (const sh of shapes) {
      if (sh.kind === 'rect') {
        s.addShape('rect', {
          x: pxToIn(sh.x),
          y: pxToIn(sh.y),
          w: pxToIn(sh.w),
          h: pxToIn(sh.h),
          fill: sh.fill ? { color: sh.fill } : { type: 'none' },
          line: { type: 'none' },
        })
      } else if (sh.kind === 'roundRect') {
        s.addShape('roundRect', {
          x: pxToIn(sh.x),
          y: pxToIn(sh.y),
          w: pxToIn(sh.w),
          h: pxToIn(sh.h),
          rectRadius: pxToIn(sh.rx ?? 0),
          fill: sh.fill ? { color: sh.fill } : { type: 'none' },
          line: { type: 'none' },
        })
      } else if (sh.kind === 'polygon') {
        // line 属性格式同 ellipse："color;widthPt" 或纯 color
        let lineColor = ''
        let lineW = 1
        if (sh.line) {
          const parts = sh.line.split(';')
          lineColor = parts[0]
          if (parts[1]) lineW = parseFloat(parts[1]) || 1
        }
        s.addShape(sh.shapeName as any, {
          x: pxToIn(sh.x),
          y: pxToIn(sh.y),
          w: pxToIn(sh.w),
          h: pxToIn(sh.h),
          fill: sh.fill ? { color: sh.fill } : { type: 'none' },
          line: lineColor ? { color: lineColor, width: lineW } : { type: 'none' },
        })
      } else if (sh.kind === 'ellipse') {
        // 解析 line 属性（格式: "color;widthPt" 或纯 color）
        let lineColor = ''
        let lineW = 1
        if (sh.line) {
          const parts = sh.line.split(';')
          lineColor = parts[0]
          if (parts[1]) lineW = parseFloat(parts[1]) || 1
        }
        s.addShape('ellipse', {
          x: pxToIn(sh.x),
          y: pxToIn(sh.y),
          w: pxToIn(sh.w),
          h: pxToIn(sh.h),
          fill: sh.fill ? { color: sh.fill } : { type: 'none' },
          line: lineColor ? { color: lineColor, width: lineW } : { type: 'none' },
        })
      } else {
        s.addShape('line', {
          x: pxToIn(sh.x),
          y: pxToIn(sh.y),
          w: pxToIn(sh.w),
          h: pxToIn(sh.h),
          line: { color: sh.line ?? '000000', width: 1 },
        })
      }
    }

    // 位图（问号小人 + MathJax 公式光栅化后等内嵌 data URL 图片）
    for (const im of images) {
      s.addImage({ data: im.href, x: pxToIn(im.x), y: pxToIn(im.y), w: pxToIn(im.w), h: pxToIn(im.h) })
    }

    // 文本框
    for (const t of texts) {
      const wpx = Math.max(8, textWidthPx(t.text, t.size))
      const hIn = pxToIn(t.size * 1.25)
      const topIn = pxToIn(t.y - t.size * 0.82)
      let xpx = t.x
      if (t.anchor === 'middle') xpx = t.x - wpx / 2
      else if (t.anchor === 'end') xpx = t.x - wpx
      const color = hexOf(t.fill)
      const strokeColor = t.stroke ? hexOf(t.stroke) : ''
      s.addText(t.text, {
        x: pxToIn(xpx),
        y: topIn,
        w: pxToIn(wpx),
        h: hIn,
        fontSize: pxToPt(t.size),
        fontFace: font,
        color: color || undefined,
        outline: strokeColor ? { color: strokeColor, size: Math.max(0.75, pxToPt(t.strokeWidth || 2)) } : undefined,
        bold: t.bold,
        align: t.anchor === 'middle' ? 'center' : t.anchor === 'end' ? 'right' : 'left',
        valign: 'middle',
        margin: 0,
        isTextBox: true,
      })
    }

    if (note) s.addNotes(note)
  }
  onProgress?.(slides.length, slides.length)
  const out = (await pptx.write({ outputType: 'blob' })) as Blob
  return out
}

/** 从 SVG 探测铺满整页的背景矩形颜色 */
function detectBackgroundFill(svg: string, W: number, H: number): string | null {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const root = doc.documentElement.tagName.toLowerCase() === 'svg' ? (doc.documentElement as unknown as SVGSVGElement) : null
  if (!root) return null
  for (const r of Array.from(root.querySelectorAll('rect'))) {
    const w = num(r.getAttribute('width'))
    const h = num(r.getAttribute('height'))
    if (w >= W - 1 && h >= H - 1) {
      const c = hexOf(r.getAttribute('fill') ?? '')
      if (c) return c
    }
  }
  return null
}
