// AI 搜索引擎集成：Exa / Brave / Tavily。按配置顺序取第一个可用的；
// 检索结果作为上下文交给模型做综合（不依赖模型自带的联网工具）。
import { proxyRequest } from '../lib/proxy'

export interface SearchHit {
  title: string
  url: string
  snippet: string
}

export interface SearchKeys {
  exa?: string
  brave?: string
  tavily?: string
}

async function exaSearch(key: string, query: string, num: number): Promise<SearchHit[]> {
  const res = await proxyRequest('https://api.exa.ai/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key },
    body: JSON.stringify({ query, numResults: num, contents: { text: { maxCharacters: 600 } } }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`exa ${res.status}`)
  const j = await res.json()
  return (j?.results ?? []).map((r: any) => ({
    title: String(r.title ?? '').slice(0, 120),
    url: String(r.url ?? ''),
    snippet: String(r.text ?? r.summary ?? '').replace(/\s+/g, ' ').slice(0, 400),
  }))
}

async function braveSearch(key: string, query: string, num: number): Promise<SearchHit[]> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${num}`
  const res = await proxyRequest(url, {
    headers: { Accept: 'application/json', 'X-Subscription-Token': key },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`brave ${res.status}`)
  const j = await res.json()
  return (j?.web?.results ?? []).map((r: any) => ({
    title: String(r.title ?? '').slice(0, 120),
    url: String(r.url ?? ''),
    snippet: String(r.description ?? '').replace(/\s+/g, ' ').slice(0, 400),
  }))
}

async function tavilySearch(key: string, query: string, num: number): Promise<SearchHit[]> {
  const res = await proxyRequest('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: key, query, max_results: num, search_depth: 'basic' }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`tavily ${res.status}`)
  const j = await res.json()
  return (j?.results ?? []).map((r: any) => ({
    title: String(r.title ?? '').slice(0, 120),
    url: String(r.url ?? ''),
    snippet: String(r.content ?? '').replace(/\s+/g, ' ').slice(0, 400),
  }))
}

/** 依次尝试已配置的引擎，返回第一个成功的结果与引擎名 */
export async function searchWeb(keys: SearchKeys, query: string, num = 6): Promise<{ hits: SearchHit[]; provider: string } | null> {
  const attempts: [string, string, (k: string, q: string, n: number) => Promise<SearchHit[]>][] = [
    ['exa', keys.exa ?? '', exaSearch],
    ['brave', keys.brave ?? '', braveSearch],
    ['tavily', keys.tavily ?? '', tavilySearch],
  ]
  for (const [name, key, fn] of attempts) {
    if (!key.trim()) continue
    try {
      const hits = (await fn(key.trim(), query, num)).filter((h) => /^https?:\/\//.test(h.url))
      if (hits.length > 0) return { hits, provider: name }
    } catch {
      // 换下一个引擎
    }
  }
  return null
}

export function hitsToBlock(hits: SearchHit[]): string {
  return hits
    .map((h, i) => `[${i + 1}] ${h.title}\n${h.snippet}\n来源: ${h.url}`)
    .join('\n\n')
}

export function mergeHits(lists: SearchHit[][]): SearchHit[] {
  const seen = new Set<string>()
  const out: SearchHit[] = []
  for (const hits of lists) {
    for (const h of hits) {
      if (seen.has(h.url)) continue
      seen.add(h.url)
      out.push(h)
    }
  }
  return out.slice(0, 10)
}
