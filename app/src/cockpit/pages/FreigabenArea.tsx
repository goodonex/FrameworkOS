import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContacts } from '../../hooks/useContacts'
import type { Contact } from '../../types/db'
import { sendEmail } from '../../lib/emailService'
import { HeuteTabs } from '../components/HeuteTabs'
import { useActiveBrand } from '../lib/activeBrand'
import {
  buildFollowupInput,
  parseDrafts,
  type DraftChannel,
  type FollowupDraft,
} from '../lib/approvalDrafts'
import { fetchRun, postRun } from '../lib/runnerApi'
import { useRunnerData } from '../lib/useRunnerData'

type CardStatus = 'pending' | 'sending' | 'sent' | 'copied' | 'done' | 'rejected'

interface Card extends FollowupDraft {
  key: number
  subject: string
  status: CardStatus
  error: string | null
  confirming: boolean
}

const CHANNEL_LABEL: Record<DraftChannel, string> = {
  email: 'E-Mail',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  other: 'Nachricht',
}

function contactLabel(c: Contact | undefined, fallback: string): string {
  if (!c) return fallback
  return c.name?.trim() || c.company?.trim() || c.email?.trim() || fallback
}

/**
 * Freigaben (/freigaben) — Approval-Queue v1 (IDEAS-2026 A1, migrationsfrei):
 * liest die Entwürfe aus dem letzten followup-entwuerfe-Run, zeigt sie als Karten.
 * E-Mail → sendEmail (mit Inline-Bestätigung), DM → in die Zwischenablage.
 */
