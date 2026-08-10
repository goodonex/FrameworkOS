import { useCallback, useState } from 'react'
import { useIsMobile } from '../../hooks/useViewport'
import type { Posten } from '../lib/prioritaet'
import type { ArbeitsmodusErgebnis } from './Arbeitsmodus'
import { ListenZeile } from './home/ListenZeile'

/**
 * Aufklappbare Arbeitsliste für das Kachel-Fenster (Desktop-Arbeitsfluss):
 * alle Namen einer Spur untereinander, Klick auf den Namen klappt den Text
 * darunter auf, daneben Haken (erledigt), Kopieren (nur bei versandfertigem
 * Text) und bei Looms Skript öffnen/generieren.
 *
 * Kopieren gibt es genau dort, wo ein versandfertiger Text liegt: bei
 * Erstnachrichten (`text` IST die Nachricht) und bei Posten mit `entwurf` —
 * dem vom Nacht-Agenten vorbereiteten Antwort-Entwurf. Bei allem anderen ist
 * `text` Kontext, kein Text zum Einfügen; ein Kopieren-Knopf wäre dort sinnlos.
 */

export interface LoomSkriptAktionen {
  /** öffenbare URL des generierten Skripts (lokal Runner, sonst Storage-Spiegel) */
  skriptUrl: (p: Posten) => string | null
  /**
   * Skript existiert laut Bibliothek. Ohne URL heißt das: es ist fertig, aber
   * noch nicht im Datei-Spiegel — dann darf NICHT wieder „generieren" stehen.
   */
  skriptVorhanden: (p: Posten) => boolean
  generiere: (p: Posten) => void
  /** Agent `loom-skript` läuft gerade (Runner erlaubt nur einen gleichzeitig) */
  laeuft: boolean
  /** dieser Posten wurde in dieser Sitzung zum Generieren angestoßen */
  angefordert: (p: Posten) => boolean
  /** Runner erreichbar — sonst bleibt der Generieren-Knopf aus */
  verfuegbar: boolean
  /** letzter Fehler beim Generieren — wird direkt am Loom-Posten angezeigt */
  fehler: string | null
}

interface ArbeitslisteProps {
  posten: Posten[]
  onErledigt: (ergebnis: ArbeitsmodusErgebnis) => void
  /** O7: einzige Aktion eines Erinnerungs-Postens (`nurZaehler`). */
  onZaehler?: (posten: Posten) => void
  /**
   * v2 (f): „→ morgen" hinter dem Wischen. Welche Posten sich verschieben
   * lassen, weiß der Aufrufer — die Liste soll keine Spur-Kenntnis bekommen.
   * Wo `moeglich` false sagt, erscheint die Aktion gar nicht erst.
   */
  morgen?: { moeglich: (posten: Posten) => boolean; verschiebe: (posten: Posten) => void }
  loom?: LoomSkriptAktionen
  /** Route zum Projekt einer Kundenaufgabe (Spur `kundenaufgabe`), sonst null */
  projektLink?: (p: Posten) => string | null
  onNavigiere?: (route: string) => void
}

