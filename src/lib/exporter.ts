// 幻灯片导出：SVG → Canvas 位图（2×）→ pptxgenjs 逐页写入，讲者备注一并写入。
// 画布比例随风格（16:9 / 4:3）变化。
import PptxGenJS from 'pptxgenjs'
import type { CanvasRatio } from 'shared/types'

export const RATIO_SIZE: Record<CanvasRatio, { w: number; h: number; inches: { w: number; h: number } }> = {
  '16:9': { w: 1280, h: 720, inches: { w: 13.333, h: 7.5 } },
  '4:3': { w: 1024, h: 768, inches: { w: 10, h: 7.5 } },
}

export function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript\s*:/gi, '')
}

export async function svgToPngDataUrl(svg: string, ratio: CanvasRatio, scale = 2): Promise<string> {
  const size = RATIO_SIZE[ratio]
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('SVG 渲染失败（可能包含不被支持的内容）'))
      img.src = url
    })
    const w = size.w * scale
    const h = size.h * scale
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, w, h)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function exportPptx(
  slides: { svg: string; note?: string }[],
  title: string,
  ratio: CanvasRatio,
  onProgress?: (i: number, n: number) => void,
): Promise<Blob> {
  const size = RATIO_SIZE[ratio]
  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'SimplePPT', width: size.inches.w, height: size.inches.h })
  pptx.layout = 'SimplePPT'
  pptx.title = title
  pptx.author = 'SimplePPT'
  for (let i = 0; i < slides.length; i++) {
    onProgress?.(i, slides.length)
    const png = await svgToPngDataUrl(slides[i].svg, ratio, 2)
    const s = pptx.addSlide()
    s.addImage({ data: png, x: 0, y: 0, w: size.inches.w, h: size.inches.h })
    const note = slides[i].note
    if (note) s.addNotes(note)
  }
  onProgress?.(slides.length, slides.length)
  const out = (await pptx.write({ outputType: 'blob' })) as Blob
  return out
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function downloadText(text: string, name: string, mime = 'image/svg+xml') {
  downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), name)
}
