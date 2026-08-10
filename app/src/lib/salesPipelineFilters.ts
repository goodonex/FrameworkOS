import type { Contact, PotenzialTyp, PipelineStage } from '../types/db'

/**
 * Die Stufen der Pipeline in ihrer Reihenfolge — und ihre Beschriftung.
 *
 * Die Beschriftung stand bis Phase 2 zweimal als lokales `STAGE_LABEL` in
 * Komponenten. Sie gehoert dorthin, wo auch die Reihenfolge steht, sonst
 * benennt der Neubau die Stufen anders als die Altwelt daneben.
 */
export const PIPELINE_STAGES: PipelineStage[] = [
  'first_contact',
  'conversation',
  'follow_up',
  'proposal',
  'deal',
  'paused',
]

export const STAGE_LABEL: Record<PipelineStage, string> = {
  first_contact: 'Erstkontakt',
  conversation: 'Gespräch',
  follow_up: 'Follow up',
  proposal: 'Pitch',
  deal: 'Deal',
  paused: 'Pause',
}

export type StageFilter = 'all' | Contact['pipeline_stage']
export type FollowFilter = 'all' | 'today' | 'week' | 'none'
export type PotenzialFilter = 'all' | 'lt1k' | '1k5k' | '5k10k' | 'gt10k'

export function ymdToday(): string {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

export function weekRangeYmd(): { start: string; end: string } {
  const now = new Date()
  const day = (now.getDay() + 6) % 7
  const start = new Date(now)
  start.setDate(now.getDate() - day)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const toY = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { start: toY(start), end: toY(end) }
}

export function matchesPotenzialBucket(
  betrag: number,
  f: PotenzialFilter,
): boolean {
  if (f === 'all') return true
  const b = Math.max(0, betrag)
  if (f === 'lt1k') return b > 0 && b < 1000
  if (f === '1k5k') return b >= 1000 && b < 5000
  if (f === '5k10k') return b >= 5000 && b <= 10000
  if (f === 'gt10k') return b > 10000
  return true
}

/** Jahresäquivalent für Pipeline-Wert / Anzeige */
export function annualEuroForPotenzial(betrag: number, typ: PotenzialTyp): number {
  const b = Math.max(0, betrag)
  if (typ === 'monatlich') return b * 12
  if (typ === 'jährlich') return b
  return b
}

export function pipelineValueEuro(contacts: Contact[]): number {
  return contacts
    .filter((c) => c.pipeline_stage !== 'paused')
    .reduce(
      (sum, c) =>
        sum +
        annualEuroForPotenzial(c.potenzial_betrag ?? 0, c.potenzial_typ ?? 'einmalig'),
      0,
    )
}

export function parseStageFilter(raw: string | null): StageFilter {
  if (!raw || raw === 'all') return 'all'
  if ((PIPELINE_STAGES as readonly string[]).includes(raw)) return raw as StageFilter
  return 'all'
}

export function parseFollowFilter(raw: string | null): FollowFilter {
  if (raw === 'today' || raw === 'week' || raw === 'none') return raw
  return 'all'
}

export function parsePotenzialFilter(raw: string | null): PotenzialFilter {
  if (raw === 'lt1k' || raw === '1k5k' || raw === '5k10k' || raw === 'gt10k') return raw
  return 'all'
}

export function filtersFromSearchParams(search: URLSearchParams): {
  q: string
  stage: StageFilter
  follow: FollowFilter
  potenzial: PotenzialFilter
} {
  return {
    q: search.get('pipeQ') ?? '',
    stage: parseStageFilter(search.get('pipeStage')),
    follow: parseFollowFilter(search.get('pipeFollow')),
    potenzial: parsePotenzialFilter(search.get('pipePotenzial')),
  }
}

export function filterPipelineContacts(
  items: Contact[],
  opts: {
    q: string
    stage: StageFilter
    follow: FollowFilter
    potenzial: PotenzialFilter
  },
): Contact[] {
  const q = opts.q.trim().toLowerCase()
  const { start: wStart, end: wEnd } = weekRangeYmd()
  const today = ymdToday()

  return items.filter((c) => {
    if (opts.stage !== 'all' && c.pipeline_stage !== opts.stage) return false

    if (opts.follow === 'today') {
      const nx = c.next_follow_up_at?.slice(0, 10)
      if (!nx || nx > today) return false
    } else if (opts.follow === 'week') {
      const nx = c.next_follow_up_at?.slice(0, 10)
      if (!nx || nx < wStart || nx > wEnd) return false
    } else if (opts.follow === 'none') {
      if (c.next_follow_up_at && c.next_follow_up_at.trim()) return false
    }

    if (!matchesPotenzialBucket(c.potenzial_betrag ?? 0, opts.potenzial)) return false

    if (q) {
      const hay = [
        c.name,
        c.company,
        c.email,
      ]
        .join(' ')
        .toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

export function formatEuroDe(n: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)
}

export function potenzialKanbanLabel(c: Contact): string | null {
  const b = c.potenzial_betrag ?? 0
  if (b <= 0) return null
  const typ = c.potenzial_typ ?? 'einmalig'
  if (typ === 'monatlich') {
    return `${formatEuroDe(b)} / Mo`
  }
  return formatEuroDe(b)
}
