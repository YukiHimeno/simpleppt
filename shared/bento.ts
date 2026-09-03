// Bento Grid 版面引擎：把策划稿的 12×N 网格坐标换算成画布上的精确矩形。
// 画布尺寸随风格的比例（16:9 / 4:3）变化，所有常量通过 getLayout 取得。
import type { CanvasRatio, CardRect, PagePlan, PlanCard, SlideStyle } from './types'

export interface BentoLayout {
  W: number
  H: number
  PAD: number
  COLS: number
  ROWS: number
  GAP: number
  CONTENT_TOP: number
  CONTENT_BOTTOM: number
  COL_W: number
  ROW_H: number
  KICKER_Y: number
  TITLE_Y: number
  TITLE_SIZE: number
  FOOTER_Y: number
}

export function getLayout(ratio: CanvasRatio): BentoLayout {
  if (ratio === '4:3') {
    const W = 1024
    const H = 768
    const PAD = 52
    const COLS = 12
    const ROWS = 4
    const GAP = 14
    const CONTENT_TOP = 172
    const CONTENT_BOTTOM = 700
    return {
      W, H, PAD, COLS, ROWS, GAP, CONTENT_TOP, CONTENT_BOTTOM,
      COL_W: (W - PAD * 2 - (COLS - 1) * GAP) / COLS,
      ROW_H: (CONTENT_BOTTOM - CONTENT_TOP - (ROWS - 1) * GAP) / ROWS,
      KICKER_Y: 80,
      TITLE_Y: 124,
      TITLE_SIZE: 36,
      FOOTER_Y: 740,
    }
  }
  const W = 1280
  const H = 720
  const PAD = 56
  const COLS = 12
  const ROWS = 4
  const GAP = 16
  const CONTENT_TOP = 170
  const CONTENT_BOTTOM = 666
  return {
    W, H, PAD, COLS, ROWS, GAP, CONTENT_TOP, CONTENT_BOTTOM,
    COL_W: (W - PAD * 2 - (COLS - 1) * GAP) / COLS,
    ROW_H: (CONTENT_BOTTOM - CONTENT_TOP - (ROWS - 1) * GAP) / ROWS,
    KICKER_Y: 84,
    TITLE_Y: 128,
    TITLE_SIZE: 40,
    FOOTER_Y: 694,
  }
}

/** 旧版常量（16:9），保留给仅关心默认画布的调用方 */
export const PAGE_W = 1280
export const PAGE_H = 720

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, Math.round(Number.isFinite(v) ? v : lo)))

export function gridRect(l: BentoLayout, col: number, colSpan: number, row: number, rowSpan: number) {
  const c = clamp(col, 1, l.COLS)
  const r = clamp(row, 1, l.ROWS)
  const cs = clamp(colSpan, 1, l.COLS - c + 1)
  const rs = clamp(rowSpan, 1, l.ROWS - r + 1)
  return {
    x: Math.round(l.PAD + (c - 1) * (l.COL_W + l.GAP)),
    y: Math.round(l.CONTENT_TOP + (r - 1) * (l.ROW_H + l.GAP)),
    w: Math.round(cs * l.COL_W + (cs - 1) * l.GAP),
    h: Math.round(rs * l.ROW_H + (rs - 1) * l.GAP),
  }
}

export function enrichPlan(plan: PagePlan, ratio: CanvasRatio): PagePlan {
  const l = getLayout(ratio)
  const cards: PlanCard[] = Array.isArray(plan.cards) ? plan.cards : []
  const rects: CardRect[] = cards.map((c) => ({ ...c, ...gridRect(l, c.col, c.colSpan, c.row, c.rowSpan) }))
  return { ...plan, cards, rects }
}

export function styleOf(_s: SlideStyle) {
  return _s
}
