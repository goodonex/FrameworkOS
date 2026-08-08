import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContacts } from '../../hooks/useContacts'
import { useTaskBuckets, useTasks } from '../../hooks/useTasks'
import { useIsMobile } from '../../hooks/useViewport'
import type { Task, TaskPriority, TaskSource } from '../../types/db'
import { HeuteTabs } from '../components/HeuteTabs'
import { ListenZeile } from '../components/home/ListenZeile'
import { useActiveBrand } from '../lib/activeBrand'

const SOURCE_LABEL: Record<TaskSource, string> = {
  manual: '',
  follow_up: 'Follow-up',
  system: 'Routine',
  onboarding: 'Onboarding',
  brief_task: 'Briefing',
}

function dueLabel(due_at: string | null): string {
  if (!due_at) return ''
  const d = new Date(due_at)
  if (Number.isNaN(d.getTime())) return ''
  const t0 = new Date()
  t0.setHours(0, 0, 0, 0)
  const dd = new Date(d)
  dd.setHours(0, 0, 0, 0)
  const diff = Math.round((dd.getTime() - t0.getTime()) / 86400000)
  if (diff === 0) return 'heute'
  if (diff === -1) return 'gestern'
  if (diff < 0) return `vor ${-diff} Tagen`
  if (diff === 1) return 'morgen'
  if (diff < 7) return `in ${diff} Tagen`
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
}

