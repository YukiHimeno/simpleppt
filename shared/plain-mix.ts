// Deterministic "pages copied from other decks" picker for the plain/dry style.
// A plain deck looks more real when a couple of pages were clearly pasted from
// another PPT, so the same seed always yields the same mixed pages and styles.
import { STYLE_PRESETS } from './types'

export interface MixedPage {
  page: number
  styleId: string
}

/** Small deterministic PRNG from a string seed. */
function seededRng(seed: string): () => number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return () => {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0
    return h / 4294967296
  }
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
  return arr
}

/**
 * Pick the pages (2..total, excluding the cover) that should be rendered in a
 * foreign style: one page for decks under 15 slides, two pages otherwise.
 */
export function plainMixedPages(seedKey: string, total: number): MixedPage[] {
  if (total <= 1) return []
  const count = total < 15 ? 1 : 2
  const rng = seededRng(seedKey)
  const pages: number[] = []
  for (let p = 2; p <= total; p++) pages.push(p)
  const chosen = shuffle(pages, rng).slice(0, Math.min(count, pages.length)).sort((a, b) => a - b)
  if (chosen.length === 0) return []
  const pool = shuffle(
    STYLE_PRESETS.filter((s) => s.id !== 'plain').map((s) => s.id),
    rng,
  )
  return chosen.map((page, i) => ({ page, styleId: pool[i % pool.length] }))
}
