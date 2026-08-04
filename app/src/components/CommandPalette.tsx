import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { readStoredBrandSlug } from '../cockpit/lib/activeBrand'
import { PALETTEN_BEREICHE } from '../cockpit/lib/bereiche'
import { useContacts } from '../hooks/useContacts'
import { useDeliverProjects } from '../hooks/useDeliverProjects'
import { useUiTheme } from '../hooks/useUiTheme'

/**
 * Command-Palette (Cmd+K). Etappe 4, Schritt 1: von Glas auf ck-Optik, und vom
 * halben Index auf den vollen.
 *
 * Was hier vorher schieflag: Sie kannte 3 Cockpit-Bereiche von 11 und führte
 * daneben Kommandos in die alte Brand-Welt (`/brand/:slug/deliver`,
 * `/brand/:slug/foundation`), die längst auf `/cockpit` umgeleitet werden — ein
 * Treffer, ein Klick, und man stand woanders. Die ICP-Einträge waren komplett
 * tot: jeder landete auf derselben Redirect-Seite.
 *
 * Der Brand-Slug kommt aus `readStoredBrandSlug()`, nicht aus `useParams` — die
 * Palette hängt über der CockpitShell und damit außerhalb des Brand-Kontexts.
 * Vorher stand dort ein leerer Slug, weshalb Kontakte und Projekte im Cockpit
 * gar nicht erst indiziert wurden.
 */

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

type CommandKind = 'nav' | 'contact' | 'project' | 'action'

interface Command {
  id: string
  kind: CommandKind
  title: string
  subtitle?: string
  keywords?: string[]
  run: () => void
}

const KIND_LABEL: Record<CommandKind, string> = {
  nav: 'Bereiche',
  action: 'Aktionen',
  contact: 'Kontakte',
  project: 'Projekte',
}

const KIND_ORDER: CommandKind[] = ['nav', 'action', 'contact', 'project']

const KIND_GLYPH: Record<CommandKind, string> = {
  nav: '⌖',
  action: '+',
  contact: '@',
  project: '◈',
}

function fuzzyMatch(haystack: string, needle: string): number {
  if (!needle) return 1
  const h = haystack.toLowerCase()
  const n = needle.toLowerCase()
  if (h.includes(n)) return 100 - h.indexOf(n) * 0.1
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
  const keywords = (cmd.keywords ?? []).reduce((best, k) => Math.max(best, fuzzyMatch(k, query)), 0)
  return Math.max(title * 1.5, subtitle, keywords)
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate()
  const slug = readStoredBrandSlug()
  const contacts = useContacts(slug)
  const projects = useDeliverProjects(slug)
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

  const close = useCallback(() => onClose(), [onClose])

  const goTo = useCallback(
    (path: string) => {
      navigate(path)
      close()
    },
    [navigate, close],
  )

  const allCommands = useMemo<Command[]>(() => {
    const list: Command[] = []

    for (const b of PALETTEN_BEREICHE) {
      list.push({
        id: `nav-${b.path}`,
        kind: 'nav',
        title: b.label,
        subtitle: b.path,
        keywords: b.keywords,
        run: () => goTo(b.path),
      })
    }

    list.push({
      id: 'action-new-contact',
      kind: 'action',
      title: 'Neuer Lead',
      subtitle: 'Sales · Kontakt anlegen',
      keywords: ['lead', 'kontakt', 'neu', 'anlegen'],
      run: () => goTo('/sales/new'),
    })
    list.push({
      id: 'action-toggle-theme',
      kind: 'action',
      title: 'Hell/Dunkel-Modus umschalten',
      subtitle: 'UI-Theme',
      keywords: ['theme', 'light', 'dark', 'hell', 'dunkel', 'modus'],
      run: () => {
        togglePlainLight()
        close()
      },
    })

    for (const c of contacts.items.slice(0, 200)) {
      const title = c.name || c.email || c.phone || 'Unbenannt'
      const subtitle = [c.company, c.email, c.pipeline_stage].filter((x) => x && String(x).trim()).join(' · ')
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
        run: () => goTo(`/sales/${c.id}`),
      })
    }

    for (const p of projects.items.slice(0, 30)) {
      list.push({
        id: `project-${p.id}`,
        kind: 'project',
        title: p.name,
        subtitle: `${p.client_name || 'ohne Kunde'} · ${p.status}`,
        keywords: [p.client_name, p.status, p.internal_stage].filter(Boolean) as string[],
        run: () => goTo(`/projekte/${p.id}`),
      })
    }

    return list
  }, [contacts.items, projects.items, goTo, togglePlainLight, close])

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
        flat[activeIdx]?.run()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, flat, activeIdx, close])

  useEffect(() => {
    if (!listRef.current) return
    listRef.current
      .querySelector<HTMLLIElement>(`[data-cmd-idx="${activeIdx}"]`)
      ?.scrollIntoView({ block: 'nearest' })
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
          className="ck-cmdk-backdrop"
        >
          <motion.div
            key="cmdk-panel"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="ck-cmdk"
          >
            <div className="ck-cmdk-head">
              <span aria-hidden className="ck-cmdk-glyph">
                ⌕
              </span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Bereich, Kontakt oder Projekt …"
                aria-label="Suchen oder Aktion ausführen"
                className="ck-cmdk-input"
              />
              <span className="ck-cmdk-key">ESC</span>
            </div>

            <ul ref={listRef} className="ck-cmdk-list">
              {flat.length === 0 ? (
                <li className="ck-cmdk-leer">Nichts gefunden für „{query}"</li>
              ) : filtered.mode === 'grouped' ? (
                filtered.groups.map((group) => {
                  let baseIdx = 0
                  for (const g of filtered.groups) {
                    if (g === group) break
                    baseIdx += g.items.length
                  }
                  return (
                    <div key={group.kind}>
                      <li className="ck-label ck-cmdk-gruppe">{KIND_LABEL[group.kind]}</li>
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

            <div className="ck-cmdk-fuss">
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
  return (
    <li data-cmd-idx={idx}>
      <button
        type="button"
        onMouseEnter={onHover}
        onClick={onActivate}
        className={`ck-cmdk-row${active ? ' ck-cmdk-row--aktiv' : ''}`}
      >
        <span aria-hidden className="ck-cmdk-row-glyph">
          {KIND_GLYPH[cmd.kind]}
        </span>
        <span className="ck-cmdk-row-text">
          <span className="ck-cmdk-row-titel">{cmd.title}</span>
          {cmd.subtitle ? <span className="ck-cmdk-row-sub">{cmd.subtitle}</span> : null}
        </span>
        {active ? <span className="ck-cmdk-key">↵</span> : null}
      </button>
    </li>
  )
}
