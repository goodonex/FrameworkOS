import { useMemo, useState } from 'react'
import type { Lead, LeadEreignis, LeadEreignisTyp } from '../../../types/db'

/**
 * Das Tagesjournal — „was ist heute rausgegangen?"
 *
 * Kevins Auftrag (20.08.2026): *„Ich hab das Ding, wenn ich in Uriel arbeite
 * und die zwanzig Follow-up-Nachrichten rausgeschickt hab — ich kann dann
 * nicht nochmal die zwanzig aufmachen und gucken, ist das alles so richtig
 * gelaufen. Da war heute Mittag einer dabei, da war ich auf der Webseite, die
 * war so gut. Den markier ich mir nochmal extra."*
 *
 * Genau dafür ist diese Ansicht da: Ein Haken in der Arbeitsliste war bisher
 * weg, sobald er gesetzt war. Hier steht er abends noch — mit Namen, Kanal und
 * einem Weg zurück in die Lead-Akte.
 *
 * **Nur ausgehende Ereignisse.** Eine erhaltene Antwort ist keine Leistung des
 * Tages, sie gehört in die Arbeitsliste. Was hier steht, hat Kevin selbst
 * getan — das ist die Frage, die er abends beantwortet haben will.
 */

const AUSGEHEND: LeadEreignisTyp[] = ['erstnachricht', 'followup', 'inmail', 'email', 'postkarte', 'anruf', 'loom_gesendet']

const KANAL_TITEL: Partial<Record<LeadEreignisTyp, string>> = {
  erstnachricht: 'Erstnachrichten',
  followup: 'Nachgefasst',
  loom_gesendet: 'Looms',
  inmail: 'InMails',
  email: 'E-Mails',
  postkarte: 'Postkarten',
  anruf: 'Anrufe',
}

function tagesSchluessel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  // Lokaler Tag, nicht UTC: Was Kevin um 23:30 verschickt, gehört auf seinen
  // Abend und nicht auf den nächsten Morgen.
  const jahr = d.getFullYear()
  const monat = String(d.getMonth() + 1).padStart(2, '0')
  const tag = String(d.getDate()).padStart(2, '0')
  return `${jahr}-${monat}-${tag}`
}

function heuteSchluessel(): string {
  return tagesSchluessel(new Date().toISOString())
}

function verschiebeTag(schluessel: string, tage: number): string {
  const [j, m, t] = schluessel.split('-').map(Number)
  const d = new Date(j, (m ?? 1) - 1, t ?? 1)
  d.setDate(d.getDate() + tage)
  return tagesSchluessel(d.toISOString())
}

function tagesTitel(schluessel: string): string {
  const heute = heuteSchluessel()
  if (schluessel === heute) return 'Heute'
  if (schluessel === verschiebeTag(heute, -1)) return 'Gestern'
  const [j, m, t] = schluessel.split('-').map(Number)
  return new Date(j, (m ?? 1) - 1, t ?? 1).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
}

export interface TagesjournalProps {
  leads: Lead[]
  ereignisse: LeadEreignis[]
  onLeadOeffnen: (leadId: string) => void
}

export function Tagesjournal({ leads, ereignisse, onLeadOeffnen }: TagesjournalProps) {
  const [tag, setTag] = useState(heuteSchluessel)

  const leadsNachId = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads])

  const desTages = useMemo(
    () => ereignisse.filter((e) => AUSGEHEND.includes(e.typ) && tagesSchluessel(e.at) === tag),
    [ereignisse, tag],
  )

  const nachKanal = useMemo(() => {
    const karte = new Map<LeadEreignisTyp, LeadEreignis[]>()
    for (const e of desTages) {
      const liste = karte.get(e.typ)
      if (liste) liste.push(e)
      else karte.set(e.typ, [e])
    }
    return [...karte.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [desTages])

  const istHeute = tag === heuteSchluessel()

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button type="button" className="ck-btn" onClick={() => setTag((t) => verschiebeTag(t, -1))}>
          ← Tag zurück
        </button>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ck-text-1)' }}>{tagesTitel(tag)}</div>
        <button
          type="button"
          className="ck-btn"
          onClick={() => setTag((t) => verschiebeTag(t, 1))}
          disabled={istHeute}
        >
          Tag vor →
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--ck-text-3)' }}>
          {desTages.length} {desTages.length === 1 ? 'Vorgang' : 'Vorgänge'}
        </span>
      </div>

      {desTages.length === 0 ? (
        <div style={{ fontSize: 14, color: 'var(--ck-text-3)' }}>
          {istHeute ? 'Heute ist noch nichts rausgegangen.' : 'An diesem Tag ist nichts rausgegangen.'}
        </div>
      ) : (
        nachKanal.map(([typ, liste]) => (
          <div key={typ}>
            <div className="ck-label" style={{ marginBottom: 8 }}>
              {KANAL_TITEL[typ] ?? typ} · {liste.length}
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {liste.map((e) => {
                const lead = leadsNachId.get(e.lead_id)
                const auszug = typeof e.details?.auszug === 'string' ? e.details.auszug : ''
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => onLeadOeffnen(e.lead_id)}
                      style={{
                        display: 'flex',
                        gap: 12,
                        width: '100%',
                        textAlign: 'left',
                        background: 'var(--ck-panel-2)',
                        border: '1px solid var(--ck-border)',
                        borderRadius: 'var(--ck-radius-innen)',
                        padding: '10px 12px',
                        minHeight: 44,
                        cursor: 'pointer',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ color: 'var(--ck-text-1)', fontSize: 14 }}>
                          {lead?.name ?? 'Unbekannter Lead'}
                          {lead?.markiert ? ' ★' : ''}
                        </span>
                        {auszug ? (
                          <span
                            style={{
                              display: 'block',
                              color: 'var(--ck-text-3)',
                              fontSize: 12,
                              marginTop: 2,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {auszug}
                          </span>
                        ) : null}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--ck-text-3)', flexShrink: 0 }}>
                        {new Date(e.at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))
      )}
    </section>
  )
}
