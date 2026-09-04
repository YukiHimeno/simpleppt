// SimplePPT 共享类型：客户端与服务端共同依赖

export type PageType = 'cover' | 'agenda' | 'content' | 'data' | 'quote' | 'ending'
export type PageRole = 'cover' | 'agenda' | 'point' | 'support' | 'ending'
export type CardKind =
  | 'stat'
  | 'text'
  | 'bullets'
  | 'compare'
  | 'timeline'
  | 'table'
  | 'chart-bar'
  | 'chart-line'
  | 'chart-donut'
  | 'highlight'

export type CanvasRatio = '16:9' | '4:3'

/** 幻灯片风格：既驱动 AI 生成的提示词，也驱动本地渲染器与导出 */
export interface SlideStyle {
  id: string
  name: string
  ratio: CanvasRatio
  bg: string
  fg: string
  muted: string
  card: string
  cardAlt: string
  accent: string
  accentDeep: string
  highlight: string
  border: string
  accentA: string
  radius: number
  /** true=绘制 Bento 卡片底；false=不画卡片容器（与 plain 互相独立） */
  carded: boolean
  /** true=朴素干货（手写讲义气质：艺术字标题、荧光笔、红圈、问号小人等） */
  plain: boolean
  footer: boolean
}

const BENTO_DARK: SlideStyle = {
  id: 'bento-dark',
  name: '便当网格 · 深色',
  ratio: '16:9',
  bg: '#1E1F24',
  card: '#27282E',
  cardAlt: '#2E2F36',
  fg: '#F1F2F4',
  muted: '#9EA1A9',
  accent: '#7EB3FF',
  accentDeep: '#3B82F6',
  highlight: '#FBBF24',
  border: 'rgba(255,255,255,0.09)',
  accentA: 'rgba(126,179,255,0.10)',
  radius: 18,
  carded: true,
  plain: false,
  footer: true,
}

const BENTO_LIGHT: SlideStyle = {
  ...BENTO_DARK,
  id: 'bento-light',
  name: '便当网格 · 浅色',
  bg: '#FBFBFC',
  card: '#FFFFFF',
  cardAlt: '#F3F5F8',
  fg: '#2A2A2E',
  muted: '#6E7076',
  accent: '#2E6FE8',
  accentDeep: '#1D4ED8',
  highlight: '#FDE68A',
  border: 'rgba(20,22,30,0.10)',
  accentA: 'rgba(46,111,232,0.08)',
}

/** 朴素干货风：白底黑字，重点标红加粗或黄色荧光笔，最常用的"潦草式干货" */
const PLAIN: SlideStyle = {
  id: 'plain',
  name: '朴素干货 · 4:3',
  ratio: '4:3',
  bg: '#FFFFFF',
  card: '#FFFFFF',
  cardAlt: '#F6F6F4',
  fg: '#1A1A1A',
  muted: '#5C5C5C',
  accent: '#FF0100',
  accentDeep: '#FF0100',
  highlight: '#FFFF00',
  border: 'rgba(0,0,0,0.16)',
  accentA: 'rgba(255,1,0,0.05)',
  radius: 0,
  carded: false,
  plain: true,
  footer: false,
}

/** Office 内置主题风格参考：低装饰、以配色与留白取胜，卡片尽量克制 */
const OFFICE_CLASSIC: SlideStyle = {
  id: 'office-classic',
  name: 'Office 经典',
  ratio: '16:9',
  bg: '#FFFFFF',
  card: '#FFFFFF',
  cardAlt: '#F2F5FA',
  fg: '#1F2328',
  muted: '#5E6673',
  accent: '#4472C4',
  accentDeep: '#2F5597',
  highlight: '#FFE699',
  border: 'rgba(31,56,100,0.16)',
  accentA: 'rgba(68,114,196,0.08)',
  radius: 6,
  carded: true,
  plain: false,
  footer: true,
}

const ION_TEAL: SlideStyle = {
  ...OFFICE_CLASSIC,
  id: 'ion-teal',
  name: '离子 · 青',
  bg: '#F7FCFB',
  card: '#FFFFFF',
  cardAlt: '#E9F6F3',
  fg: '#16302C',
  muted: '#5C7A74',
  accent: '#00A99D',
  accentDeep: '#007C73',
  highlight: '#B2EFE6',
  border: 'rgba(0,140,130,0.18)',
  accentA: 'rgba(0,169,157,0.08)',
}

const RETRO_PAPER: SlideStyle = {
  ...OFFICE_CLASSIC,
  id: 'retro-paper',
  name: '复古 · 米纸',
  bg: '#FBF6EC',
  card: '#FFFFFF',
  cardAlt: '#F1E8D6',
  fg: '#3E342A',
  muted: '#85745F',
  accent: '#B45309',
  accentDeep: '#8A3D07',
  highlight: '#F3D9A4',
  border: 'rgba(120,88,48,0.20)',
  accentA: 'rgba(180,83,9,0.07)',
  radius: 4,
}

