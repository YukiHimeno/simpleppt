// OpenAI Responses 格式 API 的最小客户端（服务端代理用）。
// 兼容任何实现 POST {base}/responses 的网关；对不支持的参数做渐进降级。
import { proxyRequest } from '../lib/proxy'

export interface LlmSettings {
  baseUrl: string
  apiKey: string
  model: string
  webSearch?: boolean
}

export interface LlmCall {
  instructions: string
  user: string
  history?: { role: 'user' | 'assistant'; text: string }[]
  json?: boolean
  maxTokens?: number
  search?: boolean
}

export interface LlmResult {
  text: string
  sources: { title?: string; url: string }[]
  degraded: string | null
}

function normalizeBase(baseUrl: string): string {
  let base = (baseUrl || 'https://api.openai.com/v1').trim().replace(/\/+$/, '')
  if (!/\/v\d+$/.test(base) && /api\.openai\.com$/.test(base)) base += '/v1'
  return base
}

interface BodyOpts {
  json?: boolean
  maxTokens?: number
  search?: boolean
}

function buildBody(s: LlmSettings, call: LlmCall, opts: BodyOpts) {
  const input = [
    ...(call.history ?? []).map((h) => ({
      role: h.role,
      content: [{ type: h.role === 'assistant' ? 'output_text' : 'input_text', text: h.text }],
    })),
    { role: 'user', content: [{ type: 'input_text', text: call.user }] },
  ]
  const body: Record<string, unknown> = {
    model: s.model,
    instructions: call.instructions,
    input,
    stream: false,
  }
  if (opts.json) body.text = { format: { type: 'json_object' } }
  if (opts.maxTokens) body.max_output_tokens = opts.maxTokens
  if (opts.search && s.webSearch) body.tools = [{ type: 'web_search', search_context_size: 'medium' }]
  return body
}

async function rawCall(s: LlmSettings, call: LlmCall, opts: BodyOpts, timeoutMs: number) {
  const url = `${normalizeBase(s.baseUrl)}/responses`
  const res = await proxyRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${s.apiKey}`,
    },
    body: JSON.stringify(buildBody(s, call, opts)),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const j = await res.json()
      msg = j?.error?.message || j?.message || msg
    } catch {
      /* keep status text */
    }
    const err = new Error(msg) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return (await res.json()) as any
}

function extract(data: any): { text: string; sources: { title?: string; url: string }[] } {
  const sources: { title?: string; url: string }[] = []
  const seen = new Set<string>()
  let text = ''
  if (typeof data?.output_text === 'string' && data.output_text) {
    text = data.output_text
  }
  const items: any[] = Array.isArray(data?.output) ? data.output : []
  for (const item of items) {
    if (item?.type === 'message' && Array.isArray(item.content)) {
      for (const part of item.content) {
        if (part?.type === 'output_text' && typeof part.text === 'string') {
          text += (text ? '\n' : '') + part.text
          for (const a of Array.isArray(part.annotations) ? part.annotations : []) {
            if (a?.type === 'url_citation' && typeof a.url === 'string' && !seen.has(a.url)) {
              seen.add(a.url)
              sources.push({ title: a.title ?? undefined, url: a.url })
            }
          }
        }
      }
    }
  }
  return { text: text.trim(), sources }
}

// 按「渐进降级」顺序尝试：json 模式 → max tokens → web_search 工具，逐个摘除以兼容各类网关
export async function callLlm(s: LlmSettings, call: LlmCall, timeoutMs = 300_000): Promise<LlmResult> {
  if (!s.apiKey) throw new Error('未配置 API Key，请先在右上角「设置」中填写')
  if (!s.model) throw new Error('未配置模型名，请先在「设置」中填写（任何兼容 Responses 格式的模型）')

  const variants: BodyOpts[] = []
  const push = (o: BodyOpts) => variants.push(o)
  push({ json: call.json, maxTokens: call.maxTokens, search: call.search })
  if (call.search) push({ json: call.json, maxTokens: call.maxTokens, search: false })
  if (call.maxTokens) push({ json: call.json, maxTokens: undefined, search: call.search })
  if (call.json) push({ json: false, maxTokens: call.maxTokens, search: call.search })
  push({})

  let lastErr: Error | null = null
  for (let i = 0; i < variants.length; i++) {
    const opts = variants[i]
    try {
      const data = await rawCall(s, call, opts, timeoutMs)
      const { text, sources } = extract(data)
      if (!text) throw new Error('接口返回了空内容')
      const degraded =
        i === 0 ? null : [
          opts.search === false && call.search ? '接口不支持联网检索，已退化为模型知识' : null,
          opts.json === false && call.json ? '接口不支持 JSON 模式，已改为自由文本解析' : null,
          opts.maxTokens == null && call.maxTokens ? '接口不支持 max_output_tokens，已移除' : null,
        ].filter(Boolean).join('；') || null
      return { text, sources, degraded }
    } catch (e: any) {
      lastErr = e
      if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
        throw new Error(`接口响应超时（${Math.round(timeoutMs / 1000)}s）`)
      }
      // 网络错误 / 5xx / 鉴权错误不值得换参数重试
      if (!e?.status || e.status === 401 || e.status === 403 || e.status >= 500) throw e
      // 400 类：尝试下一个降级变体
    }
  }
  throw lastErr ?? new Error('接口调用失败')
}

export function parseJsonLoose(text: string): any {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  try {
    return JSON.parse(t)
  } catch {
    /* fallthrough */
  }
  const first = Math.min(...[t.indexOf('{'), t.indexOf('[')].filter((i) => i >= 0))
  if (Number.isFinite(first)) {
    const last = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'))
    if (last > first) {
      try {
        return JSON.parse(t.slice(first, last + 1))
      } catch {
        /* fallthrough */
      }
    }
  }
  throw new Error(`模型输出不是合法 JSON：${t.slice(0, 180)}…`)
}
