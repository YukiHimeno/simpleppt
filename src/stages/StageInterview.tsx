// 阶段 1：需求访谈。先问"给谁看、为什么做、想达到什么目的"，
// 提问的同时后台进行背景资料调研（原则 1：先提问，再生成）。
// 支持上传参考资料（txt/md/csv/json/pdf/docx），解析后随各阶段提示词提供给 AI。
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, FileText, RefreshCw, Upload, X } from 'lucide-react'
import { api } from '../lib/api'
import { useApp } from '../lib/app-context'
import { MOCK_TOPIC, delay, mockBackground, mockQuestions, mockSummary } from '../lib/mock-data'
import { ACCEPT_TYPES, MAX_FILES, parseFile } from '../lib/references'
import { Badge, Button, Card, Spinner, Textarea, useToast } from '../components/ui'
import { StageHeader } from '../components/StageHeader'
import type { Background, InterviewSummary, ReferenceFile } from 'shared/types'

export function StageInterview() {
  const { project, patch, settings, go } = useApp()
  const { notify } = useToast()
  const startedRef = useRef(false)
  const bgStartedRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [answers, setAnswers] = useState<string[]>(() => project.interview.questions.map((x) => x.a || ''))
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState<string[]>([])

  const questions = project.interview.questions
  const loading = !project.interview.questionsDone && questions.length === 0
  const summaryDone = project.interview.summaryDone

  async function runBackground() {
    if (bgStartedRef.current) return
    bgStartedRef.current = true
    patch((p) => ({ ...p, backgroundStatus: 'running' }))
    try {
      let bg: Background
      let degraded: string | null = null
      if (settings.mock) {
        await delay(1500)
        bg = { ...mockBackground, sources: [] }
      } else {
        const r = await api.background(settings, project.topic, project.referenceFiles)
        bg = r.background
        degraded = r.degraded
      }
      patch((p) => ({ ...p, background: bg, backgroundStatus: 'done', searchDegraded: degraded ?? p.searchDegraded }))
    } catch (e: any) {
      bgStartedRef.current = false
      patch((p) => ({ ...p, backgroundStatus: 'error' }))
      notify(`背景调研失败：${e?.message ?? e}`, 'error')
    }
  }

  async function run() {
    patch((p) => ({ ...p, interview: { ...p.interview, questions: [] } }))
    try {
      let qs: { q: string; why?: string; suggestions?: string[]; a: string }[]
      if (settings.mock) {
        await delay(900)
        qs = mockQuestions.map((x) => ({ q: x.q, why: x.why, suggestions: x.suggestions, a: x.a }))
      } else {
        const r = await api.questions(settings, project.topic)
        qs = (r.questions ?? []).map((x) => ({ q: x.q, why: x.why, suggestions: x.suggestions, a: '' }))
      }
      if (qs.length === 0) throw new Error('模型没有返回问题，请重试或更换模型')
      setAnswers(qs.map((x) => x.a))
      patch((p) => ({ ...p, interview: { ...p.interview, questions: qs, questionsDone: false } }))
      // 提问的同时进行背景调研
      if (!project.background && project.backgroundStatus === 'pending') runBackground()
    } catch (e: any) {
      notify(e?.message ?? String(e), 'error')
    }
  }

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    if (!project.interview.questionsDone) run()
    else if (!project.background && project.backgroundStatus === 'pending') runBackground()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    const room = MAX_FILES - project.referenceFiles.length
    if (room <= 0) {
      notify(`最多上传 ${MAX_FILES} 个参考文件`, 'error')
      return
    }
    const files = [...list].slice(0, room)
    setUploading(files.map((f) => f.name))
    const added: ReferenceFile[] = []
    for (const f of files) {
      try {
        const parsed = await parseFile(f)
        if (!parsed.text) {
          notify(`${f.name}：没有解析出文本内容，已跳过`, 'error')
          continue
        }
        added.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...parsed })
      } catch (e: any) {
        notify(`${f.name} 解析失败：${e?.message ?? e}`, 'error')
      }
    }
    setUploading([])
    if (added.length > 0) {
      patch((p) => ({ ...p, referenceFiles: [...p.referenceFiles, ...added] }))
      notify(`已添加 ${added.length} 个参考资料`, 'success')
    }
  }

  async function submit() {
    const qas = questions.map((x, i) => ({ ...x, a: (answers[i] ?? '').trim() }))
    if (qas.every((x) => !x.a)) {
      notify('请至少回答一个问题（可以点建议答案快速填入），或选择「跳过提问」', 'error')
      return
    }
    setBusy(true)
    try {
      let summary: InterviewSummary
      if (settings.mock) {
        await delay(900)
        summary = mockSummary
      } else {
        const r = await api.summary(settings, project.topic, qas.map(({ q, a }) => ({ q, a })), project.background)
        summary = r.summary
      }
      patch((p) => ({ ...p, interview: { ...p.interview, questions: qas, summary, summaryDone: true } }))
    } catch (e: any) {
      notify(e?.message ?? String(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  function skip() {
    patch((p) => ({
      ...p,
      interview: {
        ...p.interview,
        questions: p.interview.questions.map((x) => ({ ...x, a: x.a || '' })),
        questionsDone: true,
        summaryDone: false,
        summary: null,
      },
    }))
    if (!project.background && project.backgroundStatus === 'pending') runBackground()
  }

  const bg = project.background

  return (
    <div className="animate-fade-up space-y-6">
      <StageHeader
        step="1"
        title="需求访谈"
        desc="先弄清楚「给谁看、为什么做、想达到什么目的」，同时进行背景资料调研。回答越具体，后面的大纲越准。"
      >
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge tone="primary">主题：{project.topic || MOCK_TOPIC}</Badge>
          {project.backgroundStatus === 'running' && (
            <Badge tone="outline">
              <Spinner className="h-3 w-3" /> 背景调研中…
            </Badge>
          )}
          {project.backgroundStatus === 'done' && <Badge tone="success">背景调研完成</Badge>}
        </div>
      </StageHeader>

      {/* 参考资料 */}
      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-medium">参考资料（可选）</div>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading.length > 0 || project.referenceFiles.length >= MAX_FILES}>
            <Upload className="h-3.5 w-3.5" /> 上传文件
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPT_TYPES}
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            handleFiles(e.dataTransfer.files)
          }}
          className="border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground"
        >
          拖拽文件到这里，或点击「上传文件」。支持 txt / md / csv / json / pdf / docx，最多 {MAX_FILES} 个。
          {project.referenceFiles.length > 0 && ' 这些资料会连同检索结果一起提供给生成端。'}
        </div>
        {(uploading.length > 0 || project.referenceFiles.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {uploading.map((n) => (
              <Badge key={n} tone="outline">
                <Spinner className="h-3 w-3" /> {n}
              </Badge>
            ))}
            {project.referenceFiles.map((f) => (
              <Badge key={f.id} tone="default">
                <FileText className="h-3 w-3" />
                {f.name} · {f.chars.toLocaleString()} 字{f.truncated ? '（已截断）' : ''}
                <button
                  className="ml-0.5 hover:text-destructive"
                  onClick={() => patch((p) => ({ ...p, referenceFiles: p.referenceFiles.filter((x) => x.id !== f.id) }))}
                  title="移除"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </Card>

      {loading ? (
        <Card className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <Spinner /> 正在准备澄清问题…
        </Card>
      ) : (
        <div className="space-y-3">
          {questions.map((x, i) => (
            <Card key={i} className="space-y-2 p-4">
              <div className="text-sm font-medium">
                <span className="mr-2 text-primary">{String(i + 1).padStart(2, '0')}</span>
                {x.q}
              </div>
              {x.why && <p className="text-xs text-muted-foreground">{x.why}</p>}
              {x.suggestions && x.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {x.suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() =>
                        setAnswers((as) => {
                          const next = [...as]
                          next[i] = s
                          return next
                        })
                      }
                      className="border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <Textarea
                value={answers[i] ?? ''}
                onChange={(e) =>
                  setAnswers((as) => {
                    const next = [...as]
                    next[i] = e.target.value
                    return next
                  })
                }
                placeholder="你的回答…"
                className="min-h-[56px]"
              />
            </Card>
          ))}
        </div>
      )}

      {!summaryDone && !loading && (
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={skip} disabled={busy}>
            跳过提问，直接调研
          </Button>
          <Button onClick={submit} disabled={busy || loading}>
            {busy && <Spinner />}
            提交回答
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {summaryDone && project.interview.summary && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-3 p-5">
            <div className="text-sm font-semibold">需求摘要</div>
            <dl className="space-y-2 text-sm">
              {(
                [
                  ['受众', project.interview.summary.audience],
                  ['目的', project.interview.summary.goal],
                  ['场合', project.interview.summary.scene],
                  ['范围', project.interview.summary.scope],
                  ['基调', project.interview.summary.tone],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="grid grid-cols-[48px_1fr] gap-2">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="leading-relaxed">{v}</dd>
                </div>
              ))}
            </dl>
            {project.interview.summary.keyMessages.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs text-muted-foreground">听众必须带走</div>
                {project.interview.summary.keyMessages.map((m, i) => (
                  <div key={i} className="border-l-2 border-primary pl-2 text-sm">
                    {m}
                  </div>
                ))}
              </div>
            )}
            {project.interview.summary.risks && project.interview.summary.risks.length > 0 && (
              <div className="space-y-1">
                {project.interview.summary.risks.map((r, i) => (
                  <p key={i} className="text-xs text-amber-600 dark:text-amber-400">
                    ⚠ {r}
                  </p>
                ))}
              </div>
            )}
          </Card>

          <Card className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">背景资料</div>
              {project.backgroundStatus === 'error' && (
                <Button variant="ghost" size="sm" onClick={runBackground}>
                  <RefreshCw className="h-3.5 w-3.5" /> 重试
                </Button>
              )}
            </div>
            {!bg && project.backgroundStatus === 'running' && (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Spinner /> 正在检索行业背景…
              </div>
            )}
            {!bg && project.backgroundStatus === 'pending' && <p className="py-6 text-sm text-muted-foreground">尚未开始调研。</p>}
            {bg && (
              <>
                <p className="text-sm leading-relaxed text-muted-foreground">{bg.summary}</p>
                <div className="space-y-1.5">
                  {bg.facts.slice(0, 8).map((f, i) => (
                    <div key={i} className="flex gap-2 text-xs leading-relaxed">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                      <span>
                        {f.text}
                        {f.source && (
                          <a href={f.source} target="_blank" rel="noreferrer" className="ml-1 text-primary hover:underline">
                            [来源]
                          </a>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
                {bg.angles && bg.angles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {bg.angles.map((a) => (
                      <Badge key={a} tone="outline">
                        {a}
                      </Badge>
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      )}

      {(summaryDone || project.interview.questionsDone) && (
        <div className="flex justify-end pt-2">
          <Button size="lg" onClick={() => go('outline')}>
            生成便利贴大纲
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
