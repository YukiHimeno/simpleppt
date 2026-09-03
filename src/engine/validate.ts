// 生成 SVG 的服务端校验：AI 最常见的失败模式（围栏、未转义 &、foreignObject、
// 画布尺寸错）在这里拦下，把可自动修复的修掉，修不掉的报错触发重试。
import { XMLValidator } from 'fast-xml-parser'

export interface ValidateResult {
  svg?: string
  error?: string
}

export function validateSvg(raw: string, width: number, height: number): ValidateResult {
  let t = raw.trim().replace(/^```(?:xml|svg|html)?\s*/i, '').replace(/```\s*$/, '')

  const start = t.indexOf('<svg')
  const end = t.lastIndexOf('</svg>')
  if (start < 0 || end < 0) return { error: '输出中找不到 <svg>…</svg> 元素' }
  t = t.slice(start, end + 6)

  if (/foreignObject/i.test(t)) return { error: '包含被禁止的 <foreignObject>，文字必须用 <text>/<tspan> 呈现' }
  if (/<script/i.test(t)) return { error: '包含被禁止的 <script>' }
  if (/javascript\s*:/i.test(t)) return { error: '包含被禁止的 javascript: URL' }
  if (/(href|xlink:href)\s*=\s*["']https?:/i.test(t)) return { error: '包含被禁止的外部链接' }
  if (/url\(\s*http/i.test(t)) return { error: '包含被禁止的外部资源引用' }
  if (/@import|<image|@keyframes/i.test(t)) return { error: '包含被禁止的外部资源或动画' }

  if (!new RegExp(`viewBox\\s*=\\s*["']0\\s+0\\s+${width}\\s+${height}["']`).test(t)) {
    return { error: `缺少 viewBox="0 0 ${width} ${height}"` }
  }
  if (!/\swidth\s*=\s*["']/.test(t.match(/<svg[^>]*/)?.[0] ?? '')) {
    t = t.replace('<svg', `<svg width="${width}" height="${height}"`)
  }

  // 修复未转义的 & （XML 校验最常见的报错来源）
  t = t.replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;')

  const check = XMLValidator.validate(t, { allowBooleanAttributes: true })
  if (check !== true) {
    const msg = typeof check === 'object' && check?.err ? `${check.err.msg} @${check.err.line}:${check.err.col}` : 'XML 结构不合法'
    return { error: `SVG 不是合法 XML：${msg}` }
  }
  return { svg: t }
}