function linkLabel(url: string): string {
  try {
    const host = new URL(/^https?:\/\//.test(url) ? url : `https://${url}`).hostname
    return host.includes('linkedin.com') ? 'LinkedIn-Profil' : host.replace(/^www\./, '')
  } catch {
    return url
  }
}

function linkHref(url: string): string {
  return /^https?:\/\//.test(url) ? url : `https://${url}`
}

/** „von heute Nacht" trägt mehr als ein Zeitstempel — das ist die Frage dahinter. */
export function entwurfStand(erstelltAm: string | null, jetzt: Date = new Date()): string {
  if (!erstelltAm) return 'vorbereitet'
  const t = new Date(erstelltAm).getTime()
  if (Number.isNaN(t)) return 'vorbereitet'
  const stunden = Math.floor((jetzt.getTime() - t) / (60 * 60 * 1000))
  if (stunden < 1) return 'gerade eben'
  if (stunden < 12) return `vor ${stunden} h`
  const tage = Math.floor(stunden / 24)
  if (tage < 1) return 'von heute Nacht'
  if (tage === 1) return 'von gestern'
  return `vor ${tage} Tagen`
}

export function Arbeitsliste({ posten, onErledigt, onZaehler, morgen, loom, projektLink, onNavigiere }: ArbeitslisteProps) {
  // Nur die eingeklappte Zeile hat zwei Fassungen (O18, Zug 7). Alles darunter —
  // Text, Entwurf, Kopieren, Skript, Loom, Ins Projekt — ist auf beiden Seiten
  // dieselbe Ansicht; eine zweite Komponente hätte hier zwei Wahrheiten erzeugt.
  const mobil = useIsMobile()
  const [offenId, setOffenId] = useState<string | null>(null)
  const [offenSeit, setOffenSeit] = useState(0)
  const [erledigt, setErledigt] = useState<Set<string>>(new Set())
  const [kopiertId, setKopiertId] = useState<string | null>(null)
  const [kopierGesperrt, setKopierGesperrt] = useState(false)

  const toggle = useCallback((id: string) => {
    setOffenId((prev) => (prev === id ? null : id))
    setOffenSeit(Date.now())
    setKopierGesperrt(false)
  }, [])

  const hake = useCallback(
    (p: Posten) => {
      if (erledigt.has(p.id)) return
      setErledigt((prev) => new Set(prev).add(p.id))
      // Dauer nur, wenn der Posten wirklich offen war — direkt weggehakte
      // Zeilen sind keine gemessene Arbeitszeit.
      const sekunden = offenId === p.id ? Math.max(0, Math.round((Date.now() - offenSeit) / 1000)) : 0
      onErledigt({ posten: p, sekunden })
    },
    [erledigt, offenId, offenSeit, onErledigt],
  )

  // Kopiert IMMER den versandfertigen Text: liegt ein Entwurf an, ist das der
  // Entwurf — `p.text` ist bei Antworten die Nachricht des Leads.
  const kopiere = useCallback(async (p: Posten) => {
    try {
      await navigator.clipboard.writeText(p.entwurf?.text ?? p.text)
      setKopiertId(p.id)
      window.setTimeout(() => setKopiertId((prev) => (prev === p.id ? null : prev)), 2000)
    } catch {
      setKopierGesperrt(true)
    }
  }, [])

  if (posten.length === 0) {
    return <span style={{ fontSize: 13, color: 'var(--ck-text-3)' }}>Nichts offen.</span>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {posten.map((p) => {
        const istOffen = offenId === p.id
        const istErledigt = erledigt.has(p.id)
        const kopierbar = p.spur === 'erstnachricht' || Boolean(p.entwurf)
        const skriptUrl = p.spur === 'loom' ? (loom?.skriptUrl(p) ?? null) : null
        const projekt = p.spur === 'kundenaufgabe' ? (projektLink?.(p) ?? null) : null
        return (
          <div key={p.id} style={{ borderBottom: '1px solid var(--ck-border)' }}>
            {mobil ? (
              /* O18, Zug 7 (D7): Am Handy die Erinnerungen-Grammatik — Kreis
                 links, Titel, Meta klein, rechts die EINE Aktion. Der Kreis
                 ruft `hake(p)`, also exakt denselben Pfad wie der ✓-Knopf am
                 Desktop; `nurZaehler`-Posten bekommen keinen (O7). Der
                 Aufklapp-Bereich darunter ist derselbe wie am Rechner —
                 Kopieren, Entwurf, Skript, Loom, Ins Projekt bleiben alle
                 dort, wo sie waren. */
              <ListenZeile
                titel={p.name}
                erledigt={istErledigt}
                onHaken={p.nurZaehler ? undefined : () => hake(p)}
                onMorgen={morgen && !p.nurZaehler && morgen.moeglich(p) ? () => morgen.verschiebe(p) : undefined}
                hakenLabel={`${p.name} als erledigt abhaken`}
                onTitel={() => toggle(p.id)}
                ausgeklappt={istOffen}
                meta={
                  [
                    p.firma && p.firma !== p.name ? p.firma : null,
                    p.spur === 'loom' && skriptUrl ? 'Skript da' : null,
                    p.entwurf ? (p.entwurf.veraltet ? 'Entwurf veraltet' : 'Entwurf da') : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || undefined
                }
                aktion={
                  p.nurZaehler ? (
                    <button
                      type="button"
                      className="ck-btn"
                      style={{ minHeight: 40, fontSize: 11 }}
                      onClick={() => onZaehler?.(p)}
                    >
                      Zaehler
                    </button>
                  ) : kopierbar ? (
                    <button
                      type="button"
                      className="ck-btn"
                      style={{ minHeight: 40, fontSize: 11, color: 'var(--ck-accent)' }}
                      onClick={() => void kopiere(p)}
                    >
                      {kopiertId === p.id ? '✓' : 'Kopieren'}
                    </button>
                  ) : p.spur === 'loom' && skriptUrl ? (
                    <a
                      className="ck-btn"
                      style={{ minHeight: 40, fontSize: 11, display: 'inline-flex', alignItems: 'center' }}
                      href={skriptUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Skript ↗
                    </a>
                  ) : null
                }
              />
            ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => toggle(p.id)}
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
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: istErledigt ? 'var(--ck-text-3)' : 'var(--ck-text-1)',
                    textDecoration: istErledigt ? 'line-through' : 'none',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.name}
                </span>
                {p.firma && p.firma !== p.name ? (
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--ck-text-3)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p.firma}
                  </span>
                ) : null}
                {p.spur === 'loom' && skriptUrl ? (
                  <span style={{ fontSize: 11, color: 'var(--ck-accent)', flexShrink: 0 }}>Skript da</span>
                ) : null}
                {/* Am eingeklappten Namen sichtbar, damit Kevin nicht aufklappen
                    muss, um zu sehen, ob etwas vorbereitet ist. */}
                {p.entwurf ? (
                  <span
                    style={{
                      fontSize: 11,
                      flexShrink: 0,
                      color: p.entwurf.veraltet ? 'var(--ck-warn)' : 'var(--ck-accent)',
                    }}
                  >
                    {p.entwurf.veraltet ? 'Entwurf veraltet' : 'Entwurf da'}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                className="ck-btn"
                onClick={() => hake(p)}
                disabled={istErledigt}
                aria-label={`${p.name} als erledigt abhaken`}
                style={{
                  minHeight: 36,
                  minWidth: 44,
                  flexShrink: 0,
                  color: istErledigt ? 'var(--ck-accent)' : undefined,
                }}
              >
                ✓
              </button>
            </div>
            )}

            {istOffen ? (
              <div style={{ padding: '0 2px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {p.website ? (
                  <a
                    href={linkHref(p.website)}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 13, color: 'var(--ck-accent)', textDecoration: 'none' }}
                  >
                    {linkLabel(p.website)} ↗
                  </a>
                ) : null}
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
                  {p.text}
                </div>
                {p.entwurf ? (
                  <div
                    style={{
                      border: '1px solid var(--ck-border-strong)',
                      borderRadius: 'var(--ck-radius-innen)',
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <span className="ck-label" style={{ color: 'var(--ck-accent)' }}>
                        Entwurf
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--ck-text-3)' }}>
                        {entwurfStand(p.entwurf.erstelltAm)}
                      </span>
                    </div>
                    {p.entwurf.veraltet ? (
                      <span style={{ fontSize: 12, color: 'var(--ck-warn)' }}>
                        Der Lead hat danach nochmal geschrieben — vor dem Senden gegenlesen.
                      </span>
                    ) : null}
                    <div
                      style={{
                        whiteSpace: 'pre-wrap',
                        fontSize: 13,
                        lineHeight: 1.6,
                        color: 'var(--ck-text-1)',
                        maxHeight: 260,
                        overflowY: 'auto',
                      }}
                    >
                      {p.entwurf.text}
                    </div>
                  </div>
                ) : null}
                {kopierGesperrt ? (
                  <span style={{ fontSize: 12, color: 'var(--ck-warn)' }}>
                    Zwischenablage gesperrt — Text markieren und kopieren.
                  </span>
                ) : null}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {kopierbar ? (
                    <button
                      type="button"
                      className="ck-btn ck-btn--primary"
                      style={{ minHeight: 40 }}
                      onClick={() => void kopiere(p)}
                    >
                      {kopiertId === p.id ? '✓ Kopiert' : 'Nachricht kopieren'}
                    </button>
                  ) : null}
                  {p.spur === 'loom' && loom ? (
                    skriptUrl ? (
                      <a
                        className="ck-btn ck-btn--primary"
                        style={{ minHeight: 40, display: 'inline-flex', alignItems: 'center' }}
                        href={skriptUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Skript öffnen ↗
                      </a>
                    ) : loom.skriptVorhanden(p) ? (
                      // Fertig, aber noch nicht im Datei-Spiegel. Ehrlicher
                      // Zwischenstand statt eines zweiten Generieren-Laufs.
                      <span style={{ fontSize: 13, color: 'var(--ck-accent)', alignSelf: 'center' }}>
                        Skript fertig — wird gerade gespiegelt
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="ck-btn ck-btn--primary"
                        style={{ minHeight: 40 }}
                        disabled={!loom.verfuegbar || loom.laeuft}
                        onClick={() => loom.generiere(p)}
                      >
                        {loom.laeuft && loom.angefordert(p)
                          ? 'Skript wird generiert …'
                          : loom.verfuegbar
                            ? 'Skript generieren'
                            : 'Runner offline'}
                      </button>
                    )
                  ) : null}
                  {/* O3 Zug 9: Aufnehmen ist der Schritt zwischen „Skript da"
                      und „Haken" — bisher fehlte er ganz. Bewusst ein echter
                      Link statt window.open: aus einem async-Kontext heraus
                      schluckt der Popup-Blocker das Fenster. Kein loom://,
                      das ist nicht verlaesslich; die Desktop-App faengt die
                      URL selbst ab, wenn sie installiert ist. */}
                  {p.spur === 'loom' ? (
                    <a
                      className="ck-btn"
                      style={{ minHeight: 40, display: 'inline-flex', alignItems: 'center' }}
                      href="https://www.loom.com/record"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Loom aufnehmen ↗
                    </a>
                  ) : null}
                  {projekt && onNavigiere ? (
                    <button
                      type="button"
                      className="ck-btn"
                      style={{ minHeight: 40 }}
                      onClick={() => onNavigiere(projekt)}
                    >
                      Ins Projekt
                    </button>
                  ) : null}
                  {/* O7: Erinnerungs-Posten bekommen GENAU EINE Aktion und
                      keinen Haken — die Wahrheit ist der Zaehler. */}
                  {p.nurZaehler ? (
                    <button
                      type="button"
                      className="ck-btn ck-btn--primary"
                      style={{ minHeight: 40 }}
                      onClick={() => onZaehler?.(p)}
                    >
                      Zaehler oeffnen
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ck-btn"
                      style={{ minHeight: 40 }}
                      disabled={istErledigt}
                      onClick={() => hake(p)}
                    >
                      {istErledigt ? '✓ Erledigt' : 'Erledigt'}
                    </button>
                  )}
                </div>
                {p.spur === 'loom' && loom?.fehler ? (
                  <span style={{ fontSize: 12, color: 'var(--ck-warn)' }}>{loom.fehler}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
