import { useState } from 'react'
import { ClipboardList, LayoutGrid, MessagesSquare, Palette, Play, Presentation, Search, Sparkles, StickyNote, type LucideIcon } from 'lucide-react'
import { useApp } from '../lib/app-context'
import { emptyProject } from '../lib/store'
import { mockPlans, renderMockSlide } from '../lib/mock-data'
import { sanitizeSvg } from '../lib/exporter'
import { SlideSvg } from './SlideStage'
import { Logo } from './Logo'
import { Badge, Button, Card, Textarea, useToast } from './ui'

/** Windows 10 磁贴风格的方法卡片：同一功能在首页、顶栏、阶段页头共用同一图标。 */
const TILES: { icon: LucideIcon; title: string; desc: string; bg: string; fg: string }[] = [
  { icon: MessagesSquare, title: '先问后做', desc: '访谈受众、目的与场合，同步检索背景资料', bg: '#0078D7', fg: '#ffffff' },
  { icon: StickyNote, title: '便利贴大纲', desc: '金字塔原理：结论先行，逐页一张便利贴', bg: '#FFB900', fg: '#3b2e00' },
  { icon: Search, title: '真实资料', desc: '每页主题交给联网检索，数字带出处', bg: '#10893E', fg: '#ffffff' },
  { icon: ClipboardList, title: '策划稿', desc: '先确认内容与版式关系，再进入视觉设计', bg: '#744DA9', fg: '#ffffff' },
  { icon: LayoutGrid, title: '便当网格', desc: 'Bento Grid 卡片层级：重要的大、次要的小', bg: '#0099BC', fg: '#ffffff' },
  { icon: Presentation, title: '整页 SVG', desc: '直接画整页，浏览器即渲染器', bg: '#D24726', fg: '#ffffff' },
]

const EXAMPLES = ['Q3 产品发布宣讲', '智能体落地路线汇报', '新人培训：代码规范', '行业研究：低空经济']

export function Home() {
  const { project, patch, settings, setSettings, go, openSettings, openStyle } = useApp()
  const { notify } = useToast()
  const [topic, setTopic] = useState('')
  const heroSvg = renderMockSlide(mockPlans()[0], settings.style)

  const canResume = !!(project.topic && project.stage !== 'home')

  function start(mock: boolean) {
    const t = topic.trim()
    if (!t) {
      notify('先写一个主题吧', 'error')
      return
    }
    let s = settings
    if (mock) {
      s = { ...settings, mock: true }
      setSettings(s)
    }
    if (!s.mock && !s.apiKey) {
      notify('请先在「设置」里配置 API Key，或直接开演示模式', 'error')
      openSettings('api')
      return
    }
    patch(() => ({ ...emptyProject(t), stage: 'interview' }))
  }

  return (
    <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 px-4 pb-28 pt-12 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="animate-fade-up space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Logo size={26} />
          <span className="text-lg font-bold tracking-tight">SimplePPT</span>
        </div>

        {canResume && (
          <Card className="flex items-center justify-between gap-3 border-primary/40 bg-card p-3">
            <div className="min-w-0 text-xs text-muted-foreground">
              <span className="mr-1 text-foreground">有进行中的项目：</span>
              <span className="truncate">{project.topic}</span>
            </div>
            <Button size="sm" variant="secondary" onClick={() => go(project.stage)}>
              继续
            </Button>
          </Card>
        )}

        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          先问清楚，
          <br />
          再动手做 PPT
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          SimplePPT 不套模板：先访谈与调研，用便利贴规划结构，逐页检索真实资料，写好页面策划稿，再按 Bento Grid
          直接生成整页 SVG——每一步都看得见、可修改。
        </p>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TILES.map((t, i) => (
            <div
              key={t.title}
              className="flex min-h-[124px] flex-col justify-between p-3 shadow-sm transition-transform hover:-translate-y-0.5"
              style={{ backgroundColor: t.bg, color: t.fg }}
            >
              <div className="flex items-start justify-between">
                <t.icon className="h-6 w-6" strokeWidth={2} />
                <span className="text-[10px] font-bold tracking-widest opacity-70">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <div>
                <div className="text-[15px] font-bold leading-tight">{t.title}</div>
                <div className="mt-1 text-[11px] leading-snug opacity-85">{t.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="你想做什么主题的 PPT？例如：Q4 营销计划汇报，受众是管理层，目标是批准预算…"
            className="min-h-[88px] bg-card"
          />
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((x) => (
              <button
                key={x}
                onClick={() => setTopic(x)}
                className="border border-border bg-card px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
              >
                {x}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={() => start(false)}>
            <Sparkles className="h-4 w-4" />
            开始生成
          </Button>
          <Button size="lg" variant="secondary" onClick={() => start(true)}>
            <Play className="h-4 w-4" />
            演示模式
          </Button>
          <span className="text-xs text-muted-foreground">演示模式无需 API Key，走模拟完全流程</span>
        </div>
      </div>

      <div className="animate-fade-up space-y-3 [animation-delay:120ms]">
        <div className="border border-border bg-card p-2 shadow-2xl">
          <div
            style={{ aspectRatio: settings.style.ratio === '4:3' ? '4 / 3' : '16 / 9' }}
            className="[&>svg]:block [&>svg]:h-auto [&>svg]:w-full [&>svg]:overflow-hidden"
            dangerouslySetInnerHTML={{ __html: sanitizeSvg(heroSvg) }}
          />
        </div>
        <p className="text-center text-xs text-muted-foreground">
          ↑ 当前风格（{settings.style.name}）下的整页 SVG 幻灯片 ·{' '}
          <button className="text-primary hover:underline" onClick={openStyle}>
            <Palette className="mr-0.5 inline h-3 w-3" />
            打开风格工坊
          </button>
        </p>
      </div>
    </div>
  )
}
