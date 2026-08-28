import { useCallback, useMemo, useState, type CSSProperties } from 'react'
import { useIsMobile } from '../../../hooks/useViewport'
import type { Lead, LeadEreignis, LeadEreignisTyp, LinkedinThread } from '../../../types/db'
import { SPRUNG_ZIELE, STATION_TITEL, leadStation, type Station } from '../../lib/leadStation'

/**
 * Die Lead-Akte — ein Klick auf einen Namen, und die ganze Geschichte steht da.
 *
 * Kevins Auftrag (20.08.2026): *„Leads wirklich als eigene Leads behandeln und
 * nicht nur wie To-dos, wie Aufgaben."* Genau das ist der Unterschied, den
 * dieses Fenster macht — eine Aufgabe ist weg, wenn sie abgehakt ist; ein Lead
 * behält seine Historie und lässt sich auf Wiedervorlage legen.
 *
 * **Fenster, nicht Tab und nicht Seite** (Kevins UI-Gesetze): Am Schreibtisch
 * eine zentrierte Karte über dem, woran er gerade arbeitet — die Liste bleibt
 * sichtbar, der Kontext geht nicht verloren. Am Handy Vollbild, weil eine
 * zentrierte Karte auf 390 Pixeln nur ein Rahmen um zu wenig Inhalt wäre.
 */

const EREIGNIS_TITEL: Record<LeadEreignisTyp, string> = {
  anfrage: 'Vernetzungsanfrage raus',
  angenommen: 'Anfrage angenommen',
  erstnachricht: 'Erstnachricht geschickt',
  followup: 'Nachgefasst',
  antwort_erhalten: 'Antwort erhalten',
  loom_zugesagt: 'Loom zugesagt',
  loom_abgelehnt: 'Loom abgelehnt',
  loom_gesendet: 'Loom geschickt',
  inmail: 'InMail geschickt',
  email: 'E-Mail geschickt',
  postkarte: 'Postkarte geschickt',
  anruf: 'Angerufen',
  instagram: 'Auf Instagram geschrieben',
  pdf: 'Analyse-PDF geschickt',
  // Bewusst als Korrektur benannt, nicht als Vorgang: Die Zeile darf sich in
  // sechs Wochen nicht wie ein verschickter Kanal lesen (0080).
  uebersprungen: 'Stufe übersprungen (Handkorrektur)',
  wiedervorlage_gesetzt: 'Wiedervorlage gesetzt',
  disqualifiziert: 'Aussortiert',
  reaktiviert: 'Wieder aufgenommen',
  notiz: 'Notiz',
}

/**
 * Ereignisse, die Kevin selbst auslöst — alles, was kein Sync mitbekommt.
 *
 * In Kadenz-Reihenfolge, nicht alphabetisch: Wer die Akte offen hat, sucht den
 * Knopf zu dem Schritt, der oben als nächster Schritt steht. InMail steht
 * bewusst am Ende — sie ist der Nebenstrom und hakt nichts ab.
 */
const HANDGRIFFE: { typ: LeadEreignisTyp; titel: string }[] = [
  { typ: 'instagram', titel: 'Instagram raus' },
  { typ: 'pdf', titel: 'Analyse-PDF raus' },
  { typ: 'email', titel: 'E-Mail raus' },
  { typ: 'postkarte', titel: 'Postkarte raus' },
  { typ: 'anruf', titel: 'Angerufen' },
  { typ: 'inmail', titel: 'InMail raus' },
]

function datumLang(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
}

function tageHer(iso: string, jetzt: number): string {
  const ms = jetzt - new Date(iso).getTime()
  if (!Number.isFinite(ms)) return ''
  const tage = Math.floor(ms / 86_400_000)
  if (tage <= 0) return 'heute'
  if (tage === 1) return 'gestern'
  return `vor ${tage} Tagen`
}

