import { useState } from 'react'
import { AnimatePresence, MotionConfig } from 'framer-motion'
import { AnfragenZaehler } from '../cockpit/components/AnfragenZaehler'
import { Arbeitsliste, type LoomSkriptAktionen } from '../cockpit/components/Arbeitsliste'
import { HeuteDeck } from '../cockpit/components/HeuteDeck'
import { InmailPanel } from '../cockpit/components/InmailPanel'
import { FlowZeile, KachelFenster, type FlowZeileDef } from '../cockpit/pages/SalesDashboard'
import type { Posten } from '../cockpit/lib/prioritaet'
import { medianeJeSpur, tagesansage } from '../cockpit/lib/tagesansage'

/**
 * Dev-Vorschau (nur import.meta.env.DEV, ohne Login): rendert die neuen
 * Sales-Bausteine mit Fixture-Daten, damit UI-Änderungen ohne Supabase-Session
 * visuell geprüft werden können. Kein Produktions-Code-Pfad.
 */

const LOOM_POSTEN: Posten[] = [
  { id: 'loom:1', spur: 'loom', name: 'Andreas Blasch', firma: 'Hamburg, meine Perle — Ihr Zuhause finden wir.', website: 'https://www.linkedin.com/in/andreas-blasch', text: 'Loom-Analyse für Andreas Blasch aufnehmen und verschicken.', timestamp: null, starred: true },
  { id: 'loom:2', spur: 'loom', name: 'Sabine Krüger', firma: 'Krüger Immobilien GmbH', website: 'https://krueger-immobilien.de', text: 'Loom-Analyse für Sabine Krüger aufnehmen und verschicken.', timestamp: null, starred: true },
  { id: 'loom:3', spur: 'loom', name: 'Michael Petersen', firma: 'Petersen & Partner', website: 'https://www.linkedin.com/in/mpetersen', text: 'Loom-Analyse für Michael Petersen aufnehmen und verschicken.', timestamp: null, starred: true },
]

const ERSTNACHRICHT_POSTEN: Posten[] = [
  { id: 'erstnachricht:1', spur: 'erstnachricht', name: 'Julia Wagner', firma: 'Wagner Immobilien', website: 'wagner-immobilien.de', text: 'Hi Julia, ich bin über euer Büro in Eppendorf gestolpert — starke Lage. Mir ist aufgefallen, dass eure Website Eigentümer kaum anspricht, obwohl ihr genau da stark seid. Ich hab dazu eine kurze Analyse gemacht — magst du sie sehen?', timestamp: null },
  { id: 'erstnachricht:2', spur: 'erstnachricht', name: 'Thomas Brandt', firma: 'Brandt & Söhne', website: 'brandt-soehne.de', text: 'Moin Thomas, euer Portfolio in Blankenese ist beeindruckend. Eine Sache fiel mir auf: Auf dem Handy bricht eure Startseite — genau da, wo Eigentümer zuerst schauen. Kurze Loom-Analyse dazu?', timestamp: null },
]

/** Etappe 3: Antwort-Posten mit dem Entwurf des Nacht-Agenten am Namen. */
const ANTWORT_POSTEN: Posten[] = [
  {
    id: 'thread:1',
    spur: 'antwort',
    name: 'Andreas Blasch',
    firma: 'Makler HH',
    website: 'https://www.linkedin.com/in/andreas-blasch',
    text: 'Moin, wir haben auch eigene Webseiten. Ich sehe den Vorteil eher bei der KW-Seite.',
    timestamp: '2026-08-01T09:12:00.000Z',
    starred: true,
    entwurf: {
      text: 'Moin Andreas,\n\nsorry, deine Nachricht ist bei mir untergegangen.\n\nKlar, eigene Webseiten habt ihr – mir geht’s auch weniger um die Seite an sich als um die Eigentümer-Ansprache. Genau da lassen die meisten Makler Mandate liegen.\n\nIch schau mir euren Auftritt an und pack dir das Wichtigste in eine kurze Analyse als Video. Schick ich dir bis Ende der Woche rüber.',
      veraltet: false,
      erstelltAm: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
    },
  },
  {
    id: 'thread:2',
    spur: 'antwort',
    name: 'Cornelia Zaunrith',
    firma: 'Zaunrith Immobilien',
    website: 'https://www.linkedin.com/in/czaunrith',
    text: 'Ach, und noch was: wir suchen aktuell auch jemanden für Social.',
    timestamp: '2026-08-03T07:40:00.000Z',
    entwurf: {
      text: 'Moin Cornelia,\n\ndanke für die Rückmeldung. Lass uns kurz telefonieren – dann kann ich dir sagen, ob ich der Richtige bin.',
      veraltet: true,
      erstelltAm: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
    },
  },
]

