import { gridRect, getLayout } from 'shared/bento'
import type { CanvasRatio, PagePlan } from 'shared/types'

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

/** 策划稿的版式示意图：按当前风格的画布比例把卡片矩形画成缩略图 */
export function BentoPreview({ plan, ratio }: { plan: PagePlan; ratio: CanvasRatio }) {
  const l = getLayout(ratio)
  const rects = plan.cards.map((c) => ({ ...c, ...gridRect(l, c.col, c.colSpan, c.row, c.rowSpan) }))
  return (
    <svg viewBox={`0 0 ${l.W} ${l.H}`} className="block w-full rounded-sm border border-border bg-muted/40">
      <rect x={l.PAD} y={l.CONTENT_TOP} width={l.W - l.PAD * 2} height={l.CONTENT_BOTTOM - l.CONTENT_TOP} fill="none" stroke="currentColor" className="text-border" strokeDasharray="6 8" opacity="0.7" />
      <text x={l.PAD + 4} y={l.KICKER_Y} fontSize="26" fill="currentColor" className="text-muted-foreground" opacity="0.7">
        {plan.kicker}
      </text>
      <text x={l.PAD + 4} y={l.TITLE_Y - 8} fontSize="40" fontWeight="700" fill="currentColor" className="text-foreground" opacity="0.35">
        {plan.title}
      </text>
      {rects.length === 0 && (
        <text x={l.W / 2} y={(l.CONTENT_TOP + l.CONTENT_BOTTOM) / 2} fontSize="30" textAnchor="middle" fill="currentColor" className="text-muted-foreground" opacity="0.7">
          {plan.pageType === 'quote' ? '金句 · 整页居中构图' : plan.pageType === 'cover' ? '封面 · 大字构图' : '结尾 · 居中构图'}
        </text>
      )}
      {rects.map((r, i) => (
        <g key={i}>
          <rect
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            rx="18"
            fill="var(--ppt-accent)"
            opacity={r.accent ? 0.22 : 0.09}
            stroke="var(--ppt-accent)"
            strokeOpacity={r.accent ? 0.8 : 0.3}
          />
          <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 8} textAnchor="middle" fontSize="26" fill="currentColor" className="text-foreground" opacity="0.7">
            {KIND_LABEL[r.kind] ?? r.kind}
          </text>
        </g>
      ))}
    </svg>
  )
}
