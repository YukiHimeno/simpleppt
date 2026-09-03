// 数学公式支持：把 AI 在 SVG 里写的 <text data-formula="LaTeX"> 占位元素，
// 用 MathJax 渲染成矢量路径后原位替换（嵌套 <svg>，基线对齐、按 font-size 缩放）。
// 浏览器里 mathjax-full 会尝试 `require` 读取版本号，这里预置 PACKAGE_VERSION 并延迟加载。

type DocLike = { convert: (latex: string, opts: Record<string, number>) => unknown }
type NodeLike = { innerHTML: (node: unknown) => string }

let ready: Promise<{ doc: DocLike; adaptor: NodeLike }> | null = null

async function ensureMathJax() {
  if (!ready) {
    ready = (async () => {
      ;(globalThis as Record<string, unknown>).PACKAGE_VERSION = '3.2.1'
      const [{ mathjax }, { TeX }, { SVG }, { liteAdaptor }, { RegisterHTMLHandler }, { AllPackages }] = await Promise.all([
        import('mathjax-full/js/mathjax.js'),
        import('mathjax-full/js/input/tex.js'),
        import('mathjax-full/js/output/svg.js'),
        import('mathjax-full/js/adaptors/liteAdaptor.js'),
        import('mathjax-full/js/handlers/html.js'),
        import('mathjax-full/js/input/tex/AllPackages.js'),
      ])
      const adaptor = liteAdaptor()
      RegisterHTMLHandler(adaptor)
      const texJax = new TeX({ packages: AllPackages.filter((p: string) => p !== 'bussproofs'), inline: true })
      const svgJax = new SVG({ fontCache: 'none' })
      const doc = mathjax.document('', { InputJax: texJax, OutputJax: svgJax })
      return { doc: doc as unknown as DocLike, adaptor: adaptor as unknown as NodeLike }
    })()
  }
  return ready
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&')
}

function renderLatex(mj: { doc: DocLike; adaptor: NodeLike }, latex: string, fontSize: number): { inner: string; vb: [number, number, number, number] } | null {
  try {
    const node = mj.doc.convert(latex, { em: fontSize, ex: fontSize / 2, containerWidth: 80 * fontSize })
    const html = mj.adaptor.innerHTML(node)
    const m = html.match(/<svg[^>]*viewBox="([^"]+)"[^>]*>([\s\S]*)<\/svg>/)
    if (!m) return null
    const vb = m[1].split(/[\s,]+/).map(Number) as [number, number, number, number]
    if (vb.length !== 4 || vb.some((n) => !Number.isFinite(n))) return null
    return { inner: m[2], vb }
  } catch {
    return null
  }
}

/** 把 SVG 中所有 data-formula 占位替换为渲染好的矢量公式；渲染失败的保留原文本 */
export async function replaceFormulas(svg: string, fallbackFill: string): Promise<string> {
  const re = /<text([^>]*?)data-formula="([^"]*)"([^>]*?)>([\s\S]*?)<\/text>/g
  const jobs: { token: string; replacement: string }[] = []
  for (const m of svg.matchAll(re)) {
    const [full, pre, latexAttr, post, content] = m
    const latex = decodeXml(latexAttr)
    const attrs = (pre + post).trim()
    const num = (name: string, def: number) => {
      const mm = attrs.match(new RegExp(`${name}="(-?[\\d.]+)"`))
      return mm ? parseFloat(mm[1]) : def
    }
    const x = num('x', 0)
    const y = num('y', 0)
    const fontSize = num('font-size', 24)
    const fill = attrs.match(/fill="([^"]+)"/)?.[1] ?? fallbackFill
    const mj = await ensureMathJax()
    const rendered = renderLatex(mj, latex, fontSize)
    if (!rendered) continue
    const [minX, minY, w, h] = rendered.vb
    const scale = fontSize / 1000 // MathJax viewBox 以 1000 = 1em 计
    const pxW = w * scale
    const pxH = h * scale
    // 基线对齐：viewBox 里 y=0 是基线，负值向上延伸
    const svgY = y + minY * scale
    const svgX = x - minX * scale
    const replacement =
      `<svg x="${svgX.toFixed(1)}" y="${svgY.toFixed(1)}" width="${pxW.toFixed(1)}" height="${pxH.toFixed(1)}" ` +
      `viewBox="${rendered.vb.join(' ')}" fill="${fill}" color="${fill}" overflow="visible">${rendered.inner}</svg>`
    jobs.push({ token: full, replacement })
  }
  let out = svg
  for (const j of jobs) out = out.replace(j.token, j.replacement)
  return out
}
