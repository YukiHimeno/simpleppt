// All prompts for the six-stage SimplePPT pipeline.
// Generation follows this order:
//  1) Ask before generating (needs interview + background research)
//  2) Plan the structure with sticky notes (pyramid principle)
//  3) Feed each page topic to the search-backed model / search engine for real material
//  4) Produce a page plan layer (content and layout before visuals)
//  5) Draw with the Bento grid layout (or the plain/dry handout style)
//  6) Render each page directly as SVG
// Every output is prefixed with the no-AI-tone hard requirement (NO_AI_TONE).
import { isPlainStyle, type InterviewQA, type InterviewSummary, type Background, type Fact, type PagePlan, type StickyPage, type SlideStyle, type ReferenceFile, type Quote } from 'shared/types'
import { getLayout } from 'shared/bento'

export interface StageRequest {
  instructions: string
  user: string
  json?: boolean
  maxTokens?: number
  search?: boolean
}

const json = (v: unknown) => JSON.stringify(v, null, 1)

/** Current local time, formatted for the user building this deck. */
function nowLabel(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  const quarter = Math.floor(d.getMonth() / 3) + 1
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 ${p(d.getHours())}:${p(d.getMinutes())}（第 ${quarter} 季度）`
}

const H = (instructions: string) =>
  `${instructions}\n\n当前时间：${nowLabel()}。用户正在此刻制作这份 PPT，内容里出现的年份、季度、季节和“最近/今年/明年”都按这个时间推算，不要写死成你训练数据里的时间。\n\n${NO_AI_TONE}`

/** Hard requirement to strip AI tone (bad examples distilled from the lieflat-less-ai-tone skill; duplicates merged). */
const NO_AI_TONE = `## 硬性要求：去 AI 味（只影响文案措辞，不影响版式、结构与配色规则）

当前环节输出的所有中文文案（标题、要点、正文、摘要、讲稿等）都要像人写的。这一节是强制要求，不是参考意见：输出前把整段逐条过一遍，命中就当场重写，不许留下明知违规的句子。宁可直白、像人随手写的，也不要通顺圆滑的 AI 腔。改写只动措辞，不得改动事实、数字、来源与内容结构，也不许自己编数据、案例、出处来"补具体"。每条都有明确的触发词，只在命中时改；对某处没把握就保持原样。不要为了"显得像人"硬加口语或补"就/很/了"等虚词，也不要删正常的问句、比喻和正文里的"首先……其次"。若本节与其它"写得漂亮"的要求冲突，以本节为准。

对照以下反面教材逐项检查，命中就重写：

1. 翻案腔："不是……而是……""并非……而是……""不在于……而在于……""与其说……不如说……""表面……实际……""你以为……其实……""A 不重要，重要的是 B"这类先立靶再推翻的句式，改成正面判断："真正的壁垒是认知"。
2. 顿号罗列过密：一个分句内不要用两个以上顿号串三项以上并列；能概括就概括，别写"覆盖销售、运营、客服、仓储四大部门"。
3. 相邻句同款：不要连续几句共用同一个句子骨架（"A 完成了……。B 完成了……。"），打散句法、长短错落。一段里三个以上平级案例在凑数时，压缩次要的，让最有代表性的作主句。
4. 破折号滥用：不用"——"做停顿揭晓或插入补充，用逗号、句号直接写完整。
5. 冒号滥用：不写"一句话总结：""核心是：""原因如下：""常见做法包括："这类冒号引出空内容的句子，内容直接写出来；也不写只为了宣布"下面有个列表"的空转句（"我见过的几种典型场景："）。
6. 起手填充与段首零主语："说白了""说穿了""先说结论""值得注意的是""更重要的是""关键在于""问题在于""不难看出"这类开场能删就删；段首用了评论语却没说在评论谁（没有"这/那/其/此"指回上文）的，补"这一点"或先点名对象。
7. 拟人化职业喻体：不要把系统、流程比作"智慧的导师""贴身的数字秘书""永不疲倦的审查员"这类理想化的人，写它实际做了什么。
8. 概括词盖数据：同段已有具体数值/时间就不许用"显著提升""大幅增长""明显改善"盖住它，把具体值写出来；例如写"从 60 万降到 42 万"，不写"大幅下降"。
9. 名词化绕弯："实现了……的提升""完成了对……的优化""进行了……的调整"改回动词："把……提上去了""把……改顺了""调整了……"。
10. 翻译腔壳子：
   - 句首壳："对于……来说""就……而言""关于……""在……方面""当……时"这类前置壳去掉，把对象放进句子里；"当 A 时，B"直接写成"A，B"。
   - 句首连接词当路标：不连续用"然而""因此""此外""与此同时""总而言之"领起句子，移进句中或换成"不过""其实""也"。
   - "这意味着""这表明""这说明""换句话说"复述句：它只是把上一句换个说法，就并入前一句，别单拎成一句。
11. 过长前置定语：中心名词前的修饰不要超过十五字，不要连用两个以上"的"；"这是一个能够让团队在不增加人力的情况下显著提升审核速度的工具"改成"这个工具能显著提升审核速度，不需要增加人力"。
12. 编号骨架：不要用"一、二、三"或"第一、第二、第三"给小标题通篇编号；内容本来不是三个，别硬凑"三大""三驾马车"式排比。
13. 正文别用碎片短行：两个换行符之间的一段正文，字符数必须大于 30；不到 30 字就跟相邻句子合并成完整一段，不要一个短句单独占一行。
14. 标题里禁止用冒号（： :）和破折号（—— —）：页面标题、区块标题、卡片标题一律不用这两种标点。
15. 不喊口号、不装门面：不用"赋能""抓手""生态""未来可期""让我们拭目以待""标志着""彰显了""迈上新台阶"，结尾停在最后一个具体事实上。
16. 不编造出处：资料里没有的"专家表示""业内人士认为""研究表明"不写；没有出处的事实就删掉或标注待核实。
17. 不加戏：不用 emoji、不堆感叹号；要点就是要点，不要每条都套"**加粗小标题：**解释"的模板。`

export function referencesBlock(files: ReferenceFile[] | undefined | null, cap = 24000): string {
  if (!files || files.length === 0) return ''
  let used = 0
  const parts: string[] = []
  for (const f of files) {
    const budget = Math.max(2000, Math.floor(cap / files.length))
    const text = f.text.slice(0, budget)
    used += text.length
    parts.push(`《${f.name}》${f.truncated ? '（已截断）' : ''}：\n${text}`)
    if (used >= cap) break
  }
  return `\n\n【用户上传的参考资料】\n${parts.join('\n---\n')}`
}

export function tokensBlock(style: SlideStyle): string {
  return json({
    bg: style.bg, fg: style.fg, muted: style.muted, card: style.card, cardAlt: style.cardAlt,
    accent: style.accent, accentDeep: style.accentDeep, highlight: style.highlight,
    border: style.border, accentA: style.accentA, radius: style.radius,
  })
}

/* ---------- Stage 1a: needs interview / clarifying questions ---------- */

export function interviewQuestions(topic: string): StageRequest {
  return {
    instructions: H(`你是 SimplePPT 的需求访谈顾问。用户要做一份 PPT，你必须先弄清"给谁看、为什么做、想达到什么目的"，然后再动手。
请提出 4-5 个澄清问题，必须覆盖：
- 受众与场合（谁看、在哪讲）
- 核心目的（讲完后希望听众知道什么 / 做什么）
- 内容范围（必须覆盖什么、有什么禁忌）
- 篇幅与时长
- 风格偏好（克制 / 数据驱动 / 视觉冲击 等）
- 需要查询哪些具体数据、翔实度要求
其中至少 1 个问题要针对主题本身的关键分歧点。
只输出 JSON：{"questions":[{"q":"问题","why":"为什么要问（一句话）","suggestions":["快捷答案1","快捷答案2","快捷答案3"]}]}
suggestions 给 2-3 个该问题最常见的答案，方便用户一键填入。全部中文。`),
    user: `PPT 主题：「${topic}」`,
    json: true,
    maxTokens: 2000,
  }
}

/* ---------- Stage 1b: background research (runs alongside the interview) ---------- */

export function backgroundResearch(topic: string, extra?: string): StageRequest {
  return {
    instructions: H(`你是调研员，正在为一份 PPT 收集背景资料。请围绕主题检索并整理：
- 行业现状与最新趋势（优先近 24 个月，含具体数字与时间）
- 关键玩家 / 案例 / 数据
- 常见的争议或认知误区
只输出 JSON：
{"summary":"300 字以内背景综述","facts":[{"text":"事实/数据/趋势，含具体数字与时间，≤60 字","source":"url 或 null"}],"angles":["这份 PPT 可能的切入角度 2-4 个"],"sources":[{"title":"标题","url":"链接"}]}
要求：至少 5 条 facts；数字必须来自检索结果、给定资料或可靠常识，不得编造；不确定的写"待核实"；sources 汇总所有实际引用的链接。全部中文。`),
    user: `主题：「${topic}」${extra ? `\n补充背景：${extra}` : ''}`,
    json: true,
    maxTokens: 4000,
    search: true,
  }
}

/* ---------- Stage 1c: needs summary (after answers) ---------- */

export function interviewSummary(topic: string, qas: InterviewQA[], background: Background | null): StageRequest {
  const answered = qas
    .map((x, i) => `Q${i + 1}：${x.q}\nA：${x.a || '（未回答）'}`)
    .join('\n')
  return {
    instructions: H(`根据主题、用户访谈回答与背景调研，输出这份 PPT 的需求摘要。只输出 JSON：
{"audience":"受众是谁","goal":"核心目的（讲完后希望发生什么）","scene":"场合与时长","scope":"内容范围与重点","tone":"风格基调","keyMessages":["听众必须带走的 1-3 句话"],"risks":["需要注意的事实/资料风险，如数据时效、口径不一"]}
每项 1-2 句，中文。`),
    user: `主题：「${topic}」\n\n访谈回答：\n${answered}\n\n背景调研摘要：${background?.summary ?? '（无）'}`,
    json: true,
    maxTokens: 2000,
  }
}

/* ---------- Search engine: query generation ---------- */

export function searchQueries(topic: string, subject: string, n = 3): StageRequest {
  return {
    instructions: `为资料检索生成搜索查询词。要求：中英文混合策略，具体化（带年份/产品名/指标名），避免宽泛词。
只输出 JSON：{"queries":["查询词1","查询词2","查询词3"]}`,
    user: `PPT 主题：${topic}\n检索对象：${subject}\n生成 ${n} 个查询词。`,
    json: true,
    maxTokens: 800,
  }
}

/* ---------- Stage 2: sticky-note outline (pyramid principle) ---------- */

export function outlineStage(input: {
  topic: string
  summary: InterviewSummary | null
  background: Background | null
  references: ReferenceFile[]
  pageCount?: number
  feedback?: string
}): StageRequest {
  const { topic, summary, background, references, pageCount, feedback } = input
  return {
    instructions: H(`用"便利贴法"规划 PPT 结构：把每一页看成一张数字便利贴，先确定每页讲什么、页面之间如何组织。
核心方法是金字塔原理：**结论先行、以上统下、归类分组、逻辑递进**。

规则：
- 总页数 ${pageCount ?? 10} 页左右（8-14 页）。结构：封面 → 目录（可选）→ 2-4 个章节的正文（每章 1-3 页）→ 结尾页（行动号召/致谢）
- 每页的 takeaway 必须是一个**完整的判断句**（结论），不能是名词短语
- group 是章节名；同级便利贴同组；组内顺序要有逻辑递进（现状 → 问题 → 方案 → 证据 → 结论）
- role 取值：cover | agenda | point（章节论点页）| support（论据/数据页）| ending
- page_type 取值：cover | agenda | content | data | quote | ending
- content 页与 data 页交替出现，避免连续 3 页纯文字；有数据支撑的结论优先用 data 页

只输出 JSON：
{"core_message":"整份 PPT 的塔尖结论（一句话）","pages":[{"id":"p1","title":"≤14 字","takeaway":"本页结论句","group":"章节名（封面/目录/结尾留空字符串）","role":"...","page_type":"...","key_points":["本页要点 2-4 条，短句"]}]}
全部中文。`),
    user: `主题：「${topic}」

需求摘要：
${summary ? json(summary) : '（未提供）'}

背景资料：
${background ? json({ summary: background.summary, facts: background.facts.slice(0, 8), angles: background.angles }) : '（未提供）'}${referencesBlock(references)}${
      feedback ? `\n\n【用户的整体修改要求，必须严格执行】\n${feedback}` : ''
    }`,
    json: true,
    maxTokens: 6000,
  }
}

export function normalizeOutline(raw: any): { coreMessage: string; pages: StickyPage[] } {
  const pages: StickyPage[] = (Array.isArray(raw?.pages) ? raw.pages : []).map((p: any, i: number) => ({
    id: typeof p?.id === 'string' && p.id ? p.id : `p${i + 1}`,
    title: String(p?.title ?? `第 ${i + 1} 页`).slice(0, 40),
    takeaway: String(p?.takeaway ?? ''),
    group: String(p?.group ?? ''),
    role: ['cover', 'agenda', 'point', 'support', 'ending'].includes(p?.role) ? p.role : 'support',
    pageType: ['cover', 'agenda', 'content', 'data', 'quote', 'ending'].includes(p?.page_type ?? p?.pageType)
      ? (p.page_type ?? p.pageType)
      : 'content',
    keyPoints: Array.isArray(p?.key_points ?? p?.keyPoints) ? (p.key_points ?? p.keyPoints).map(String).slice(0, 6) : [],
  }))
  return { coreMessage: String(raw?.core_message ?? raw?.coreMessage ?? ''), pages }
}

/* ---------- Stage 2b: single sticky rewrite (per user advice) ---------- */

export function outlineRewrite(input: {
  page: StickyPage
  index: number
  total: number
  coreMessage: string
  summary: InterviewSummary | null
  advice: string
}): StageRequest {
  const { page, index, total, coreMessage, summary, advice } = input
  return {
    instructions: H(`你在修订一份 PPT 大纲中的第 ${index}/${total} 张便利贴。保持整份大纲的章节归属与逻辑位置不变，按用户建议重写这一页。
只输出 JSON（字段与原结构一致）：
{"title":"≤14 字","takeaway":"本页结论句（完整判断句）","group":"章节名","role":"cover|agenda|point|support|ending","page_type":"cover|agenda|content|data|quote|ending","key_points":["2-4 条要点"]}
全部中文。`),
    user: `整份 PPT 核心结论：${coreMessage}
需求摘要：${summary ? json(summary) : '（无）'}

当前这一页：
${json(page)}

用户的修改建议（必须严格执行，优先级高于原页面要求）：${advice}`,
    json: true,
    maxTokens: 2000,
  }
}

/* ---------- Stage 3: per-page material research ---------- */

export function pageResearch(input: {
  page: StickyPage
  index: number
  total: number
  coreMessage: string
  audience: string
  references: ReferenceFile[]
  searchBlock?: string
}): StageRequest {
  const { page, index, total, coreMessage, audience, references, searchBlock } = input
  return {
    instructions: H(`你是资料研究员，为一份 PPT 的第 ${index}/${total} 页收集素材。这一页的结论是「${page.takeaway}」。
只输出 JSON：
{"summary":"80 字以内：这一页应该用资料讲清楚什么","facts":[{"text":"含具体数字/时间/案例的事实，≤60 字","source":"url 或 null","confidence":"high|medium|low"}],"quote":{"text":"一句话引言","author":"说话人/机构","source":"url 或 null"} 或 null}
要求：
- 最多 6 条 facts，宁缺毋滥，优先能支撑「${page.takeaway}」的数据与案例
- 数字必须来自检索结果或给定资料，不得编造；两者都没有就用模型知识并在 confidence 标 "low"
- 受众是「${audience || '决策者'}」，优先选他们关心的素材
全部中文。`),
    user: `整份 PPT 核心结论：${coreMessage}
本页标题：${page.title}
本页要点：${page.keyPoints.join('；') || '（无）'}${referencesBlock(references, 12000)}${
      searchBlock ? `\n\n【检索结果（引用时标注编号来源）】\n${searchBlock}` : ''
    }`,
    json: true,
    maxTokens: 3500,
    search: !searchBlock,
  }
}

export function normalizeResearch(raw: any, pageId: string) {
  const facts: Fact[] = (Array.isArray(raw?.facts) ? raw.facts : []).map((f: any) => ({
    text: String(f?.text ?? '').slice(0, 200),
    source: typeof f?.source === 'string' && /^https?:\/\//.test(f.source) ? f.source : null,
    confidence: ['high', 'medium', 'low'].includes(f?.confidence) ? f.confidence : 'medium',
  }))
  const q = raw?.quote
  const quote: Quote | null =
    q && typeof q.text === 'string' && q.text.trim()
      ? { text: q.text.trim().slice(0, 160), author: String(q.author ?? '').slice(0, 60), source: null }
      : null
  return { pageId, summary: String(raw?.summary ?? ''), facts, quote } as const
}

/* ---------- Stage 4: page plan (Bento grid planning) ---------- */

export function planStage(input: {
  page: StickyPage
  index: number
  total: number
  coreMessage: string
  audience: string
  researchFacts: Fact[]
  quote: Quote | null
  references: ReferenceFile[]
  advice?: string
}): StageRequest {
  const { page, index, total, coreMessage, audience, researchFacts, quote, references, advice } = input
  const factsText = researchFacts.length
    ? researchFacts.map((f, i) => `${i + 1}. ${f.text}${f.source ? `（来源：${f.source}）` : '（来源：模型知识）'}`).join('\n')
    : '（无检索资料）'
  return {
    instructions: H(`你是页面策划师，为第 ${index}/${total} 页写"策划稿"——只决定放什么内容、内容之间什么关系、用什么版式，**不做视觉设计**。

可用资料（只允许使用这些数字，不得编造）：
${factsText}
${quote ? `\n可选引言：「${quote.text}」——${quote.author || '匿名'}` : ''}

只输出 JSON：
{"title":"页面标题","kicker":"章节/标签 ≤8 字","message":"一句话信息（观众 3 秒内应该 get 到的判断）","page_type":"${page.pageType}","speakerNote":"讲者备注 1-2 句","notes":"版式选择理由 1 句","cards":[版式卡片]}

版式卡片规则（12 列 × 4 行便当网格）：
- card 字段：{"col":1-12,"colSpan":1-12,"row":1-4,"rowSpan":1-4,"kind":"...","title":"卡片标题（stat/text 可省）","content":"正文或要点数组","data":[{"label":"标签","value":数字}],"accent":true|false}
- 卡片数 1-5 张；**有且只有一张 accent=true 的焦点卡片**（通常是最大或含关键数据的）
- 大卡片 ≥ 7 列×4 行 或 12 列×2 行；小卡片 4-6 列 × 1-2 行；禁止 1×1
- 所有卡片必须恰好拼满 12×4 网格（不留大于 2 格的空洞、不重叠、不出界）
- kind 可选：
  stat（单个关键数字，content=数字+单位的字符串）
  text（一段话，content=字符串）
  bullets（3-5 条要点，content=字符串数组）
  compare（左右对比，content=["A 标题:A 要点;A 要点","B 标题:B 要点;B 要点"] 恰好 2 项）
  timeline（时间线，content=按时间排序的条目数组，每条"时间:事件"）
  table（content=行数组，每行"列1|列2|列3"）
  chart-bar / chart-line / chart-donut（**必须带 data**，3-6 项，数值只能来自上面资料）
  highlight（金句/强调，content=一句话）
- ${page.pageType === 'cover' || page.pageType === 'ending' || page.pageType === 'quote' ? `本页 page_type 是 ${page.pageType}：cards 直接给 []（空数组），采用整页居中/大字构图。` : '本页是正文页，必须给 cards。'}
- 若内容含数学公式，在 content 里用 LaTeX 写在 $...$ 中（如 $E=mc^2$），后续阶段会渲染。

常见版式参考：
- 数据页：顶部 3 张 stat（各 span4×row1）+ 主图表（col1 span8 row2 rowSpan3）+ 结论 text（col9 span4 row2 rowSpan3，accent）
- 论述页：焦点 bullets（col1 span7 row1 rowSpan4）+ 辅助 stat（col8 span5 row1 rowSpan2）+ text（col8 span5 row3 rowSpan2）
- 流程页：timeline（col1 span12 row1 rowSpan2，accent）+ 3 张说明卡（各 span4 row3 rowSpan2）

${advice ? `\n【用户的修改建议（重新策划时遵守，保持 12×4 网格完整拼满）】\n${advice}` : ''}
`),
    user: `页面：${page.title}
本页结论：${page.takeaway}
本页要点：${page.keyPoints.join('；')}
核心结论（全篇）：${coreMessage}
受众：${audience || '决策者'}${referencesBlock(references, 8000)}`,
    json: true,
    maxTokens: 4500,
  }
}

export function normalizePlan(raw: any, pageId: string, index: number, fallbackTitle: string, pageType: string): PagePlan {
  const kinds = ['stat', 'text', 'bullets', 'compare', 'timeline', 'table', 'chart-bar', 'chart-line', 'chart-donut', 'highlight']
  const cards = (Array.isArray(raw?.cards) ? raw.cards : []).map((c: any, i: number) => ({
    col: Number(c?.col) || 1,
    colSpan: Number(c?.colSpan) || 6,
    row: Number(c?.row) || 1,
    rowSpan: Number(c?.rowSpan) || 2,
    kind: kinds.includes(c?.kind) ? c.kind : 'text',
    title: c?.title ? String(c.title).slice(0, 30) : undefined,
    content: Array.isArray(c?.content) ? c.content.map(String).slice(0, 6) : String(c?.content ?? ''),
    data: Array.isArray(c?.data)
      ? c.data.slice(0, 6).map((d: any) => ({ label: String(d?.label ?? ''), value: Number(d?.value) || 0 }))
      : undefined,
    accent: !!c?.accent,
  }))
  return {
    pageId,
    index,
    title: String(raw?.title ?? fallbackTitle).slice(0, 40),
    kicker: String(raw?.kicker ?? '').slice(0, 12),
    message: String(raw?.message ?? ''),
    pageType: (['cover', 'agenda', 'content', 'data', 'quote', 'ending'].includes(raw?.page_type) ? raw.page_type : pageType) as PagePlan['pageType'],
    speakerNote: raw?.speakerNote ? String(raw.speakerNote).slice(0, 300) : undefined,
    notes: raw?.notes ? String(raw.notes).slice(0, 200) : undefined,
    cards,
  }
}

/* ---------- Stage 5: full-page SVG generation ---------- */

export function slideStage(input: {
  topic: string
  index: number
  total: number
  coreMessage: string
  prevTitle?: string
  nextTitle?: string
  plan: PagePlan
  style: SlideStyle
  facts: Fact[]
  quote: Quote | null
  advice?: string
}): StageRequest {
  const { topic, index, total, coreMessage, prevTitle, nextTitle, plan, style, facts, quote, advice } = input
  const l = getLayout(style.ratio)
  const rects = (plan.rects ?? []).map((r, i) => ({
    i,
    kind: r.kind,
    accent: !!r.accent,
    title: r.title ?? null,
    content: r.content,
    data: r.data ?? null,
    rect: { x: r.x, y: r.y, w: r.w, h: r.h },
  }))
  // carded only controls card containers; plain (the dry handout look) is a separate
  // flag, so disabling Bento cards does not enable the plain style.
  const plain = isPlainStyle(style)
  const carded = style.carded === true
  const titleSize = plain ? l.TITLE_SIZE + 8 : l.TITLE_SIZE
  const titleOverflowSize = Math.max(22, titleSize - 6)
  const factsText = facts.length
    ? facts.map((f) => `• ${f.text}${f.source ? `（${f.source}）` : ''}`).join('\n').slice(0, 1400)
    : '（无）'
  const researchBlock =
    plan.pageType === 'quote' && quote ? `引言：「${quote.text}」——${quote.author || ''}` : factsText

  const styleRules = carded
    ? `## Bento 卡片画法
下方给出每张卡片的精确矩形 {x,y,w,h} 与内容。每张卡片：
1. 容器：<rect x y width height rx="${style.radius}" fill="card" stroke="border" stroke-width="1"/>；accent 焦点卡片改为 fill="accentA" stroke="accent" stroke-width="1.2"
2. 内边距 24px；卡片标题字号 20 字重 600 填 fg；正文 15 填 muted（关键词句可用 fg）
3. kind 画法：
   - stat：数字字号 54 字重 700 填 accent（或 fg），下方 12px muted 标签
   - bullets：每条前画 <circle r="3.5" fill="accent"/>，文字 15px，行距 30
   - text：段落 15px muted 行距 25，最多 5 行
   - compare：中缝 1px border 竖线，左右各小标题 17px fg + 要点 14px muted
   - timeline：水平线 stroke="border"，节点 <circle r="6" fill="accent"/>，节点上方 17px fg 标签、下方 13px muted 说明
   - chart-bar：竖条 rx="3" fill="accent"（最大值一根用 accentDeep），条顶 13px fg 数值，条底 11px muted 标签，含一条 stroke="border" 基线；高度按数值比例
   - chart-line：折线 stroke="accent" stroke-width="3" fill="none" + 数据点圆 + 数值标签，含基线
   - chart-donut：环形分段（accent/accentDeep/muted 三色，stroke-width 22），中心 30px fg 大数字 + 12px muted 标签
   - table：表头 12px muted + border 底线，数据行 14px fg 行高 30
   - highlight：居中 22px fg 字重 600 金句，上方 40px 宽 accent 短横线装饰
4. 层级原则：一页只有一个视觉焦点（accent 卡片）；accent 面积 < 10%；非焦点卡片克制、留白充足。**内容放不下时缩减条目数，绝不缩小字号到 12 以下硬塞。**`
    : plain
      ? `## 朴素干货版式（无卡片，严禁装饰）
这是最朴素的讲义式 PPT：白底黑字、信息密度高。**千万不能有任何小装饰**：不画卡片矩形、圆角容器、阴影、边框、分隔小线、强调色短横线、几何点缀。矩形只允许用于黄色荧光笔底。
- 页边距尽量小：内容铺满画布，四周留白 ≤ 24px，避免大段空白。
- 规划稿的卡片矩形只是文字定位参考，**不是容器**：不要在矩形四周留内边距，直接从矩形边缘开始排字；相邻卡片（区块）之间的文字间隔只留 10-14px，让不同区块的文字自然靠近、版面紧凑，绝不为了对齐留大空白。
- 刻意"赶时间"的手感：字体偏大——正文/要点 21-24px、区块标题 26-30px、关键数字 60-76px，不同文本框的字号不要完全一致，在中等/大等之间微微浮动 ±2px；各元素 x/y 不要严格对齐，允许 1-3px 的随机小错位。
- 标题位置不固定，按权重自选一种.不要老是选前两种：
  - 标题在左上角：约 40%
  - 本页省略独立标题：约 40%（标题的含义并入正文/要点首句，不要另起一行再写一遍标题）
  - 标题顶部居中：约 10%
  - 标题竖排在页面左侧（文字旋转 -90° 纵向排布，不占正文宽度）：约 10%
  - 标题居中放在页面中上部作大字视觉：约 10%
  同一份 PPT 相邻页不要都用同一种布局，尽量交替。
- 页标题用 Office 默认模板的"艺术字"样式：font-weight="800" 加粗，配色从 Office 默认方案里**随机挑一种**——纯色加粗（蓝 #4472C4 / 橙 #ED7D31 / 金 #FFC000 / 浅蓝 #5B9BD5 / 绿 #70AD47）、黄底橙描边（fill="rgba(255,255,0,0.42)" + stroke="#FFC000" stroke-width="2" paint-order="stroke"）、白字粗描边加投影（白字 + #4472C4/#C00000 粗描边，右下错位放半透明同色副本模拟投影）、镂空字（fill="none" + 粗 stroke）、白字加荧光边（stroke-width 加宽、stroke 用 #FFC000/#7FD4FF 等亮色，paint-order="stroke"）；一份文稿不同页可换配色，可加 1-2° 轻微旋转。**不要画任何强调色短横线**。
- 区块标题：26-30px 字重 700 填 fg（不加下划线/短横线）。
- 正文/要点：21-24px 填 fg（muted 只用于次要注释）；bullets 用 5×5 小方块（填 fg）。
- **重点强调**：① 标红加粗——关键句/关键数字 fill="accent" font-weight="700"；② 黄色荧光笔——先画 <rect fill="highlight" opacity="0.85" rx="2">（高≈字号×1.15、宽≈文本估算宽，放文字层之下）再画 fg 文字。
- stat：关键数字 60-76px 字重 700 填 accent；**给最重要的数字画一个红色椭圆描边（<ellipse fill="none" stroke="#FF0000" stroke-width="3.5">，椭圆略宽于高）**，像 Office 里手动画圈批注，**不要画箭头**。
- chart-bar：柱体填 #333（最重要一根填 accent），柱顶 15-17px fg 数值、柱底 13-14px muted 标签，一条 fg 细基线。
- timeline：fg 色横线 + accent 实心圆点 + 20-22px fg 标签 + 15-17px muted 说明。
- 每一页在角落或标题旁放一个"问号小人"占位元素：<g data-question-person="1" x="…" y="…" size="…"/>（只需给 x/y/size 三个数字属性，size 取 40-60，x/y 是放图位置）——**不要自己画小人的矢量轮廓**，系统会自动把这个占位替换成真实的问号小人图片，制造"还没想完/留个问号"的即兴感。
- 整体像一个人赶时间随手整理的讲义：直接、清楚、能划重点、略歪但不乱，真实感强。放不下就精简条目数，绝不缩小字号硬塞。`
    : `## 无卡片版式（沿用当前配色的直接排版）
不画卡片矩形、圆角容器与几何装饰，但保留该风格的字号、字重与配色体系；不是朴素干货：**不加艺术字标题、荧光笔、红圈、问号小人等手写装饰**。
- 规划稿的卡片矩形仅作为文字定位参考：文字按这些矩形分区排版，区块之间留出 24px 左右的自然留白，左右保持对齐，内容不超出对应矩形。
- 区块标题 20-24px 字重 600 填 fg；正文/要点 15-18px 填 muted（关键词句用 fg + 字重 600）；行距 26-30。
- bullets：每条前画 <circle r="3.5" fill="accent"/>，文字与区块标题同宽排版；stat：数字 48-54px 字重 700 填 accent，下方 muted 小标签。
- 图表沿用配色体系：柱体填 accent（最大值一根 accentDeep）、基线 stroke="border"；timeline 用 accent 横线与实心圆点。
- 放不下时精简条目数，绝不缩小字号到 12 以下硬塞。`
  const ratioNote = carded
    ? `- 内容区范围：y 从 ${l.CONTENT_TOP} 到 ${l.CONTENT_BOTTOM}（Bento 网格已按此划分）`
    : plain
      ? `- 内容区范围：y 从 ${l.CONTENT_TOP} 到 ${l.CONTENT_BOTTOM}（规划稿的矩形指示各区块位置，但不要画出卡片底色）。朴素干货要贴边排版：四周留白 ≤ 24px，卡片矩形之间不留空隙，相邻区块的文字间隔 10-14px，铺满画布。`
      : `- 内容区范围：y 从 ${l.CONTENT_TOP} 到 ${l.CONTENT_BOTTOM}（规划稿的矩形仅作文字定位，不画卡片容器；文字不超出矩形）。`

  const instructions = `你是资深幻灯片设计师，为「${topic}」汇报绘制第 ${index}/${total} 页。**直接输出一个完整的 <svg> 源码**：不解释、不用 markdown 围栏、不要任何 <svg> 以外的文字。

## 硬性规则
1. 根元素必须是：<svg xmlns="http://www.w3.org/2000/svg" width="${l.W}" height="${l.H}" viewBox="0 0 ${l.W} ${l.H}" font-family="system-ui,'PingFang SC','Noto Sans CJK SC','Microsoft YaHei',sans-serif">
2. 严格禁止：<foreignObject>、<image>、<script>、<style> 里的 @import、外部链接、CSS 动画、emoji 字符。文字一律用 <text>/<tspan>。
3. XML 转义：文本里的 & 写成 &amp;，< 写成 &lt;，> 写成 &gt;。引号直接用即可。
4. 所有文字必须在画布内、不与其它元素重叠。文本行必须**手动换行**：用多个 <text> 或 <tspan x="相同" dy="行高">。
   行宽估算：1 个中文字符宽 ≈ 字号，1 个英文/数字字符 ≈ 0.52×字号。每行容量 = floor((容器宽 − 2×内边距) ÷ 字号)。宁缺毋滥，放不下就精简措辞，绝不溢出。
5. 页面底部留白：文字块底部距所在容器底边 ≥ 12px。
6. 数学公式：凡是公式（含上下标、根号、分式、求和等），不要用普通文本硬拼，也不要画图。写成占位元素（系统会替换成渲染好的矢量公式）：
   <text data-formula="LaTeX 源码" x="左边缘" y="基线" font-size="字号" fill="fg">公式的纯文本近似</text>
   LaTeX 源码里不要出现双引号，避免使用 & 对齐（矩阵改用 \\begin{gathered}）；XML 转义规则同样适用。

## 画布结构与配色（严格使用这些色值）
画布 ${l.W}×${l.H}。配色 tokens：${tokensBlock(style)}
- 全幅背景 rect：填 bg
- 页眉：kicker 在 (${l.PAD}, ${l.KICKER_Y})，字号 12，字重 600，填 accent，letter-spacing 2；主标题基线 (${l.PAD}, ${l.TITLE_Y})，字号 ${titleSize}，最多 22 个字（超长就缩到 ${titleOverflowSize}px 或不要标题，直接正文）。${
      carded
        ? 'Bento 卡片版式：主标题 700 填 fg。'
        : plain
          ? '朴素干货：标题位置不固定，随机自选（左上角 / 无标题 / 顶部居中 / 左侧竖排 / 居中大字）；若选默认左上角，基线参考 y=' + l.TITLE_Y + '。主标题用 Office 默认艺术字样式（font-weight=800 加粗，配色随机：纯色蓝 #4472C4/橙 #ED7D31/金 #FFC000/浅蓝 #5B9BD5/绿 #70AD47、黄底橙描边 #FFFF00+#FFC000、白字粗描边加投影、镂空字、白字加荧光边等），可加 1-2° 旋转，不画强调色短横线。'
          : '无卡片版式：主标题 700 填 fg（沿用当前风格字体与配色，不加艺术字）。'
    }
${style.footer ? `- 页脚：基线 (${l.PAD}, ${l.FOOTER_Y}) 左侧 10px 填 muted 写「${topic} · SimplePPT」；右侧 (${l.W - l.PAD}, ${l.FOOTER_Y}) text-anchor="end" 写页码「${String(index).padStart(2, '0')} / ${String(total).padStart(2, '0')}」` : '- 页脚：无'}

${ratioNote}

${styleRules}

## 特殊页面构图（无网格，cards 为空时使用）
- cover：左对齐构图。${
      carded
        ? `accent 短横线 rect(x=${l.PAD},y=252,w=64,h=6,rx=3)；kicker 13px accent letter-spacing 3 在 (${l.PAD}, 226)；主标题 56px 字重 700 fg，基线 (${l.PAD}, 330)（超过 14 字拆两行，第二行基线 +72）；副标题 17px muted 一行，基线 (${l.PAD}, 386)；底部 meta (${l.PAD}, 640) 13px muted。右上象限一组克制的几何装饰：2 个同心圆环 stroke="accent" opacity 0.25-0.4 + 1 个小实心方块，不与文字重叠。`
        : plain
          ? `kicker 15px accent letter-spacing 2 在 (${l.PAD}, ${l.CONTENT_TOP + 24})；主标题用 Office 艺术字样式（font-weight=800、fill="rgba(255,255,0,0.42)"、stroke="#FFC000" stroke-width=2 paint-order="stroke"）78px，基线 (${l.PAD}, ${l.CONTENT_TOP + 110})（超 12 字拆两行）；**不画任何强调色短横线**；副标题 20px muted 一行，基线 +72；**不要页脚 meta 行**；右下角放一个"问号小人"占位：<g data-question-person="1" x="1024" y="150" size="64"/>（不要画矢量轮廓）。重点词可用荧光笔。`
          : `kicker 13px accent letter-spacing 3 在 (${l.PAD}, ${l.CONTENT_TOP + 24})；主标题 56px 字重 700 fg，基线 (${l.PAD}, ${l.CONTENT_TOP + 110})（超过 14 字拆两行，第二行基线 +72）；副标题 17px muted 一行（基线 +60）；不加几何装饰、不加页脚 meta 行。`
    }
- ending：居中构图。${
      carded
        ? `行动号召大字 46px 字重 700 fg 居中（y=${Math.round(l.H * 0.47)}），下方 16px muted 说明一行（+56），accent 短横线居中（-40）。`
        : plain
          ? `行动号召用 Office 艺术字样式 50px 居中（y=${Math.round(l.H * 0.47)}），下方 16px muted 说明一行（+60），不加任何短横线。`
          : `行动号召大字 46px 字重 700 fg 居中（y=${Math.round(l.H * 0.47)}），下方 16px muted 说明一行（+56），不加任何短横线。`
    }
- quote：居中构图。大引号「“」用 90px accent 字重 700（y=${Math.round(l.H * 0.34)}）；引文 26px fg 居中最多两行（y=${Math.round(l.H * 0.47)} 起）；署名 14px muted（y=${Math.round(l.H * 0.62)}）。

## 待绘制页面
【策划稿】${json({ title: plan.title, kicker: plan.kicker, message: plan.message, pageType: plan.pageType, cards: plan.cards })}
【卡片矩形】${json(rects)}
【可用资料】${researchBlock}
【上下文】核心结论：${coreMessage}；上一页：${prevTitle ?? '（无）'}；下一页：${nextTitle ?? '（无）'}${
      advice ? `\n\n【用户的修改建议（针对本页，尽量保持版式结构，按建议调整措辞与内容）】\n${advice}` : ''
    }`
  return { instructions: H(instructions), user: '请输出这一页的完整 SVG。', maxTokens: 20000 }
}
