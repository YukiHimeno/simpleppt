import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useToast, Button, Dialog, Field, Input, Spinner, Switch, cn } from './ui'
import type { Settings } from 'shared/types'

export function SettingsDialog({
  open,
  onClose,
  settings,
  onSave,
  tab,
}: {
  open: boolean
  onClose: () => void
  settings: Settings
  onSave: (s: Settings) => void
  tab: 'api' | 'search'
}) {
  const [draft, setDraft] = useState(settings)
  const [activeTab, setActiveTab] = useState<'api' | 'search'>(tab)
  const [testing, setTesting] = useState(false)
  const { notify } = useToast()

  useEffect(() => {
    if (open) {
      setDraft(settings)
      setActiveTab(tab)
    }
  }, [open, settings, tab])

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setDraft((d) => ({ ...d, [k]: v }))

  async function test() {
    setTesting(true)
    try {
      await api.ping(draft)
      notify('连接成功，接口可用', 'success')
    } catch (e: any) {
      notify(`连接失败：${e?.message ?? e}`, 'error')
    } finally {
      setTesting(false)
    }
  }

  const save = () => {
    onSave(draft)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} title="设置">
      <div className="mb-4 flex gap-1">
        {(
          [
            ['api', '模型接口'],
            ['search', '搜索引擎'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn('px-3 py-1.5 text-sm', activeTab === id ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:bg-muted')}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'api' ? (
        <div className="space-y-4">
          <p className="rounded border border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            生成与检索请求会先发往 SimplePPT 的同源代理（/api/proxy），再由其转发到你填写的模型接口，以绕过浏览器跨域限制。
          </p>
          <Field label="API Base URL" hint="任何实现 Responses 格式（POST {base}/responses）的接口均可：官方、网关或自建代理。">
            <Input value={draft.baseUrl} onChange={(e) => set('baseUrl', e.target.value)} placeholder="https://api.deepseek.com/" />
          </Field>
          <Field label="API Key">
            <Input type="password" value={draft.apiKey} onChange={(e) => set('apiKey', e.target.value)} placeholder="sk-…" />
          </Field>
          <Field label="模型">
            <Input value={draft.model} onChange={(e) => set('model', e.target.value)} placeholder="deepseek-v4-flash" />
          </Field>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm">模型内置搜索</div>
              <p className="text-xs text-muted-foreground">
                即模型自带的 hosted web_search。未配置搜索引擎密钥时使用；配置了 Exa / Brave / Tavily 则优先走搜索引擎。若生成过程出现异常（超时、报错、内容错乱等），可考虑先关闭此开关再试。
              </p>
            </div>
            <Switch checked={draft.webSearch} onChange={(v) => set('webSearch', v)} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm">演示模式</div>
              <p className="text-xs text-muted-foreground">无需 API Key，用内置示例数据走模拟完全流程。</p>
            </div>
            <Switch checked={draft.mock} onChange={(v) => set('mock', v)} />
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={test} disabled={testing || draft.mock}>
              {testing && <Spinner />}测试连接
            </Button>
            <Button onClick={save}>保存</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            配置任意一个搜索引擎密钥后，背景调研与逐页检索会先生成查询词、再调用该引擎、最后把检索结果综合。按 Exa → Brave → Tavily
            的顺序取第一个配置且可用的。密钥只保存在本机浏览器；调用引擎时和模型接口一样，经 SimplePPT 的同源代理（/api/proxy）转发，以绕过浏览器跨域限制。
          </p>
          <Field label="Exa API Key" hint="exa.ai，语义检索，适合找资料与论文。">
            <Input type="password" value={draft.searchExaKey} onChange={(e) => set('searchExaKey', e.target.value)} placeholder="exa 密钥" />
          </Field>
          <Field label="Brave Search API Key" hint="brave.com/search/api，传统网页检索。">
            <Input type="password" value={draft.searchBraveKey} onChange={(e) => set('searchBraveKey', e.target.value)} placeholder="brave 密钥" />
          </Field>
          <Field label="Tavily API Key" hint="tavily.com，为 LLM 设计的检索 API。">
            <Input type="password" value={draft.searchTavilyKey} onChange={(e) => set('searchTavilyKey', e.target.value)} placeholder="tavily 密钥" />
          </Field>
          <div className="flex justify-end pt-2">
            <Button onClick={save}>保存</Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
