import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContacts } from '../../hooks/useContacts'
import type { Contact } from '../../types/db'
import { sendEmail } from '../../lib/emailService'
import { HeuteTabs } from '../components/HeuteTabs'
import { KundenPosteingang } from '../components/KundenPosteingang'
import { useKundenPosteingang } from '../lib/useKundenPosteingang'
import { useActiveBrand } from '../lib/activeBrand'
import { useAuth } from '../../hooks/useAuth'
import {
  buildFollowupInput,
  draftIdentitaet,
  parseDrafts,
  type DraftChannel,
  type FollowupDraft,
} from '../lib/approvalDrafts'
import {
  clearDraftStatus,
  draftKey,
  loadRunStatuses,
  saveDraftStatus,
  type PersistedStatus,
} from '../lib/approvalStatus'
import { fetchRun, postRun } from '../lib/runnerApi'
import { useRunnerData } from '../lib/useRunnerData'
import { supabase } from '../../lib/supabase'

type CardStatus = 'pending' | 'sending' | PersistedStatus

/** Status, die eine Karte abschließen — genau diese werden persistiert. */
const PERSISTED: readonly CardStatus[] = ['sent', 'copied', 'done', 'rejected']
const isPersisted = (s: CardStatus): s is PersistedStatus => PERSISTED.includes(s)

interface Card extends FollowupDraft {
  key: number
  /** Stabile Identität über Reloads hinweg (approvalStatus.draftKey). */
  id: string
  /**
   * Run, aus dem dieser Entwurf stammt. O5: Die Queue liest mehrere Runs, der
   * Status gehört an den Run, in dem der Entwurf steht — nicht an den jüngsten.
   */
  runId: string
  subject: string
  status: CardStatus
  error: string | null
  confirming: boolean
  /** Laut sales_email_logs ging seit dem Run schon eine Mail an diesen Kontakt. */
  alreadySent: string | null
}

