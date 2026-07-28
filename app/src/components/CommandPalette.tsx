import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useBrands } from '../hooks/useBrands'
import { useBrandId } from '../hooks/useBrandId'
import { useContacts } from '../hooks/useContacts'
import { useDeliverProjects } from '../hooks/useDeliverProjects'
import { useICPs } from '../hooks/useICPs'
import { useUiTheme } from '../hooks/useUiTheme'
import { useToast } from './Toast'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

type CommandKind = 'nav' | 'brand' | 'contact' | 'project' | 'icp' | 'action'

interface Command {
  id: string
  kind: CommandKind
  title: string
  subtitle?: string
  keywords?: string[]
  icon?: ReactNode
  accent?: string
  run: () => void
}

const KIND_LABEL: Record<CommandKind, string> = {
  nav: 'Navigation',
  brand: 'Brands',
  contact: 'Kontakte',
  project: 'Projekte',
  icp: 'ICPs',
  action: 'Aktionen',
}

const KIND_ORDER: CommandKind[] = ['nav', 'action', 'brand', 'contact', 'project', 'icp']

function fuzzyMatch(haystack: string, needle: string): number {
  if (!needle) return 1
  const h = haystack.toLowerCase()
  const n = needle.toLowerCase()
  if (h.includes(n)) return 100 - (h.indexOf(n) * 0.1)
  let score = 0
  let hi = 0
  for (const ch of n) {
    const next = h.indexOf(ch, hi)
    if (next === -1) return 0
    score += 1 / (next - hi + 1)
    hi = next + 1
  }
  return score
}

