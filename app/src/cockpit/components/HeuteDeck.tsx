import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Contact, Task } from '../../types/db'
import { useTaskBuckets, useTasks, type CreateTaskInput } from '../../hooks/useTasks'
import type { UseContactsResult } from '../../hooks/useContacts'

const COLLAPSE_KEY = 'ck.heute.collapsed'

function ymdToday(): string {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(
    t.getDate(),
  ).padStart(2, '0')}`
}

function ymdFromIso(iso: string | null): string | null {
  return iso ? iso.slice(0, 10) : null
}

function tomorrowNoonIso(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(12, 0, 0, 0)
  return d.toISOString()
}

function contactLabel(c: Contact): string {
  return c.name?.trim() || c.company?.trim() || c.email?.trim() || 'Kontakt'
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 11) return 'Guten Morgen'
  if (h < 18) return 'Guten Tag'
  return 'Guten Abend'
}

interface DueContact {
  contact: Contact
  tone: 'overdue' | 'today'
  label: string
}

/**
 * Heute-Deck — die „was tue ich zuerst?"-Antwort auf der Home.
 * Aggregiert fällige Kontakte (aus next_follow_up_at) + fällige Aufgaben
 * (foundation_tasks) in einer Leiste. Nutzt die bereits geladenen Kontakte der
 * Home (kein Doppel-Load) und den bestehenden useTasks-Hook.
 */
export function HeuteDeck({
  slug,
  contacts,
}: {
  slug: string | undefined
  contacts: UseContactsResult
}) {
  const navigate = useNavigate()
  const tasks = useTasks(slug)
  const buckets = useTaskBuckets(tasks.items)
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === '1',
  )
  const [adding, setAdding] = useState('')

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      return next
    })
  }, [])

  const dueContacts = useMemo<DueContact[]>(() => {
    const today = ymdToday()
    const out: DueContact[] = []
    for (const c of contacts.items) {
      if (c.pipeline_stage === 'paused') continue
      const fu = ymdFromIso(c.next_follow_up_at)
      if (!fu) continue
      if (fu < today) out.push({ contact: c, tone: 'overdue', label: 'Follow-up überfällig' })
      else if (fu === today) out.push({ contact: c, tone: 'today', label: 'Follow-up heute' })
    }
    out.sort((a, b) => {
      if (a.tone !== b.tone) return a.tone === 'overdue' ? -1 : 1
      return String(a.contact.next_follow_up_at).localeCompare(
        String(b.contact.next_follow_up_at),
      )
    })
    return out
  }, [contacts.items])

  const dueTasks = useMemo<Task[]>(
    () => [...buckets.overdue, ...buckets.today],
    [buckets.overdue, buckets.today],
  )

  const overdueContactCount = dueContacts.filter((d) => d.tone === 'overdue').length
  const todayContactCount = dueContacts.filter((d) => d.tone === 'today').length
  const nothingDue = dueContacts.length === 0 && dueTasks.length === 0

  const summary = useMemo(() => {
    const parts: string[] = []
    if (overdueContactCount) parts.push(`${overdueContactCount} Kontakt${overdueContactCount === 1 ? '' : 'e'} überfällig`)
    if (todayContactCount) parts.push(`${todayContactCount} heute fällig`)
    if (dueTasks.length) parts.push(`${dueTasks.length} Aufgabe${dueTasks.length === 1 ? '' : 'n'} offen`)
    if (parts.length === 0) return 'Sauberer Start — keine offenen Fälligkeiten. Fokus auf Akquise.'
    return parts.join(' · ')
  }, [overdueContactCount, todayContactCount, dueTasks.length])

  const skip = useCallback(
    (id: string) => contacts.update(id, { next_follow_up_at: tomorrowNoonIso() }),
    [contacts],
  )

  const submitTask = useCallback(() => {
    const title = adding.trim()
    if (!title || !slug) return
    const input: CreateTaskInput = {
      title,
      due_at: new Date().toISOString(),
      source: 'manual',
    }
    tasks.create(input)
    setAdding('')
  }, [adding, slug, tasks])

  return (
    <section className="ck-panel" aria-label="Heute" style={{ overflow: 'hidden' }}>
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          padding: '10px 14px',
          background: 'transparent',
          border: 'none',
          borderBottom: collapsed ? 'none' : '1px solid var(--ck-border)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
          <span className="ck-label" style={{ color: nothingDue ? 'var(--ck-text-3)' : 'var(--ck-accent)' }}>
            Heute
          </span>
          <span
            style={{
              fontSize: 12.5,
              color: 'var(--ck-text-2)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {greeting()}. {summary}
          </span>
        </span>
        <span aria-hidden style={{ color: 'var(--ck-text-3)', fontSize: 12, flexShrink: 0 }}>
          {collapsed ? '▸' : '▾'}
        </span>
      </button>

      {collapsed ? null : (
        <div className="ck-heute-grid" style={{ display: 'grid', gap: 0 }}>
          {/* Kontakte fällig */}
          <div style={{ borderRight: '1px solid var(--ck-border)' }}>
            <div className="ck-label" style={{ padding: '10px 14px 6px' }}>
              Kontakte fällig
            </div>
            {dueContacts.length === 0 ? (
              <div style={{ padding: '4px 14px 12px', fontSize: 12, color: 'var(--ck-text-3)' }}>
                Keine fälligen Follow-ups.
              </div>
            ) : (
              <div style={{ paddingBottom: 6 }}>
                {dueContacts.slice(0, 12).map((d) => (
                  <div
                    key={d.contact.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '7px 14px',
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        flexShrink: 0,
                        background: d.tone === 'overdue' ? 'var(--ck-warn)' : 'var(--ck-accent)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => navigate(`/sales/${d.contact.id}`)}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        textAlign: 'left',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12.5,
                          color: 'var(--ck-text-1)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {contactLabel(d.contact)}
                      </div>
                      <div style={{ fontSize: 10, color: d.tone === 'overdue' ? 'var(--ck-warn)' : 'var(--ck-text-3)' }}>
                        {d.label}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => void skip(d.contact.id)}
                      title="Auf morgen verschieben"
                      style={{
                        flexShrink: 0,
                        fontSize: 10,
                        color: 'var(--ck-text-3)',
                        background: 'none',
                        border: '1px solid transparent',
                        borderRadius: 5,
                        padding: '2px 6px',
                        cursor: 'pointer',
                      }}
                    >
                      → morgen
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Aufgaben */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                padding: '10px 14px 6px',
              }}
            >
              <span className="ck-label">Aufgaben</span>
              <button
                type="button"
                onClick={() => navigate('/aufgaben')}
                style={{
                  fontSize: 10,
                  color: 'var(--ck-text-3)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                alle →
              </button>
            </div>

            <div style={{ padding: '0 14px 8px' }}>
              <input
                className="ck-input"
                value={adding}
                onChange={(e) => setAdding(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    submitTask()
                  }
                }}
                placeholder="Aufgabe für heute …"
                style={{ width: '100%', fontSize: 13 }}
                aria-label="Aufgabe für heute hinzufügen"
              />
            </div>

            {dueTasks.length === 0 ? (
              <div style={{ padding: '2px 14px 12px', fontSize: 12, color: 'var(--ck-text-3)' }}>
                Keine offenen Aufgaben.
              </div>
            ) : (
              <div style={{ paddingBottom: 6 }}>
                {dueTasks.slice(0, 12).map((t) => {
                  const overdue = buckets.overdue.includes(t)
                  return (
                    <div
                      key={t.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px' }}
                    >
                      <button
                        type="button"
                        onClick={() => tasks.toggle(t.id)}
                        title="Erledigt markieren"
                        style={{
                          width: 16,
                          height: 16,
                          flexShrink: 0,
                          borderRadius: 4,
                          border: '1.5px solid var(--ck-border-strong)',
                          background: 'transparent',
                          cursor: 'pointer',
                        }}
                      />
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: 12.5,
                          color: 'var(--ck-text-1)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {t.title}
                      </span>
                      {overdue ? (
                        <span style={{ flexShrink: 0, fontSize: 10, color: 'var(--ck-warn)' }}>überfällig</span>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