/** Agenten, deren Runs Freigabe-Karten liefern (parseDrafts-JSON-Block). */
const DRAFT_AGENTS = new Set([
  'followup-entwuerfe',
  'linkedin-followup-entwuerfe',
  'linkedin-antwort-entwuerfe',
])

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
  const posteingang = useKundenPosteingang(slug)
  const { user } = useAuth()
  const senderName =
    (typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null) ??
    'Team'

  const [cards, setCards] = useState<Card[]>([])
  /** Welche Run-Kombination gerade in `cards` steckt (Ids, verkettet). */
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)

  const contactMap = useMemo(() => {
    const m = new Map<string, Contact>()
    for (const c of contacts.items) m.set(c.id, c)
    return m
  }, [contacts.items])

  /**
   * O5 (06.08.2026): nicht mehr nur der jüngste Run. Die Entwürfe leben im
   * Run-Markdown; sobald der Agent erneut lief, war ein unbearbeiteter Entwurf
   * aus dem Lauf davor weg — er stand nirgends mehr, obwohl das Follow-up offen
   * war. Der Runs-Spiegel hält die letzten 20 Läufe samt Inhalt vor (runner
   * `pushRunsSnapshot`, `runnerApi.fetchRun` liest ihn auf der HTTPS-Domain).
   * Genau so viele Läufe wie `approvalStatus` Status vorhält (KEEP_RUNS = 5) —
   * mehr wäre wertlos, weil dann kein „erledigt" mehr dazu existiert.
   */
  const RUNS_FUER_ENTWUERFE = 5
  const draftRuns = useMemo(() => {
    return runs
      .filter((r) => DRAFT_AGENTS.has(r.agent) && r.status === 'done')
      .sort((a, b) => String(b.started).localeCompare(String(a.started)))
      .slice(0, RUNS_FUER_ENTWUERFE)
  }, [runs])

  const latestRun = draftRuns[0]
  const runKey = draftRuns.map((r) => r.id).join('|')

  const runningFollowup = runs.some((r) => DRAFT_AGENTS.has(r.agent) && r.status === 'running')

  useEffect(() => {
    if (draftRuns.length === 0 || runKey === loadedKey) return
    let cancelled = false
    setLoading(true)
    // Ein unlesbarer Run darf die anderen nicht mitreißen (der Spiegel hält nur
    // die letzten 20 — ältere Läufe fehlen dort schlicht).
    Promise.all(draftRuns.map((r) => fetchRun(r.id).catch(() => null)))
      .then((details) => {
        if (cancelled) return
        const gesehen = new Set<string>()
        const naechste: Card[] = []
        let key = 0
        // Neueste zuerst: Steht derselbe Lead in zwei Läufen, gewinnt der
        // jüngere Text — der ältere ist überholt, nicht zusätzlich.
        for (const detail of details) {
          if (!detail) continue
          const gespeichert = loadRunStatuses(detail.id)
          parseDrafts(detail.content).forEach((d, i) => {
            const ident = draftIdentitaet(d)
            if (gesehen.has(ident)) return
            gesehen.add(ident)
            const id = draftKey(d, i)
            const status = (gespeichert[id] ?? 'pending') as CardStatus
            // Abgeschlossenes aus älteren Läufen bleibt weg. Nur der jüngste Lauf
            // zeigt auch erledigte Karten — als Beleg dessen, was heute rausging.
            if (status !== 'pending' && detail.id !== latestRun?.id) return
            naechste.push({
              ...d,
              key: key++,
              id,
              runId: detail.id,
              subject: d.subject ?? '',
              status,
              error: null,
              confirming: false,
              alreadySent: null,
            })
          })
        }
        setCards(naechste)
        setLoadedKey(runKey)
      })
      .catch(() => {
        /* Runner offline und kein Spiegel → Karten bleiben leer */
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [draftRuns, runKey, loadedKey, latestRun?.id])

  // Zweite Sicherung gegen Doppelversand, geräteunabhängig: was seit dem Run
  // tatsächlich rausging, steht in sales_email_logs (von der send-email-Function
  // geschrieben). Markiert die Karte nur mit einem Hinweis — nicht stillschweigend
  // als erledigt, sonst verschwände ein noch offener Entwurf ungesehen.
  useEffect(() => {
    if (!supabase || !brandId || !loadedKey || draftRuns.length === 0) return
    // O5: Die Karten stammen jetzt aus mehreren Läufen — das Fenster beginnt beim
    // ÄLTESTEN geladenen Run, sonst bliebe ein Versand aus der Zwischenzeit
    // unbemerkt und die alte Karte sähe weiter offen aus.
    const ab = draftRuns[draftRuns.length - 1].started
    let cancelled = false
    void supabase
      .from('sales_email_logs')
      .select('contact_id, sent_at')
      .eq('brand_id', brandId)
      .eq('direction', 'outbound')
      .gte('sent_at', ab)
      .then(({ data, error }) => {
        if (cancelled || error || !data) return
        const letzte = new Map<string, string>()
        for (const row of data as Array<{ contact_id: string; sent_at: string }>) {
          const bisher = letzte.get(row.contact_id)
          if (!bisher || row.sent_at > bisher) letzte.set(row.contact_id, row.sent_at)
        }
        if (letzte.size === 0) return
        setCards((cs) =>
          cs.map((c) =>
            c.channel === 'email' && c.contact_id && letzte.has(c.contact_id)
              ? { ...c, alreadySent: letzte.get(c.contact_id) ?? null }
              : c,
          ),
        )
      })
    return () => {
      cancelled = true
    }
  }, [brandId, loadedKey, draftRuns])

  const patch = (key: number, next: Partial<Card>) =>
    setCards((cs) => cs.map((c) => (c.key === key ? { ...c, ...next } : c)))

  /**
   * Status setzen UND festschreiben — der eigentliche Persistenz-Pfad.
   * O5: an den Run der Karte, nicht an den jüngsten. Sonst landete ein
   * „erledigt" auf einem Entwurf aus dem Lauf davor am falschen Schlüssel und
   * die Karte käme beim nächsten Laden wieder hoch.
   */
  const setStatus = (card: Card, status: CardStatus, next: Partial<Card> = {}) => {
    patch(card.key, { status, ...next })
    if (isPersisted(status)) saveDraftStatus(card.runId, card.id, status)
    else clearDraftStatus(card.runId, card.id)
  }

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
      setStatus(card, 'sent')
    } else {
      setStatus(card, 'pending', {
        error: `Versand fehlgeschlagen: ${res.detail || res.error}`,
      })
    }
  }

  const copy = async (card: Card) => {
    try {
      await navigator.clipboard.writeText(card.message)
      setStatus(card, 'copied', { error: null })
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
            {posteingang.eintraege.length > 0
              ? `${posteingang.eintraege.length} von Kunden · ${openCount} Entwürfe`
              : `${openCount} offen · Agent bereitet vor, du gibst frei`}
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

      {/* Kundenpost zuerst: Das Portal verspricht Antwort in 24 h, die
          Agenten-Entwürfe haben keine Frist. */}
      <KundenPosteingang
        eintraege={posteingang.eintraege}
        loading={posteingang.loading}
        onAntworten={(e, text) => posteingang.antworte(e.projektId, text, senderName)}
        onNachrichtAbhaken={posteingang.hakeNachrichtAb}
        onWebsiteFreigeben={posteingang.gibWebsiteFrei}
        onWebsiteVerwerfen={posteingang.verwirfWebsite}
      />

      {posteingang.error ? (
        <div className="ck-panel" style={{ padding: '10px 14px', fontSize: 12.5, color: 'var(--ck-warn)' }}>
          Kundenpost lädt nicht: {posteingang.error}
        </div>
      ) : null}

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
          const name = contactLabel(contact, card.name || 'Unbekannter Kontakt')
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

              {card.alreadySent && card.status !== 'sent' ? (
                <div style={{ fontSize: 11.5, color: 'var(--ck-warn)', marginTop: 6 }}>
                  An diesen Kontakt ging seit dem Run bereits eine E-Mail raus (
                  {new Date(card.alreadySent).toLocaleString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  ) — vor dem Senden prüfen.
                </div>
              ) : null}

              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                {done ? (
                  <>
                    {card.status === 'sent' ? (
                      <span style={{ fontSize: 12, color: 'var(--ck-accent)' }}>✓ gesendet</span>
                    ) : card.status === 'copied' ? (
                      <span style={{ fontSize: 12, color: 'var(--ck-accent)' }}>✓ kopiert</span>
                    ) : card.status === 'done' ? (
                      <span style={{ fontSize: 12, color: 'var(--ck-text-3)' }}>✓ erledigt</span>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--ck-text-3)' }}>verworfen</span>
                    )}
                    {/* Der Status überlebt jetzt den Reload — darum braucht ein
                        versehentliches „Verwerfen"/„Erledigt" einen Weg zurück.
                        Ein echter Versand bleibt endgültig. */}
                    {card.status !== 'sent' ? (
                      <button
                        type="button"
                        className="ck-btn"
                        style={{ fontSize: 10, marginLeft: 'auto', color: 'var(--ck-text-3)' }}
                        onClick={() => setStatus(card, 'pending', { error: null })}
                      >
                        Zurückholen
                      </button>
                    ) : null}
                  </>
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
                      <button type="button" className="ck-btn" style={{ fontSize: 10 }} onClick={() => setStatus(card, 'done')}>
                        Erledigt
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="ck-btn"
                      style={{ fontSize: 10, marginLeft: 'auto', color: 'var(--ck-text-3)' }}
                      onClick={() => setStatus(card, 'rejected')}
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