function scoreCommand(cmd: Command, query: string): number {
  if (!query) return 1
  const title = fuzzyMatch(cmd.title, query)
  const subtitle = cmd.subtitle ? fuzzyMatch(cmd.subtitle, query) : 0
  const keywords = (cmd.keywords ?? []).reduce(
    (best, k) => Math.max(best, fuzzyMatch(k, query)),
    0,
  )
  return Math.max(title * 1.5, subtitle, keywords)
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const { show } = useToast()
  const brandId = useBrandId(slug)
  const { brands } = useBrands()
  const contacts = useContacts(slug)
  const projects = useDeliverProjects(slug)
  const icps = useICPs(slug)
  const { togglePlainLight } = useUiTheme()

  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIdx(0)
      setTimeout(() => inputRef.current?.focus(), 60)
    }
  }, [open])

  const close = useCallback(() => {
    onClose()
  }, [onClose])

  const goTo = useCallback(
    (path: string) => {
      navigate(path)
      close()
    },
    [navigate, close],
  )

  const copyOnboardingLink = useCallback(() => {
    if (!brandId || typeof window === 'undefined') {
      show('Brand nicht geladen.', 'error')
      return
    }
    const url = `${window.location.origin}/onboarding/${brandId}`
    if (!navigator.clipboard) {
      show('Clipboard nicht verfügbar.', 'error')
      return
    }
    void navigator.clipboard.writeText(url).then(
      () => show('Fragebogen-Link kopiert', 'success'),
      () => show('Kopieren fehlgeschlagen.', 'error'),
    )
    close()
  }, [brandId, show, close])

  const allCommands = useMemo<Command[]>(() => {
    const list: Command[] = []
    const base = slug ? `/brand/${slug}` : ''

    if (slug) {
      const navItems: Array<{
        path: string
        title: string
        keywords: string[]
        accent: string
      }> = [
        { path: 'dashboard', title: 'Dashboard', keywords: ['heute', 'home', 'startseite'], accent: 'var(--accent-blue)' },
        { path: 'promo', title: 'Promo', keywords: ['content', 'kampagne', 'social'], accent: 'var(--mode-promo)' },
        { path: 'deliver', title: 'Deliver', keywords: ['kunden', 'projekte', 'lieferung'], accent: 'var(--accent-teal)' },
      ]
      for (const n of navItems) {
        list.push({
          id: `nav-${n.path}`,
          kind: 'nav',
          title: n.title,
          subtitle: 'Wechseln',
          keywords: n.keywords,
          accent: n.accent,
          run: () => goTo(`${base}/${n.path}`),
        })
      }
    }

    // Phase 6: Universe abgerissen — Cockpit-Bereiche sind die neue Welt
    for (const item of [
      { id: 'nav-cockpit', title: 'Cockpit', path: '/cockpit', keywords: ['home', 'start', 'übersicht', 'graph'] },
      { id: 'nav-sales', title: 'Sales', path: '/sales', keywords: ['crm', 'pipeline', 'kontakte', 'leads', 'call', 'bibliothek'] },
      { id: 'nav-email', title: 'E-Mail', path: '/email', keywords: ['mail', 'sequenzen', 'flows', 'versand'] },
      { id: 'nav-tracking', title: 'Tracking', path: '/tracking', keywords: ['kpi', 'looms', 'anfragen', 'umsatz', 'ziele'] },
    ]) {
      list.push({
        id: item.id,
        kind: 'nav',
        title: item.title,
        subtitle: 'Cockpit',
        keywords: item.keywords,
        run: () => goTo(item.path),
      })
    }

    if (slug) {
      list.push({
        id: 'action-copy-onboarding',
        kind: 'action',
        title: 'Fragebogen-Link kopieren',
        subtitle: 'Onboarding-URL für aktuellen Brand',
        keywords: ['onboarding', 'questionnaire', 'link'],
        accent: 'var(--accent-teal)',
        run: copyOnboardingLink,
      })
      list.push({
        id: 'action-new-contact',
        kind: 'action',
        title: '+ Neuer Kontakt',
        subtitle: 'In Sales-Pipeline',
        keywords: ['lead', 'kontakt', 'neu'],
        accent: 'var(--mode-sales)',
        run: () => goTo(`${base}/sales?action=new-contact`),
      })
      list.push({
        id: 'action-new-project',
        kind: 'action',
        title: '+ Neues Projekt',
        subtitle: 'In Deliver',
        keywords: ['projekt', 'kunde', 'neu'],
        accent: 'var(--accent-teal)',
        run: () => goTo(`${base}/deliver?action=new-project`),
      })
    }

    list.push({
      id: 'action-toggle-theme',
      kind: 'action',
      title: 'Hell/Dunkel-Modus umschalten',
      subtitle: 'UI-Theme',
      keywords: ['theme', 'light', 'dark', 'hell', 'dunkel', 'modus'],
      accent: 'var(--accent-amber)',
      run: () => {
        togglePlainLight()
        close()
      },
    })

    for (const b of brands) {
      if (b.slug === slug) continue
      list.push({
        id: `brand-${b.id}`,
        kind: 'brand',
        title: b.name,
        subtitle: `Brand · ${b.slug}`,
        keywords: [b.slug, 'brand', 'wechseln'],
        accent: b.color && !b.color.startsWith('var(') ? b.color : 'var(--accent-teal)',
        run: () => goTo(`/brand/${b.slug}/dashboard`),
      })
    }

    if (slug) {
      // Index alle Contacts inkl. Notes + Custom Fields + Tags
      for (const c of contacts.items.slice(0, 200)) {
        const title = c.name || c.email || c.phone || 'Unbenannt'
        const subtitle = [c.company, c.email, c.pipeline_stage]
          .filter((x) => x && String(x).trim())
          .join(' · ')
        const cfValues = Object.values(c.custom_fields ?? {})
          .map((v) => (typeof v === 'string' ? v : String(v)))
          .filter(Boolean)
        const keywords = [
          c.email,
          c.phone,
          c.company,
          c.pipeline_stage,
          c.notes,
          c.call_notes,
          c.bedarf,
          c.ansprechpartner,
          c.hauptproblem,
          c.naechste_schritte,
          c.einwaende,
          c.timeline,
          c.budget,
          ...((c.tags ?? []) as string[]),
          ...cfValues,
        ].filter(Boolean) as string[]
        list.push({
          id: `contact-${c.id}`,
          kind: 'contact',
          title,
          subtitle: subtitle || 'Kontakt',
          keywords,
          accent: 'var(--mode-sales)',
          run: () => goTo(`${base}/sales/${c.id}`),
        })
      }

      for (const p of projects.items.slice(0, 30)) {
        list.push({
          id: `project-${p.id}`,
          kind: 'project',
          title: p.name,
          subtitle: `Projekt · ${p.client_name || 'ohne Kunde'} · ${p.status}`,
          keywords: [p.client_name, p.status, p.internal_stage].filter(Boolean) as string[],
          accent: 'var(--accent-teal)',
          run: () => goTo(`${base}/deliver/${p.id}`),
        })
      }

      for (const icp of icps.items.slice(0, 20)) {
        const priorityLabel =
          icp.priority === 1 ? 'Primary' : icp.priority === 2 ? 'Secondary' : 'Tertiary'
        list.push({
          id: `icp-${icp.id}`,
          kind: 'icp',
          title: icp.name || 'Unbenannter ICP',
          subtitle: `ICP · ${priorityLabel}${icp.location ? ' · ' + icp.location : ''}`,
          keywords: [icp.location, icp.age_range].filter(Boolean) as string[],
          accent: 'var(--mode-building)',
          run: () => goTo(`${base}/foundation`),
        })
      }
    }

    return list
  }, [slug, brands, contacts.items, projects.items, icps.items, goTo, copyOnboardingLink, togglePlainLight, close])

  const filtered = useMemo(() => {
    const scored = allCommands
      .map((cmd) => ({ cmd, score: scoreCommand(cmd, query) }))
      .filter((x) => x.score > 0)
    scored.sort((a, b) => b.score - a.score)

    if (!query) {
      const byKind: Record<string, Command[]> = {}
      for (const { cmd } of scored) {
        ;(byKind[cmd.kind] ??= []).push(cmd)
      }
      const groups = KIND_ORDER.map((k) => ({ kind: k, items: byKind[k] ?? [] })).filter(
        (g) => g.items.length > 0,
      )
      return { mode: 'grouped' as const, groups, flat: groups.flatMap((g) => g.items) }
    }

    const flat = scored.slice(0, 30).map((x) => x.cmd)
    return { mode: 'flat' as const, groups: [], flat }
  }, [allCommands, query])

  const flat = filtered.flat

  useEffect(() => {
    setActiveIdx(0)
  }, [query])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx((i) => Math.min(flat.length - 1, i + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx((i) => Math.max(0, i - 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const cmd = flat[activeIdx]
        if (cmd) cmd.run()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, flat, activeIdx, close])

  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector<HTMLLIElement>(`[data-cmd-idx="${activeIdx}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="cmdk-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close()
          }}
          className="fixed inset-0 z-[80] flex items-start justify-center"
          style={{
            background: 'var(--overlay-backdrop)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            paddingTop: '12vh',
            pointerEvents: 'auto',
          }}
        >
          <motion.div
            key="cmdk-panel"
            initial={{ opacity: 0, y: -12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="font-body w-full"
            style={{
              maxWidth: 640,
              maxHeight: '70vh',
              margin: '0 16px',
              borderRadius: 18,
              background: 'color-mix(in srgb, var(--bg-base) 92%, transparent)',
              border: '1px solid var(--glass-border-2)',
              boxShadow: 'var(--shadow-lg), 0 1px 0 var(--glass-border-1) inset',
              backdropFilter: 'var(--blur-lg)',
              WebkitBackdropFilter: 'var(--blur-lg)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              className="flex items-center gap-3"
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--glass-border-1)',
              }}
            >
              <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }}>
                <circle cx="7" cy="7" r="4" />
                <path d="M10 10 L13 13" strokeLinecap="round" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Suchen oder Aktion ausführen …"
                className="flex-1 bg-transparent outline-none"
                style={{
                  fontSize: 15,
                  color: 'var(--text-primary)',
                }}
              />
              <span
                className="font-mono"
                style={{
                  fontSize: 10,
                  padding: '3px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--glass-border-2)',
                  color: 'var(--text-tertiary)',
                  letterSpacing: '0.08em',
                }}
              >
                ESC
              </span>
            </div>

            <ul
              ref={listRef}
              className="min-h-0 flex-1 overflow-y-auto"
              style={{ padding: 8 }}
            >
              {flat.length === 0 ? (
                <li
                  className="font-mono"
                  style={{
                    padding: '24px 12px',
                    textAlign: 'center',
                    fontSize: 12,
                    color: 'var(--text-tertiary)',
                  }}
                >
                  Nichts gefunden für „{query}"
                </li>
              ) : filtered.mode === 'grouped' ? (
                filtered.groups.map((group) => {
                  let baseIdx = 0
                  for (const g of filtered.groups) {
                    if (g === group) break
                    baseIdx += g.items.length
                  }
                  return (
                    <div key={group.kind}>
                      <li
                        className="font-mono"
                        style={{
                          padding: '10px 12px 4px',
                          fontSize: 9,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          color: 'var(--text-tertiary)',
                        }}
                      >
                        {KIND_LABEL[group.kind]}
                      </li>
                      {group.items.map((cmd, i) => (
                        <CommandRow
                          key={cmd.id}
                          cmd={cmd}
                          active={activeIdx === baseIdx + i}
                          idx={baseIdx + i}
                          onActivate={() => cmd.run()}
                          onHover={() => setActiveIdx(baseIdx + i)}
                        />
                      ))}
                    </div>
                  )
                })
              ) : (
                flat.map((cmd, i) => (
                  <CommandRow
                    key={cmd.id}
                    cmd={cmd}
                    active={activeIdx === i}
                    idx={i}
                    onActivate={() => cmd.run()}
                    onHover={() => setActiveIdx(i)}
                  />
                ))
              )}
            </ul>

            <div
              className="font-mono flex items-center justify-between"
              style={{
                padding: '8px 14px',
                borderTop: '1px solid var(--glass-border-1)',
                fontSize: 10,
                color: 'var(--text-tertiary)',
                letterSpacing: '0.06em',
              }}
            >
              <span>↑ ↓ Navigieren · ↵ Auswählen</span>
              <span>{flat.length} Treffer</span>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function CommandRow({
  cmd,
  active,
  idx,
  onActivate,
  onHover,
}: {
  cmd: Command
  active: boolean
  idx: number
  onActivate: () => void
  onHover: () => void
}) {
  const accent = cmd.accent ?? 'var(--text-accent)'
  return (
    <li data-cmd-idx={idx}>
      <button
        type="button"
        onMouseEnter={onHover}
        onClick={onActivate}
        className="flex w-full items-center gap-3 rounded-lg text-left transition-colors"
        style={{
          padding: '9px 12px',
          background: active ? 'var(--glass-2)' : 'transparent',
          border: `1px solid ${active ? 'var(--glass-border-2)' : 'transparent'}`,
          color: 'var(--text-primary)',
          cursor: 'pointer',
        }}
      >
        <span
          className="flex shrink-0 items-center justify-center"
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: `color-mix(in srgb, ${accent} 14%, transparent)`,
            color: accent,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {kindGlyph(cmd.kind)}
        </span>
        <span className="min-w-0 flex-1 truncate">
          <span style={{ fontSize: 13, fontWeight: 500, display: 'block' }}>{cmd.title}</span>
          {cmd.subtitle ? (
            <span
              className="font-mono truncate"
              style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'block' }}
            >
              {cmd.subtitle}
            </span>
          ) : null}
        </span>
        {active ? (
          <span
            className="font-mono"
            style={{
              fontSize: 10,
              padding: '2px 6px',
              borderRadius: 5,
              border: '1px solid var(--glass-border-2)',
              color: 'var(--text-tertiary)',
            }}
          >
            ↵
          </span>
        ) : null}
      </button>
    </li>
  )
}

function kindGlyph(kind: CommandKind): string {
  switch (kind) {
    case 'nav':
      return '⌖'
    case 'brand':
      return '◇'
    case 'contact':
      return '@'
    case 'project':
      return '▲'
    case 'icp':
      return '◉'
    case 'action':
      return '+'
    default:
      return '·'
  }
}
