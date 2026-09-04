// Demo mode (Mock): walk through the whole pipeline without an API key.
// Slides are drawn live by the parameterized renderer, so demo content
// changes shape when you switch styles.
// All sample text is fictional and written under the no-AI-tone rules:
// concrete numbers, small everyday topic, no filler or grand claims.
import type { InterviewQA, InterviewSummary, Outline, PagePlan, PageResearch, StickyPage } from 'shared/types'
import { enrichPlan } from 'shared/bento'
import { isPlainStyle, stylePreset, type SlideStyle } from 'shared/types'
import { plainMixedPages } from 'shared/plain-mix'
import { renderSlide } from './slide-renderer'

export const MOCK_TOPIC = '楼下面包店要不要上线外卖'

export const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export const mockQuestions: InterviewQA[] = [
  {
    q: '这份 PPT 给谁看？',
    why: '决定要多细，店主自己看就讲账，合伙人看还要讲风险。',
    suggestions: ['店主和合伙人', '就我自己', '帮家里拿主意的年轻人'],
    a: '店主和合伙人',
  },
  {
    q: '在什么场合讲、讲多久？',
    why: '决定页数和节奏，十五分钟的小会大约十页。',
    suggestions: ['晚饭后聊 · 15 分钟', '咖啡店小桌聊 · 10 分钟', '先自己过一遍'],
    a: '晚饭后和合伙人聊 · 15 分钟',
  },
  {
    q: '讲完希望做什么决定？',
    why: '没有行动的 PPT 只是资料，这次要拍板试跑。',
    suggestions: ['批准 6 周试跑，预算 ¥3000', '再调研一个月', '先只试 3 款面包'],
    a: '批准 6 周试跑，预算 ¥3000',
  },
  {
    q: '哪些事实必须摆上桌？',
    why: '圈住范围，别把一家小店算成公司级项目。',
    suggestions: ['周边需求和问卷', '单笔订单的成本账', '试跑节奏和退出条件'],
    a: '问卷结果、单笔账、试跑节奏',
  },
  {
    q: '风格上有什么偏好？',
    why: '决定版式和配色的底子。',
    suggestions: ['克制、讲数字', '活泼一点', '极简'],
    a: '克制、数字说话，不用大段形容词',
  },
]

export const mockSummary: InterviewSummary = {
  audience: '店主和合伙人，习惯看流水，不吃空概念',
  goal: '同意先跑 6 周，上 8 款常温面包做周边闪送，花 ¥3000，用真实订单决定要不要长期做',
  scene: '晚饭后小范围聊，15 分钟，10 页以内',
  scope: '必须覆盖周边需求、单笔账和试跑节奏，不展开平台后台怎么设置',
  tone: '克制、数字说话，每个判断都给本地数据或明确标演示',
  keyMessages: ['周边问卷 214 份，76% 愿意付配送费', '一单约 ¥34，扣平台费用后毛利 ¥9.6', '先跑 6 周，按门槛决定扩不扩'],
  risks: ['演示数据是示意口径，正式汇报前要换成店内实测'],
}

export const mockBackground: import('shared/types').Background = {
  summary:
    '青枫苑门口的面包店开了 6 年，主要做早上 7 点到 11 点的堂食和熟客打包，一天大约 150 单，傍晚常剩约 20 个面包要打折处理。店离地铁口 300 米，周边 3 公里有 4 个小区、1 家三甲医院、1 所小学，约 1.2 万户。最近半年，附近美团和闪购上的面包订单在涨，同行里已经有两家上线外卖。',
  facts: [
    { text: '问卷 214 份，76% 的人愿意为 30 分钟内送达付 6 元配送费（演示口径）', source: null, confidence: 'medium' },
    { text: '平台抽成与配送合计约占客单价的 18%（演示口径）', source: null, confidence: 'medium' },
    { text: '附近两家同行已上线外卖，月订单分别约 300 单和 450 单（演示口径，待核实）', source: null, confidence: 'low' },
    { text: '店里每天打烊前约有 20 个面包需要处理，正好是试跑的最小货源（演示口径）', source: null, confidence: 'medium' },
    { text: '周边写字楼下午 3 点后的下午茶订单增长最快（演示口径，待核实）', source: null, confidence: 'low' },
  ],
  angles: ['从需求切入，看周边到底有没有人买', '从账切入，算一单赚多少、多少单能回本', '从节奏切入，先跑 6 周再决定扩不扩'],
  sources: [],
}

