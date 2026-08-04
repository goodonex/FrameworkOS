import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AENDERUNG_LABEL,
  beschreibeAenderung,
  wartetSeit,
  type PosteingangEintrag,
} from '../lib/posteingang'

/**
 * Kunden-Posteingang als aufklappbare Namensliste — dasselbe Muster wie die
 * Arbeitsliste: Name/Projekt anklicken → Inhalt darunter → Aktion daneben →
 * Haken. Kein eigener Bereich, kein zweiter Ort zum Abarbeiten; die Liste lebt
 * oben in /freigaben, wo Kevin ohnehin nachsieht, was auf ihn wartet.
 *
 * Kopieren gibt es hier bewusst NICHT: In der Warteschlange liegt die Nachricht
 * des Kunden bzw. sein Änderungswunsch — kein versandfertiger Text von uns.
 * Das Kopier-Gesetz gilt nur, wo etwas zum Einfügen bereitliegt.
 */

interface Props {
  eintraege: PosteingangEintrag[]
  loading: boolean
  onAntworten: (eintrag: PosteingangEintrag, text: string) => Promise<{ ok: boolean; error?: string }>
  onNachrichtAbhaken: (id: string) => void | Promise<void>
  onWebsiteFreigeben: (eintrag: PosteingangEintrag) => Promise<{ ok: boolean; error?: string }>
  onWebsiteVerwerfen: (eintrag: PosteingangEintrag) => Promise<{ ok: boolean; error?: string }>
}

const ART_LABEL: Record<PosteingangEintrag['art'], string> = {
  nachricht: 'Nachricht',
  website: 'Website',
}

function Wert({ titel, wert, gedimmt }: { titel: string; wert: string | null; gedimmt?: boolean }) {
  const leer = !wert || !wert.trim()
  return (
    <div style={{ flex: '1 1 220px', minWidth: 0 }}>
      <div className="ck-label" style={{ marginBottom: 4 }}>
        {titel}
      </div>
      <div
        style={{
          whiteSpace: 'pre-wrap',
          fontSize: 13,
          lineHeight: 1.55,
          color: leer ? 'var(--ck-text-3)' : gedimmt ? 'var(--ck-text-2)' : 'var(--ck-text-1)',
          border: '1px solid var(--ck-border)',
          borderRadius: 6,
          padding: '8px 10px',
          maxHeight: 200,
          overflowY: 'auto',
        }}
      >
        {leer ? '(leer)' : wert}
      </div>
    </div>
  )
}

