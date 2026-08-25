import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useIsMobile } from '../../../hooks/useViewport'
import { funnelGruppen, type FunnelKarte } from '../../lib/funnelKarten'

/**
 * Das Sales-Canvas (25.08.2026, Blaupause `docs/wargames/sales-canvas.md`).
 *
 * Kevins Bild dafür liegt als `Vertriebsprozess.canvas` im Vault: der Funnel
 * von oben nach unten, je Knoten „wie viele stecken hier", daneben der Text.
 * Diese Datei ist die lebendige Fassung davon — sie **zeigt** nur, gerechnet
 * wird in `lib/funnelKarten.ts`.
 *
 * **Zwei Zahlen je Karte, und sie bedeuten Verschiedenes.** Rechts groß steht
 * der Bestand: wie viele Menschen stecken in dieser Phase. Klein darunter das
 * Tagespensum: wie viele davon heute. Der Bestand ist ein Vorrat und darf
 * dreistellig sein, ohne dass etwas falsch läuft; das Pensum ist die einzige
 * Zahl, die heute grün werden soll.
 *
 * **Die drei Follow-up-Karten teilen sich EIN Tagespensum.** Sie stehen
 * deshalb unter einer gemeinsamen Kopfzeile, die es genau einmal nennt. Stünde
 * „heute 5 von 13" auf jeder der drei Karten, läse Kevin 39 — und die Zahl,
 * die aus einer einzigen `daily_metrics`-Spalte kommt, sähe aus wie drei.
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

/** „n dran" — dunkler Text auf dem Akzent. */
function DranBadge({ anzahl, machbar }: { anzahl: number; machbar: boolean }) {
  /**
   * Grün nur, wo Kevin auch etwas tun kann.
   *
   * Am ersten Tag mit echten Daten stand „E-Mail fällig · 603 dran" als
   * lautester Punkt der Seite — und dahinter lag nichts: Für den stillen Zweig
   * sind noch keine E-Mail-Adressen beschafft (`Lead.email` ist leer, siehe
   * `types/db.ts`), also gibt es keine Arbeitsliste und keinen Handgriff. Ein
   * Akzent-Badge, das zu nichts führt, ist ein Alarm ohne Knopf; nach drei
   * Tagen glaubt man auch dem grünen Badge nicht mehr, hinter dem wirklich
   * Arbeit liegt. Die Zahl bleibt sichtbar, sie hört nur auf zu rufen.
   */
  return (
    <span
      className="ck-zahl"
      style={{
        fontSize: 12,
        fontWeight: 600,
        padding: '2px 9px',
        borderRadius: 'var(--ck-radius-pille)',
        background: machbar ? 'var(--ck-accent)' : 'transparent',
        /**
         * Dunkel auf dem Akzent, nicht hell. Der Salbei ist eine helle Farbe;
         * `--ck-accent-text` darauf kam am 20.08. im Browser auf ~1,1:1.
         * Dieselbe Lehre steht in `Badge.tsx` und in `LeadPipeline.tsx`.
         */
        color: machbar ? 'var(--ck-bg)' : 'var(--ck-text-3)',
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
      title={machbar ? undefined : 'Fällig, aber noch ohne Arbeitsliste — die Namen stehen in der Pipeline unter /linkedin'}
    >
      {anzahl} dran
    </span>
  )
}

/** Das Tagespensum als Halbsatz — oder nichts, wo es keins gibt. */
function pensumText(karte: FunnelKarte): string | null {
  if (karte.soll === null || karte.erledigtHeute === null) return null
  return `heute ${karte.erledigtHeute} von ${karte.soll}`
}

function KartenZeile({
  karte,
  pensum,
  onOeffnen,
  leise,
  dicht,
  layoutId,
}: {
  karte: FunnelKarte
  /** Der Halbsatz — null, wenn ihn die Gruppen-Kopfzeile schon trägt. */
  pensum: string | null
  onOeffnen?: () => void
  leise?: boolean
  dicht: boolean
  layoutId: string
}) {
  const steht = karte.soll !== null && karte.erledigtHeute !== null && karte.erledigtHeute >= karte.soll
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
        {pensum ? (
          <span
            style={{
              display: 'block',
              fontSize: 11.5,
              marginTop: 2,
              color: steht ? 'var(--ck-accent)' : 'var(--ck-text-3)',
            }}
            className="ck-zahl"
          >
            {pensum}
          </span>
        ) : null}
      </span>
      {karte.heuteFaellig > 0 ? <DranBadge anzahl={karte.heuteFaellig} machbar={Boolean(onOeffnen)} /> : null}
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
      style={{ ...flaeche, cursor: 'pointer', borderColor: karte.heuteFaellig > 0 ? 'var(--ck-accent)' : undefined }}
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

  const aktiv = funnel.filter((k) => k.bestand > 0 || k.heuteFaellig > 0)
  const leer = funnel.filter((k) => k.bestand === 0 && k.heuteFaellig === 0)
  const gruppen = useMemo(() => funnelGruppen(aktiv), [aktiv])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {aktiv.length === 0 ? (
        <div className="ck-panel" style={{ padding: '24px 14px', textAlign: 'center', fontSize: 13, color: 'var(--ck-text-3)' }}>
          Keine Leads in der Zielgruppe — oder die Daten laden noch.
        </div>
      ) : null}

      {gruppen.map((gruppe) => {
        // Eine gemeinsame Kopfzeile gibt es nur, wo sich mehrere Karten ein
        // Pensum teilen. Bei einer einzelnen Karte steht der Halbsatz in ihr.
        const geteilt = gruppe.karten.length > 1
        const pensum = geteilt ? pensumText(gruppe.karten[0]) : null
        return (
          <div key={gruppe.karten[0].id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {geteilt && pensum ? (
              <div
                className="ck-label ck-zahl"
                style={{ display: 'flex', gap: 8, alignItems: 'baseline', paddingInline: 4, marginTop: 4 }}
              >
                <span>{pensum}</span>
                <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
                  — ein Pensum, {gruppe.karten.length} Texte
                </span>
              </div>
            ) : null}
            {gruppe.karten.map((karte) => (
              <KartenZeile
                key={karte.id}
                karte={karte}
                pensum={geteilt ? null : pensumText(karte)}
                dicht={mobil}
                layoutId={morphId(karte)}
                onOeffnen={onOeffnen && darfOeffnen(karte) ? () => onOeffnen(karte) : undefined}
              />
            ))}
          </div>
        )
      })}

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
          <KartenZeile karte={ausserhalb} pensum={null} dicht={mobil} leise layoutId={morphId(ausserhalb)} />
        </div>
      ) : null}
    </div>
  )
}