export interface LeadAkteProps {
  lead: Lead
  ereignisse: LeadEreignis[]
  thread?: Pick<
    LinkedinThread,
    'status' | 'last_from' | 'last_message_at' | 'followup_stage' | 'snoozed_until' | 'starred' | 'loom_status'
  > | null
  onClose: () => void
  onWiedervorlage: (datum: string, grund: string) => void | Promise<void>
  onDisqualifizieren: (grund: string) => void | Promise<void>
  onReaktivieren: () => void | Promise<void>
  onMarkieren: (markiert: boolean) => void | Promise<void>
  onNotiz: (notiz: string) => void | Promise<void>
  onProtokolliere: (typ: LeadEreignisTyp) => void | Promise<void>
  /**
   * Von Hand auf eine Stufe setzen (0080). Getrennt von `onProtokolliere`,
   * weil es KEIN Kanal-Ereignis ist: Es behauptet nicht, dass etwas
   * rausgegangen ist, sondern dass Kevin entschieden hat.
   */
  onUmhaengen?: (nach: Station, grund: string) => void | Promise<void>
}

export function LeadAkte({
  lead,
  ereignisse,
  thread,
  onClose,
  onWiedervorlage,
  onDisqualifizieren,
  onReaktivieren,
  onMarkieren,
  onNotiz,
  onProtokolliere,
  onUmhaengen,
}: LeadAkteProps) {
  const mobil = useIsMobile()
  const jetzt = useMemo(() => new Date(), [])
  const [notiz, setNotiz] = useState(lead.notiz)
  const [sprungZiel, setSprungZiel] = useState('')
  const [sprungGrund, setSprungGrund] = useState('')
  const [wvDatum, setWvDatum] = useState('')
  const [wvGrund, setWvGrund] = useState('')
  const [dqGrund, setDqGrund] = useState('')
  const [zeigeWv, setZeigeWv] = useState(false)
  const [zeigeDq, setZeigeDq] = useState(false)

  const stand = useMemo(
    () =>
      leadStation(
        {
          lead_status: lead.lead_status,
          wiedervorlage_am: lead.wiedervorlage_am,
          ereignisse: ereignisse.map((e) => ({ typ: e.typ, at: e.at, details: e.details })),
          thread,
        },
        jetzt,
      ),
    [lead.lead_status, lead.wiedervorlage_am, ereignisse, thread, jetzt],
  )

  // Kevins eigentliche Frage: „wie oft habe ich den geschrieben?"
  const kontakte = useMemo(
    () =>
      ereignisse.filter((e) =>
        (
          ['erstnachricht', 'followup', 'instagram', 'pdf', 'inmail', 'email', 'postkarte', 'anruf'] as LeadEreignisTyp[]
        ).includes(e.typ),
      ).length,
    [ereignisse],
  )

  const speichereWv = useCallback(() => {
    if (!wvDatum) return
    void onWiedervorlage(wvDatum, wvGrund)
    setZeigeWv(false)
  }, [wvDatum, wvGrund, onWiedervorlage])

  const speichereDq = useCallback(() => {
    void onDisqualifizieren(dqGrund)
    setZeigeDq(false)
  }, [dqGrund, onDisqualifizieren])

  const overlay: CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 120,
    background: 'var(--ck-backdrop, rgba(0,0,0,0.55))',
    display: 'flex',
    alignItems: mobil ? 'stretch' : 'center',
    justifyContent: 'center',
    padding: mobil ? 0 : 24,
  }

  const karte: CSSProperties = {
    background: 'var(--ck-panel)',
    border: mobil ? 'none' : '1px solid var(--ck-border)',
    borderRadius: mobil ? 0 : 'var(--ck-radius)',
    width: mobil ? '100%' : 'min(720px, 100%)',
    maxHeight: mobil ? '100%' : '85vh',
    display: 'flex',
    flexDirection: 'column',
    paddingTop: mobil ? 'env(safe-area-inset-top)' : undefined,
    paddingBottom: mobil ? 'env(safe-area-inset-bottom)' : undefined,
    overflow: 'hidden',
  }

  return (
    <div
      style={overlay}
      role="dialog"
      aria-modal="true"
      aria-label={`Lead-Akte ${lead.name}`}
      // Klick auf den Hintergrund schließt — aber nur dort, nicht in der Karte.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div style={karte}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: 20,
            borderBottom: '1px solid var(--ck-border)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--ck-text-1)' }}>{lead.name}</div>
            {lead.headline ? (
              <div style={{ fontSize: 13, color: 'var(--ck-text-3)', marginTop: 2 }}>{lead.headline}</div>
            ) : null}
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: 12,
                  padding: '3px 10px',
                  borderRadius: 'var(--ck-radius-pille)',
                  background: stand.faellig ? 'var(--ck-accent)' : 'var(--ck-panel-2)',
                  // Dunkel auf dem hellen Akzent — siehe Badge.tsx.
                  color: stand.faellig ? 'var(--ck-bg)' : 'var(--ck-text-2)',
                }}
              >
                {STATION_TITEL[stand.station]}
              </span>
              {/* Nur zeigen, wenn er mehr sagt als das Etikett daneben —
                  „Wartet auf Antwort · Wartet auf Antwort" liest sich wie ein Fehler. */}
              {stand.naechsterSchritt !== STATION_TITEL[stand.station] ? (
                <span style={{ fontSize: 12, color: 'var(--ck-text-3)' }}>{stand.naechsterSchritt}</span>
              ) : null}
            </div>
          </div>
          <button type="button" className="ck-btn" onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13, color: 'var(--ck-text-2)' }}>
            <span>
              <strong style={{ color: 'var(--ck-text-1)' }}>{kontakte}</strong> Kontakte insgesamt
            </span>
            <span>
              <strong style={{ color: 'var(--ck-text-1)' }}>{ereignisse.length}</strong> Ereignisse
            </span>
            {lead.profile_url ? (
              <a href={lead.profile_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ck-accent)' }}>
                LinkedIn-Profil ↗
              </a>
            ) : null}
          </div>

          {lead.lead_status === 'wiedervorlage' && lead.wiedervorlage_am ? (
            <div
              style={{
                fontSize: 13,
                padding: 12,
                borderRadius: 'var(--ck-radius-innen)',
                background: 'var(--ck-panel-2)',
                color: 'var(--ck-text-2)',
              }}
            >
              Wiedervorlage am {datumLang(`${lead.wiedervorlage_am}T09:00:00Z`)}
              {lead.wiedervorlage_grund ? ` — ${lead.wiedervorlage_grund}` : ''}
            </div>
          ) : null}

          {lead.lead_status === 'disqualifiziert' ? (
            <div
              style={{
                fontSize: 13,
                padding: 12,
                borderRadius: 'var(--ck-radius-innen)',
                background: 'var(--ck-panel-2)',
                color: 'var(--ck-text-3)',
              }}
            >
              Aussortiert{lead.disqualifiziert_grund ? ` — ${lead.disqualifiziert_grund}` : ''}
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="ck-btn" onClick={() => void onMarkieren(!lead.markiert)}>
              {lead.markiert ? '★ Markiert' : '☆ Markieren'}
            </button>
            {lead.lead_status === 'aktiv' ? (
              <>
                <button type="button" className="ck-btn" onClick={() => setZeigeWv((v) => !v)}>
                  Wiedervorlage
                </button>
                <button type="button" className="ck-btn" onClick={() => setZeigeDq((v) => !v)}>
                  Aussortieren
                </button>
              </>
            ) : (
              <button type="button" className="ck-btn" onClick={() => void onReaktivieren()}>
                Wieder aufnehmen
              </button>
            )}
          </div>

          {zeigeWv ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="date"
                className="ck-input"
                value={wvDatum}
                onChange={(e) => setWvDatum(e.target.value)}
                aria-label="Wiedervorlage-Datum"
              />
              <input
                type="text"
                className="ck-input"
                placeholder="Grund, z. B. „meldet sich in 2 Monaten“"
                value={wvGrund}
                onChange={(e) => setWvGrund(e.target.value)}
                style={{ flex: 1, minWidth: 200 }}
              />
              <button type="button" className="ck-btn ck-btn--primary" onClick={speichereWv} disabled={!wvDatum}>
                Setzen
              </button>
            </div>
          ) : null}

          {zeigeDq ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="text"
                className="ck-input"
                placeholder="Warum macht es keinen Sinn?"
                value={dqGrund}
                onChange={(e) => setDqGrund(e.target.value)}
                style={{ flex: 1, minWidth: 200 }}
              />
              <button type="button" className="ck-btn ck-btn--primary" onClick={speichereDq}>
                Aussortieren
              </button>
            </div>
          ) : null}

          <div>
            <div className="ck-label" style={{ marginBottom: 8 }}>
              Was ist rausgegangen?
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {HANDGRIFFE.map((h) => (
                <button key={h.typ} type="button" className="ck-btn" onClick={() => void onProtokolliere(h.typ)}>
                  {h.titel}
                </button>
              ))}
            </div>
          </div>

          {/* Von Hand umhaengen (0080). Bewusst UNTER „Was ist rausgegangen?"
              und optisch ruhiger: Es ist eine Korrektur, kein Vorgang — und es
              soll sich nicht wie ein weiterer Kanal-Knopf anfuehlen. */}
          {onUmhaengen ? (
            <div>
              <div className="ck-label" style={{ marginBottom: 4 }}>
                Von Hand auf eine Stufe setzen
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ck-text-3)', marginBottom: 8 }}>
                Trägt keinen Kanal ein — die Akte hält fest, dass du es entschieden hast.
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  className="ck-input"
                  value={sprungZiel}
                  onChange={(ev) => setSprungZiel(ev.target.value)}
                  style={{ minHeight: 40 }}
                  aria-label="Stufe wählen"
                >
                  <option value="">Stufe wählen …</option>
                  {SPRUNG_ZIELE.map((z) => (
                    <option key={z} value={z}>
                      {STATION_TITEL[z]}
                    </option>
                  ))}
                </select>
                <input
                  className="ck-input"
                  value={sprungGrund}
                  onChange={(ev) => setSprungGrund(ev.target.value)}
                  placeholder="Grund (optional)"
                  style={{ minHeight: 40, flex: 1, minWidth: 160 }}
                  aria-label="Grund"
                />
                <button
                  type="button"
                  className="ck-btn"
                  style={{ minHeight: 40 }}
                  disabled={!sprungZiel}
                  onClick={() => {
                    if (!sprungZiel) return
                    void onUmhaengen(sprungZiel as Station, sprungGrund.trim())
                    setSprungZiel('')
                    setSprungGrund('')
                  }}
                >
                  Umhängen
                </button>
              </div>
            </div>
          ) : null}

          <div>
            <div className="ck-label" style={{ marginBottom: 8 }}>
              Notiz
            </div>
            <textarea
              className="ck-input"
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              onBlur={() => {
                if (notiz !== lead.notiz) void onNotiz(notiz)
              }}
              rows={3}
              style={{ width: '100%', resize: 'vertical' }}
              placeholder="Was du dir merken willst"
            />
          </div>

          <div>
            <div className="ck-label" style={{ marginBottom: 8 }}>
              Verlauf
            </div>
            {ereignisse.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--ck-text-3)' }}>Noch nichts passiert.</div>
            ) : (
              <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {ereignisse.map((e) => {
                  const auszug = typeof e.details?.auszug === 'string' ? e.details.auszug : ''
                  return (
                    <li key={e.id} style={{ display: 'flex', gap: 12, fontSize: 13 }}>
                      <span
                        aria-hidden="true"
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: 'var(--ck-accent)',
                          marginTop: 6,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ color: 'var(--ck-text-1)' }}>{EREIGNIS_TITEL[e.typ]}</span>
                        {auszug ? (
                          <span style={{ display: 'block', color: 'var(--ck-text-3)', marginTop: 2 }}>„{auszug}"</span>
                        ) : null}
                      </span>
                      <span style={{ color: 'var(--ck-text-3)', flexShrink: 0, textAlign: 'right' }}>
                        {datumLang(e.at)}
                        <span style={{ display: 'block', fontSize: 11 }}>{tageHer(e.at, jetzt.getTime())}</span>
                      </span>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
