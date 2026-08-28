import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useIsMobile } from '../../../hooks/useViewport'
import type { FunnelKarte } from '../../lib/funnelKarten'

/**
 * Das Sales-Canvas (25.08.2026, Blaupause `docs/wargames/sales-canvas.md`).
 *
 * Kevins Bild dafür liegt als `Vertriebsprozess.canvas` im Vault: der Funnel
 * von oben nach unten, je Knoten „wie viele stecken hier", daneben der Text.
 * Diese Datei ist die lebendige Fassung davon — sie **zeigt** nur, gerechnet
 * wird in `lib/funnelKarten.ts`.
 *
 * **Eine Karte, eine Zahl** (28.08.2026, `sales-canvas-v2.md` Zug 2). Bis dahin
 * trug jede Karte drei Angaben übereinander: den Bestand, das Tagespensum
 * („heute 3 von 20") und ein Badge „18 dran". Kevins Wort dazu: *„hier werden,
 * glaub ich, die zwei versucht zu vermischen und das ist mir zu viel."* Die
 * Karte beantwortet ab jetzt **nur noch den Bestand** — wie gross ist dieser
 * Topf, wen können wir auf diesem Weg überhaupt angehen. Was heute zu tun ist,
 * steht vollständig in der `TagesListe` daneben.
 *
 * **Ein Hinweis bleibt, und zwar genau einer:** Karten mit heute fälliger
 * Arbeit tragen den Akzent-Rahmen. Eine Farbe ist keine zweite Zahl — ohne sie
 * wäre der Funnel eine stumme Bestandsliste, und der Einstieg ins Bild ginge
 * verloren.
 *
 * **Leere Stufen verschwinden.** Zwölf Karten à 100 px sind 1.200 px
 * Scrollstrecke und damit nicht besser als die sechs Balken vorher. Was
 * keinen Bestand hat, klappt in eine Zeile am Ende zusammen.
 */

export interface FunnelCanvasProps {
  karten: FunnelKarte[]
  /** Klick auf eine Karte. Ohne Handler bleibt das Canvas eine reine Anzeige. */
  onOeffnen?: (karte: FunnelKarte) => void
  /**
   * Welche Karte sich öffnen lässt. Der Aufrufer weiß, hinter welcher eine
   * Namensliste liegt — das Canvas soll keine Spur-Kenntnis bekommen.
   * Ohne Angabe: alles mit Bestand.
   */
  oeffenbar?: (karte: FunnelKarte) => boolean
  /**
   * Die `layoutId` für den Morph Karte → Fenster. Vier Karten öffnen ein
   * Fenster, das es schon gibt (der Anfragen-Zähler etwa); dann muss die Karte
   * dessen Kennung tragen, sonst morpht das Fenster aus dem Nichts.
   */
  layoutIdFuer?: (karte: FunnelKarte) => string
}

function KartenZeile({
  karte,
  onOeffnen,
  leise,
  dicht,
  layoutId,
}: {
  karte: FunnelKarte
  onOeffnen?: () => void
  leise?: boolean
  dicht: boolean
  layoutId: string
}) {
  const inhalt = (
    <>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontSize: 14,
            fontWeight: 600,
            color: leise ? 'var(--ck-text-3)' : 'var(--ck-text-1)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {karte.titel}
        </span>
      </span>
      <span
        className="ck-zahl"
        title={`${karte.bestand} stecken in dieser Phase`}
        style={{
          fontSize: 17,
          fontWeight: 600,
          minWidth: 40,
          textAlign: 'right',
          flexShrink: 0,
          color: leise ? 'var(--ck-text-3)' : 'var(--ck-text-1)',
        }}
      >
        {karte.bestand}
      </span>
    </>
  )

  const flaeche = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    // Der Daumen braucht 44 — auch am Rechner kostet es nichts.
    minHeight: 44,
    padding: dicht ? '8px 12px' : '10px 14px',
    textAlign: 'left' as const,
    font: 'inherit',
    color: 'inherit',
  }

  if (!onOeffnen) {
    return (
      <div className="ck-panel" style={{ ...flaeche, opacity: leise ? 0.8 : 1 }}>
        {inhalt}
      </div>
    )
  }

  return (
    <motion.button
      type="button"
      // Derselbe Morph wie bei den alten Flow-Zeilen: die Karte wird zum
      // Fenster, statt dass ein Fenster darüber aufpoppt.
      layoutId={layoutId}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      onClick={onOeffnen}
      className="ck-panel"
      style={{
        ...flaeche,
        cursor: 'pointer',
        // Der einzige verbliebene Tageshinweis auf der Karte — siehe Kopf.
        borderColor: karte.heuteFaellig > 0 ? 'var(--ck-accent)' : undefined,
      }}
      title={karte.heuteFaellig > 0 ? `${karte.heuteFaellig} davon sind heute dran` : undefined}
    >
      {inhalt}
    </motion.button>
  )
}

