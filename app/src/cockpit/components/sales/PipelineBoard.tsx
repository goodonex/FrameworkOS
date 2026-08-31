import { useMemo } from 'react'
import { useIsMobile } from '../../../hooks/useViewport'
import type { FunnelKarte, FunnelKartenId } from '../../lib/funnelKarten'
import { rateFuer, type KantenRate } from '../../lib/funnelRaten'
import { FUNNEL_KANTEN } from '../../lib/funnelRaten'

/**
 * Das Pipeline-Board (25.08.2026, Blaupause `docs/wargames/pipeline-board.md`,
 * Zug 3) — Kevins Funnel als Fläche statt als Liste.
 *
 * **Warum SVG und keine Bibliothek.** Der OS-Graph nutzt d3-force auf
 * Canvas-2D, aber das ist für *unbekannte* Strukturen. Hier ist die Struktur
 * bekannt und fest, und Kevin hat „fest angeordnet" gewählt — ein Kraft-Layout
 * würde dieselbe Ordnung bei jedem Laden neu auswürfeln.
 *
 * **Was die Liste nicht kann und das hier schon.** Kevins Pipeline ist kein
 * Strang, sondern ein Baum: Nach dem dritten Follow-up gabelt sie sich in den
 * lauten Ast (angenommen, nie geantwortet → Instagram → PDF → Postkarte →
 * Anruf) und den stillen (nie angenommen → E-Mail → Postkarte → Anruf).
 * Untereinander gelistet sieht das aus wie neun weitere Schritte derselben
 * Reihe. Es sind zwei getrennte Wege, und an dieser Struktur entscheidet sich,
 * wo optimiert wird.
 *
 * **Die Conversion steht an den Kanten, nicht an den Knoten.** Nicht „hier
 * stehen 368", sondern „von hier kommen 42 % dort an" — und wo keine Zahl
 * steht, steht der Grund. Nie 0 % für „nicht gemessen".
 */

export interface PipelineBoardProps {
  karten: FunnelKarte[]
  raten: KantenRate[]
  onOeffnen?: (karte: FunnelKarte) => void
  /** Welche Karte sich öffnen lässt. Ohne Angabe: alles mit Bestand. */
  oeffenbar?: (karte: FunnelKarte) => boolean
}

/* ── Der Bauplan des Baums ─────────────────────────────────────────────────
 *
 * Spalte 0 = stiller Ast, Spalte 1 = Hauptstamm, Spalte 2 = der Abzweig nach
 * der Antwort. Zeilen laufen von oben nach unten mit der Zeit.
 *
 * Bewusst als Tabelle und nicht gerechnet: Diese vierzehn Positionen sind
 * Kevins Ablauf, kein Layout-Problem. Wer eine Station einfügt, trägt sie hier
 * ein und sieht sofort, wo sie im Bild landet.
 */
const SPALTE_STILL = 0
const SPALTE_STAMM = 1
const SPALTE_ANTWORT = 2

interface Position {
  spalte: number
  zeile: number
}

/**
 * Kurzform für den Knoten.
 *
 * Die Kartentitel sind für eine Zeile über die volle Breite geschrieben
 * („Postkarte — kennt dich noch nicht"). In einem 168 px breiten Knoten
 * brechen sie ab, und „Postkarte — kennt dic…" sagt weniger als „Postkarte".
 * Welcher Ast gemeint ist, sagt hier ohnehin die Spalte, nicht der Text.
 */
const KURZTITEL: Partial<Record<FunnelKartenId, string>> = {
  erstnachricht_faellig: 'Erstnachricht',
  wartet_auf_antwort: 'Wartet auf Antwort',
  instagram_faellig: 'Instagram',
  pdf_faellig: 'Analyse-PDF',
  email_faellig: 'E-Mail',
  postkarte_laut: 'Postkarte',
  anruf_laut: 'Anruf',
  postkarte_still: 'Postkarte',
  anruf_still: 'Anruf',
}

/** Die Überschriften der beiden Äste — sonst steht die E-Mail grundlos links. */
const SPALTEN_TITEL: Record<number, string> = {
  0: 'nie angenommen',
  1: 'angenommen',
  2: 'hat geantwortet',
}

