// 演示模式（Mock）：无需 API Key 即可走完六阶段流水线。
// 幻灯片由参数化渲染器按当前风格现场绘制，所以切换风格后演示内容也随之变化。
import type { InterviewQA, InterviewSummary, Outline, PagePlan, PageResearch, StickyPage } from 'shared/types'
import { enrichPlan } from 'shared/bento'
import type { SlideStyle } from 'shared/types'
import { renderSlide } from './slide-renderer'

export const MOCK_TOPIC = '智能助手在企业服务的落地路线'

export const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export const mockQuestions: InterviewQA[] = [
  {
    q: '这份 PPT 给谁看？',
    why: '决定信息密度与口吻：管理层要结论与钱，执行层要方法与细节。',
    suggestions: ['公司管理层（决策者）', '业务部门负责人', '技术团队'],
    a: '公司管理层（决策者）',
  },
  {
    q: '什么场合讲、讲多久？',
    why: '决定页数与节奏：15 分钟内部汇报约 10 页，每页一个结论。',
    suggestions: ['内部例会 · 15 分钟', '专题汇报 · 30 分钟', '全员宣讲 · 10 分钟'],
    a: '内部例会 · 15 分钟',
  },
  {
    q: '讲完后希望听众做什么？',
    why: '没有行动目标的大纲只是资料汇编；目标是金字塔的塔尖。',
    suggestions: ['批准试点预算', '成立专项小组', '先了解、不下决策'],
    a: '批准 Q4 试点预算（约 80 万）',
  },
  {
    q: '哪些内容必须覆盖？',
    why: '圈定范围，避免做成面面俱到的百科。',
    suggestions: ['痛点、路线、ROI', '案例与技术选型', '风险与合规'],
    a: '痛点、三步路线、可量化收益',
  },
  {
    q: '风格上有什么偏好或禁忌？',
    why: '决定版式与配色基调。',
    suggestions: ['克制、数据驱动', '视觉冲击优先', '活泼轻松'],
    a: '克制、数据驱动，少用大段文字',
  },
]

export const mockSummary: InterviewSummary = {
  audience: '公司管理层，关注投入产出与风险，对技术细节不敏感',
  goal: '批准 Q4 试点预算（约 80 万），并认可三步走路线图',
  scene: '内部例会汇报，15 分钟，10 页以内',
  scope: '必须覆盖：当前痛点、三步落地路线、可量化收益；不必展开技术选型',
  tone: '克制、数据驱动，每个判断都有数字或案例支撑',
  keyMessages: ['Agent 已跨过可用阈值，窗口期就是现在', '三步走 + 准入门禁，风险可控', '试点 90 天成本降 38%，建议 Q4 启动'],
  risks: ['演示数据为示意口径，正式汇报需替换为内部实测数据'],
}

export const mockBackground: import('shared/types').Background = {
  summary:
    '2025 年以来，大模型在长上下文、工具调用与多轮规划上的组合能力跨过可用阈值，Agent 从演示走向生产。客服、运维、研发效能是企业服务中落地最快的三个场景；头部企业已进入规模化部署阶段，行业讨论重心从「能不能用」转向「怎么管好用好」。',
  facts: [
    { text: '2025 年起，多模态 + 工具调用成为企业 Agent 的标配形态（演示数据）', source: null, confidence: 'medium' },
    { text: '客服与运维是 Agent 落地最快的两个场景，ROI 最先被验证（演示数据）', source: null, confidence: 'medium' },
    { text: '行业共识：人机协同（辅助 → 接管 → 自治）是最稳的演进路径（演示数据）', source: null, confidence: 'high' },
    { text: '数据安全与审计合规是企业采购 Agent 方案的第一决策因素（演示数据）', source: null, confidence: 'medium' },
    { text: '试点 90 天人力成本普遍可降两到四成，取决于场景复用度（演示数据，待核实）', source: null, confidence: 'low' },
  ],
  angles: ['从成本视角切入：降本增效的账怎么算', '从风险视角切入：为什么现在不该观望', '从组织视角切入：一线如何接受 Agent'],
  sources: [],
}

