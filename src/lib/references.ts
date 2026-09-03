// 访谈阶段上传的参考资料解析：纯文本直接读，PDF 用 pdfjs，docx 用 mammoth。
// 文本统一截断到上限，避免撑爆 localStorage 与提示词。
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export const ACCEPT_TYPES = '.txt,.md,.markdown,.csv,.json,.pdf,.docx'
const CHAR_CAP = 60_000
export const MAX_FILES = 8

export interface ParsedFile {
  name: string
  text: string
  chars: number
  truncated: boolean
}

async function parsePdf(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  const maxPages = Math.min(doc.numPages, 40)
  const pages: string[] = []
  for (let i = 1; i <= maxPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    pages.push(content.items.map((it: any) => it.str ?? '').join(' '))
  }
  return pages.join('\n\n')
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const name = file.name.toLowerCase()
  let raw = ''
  if (name.endsWith('.pdf')) {
    raw = await parsePdf(file)
  } else if (name.endsWith('.docx')) {
    const mammoth: any = await import('mammoth')
    const r = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    raw = String(r?.value ?? '')
  } else {
    raw = await file.text()
  }
  const text = raw.replace(/\r/g, '').replace(/\u0000/g, '').trim()
  const truncated = text.length > CHAR_CAP
  return { name: file.name, text: text.slice(0, CHAR_CAP), chars: Math.min(text.length, CHAR_CAP), truncated }
}
