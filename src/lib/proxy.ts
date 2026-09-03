// 同源代理：浏览器无法直连的模型/搜索接口，统一走后端或 Pages Function 转发。
// 生产环境由 functions/api/proxy.ts 处理；本地开发由 vite.config.ts 中间件处理。
export async function proxyRequest(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = Object.fromEntries(new Headers(init.headers).entries())
  const res = await fetch('/api/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      method: init.method ?? 'GET',
      headers,
      body: typeof init.body === 'string' ? init.body : null,
    }),
    signal: init.signal,
  })
  const text = await res.text()
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'text/plain; charset=utf-8' },
  })
}