export const mockOutline: Outline = {
  coreMessage: '先按 8 款常温面包加 3 公里闪送跑 6 周，用真实订单和单笔账决定要不要长期上线外卖。',
  pages: [
    { id: 'p1', title: '楼下面包店的外卖试跑', takeaway: '楼下面包店的外卖试跑', group: '', role: 'cover', pageType: 'cover', keyPoints: ['给店主和合伙人看', 'SimplePPT 演示'] },
    { id: 'p2', title: '今晚聊三件事', takeaway: '先看需求真不真，再算一单赚不赚，最后定怎么试跑。', group: '', role: 'agenda', pageType: 'agenda', keyPoints: ['需求真不真', '一单赚不赚', '怎么先试跑'] },
    { id: 'p3', title: '买的人就在周边 3 公里', takeaway: '问卷和同行单量都指向同一件事，附近的订单在起来。', group: '需求真不真', role: 'point', pageType: 'content', keyPoints: ['问卷 214 份，76% 愿付配送费', '业主群有人主动问', '下午茶涨得最快'] },
    { id: 'p4', title: '一单能赚多少', takeaway: '一单约 ¥34，平台费用约占 18%，单均毛利 ¥9.6。', group: '一单赚不赚', role: 'support', pageType: 'data', keyPoints: ['客单价 ¥34', '平台占比 18%', '单均毛利 ¥9.6'] },
    { id: 'p5', title: '试跑分三步走', takeaway: '每步有门槛，过了才加码，不过就停。', group: '怎么先试跑', role: 'point', pageType: 'content', keyPoints: ['第 1 周上 8 款常温面包', '第 3 周加自提', '第 5 周试套餐'] },
    { id: 'p6', title: '退出的门槛先写好', takeaway: '什么算成功、什么算失败，开跑前就说死。', group: '怎么先试跑', role: 'support', pageType: 'content', keyPoints: ['连续 2 周日均 ≥ 15 单', '单均毛利 ≥ ¥8', '处理的面包没变多'] },
    { id: 'p7', title: '业主群里一句话', takeaway: '早上送完孩子顺路来取，比跑店里快。', group: '', role: 'support', pageType: 'quote', keyPoints: [] },
    { id: 'p8', title: '先跑 6 周再决定', takeaway: '预算 ¥3000、8 款面包、6 周复盘。', group: '', role: 'ending', pageType: 'ending', keyPoints: ['预算 ¥3000', '8 款常温面包', '6 周复盘'] },
  ],
}

export function mockResearchMap(): Record<string, PageResearch> {
  const mk = (pageId: string, summary: string, facts: [string, 'high' | 'medium' | 'low'][], quote?: { text: string; author: string }): PageResearch => ({
    pageId,
    summary,
    facts: facts.map(([text, confidence]) => ({ text, source: null, confidence })),
    quote: quote ?? null,
    status: 'done',
  })
  return {
    p1: mk('p1', 'Cover page needs no research.', []),
    p2: mk('p2', 'Agenda page needs no research.', []),
    p3: mk('p3', 'Show the demand is real: survey counts plus what nearby shops are doing.', [
      ['青枫苑和枫林里业主群最近 30 天出现过 12 次“这家面包能送吗”（演示数据）', 'high'],
      ['问卷里 76% 愿意为 30 分钟内送达付 6 元配送费（演示数据）', 'medium'],
      ['周边两家同行已上线外卖，月单量在涨（演示数据，待核实）', 'medium'],
    ]),
    p4: mk('p4', 'Use the per-order account to explain what one order earns.', [
      ['一单客单价约 ¥34，平台抽成与配送合计约占 18%（演示口径）', 'high'],
      ['按 ¥9.6 的单均毛利，日均 15 单约等于一周覆盖基本成本（演示口径）', 'medium'],
      ['6 周试跑的日均订单从 8 单爬到 27 单（演示数据）', 'medium'],
    ]),
    p5: mk('p5', 'Explain the three-stage trial rhythm and what each stage adds.', [
      ['第 1 周只上卖得最好的 8 款常温面包，货损风险最小（演示口径）', 'high'],
      ['第 3 周加 11 点前自提，免配送费，正好接早高峰（演示口径）', 'medium'],
    ]),
    p6: mk('p6', 'Write down the go/no-go gates before starting.', [
      ['继续做下去的门槛是连续 2 周日均 ≥ 15 单、单均毛利 ≥ ¥8（演示口径）', 'medium'],
      ['差评 48 小时内处理，面包打烊前处理量不增加（演示口径）', 'high'],
    ]),
    p7: mk('p7', 'One sentence from a neighbor makes the case believable.', [], { text: '早上送完孩子顺路来取，比跑店里快。', author: '青枫苑业主 张女士（问卷原话）' }),
    p8: mk('p8', 'Action page reuses pages 4 and 5 conclusions, no research needed.', []),
  }
}

