// 参数化幻灯片渲染器：同一份策划稿数据可以按任意 SlideStyle 画出整页 SVG。
// 用途：风格工坊的实时预览、演示模式（Mock）的幻灯片生成。
// 真实生成走 AI（服务端 prompts.ts），这里只覆盖演示与预览所需的页型与卡片类型。
import { getLayout, gridRect, type BentoLayout } from 'shared/bento'
import { isPlainStyle, type PagePlan, type SlideStyle } from 'shared/types'
import { QUESTION_PERSON_DATA_URL } from './question-image'

const FONT = "system-ui,'PingFang SC','Noto Sans CJK SC','Microsoft YaHei',sans-serif"

export function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

type TOpts = { fill?: string; weight?: number; anchor?: 'start' | 'middle' | 'end'; ls?: number; opacity?: number }
const T = (x: number, y: number, size: number, content: string, o: TOpts = {}) =>
  `<text x="${x}" y="${y}" font-size="${size}"${o.weight ? ` font-weight="${o.weight}"` : ''}${o.fill ? ` fill="${o.fill}"` : ''}${
    o.anchor ? ` text-anchor="${o.anchor}"` : ''
  }${o.ls ? ` letter-spacing="${o.ls}"` : ''}${o.opacity != null ? ` opacity="${o.opacity}"` : ''}>${escapeXml(content)}</text>`

const CJK = /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFF60\u3000-\u303F]/
function textWidth(s: string, size: number): number {
  let w = 0
  for (const ch of s) w += CJK.test(ch) ? size : size * 0.52
  return w
}

function wrapLines(s: string, size: number, maxW: number, maxLines = 6): string[] {
  const lines: string[] = []
  let cur = ''
  let w = 0
  for (const ch of s) {
    const cw = CJK.test(ch) ? size : size * 0.52
    if (w + cw > maxW && cur) {
      lines.push(cur)
      cur = ''
      w = 0
    }
    cur += ch
    w += cw
  }
  if (cur) lines.push(cur)
  return lines.slice(0, maxLines)
}

const asArray = (c: string | string[] | undefined): string[] => (Array.isArray(c) ? c : c ? [c] : [])

