// SimplePPT API 门面：所有生成能力都在浏览器本地引擎里执行，不再发 HTTP 请求。
import { engine } from '../engine'
import type {
  Settings,
  StickyPage,
  PageResearch,
  PagePlan,
  SlideStyle,
  ReferenceFile,
  Background,
  InterviewSummary,
  Fact,
  Quote,
  Outline,
} from 'shared/types'

export interface Degraded {
  degraded: string | null
}

export interface SearchRefs {
  searchSources?: { title?: string; url: string }[]
  searchProvider?: string | null
}

type QItem = { q: string; why?: string; suggestions?: string[] }

export const api = {
  questions: (s: Settings, topic: string): Promise<{ questions: QItem[] } & Degraded> =>
    engine.interviewQuestions(s, topic) as Promise<{ questions: QItem[] } & Degraded>,

  background: (
    s: Settings,
    topic: string,
    references: ReferenceFile[],
  ): Promise<{ background: Background } & Degraded & SearchRefs> => engine.background(s, topic, references),

  summary: (
    s: Settings,
    topic: string,
    qas: { q: string; a: string }[],
    background: Background | null,
  ): Promise<{ summary: InterviewSummary } & Degraded> => engine.interviewSummary(s, topic, qas, background),

  outline: (
    s: Settings,
    payload: {
      topic: string
      summary: InterviewSummary | null
      background: Background | null
      references: ReferenceFile[]
      feedback?: string
      pageCount?: number
    },
  ): Promise<{ outline: Outline } & Degraded> => engine.outline(s, payload),

  rewritePage: (
    s: Settings,
    payload: {
      page: StickyPage
      index: number
      total: number
      coreMessage: string
      summary: InterviewSummary | null
      advice: string
    },
  ): Promise<{ page: StickyPage } & Degraded> => engine.outlineRewrite(s, payload),

  researchPage: (
    s: Settings,
    page: StickyPage,
    index: number,
    total: number,
    coreMessage: string,
    references: ReferenceFile[],
  ): Promise<{ research: PageResearch } & Degraded & SearchRefs> =>
    engine.researchPage(s, page, index, total, coreMessage, references).then((r) => ({
      research: r.research as unknown as PageResearch,
      searchSources: r.searchSources,
      searchProvider: r.searchProvider,
      degraded: r.degraded,
    })),

  planPage: (
    s: Settings,
    payload: {
      page: StickyPage
      index: number
      total: number
      coreMessage: string
      research: { facts: Fact[]; quote: Quote | null }
      references: ReferenceFile[]
      advice?: string
    },
  ): Promise<{ plan: PagePlan } & Degraded> => engine.planPage(s, payload),

  slidePage: (
    s: Settings,
    payload: {
      topic: string
      plan: PagePlan
      total: number
      coreMessage: string
      prevTitle?: string
      nextTitle?: string
      style: SlideStyle
      research: { facts: Fact[]; quote: Quote | null }
      advice?: string
    },
  ): Promise<{ svg: string; attempts: number } & Degraded> => engine.slidePage(s, payload),

  ping: (s: Settings): Promise<{ ok: boolean; reply: string } & Degraded> => engine.ping(s),
}

/** 有限并发地顺序映射（保持结果顺序） */
export async function pMap<T, R>(items: T[], fn: (item: T, index: number) => Promise<R>, limit = 3): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return results
}