export function FreigabenArea() {
  const navigate = useNavigate()
  const { activeBrand } = useActiveBrand()
  const slug = activeBrand?.slug
  const brandId = activeBrand?.id
  const contacts = useContacts(slug)
  const { runner, runs, refresh } = useRunnerData()

  const [cards, setCards] = useState<Card[]>([])
  const [loadedRunId, setLoadedRunId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)

  const contactMap = useMemo(() => {
    const m = new Map<string, Contact>()
    for (const c of contacts.items) m.set(c.id, c)
    return m
  }, [contacts.items])

  const latestRun = useMemo(() => {
    return runs
      .filter((r) => r.agent === 'followup-entwuerfe' && r.status === 'done')
      .sort((a, b) => String(b.started).localeCompare(String(a.started)))[0]
  }, [runs])

  const runningFollowup = runs.some(
    (r) => r.agent === 'followup-entwuerfe' && r.status === 'running',
  )

  useEffect(() => {
    if (!latestRun || latestRun.id === loadedRunId) return
    let cancelled = false
    setLoading(true)
    fetchRun(latestRun.id)
      .then((detail) => {
        if (cancelled) return
        const drafts = parseDrafts(detail.content)
        setCards(
          drafts.map((d, i) => ({
            ...d,
            key: i,
            subject: d.subject ?? '',
            status: 'pending' as CardStatus,
            error: null,
            confirming: false,
          })),
        )
        setLoadedRunId(latestRun.id)
      })
      .catch(() => {
        /* Runner offline / Run nicht lesbar → Karten bleiben leer */
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [latestRun, loadedRunId])

  const patch = (key: number, next: Partial<Card>) =>
    setCards((cs) => cs.map((c) => (c.key === key ? { ...c, ...next } : c)))

  const generate = async () => {
    if (!slug) return
    setGenerating(true)
    try {
      await postRun('followup-entwuerfe', buildFollowupInput(contacts.items))
      await refresh()
    } catch {
      /* Fehler wird über den Runner-Status sichtbar */
    } finally {
      setGenerating(false)
    }
  }

  const doSend = async (card: Card) => {
    const contact = contactMap.get(card.contact_id)
    const toEmail = contact?.email?.trim() || null
    if (!brandId || !contact || !toEmail) {
      patch(card.key, { error: 'Keine E-Mail-Adresse am Kontakt hinterlegt.', confirming: false })
      return
    }
    patch(card.key, { status: 'sending', error: null, confirming: false })
    const res = await sendEmail({
      brand_id: brandId,
      contact_id: card.contact_id,
      subject: card.subject || '(kein Betreff)',
      body: card.message,
      to_email: toEmail,
    })
    if (res.ok) {
      patch(card.key, { status: 'sent' })
    } else {
      patch(card.key, {
        status: 'pending',
        error: `Versand fehlgeschlagen: ${res.detail || res.error}`,
      })
    }
  }

  const copy = async (card: Card) => {
    try {
      await navigator.clipboard.writeText(card.message)
      patch(card.key, { status: 'copied', error: null })
    } catch {
      patch(card.key, { error: 'Kopieren nicht möglich — Text manuell markieren.' })
    }
  }

  const openCount = cards.filter((c) => c.status === 'pending' || c.status === 'sending').length

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <HeuteTabs />
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ck-text-1)', margin: 0 }}>Freigaben</h1>
          <div className="ck-label" style={{ marginTop: 2 }}>
            {openCount} offen · Agent bereitet vor, du gibst frei
          </div>
        </div>
        <button
          type="button"
          className="ck-btn ck-btn--primary"
          onClick={() => void generate()}
          disabled={runner.state !== 'online' || generating || runningFollowup}
          style={{ fontSize: 11 }}
          title={runner.state !== 'online' ? 'Runner offline' : 'Follow-up-Entwürfe erzeugen'}
        >
          {generating || runningFollowup ? 'läuft…' : '▶ Entwürfe erzeugen'}
        </button>
      </div>

      {runner.state !== 'online' ? (
        <div className="ck-panel" style={{ padding: '10px 14px', fontSize: 12.5, color: 'var(--ck-text-3)' }}>
          Runner offline — zum Erzeugen neuer Entwürfe muss der Runner laufen. Bereits geladene
          Karten kannst du trotzdem freigeben (Versand läuft über Supabase).
        </div>
      ) : null}

      {loading ? (
        <div className="ck-panel" style={{ padding: 14, fontSize: 12.5, color: 'var(--ck-text-3)' }}>
          Lädt Entwürfe …
        </div>
      ) : cards.length === 0 ? (
        <div className="ck-panel" style={{ padding: '28px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 13.5, color: 'var(--ck-text-2)', marginBottom: 6 }}>
            Noch keine Entwürfe.
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ck-text-3)' }}>
            „Entwürfe erzeugen" lässt den Follow-up-Agenten deine wartenden Kontakte durchgehen —
            danach erscheinen sie hier zur Freigabe.
          </div>
        </div>
      ) : (
        cards.map((card) => {
          const contact = contactMap.get(card.contact_id)
          const name = contactLabel(contact, 'Unbekannter Kontakt')
          const toEmail = contact?.email?.trim() || null
          const isEmail = card.channel === 'email'
          const canSend = isEmail && Boolean(toEmail) && Boolean(brandId)
          const done = card.status === 'sent' || card.status === 'copied' || card.status === 'done' || card.status === 'rejected'

          return (
            <section
              key={card.key}
              className="ck-panel"
              style={{ padding: 14, opacity: done ? 0.7 : 1 }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                <button
                  type="button"
                  onClick={() => contact && navigate(`/sales/${contact.id}`)}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: contact ? 'pointer' : 'default', textAlign: 'left' }}
                >
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ck-text-1)' }}>{name}</span>
                  {toEmail ? (
                    <span style={{ fontSize: 11, color: 'var(--ck-text-3)' }}> · {toEmail}</span>
                  ) : null}
                </button>
                <span
                  className="ck-label"
                  style={{
                    flexShrink: 0,
                    color: isEmail ? 'var(--ck-accent)' : 'var(--ck-text-2)',
                    border: '1px solid var(--ck-border)',
                    borderRadius: 999,
                    padding: '1px 8px',
                  }}
                >
                  {CHANNEL_LABEL[card.channel]}
                </span>
              </div>

              {isEmail ? (
                <input
                  className="ck-input"
                  value={card.subject}
                  onChange={(e) => patch(card.key, { subject: e.target.value })}
                  placeholder="Betreff"
                  disabled={done}
                  style={{ width: '100%', fontSize: 13, marginBottom: 8 }}
                  aria-label="Betreff"
                />
              ) : null}

              <textarea
                value={card.message}
                onChange={(e) => patch(card.key, { message: e.target.value })}
                disabled={done}
                rows={Math.min(8, Math.max(3, card.message.split('\n').length + 1))}
                className="ck-input"
                style={{ width: '100%', fontSize: 13, lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' }}
                aria-label="Nachricht"
              />

              {card.error ? (
                <div style={{ fontSize: 11.5, color: 'var(--ck-warn)', marginTop: 6 }}>{card.error}</div>
              ) : null}

              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                {card.status === 'sent' ? (
                  <span style={{ fontSize: 12, color: 'var(--ck-accent)' }}>✓ gesendet</span>
                ) : card.status === 'copied' ? (
                  <span style={{ fontSize: 12, color: 'var(--ck-accent)' }}>✓ kopiert</span>
                ) : card.status === 'done' ? (
                  <span style={{ fontSize: 12, color: 'var(--ck-text-3)' }}>✓ erledigt</span>
                ) : card.status === 'rejected' ? (
                  <span style={{ fontSize: 12, color: 'var(--ck-text-3)' }}>verworfen</span>
                ) : card.confirming ? (
                  <>
                    <span style={{ fontSize: 12, color: 'var(--ck-text-2)' }}>
                      An {toEmail} senden?
                    </span>
                    <button type="button" className="ck-btn ck-btn--primary" style={{ fontSize: 10 }} onClick={() => void doSend(card)}>
                      Ja, senden
                    </button>
                    <button type="button" className="ck-btn" style={{ fontSize: 10 }} onClick={() => patch(card.key, { confirming: false })}>
                      Abbrechen
                    </button>
                  </>
                ) : (
                  <>
                    {canSend ? (
                      <button
                        type="button"
                        className="ck-btn ck-btn--primary"
                        style={{ fontSize: 10 }}
                        disabled={card.status === 'sending'}
                        onClick={() => patch(card.key, { confirming: true })}
                      >
                        {card.status === 'sending' ? 'sendet…' : 'Freigeben & senden'}
                      </button>
                    ) : null}
                    <button type="button" className="ck-btn" style={{ fontSize: 10 }} onClick={() => void copy(card)}>
                      Kopieren
                    </button>
                    {!isEmail ? (
                      <button type="button" className="ck-btn" style={{ fontSize: 10 }} onClick={() => patch(card.key, { status: 'done' })}>
                        Erledigt
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="ck-btn"
                      style={{ fontSize: 10, marginLeft: 'auto', color: 'var(--ck-text-3)' }}
                      onClick={() => patch(card.key, { status: 'rejected' })}
                    >
                      Verwerfen
                    </button>
                  </>
                )}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}