const KNOTEN: Partial<Record<FunnelKartenId, Position>> = {
  anfrage_offen: { spalte: SPALTE_STAMM, zeile: 0 },

  // Der stille Ast: nie angenommen.
  email_faellig: { spalte: SPALTE_STILL, zeile: 1 },
  postkarte_still: { spalte: SPALTE_STILL, zeile: 2 },
  anruf_still: { spalte: SPALTE_STILL, zeile: 3 },

  // Der Hauptstamm: angenommen, dann die LinkedIn-Kette.
  erstnachricht_faellig: { spalte: SPALTE_STAMM, zeile: 1 },
  wartet_auf_antwort: { spalte: SPALTE_STAMM, zeile: 2 },
  followup_0: { spalte: SPALTE_STAMM, zeile: 3 },
  followup_1: { spalte: SPALTE_STAMM, zeile: 4 },
  followup_2: { spalte: SPALTE_STAMM, zeile: 5 },
  instagram_faellig: { spalte: SPALTE_STAMM, zeile: 6 },
  pdf_faellig: { spalte: SPALTE_STAMM, zeile: 7 },
  postkarte_laut: { spalte: SPALTE_STAMM, zeile: 8 },
  anruf_laut: { spalte: SPALTE_STAMM, zeile: 9 },

  // Der Abzweig: wer antwortet, verlässt die Nachfass-Kette.
  antwort_da: { spalte: SPALTE_ANTWORT, zeile: 2 },
  loom_offen: { spalte: SPALTE_ANTWORT, zeile: 3 },
}

/**
 * Flache Knoten mit einzeiligem Inhalt.
 *
 * Zehn Zeilen mal 78 px wären 780 px gewesen — über der 700-px-Grenze aus der
 * Blaupause, ab der ihr Gegenzug greift (Endstufen zusammenfassen). Der
 * Gegenzug hätte die 1:1-Zuordnung Knoten↔Karte gebrochen und damit den Klick
 * in Zug 4 verkompliziert. Flachere Knoten lösen dasselbe Problem, ohne etwas
 * zusammenzuziehen: Titel und Bestand stehen nebeneinander statt untereinander.
 */
const KNOTEN_BREITE = 168
const KNOTEN_HOEHE = 46
/**
 * 90, nicht 34. Bei 34 lag die Beschriftung einer WAAGERECHTEN Kante („ungepaart"
 * ist rund 79 px breit) über beiden Nachbarknoten — am 25.08. im Browser
 * gesehen. Der Abstand muss die längste Kantenbeschriftung tragen, nicht nur
 * die Linie.
 */
const SPALTEN_ABSTAND = 90
const ZEILEN_ABSTAND = 16
const RAND = 6

/** Kopfhöhe für die Ast-Überschriften über der ersten Verzweigungszeile. */
const KOPF_HOEHE = 18

const spaltenX = (spalte: number) => RAND + spalte * (KNOTEN_BREITE + SPALTEN_ABSTAND)
const zeilenY = (zeile: number) => RAND + KOPF_HOEHE + zeile * (KNOTEN_HOEHE + ZEILEN_ABSTAND)

const ZEILEN = Math.max(...Object.values(KNOTEN).map((p) => p!.zeile)) + 1
const SPALTEN = Math.max(...Object.values(KNOTEN).map((p) => p!.spalte)) + 1
const BREITE = spaltenX(SPALTEN - 1) + KNOTEN_BREITE + RAND
const HOEHE = zeilenY(ZEILEN - 1) + KNOTEN_HOEHE + RAND

/** Was an einer Kante steht — die Zahl, oder warum es keine gibt. */
function kantenText(rate: KantenRate | null): { text: string; stark: boolean } | null {
  if (!rate) return null
  if (rate.rate !== null) {
    // Über 100 % ist bei der Zeitreihe eine echte Aussage (mehr Annahmen als
    // Anfragen — der Rückstau löst sich auf), kein Rechenfehler.
    return { text: `${Math.round(rate.rate * 100)} %`, stark: true }
  }
  switch (rate.grund) {
    case 'sammelt_noch':
      return { text: 'sammelt', stark: false }
    case 'paarung_fehlt':
      // Kein „0 %": Die Quellen paaren nicht, das ist etwas anderes als eine
      // schlechte Quote. Der Titel am Element sagt, was zu tun ist.
      return { text: 'ungepaart', stark: false }
    case 'zu_wenig_daten':
      return { text: 'zu dünn', stark: false }
    case 'nicht_erfasst':
      return null
    default:
      return null
  }
}

function kantenTitel(rate: KantenRate | null): string | undefined {
  if (!rate) return undefined
  if (rate.rate !== null) {
    const sorte = rate.art === 'zeitreihe' ? 'Zeitreihe, 30 Tage' : 'Kohorte, 30 Tage'
    return `${rate.angekommen} von ${rate.grundgesamtheit} — ${sorte}`
  }
  switch (rate.grund) {
    case 'sammelt_noch':
      return 'Wird seit dem 25.08. erfasst — noch zu wenig Historie für eine Quote.'
    case 'paarung_fehlt':
      return 'Beide Ereignisse gibt es, aber sie stehen fast nie am selben Lead. Der Chrome-Sync muss die Verläufe spiegeln.'
    case 'zu_wenig_daten':
      return `Nur ${rate.grundgesamtheit} in diesem Fenster — zu wenig für eine belastbare Quote.`
    case 'nicht_erfasst':
      return 'Für diesen Kanal werden keine Daten erfasst.'
    default:
      return undefined
  }
}