export function KundenPosteingang({
  eintraege,
  loading,
  onAntworten,
  onNachrichtAbhaken,
  onWebsiteFreigeben,
  onWebsiteVerwerfen,
}: Props) {
  const navigate = useNavigate()
  const [offenId, setOffenId] = useState<string | null>(null)
  const [entwurf, setEntwurf] = useState<Record<string, string>>({})
  const [laeuft, setLaeuft] = useState<string | null>(null)
  const [bestaetigt, setBestaetigt] = useState<string | null>(null)
  const [fehler, setFehler] = useState<Record<string, string>>({})

  const toggle = useCallback((id: string) => {
    setOffenId((prev) => (prev === id ? null : id))
    setBestaetigt(null)
  }, [])

  const setzeFehler = (id: string, text: string | null) =>
    setFehler((f) => {
      const next = { ...f }
      if (text) next[id] = text
      else delete next[id]
      return next
    })

  const antworten = async (e: PosteingangEintrag) => {
    const text = (entwurf[e.id] ?? '').trim()
    if (!text) {
      setzeFehler(e.id, 'Erst eine Antwort schreiben.')
      return
    }
    setLaeuft(e.id)
    setzeFehler(e.id, null)
    const res = await onAntworten(e, text)
    setLaeuft(null)
    if (!res.ok) {
      setzeFehler(e.id, res.error ?? 'Senden fehlgeschlagen')
      return
    }
    setEntwurf((d) => ({ ...d, [e.id]: '' }))
    // Beantwortet heißt erledigt — der Posten verlässt die Warteschlange.
    await onNachrichtAbhaken(e.id)
  }

  const freigeben = async (e: PosteingangEintrag) => {
    setLaeuft(e.id)
    setzeFehler(e.id, null)
    const res = await onWebsiteFreigeben(e)
    setLaeuft(null)
    setBestaetigt(null)
    if (!res.ok) setzeFehler(e.id, res.error ?? 'Freigeben fehlgeschlagen')
  }

  const verwerfen = async (e: PosteingangEintrag) => {
    setLaeuft(e.id)
    setzeFehler(e.id, null)
    const res = await onWebsiteVerwerfen(e)
    setLaeuft(null)
    if (!res.ok) setzeFehler(e.id, res.error ?? 'Verwerfen fehlgeschlagen')
  }

  if (loading && eintraege.length === 0) {
    return (
      <section className="ck-panel" style={{ padding: 14, fontSize: 12.5, color: 'var(--ck-text-3)' }}>
        Lädt Kundenpost …
      </section>
    )
  }

  if (eintraege.length === 0) return null

  const ueberfaellige = eintraege.filter((e) => wartetSeit(e.seit).ueberfaellig).length

  return (
    <section className="ck-panel" aria-label="Kunden-Posteingang" style={{ overflow: 'hidden' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
          padding: '10px 14px',
          borderBottom: '1px solid var(--ck-border)',
          flexWrap: 'wrap',
        }}
      >
        <span className="ck-label" style={{ color: 'var(--ck-accent)' }}>
          Von Kunden
        </span>
        <span style={{ fontSize: 12.5, color: 'var(--ck-text-2)' }}>
          {eintraege.length} {eintraege.length === 1 ? 'Posten wartet' : 'Posten warten'} auf dich
        </span>
        {ueberfaellige > 0 ? (
          <span style={{ fontSize: 12.5, color: 'var(--ck-warn)' }}>
            · {ueberfaellige} länger als 24 h
          </span>
        ) : null}
      </header>

      <div style={{ padding: '0 14px' }}>
        {eintraege.map((e) => {
          const istOffen = offenId === e.id
          const wartet = wartetSeit(e.seit)
          const aenderung = e.art === 'website' ? beschreibeAenderung(e.alt, e.neu) : null
          const busy = laeuft === e.id

          return (
            <div key={e.id} style={{ borderBottom: '1px solid var(--ck-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => toggle(e.id)}
                  aria-expanded={istOffen}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 44,
                    padding: '8px 2px',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    className="ck-label"
                    style={{
                      flexShrink: 0,
                      border: '1px solid var(--ck-border)',
                      borderRadius: 999,
                      padding: '1px 8px',
                      color: e.art === 'website' ? 'var(--ck-text-2)' : 'var(--ck-accent)',
                    }}
                  >
                    {ART_LABEL[e.art]}
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--ck-text-1)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {e.titel}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--ck-text-3)' }}>{e.projektName}</span>
                  <span
                    style={{
                      fontSize: 11,
                      flexShrink: 0,
                      color: wartet.ueberfaellig ? 'var(--ck-warn)' : 'var(--ck-text-3)',
                    }}
                  >
                    {wartet.label}
                  </span>
                  {aenderung ? (
                    <span style={{ fontSize: 11, color: 'var(--ck-text-3)' }}>
                      {AENDERUNG_LABEL[aenderung.art]}
                    </span>
                  ) : null}
                </button>
                {e.art === 'nachricht' ? (
                  <button
                    type="button"
                    className="ck-btn"
                    onClick={() => void onNachrichtAbhaken(e.id)}
                    aria-label={`Nachricht von ${e.titel} als erledigt abhaken`}
                    style={{ minHeight: 36, minWidth: 44, flexShrink: 0 }}
                  >
                    ✓
                  </button>
                ) : null}
              </div>

              {istOffen ? (
                <div style={{ padding: '0 2px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {e.art === 'nachricht' ? (
                    <>
                      <div
                        style={{
                          whiteSpace: 'pre-wrap',
                          fontSize: 13,
                          lineHeight: 1.6,
                          color: 'var(--ck-text-2)',
                          maxHeight: 320,
                          overflowY: 'auto',
                        }}
                      >
                        {e.text}
                      </div>
                      <textarea
                        className="ck-input"
                        value={entwurf[e.id] ?? ''}
                        onChange={(ev) => setEntwurf((d) => ({ ...d, [e.id]: ev.target.value }))}
                        rows={4}
                        placeholder="Antwort an den Kunden …"
                        aria-label={`Antwort an ${e.titel}`}
                        style={{ width: '100%', fontSize: 13, lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' }}
                      />
                    </>
                  ) : (
                    <>
                      {e.bereich ? (
                        <span className="ck-label">
                          {e.bereich} · {e.titel}
                        </span>
                      ) : null}
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <Wert titel="Bisher veröffentlicht" wert={e.alt} gedimmt />
                        <Wert titel="Vom Kunden eingereicht" wert={e.neu} />
                      </div>
                    </>
                  )}

                  {fehler[e.id] ? (
                    <span style={{ fontSize: 12, color: 'var(--ck-warn)' }}>{fehler[e.id]}</span>
                  ) : null}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {e.art === 'nachricht' ? (
                      <>
                        <button
                          type="button"
                          className="ck-btn ck-btn--primary"
                          style={{ minHeight: 40 }}
                          disabled={busy}
                          onClick={() => void antworten(e)}
                        >
                          {busy ? 'sendet …' : 'Antwort an Kunden senden'}
                        </button>
                        <button
                          type="button"
                          className="ck-btn"
                          style={{ minHeight: 40 }}
                          disabled={busy}
                          onClick={() => void onNachrichtAbhaken(e.id)}
                        >
                          Ohne Antwort erledigt
                        </button>
                      </>
                    ) : bestaetigt === e.id ? (
                      <>
                        {/* Freigeben ändert die Kundenwebsite — deshalb ein
                            zweiter, benannter Klick statt eines stillen Häkchens. */}
                        <span style={{ fontSize: 12.5, color: 'var(--ck-text-2)' }}>
                          Auf der Kundenwebsite veröffentlichen?
                        </span>
                        <button
                          type="button"
                          className="ck-btn ck-btn--primary"
                          style={{ minHeight: 40 }}
                          disabled={busy}
                          onClick={() => void freigeben(e)}
                        >
                          {busy ? 'veröffentlicht …' : 'Ja, veröffentlichen'}
                        </button>
                        <button
                          type="button"
                          className="ck-btn"
                          style={{ minHeight: 40 }}
                          onClick={() => setBestaetigt(null)}
                        >
                          Abbrechen
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="ck-btn ck-btn--primary"
                          style={{ minHeight: 40 }}
                          disabled={busy}
                          onClick={() => setBestaetigt(e.id)}
                        >
                          Freigeben …
                        </button>
                        <button
                          type="button"
                          className="ck-btn"
                          style={{ minHeight: 40 }}
                          disabled={busy}
                          onClick={() => void verwerfen(e)}
                        >
                          Änderung verwerfen
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="ck-btn"
                      style={{ minHeight: 40, marginLeft: 'auto', color: 'var(--ck-text-3)' }}
                      onClick={() => navigate(`/projekte/${e.projektId}`)}
                    >
                      Ins Projekt
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}