const KUNDEN_POSTEN: Posten[] = [
  { id: 'task:1', spur: 'kundenaufgabe', name: 'Startseite: Hero-Video Safari-Fix', firma: 'Reichentrog & Kollegen', website: undefined, text: 'Video lädt in Safari nicht — muted playsinline poster prüfen.', timestamp: null },
  { id: 'task:2', spur: 'kundenaufgabe', name: 'Leistungsseiten finalisieren', firma: 'CoLective', website: undefined, text: 'Texte aus dem Leitbild übernehmen, i18n-Keys nachziehen.', timestamp: null },
]

const ALLE_POSTEN: Posten[] = [...KUNDEN_POSTEN, ...ANTWORT_POSTEN, ...LOOM_POSTEN, ...ERSTNACHRICHT_POSTEN]

/** Fixture-Messwerte in der Form, in der sie aus `arbeits_dauern` kommen. */
const DAUERN = medianeJeSpur([
  { spur: 'kundenaufgabe', sekunden: 1500 },
  { spur: 'kundenaufgabe', sekunden: 2100 },
  { spur: 'antwort', sekunden: 240 },
  { spur: 'antwort', sekunden: 320 },
  { spur: 'loom', sekunden: 900 },
  { spur: 'erstnachricht', sekunden: 180 },
  { spur: 'erstnachricht', sekunden: 220 },
])

