import { useState } from 'react'
import { AnimatePresence, MotionConfig } from 'framer-motion'
import { AnfragenZaehler } from '../cockpit/components/AnfragenZaehler'
import { Arbeitsliste, type LoomSkriptAktionen } from '../cockpit/components/Arbeitsliste'
import { HeuteDeck } from '../cockpit/components/HeuteDeck'
import { InmailPanel } from '../cockpit/components/InmailPanel'
import { FlowZeile, KachelFenster, type FlowZeileDef } from '../cockpit/pages/SalesDashboard'
import { FunnelCanvas } from '../cockpit/components/sales/FunnelCanvas'
import { TagesListe } from '../cockpit/components/sales/TagesListe'
import { KartenNamen } from '../cockpit/components/sales/KartenNamen'
import type { FunnelKarte } from '../cockpit/lib/funnelKarten'
import type { KartenLead } from '../cockpit/lib/funnelKarten'
import type { Posten } from '../cockpit/lib/prioritaet'
import { medianeJeSpur, tagesansage } from '../cockpit/lib/tagesansage'

/**
 * Dev-Vorschau (nur import.meta.env.DEV, ohne Login): rendert die neuen
 * Sales-Bausteine mit Fixture-Daten, damit UI-Änderungen ohne Supabase-Session
 * visuell geprüft werden können. Kein Produktions-Code-Pfad.
 *
 * **Am 28.08.2026 um das Canvas v2 erweitert** — und der Anlass ist der beste
 * Beleg dafür, warum es diese Seite gibt: An dem Tag hing der Auth-Dienst von
 * Supabase (Statusseite: „Partially Degraded Service"), niemand kam ins
 * Cockpit, und die fertige Arbeit wäre ohne diese Route unprüfbar gewesen. Wer
 * hier etwas ergänzt, hält die Seite für genau diesen Fall am Leben: Optik und
 * Bedienung prüfbar, auch wenn die Datenbank nicht antwortet.
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

/**
 * Die Funnel-Karten, wie `funnelZuordnung()` sie liefert — mit genau den
 * Faellen, um die es Kevin am 28.08. ging: eine dreistellige Zahl („Anfrage
 * laeuft · 337"), Stationen mit Tagesarbeit (Akzent-Rahmen), Stationen ohne,
 * und die Gegenprobe „Nicht in der Zielgruppe" ganz unten.
 */
const FUNNEL_KARTEN: FunnelKarte[] = [
  { id: 'anfrage_offen', titel: 'Anfrage läuft', bestand: 337, heuteFaellig: 0, soll: null, erledigtHeute: null, stufenId: 'anfragen', vorlage: null, zweig: null },
  { id: 'erstnachricht_faellig', titel: 'Erstnachricht fällig', bestand: 12, heuteFaellig: 12, soll: null, erledigtHeute: null, stufenId: 'erstnachrichten', vorlage: null, zweig: null },
  { id: 'antwort_da', titel: 'Antwort da', bestand: 5, heuteFaellig: 5, soll: null, erledigtHeute: null, stufenId: 'antworten', vorlage: null, zweig: null },
  { id: 'followup_0', titel: 'Follow-up 1', bestand: 18, heuteFaellig: 8, soll: null, erledigtHeute: null, stufenId: 'followups', vorlage: 'Vorlage 1', zweig: null },
  { id: 'followup_1', titel: 'Follow-up 2', bestand: 64, heuteFaellig: 7, soll: null, erledigtHeute: null, stufenId: 'followups', vorlage: 'Vorlage 2', zweig: null },
  { id: 'followup_2', titel: 'Follow-up 3', bestand: 100, heuteFaellig: 5, soll: null, erledigtHeute: null, stufenId: 'followups', vorlage: 'Vorlage 3', zweig: null },
  { id: 'loom_offen', titel: 'Loom offen', bestand: 11, heuteFaellig: 11, soll: null, erledigtHeute: null, stufenId: 'looms', vorlage: null, zweig: null },
  { id: 'wartet_auf_antwort', titel: 'Wartet auf Antwort', bestand: 182, heuteFaellig: 0, soll: null, erledigtHeute: null, stufenId: null, vorlage: null, zweig: null },
  { id: 'email_faellig', titel: 'E-Mail fällig', bestand: 603, heuteFaellig: 0, soll: null, erledigtHeute: null, stufenId: null, vorlage: null, zweig: 'still' },
  { id: 'postkarte_still', titel: 'Postkarte — kennt dich noch nicht', bestand: 9, heuteFaellig: 0, soll: null, erledigtHeute: null, stufenId: null, vorlage: null, zweig: 'still' },
  { id: 'instagram_faellig', titel: 'Instagram fällig', bestand: 0, heuteFaellig: 0, soll: null, erledigtHeute: null, stufenId: null, vorlage: null, zweig: 'laut' },
  { id: 'pdf_faellig', titel: 'Analyse-PDF fällig', bestand: 0, heuteFaellig: 0, soll: null, erledigtHeute: null, stufenId: null, vorlage: null, zweig: 'laut' },
  { id: 'kunde', titel: 'Kunde', bestand: 1, heuteFaellig: 0, soll: null, erledigtHeute: null, stufenId: null, vorlage: null, zweig: null },
  { id: 'ausserhalb', titel: 'Nicht in der Zielgruppe', bestand: 71, heuteFaellig: 0, soll: null, erledigtHeute: null, stufenId: null, vorlage: null, zweig: null },
]