export function mockPlans(): PagePlan[] {
  const plans: Omit<PagePlan, 'rects'>[] = [
    { pageId: 'p1', index: 1, title: '楼下面包店的外卖试跑', kicker: '社区小店试跑计划', message: '先用 6 周、8 款面包、¥3000 预算，把要不要长期做这件事算清楚。', pageType: 'cover', speakerNote: 'SimplePPT 演示数据 · 一页讲清试跑计划', cards: [] },
    {
      pageId: 'p2', index: 2, title: '今晚聊三件事', kicker: 'AGENDA', message: '先看需求真不真，再算一单赚不赚，最后定怎么试跑。', pageType: 'agenda', speakerNote: '开头一句话预告结论，让听的人先放下手机。',
      cards: [
        { col: 1, colSpan: 4, row: 1, rowSpan: 4, kind: 'bullets', title: '需求真不真', content: ['问卷 214 份，76% 愿付配送费', '3 公里内 4 个小区和 1 家医院', '两家同行已上线，单量在涨'], accent: true },
        { col: 5, colSpan: 4, row: 1, rowSpan: 4, kind: 'bullets', title: '一单赚不赚', content: ['客单价约 ¥34', '平台费用约占 18%', '单均毛利 ¥9.6'] },
        { col: 9, colSpan: 4, row: 1, rowSpan: 4, kind: 'bullets', title: '怎么先试跑', content: ['8 款常温面包起跑', '6 周看 4 个门槛', '不达标就退'] },
      ],
    },
    {
      pageId: 'p3', index: 3, title: '买的人就在周边 3 公里', kicker: '需求真不真', message: '问卷和同行单量指向同一件事，附近的订单在起来。', pageType: 'content', speakerNote: '强调不是拍脑袋，问卷和业主群都给了信号。',
      cards: [
        { col: 1, colSpan: 7, row: 1, rowSpan: 4, kind: 'text', title: '问卷 214 份，76% 愿意等 30 分钟', content: '到店熟客问卷收回来 214 份，76% 愿意为 30 分钟内送达付 6 元配送费。最积极的是上班族和早上送孩子的家长，这两类人正好是店里早高峰的主力。\n愿意付配送费的人占 76%，日均需求估计在 25 到 35 单之间。', accent: true },
        { col: 8, colSpan: 5, row: 1, rowSpan: 2, kind: 'text', title: '业主群已经有人主动问', content: '青枫苑和对面枫林里的业主群，最近 30 天出现过 12 次“这家面包能送吗”。' },
        { col: 8, colSpan: 5, row: 3, rowSpan: 2, kind: 'text', title: '下午茶涨得最快', content: '周边写字楼下午 3 点后的需求增长最快，正好接在上午烘焙结束之后。' },
      ],
    },
    {
      pageId: 'p4', index: 4, title: '一单能赚多少', kicker: '一单赚不赚', message: '一单约 ¥34，平台费用约占 18%，单均毛利 ¥9.6。', pageType: 'data', speakerNote: '数字都是演示口径，正式汇报换成店内实测。',
      cards: [
        { col: 1, colSpan: 4, row: 1, rowSpan: 1, kind: 'stat', content: '¥34', title: '平均客单价' },
        { col: 5, colSpan: 4, row: 1, rowSpan: 1, kind: 'stat', content: '18%', title: '平台抽成与配送占比' },
        { col: 9, colSpan: 4, row: 1, rowSpan: 1, kind: 'stat', content: '¥9.6', title: '一单毛利（演示口径）' },
        { col: 1, colSpan: 8, row: 2, rowSpan: 3, kind: 'chart-bar', title: '6 周试跑的日均订单（单/天）', content: '', data: [{ label: '第 1 周', value: 8 }, { label: '第 2 周', value: 13 }, { label: '第 3 周', value: 18 }, { label: '第 4 周', value: 22 }, { label: '第 5 周', value: 25 }, { label: '第 6 周', value: 27 }] },
        { col: 9, colSpan: 4, row: 2, rowSpan: 3, kind: 'text', title: '怎么读这组数字', content: '日均到 15 单，按单均毛利 ¥9.6 算，一周就能覆盖试跑的基本成本。到 25 单，就值得认真扩品。演示口径，正式用店内实测。', accent: true },
      ],
    },
    {
      pageId: 'p5', index: 5, title: '试跑分三步走', kicker: '怎么先试跑', message: '每步有门槛，过了才加码，不过就停。', pageType: 'content', speakerNote: '每一步都只加一样东西，方便看出是哪一步带来变化。',
      cards: [
        { col: 1, colSpan: 12, row: 1, rowSpan: 2, kind: 'timeline', content: ['第 1 周 上 8 款常温面包', '第 3 周 加 11 点前自提', '第 5 周 试面包咖啡套餐'], accent: true },
        { col: 1, colSpan: 4, row: 3, rowSpan: 2, kind: 'bullets', title: '第 1 到 2 周 · 只上常温', content: ['卖得最好的 8 款先上', '平台新人期观察单量'] },
        { col: 5, colSpan: 4, row: 3, rowSpan: 2, kind: 'bullets', title: '第 3 到 4 周 · 加自提', content: ['11 点前下单、前台自提', '自提单免配送费'] },
        { col: 9, colSpan: 4, row: 3, rowSpan: 2, kind: 'bullets', title: '第 5 到 6 周 · 试套餐', content: ['面包加挂耳咖啡共 3 款', '按毛利门槛决定留哪款'] },
      ],
    },
    {
      pageId: 'p6', index: 6, title: '退出的门槛先写好', kicker: '怎么先试跑', message: '什么算成功、什么算失败，开跑前就说死。', pageType: 'content', speakerNote: '给合伙人吃的定心丸，加码和叫停都是数据说了算。',
      cards: [
        { col: 1, colSpan: 7, row: 1, rowSpan: 4, kind: 'bullets', title: '继续做下去的门槛', content: ['连续 2 周日均 ≥ 15 单', '单均毛利 ≥ ¥8', '打烊前处理的面包没变多', '差评 48 小时内处理完'], accent: true },
        { col: 8, colSpan: 5, row: 1, rowSpan: 2, kind: 'text', title: '什么情况叫停', content: '两周单量没到 8 单，或单均毛利长期低于 ¥8，就关掉平台，回店里做熟客。' },
        { col: 8, colSpan: 5, row: 3, rowSpan: 2, kind: 'text', title: '钱花在哪', content: '¥3000 预算主要是包装、平台保证金和 6 周的流量。花完这一轮，账也就清楚了。' },
      ],
    },
    { pageId: 'p7', index: 7, title: '业主群里一句话', kicker: '来自问卷', message: '早上送完孩子顺路来取，比跑店里快。', pageType: 'quote', speakerNote: '青枫苑业主 张女士（问卷原话）', cards: [] },
    { pageId: 'p8', index: 8, title: '先跑 6 周再决定', kicker: '行动', message: '先跑 6 周再决定', pageType: 'ending', speakerNote: '预算 ¥3000 · 8 款常温面包 · 3 公里闪送 · 6 周复盘', cards: [{ col: 1, colSpan: 12, row: 1, rowSpan: 1, kind: 'highlight', content: '' }] },
  ]
  // enrichPlan needs a ratio; the renderer recomputes for the current style,
  // so we only use 16:9 here to satisfy the type.
  return plans.map((p) => enrichPlan(p as PagePlan, '16:9'))
}

