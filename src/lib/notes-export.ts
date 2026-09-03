// 讲稿导出：把核心结论、每页一句话信息与讲者备注整理成一份 Markdown 讲稿，
// 方便排练、打印或粘贴到其他工具。纯文本拼接，不依赖任何新库。
import type { Project } from 'shared/types'

const PAGE_TYPE_LABEL: Record<string, string> = {
  cover: '封面',
  agenda: '目录',
  content: '内容',
  data: '数据',
  quote: '金句',
  ending: '结尾',
}

export function speechFileName(topic: string): string {
  return `${topic.replace(/[\\/:*?"<>|]/g, '_').trim() || 'SimplePPT'}-讲稿.md`
}

export function buildSpeechMarkdown(p: Project): string {
  const outline = p.outline
  const summary = p.interview.summary
  const pages = outline?.pages ?? []
  const lines: string[] = []

  lines.push(`# ${p.topic || '未命名演示'}`)
  lines.push('')
  if (outline?.coreMessage) {
    lines.push(`核心结论：${outline.coreMessage}`)
    lines.push('')
  }
  if (summary) {
    lines.push('## 需求摘要')
    lines.push('')
    if (summary.audience) lines.push(`- 受众：${summary.audience}`)
    if (summary.goal) lines.push(`- 目的：${summary.goal}`)
    if (summary.scene) lines.push(`- 场合：${summary.scene}`)
    if (summary.scope) lines.push(`- 范围：${summary.scope}`)
    if (summary.tone) lines.push(`- 基调：${summary.tone}`)
    if (summary.keyMessages.length > 0) lines.push(`- 关键信息：${summary.keyMessages.join('；')}`)
    lines.push('')
  }

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    const plan = p.plan.find((x) => x.pageId === page.id)
    const title = plan?.title || page.title
    const kicker = plan?.kicker || page.group
    const message = plan?.message || page.takeaway
    const note = plan?.speakerNote || page.takeaway

    lines.push('---')
    lines.push('')
    lines.push(`## ${String(i + 1).padStart(2, '0')} · ${title}`)
    lines.push('')
    const meta = [kicker, PAGE_TYPE_LABEL[page.pageType] ?? ''].filter(Boolean).join(' · ')
    if (meta) lines.push(`> ${meta}`)
    lines.push('')
    if (message) {
      lines.push(message)
      lines.push('')
    }
    const bullets = (plan?.cards ?? []).filter((c) => c.kind === 'bullets' && Array.isArray(c.content)).flatMap((c) => c.content)
    if (bullets.length > 0) {
      for (const b of bullets) lines.push(`- ${b}`)
      lines.push('')
    }
    if (note) {
      lines.push(`讲者备注：${note}`)
      lines.push('')
    }
  }

  lines.push('---')
  lines.push('')
  lines.push(`由 SimplePPT 导出于 ${new Date().toLocaleString('zh-CN')}`)
  return lines.join('\n')
}
