import { useState } from 'react'
import { Ladeschirm } from '../cockpit/components/Ladeschirm'
import type { Etappe, RundeStand } from '../cockpit/lib/rundeApi'

/**
 * Dev-Vorschau (nur DEV, ohne Login): der Ladeschirm der Runde in allen
 * Zuständen, die im Alltag vorkommen.
 *
 * Ohne diese Seite wäre der Schirm nur mit Session UND einem echten,
 * zwanzigminütigen Lauf zu sehen — und die interessanten Zustände (Fehler in
 * einer Etappe, fehlendes Chrome) ließen sich gar nicht herstellen, ohne etwas
 * kaputtzumachen. Gleiches Muster wie `SalesVorschau`.
 */

const ETAPPEN_ROH: Array<Pick<Etappe, 'schluessel' | 'titel' | 'wieLange' | 'gewicht'>> = [
  { schluessel: 'postfach', titel: 'Postfach', wieLange: 'knapp eine Minute', gewicht: 12 },
  { schluessel: 'verlauf', titel: 'Gesprächsverläufe', wieLange: 'zwei bis drei Minuten', gewicht: 13 },
  { schluessel: 'einladungen', titel: 'Offene Einladungen', wieLange: 'bis zu sieben Minuten', gewicht: 25 },
  { schluessel: 'kontakte', titel: 'Angenommene Kontakte', wieLange: 'drei bis fünf Minuten', gewicht: 18 },
  { schluessel: 'leads', titel: 'Leads verbuchen', wieLange: 'unter einer Minute', gewicht: 5 },
  { schluessel: 'waechter', titel: 'Widersprüche prüfen', wieLange: 'Sekunden', gewicht: 2 },
  { schluessel: 'sortierer', titel: 'Neue Kontakte vorsortieren', wieLange: 'zwei bis vier Minuten', gewicht: 11 },
  { schluessel: 'entwuerfe', titel: 'Antwort-Entwürfe schreiben', wieLange: 'drei bis fünf Minuten', gewicht: 14 },
]

function baue(werte: Record<string, Partial<Etappe>>): Etappe[] {
  return ETAPPEN_ROH.map((e) => ({
    ...e,
    status: 'wartet',
    text: '',
    anteil: null,
    von: null,
    bis: null,
    ...(werte[e.schluessel] ?? {}),
  })) as Etappe[]
}

const FRAGE: RundeStand = {
  runde: null,
  prozent: 0,
  kopf: 'Noch nicht geladen',
  rest: '',
  laeuft: false,
  letzterStand: new Date(Date.now() - 14 * 3600_000).toISOString(),
  letzterStandText: 'gestern 19:40',
  fragen: true,
  chrome: true,
}

const FRAGE_OHNE_CHROME: RundeStand = { ...FRAGE, chrome: false }

const LAEUFT: RundeStand = {
  runde: {
    id: 'x',
    gestartet: new Date().toISOString(),
    beendet: null,
    ausloeser: 'kevin',
    status: 'laeuft',
    aktuell: 'einladungen',
    etappen: baue({
      postfach: { status: 'fertig', text: '80 Gespräche · 3 neu', anteil: 1 },
      verlauf: { status: 'fertig', text: '60 Verläufe aktualisiert', anteil: 1 },
      einladungen: { status: 'laeuft', text: '340 von 1.049', anteil: 340 / 1049 },
    }),
  },
  prozent: 33,
  kopf: 'Offene Einladungen',
  rest: 'noch etwa 16 Minuten',
  laeuft: true,
  letzterStand: null,
  letzterStandText: 'gestern 19:40',
  fragen: false,
  chrome: true,
}

