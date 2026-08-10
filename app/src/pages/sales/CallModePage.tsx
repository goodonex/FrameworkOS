/**
 * Call Mode — Mobile-First Bildschirm für Telefon-Acquise.
 *
 * Flow:
 *  1. Liste anrufbereiter Leads (Follow-up überfällig oder heute)
 *  2. Klick → Detail-Sheet: großer "Anrufen"-Button (tel:)
 *  3. Nach dem Call: Outcome-Pills + Notiz-Textarea + speichern
 *  4. Auto-Skip zum nächsten Lead in der Liste
 *
 * Layout ist bewusst Tap-friendly: 56px Tap-Targets, große Schrift, wenig Hierarchie.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrentBrandSlug } from '../../hooks/useCurrentBrandSlug'
import { useToast } from '../../components/Toast'
import { useDailyScorecard } from '../../hooks/useDailyScorecard'
import { useContacts } from '../../hooks/useContacts'
import { useCallLogs } from '../../hooks/useSalesPro'
import type { Contact, SalesCallOutcome } from '../../types/db'
import {
  activityTextForCallOutcome,
  contactPatchAfterCallOutcome,
} from '../../lib/callContactPatch'
import { generateId } from '../../lib/storage'

const OUTCOMES: Array<{ key: SalesCallOutcome; label: string; tone: 'good' | 'neutral' | 'bad' }> = [
  { key: 'connected', label: 'Gesprochen', tone: 'good' },
  { key: 'callback_requested', label: 'Rückruf', tone: 'neutral' },
  { key: 'voicemail', label: 'Mailbox', tone: 'neutral' },
  { key: 'no_pickup', label: 'Nicht erreicht', tone: 'bad' },
  { key: 'wrong_number', label: 'Falsche Nr.', tone: 'bad' },
]

function startOfTodayMs(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function endOfTodayMs(): number {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

export function CallModePage() {
  const slug = useCurrentBrandSlug()
  const navigate = useNavigate()
  const contacts = useContacts(slug)
  const calls = useCallLogs(slug)
  const scorecard = useDailyScorecard(slug)
  const { show } = useToast()

  const [activeId, setActiveId] = useState<string | null>(null)
  const [step, setStep] = useState<'before' | 'after'>('before')

  // Anrufbereit: phone vorhanden + (kein Follow-up oder Follow-up <= heute)
  const queue = useMemo(() => {
    const todayEnd = endOfTodayMs()
    return contacts.items
      .filter((c) => c.phone && c.phone.trim().length > 0)
      .filter((c) => {
        if (!c.next_follow_up_at) return true
        return new Date(c.next_follow_up_at).getTime() <= todayEnd
      })
      .sort((a, b) => {
        // Überfällige zuerst, dann nach Potenzial
        const aOverdue = a.next_follow_up_at && new Date(a.next_follow_up_at).getTime() < startOfTodayMs()
        const bOverdue = b.next_follow_up_at && new Date(b.next_follow_up_at).getTime() < startOfTodayMs()
        if (aOverdue && !bOverdue) return -1
        if (!aOverdue && bOverdue) return 1
        return (b.potenzial_betrag || 0) - (a.potenzial_betrag || 0)
      })
  }, [contacts.items])

  const active = useMemo(
    () => queue.find((c) => c.id === activeId) ?? null,
    [queue, activeId],
  )

  // Auto-select nächsten Lead nach Save oder Skip
  const advanceQueue = useCallback(() => {
    const remaining = queue.filter((c) => c.id !== activeId)
    setActiveId(remaining[0]?.id ?? null)
    setStep('before')
  }, [queue, activeId])

  if (!slug) return null

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-void)',
      }}
    >
      <header
        style={{
          padding: '14px 16px 8px',
          borderBottom: '1px solid var(--glass-border-1)',
          background: 'color-mix(in srgb, var(--bg-base) 92%, transparent)',
        }}
      >
        <div
          className="font-mono"
          style={{ fontSize: 9, letterSpacing: '0.16em', color: 'var(--text-tertiary)' }}
        >
          CALL MODE
        </div>
        <div
          className="font-display"
          style={{
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '-0.4px',
            color: 'var(--text-primary)',
            marginTop: 2,
          }}
        >
          {queue.length} Lead{queue.length === 1 ? '' : 's'} bereit
        </div>
        <div
          className="font-mono"
          style={{
            marginTop: 8,
            fontSize: 10,
            color: 'var(--text-tertiary)',
            letterSpacing: '0.06em',
          }}
        >
          Heute: {scorecard.counts.dialAttempts}/{scorecard.targets.dialAttempts} Wählversuche ·{' '}
          {scorecard.counts.pitches}/{scorecard.targets.pitches} Pitches
        </div>
        <button
          type="button"
          onClick={() => navigate(`/brand/${slug}#daily-scorecard`)}
          className="font-mono"
          style={{
            marginTop: 8,
            fontSize: 10,
            padding: '4px 8px',
            borderRadius: 6,
            border: '1px solid var(--glass-border-2)',
            background: 'transparent',
            color: 'var(--mode-sales)',
            cursor: 'pointer',
          }}
        >
          Tagesbuch →
        </button>
      </header>

      {/* D6 (Phase 2): Der Call-Mode ist eine geparkte Insel — er wird
          gebraucht, sobald Ads laufen, und dann sofort. Bis dahin wird er
          weder neu gebaut noch umgefaerbt; das Banner sagt, woran man ist. */}
      <div
        style={{
          margin: '0 14px 10px',
          padding: '9px 13px',
          borderRadius: 'var(--ck-radius-innen)',
          border: '1px solid var(--ck-warn)',
          color: 'var(--ck-warn)',
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        Geparkt: wird mit dem Ads-Start auf den echten Funnel gestellt.
      </div>

      {!active ? (
        // Liste
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px 80px' }}>
          {queue.length === 0 ? (
            <div
              style={{
                padding: 32,
                textAlign: 'center',
                color: 'var(--text-tertiary)',
                fontSize: 14,
                border: '1px dashed var(--glass-border-2)',
                borderRadius: 14,
                marginTop: 24,
              }}
            >
              Heute keine Anrufe geplant.
              <br />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() => navigate(`/brand/${slug}/sales?action=new-contact`)}
                  className="font-mono"
                  style={{
                    padding: '10px 16px',
                    borderRadius: 9,
                    border: '1px solid var(--mode-sales)',
                    background: 'color-mix(in srgb, var(--mode-sales) 14%, transparent)',
                    color: 'var(--mode-sales)',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  + Lead anlegen
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/brand/${slug}/sales`)}
                  className="font-mono"
                  style={{
                    padding: '10px 16px',
                    borderRadius: 9,
                    border: '1px solid var(--glass-border-2)',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  → Pipeline
                </button>
              </div>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {queue.map((c) => (
                <LeadCard key={c.id} contact={c} onSelect={() => setActiveId(c.id)} />
              ))}
            </ul>
          )}
        </div>
      ) : (
        // Detail-Sheet
        <CallSheet
          contact={active}
          step={step}
          setStep={setStep}
          onLogCall={async (outcome, notes) => {
            await calls.log({ contact_id: active.id, outcome, notes })
            const autoPatch = contactPatchAfterCallOutcome(active, outcome)
            const entry = {
              id: generateId(),
              text: activityTextForCallOutcome(outcome, notes),
              at: new Date().toISOString(),
            }
            contacts.update(active.id, {
              ...autoPatch,
              activity_log: [entry, ...(active.activity_log ?? [])],
            })
            show('Call gespeichert · weiter', 'success')
            advanceQueue()
          }}
          onSkip={advanceQueue}
          onClose={() => {
            setActiveId(null)
            setStep('before')
          }}
        />
      )}
    </div>
  )
}

// ============================================================
// LeadCard (Liste)
// ============================================================

function LeadCard({ contact, onSelect }: { contact: Contact; onSelect: () => void }) {
  const overdue =
    contact.next_follow_up_at && new Date(contact.next_follow_up_at).getTime() < startOfTodayMs()
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        style={{
          width: '100%',
          minHeight: 64,
          padding: '12px 14px',
          textAlign: 'left',
          background: 'var(--glass-1)',
          border: overdue
            ? '1px solid var(--accent-coral)'
            : '1px solid var(--glass-border-1)',
          borderRadius: 13,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          className="font-display"
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            background: 'linear-gradient(135deg, var(--mode-sales), color-mix(in srgb, var(--mode-sales) 60%, var(--accent-teal)))',
            color: 'var(--chip-text-on-accent)',
            fontWeight: 700,
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          {(contact.name || '?').split(' ').slice(0, 2).map((p) => p[0] ?? '').join('').toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {contact.name || '(Ohne Namen)'}
          </div>
          <div
            className="font-mono"
            style={{
              fontSize: 11,
              color: 'var(--text-tertiary)',
              marginTop: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {contact.phone}
            {overdue ? (
              <span
                style={{
                  padding: '1px 6px',
                  borderRadius: 5,
                  background: 'color-mix(in srgb, var(--accent-coral) 22%, transparent)',
                  color: 'var(--accent-coral)',
                  fontWeight: 600,
                  fontSize: 9,
                }}
              >
                ÜBERFÄLLIG
              </span>
            ) : null}
          </div>
        </div>
        <span style={{ fontSize: 18, color: 'var(--text-tertiary)' }}>→</span>
      </button>
    </li>
  )
}

// ============================================================
// CallSheet (Detail während/nach Call)
// ============================================================

function CallSheet({
  contact,
  step,
  setStep,
  onLogCall,
  onSkip,
  onClose,
}: {
  contact: Contact
  step: 'before' | 'after'
  setStep: (s: 'before' | 'after') => void
  onLogCall: (outcome: SalesCallOutcome, notes: string) => Promise<void>
  onSkip: () => void
  onClose: () => void
}) {
  const [outcome, setOutcome] = useState<SalesCallOutcome>('connected')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setOutcome('connected')
    setNotes('')
    setSaving(false)
  }, [contact.id])

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '16px 16px 100px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header mit Close */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          type="button"
          onClick={onClose}
          className="font-mono"
          style={{
            fontSize: 11,
            padding: '8px 12px',
            borderRadius: 9,
            border: '1px solid var(--glass-border-2)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          ← Liste
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="font-mono"
          style={{
            fontSize: 11,
            padding: '8px 12px',
            borderRadius: 9,
            border: '1px solid var(--glass-border-2)',
            background: 'transparent',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
          }}
        >
          Skip →
        </button>
      </div>

      {/* Lead-Info */}
      <div
        style={{
          padding: 16,
          background: 'var(--glass-1)',
          border: '1px solid var(--glass-border-1)',
          borderRadius: 14,
        }}
      >
        <div
          className="font-display"
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '-0.3px',
          }}
        >
          {contact.name || '(Ohne Namen)'}
        </div>
        {contact.company ? (
          <div className="font-mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {contact.company}
          </div>
        ) : null}
        <div
          style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}
        >
          {contact.email ? (
            <a
              href={`mailto:${contact.email}`}
              className="font-mono"
              style={pillStyle('var(--accent-blue)')}
            >
              ✉ {contact.email}
            </a>
          ) : null}
          {contact.website ? (
            <a
              href={contact.website}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono"
              style={pillStyle('var(--accent-teal)')}
            >
              ↗ Web
            </a>
          ) : null}
          {contact.linkedin ? (
            <a
              href={contact.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono"
              style={pillStyle('#0A66C2')}
            >
              in LinkedIn
            </a>
          ) : null}
        </div>
        {contact.notes ? (
          <p
            style={{
              marginTop: 12,
              fontSize: 13,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}
          >
            {contact.notes}
          </p>
        ) : null}
      </div>

      {step === 'before' ? (
        // Großer Anrufen-Button
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <a
            href={`tel:${contact.phone}`}
            onClick={() => {
              // Sofort in "after"-Modus, damit Notiz nach Call sichtbar ist
              setTimeout(() => setStep('after'), 250)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: '22px 18px',
              borderRadius: 18,
              background: 'linear-gradient(135deg, var(--mode-sales), color-mix(in srgb, var(--mode-sales) 60%, var(--accent-teal)))',
              color: 'var(--chip-text-on-accent)',
              textDecoration: 'none',
              fontSize: 17,
              fontWeight: 700,
              boxShadow: '0 12px 32px color-mix(in srgb, var(--mode-sales) 35%, transparent)',
              border: 'none',
              userSelect: 'none',
            }}
          >
            <span style={{ fontSize: 22 }}>☎</span>
            {contact.phone}
          </a>
          <button
            type="button"
            onClick={() => setStep('after')}
            className="font-mono"
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-2)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Sofort dokumentieren →
          </button>
        </div>
      ) : (
        // Quick-Note + Outcome
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: 14,
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border-1)',
            borderRadius: 14,
          }}
        >
          <div className="font-mono" style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-tertiary)' }}>
            ERGEBNIS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {OUTCOMES.map((o) => {
              const on = outcome === o.key
              const color =
                o.tone === 'good'
                  ? 'var(--accent-teal)'
                  : o.tone === 'bad'
                    ? 'var(--accent-coral)'
                    : 'var(--mode-sales)'
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setOutcome(o.key)}
                  className="font-mono"
                  style={{
                    padding: '14px 10px',
                    borderRadius: 10,
                    border: on ? `1.5px solid ${color}` : '1px solid var(--glass-border-2)',
                    background: on
                      ? `color-mix(in srgb, ${color} 20%, transparent)`
                      : 'var(--glass-2)',
                    color: on ? color : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: on ? 600 : 500,
                  }}
                >
                  {o.label}
                </button>
              )
            })}
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Schnellnotiz — was war Thema? Nächster Schritt?"
            rows={5}
            autoFocus
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 12,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-2)',
              color: 'var(--text-primary)',
              fontSize: 15,
              fontFamily: 'inherit',
              outline: 'none',
              resize: 'vertical',
              minHeight: 120,
            }}
          />

          <button
            type="button"
            onClick={async () => {
              if (saving) return
              setSaving(true)
              await onLogCall(outcome, notes)
              setSaving(false)
            }}
            disabled={saving}
            style={{
              padding: '18px 14px',
              borderRadius: 14,
              border: 'none',
              background: 'linear-gradient(135deg, var(--mode-sales), color-mix(in srgb, var(--mode-sales) 60%, var(--accent-teal)))',
              color: 'var(--chip-text-on-accent)',
              fontWeight: 700,
              fontSize: 16,
              cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.7 : 1,
              boxShadow: '0 10px 24px color-mix(in srgb, var(--mode-sales) 25%, transparent)',
            }}
          >
            {saving ? 'Speichert …' : '✓ Speichern & nächster Lead'}
          </button>
        </div>
      )}
    </div>
  )
}

function pillStyle(color: string): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 11px',
    borderRadius: 999,
    border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
    background: `color-mix(in srgb, ${color} 14%, transparent)`,
    color,
    textDecoration: 'none',
    fontSize: 11,
    letterSpacing: '0.04em',
  }
}
