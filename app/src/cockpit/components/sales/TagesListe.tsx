import { motion } from 'framer-motion'
import type { FlowZeileDef } from '../../pages/SalesDashboard'

/**
 * Die Tagesliste — „was ist jetzt zu tun" (28.08.2026, Blaupause
 * `docs/wargames/sales-canvas-v2.md`, Zug 2).
 *
 * **Warum es sie gibt.** Bis hierher trug jede Funnel-Karte zwei Antworten
 * übereinander: den Bestand („337 stecken in dieser Phase") und das Tagespensum
 * („heute 3 von 20"). Kevins Wort dazu am 28.08.: *„hier werden, glaub ich, die
 * zwei versucht zu vermischen und das ist mir zu viel."* Beide Fragen sind
 * berechtigt — sie gehören nur nicht in dieselbe Zeile. Der Bestand bleibt im
 * Canvas, das Pensum zieht hierher.
 *
 * **Es entsteht keine zweite Zähl-Wahrheit.** Diese Datei rechnet nichts. Sie
 * bekommt exakt die `flowZeilen`, aus denen bis zum 28.08. die eingeklappten
 * Balken am Seitenfuss gebaut wurden — dieselben Objekte, dieselben Zahlen,
 * dasselbe `inhalt()`-Fenster. Deshalb sind die Balken auch gefallen: Sie
 * hätten dasselbe ein zweites Mal gezeigt, und genau das ist die Vermischung,
 * die hier verschwinden soll.
 *
 * **Die Reihenfolge ist Kevins Ritual** (`TAGES_FLOW`, sein Diktat vom 18.08.):
 * Anfragen → Erstnachrichten → Antworten → Follow-ups → InMails → Looms. Diese
 * Komponente sortiert nicht, sie zeigt in der Reihenfolge, in der sie die
 * Zeilen bekommt.
 */

export interface TagesListeProps {
  /** Die sechs Zeilen des Rituals, in der Reihenfolge von `TAGES_FLOW`. */
  zeilen: FlowZeileDef[]
  /** Klick auf eine Zeile — öffnet dasselbe Fenster wie vorher der Balken. */
  onOeffnen: (id: string) => void
  /** Wie weit ist der Tag? Kommt aus `flowFortschritt`, wird nicht gezählt. */
  fortschritt: { erledigt: number; gesamt: number }
  /** Solange true, steht überall `…` statt einer Zahl. */
  laedt: boolean
}

/** Der grüne Haken einer stehenden Zeile — dieselbe Form wie in `FlowZeile`. */
function HakenZeichen() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={13}
      height={13}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4.5 12.5l5 5 10-11" />
    </svg>
  )
}

/** Das Serien-Flämmchen — currentColor, damit die Token-Disziplin hält. */
function SerienZeichen() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={12}
      height={12}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3c1 3-4 5-4 9a4 4 0 0 0 8 0c0-2-1-3.5-2-4.5 0 1.5-.7 2.3-1.5 2.8C12.8 8.6 13.5 5.5 12 3Z" />
    </svg>
  )
}

function ZeilenKnopf({ zeile, onOeffnen }: { zeile: FlowZeileDef; onOeffnen: () => void }) {
  const aktiv = zeile.zustand === 'aktiv'
  const erledigt = zeile.zustand === 'erledigt'
  return (
    <motion.button
      type="button"
      /**
       * Derselbe Namensraum wie früher die Balken (`kachel-…`) — das Fenster
       * morpht aus der Zeile. Das geht nur, weil die Balken gefallen sind:
       * Stünde dieselbe `layoutId` zweimal im Bild, entstünde ein Geister-Morph
       * zwischen zwei Elementen, die dasselbe zu sein behaupten.
       */
      layoutId={`kachel-${zeile.id}`}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      onClick={onOeffnen}
      className="ck-panel"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        width: '100%',
        // Der Daumen braucht 44 — am Rechner kostet es nichts.
        minHeight: 44,
        padding: '9px 11px',
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
        cursor: 'pointer',
        borderColor: aktiv ? 'var(--ck-accent)' : undefined,
      }}
    >
      {/* Position im Ritual — Haken, sobald die Stufe steht. */}
      {zeile.nummer !== undefined ? (
        <span
          aria-hidden
          style={{
            width: 22,
            height: 22,
            marginTop: 1,
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: 11,
            fontWeight: 600,
            color: erledigt || aktiv ? 'var(--ck-accent)' : 'var(--ck-text-3)',
            border: `1.5px solid ${erledigt || aktiv ? 'var(--ck-accent)' : 'var(--ck-border-strong)'}`,
          }}
        >
          {erledigt ? <HakenZeichen /> : zeile.nummer}
        </span>
      ) : null}

      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="ck-label" style={{ display: 'block' }}>
          {zeile.titel}
        </span>
        <span
          className="ck-zahl"
          style={{
            display: 'block',
            fontSize: 14,
            fontWeight: 600,
            marginTop: 2,
            lineHeight: 1.35,
            color: zeile.kennzahlFarbe ?? (erledigt ? 'var(--ck-accent)' : 'var(--ck-text-1)'),
          }}
        >
          {zeile.kennzahl}
        </span>
        {/**
         * Die Unterzeile steht NUR auf der aktiven Zeile. In 340 px Breite ist
         * sie sonst sechsmal derselbe graue Streifen — und die Spalte soll den
         * Einstieg zeigen, nicht die Erklärung zu fünf Stufen, die noch nicht
         * dran sind.
         */}
        {aktiv && zeile.unterzeile ? (
          <span
            style={{
              display: 'block',
              fontSize: 11.5,
              lineHeight: 1.45,
              color: 'var(--ck-text-2)',
              marginTop: 3,
            }}
          >
            {zeile.unterzeile}
          </span>
        ) : null}
      </span>

      {/* Die Serie: n Werktage in Folge, ein Frei-Tag je Woche eingerechnet. */}
      {zeile.streak && zeile.streak.laenge > 0 ? (
        <span
          className="ck-zahl"
          title={`${zeile.streak.laenge} Werktage in Folge${
            zeile.streak.heuteOffen ? ' — heute noch offen' : ''
          } · ein Frei-Tag je Woche eingerechnet`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            marginTop: 2,
            fontSize: 11.5,
            flexShrink: 0,
            color: zeile.streak.heuteOffen ? 'var(--ck-text-3)' : 'var(--ck-accent)',
          }}
        >
          <SerienZeichen />
          {zeile.streak.laenge}
        </span>
      ) : null}
    </motion.button>
  )
}

export function TagesListe({ zeilen, onOeffnen, fortschritt, laedt }: TagesListeProps) {
  return (
    <section aria-label="Heute" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 8,
          paddingInline: 4,
          marginBottom: 2,
        }}
      >
        <span className="ck-label">Heute</span>
        <span className="ck-zahl" style={{ fontSize: 12, color: 'var(--ck-text-3)' }}>
          {laedt ? '…' : `${fortschritt.erledigt} von ${fortschritt.gesamt} Stufen`}
        </span>
      </div>

      {zeilen.map((z) => (
        <ZeilenKnopf key={z.id} zeile={z} onOeffnen={() => onOeffnen(z.id)} />
      ))}
    </section>
  )
}