const FERTIG_MIT_LUECKE: RundeStand = {
  runde: {
    id: 'x',
    gestartet: new Date().toISOString(),
    beendet: new Date().toISOString(),
    ausloeser: 'kevin',
    status: 'fertig',
    aktuell: null,
    etappen: baue({
      postfach: { status: 'fertig', text: '80 Gespräche · 3 neu' },
      verlauf: { status: 'fertig', text: '60 Verläufe aktualisiert' },
      einladungen: { status: 'fehler', text: 'Liste brach nach 114 von 1.049 ab' },
      kontakte: { status: 'fertig', text: '704 von 704' },
      leads: { status: 'fertig', text: 'leads-sync: fertig.' },
      waechter: { status: 'fertig', text: '4 Widerspruchsfälle (3 dringend)' },
      sortierer: { status: 'fertig', text: '37 beurteilt' },
      entwuerfe: { status: 'fertig', text: '11 Entwürfe' },
    }),
  },
  prozent: 100,
  kopf: 'Fertig — 1 Etappe mit Lücke',
  rest: '',
  laeuft: false,
  letzterStand: new Date().toISOString(),
  letzterStandText: 'heute 09:22',
  fragen: false,
  chrome: true,
}

const OHNE_CHROME: RundeStand = {
  runde: {
    id: 'x',
    gestartet: new Date().toISOString(),
    beendet: new Date().toISOString(),
    ausloeser: 'kevin',
    status: 'fertig',
    aktuell: null,
    etappen: baue({
      postfach: { status: 'uebersprungen', text: 'Sync-Chrome läuft nicht' },
      verlauf: { status: 'uebersprungen', text: 'Sync-Chrome läuft nicht' },
      einladungen: { status: 'uebersprungen', text: 'Sync-Chrome läuft nicht' },
      kontakte: { status: 'uebersprungen', text: 'Sync-Chrome läuft nicht' },
      leads: { status: 'fertig', text: 'leads-sync: fertig.' },
      waechter: { status: 'fertig', text: 'keine Widersprüche' },
      sortierer: { status: 'fertig', text: 'nichts zu sortieren' },
      entwuerfe: { status: 'fertig', text: 'niemand wartet auf eine Antwort' },
    }),
  },
  prozent: 100,
  kopf: 'Alles auf dem neuesten Stand',
  rest: '',
  laeuft: false,
  letzterStand: new Date().toISOString(),
  letzterStandText: 'heute 09:22',
  fragen: false,
  chrome: false,
}

const ZUSTAENDE: Array<{ name: string; stand: RundeStand }> = [
  { name: 'Frage beim Öffnen', stand: FRAGE },
  { name: 'Frage, ohne Sync-Chrome', stand: FRAGE_OHNE_CHROME },
  { name: 'Läuft (Einladungen)', stand: LAEUFT },
  { name: 'Fertig, mit Lücke', stand: FERTIG_MIT_LUECKE },
  { name: 'Gelaufen ohne Chrome', stand: OHNE_CHROME },
]

export function RundeVorschau() {
  /**
   * Der Zustand lässt sich per `?z=2` vorwählen — sonst kommt ein
   * Screenshot-Werkzeug ohne Klick immer nur an das erste Bild.
   */
  const vorwahl = Number(new URLSearchParams(window.location.search).get('z') ?? 0)
  const [i, setI] = useState(Number.isFinite(vorwahl) && vorwahl >= 0 && vorwahl < ZUSTAENDE.length ? vorwahl : 0)

  return (
    <div
      className="ck-root"
      style={{ minHeight: '100vh', background: 'var(--ck-bg)', padding: 24, pointerEvents: 'auto' }}
    >
      <div className="ck-label" style={{ marginBottom: 14 }}>
        Dev-Vorschau · Ladeschirm der Runde
      </div>
      {/* Über dem Schirm (z-index 60), sonst liegt die Umschaltleiste darunter
          und die Vorschau lässt sich nicht umschalten. */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          position: 'fixed',
          left: 16,
          right: 16,
          bottom: 16,
          zIndex: 70,
          justifyContent: 'center',
        }}
      >
        {ZUSTAENDE.map((z, k) => (
          <button
            key={z.name}
            type="button"
            className="ck-btn"
            style={{ minHeight: 40, ...(k === i ? { borderColor: 'var(--ck-accent)', color: 'var(--ck-accent-text)' } : {}) }}
            onClick={() => setI(k)}
          >
            {z.name}
          </button>
        ))}
      </div>
      <Ladeschirm
        stand={ZUSTAENDE[i].stand}
        onStarten={() => setI(2)}
        onAbbrechen={() => setI(0)}
        onWeglegen={() => setI(0)}
        onSpaeter={() => setI(0)}
      />
    </div>
  )
}
