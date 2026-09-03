// SimplePPT 本地引擎：把原 Node 后端的编排逻辑搬到浏览器里直接运行。
// 不再需要 Express / 服务端代理；模型、检索、校验与公式渲染全部在前端完成。
import { callLlm, parseJsonLoose, type LlmSettings } from './llm'
import * as P from './prompts'
import { validateSvg } from './validate'
import { replaceFormulas } from './math'
import { searchWeb, hitsToBlock, mergeHits, type SearchHit } from './search'
import { getLayout, gridRect } from 'shared/bento'
import type { StickyPage, Fact, Quote, SlideStyle, Settings, ReferenceFile, Background } from 'shared/types'

const llmOf = (s: Settings): LlmSettings => ({ baseUrl: s.baseUrl, apiKey: s.apiKey, model: s.model, webSearch: s.webSearch })
const searchKeysOf = (s: Settings) => ({
  exa: s.searchExaKey,
  brave: s.searchBraveKey,
  tavily: s.searchTavilyKey,
})
const refsOf = (references: ReferenceFile[] | undefined | null): ReferenceFile[] =>
  (Array.isArray(references) ? references : []).slice(0, 8).map((f) => ({
    id: String(f?.id ?? ''),
    name: String(f?.name ?? 'file').slice(0, 80),
    chars: Number(f?.chars) || 0,
    text: String(f?.text ?? '').slice(0, 60000),
  }))

/** 搜索流水线：生成查询词 → 引擎检索 → 合并结果 */
async function gatherSearch(
  s: Settings,
  subject: string,
  references: ReferenceFile[],
  topic: string,
): Promise<{ block?: string; provider?: string; hits: SearchHit[] }> {
  const keys = searchKeysOf(s)
  if (!keys.exa && !keys.brave && !keys.tavily) return { hits: [] }
  let queries: string[] = []
  try {
    const r = await callLlm(llmOf(s), P.searchQueries(topic, subject, 3))
    queries = (parseJsonLoose(r.text)?.queries ?? []).map(String).slice(0, 3)
  } catch {
    /* 查询词生成失败就用主题直查 */
  }
  if (queries.length === 0) queries = [subject]
  const results = await Promise.all(queries.map((q) => searchWeb(keys, q, 6)))
  const hits = mergeHits(results.map((r) => r?.hits ?? []))
  const provider = results.find((r) => r)?.provider
  if (hits.length === 0) return { hits: [], provider }
  return { block: hitsToBlock(hits), provider, hits }
}