export function FunnelCanvas({ karten, onOeffnen, oeffenbar, layoutIdFuer }: FunnelCanvasProps) {
  const mobil = useIsMobile()
  const [zeigeLeere, setZeigeLeere] = useState(false)

  const darfOeffnen = useMemo(
    () => oeffenbar ?? ((k: FunnelKarte) => k.bestand > 0),
    [oeffenbar],
  )
  const morphId = useMemo(
    () => layoutIdFuer ?? ((k: FunnelKarte) => `kachel-${k.id}`),
    [layoutIdFuer],
  )

  /**
   * Die Aussortierten stehen unten und für sich. Sie sind kein Schritt im
   * Funnel, sondern die Gegenprobe zum Filter — sichtbar, damit ein
   * Filterfehler auffällt, aber nie zwischen den Karten, an denen gearbeitet
   * wird (die Lehre vom 19.08.: „ich bin mir nicht sicher, ob die Leute, die
   * rein müssen, auch reingekommen sind").
   */
  const ausserhalb = karten.find((k) => k.id === 'ausserhalb') ?? null
  const funnel = karten.filter((k) => k.id !== 'ausserhalb')

  /**
   * Flach statt gruppiert (28.08.2026). Die Gruppierung nach `stufenId` gab es
   * nur, damit sich drei Follow-up-Karten EINE Pensum-Kopfzeile teilen konnten.
   * Das Pensum steht jetzt in der Tagesliste; die Kopfzeile hat damit nichts
   * mehr zu sagen, und die drei Karten stehen als drei Bestände nebeneinander
   * wie alle anderen auch. `funnelGruppen()` bleibt in `funnelKarten.ts`
   * erhalten und geprüft — die Oberfläche braucht sie nur nicht mehr.
   */
  const aktiv = funnel.filter((k) => k.bestand > 0 || k.heuteFaellig > 0)
  const leer = funnel.filter((k) => k.bestand === 0 && k.heuteFaellig === 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {aktiv.length === 0 ? (
        <div className="ck-panel" style={{ padding: '24px 14px', textAlign: 'center', fontSize: 13, color: 'var(--ck-text-3)' }}>
          Keine Leads in der Zielgruppe — oder die Daten laden noch.
        </div>
      ) : null}

      {aktiv.map((karte) => (
        <KartenZeile
          key={karte.id}
          karte={karte}
          dicht={mobil}
          layoutId={morphId(karte)}
          onOeffnen={onOeffnen && darfOeffnen(karte) ? () => onOeffnen(karte) : undefined}
        />
      ))}

      {/* Was keinen Bestand hat, kostet eine Zeile statt einer Karte. Nicht
          weggelassen: „Instagram fällig: 0" ist eine Information, nur keine,
          für die man 100 px Höhe ausgibt. */}
      {leer.length > 0 ? (
        <div style={{ marginTop: 2 }}>
          <button
            type="button"
            onClick={() => setZeigeLeere((v) => !v)}
            aria-expanded={zeigeLeere}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              minHeight: 36,
              padding: '6px 4px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: 12,
              color: 'var(--ck-text-3)',
              font: 'inherit',
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 12 }}>{zeigeLeere ? '▾' : '▸'}</span>
            <span style={{ fontSize: 12, color: 'var(--ck-text-3)' }}>
              {leer.length} {leer.length === 1 ? 'Stufe' : 'Stufen'} ohne Bestand
            </span>
          </button>
          {zeigeLeere ? (
            <div style={{ fontSize: 12, color: 'var(--ck-text-3)', padding: '0 4px 6px', lineHeight: 1.7 }}>
              {leer.map((k) => k.titel).join(' · ')}
            </div>
          ) : null}
        </div>
      ) : null}

      {ausserhalb && ausserhalb.bestand > 0 ? (
        <div style={{ marginTop: 2 }}>
          <KartenZeile
            karte={ausserhalb}
            dicht={mobil}
            leise
            layoutId={morphId(ausserhalb)}
            onOeffnen={onOeffnen && darfOeffnen(ausserhalb) ? () => onOeffnen(ausserhalb) : undefined}
          />
        </div>
      ) : null}
    </div>
  )
}