export const mockOutline: Outline = {
  coreMessage: '2026 年是 Agent 从试点走向生产的窗口期，建议按三步路线在 Q4 启动试点。',
  pages: [
    { id: 'p1', title: '智能助手企业服务落地路线', takeaway: '智能助手企业服务落地路线', group: '', role: 'cover', pageType: 'cover', keyPoints: ['管理层汇报', 'SimplePPT 演示'] },
    { id: 'p2', title: '今天讲三件事', takeaway: '先共识窗口期，再对齐路线，最后算清收益。', group: '', role: 'agenda', pageType: 'agenda', keyPoints: ['为什么是现在', '怎么落地', '值不值'] },
    { id: 'p3', title: 'Agent 已从演示走向生产', takeaway: '能力跨过可用阈值，Agent 第一次能在真实业务里端到端交付。', group: '为什么是现在', role: 'point', pageType: 'content', keyPoints: ['长上下文 + 工具调用成熟', '失败率降到可运营区间', '从“能不能用”到“怎么管好”'] },
    { id: 'p4', title: '试点数据验证了价值', takeaway: '试点 90 天，人工成本降 38%，满意度不降反升。', group: '为什么是现在', role: 'support', pageType: 'data', keyPoints: ['成本 -38%', '首响效率 3.2×', '满意度 +11pts'] },
    { id: 'p5', title: '三步走：辅助 → 接管 → 自治', takeaway: '渐进式路线让每一步都有数据验证，风险可控。', group: '怎么落地', role: 'point', pageType: 'content', keyPoints: ['Q3 辅助坐席', 'Q4 部分接管', 'H1 全自治闭环'] },
    { id: 'p6', title: '每一步都有准入门禁', takeaway: '不达标不升级，出问题一键回滚，风险被机制锁住。', group: '怎么落地', role: 'support', pageType: 'content', keyPoints: ['完成率 ≥ 90% 才升级', '成本单均低于人工 30%', '无 P0 事故、日志可回放'] },
    { id: 'p7', title: '一线的声音', takeaway: '试点团队从抵触到依赖，用了不到 30 天。', group: '', role: 'support', pageType: 'quote', keyPoints: [] },
    { id: 'p8', title: '建议：Q4 启动试点', takeaway: '预算 80 万、两个场景、90 天见效。', group: '', role: 'ending', pageType: 'ending', keyPoints: ['预算 ¥80 万', '首批 2 个场景', '90 天复盘'] },
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
    p1: mk('p1', '封面页无需检索资料。', []),
    p2: mk('p2', '目录页无需检索资料。', []),
    p3: mk('p3', '证明“能力已跨阈值”，用能力指标与部署面数据。', [
      ['长上下文 + 工具调用组合后，端到端任务完成率首次超过 90%（演示数据）', 'high'],
      ['行业讨论重心已从“能不能用”转向“怎么管好用好”（演示数据）', 'medium'],
      ['企业 Agent 采购决策中，安全与审计合规排第一位（演示数据）', 'medium'],
    ]),
    p4: mk('p4', '用试点 90 天的三组数据说明价值：成本、效率、满意度。', [
      ['试点 90 天人工坐席成本下降 38%，主要来自重复问询的自动处理（演示数据）', 'high'],
      ['夜间与高峰时段首响效率提升 3.2 倍（演示数据）', 'medium'],
      ['同卷 NPS 净增 11 个点，客户满意度不降反升（演示数据）', 'medium'],
    ]),
    p5: mk('p5', '说明三步走路线的节奏与各阶段形态。', [
      ['辅助 → 接管 → 自治的渐进路径是企业 Agent 落地的主流共识（演示数据）', 'high'],
      ['辅助阶段即可上线：自动草稿 + 人工审核，风险最低（演示数据）', 'medium'],
    ]),
    p6: mk('p6', '强调机制化风控：量化准入门禁与一键回滚。', [
      ['成熟团队普遍设置量化门禁：完成率、成本、事故率三项达标才扩大范围（演示数据）', 'medium'],
      ['灰度池隔离 + 日志全量可回放是审计合规的底线配置（演示数据）', 'high'],
    ]),
    p7: mk('p7', '一句来自一线的证言，增强可信度。', [], { text: '上线 90 天，人工成本降了三成，客户满意度反而涨了 11 个点。', author: '试点运营负责人（演示）' }),
    p8: mk('p8', '行动页无需检索，复用第 4、5 页结论。', []),
  }
}

