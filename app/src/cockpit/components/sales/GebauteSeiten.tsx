import { jophielShotUrl } from '../../lib/jophielApi'
import { runnerDirekt } from '../../lib/runnerBridge'
import type { VerknuepftesProjekt } from '../../lib/jophielProjekte'

/**
 * Die gebauten Seiten — Kevins Ergebnisse, nicht seine Aufgaben
 * (25.08.2026, Blaupause `docs/wargames/sales-canvas.md`, Zug 7).
 *
 * **Warum das keine Funnel-Karten sind.** Eine Karte im Funnel zählt Menschen:
 * jeder Lead steht auf genau einer, und daran hängt jede Zahl der Seite. Ein
 * Jophiel-Projekt ist aber kein Mensch, sondern ein Artefakt — die Website zu
 * einem Lead, der oben ohnehin schon unter „Loom offen" steht. Als Funnel-Karte
 * würde er doppelt gezählt. Deshalb ein eigener Streifen darunter.
 *
 * **Kevins Unterscheidung vom 25.08.:** Ein zugesagtes Loom ohne gebaute Seite
 * ist schlicht — es gibt noch nichts zu zeigen, und ein leerer Bildrahmen wäre
 * eine Behauptung. Eine gebaute Seite bekommt das Bild.
 *
 * **Und zwar überall** (28.08.2026, `sales-canvas-v2.md` Zug 7). Bis dahin
 * stand hier ausserhalb von localhost „Vorschaubild nur am Rechner" — ein
 * Satz, der vom Gerät sprach, wo die Adresse gemeint war: Auf frameworkos.de
 * verbietet der Browser den Zugriff auf den lokalen Runner-Port. Kevin sass
 * die ganze Zeit an seinem Rechner und las trotzdem, das ginge nur dort.
 * Jetzt spiegelt der Runner die verkleinerte Aufnahme (50–150 kB) in den
 * Storage, und der Ersatztext sagt, was wirklich fehlt.
 */

export interface GebauteSeitenProps {
  projekte: VerknuepftesProjekt[]
  /** Läuft Jophiel? Sonst steht hier eine stille Zeile statt eines Fehlers. */
  erreichbar: boolean
}

/** Der Browser-Rahmen: drei Punkte und die alte Adresse, mehr braucht es nicht. */
function Rahmenleiste({ url }: { url: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 10px',
        borderBottom: '1px solid var(--ck-border)',
        background: 'var(--ck-panel-2)',
      }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden
          style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ck-border-strong)', flexShrink: 0 }}
        />
      ))}
      <span
        style={{
          fontSize: 10.5,
          color: 'var(--ck-text-3)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginLeft: 4,
        }}
      >
        {url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
      </span>
    </div>
  )
}

export function GebauteSeiten({ projekte, erreichbar }: GebauteSeitenProps) {
  if (!erreichbar) {
    /**
     * Zwei Gründe, ein Aussehen — aber nicht derselbe Satz.
     *
     * Am Rechner heisst „nicht erreichbar" wirklich: Jophiel läuft nicht.
     * Unterwegs heisst es nur, dass noch kein Spiegel in Supabase liegt —
     * Jophiel kann dabei bestens laufen. „Jophiel läuft nicht" auf dem Handy
     * wäre eine Behauptung über Kevins Rechner, die von hier aus niemand
     * prüfen kann.
     */
    return (
      <span style={{ fontSize: 12, color: 'var(--ck-text-3)' }}>
        {runnerDirekt()
          ? 'Jophiel läuft nicht — gebaute Seiten sind gerade nicht abrufbar.'
          : 'Noch nichts gespiegelt — Jophiel einmal bei laufendem Runner öffnen.'}
      </span>
    )
  }
  if (projekte.length === 0) {
    return <span style={{ fontSize: 12, color: 'var(--ck-text-3)' }}>Noch keine gebaute Seite.</span>
  }

  return (
    <div
      style={{
        display: 'grid',
        // Eine Spalte am Handy, sonst so viele wie passen — ohne eigenen
        // Breakpoint, damit die eine Mobil-Grenze die eine bleibt.
        gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
        gap: 10,
      }}
    >
      {projekte.map(({ projekt, leadName }) => {
        const bild = jophielShotUrl(projekt)
        return (
          <a
            key={projekt.slug}
            href={projekt.vorschauUrl}
            target="_blank"
            rel="noreferrer"
            className="ck-panel"
            title={`Vorschau von ${projekt.name} öffnen`}
            style={{
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              textDecoration: 'none',
              color: 'inherit',
              padding: 0,
            }}
          >
            <Rahmenleiste url={projekt.oldUrl || projekt.name} />
            {bild ? (
              <img
                src={bild}
                alt=""
                // Der Runner liefert ein verkleinertes Bild (~50-75 kB statt
                // 1-4 MB). `lazy` obendrauf, weil bei zwölf Projekten auch
                // 75 kB je Karte noch eine Menge sind, die niemand sieht.
                loading="lazy"
                width={640}
                height={400}
                style={{ width: '100%', height: 'auto', display: 'block', aspectRatio: '16 / 10', objectFit: 'cover', objectPosition: 'top' }}
              />
            ) : (
              <div
                style={{
                  aspectRatio: '16 / 10',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11.5,
                  color: 'var(--ck-text-3)',
                  padding: 10,
                  textAlign: 'center',
                }}
              >
                {runnerDirekt()
                  ? 'Runner liefert kein Bild — läuft er?'
                  : 'Noch nicht gespiegelt — einmal bei laufendem Runner und Jophiel warten.'}
              </div>
            )}
            <div style={{ padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--ck-text-1)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {projekt.name}
              </span>
              {/* Kein Treffer heisst „ohne Lead", nicht „weglassen": Die Seite
                  ist gebaut, egal ob der Name in beiden Quellen gleich
                  geschrieben steht. */}
              <span
                style={{
                  fontSize: 11.5,
                  color: leadName ? 'var(--ck-text-2)' : 'var(--ck-text-3)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {leadName ?? (projekt.leadName ? `${projekt.leadName} — kein Lead gefunden` : 'ohne Lead')}
              </span>
            </div>
          </a>
        )
      })}
    </div>
  )
}