export function SalesVorschau() {
  const [offen, setOffen] = useState<string | null>(null)
  const [anfragen, setAnfragen] = useState(12)
  const [vollbild, setVollbild] = useState(false)

  const loomAktionen: LoomSkriptAktionen = {
    // Fixture: für Andreas Blasch existiert bereits ein Skript
    skriptUrl: (p) => (p.id === 'loom:1' ? '#skript-andreas-blasch' : null),
    skriptVorhanden: (p) => p.id === 'loom:1',
    generiere: () => {},
    laeuft: false,
    angefordert: () => false,
    verfuegbar: true,
    fehler: null,
  }

  /**
   * Die Zeilen des Boards in Kevins Reihenfolge (18.08.2026) — mit
   * Fixture-Zuständen, die genau die Fälle zeigen, um die es ihm ging:
   * Stufe 1 steht (grün, Haken, Serie), Stufe 2 ist dran (betont), die
   * Antworten sind frisch trotz vieler Wartender, die Follow-ups laufen als
   * gedrosselte Portion mit sichtbarem Rückstand, und die Projekte stehen
   * leise unten.
   */
  const zeilen: FlowZeileDef[] = [
    {
      id: 'vernetzungsanfragen',
      nummer: 1,
      titel: 'Vernetzungsanfragen',
      zustand: anfragen >= 30 ? 'erledigt' : 'aktiv',
      kennzahl: `${anfragen} von 30`,
      unterzeile: 'Zähler — das Ritual läuft direkt auf LinkedIn.',
      streak: { laenge: 6, heuteOffen: anfragen < 30 },
      inhalt: () => (
        <AnfragenZaehler
          heute={anfragen}
          limit={30}
          onPlus={() => setAnfragen((n) => n + 1)}
          onMinus={() => setAnfragen((n) => Math.max(0, n - 1))}
        />
      ),
    },
    {
      id: 'erstnachrichten',
      nummer: 2,
      titel: 'Erstnachrichten · LinkedIn',
      zustand: anfragen >= 30 ? 'aktiv' : 'offen',
      kennzahl: `0 von ${ERSTNACHRICHT_POSTEN.length}`,
      unterzeile: `zuerst: ${ERSTNACHRICHT_POSTEN[0].firma} — ${ERSTNACHRICHT_POSTEN[0].name}`,
      streak: { laenge: 4, heuteOffen: true },
      inhalt: () => <Arbeitsliste posten={ERSTNACHRICHT_POSTEN} onErledigt={() => {}} />,
    },
    {
      id: 'antworten',
      nummer: 3,
      titel: 'Antworten · LinkedIn',
      // Frisch trotz Menge: 43 dürfen warten, solange keiner von vorgestern ist.
      zustand: 'erledigt',
      kennzahl: `${ANTWORT_POSTEN.length} warten · älteste 3 h`,
      unterzeile: 'Reaktionszeit zählt — nicht die Menge.',
      inhalt: () => <Arbeitsliste posten={ANTWORT_POSTEN} onErledigt={() => {}} />,
    },
    {
      id: 'followups',
      nummer: 4,
      titel: 'Follow-ups · LinkedIn',
      zustand: 'offen',
      kennzahl: '0 von 20',
      unterzeile: 'Portion für heute — 199 weitere warten im Rückstand.',
      streak: { laenge: 2, heuteOffen: true },
      inhalt: () => <Arbeitsliste posten={ANTWORT_POSTEN} onErledigt={() => {}} />,
    },
    {
      id: 'inmails',
      nummer: 5,
      titel: 'Reaktivierung · InMails',
      zustand: 'offen',
      kennzahl: '0 von 5 · Pool ≈ 143',
      unterzeile: 'Nie angenommene Anfragen — die InMail-Welle.',
      inhalt: () => (
        <InmailPanel
          stand={{ wert: 150, standVom: '2026-08-12' }}
          abgeleitet={{ pool: 143, seitherGebucht: 7, reichtTage: 28 }}
          tagesration={5}
          heuteGebucht={0}
          onBuchen={() => {}}
          onSpeichern={() => {}}
        />
      ),
    },
    {
      id: 'looms',
      nummer: 6,
      titel: 'Looms',
      zustand: 'offen',
      kennzahl: '0 von 2',
      unterzeile: `${LOOM_POSTEN.length} zugesagt und offen — Stern = Ja zur Analyse.`,
      inhalt: () => <Arbeitsliste posten={LOOM_POSTEN} onErledigt={() => {}} loom={loomAktionen} />,
    },
  ]

  const projekte: FlowZeileDef[] = [
    {
      id: 'kundenarbeit',
      titel: 'Projekte',
      zustand: 'ruhig',
      kennzahl: `${KUNDEN_POSTEN.length} Aufgaben offen`,
      unterzeile: `zuerst: ${KUNDEN_POSTEN[0].firma} — ${KUNDEN_POSTEN[0].name}`,
      inhalt: () => (
        <Arbeitsliste
          posten={KUNDEN_POSTEN}
          onErledigt={() => {}}
          projektLink={() => '/projekte'}
          onNavigiere={() => {}}
        />
      ),
    },
    {
      id: 'liegt-zu-lange',
      titel: 'Liegt still',
      zustand: 'ruhig',
      kennzahl: '2 Projekte ohne Bewegung',
      unterzeile: 'Ansehen — nachfassen oder bewusst warten.',
      inhalt: () => <Arbeitsliste posten={KUNDEN_POSTEN} onErledigt={() => {}} />,
    },
  ]

  const alleZeilen = [...zeilen, ...projekte]
  const offenKachel = alleZeilen.find((k) => k.id === offen) ?? null

  return (
    <MotionConfig reducedMotion="user">
      <div className="ck-root" style={{ minHeight: '100vh', background: 'var(--ck-bg)', padding: 24, pointerEvents: 'auto' }}>
        <div className="ck-label" style={{ marginBottom: 14 }}>
          Dev-Vorschau · Sales-Bausteine (Fixtures) ·{' '}
          <button type="button" className="ck-btn" style={{ minHeight: 32 }} onClick={() => setVollbild(true)}>
            Anfragen-Vollbild testen
          </button>
        </div>
        {/* Heute-Deck v2 ohne Session: zeigt den Leerzustand, beweist aber, dass
            das Deck mit der Posten-Engine montiert statt zu werfen. */}
        <div style={{ marginBottom: 14 }}>
          <HeuteDeck slug={undefined} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 760 }}>
          <div className="ck-label" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <span>{tagesansage(ALLE_POSTEN, DAUERN)}</span>
            <span>Postfach-Stand: vor 2 h</span>
          </div>
          {zeilen.map((z) => (
            <FlowZeile key={z.id} zeile={z} onOeffnen={() => setOffen(z.id)} />
          ))}
          <div className="ck-label" style={{ marginTop: 10 }}>
            Neben dem Ritual
          </div>
          {projekte.map((z) => (
            <FlowZeile key={z.id} zeile={z} onOeffnen={() => setOffen(z.id)} />
          ))}
        </div>
        <AnimatePresence>
          {offenKachel ? <KachelFenster kachel={offenKachel} onClose={() => setOffen(null)} /> : null}
        </AnimatePresence>
        {vollbild ? (
          <AnfragenZaehler
            vollbild
            heute={anfragen}
            limit={30}
            onPlus={() => setAnfragen((n) => n + 1)}
            onMinus={() => setAnfragen((n) => Math.max(0, n - 1))}
            onClose={() => setVollbild(false)}
          />
        ) : null}
      </div>
    </MotionConfig>
  )
}