export function renderMockSlide(plan: PagePlan, style: SlideStyle, quoteAuthor?: string): string {
  const total = 8
  // In a plain/dry demo deck, a couple of pages look like they were copied
  // from another PPT, so draw them with a foreign style preset.
  let eff = style
  if (isPlainStyle(style)) {
    const mix = plainMixedPages(`${MOCK_TOPIC}|demo`, total)
    const hit = mix.find((m) => m.page === plan.index)
    if (hit) eff = { ...stylePreset(hit.styleId), ratio: style.ratio }
  }
  return renderSlide(plan, eff, { index: plan.index, total, topic: MOCK_TOPIC, quoteAuthor })
}

// Demo outline regeneration: append the feedback to the core message so the
// change is visible in the outline stage.
export function mockOutlineRegen(feedback: string): Outline {
  const o: Outline = JSON.parse(JSON.stringify(mockOutline))
  o.coreMessage = `${o.coreMessage}（已按建议调整，${feedback.slice(0, 24)}…）`
  return o
}

// Demo single-page rewrite: apply a small but visible edit based on the advice.
export function mockRewritePage(page: StickyPage, advice: string): StickyPage {
  const next: StickyPage = JSON.parse(JSON.stringify(page))
  const a = advice.trim()
  if (/删|去掉|移除|不要/.test(a)) {
    next.keyPoints = next.keyPoints.slice(0, Math.max(1, next.keyPoints.length - 1))
    next.takeaway = `${next.takeaway.replace(/（.*?）$/, '')}（已按要求精简）`
  } else {
    const point = a.replace(/^给?这页?[：:，,]?/, '').slice(0, 24) || '补充要点'
    next.keyPoints = [...next.keyPoints, point].slice(0, 5)
  }
  return next
}