export function PipelineBoard({ karten, raten, onOeffnen, oeffenbar }: PipelineBoardProps) {
  const mobil = useIsMobile()

  const karteFuer = useMemo(() => {
    const m = new Map<FunnelKartenId, FunnelKarte>()
    for (const k of karten) m.set(k.id, k)
    return m
  }, [karten])

  const darfOeffnen = useMemo(() => oeffenbar ?? ((k: FunnelKarte) => k.bestand > 0), [oeffenbar])

  /**
   * Am Handy gibt es das Board nicht.
   *
   * Ein Baum mit zwei Ästen auf 390 px wird zur Briefmarke — Text unter 11 px
   * oder waagerechtes Scrollen der ganzen Seite. Die Kartenreihe darunter ist
   * dort kein Notbehelf, sondern die richtige Fassung: Sie ist zum Abarbeiten
   * gebaut, und abgearbeitet wird am Handy.
   */
  if (mobil) return null

  /** Karten, die nicht im Baum stehen — Endstationen ohne Weg nach vorn. */
  const ausserhalb = karten.filter((k) => !KNOTEN[k.id] && k.bestand > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <svg
        viewBox={`0 0 ${BREITE} ${HOEHE}`}
        width="100%"
        // Die Höhe folgt der Breite. Ohne feste Höhe skaliert der Baum mit der
        // Spalte, statt in einem Kasten fester Größe zu schrumpfen.
        /**
         * `margin: '0 auto'` seit dem 31.08.2026.
         *
         * Kevin: *„der canvas hängt gefühlt zu weit links."* Er hatte recht und
         * es war genau eine fehlende Zeile: Bei `maxWidth` klebt ein Block am
         * linken Rand, sobald die Spalte breiter ist als der Baum — und
         * zweispaltig ab 1180 px ist sie das fast immer. Der Freiraum stand
         * dann komplett rechts, statt sich zu teilen.
         */
        style={{ display: 'block', maxWidth: BREITE, height: 'auto', margin: '0 auto' }}
        role="img"
        aria-label="Pipeline als Baum: Anfrage, dann getrennt nach angenommen und nicht angenommen"
      >
        {/* Die Ast-Überschriften. Ohne sie steht die E-Mail grundlos links. */}
        {Object.entries(SPALTEN_TITEL).map(([spalte, titel]) => (
          <text
            key={spalte}
            x={spaltenX(Number(spalte)) + KNOTEN_BREITE / 2}
            y={RAND + 10}
            textAnchor="middle"
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fill: 'var(--ck-text-3)',
            }}
          >
            {titel}
          </text>
        ))}

        {/* Kanten zuerst, damit die Knoten darüber liegen. */}
        {FUNNEL_KANTEN.map((kante) => {
          const vonPos = KNOTEN[kante.von]
          const nachPos = KNOTEN[kante.nach]
          if (!vonPos || !nachPos) return null

          /**
           * Drei Fälle, und der dritte war am 25.08. im Browser als Fehler zu
           * sehen: Zwei Knoten auf DERSELBEN Zeile (Wartet auf Antwort →
           * Antwort da) bekamen eine Kante von der Unterkante des einen zur
           * Oberkante des anderen — sie lief rückwärts nach oben und die
           * Beschriftung landete auf dem Knoten. Gleiche Zeile heisst
           * waagerecht, von Flanke zu Flanke.
           */
          const gleicheZeile = vonPos.zeile === nachPos.zeile
          const gleicheSpalte = vonPos.spalte === nachPos.spalte

          const x1 = gleicheZeile
            ? spaltenX(vonPos.spalte) + KNOTEN_BREITE
            : spaltenX(vonPos.spalte) + KNOTEN_BREITE / 2
          const y1 = gleicheZeile ? zeilenY(vonPos.zeile) + KNOTEN_HOEHE / 2 : zeilenY(vonPos.zeile) + KNOTEN_HOEHE
          const x2 = gleicheZeile ? spaltenX(nachPos.spalte) : spaltenX(nachPos.spalte) + KNOTEN_BREITE / 2
          const y2 = gleicheZeile ? zeilenY(nachPos.zeile) + KNOTEN_HOEHE / 2 : zeilenY(nachPos.zeile)

          const pfad = gleicheZeile
            ? `M ${x1} ${y1} L ${x2} ${y2}`
            : gleicheSpalte
              ? `M ${x1} ${y1} L ${x2} ${y2}`
              : // Knick auf halber Höhe — eine Diagonale durch die Fläche wäre
                // schwerer zu lesen als zwei rechte Winkel.
                `M ${x1} ${y1} L ${x1} ${(y1 + y2) / 2} L ${x2} ${(y1 + y2) / 2} L ${x2} ${y2}`

          const rate = rateFuer(raten, kante.von, kante.nach)
          const beschriftung = kantenText(rate)
          const mx = (x1 + x2) / 2
          const my = (y1 + y2) / 2

          return (
            <g key={`${kante.von}>${kante.nach}`}>
              <path d={pfad} fill="none" stroke="var(--ck-border-strong)" strokeWidth={1} />
              {beschriftung ? (
                <>
                  {/* Deckendes Plättchen unter der Schrift: ohne das läuft die
                      Beschriftung über die Kantenlinie und wird unleserlich. */}
                  <rect
                    x={mx - (beschriftung.text.length * 3.6 + 7)}
                    y={my - 7.5}
                    width={beschriftung.text.length * 7.2 + 14}
                    height={15}
                    rx={7.5}
                    fill="var(--ck-panel)"
                  />
                  <text
                    x={mx}
                    y={my + 3.5}
                    textAnchor="middle"
                    style={{
                      fontSize: 10,
                      fontWeight: beschriftung.stark ? 600 : 400,
                      fill: beschriftung.stark ? 'var(--ck-accent)' : 'var(--ck-text-3)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {beschriftung.text}
                  </text>
                  <title>{kantenTitel(rate)}</title>
                </>
              ) : null}
            </g>
          )
        })}

        {/* Knoten */}
        {(Object.entries(KNOTEN) as [FunnelKartenId, Position][]).map(([id, pos]) => {
          const karte = karteFuer.get(id)
          if (!karte) return null
          const x = spaltenX(pos.spalte)
          const y = zeilenY(pos.zeile)
          const klickbar = Boolean(onOeffnen) && darfOeffnen(karte)
          const leer = karte.bestand === 0

          return (
            <g
              key={id}
              onClick={klickbar ? () => onOeffnen?.(karte) : undefined}
              style={{ cursor: klickbar ? 'pointer' : 'default' }}
              role={klickbar ? 'button' : undefined}
              tabIndex={klickbar ? 0 : undefined}
              onKeyDown={
                klickbar
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onOeffnen?.(karte)
                      }
                    }
                  : undefined
              }
              aria-label={klickbar ? `${karte.titel}: ${karte.bestand} — öffnen` : undefined}
            >
              <rect
                x={x}
                y={y}
                width={KNOTEN_BREITE}
                height={KNOTEN_HOEHE}
                rx={12}
                fill="var(--ck-card)"
                stroke={karte.heuteFaellig > 0 && klickbar ? 'var(--ck-accent)' : 'var(--ck-card-border)'}
                strokeWidth={1}
                // Leere Stufen bleiben sichtbar, aber treten zurück: „Instagram
                // fällig: 0" ist eine Information, nur keine, die rufen soll.
                opacity={leer ? 0.45 : 1}
              />
              <text
                x={x + 12}
                y={y + 19}
                style={{ fontSize: 11, fontWeight: 600, fill: 'var(--ck-text-1)' }}
              >
                {KURZTITEL[karte.id] ?? (karte.titel.length > 22 ? `${karte.titel.slice(0, 21)}…` : karte.titel)}
              </text>
              {karte.heuteFaellig > 0 && klickbar ? (
                <>
                  <rect x={x + 12} y={y + 26} width={54} height={13} rx={6.5} fill="var(--ck-accent)" />
                  <text
                    x={x + 39}
                    y={y + 35.5}
                    textAnchor="middle"
                    // Dunkel auf dem Akzent, nicht hell: der Salbei ist eine
                    // helle Farbe, `--ck-accent-text` darauf kam am 20.08. auf
                    // ~1,1:1. Dieselbe Lehre steht in Badge.tsx.
                    style={{ fontSize: 9, fontWeight: 600, fill: 'var(--ck-bg)', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {karte.heuteFaellig} dran
                  </text>
                </>
              ) : null}
              <text
                x={x + KNOTEN_BREITE - 12}
                y={y + 30}
                textAnchor="end"
                style={{
                  fontSize: 19,
                  fontWeight: 600,
                  fill: 'var(--ck-text-1)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {karte.bestand}
              </text>
              <title>{`${karte.titel}: ${karte.bestand} stecken hier`}</title>
            </g>
          )
        })}
      </svg>

      {/* Was keinen Platz im Baum hat, verschwindet nicht — es steht als Zeile
          darunter. Endstationen haben keinen Weg nach vorn, sind aber Bestand. */}
      {ausserhalb.length > 0 ? (
        <div className="ck-zahl" style={{ fontSize: 11.5, color: 'var(--ck-text-3)', paddingInline: 4 }}>
          Ausserhalb des Funnels: {ausserhalb.map((k) => `${k.titel} ${k.bestand}`).join(' · ')}
        </div>
      ) : null}
    </div>
  )
}
