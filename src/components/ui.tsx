import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, CheckCircle2, Info, Loader2, X } from 'lucide-react'

export const cn = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(' ')

/* ---------------- Button ---------------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg' | 'icon'
}

export function Button({ variant = 'primary', size = 'md', className, ...rest }: ButtonProps) {
  const base =
    'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50'
  const v = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
    outline: 'border border-border bg-transparent hover:bg-muted',
    ghost: 'hover:bg-muted',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  }[variant]
  const s = { sm: 'h-8 px-3 text-xs', md: 'h-9 px-4 text-sm', lg: 'h-11 px-6 text-sm', icon: 'h-9 w-9' }[size]
  return <button className={cn(base, v, s, className)} {...rest} />
}

/* ---------------- 基础元素 ---------------- */

export function Badge({ children, tone = 'default', className }: { children: ReactNode; tone?: 'default' | 'primary' | 'success' | 'warn' | 'outline'; className?: string }) {
  const t = {
    default: 'bg-muted text-muted-foreground',
    primary: 'bg-primary/10 text-primary',
    success: 'bg-green-500/10 text-green-600 dark:text-green-400',
    warn: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    outline: 'border border-border text-muted-foreground',
  }[tone]
  return <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium', t, className)}>{children}</span>
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-9 w-full border border-input bg-background px-3 text-sm placeholder:text-muted-foreground/70 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring disabled:opacity-50',
        className,
      )}
      {...rest}
    />
  )
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'min-h-[76px] w-full resize-y border border-input bg-background px-3 py-2 text-sm leading-relaxed placeholder:text-muted-foreground/70 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring disabled:opacity-50',
        className,
      )}
      {...rest}
    />
  )
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn('h-9 w-full border border-input bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring', className)}
      {...rest}
    >
      {children}
    </select>
  )
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('text-xs font-medium text-muted-foreground', className)}>{children}</div>
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs leading-relaxed text-muted-foreground/80">{hint}</p>}
    </div>
  )
}

export function Card({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border border-border bg-card text-card-foreground', className)} {...rest} />
}

export function Separator({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-border', className)} />
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin', className)} />
}

export function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-border transition-colors disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-input',
      )}
    >
      <span className={cn('inline-block h-3.5 w-3.5 rounded-full bg-background shadow transition-transform', checked ? 'translate-x-[18px]' : 'translate-x-[3px]')} />
    </button>
  )
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden bg-muted', className)}>
      <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

export function StatusDot({ status }: { status: 'pending' | 'running' | 'done' | 'error' }) {
  const c = {
    pending: 'bg-muted-foreground/40',
    running: 'bg-primary animate-pulse',
    done: 'bg-green-500',
    error: 'bg-destructive',
  }[status]
  return <span className={cn('inline-block h-2 w-2 rounded-full', c)} />
}

/* ---------------- Dialog ---------------- */

export function Dialog({ open, onClose, title, children, wide }: { open: boolean; onClose?: () => void; title?: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div className={cn('relative z-10 w-full animate-fade-up border border-border bg-popover text-popover-foreground shadow-2xl', wide ? 'max-w-3xl' : 'max-w-lg')}>
        {title !== undefined && (
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="text-sm font-semibold">{title}</div>
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="关闭">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
        <div className="max-h-[80vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

/* ---------------- Toast（飞向鼠标，等待手动关闭） ---------------- */

type ToastItem = { id: number; text: string; kind: 'info' | 'success' | 'error'; mx: number; my: number }
const ToastCtx = createContext<{ notify: (text: string, kind?: ToastItem['kind']) => void } | null>(null)

function clampToViewport(x: number, y: number, w: number, h: number) {
  const pad = 8
  return {
    x: Math.min(Math.max(x, pad), Math.max(pad, window.innerWidth - w - pad)),
    y: Math.min(Math.max(y, pad), Math.max(pad, window.innerHeight - h - pad)),
  }
}

function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const [landed, setLanded] = useState(false)
  const [draining, setDraining] = useState(false)
  const start = useMemo(
    () => ({
      x: Math.max(8, window.innerWidth - 336),
      y: Math.max(8, window.innerHeight - 96),
    }),
    [],
  )
  const target = useMemo(() => clampToViewport(item.mx + 16, item.my - 24, 320, 96), [item.mx, item.my])

  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setLanded(true)))
    return () => cancelAnimationFrame(raf)
  }, [])

  // 到位置后开始 10s 倒计时，倒计时结束自动消失
  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setDraining(true)))
    const timer = setTimeout(onClose, 10_000)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [onClose])

  const kindClass =
    item.kind === 'error'
      ? 'border-l-destructive text-destructive'
      : item.kind === 'success'
        ? 'border-l-green-500 text-green-600 dark:text-green-400'
        : 'border-l-primary text-primary'
  const Icon = item.kind === 'error' ? AlertCircle : item.kind === 'success' ? CheckCircle2 : Info
  const pos = landed ? target : start

  return (
    <div
      className="fixed z-[70] max-w-[calc(100vw-16px)]"
      style={{
        left: pos.x,
        top: pos.y,
        transition: 'left 550ms cubic-bezier(0.22, 0.61, 0.36, 1), top 550ms cubic-bezier(0.22, 0.61, 0.36, 1)',
      }}
    >
      <div
        className={cn(
          'pointer-events-auto relative flex w-80 max-w-full items-start gap-2.5 overflow-hidden rounded-md border border-border border-l-4 bg-popover px-3 py-2.5 text-sm text-foreground shadow-2xl ring-1 ring-black/5',
          item.kind === 'error'
            ? 'border-l-destructive'
            : item.kind === 'success'
              ? 'border-l-green-500'
              : 'border-l-primary',
        )}
      >
        <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', kindClass)} />
        <span className="min-w-0 flex-1 leading-snug">{item.text}</span>
        <button
          onClick={onClose}
          aria-label="关闭提示"
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <span
          aria-hidden
          className="absolute bottom-0 left-0 h-0.5 bg-primary/70"
          style={{
            width: draining ? '0%' : '100%',
            transition: draining ? 'width 10s linear' : 'none',
          }}
        />
      </div>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const pointer = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 })

  useEffect(() => {
    const h = (e: PointerEvent) => {
      pointer.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('pointermove', h)
    return () => window.removeEventListener('pointermove', h)
  }, [])

  const notify = useCallback((text: string, kind: ToastItem['kind'] = 'info') => {
    const id = Date.now() + Math.random()
    const { x, y } = pointer.current
    setItems((xs) => [...xs, { id, text, kind, mx: x, my: y }])
  }, [])

  return (
    <ToastCtx.Provider value={{ notify }}>
      {children}
      {items.map((t) => (
        <ToastCard key={t.id} item={t} onClose={() => setItems((xs) => xs.filter((x) => x.id !== t.id))} />
      ))}
    </ToastCtx.Provider>
  )
}

export function useToast() {
  const v = useContext(ToastCtx)
  if (!v) throw new Error('useToast must be used within ToastProvider')
  return v
}