export interface RenderCtx {
  index: number
  total: number
  topic: string
  quoteAuthor?: string
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/* ---------- 朴素干货：刻意"赶时间"的随机感 ---------- */

/** 确定性伪随机 0..1：同 seed 结果稳定，避免预览每次重渲染晃动 */
function rnd(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}
/** 确定性小偏移，范围 [-amp, +amp] */
function jv(amp: number, seed: number): number {
  return (rnd(seed) * 2 - 1) * amp
}
/** 字号：在基础大小上做一点随机（中/大之间微微浮动，显得人不那么"工整"） */
function jsize(size: number, seed: number): number {
  return Math.max(6, Math.round(size + jv(2, seed)))
}
function jx(x: number, seed: number): number {
  return Math.round(x + jv(3, seed))
}
function jy(y: number, seed: number): number {
  return Math.round(y + jv(3, seed + 17))
}

/** Office 默认模板的 WordArt 配色预设：纯色 / 黄底橙描边 / 白字粗描边+投影 / 镂空 / 荧光边（随机切换） */
type WordArtPreset = {
  fill?: string
  stroke?: string
  sw?: number
  hollow?: boolean
  glow?: string
  shadow?: string
}

const WORDART_PRESETS: WordArtPreset[] = [
  { fill: '#4472C4' }, // accent1 蓝（纯色，无描边）
  { fill: '#ED7D31' }, // accent2 橙
  { fill: '#FFC000' }, // accent4 金
  { fill: '#5B9BD5' }, // accent5 浅蓝
  { fill: '#70AD47' }, // accent6 绿
  { fill: 'rgba(255,255,0,0.42)', stroke: '#FFC000', sw: 0.055 }, // 经典黄底橙描边
  { fill: '#FFFF00', stroke: '#FFC000', sw: 0.05 }, // 更实的黄底橙描边
  { fill: '#FFFFFF', stroke: '#4472C4', sw: 0.07, shadow: 'rgba(0,0,0,0.32)' }, // 白字蓝描边 + 投影
  { fill: '#FFFFFF', stroke: '#C00000', sw: 0.07, glow: '#FFC000' }, // 白字红描边 + 荧光边
  { hollow: true, stroke: '#4472C4', sw: 0.07 }, // 镂空蓝
  { hollow: true, stroke: '#C00000', sw: 0.07 }, // 镂空红
]

/** 朴素干货的页标题：Office 默认模板的艺术字样式（配色随机、加粗、带轻微歪斜） */
function wordArt(x: number, y: number, size: number, content: string, seed: number, anchor: 'start' | 'middle' = 'start'): string {
  const p = WORDART_PRESETS[Math.floor(rnd(seed + 991) * WORDART_PRESETS.length)]
  const rot = jv(1.4, seed).toFixed(2)
  const cxp = anchor === 'middle' ? x : Math.round(x + textWidth(content, size) / 2)
  const sw = p.sw ? Math.max(1.6, Math.round(size * p.sw)) : 0
  const esc = escapeXml(content)
  const base = `x="${x}" y="${y}" font-size="${size}" font-weight="800" text-anchor="${anchor}" letter-spacing="1" transform="rotate(${rot} ${cxp} ${y})"`
  const layers: string[] = []
  if (p.shadow) {
    const dx = Math.max(1.5, Math.round(size * 0.05))
    const dy = Math.max(2, Math.round(size * 0.08))
    layers.push(`<text x="${x + dx}" y="${y + dy}" font-size="${size}" font-weight="800" fill="${p.shadow}" opacity="0.55" text-anchor="${anchor}" letter-spacing="1" transform="rotate(${rot} ${cxp} ${y})">${esc}</text>`)
  }
  if (p.glow) {
    const gsw = Math.max(3, Math.round(size * 0.11))
    layers.push(`<text ${base} fill="${p.glow}" stroke="${p.glow}" stroke-width="${gsw}" paint-order="stroke" opacity="0.65">${esc}</text>`)
  }
  if (p.hollow) {
    layers.push(`<text ${base} fill="none" stroke="${p.stroke}" stroke-width="${sw}">${esc}</text>`)
  } else {
    layers.push(`<text ${base} fill="${p.fill}"${sw ? ` stroke="${p.stroke}" stroke-width="${sw}" paint-order="stroke"` : ''}>${esc}</text>`)
  }
  return layers.join('\n')
}

/** 红圈圈：Office 注释用的红色椭圆描边（略宽于高，不配箭头） */
function redEllipse(cx: number, cy: number, rx: number, ry: number): string {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="#FF0000" stroke-width="3.5"/>`
}

/** 问号小人：直接内嵌用户提供的 ?.png 图片，不再手绘矢量（右缘对齐到 x，垂直居中到 y） */
function questionPerson(x: number, y: number, s: number): string {
  const h = s
  const w = Math.round(s * 0.85) // 306×360
  return `<image href="${QUESTION_PERSON_DATA_URL}" x="${Math.round(x - w)}" y="${Math.round(y - h / 2)}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`
}

/** 朴素干货使用更贴边的布局，减少内容和页边的留白 */
function tightenLayout(base: BentoLayout): BentoLayout {
  return {
    ...base,
    PAD: base.W === 1280 ? 30 : 28,
    CONTENT_TOP: base.W === 1280 ? 148 : 150,
    CONTENT_BOTTOM: base.W === 1280 ? 690 : 736,
    KICKER_Y: base.W === 1280 ? 74 : 72,
    TITLE_Y: base.W === 1280 ? 116 : 112,
    TITLE_SIZE: base.W === 1280 ? 48 : 42,
    FOOTER_Y: base.W === 1280 ? 700 : 750,
  }
}

export function renderSlide(plan: PagePlan, style: SlideStyle, ctx: RenderCtx): string {
  const base = getLayout(style.ratio)
  // carded 只决定是否画卡片底；朴素干货的手写讲义气质由 plain 单独控制，
  // 关掉 Bento 卡片不会误触发朴素干货版式。
  const plain = isPlainStyle(style)
  const l = plain ? tightenLayout(base) : base
  const rects = plan.cards.map((c) => {
    const r = { ...c, ...gridRect(l, c.col, c.colSpan, c.row, c.rowSpan) }
    // 朴素干货没有卡片视觉：把网格间隔让给文字，不同区块的文字自然靠近
    if (plain) {
      const g = Math.round(l.GAP / 2)
      r.x = Math.max(0, r.x - g)
      r.y = Math.max(0, r.y - g)
      r.w += g * 2
      r.h += g * 2
    }
    return r
  })
  const parts: string[] = [`<rect width="${l.W}" height="${l.H}" fill="${style.bg}"/>`]

  const isChrome = plan.pageType !== 'cover' && plan.pageType !== 'quote' && plan.pageType !== 'ending'
  if (isChrome && plan.kicker) parts.push(T(l.PAD, l.KICKER_Y, 12, plan.kicker, { fill: style.accent, weight: 600, ls: 2 }))
  if (isChrome) {
    if (plain) {
      parts.push(wordArt(l.PAD, l.TITLE_Y, l.TITLE_SIZE, plan.title, 5))
      parts.push(questionPerson(l.W - l.PAD, l.TITLE_Y - 4, 40))
    } else {
      parts.push(T(l.PAD, l.TITLE_Y, l.TITLE_SIZE, plan.title, { fill: style.fg, weight: 700 }))
    }
  }
  if (style.footer) {
    parts.push(T(l.PAD, l.FOOTER_Y, 10, `${ctx.topic} · SimplePPT`, { fill: style.muted }))
    parts.push(T(l.W - l.PAD, l.FOOTER_Y, 10, `${pad2(ctx.index)} / ${pad2(ctx.total)}`, { fill: style.muted, anchor: 'end' }))
  }

  if (plan.pageType === 'cover') parts.push(renderCover(plan, style, l))
  else if (plan.pageType === 'quote') parts.push(renderQuote(plan, style, l, ctx))
  else if (plan.pageType === 'ending') parts.push(renderEnding(plan, style, l))
  else for (const r of rects) parts.push(renderCard(r, style, l))

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${l.W}" height="${l.H}" viewBox="0 0 ${l.W} ${l.H}" font-family="${FONT}">${parts.join('\n')}</svg>`
}

/* ---------- 封面 / 金句 / 结尾 ---------- */

function renderCover(plan: PagePlan, style: SlideStyle, l: BentoLayout): string {
  const plain = isPlainStyle(style)
  const carded = style.carded === true
  const titleSize = plain ? 76 : 56
  const titleLines = wrapLines(plan.title, titleSize, l.W - l.PAD * 2 - 200, 2)
  const parts: string[] = []
  const kickerY = l.CONTENT_TOP + 30
  parts.push(T(l.PAD, kickerY, plain ? 15 : 13, plan.kicker || 'SIMPLEPPT', { fill: style.accent, weight: 600, ls: plain ? 2 : 3 }))
  if (plain) {
    parts.push(questionPerson(l.W - l.PAD, l.CONTENT_TOP + 60, 64))
  } else if (carded) {
    parts.push(`<rect x="${l.PAD}" y="${kickerY + 26}" width="64" height="6" rx="3" fill="${style.accent}"/>`)
    const cx = l.W - 228
    parts.push(`<circle cx="${cx}" cy="212" r="128" fill="none" stroke="${style.accent}" stroke-width="1.5" opacity="0.35"/>`)
    parts.push(`<circle cx="${cx}" cy="212" r="86" fill="none" stroke="${style.accent}" stroke-width="1.5" opacity="0.22"/>`)
    parts.push(`<rect x="${cx - 66}" y="428" width="148" height="148" rx="18" fill="${style.accentA}" stroke="${style.accent}" stroke-width="1"/>`)
  }
  let ty = kickerY + 92
  for (let i = 0; i < titleLines.length; i++) {
    if (plain) parts.push(wordArt(l.PAD, ty, titleSize, titleLines[i], 90 + i))
    else parts.push(T(l.PAD, ty, titleSize, titleLines[i], { fill: style.fg, weight: 700 }))
    ty += titleSize * 1.18
  }
  parts.push(T(l.PAD, ty + 18, plain ? 20 : 17, plan.message, { fill: style.muted }))
  if (carded) {
    parts.push(T(l.PAD, l.FOOTER_Y - 40, 13, plan.speakerNote || 'SimplePPT · 自动生成', { fill: style.muted }))
  }
  return parts.join('\n')
}

function renderQuote(plan: PagePlan, style: SlideStyle, l: BentoLayout, ctx: RenderCtx): string {
  const parts: string[] = []
  const cx = l.W / 2
  parts.push(T(cx, Math.round(l.H * 0.34), 90, '“', { fill: style.accent, weight: 700, anchor: 'middle' }))
  const lines = wrapLines(plan.message, 26, l.W - l.PAD * 2 - 120, 2)
  let ty = Math.round(l.H * 0.45)
  for (const line of lines) {
    if (isPlainStyle(style)) {
      const w = textWidth(line, 26)
      parts.push(`<rect x="${cx - w / 2 - 8}" y="${ty - 24}" width="${w + 16}" height="${26 * 1.25}" rx="3" fill="${style.highlight}" opacity="0.9"/>`)
    }
    parts.push(T(cx, ty, 26, line, { fill: style.fg, weight: 600, anchor: 'middle' }))
    ty += 44
  }
  parts.push(T(cx, Math.round(l.H * 0.63), 14, ctx.quoteAuthor ? `—— ${ctx.quoteAuthor}` : `—— ${plan.kicker || plan.speakerNote || ''}`, { fill: style.muted, anchor: 'middle' }))
  return parts.join('\n')
}

function renderEnding(plan: PagePlan, style: SlideStyle, l: BentoLayout): string {
  const cx = l.W / 2
  const parts: string[] = []
  const plain = isPlainStyle(style)
  const carded = style.carded === true
  if (carded) {
    parts.push(`<rect x="${cx - 32}" y="${Math.round(l.H * 0.42)}" width="64" height="6" rx="3" fill="${style.accent}"/>`)
    parts.push(`<circle cx="${Math.round(l.W * 0.16)}" cy="${Math.round(l.H * 0.72)}" r="90" fill="none" stroke="${style.accent}" stroke-width="1.5" opacity="0.25"/>`)
    parts.push(`<rect x="${Math.round(l.W * 0.83)}" y="${Math.round(l.H * 0.25)}" width="120" height="120" rx="18" fill="${style.accentA}" stroke="${style.accent}" stroke-width="1"/>`)
  }
  if (plain) {
    parts.push(wordArt(cx, Math.round(l.H * 0.52), 44, plan.message, 7, 'middle'))
  } else {
    parts.push(T(cx, Math.round(l.H * 0.52), 46, plan.message, { fill: style.fg, weight: 700, anchor: 'middle' }))
  }
  const sub = asArray(plan.cards[0]?.content).join(' · ') || plan.speakerNote || ''
  if (sub) parts.push(T(cx, Math.round(l.H * 0.52) + 48, 16, sub, { fill: style.muted, anchor: 'middle' }))
  return parts.join('\n')
}

/* ---------- 卡片 ---------- */

function renderCard(r: { x: number; y: number; w: number; h: number } & Record<string, any>, style: SlideStyle, l: BentoLayout): string {
  const plain = isPlainStyle(style)
  const carded = style.carded === true
  const p = plain ? 6 : carded ? 24 : 18
  const x = r.x + p
  const w = r.w - p * 2
  const parts: string[] = []
  const bodyFill = plain ? style.fg : style.muted
  const titleSize = plain ? 30 : 20
  let cy = r.y + (plain ? 24 : 42)

  if (plain) {
    if (r.accent) {
      // 焦点区块：黄色荧光笔打在标题上
      const tw = textWidth(r.title ?? '', titleSize)
      parts.push(`<rect x="${jx(x, 3) - 4}" y="${jy(cy, 3) - titleSize + 4}" width="${tw + 8}" height="${titleSize * 1.25}" rx="2" fill="${style.highlight}" opacity="0.9"/>`)
      parts.push(T(x, cy, jsize(titleSize, 3), r.title ?? '', { fill: style.accent, weight: 700 }))
    } else if (r.title) {
      parts.push(T(x, cy, jsize(titleSize, 4), r.title, { fill: style.fg, weight: 700 }))
    }
  } else if (carded) {
    parts.push(
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${style.radius}" fill="${r.accent ? style.accentA : style.card}" stroke="${
        r.accent ? style.accent : style.border
      }" stroke-width="${r.accent ? 1.2 : 1}"/>`,
    )
    if (r.title) parts.push(T(x, cy, 20, r.title, { fill: style.fg, weight: 600 }))
  } else if (r.title) {
    // Bento 卡片关闭：不画容器底，文字仍按网格位置正常排版（不带朴素干货效果）
    parts.push(T(x, cy, 20, r.title, { fill: style.fg, weight: 600 }))
  }

  const bodyTop = r.title ? cy + (plain ? 40 : 32) : cy
  switch (r.kind) {
    case 'stat': {
      const num = String(Array.isArray(r.content) ? r.content[0] : r.content ?? '')
      const numBase = plain ? 76 : 60
      const numSize = Math.min(numBase, w / Math.max(3, textWidth(num, numBase) / numBase) * 1.1)
      if (plain) {
        const nc = jx(x + numSize * 0.5, 21)
        const ny = jy(bodyTop + 46, 21)
        parts.push(redEllipse(nc, ny - numSize * 0.36, numSize * 0.6, numSize * 0.48))
        parts.push(T(x, ny, numSize, num, { fill: style.accent, weight: 700 }))
      } else {
        parts.push(T(x, bodyTop + (plain ? 46 : 40), numSize, num, { fill: style.accent, weight: 700 }))
        if (r.title) parts.push(T(x, bodyTop + (plain ? 76 : 70), 12, r.title, { fill: style.muted }))
      }
      break
    }
    case 'bullets': {
      const items = asArray(r.content)
      const step = Math.min(42, (r.h - (bodyTop - r.y) - 18) / Math.max(1, items.length))
      items.forEach((it, j) => {
        const seed = 50 + j
        const ly = jy(bodyTop + (plain ? 22 : 26) + j * step, seed)
        if (plain) parts.push(`<rect x="${jx(x, seed)}" y="${ly - 10}" width="9" height="9" fill="${style.fg}"/>`)
        else parts.push(`<circle cx="${x + 4}" cy="${ly - 5}" r="3.5" fill="${style.accent}"/>`)
        const bs = jsize(plain ? 22 : 18, seed)
        const lines = wrapLines(it, bs, w - 24, Math.max(1, Math.floor(step / 29)))
        lines.forEach((ln, k) => parts.push(T(jx(x + (plain ? 22 : 18), seed + k), ly + k * (plain ? 30 : 25), bs, ln, { fill: bodyFill })))
      })
      break
    }
    case 'chart-bar': {
      const data: { label: string; value: number }[] = (r.data ?? []).slice(0, 6)
      if (data.length === 0) break
      const baseY = r.y + r.h - (style.footer ? 46 : 30)
      const chartX = x
      const chartW = w
      const slot = chartW / data.length
      const barW = Math.min(64, slot * 0.46)
      const maxV = Math.max(...data.map((d) => d.value)) || 1
      const maxH = Math.min(180, baseY - bodyTop - 40)
      parts.push(`<line x1="${x}" y1="${baseY}" x2="${x + chartW}" y2="${baseY}" stroke="${plain ? style.fg : style.border}" opacity="${plain ? 0.5 : 1}"/>`)
      data.forEach((d: { label: string; value: number }, i: number) => {
        const cxBar = chartX + slot * i + slot / 2
        const bh = Math.max(6, (d.value / maxV) * maxH)
        const barFill = plain ? (i === data.length - 1 ? style.accent : '#3A3A3A') : i === data.length - 1 ? style.accentDeep : style.accent
        parts.push(T(cxBar, baseY - bh - 10, jsize(plain ? 16 : 14, 60 + i), String(d.value), { fill: style.fg, anchor: 'middle' }))
        parts.push(`<rect x="${cxBar - barW / 2}" y="${baseY - bh}" width="${barW}" height="${bh}" rx="2" fill="${barFill}"/>`)
        parts.push(T(cxBar, baseY + 21, jsize(plain ? 14 : 12, 70 + i), d.label, { fill: style.muted, anchor: 'middle' }))
      })
      if (r.title && !plain) parts.push(T(x, r.y + 30, jsize(16, 8), r.title, { fill: style.fg, weight: 600 }))
      break
    }
    case 'timeline': {
      const items = asArray(r.content)
      const lineY = r.y + r.h / 2
      parts.push(`<line x1="${x + 30}" y1="${lineY}" x2="${x + w - 30}" y2="${lineY}" stroke="${plain ? style.fg : style.accent}" opacity="${plain ? 0.45 : 0.8}" stroke-width="2"/>`)
      items.forEach((it, i) => {
        const [t, desc = ''] = String(it).split(/[:：]/)
        const cxNode = x + (w / Math.max(1, items.length)) * (i + 0.5)
        parts.push(T(cxNode, lineY - 44, jsize(plain ? 22 : 20, 90 + i), t, { fill: style.fg, weight: 600, anchor: 'middle' }))
        parts.push(`<circle cx="${cxNode}" cy="${lineY}" r="7" fill="${style.accent}"/>`)
        const ds = plain ? 17 : 15
        const lines = wrapLines(desc, ds, w / Math.max(1, items.length) - 12, 2)
        lines.forEach((ln, k) => parts.push(T(cxNode, lineY + 40 + k * (plain ? 30 : 26), jsize(ds, 100 + i + k), ln, { fill: style.muted, anchor: 'middle' })))
      })
      break
    }
    case 'highlight': {
      const line = Array.isArray(r.content) ? r.content.join(' ') : String(r.content ?? '')
      const hs = plain ? 30 : 26
      const lines = wrapLines(line, hs, w, 3)
      let ty = bodyTop + 38
      for (const ln of lines) {
        if (plain) {
          const tw = textWidth(ln, hs)
          parts.push(`<rect x="${jx(x, 110) - 5}" y="${jy(ty, 110) - hs + 5}" width="${tw + 10}" height="${hs * 1.25}" rx="2" fill="${style.highlight}" opacity="0.9"/>`)
        }
        parts.push(T(x, ty, jsize(hs, 110), ln, { fill: style.fg, weight: 600 }))
        ty += plain ? 50 : 42
      }
      break
    }
    default: {
      // text / compare / table / 其它 → 段落
      const body = Array.isArray(r.content) ? r.content.join('\n') : String(r.content ?? '')
      const lineH = plain ? 34 : 25
      const maxLines = Math.max(2, Math.floor((r.y + r.h - bodyTop - 16) / lineH) - (plain ? 0 : 0))
      let ty = bodyTop + (plain ? 24 : 22)
      let count = 0
      for (const para of body.split('\n')) {
        const bs = jsize(plain ? 22 : 18, 130 + count)
        for (const ln of wrapLines(para, bs, w, 8)) {
          if (count >= maxLines) break
          parts.push(T(jx(x, 130 + count), jy(ty, 130 + count), bs, ln, { fill: bodyFill }))
          ty += lineH
          count++
        }
      }
      break
    }
  }
  return parts.join('\n')
}
