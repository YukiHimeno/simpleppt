// Cloudflare Pages Function：同源代理。
// 浏览器把「要代发的出站请求」POST 到这里，由本函数在服务端转发，
// 从而绕开模型/搜索接口对浏览器跨域的限制。

interface ProxyBody {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: string | null
}

export const onRequestPost: PagesFunction = async ({ request }) => {
  try {
    const payload = (await request.json()) as ProxyBody
    const target = new URL(payload.url)
    const local = target.hostname === 'localhost' || target.hostname === '127.0.0.1' || target.hostname === '[::1]'
    if (target.protocol !== 'https:' && !(target.protocol === 'http:' && local)) {
      return new Response(JSON.stringify({ error: '仅允许转发到 https 地址' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    }

    const headers = new Headers(payload.headers ?? {})
    if (payload.body) headers.set('Content-Type', headers.get('Content-Type') ?? 'application/json')

    const upstream = await fetch(target.toString(), {
      method: payload.method ?? 'GET',
      headers,
      body: payload.method && payload.method !== 'GET' && payload.method !== 'HEAD' ? (payload.body ?? null) : undefined,
      signal: AbortSignal.timeout(290_000),
    })
    const text = await upstream.text()
    return new Response(text, {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') ?? 'text/plain; charset=utf-8' },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    })
  }
}