/** Namen hinter einer Karte — aelteste zuerst, wie `funnelZuordnung()` sortiert. */
const KARTEN_NAMEN: KartenLead[] = [
  { leadId: 'l1', name: 'Hartmut Schneider', headline: 'Immobilienmakler · Schneider & Partner, Hamburg', faelligAm: '2026-05-02T09:00:00.000Z', naechsterSchritt: 'Wartet auf Annahme', faellig: false },
  { leadId: 'l2', name: 'Petra Lohmann', headline: 'Geschäftsführerin · Lohmann Immobilien GmbH', faelligAm: '2026-06-18T09:00:00.000Z', naechsterSchritt: 'Wartet auf Annahme', faellig: false },
  { leadId: 'l3', name: 'Jens Wiedemann', headline: 'Inhaber · Wiedemann Wohnbau', faelligAm: '2026-08-20T09:00:00.000Z', naechsterSchritt: 'Wartet auf Annahme', faellig: true },
  { leadId: 'l4', name: 'Sabine Roth', headline: '', faelligAm: null, naechsterSchritt: 'Kein Anfrage-Datum bekannt', faellig: false },
]

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
      // Seit 0081 eine Zaehl-Stufe: was wartet, wird beantwortet. „Frisch trotz
      // Menge" gilt nicht mehr als erledigt — die Frische steht in der Unterzeile.
      zustand: 'aktiv',
      kennzahl: `0 von ${ANTWORT_POSTEN.length}`,
      unterzeile: 'am längsten Andreas Blasch (3 h)',
      // 0081: Hier sitzen die zwei Knoepfe, die es bis zum 28.08. gar nicht gab.
      inhalt: () => (
        <Arbeitsliste
          posten={ANTWORT_POSTEN}
          onErledigt={() => {}}
          loomUrteil={{ moeglich: (p) => p.spur === 'antwort', entscheide: () => {} }}
        />
      ),
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

  /**
   * Die Namensliste hinter einer Karte (Zug 4). In der Vorschau bekommt jede
   * Karte dieselben vier Fixture-Namen — es geht hier um die Optik und den Weg
   * Karte → Fenster → Namen, nicht um die Zuordnung. Die prueft
   * `verify-funnel-karten.ts`.
   *
   * **Deshalb steht im Kopf „603 Personen" und darunter liegen vier.** Das ist
   * ein Artefakt dieser Vorschau, kein Fehler: Im Betrieb kommen Zahl und Liste
   * aus demselben Durchlauf von `funnelZuordnung()`, und dass sie nie
   * auseinanderlaufen, ist eine eigene Pruefung.
   */
  const namensKacheln: FlowZeileDef[] = FUNNEL_KARTEN.filter((k) => k.bestand > 0).map((k) => ({
    id: `karte-${k.id}`,
    titel: k.titel,
    zustand: 'ruhig' as const,
    kennzahl: `${k.bestand} ${k.bestand === 1 ? 'Person' : 'Personen'}`,
    inhalt: () => (
      <KartenNamen
        leads={KARTEN_NAMEN}
        onOeffneLead={() => {}}
        hinweis={
          k.id === 'email_faellig'
            ? 'Nie angenommen, 30 Tage sind um. Diese Stufe wartet auf E-Mail-Adressen — `Lead.email` ist bei allen leer.'
            : undefined
        }
      />
    ),
  }))

  const alleZeilen = [...zeilen, ...projekte, ...namensKacheln]
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
        {/* ── Canvas v2 (28.08.2026): links der Bestand, rechts der Tag ──── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 340px',
            gap: 18,
            alignItems: 'start',
            marginBottom: 22,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 760 }}>
            <div className="ck-label" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span>{tagesansage(ALLE_POSTEN, DAUERN)}</span>
              <span>Postfach-Stand: vor 2 h</span>
            </div>
            <div className="ck-zahl" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ck-text-2)', paddingInline: 4 }}>
              <span>1.693 Leads im Kosmos</span>
              <span>Tag 1 von 6</span>
            </div>
            <FunnelCanvas
              karten={FUNNEL_KARTEN}
              onOeffnen={(k) => setOffen(`karte-${k.id}`)}
              oeffenbar={(k) => k.bestand > 0}
              layoutIdFuer={(k) => `kachel-karte-${k.id}`}
            />
          </div>
          <TagesListe
            zeilen={zeilen}
            onOeffnen={(id) => setOffen(id)}
            fortschritt={{ erledigt: anfragen >= 30 ? 1 : 0, gesamt: 6 }}
            laedt={false}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 760 }}>
          <div className="ck-label">Neben dem Ritual</div>
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
