// 项目备份：把当前项目（六阶段全部产物）导出成一个 JSON 文件，随时导入恢复。
// 项目数据只存浏览器 localStorage，换设备 / 清缓存就没了；这份文件就是备份。
import { downloadBlob } from './exporter'
import { emptyProject, resetTransientState } from './store'
import type { Project } from 'shared/types'

const EXPORT_VERSION = 1
const VALID_STAGES = ['home', 'interview', 'outline', 'research', 'plan', 'slides']

function sanitizeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'project'
}

export function projectFileName(topic: string): string {
  const d = new Date()
  const day = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  return `simpleppt-${sanitizeName(topic).slice(0, 40)}-${day}.json`
}

export function exportProjectFile(p: Project) {
  const payload = { app: 'simpleppt', version: EXPORT_VERSION, exportedAt: new Date().toISOString(), project: p }
  downloadBlob(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    projectFileName(p.topic),
  )
}

/** 校验并规范化导入的项目：缺的字段用空项目兜底，运行状态重置为待执行 */
export function normalizeImportedProject(raw: any): Project {
  const p = raw?.project ?? raw
  if (!p || typeof p !== 'object' || typeof p.topic !== 'string' || !p.topic.trim()) {
    throw new Error('不是有效的 SimplePPT 项目文件（缺少 topic 字段）')
  }
  const base = emptyProject(String(p.topic).trim().slice(0, 120))
  const merged: Project = {
    ...base,
    ...p,
    topic: base.topic,
    stage: VALID_STAGES.includes(p.stage) ? p.stage : 'home',
    interview: { ...base.interview, ...(p.interview && typeof p.interview === 'object' ? p.interview : {}) },
    referenceFiles: Array.isArray(p.referenceFiles) ? p.referenceFiles : [],
    research: p.research && typeof p.research === 'object' ? p.research : {},
    plan: Array.isArray(p.plan) ? p.plan : [],
    slides: p.slides && typeof p.slides === 'object' ? p.slides : {},
    updatedAt: Date.now(),
  }
  return resetTransientState(merged)
}

export async function readProjectFile(file: File): Promise<Project> {
  const text = await file.text()
  let raw: any
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('文件不是合法 JSON，请选择 SimplePPT 导出的备份文件')
  }
  return normalizeImportedProject(raw)
}