export const engine = {
  /** 设置面板的「测试连接」 */
  async ping(settings: Settings) {
    const r = await callLlm(llmOf(settings), {
      instructions: '你是连通性测试端点，只输出 JSON。',
      user: '请只输出 {"ok":true}',
      json: true,
      maxTokens: 2048,
    })
    return { ok: true, reply: r.text.slice(0, 60), degraded: r.degraded }
  },

  async interviewQuestions(settings: Settings, topic: string) {
    const r = await callLlm(llmOf(settings), P.interviewQuestions(topic))
    const questions = parseJsonLoose(r.text)?.questions ?? []
    return { questions, degraded: r.degraded }
  },

  async background(settings: Settings, topic: string, references: ReferenceFile[]) {
    const refs = refsOf(references)
    const extra = P.referencesBlock(refs, 12000)
    const search = await gatherSearch(settings, topic, refs, topic)
    const r = await callLlm(llmOf(settings), { ...P.backgroundResearch(topic, extra || undefined), search: !search.block })
    const b = parseJsonLoose(r.text)
    const background: Background = {
      summary: String(b?.summary ?? ''),
      facts: Array.isArray(b?.facts) ? b.facts.slice(0, 12) : [],
      angles: Array.isArray(b?.angles) ? b.angles.map(String).slice(0, 5) : [],
      sources: Array.isArray(b?.sources)
        ? b.sources.filter((x: any) => /^https?:\/\//.test(x?.url ?? '')).slice(0, 15)
        : [],
    }
    return {
      background,
      searchSources: search.hits.map((h) => ({ title: h.title, url: h.url })),
      searchProvider: search.provider ?? null,
      degraded: r.degraded,
    }
  },

  async interviewSummary(settings: Settings, topic: string, qas: { q: string; a: string }[], background: Background | null) {
    const r = await callLlm(llmOf(settings), P.interviewSummary(topic, qas, background))
    const s = parseJsonLoose(r.text)
    return {
      summary: {
        audience: String(s?.audience ?? ''),
        goal: String(s?.goal ?? ''),
        scene: String(s?.scene ?? ''),
        scope: String(s?.scope ?? ''),
        tone: String(s?.tone ?? ''),
        keyMessages: Array.isArray(s?.keyMessages) ? s.keyMessages.map(String) : [],
        risks: Array.isArray(s?.risks) ? s.risks.map(String) : [],
      },
      degraded: r.degraded,
    }
  },

  async outline(
    settings: Settings,
    input: {
      topic: string
      summary: any
      background: Background | null
      references: ReferenceFile[]
      feedback?: string
      pageCount?: number
    },
  ) {
    const r = await callLlm(
      llmOf(settings),
      P.outlineStage({
        topic: input.topic,
        summary: input.summary,
        background: input.background,
        references: refsOf(input.references),
        pageCount: input.pageCount,
        feedback: input.feedback,
      }),
    )
    return { outline: P.normalizeOutline(parseJsonLoose(r.text)), degraded: r.degraded }
  },

  async outlineRewrite(
    settings: Settings,
    input: { page: StickyPage; index: number; total: number; coreMessage: string; summary: any; advice: string },
  ) {
    const r = await callLlm(llmOf(settings), P.outlineRewrite(input))
    const o = parseJsonLoose(r.text)
    const normalized = P.normalizeOutline({ core_message: input.coreMessage, pages: [{ ...o, id: input.page.id }] })
    return { page: normalized.pages[0], degraded: r.degraded }
  },

  async researchPage(
    settings: Settings,
    page: StickyPage,
    index: number,
    total: number,
    coreMessage: string,
    references: ReferenceFile[],
  ) {
    const subject = `${page.title} ${page.keyPoints.join(' ')}`.trim()
    const search = await gatherSearch(settings, subject, refsOf(references), page.title)
    const r = await callLlm(llmOf(settings), {
      ...P.pageResearch({ page, index, total, coreMessage, audience: '', references: refsOf(references), searchBlock: search.block }),
      search: !search.block,
    })
    return {
      research: P.normalizeResearch(parseJsonLoose(r.text), page.id),
      searchSources: search.hits.map((h) => ({ title: h.title, url: h.url })),
      searchProvider: search.provider ?? null,
      degraded: r.degraded,
    }
  },

  async planPage(
    settings: Settings,
    input: {
      page: StickyPage
      index: number
      total: number
      coreMessage: string
      research: { facts: Fact[]; quote: Quote | null }
      references: ReferenceFile[]
      advice?: string
    },
  ) {
    const r = await callLlm(
      llmOf(settings),
      P.planStage({
        page: input.page,
        index: input.index,
        total: input.total,
        coreMessage: input.coreMessage,
        audience: '',
        researchFacts: input.research?.facts ?? [],
        quote: input.research?.quote ?? null,
        references: refsOf(input.references),
        advice: input.advice,
      }),
    )
    const plan = P.normalizePlan(parseJsonLoose(r.text), input.page.id, input.index, input.page.title, input.page.pageType)
    return { plan, degraded: r.degraded }
  },

  /** 整页 SVG：含校验 + 最多 3 次纠错重试 + 公式渲染 */
  async slidePage(
    settings: Settings,
    input: {
      topic: string
      plan: any
      total: number
      coreMessage: string
      prevTitle?: string
      nextTitle?: string
      style: SlideStyle
      research: { facts: Fact[]; quote: Quote | null }
      advice?: string
    },
  ) {
    const st: SlideStyle = input.style
    const plan = input.plan
    const page: StickyPage = {
      id: plan.pageId,
      title: plan.title,
      takeaway: plan.message,
      group: plan.kicker,
      role: 'support',
      pageType: plan.pageType,
      keyPoints: [],
    }
    const facts: Fact[] = input.research?.facts ?? []
    const quote: Quote | null = input.research?.quote ?? null
    const l = getLayout(st.ratio)
    const enriched = {
      ...plan,
      rects: (plan.cards ?? []).map((c: any) => ({ ...c, ...gridRect(l, c.col, c.colSpan, c.row, c.rowSpan) })),
    }
    const base = P.slideStage({
      topic: input.topic,
      index: plan.index,
      total: input.total ?? plan.index,
      coreMessage: input.coreMessage,
      prevTitle: input.prevTitle,
      nextTitle: input.nextTitle,
      plan: enriched,
      style: st,
      facts,
      quote,
      advice: input.advice,
    })

    let history: { role: 'user' | 'assistant'; text: string }[] = []
    let lastError = ''
    const maxAttempts = 3
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const call =
        attempt === 1
          ? { instructions: base.instructions, user: base.user }
          : {
              instructions: base.instructions,
              user: `你上一次的输出未通过校验：${lastError}\n请重新输出完整的、修复了该问题的 <svg>。仍然不要任何解释或围栏。`,
              history,
            }
      const r = await callLlm(llmOf(settings), { ...call, maxTokens: 20000 })
      const v = validateSvg(r.text, l.W, l.H)
      if (v.svg) {
        const svg = await replaceFormulas(v.svg, st.fg)
        return { svg, attempts: attempt, degraded: r.degraded }
      }
      lastError = v.error ?? '未知错误'
      history = [
        { role: 'user', text: base.user },
        { role: 'assistant', text: r.text.slice(0, 4000) },
        { role: 'user', text: `校验失败：${lastError}` },
      ]
    }
    throw new Error(`SVG 生成连续 ${maxAttempts} 次未通过校验：${lastError}`)
  },
}