function TaskLine({
  task,
  contactName,
  mobil,
  onToggle,
  onMorgen,
  onRemove,
  onOpenContact,
}: {
  task: Task
  contactName?: string
  /** O18, Zug 7: am Handy die Erinnerungen-Grammatik, am Rechner die Tabellenzeile. */
  mobil: boolean
  onToggle: (id: string) => void
  /** v2 (f): „→ morgen" hinter dem Wischen — setzt nur `due_at`, sonst nichts. */
  onMorgen: (task: Task) => void
  onRemove: (id: string) => void
  onOpenContact?: (id: string) => void
}) {
  const done = task.status === 'done' || task.status === 'cancelled'
  const src = SOURCE_LABEL[task.source]

  if (mobil) {
    const faellig = dueLabel(task.due_at)
    return (
      <div style={{ padding: '2px 8px 2px 0', borderBottom: '1px solid var(--ck-border)' }}>
        <ListenZeile
          titel={task.title}
          erledigt={done}
          // Exakt der bestehende Pfad — `tasks.toggle` schreibt den Status,
          // kein neues Feld, keine zweite Erledigt-Logik.
          onHaken={() => onToggle(task.id)}
          onMorgen={done ? undefined : () => onMorgen(task)}
          hakenLabel={done ? `${task.title} wieder öffnen` : `${task.title} erledigt markieren`}
          onTitel={task.contact_id && contactName ? () => onOpenContact?.(task.contact_id as string) : undefined}
          meta={
            [src || null, contactName ? `→ ${contactName}` : null, faellig || null]
              .filter(Boolean)
              .join(' · ') || undefined
          }
          aktion={
            <button
              type="button"
              onClick={() => onRemove(task.id)}
              aria-label={`${task.title} löschen`}
              style={{
                minWidth: 44,
                minHeight: 44,
                fontSize: 15,
                color: 'var(--ck-text-3)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        borderBottom: '1px solid var(--ck-border)',
      }}
    >
      <button
        type="button"
        onClick={() => onToggle(task.id)}
        title={done ? 'Wieder öffnen' : 'Erledigt markieren'}
        style={{
          width: 17,
          height: 17,
          flexShrink: 0,
          borderRadius: 4,
          border: `1.5px solid ${done ? 'var(--ck-accent)' : 'var(--ck-border-strong)'}`,
          background: done ? 'var(--ck-accent-dim)' : 'transparent',
          color: 'var(--ck-accent)',
          cursor: 'pointer',
          fontSize: 11,
          lineHeight: 1,
        }}
      >
        {done ? '✓' : ''}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            color: done ? 'var(--ck-text-3)' : 'var(--ck-text-1)',
            textDecoration: done ? 'line-through' : 'none',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {task.title}
        </div>
        {task.contact_id && contactName ? (
          <button
            type="button"
            onClick={() => onOpenContact?.(task.contact_id as string)}
            style={{
              fontSize: 10,
              color: 'var(--ck-text-3)',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
            }}
          >
            → {contactName}
          </button>
        ) : null}
      </div>

      {src ? (
        <span
          className="ck-label"
          style={{ flexShrink: 0, fontSize: 9, color: 'var(--ck-text-3)' }}
        >
          {src}
        </span>
      ) : null}
      <span
        style={{
          flexShrink: 0,
          fontSize: 11,
          minWidth: 64,
          textAlign: 'right',
          color: task.priority === 1 ? 'var(--ck-warn)' : 'var(--ck-text-3)',
        }}
      >
        {dueLabel(task.due_at)}
      </span>
      <button
        type="button"
        onClick={() => onRemove(task.id)}
        title="Löschen"
        style={{
          flexShrink: 0,
          fontSize: 13,
          color: 'var(--ck-text-3)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        ×
      </button>
    </div>
  )
}

/** Globale Aufgaben-Ansicht (/aufgaben) — Buckets + Quick-Add, cockpit-nativ. */
export function AufgabenArea() {
  const navigate = useNavigate()
  const { activeBrand } = useActiveBrand()
  const slug = activeBrand?.slug
  const mobil = useIsMobile()
  const tasks = useTasks(slug)
  const contacts = useContacts(slug)
  const buckets = useTaskBuckets(tasks.items)
  const [showDone, setShowDone] = useState(false)

  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [priority, setPriority] = useState<TaskPriority>(2)

  const contactMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of contacts.items) m.set(c.id, c.name || c.company || c.email || 'Kontakt')
    return m
  }, [contacts.items])

  /**
   * v2 (f): Eine Aufgabe um einen Tag verschieben. Nutzt denselben
   * `tasks.update`-Pfad wie jede andere Änderung und setzt genau ein Feld —
   * 09:00 ist dieselbe Uhrzeit, die das Anlegen unten vergibt.
   */
  const aufMorgen = (task: Task) => {
    const morgen = new Date()
    morgen.setDate(morgen.getDate() + 1)
    morgen.setHours(9, 0, 0, 0)
    tasks.update(task.id, { due_at: morgen.toISOString() })
  }

  const submit = () => {
    const t = title.trim()
    if (!t || !slug) return
    tasks.create({
      title: t,
      due_at: due ? new Date(due + 'T09:00:00').toISOString() : null,
      priority,
      source: 'manual',
    })
    setTitle('')
    setDue('')
    setPriority(2)
  }

  const sections: Array<{ label: string; tone: string; items: Task[] }> = [
    { label: 'Überfällig', tone: 'var(--ck-warn)', items: buckets.overdue },
    { label: 'Heute', tone: 'var(--ck-accent)', items: buckets.today },
    { label: 'Diese Woche', tone: 'var(--ck-text-2)', items: buckets.week },
    { label: 'Später / ohne Datum', tone: 'var(--ck-text-3)', items: buckets.later },
  ]
  const visible = sections.filter((s) => s.items.length > 0)
  const totalOpen =
    buckets.overdue.length + buckets.today.length + buckets.week.length + buckets.later.length

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <HeuteTabs />
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ck-text-1)', margin: 0 }}>Aufgaben</h1>
        <span className="ck-label">
          {totalOpen} offen{buckets.done.length ? ` · ${buckets.done.length} erledigt` : ''}
        </span>
      </div>

      {/* Quick-Add */}
      <section className="ck-panel" style={{ padding: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="ck-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submit()
              }
            }}
            placeholder="Neue Aufgabe …"
            style={{ flex: 1, minWidth: 180, fontSize: 13 }}
            aria-label="Neue Aufgabe"
          />
          <input
            className="ck-input"
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            style={{ fontSize: 13 }}
            aria-label="Fällig am"
          />
          <div style={{ display: 'inline-flex', gap: 4 }}>
            {([1, 2, 3] as const).map((p) => {
              const label = p === 1 ? 'Hoch' : p === 2 ? 'Normal' : 'Niedrig'
              const active = priority === p
              const tone = p === 1 ? 'var(--ck-warn)' : 'var(--ck-accent)'
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className="ck-btn"
                  style={{
                    fontSize: 10,
                    padding: '6px 10px',
                    borderColor: active ? tone : undefined,
                    color: active ? tone : undefined,
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <button type="button" onClick={submit} className="ck-btn ck-btn--primary" style={{ fontSize: 10 }}>
            Anlegen
          </button>
        </div>
      </section>

      {tasks.loading ? (
        <div style={{ fontSize: 12, color: 'var(--ck-text-3)', padding: 12 }}>Lädt …</div>
      ) : visible.length === 0 ? (
        <div className="ck-panel" style={{ padding: '28px 14px', textAlign: 'center', fontSize: 13, color: 'var(--ck-text-3)' }}>
          Keine offenen Aufgaben. Sauberer Schreibtisch.
        </div>
      ) : (
        visible.map((sec) => (
          <section key={sec.label} className="ck-panel" style={{ overflow: 'hidden' }}>
            <div
              className="ck-label"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px 8px' }}
            >
              <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: sec.tone }} />
              {sec.label}
              <span style={{ color: 'var(--ck-text-3)' }}>· {sec.items.length}</span>
            </div>
            {sec.items.map((t) => (
              <TaskLine
                key={t.id}
                task={t}
                mobil={mobil}
                contactName={t.contact_id ? contactMap.get(t.contact_id) : undefined}
                onToggle={tasks.toggle}
                onMorgen={aufMorgen}
                onRemove={tasks.remove}
                onOpenContact={(id) => navigate(`/sales/${id}`)}
              />
            ))}
          </section>
        ))
      )}

      {buckets.done.length > 0 ? (
        <section className="ck-panel" style={{ overflow: 'hidden' }}>
          <button
            type="button"
            onClick={() => setShowDone((s) => !s)}
            className="ck-label"
            style={{
              width: '100%',
              textAlign: 'left',
              display: 'flex',
              gap: 8,
              padding: '10px 12px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {showDone ? '▾' : '▸'} Erledigt · {buckets.done.length}
          </button>
          {showDone
            ? buckets.done
                .slice(0, 50)
                .map((t) => (
                  <TaskLine
                    key={t.id}
                    task={t}
                    mobil={mobil}
                    contactName={t.contact_id ? contactMap.get(t.contact_id) : undefined}
                    onToggle={tasks.toggle}
                    onMorgen={aufMorgen}
                    onRemove={tasks.remove}
                    onOpenContact={(id) => navigate(`/sales/${id}`)}
                  />
                ))
            : null}
        </section>
      ) : null}
    </div>
  )
}