const VIEW_BLUE: SlideStyle = {
  ...OFFICE_CLASSIC,
  id: 'view-blue',
  name: '视界 · 湛蓝',
  bg: '#F3F8FC',
  card: '#FFFFFF',
  cardAlt: '#E6F0F8',
  fg: '#14273A',
  muted: '#5A7186',
  accent: '#1F86C9',
  accentDeep: '#125A8F',
  highlight: '#BFE3F7',
  border: 'rgba(18,90,143,0.18)',
  accentA: 'rgba(31,134,201,0.08)',
}

const SLICE_GRAY: SlideStyle = {
  ...OFFICE_CLASSIC,
  id: 'slice-gray',
  name: '切片 · 石墨',
  bg: '#F4F5F6',
  card: '#FFFFFF',
  cardAlt: '#ECEEF1',
  fg: '#25282D',
  muted: '#6B7280',
  accent: '#44546A',
  accentDeep: '#2E3A4B',
  highlight: '#E3E8EF',
  border: 'rgba(46,58,75,0.18)',
  accentA: 'rgba(68,84,106,0.08)',
  radius: 0,
}

export const STYLE_PRESETS: SlideStyle[] = [PLAIN, BENTO_DARK, BENTO_LIGHT, OFFICE_CLASSIC, ION_TEAL, RETRO_PAPER, VIEW_BLUE, SLICE_GRAY]

export function stylePreset(id: string): SlideStyle {
  return STYLE_PRESETS.find((s) => s.id === id) ?? PLAIN
}

export function cloneStyle(s: SlideStyle): SlideStyle {
  return { ...s }
}

export interface ChartDatum {
  label: string
  value: number
}

export interface PlanCard {
  col: number
  colSpan: number
  row: number
  rowSpan: number
  kind: CardKind
  title?: string
  content: string | string[]
  data?: ChartDatum[]
  accent?: boolean
}

export interface CardRect extends PlanCard {
  x: number
  y: number
  w: number
  h: number
}

export interface PagePlan {
  pageId: string
  index: number
  title: string
  kicker: string
  message: string
  pageType: PageType
  speakerNote?: string
  notes?: string
  cards: PlanCard[]
  rects?: CardRect[]
}

export interface StickyPage {
  id: string
  title: string
  takeaway: string
  group: string
  role: PageRole
  pageType: PageType
  keyPoints: string[]
}

export interface Outline {
  coreMessage: string
  pages: StickyPage[]
}

export interface Fact {
  text: string
  source?: string | null
  confidence?: 'high' | 'medium' | 'low'
}

export interface Quote {
  text: string
  author?: string
  source?: string | null
}

export interface SourceRef {
  title?: string
  url: string
}

export interface PageResearch {
  pageId: string
  summary?: string
  facts: Fact[]
  quote?: Quote | null
  sources?: SourceRef[]
  status: 'pending' | 'running' | 'done' | 'error'
  error?: string
}

export interface InterviewQA {
  q: string
  why?: string
  suggestions?: string[]
  a: string
}

export interface InterviewSummary {
  audience: string
  goal: string
  scene: string
  scope: string
  tone: string
  keyMessages: string[]
  risks?: string[]
}

export interface Background {
  summary: string
  facts: Fact[]
  angles?: string[]
  sources: SourceRef[]
}

export interface ReferenceFile {
  id: string
  name: string
  chars: number
  truncated?: boolean
  text: string
}

export type RunStatus = 'pending' | 'running' | 'done' | 'error'

export interface SlideResult {
  svg?: string
  status: RunStatus
  error?: string
  attempts?: number
}

export interface Project {
  topic: string
  stage: 'home' | 'interview' | 'outline' | 'research' | 'plan' | 'slides'
  interview: {
    questions: InterviewQA[]
    questionsDone: boolean
    summary?: InterviewSummary | null
    summaryDone: boolean
  }
  referenceFiles: ReferenceFile[]
  background: Background | null
  backgroundStatus: RunStatus
  searchDegraded: string | null
  outline: Outline | null
  outlineStatus: RunStatus
  research: Record<string, PageResearch>
  plan: PagePlan[]
  planStatus: Record<string, RunStatus>
  slides: Record<string, SlideResult>
  updatedAt: number
}

export interface Settings {
  baseUrl: string
  apiKey: string
  model: string
  webSearch: boolean
  mock: boolean
  /** AI 搜索引擎密钥（用于资料检索，优先于 hosted web_search） */
  searchExaKey: string
  searchBraveKey: string
  searchTavilyKey: string
  /** 幻灯片风格（含自定义令牌） */
  style: SlideStyle
}

export const DEFAULT_SETTINGS: Settings = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: '',
  webSearch: true,
  mock: false,
  searchExaKey: '',
  searchBraveKey: '',
  searchTavilyKey: '',
  style: cloneStyle(PLAIN),
}