export function mockPlans(): PagePlan[] {
  const plans: Omit<PagePlan, 'rects'>[] = [
    { pageId: 'p1', index: 1, title: '智能助手企业服务落地路线', kicker: 'SMART SERVICE BRIEF', message: '2026 年，从试点走向生产的三步走路线 · 管理层汇报', pageType: 'cover', speakerNote: 'SimplePPT · 演示数据 · 2026-09', cards: [] },
    {
      pageId: 'p2', index: 2, title: '今天讲三件事', kicker: 'AGENDA', message: '先共识窗口期，再对齐路线，最后算清收益。', pageType: 'agenda', speakerNote: '一句话预告结论，降低听众的信息焦虑。',
      cards: [
        { col: 1, colSpan: 4, row: 1, rowSpan: 4, kind: 'bullets', title: '为什么是现在', content: ['Agent 已过可用阈值', '头部开始规模化', '内部工具链成熟'], accent: true },
        { col: 5, colSpan: 4, row: 1, rowSpan: 4, kind: 'bullets', title: '怎么落地', content: ['三步走路线', '每步有准入门禁', '90 天见成效'] },
        { col: 9, colSpan: 4, row: 1, rowSpan: 4, kind: 'bullets', title: '值不值', content: ['成本降 38%', '满意度 +11pts', '建议 Q4 启动'] },
      ],
    },
    {
      pageId: 'p3', index: 3, title: 'Agent 已从演示走向生产', kicker: '为什么是现在', message: '能力跨过可用阈值，Agent 第一次能在真实业务里端到端交付。', pageType: 'content', speakerNote: '强调“第一次”：不是参数更好看，而是失败率可运营。',
      cards: [
        { col: 1, colSpan: 7, row: 1, rowSpan: 4, kind: 'text', title: '大模型能力跨过可用阈值', content: '2025 年起，长上下文、工具调用与多轮规划的组合，让 Agent 第一次能在真实业务里稳定完成端到端任务。失败率降到可运营区间，“能不能用”变成了“怎么管好用好”。\n试点端到端任务完成率：90%+', accent: true },
        { col: 8, colSpan: 5, row: 1, rowSpan: 2, kind: 'text', title: '头部企业已规模化部署', content: '客服、运维、研发效能三个场景先行，Agent 成为标准配置。' },
        { col: 8, colSpan: 5, row: 3, rowSpan: 2, kind: 'text', title: '内部工具链已经成熟', content: '权限、审计、评测框架齐备，缺的只是场景选择与运营方法。' },
      ],
    },
    {
      pageId: 'p4', index: 4, title: '试点数据验证了价值', kicker: '为什么是现在', message: '试点 90 天，人工成本降 38%，满意度不降反升。', pageType: 'data', speakerNote: '成本下降来自自动处理重复问询，不是裁人；口径在附录。',
      cards: [
        { col: 1, colSpan: 4, row: 1, rowSpan: 1, kind: 'stat', content: '-38%', title: '人工坐席成本（90 天）' },
        { col: 5, colSpan: 4, row: 1, rowSpan: 1, kind: 'stat', content: '3.2×', title: '首响效率提升' },
        { col: 9, colSpan: 4, row: 1, rowSpan: 1, kind: 'stat', content: '+11pts', title: '客户满意度 NPS 净增' },
        { col: 1, colSpan: 8, row: 2, rowSpan: 3, kind: 'chart-bar', title: '处理一单的平均耗时（分钟）', content: '', data: [{ label: '接手前', value: 9.2 }, { label: '第 2 周', value: 7.4 }, { label: '第 4 周', value: 6.1 }, { label: '第 8 周', value: 4.6 }, { label: '第 12 周', value: 3.4 }] },
        { col: 9, colSpan: 4, row: 2, rowSpan: 3, kind: 'text', title: '怎么读这组数据', content: '成本下降主要来自重复问询的自动处理，而非裁撤坐席；效率提升集中在夜间与高峰时段。演示数据仅作示意。', accent: true },
      ],
    },
    {
      pageId: 'p5', index: 5, title: '三步走：辅助 → 接管 → 自治', kicker: '怎么落地', message: '渐进式路线让每一步都有数据验证，风险可控。', pageType: 'content', speakerNote: '每一步都是上一验证通过的产物，不存在跳跃。',
      cards: [
        { col: 1, colSpan: 12, row: 1, rowSpan: 2, kind: 'timeline', content: ['Q3:自动草稿 + 人工审核', 'Q4:标准问题自动处理', 'H1:端到端 + 主动服务'], accent: true },
        { col: 1, colSpan: 4, row: 3, rowSpan: 2, kind: 'bullets', title: 'Q3 · 辅助坐席', content: ['高频问题库 + 话术推荐', '人机协同评分上线'] },
        { col: 5, colSpan: 4, row: 3, rowSpan: 2, kind: 'bullets', title: 'Q4 · 部分接管', content: ['一类业务全流程自动', '失败自动降级人工'] },
        { col: 9, colSpan: 4, row: 3, rowSpan: 2, kind: 'bullets', title: 'H1 · 全自治闭环', content: ['主动触达与回访', '目标成本再降 20%'] },
      ],
    },
    {
      pageId: 'p6', index: 6, title: '每一步都有准入门禁', kicker: '怎么落地', message: '不达标不升级，出问题一键回滚，风险被机制锁住。', pageType: 'content', speakerNote: '这是给管理层的定心丸：升级是数据驱动的。',
      cards: [
        { col: 1, colSpan: 7, row: 1, rowSpan: 4, kind: 'bullets', title: '升级到下一步的门槛', content: ['试点场景任务完成率 ≥ 90%，连续 4 周', '人工修正率持续下降', '成本单均低于人工基线 30% 以上', '无 P0 事故，审计日志全量可回放'], accent: true },
        { col: 8, colSpan: 5, row: 1, rowSpan: 2, kind: 'text', title: '风险与回滚', content: '灰度池隔离，一键切回人工；敏感场景白名单制。' },
        { col: 8, colSpan: 5, row: 3, rowSpan: 2, kind: 'text', title: '度量口径', content: '成本按单均全成本核算；满意度用同卷 NPS 对比。' },
      ],
    },
    { pageId: 'p7', index: 7, title: '一线的声音', kicker: '来自试点', message: '上线 90 天，人工成本降了三成，客户满意度反而涨了 11 个点。', pageType: 'quote', speakerNote: '试点运营负责人（演示）', cards: [] },
    { pageId: 'p8', index: 8, title: '建议：Q4 启动试点', kicker: '行动', message: '建议：Q4 启动试点', pageType: 'ending', speakerNote: '预算 ¥80 万 · 首批 2 个场景 · 90 天见效', cards: [{ col: 1, colSpan: 12, row: 1, rowSpan: 1, kind: 'highlight', content: '' }] },
  ]
  // enrichPlan 需要 ratio；渲染器会按当前风格重算，这里给默认比例以满足类型
  return plans.map((p) => enrichPlan(p as PagePlan, '16:9'))
}

export function renderMockSlide(plan: PagePlan, style: SlideStyle, quoteAuthor?: string): string {
  return renderSlide(plan, style, { index: plan.index, total: 8, topic: '智能助手落地路线', quoteAuthor })
}

/** Mock 的大纲整体重生成：演示用，把建议摘要附加到塔尖结论上以示生效 */
export function mockOutlineRegen(feedback: string): Outline {
  const o: Outline = JSON.parse(JSON.stringify(mockOutline))
  o.coreMessage = `${o.coreMessage}（已按建议调整：${feedback.slice(0, 24)}…）`
  return o
}

/** Mock 的单页重写：演示用，按建议做一个朴素但可见的修改 */
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
