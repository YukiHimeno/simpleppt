import { useState } from 'react'
import { Check, Palette, RotateCcw } from 'lucide-react'
import { useApp } from '../lib/app-context'
import { renderSlide } from '../lib/slide-renderer'
import { sanitizeSvg } from '../lib/exporter'
import { MOCK_TOPIC, mockPlans } from '../lib/mock-data'
import { Badge, Button, Field, Label, cn } from './ui'
import { STYLE_PRESETS, isPlainStyle, type CanvasRatio, type SlideStyle } from 'shared/types'

const COLOR_FIELDS: { key: keyof SlideStyle; label: string }[] = [
  { key: 'bg', label: '背景' },
  { key: 'fg', label: '正文' },
  { key: 'muted', label: '次要' },
  { key: 'accent', label: '强调色' },
  { key: 'accentDeep', label: '强调深色' },
  { key: 'highlight', label: '荧光笔' },
  { key: 'card', label: '卡片' },
  { key: 'cardAlt', label: '卡片次色' },
]

/** Style workshop: pick a preset, tweak every token, and preview the same sample content live. */
export function StyleEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, setSettings } = useApp()
  const [draft, setDraft] = useState<SlideStyle>(settings.style)
  const [dirty, setDirty] = useState(false)
  if (!open) return null

  const set = <K extends keyof SlideStyle>(k: K, v: SlideStyle[K]) => {
    setDraft((d) => ({ ...d, [k]: v }))
    setDirty(true)
  }

  const applyPreset = (p: SlideStyle) => {
    setDraft({ ...p })
    setDirty(true)
  }

  const samplePlan = mockPlans()[3] // Data page: stat + chart + verdict, best for layout contrast.
  const previewSvg = renderSlide(samplePlan, draft, { index: 4, total: 8, topic: MOCK_TOPIC })

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-background">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold tracking-tight">风格工坊</h1>
            <Badge tone="outline">{isPlainStyle(draft) ? '朴素干货' : draft.carded ? 'Bento Grid' : '无卡片版式'} · {draft.ratio}</Badge>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setDraft(settings.style)
                setDirty(false)
              }}
            >
              <RotateCcw className="h-4 w-4" /> 还原
            </Button>
            <Button
              onClick={() => {
                setSettings({ ...settings, style: draft })
                setDirty(false)
                onClose()
              }}
            >
              {dirty && <Check className="h-4 w-4" />}保存并关闭
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]">
          {/* Left: presets + token editing */}
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>风格预设</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {STYLE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => applyPreset(p)}
                    className={cn(
                      'border p-3 text-left transition-colors hover:border-primary',
                      draft.id === p.id ? 'border-primary ring-1 ring-primary' : 'border-border',
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block h-3 w-3 border border-border" style={{ background: p.bg }} />
                      <span className="inline-block h-3 w-3" style={{ background: p.accent }} />
                      <span className="inline-block h-3 w-3" style={{ background: p.highlight }} />
                    </div>
                    <div className="mt-2 text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.plain ? '白底黑字 · 标红与荧光笔' : p.carded ? '卡片网格 · 留白层次' : '无卡片 · 直接排版'}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>画布比例</Label>
              <div className="flex gap-1">
                {(
                  [
                    ['16:9', '16:9 宽屏'],
                    ['4:3', '4:3 传统'],
                  ] as [CanvasRatio, string][]
                ).map(([r, label]) => (
                  <button
                    key={r}
                    onClick={() => set('ratio', r)}
                    className={cn('px-3 py-1.5 text-sm', draft.ratio === r ? 'bg-primary font-medium text-primary-foreground' : 'border border-border text-muted-foreground hover:bg-muted')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>配色令牌</Label>
              <div className="grid grid-cols-3 gap-2">
                {COLOR_FIELDS.map((f) => (
                  <label key={f.key} className="flex items-center gap-2 border border-border p-2">
                    <input
                      type="color"
                      value={String(draft[f.key])}
                      onChange={(e) => set(f.key, e.target.value as any)}
                      className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0"
                    />
                    <span className="text-xs text-muted-foreground">{f.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Field label={`卡片圆角：${draft.radius}px`}>
                <input
                  type="range"
                  min={0}
                  max={28}
                  value={draft.radius}
                  onChange={(e) => set('radius', Number(e.target.value))}
                  className="w-full accent-[var(--ppt-accent)]"
                />
              </Field>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm">Bento 卡片版式</div>
                  <p className="text-xs text-muted-foreground">关闭后只去掉卡片底色与圆角容器，字体配色与排版气质保持不变（不会变成朴素干货）。</p>
                </div>
                <button
                  onClick={() => set('carded', !draft.carded)}
                  className={cn('px-3 py-1.5 text-xs', draft.carded ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground')}
                >
                  {draft.carded ? '卡片开' : '卡片关'}
                </button>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm">页脚（主题名 + 页码）</div>
                <button
                  onClick={() => set('footer', !draft.footer)}
                  className={cn('px-3 py-1.5 text-xs', draft.footer ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground')}
                >
                  {draft.footer ? '显示' : '隐藏'}
                </button>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              保存后，生成幻灯片时会严格遵守这里的画布比例与配色令牌；演示模式会用同一套参数化渲染器现场绘制。
            </p>
          </div>

          {/* Right: live preview */}
          <div className="space-y-3">
            <Label>实时预览（示例数据页）</Label>
            <div className="border border-border bg-card p-2 shadow-xl">
              <div
                className="w-full [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
                style={{ aspectRatio: draft.ratio === '4:3' ? '4 / 3' : '16 / 9' }}
                dangerouslySetInnerHTML={{ __html: sanitizeSvg(previewSvg) }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
