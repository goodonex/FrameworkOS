/**
 * Die Whale-Bank (01.09.2026) — seedet die ~28 handverlesenen Groß-Häuser aus
 * der DACH-Recherche als Kontakte mit Tag 'whale' (+ 'whale-p1'/'whale-p2').
 *
 * Quelle der Wahrheit für die Auswahl: Vault →
 * „03 Bereiche/Vertrieb & Outreach/Whale-Liste DACH – Die größten Makler (Stand 2026-09).md".
 * Die Smart View „Whales" in der Lead-Liste (/sales/leads) zeigt genau diese
 * Kontakte. Sie tragen bewusst KEIN next_follow_up_at (tauchen nie in „Heute
 * fällig" auf) und potenzial_betrag 0 (keine Fantasie-Summen in den
 * Pipeline-Werten — die Ticket-Größe steht als Text in der Notiz).
 *
 * Idempotent: gleicht namensbasiert (normName) gegen Name UND Firma aller
 * bestehenden Kontakte der Brand ab. Existiert der Kontakt schon, wird nur das
 * 'whale'-Tag ergänzt — Notizen und alles andere bleiben unangetastet.
 *
 * Start:
 *   npx tsx --env-file=runner/.env scripts/whales-seed.ts [--dry-run]
 */
import { normName } from '../app/src/cockpit/lib/leadIdentitaet'

const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '')
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const BRAND_SLUG = process.env.LINKEDIN_BRAND_SLUG ?? 'herrmann'
const DRY = process.argv.includes('--dry-run')

if (!SUPABASE_URL || !KEY) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen — mit --env-file=runner/.env starten.')
  process.exit(1)
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

/** PostgREST deckelt still bei 1000 Zeilen — jede Leseoperation blättert. */
async function alle<T = Record<string, unknown>>(pfad: string): Promise<T[]> {
  const out: T[] = []
  let from = 0
  for (;;) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${pfad}`, {
      headers: { ...H, Range: `${from}-${from + 999}` },
    })
    if (!res.ok) throw new Error(`GET ${pfad} HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`)
    const zeilen = (await res.json()) as T[]
    out.push(...zeilen)
    if (zeilen.length < 1000) break
    from += 1000
  }
  return out
}

interface Whale {
  /** Entscheider-Name, wenn eindeutig — sonst der Firmenname. */
  name: string
  company: string
  website: string
  land: 'DE' | 'AT' | 'CH'
  prio: 1 | 2
  /** Aufhänger/Momentum + Größe, wird die Kontakt-Notiz. */
  notiz: string
  /** true, wenn `name` eine Person ist. */
  person: boolean
}

const WHALES: Whale[] = [
  // ---- Priorität 1 ----
  { name: 'Thomas Aigner', company: 'Aigner Immobilien', website: 'https://www.aigner-immobilien.de', land: 'DE', prio: 1, person: true,
    notiz: 'WHALE P1 · München · 165 MA, 26,5 Mio. € Umsatz (2024, +50 %) · größter Unabhängiger Münchens, „Local Hero Wohnen" Nr. 1 · Co-GF Jenny Steinbeiß · Ticket-Logik: Marken-/Kampagnen-Projekt 15–50k, kein 5k-Funnel.' },
  { name: 'Markus Riedel', company: 'Riedel Immobilien', website: 'https://www.riedel-immobilien.de', land: 'DE', prio: 1, person: true,
    notiz: 'WHALE P1 · München · 52–85 MA, 13,4 Mio. € (2023) · Luxussegment, Christie\'s-Netzwerk-Partner · 2. Generation · Einstieg: Objekt-Seiten-Pilot für Luxusobjekt.' },
  { name: 'Eugen Otto', company: 'OTTO Immobilien', website: 'https://www.otto.at', land: 'AT', prio: 1, person: true,
    notiz: 'WHALE P1 · Wien · 109 MA, 7,75 Mio. € Honorar (2025) · frische Knight-Frank-Exklusivpartnerschaft → Auftritt muss internationalem Standard genügen · Dr. Eugen Otto, Alleininhaber.' },
  { name: 'Marlies Muhr', company: 'Marlies Muhr Immobilien', website: 'https://www.muhr-immobilien.com', land: 'AT', prio: 1, person: true,
    notiz: 'WHALE P1 · Salzburg/Kitzbühel/Wien · dominiert Ultra-High-End Tirol/Salzburg · 30+ Jahre · Objekt-Seiten-Upsell hier am stärksten (5-Mio.+-Objekte).' },
  { name: 'Elisabeth Rauscher', company: 'Team Rauscher / Finest Homes', website: 'https://www.team-rauscher.at', land: 'AT', prio: 1, person: true,
    notiz: 'WHALE P1 · Salzburg · ~28 MA, 200+ Transaktionen/Jahr · unangefochtene Nr. 1 Salzburg · Schwestermarke Finest Homes (Luxus).' },
  { name: 'Michael Schmidt', company: '3SI Immogroup / 3SI Makler', website: 'https://www.3si.at', land: 'AT', prio: 1, person: true,
    notiz: 'WHALE P1 · Wien · Bauträger+Makler, 300+ verkaufte Whg. (2025), 6,1 Mio. € Courtage · familiengeführt · PERFEKTER Pilot für Projekt-/Objektseiten (Marketing-Budget pro Projekt ist dort normal).' },
  { name: 'Eva Martina Marschall', company: 'Marschall Immobilien', website: 'https://www.marschall.at', land: 'AT', prio: 1, person: true,
    notiz: 'WHALE P1 · Wien · Luxus, 32+ Jahre · Umbruch: Gründer Peter Marschall zog sich 05/2026 zurück → Neuaufstellungs-/Rebranding-Anlass.' },
  { name: 'Claudio Walde', company: 'Walde Immobilien', website: 'https://www.walde.ch', land: 'CH', prio: 1, person: true,
    notiz: 'WHALE P1 · Zollikon/Zürichsee · ~80 MA, 9 Standorte · CEO-Generationswechsel 2024 (Claudio Walde, 32, 3. Gen.) = klassischer Rebranding-Moment.' },
  { name: 'Claude A. Ginesta', company: 'Ginesta Immobilien', website: 'https://www.ginesta.ch', land: 'CH', prio: 1, person: true,
    notiz: 'WHALE P1 · Küsnacht ZH · 60+ MA, 10 Standorte (Zürichsee + Engadin/St. Moritz) · 3. Generation · LeadingRE/Luxury-Portfolio-Partner.' },
  { name: 'Bernard H. Homann', company: 'HOMANN IMMOBILIEN', website: 'https://www.homann-immobilien.de', land: 'DE', prio: 1, person: true,
    notiz: 'WHALE P1 · Münster · 30+ MA · Capital Makler-Kompass 2025: bester Makler Deutschlands (94 %) · Familienunternehmen, 2. Generation im Haus.' },
  { name: 'Dagmar Böcker-Schüttken', company: 'Böcker Wohnimmobilien', website: 'https://www.immobilien-boecker.de', land: 'DE', prio: 1, person: true,
    notiz: 'WHALE P1 · Düsseldorf · 30–50 MA, 5 Standorte · 30-Jahre-Jubiläum 2025 als Aufhänger.' },
  { name: 'Roland Kampmeyer', company: 'KAMPMEYER Immobilien', website: 'https://www.kampmeyer.com', land: 'DE', prio: 1, person: true,
    notiz: 'WHALE P1 · Köln/Bonn/Düsseldorf · 28 MA · Rheinland-Metropolregion · Co-GF Nina Lenz.' },
  { name: 'David Borck', company: 'David Borck Immobiliengesellschaft', website: 'https://www.david-borck.de', land: 'DE', prio: 1, person: true,
    notiz: 'WHALE P1 · Berlin · 23 MA · größter verbliebener Unabhängiger Berlins (nach Ziegert-Insolvenz) · Co-GF Caren Rothmann.' },
  { name: 'Carsten Stöben', company: 'Otto Stöben', website: 'https://www.stoeben.de', land: 'DE', prio: 1, person: true,
    notiz: 'WHALE P1 · Kiel/Schleswig-Holstein · ~30 MA, 8 Standorte · 100+ Jahre, 4. Generation.' },
  { name: 'Peters + Peters', company: 'Peters + Peters Wohn- und Anlageimmobilien', website: 'https://www.petersundpeters-immobilien.de', land: 'DE', prio: 1, person: false,
    notiz: 'WHALE P1 · Hamburg · Premium, seit 1997 · GF Christian & Henning Peters (Brüder — Ansprache klären) · NICHT verwechseln mit Peters & Peters Sotheby\'s Frankfurt.' },
  // ---- Priorität 2 ----
  { name: 'Garant Immobilien', company: 'Garant Immobilien', website: 'https://www.garant-immo.de', land: 'DE', prio: 2, person: false,
    notiz: 'WHALE P2 · Stuttgart · 320+ MA, 39 Standorte — größtes inhabergeführtes Haus Süddeutschlands (Familie Moser) · bei der Größe internes Marketing wahrscheinlich; Wohn-/Gewerbeanteil unklar.' },
  { name: 'Peter Schürrer', company: 'Schürrer & Fleischer Immobilien', website: 'https://www.schuerrer-fleischer.de', land: 'DE', prio: 2, person: true,
    notiz: 'WHALE P2 · Bruchsal/BW · ~110 MA, 9 Filialen · hält zusätzlich die BW-Sotheby\'s-Lizenz (Luxussparte CI-gebunden, Hauptmarke eigen).' },
  { name: 'Robert C. Spies', company: 'Robert C. Spies', website: 'https://www.robertcspies.de', land: 'DE', prio: 2, person: false,
    notiz: 'WHALE P2 · Bremen/Hamburg · 100–120 MA · stark Gewerbe/Investment, Wohnen Teilsegment · Konzernstruktur, kein Einzel-Entscheider.' },
  { name: 'Greif & Contzen', company: 'Greif & Contzen', website: 'https://www.greif-contzen.de', land: 'DE', prio: 2, person: false,
    notiz: 'WHALE P2 · Köln · ~100 MA · gewerbelastig, eigene Wohnen-Sparte · GF Theodor J. Greif, Rainer Krauß.' },
  { name: 'Wentzel Dr.', company: 'Wentzel Dr.', website: 'https://www.wentzel-dr.de', land: 'DE', prio: 2, person: false,
    notiz: 'WHALE P2 · Hamburg · 200+ MA (Gruppe), seit 1820 · Mischbetrieb mit großer Hausverwaltung, startet eigenes Franchise · GF Dr. Claas Kießling.' },
  { name: 'Michael Ehlmaier', company: 'EHL Immobilien / EHL Wohnen', website: 'https://www.ehl.at', land: 'AT', prio: 2, person: true,
    notiz: 'WHALE P2 · Wien · 18,1 Mio. € Honorar (2025), Nr. 1 der AT-Einzelunternehmen · institutionell geprägt (Büro/Investment-Kern), Wohnen als Sparte.' },
  { name: 'Pascal Vaucher', company: 'Wüst und Wüst', website: 'https://www.wuw.ch', land: 'CH', prio: 2, person: true,
    notiz: 'WHALE P2 · Küsnacht/Zug/Luzern · 6 Standorte, Basel ab 2026 · Christie\'s-Partner · Teil der Intercity Group (Konzernmutter) — Spielraum fürs Branding begrenzt.' },
  { name: 'Aaron August', company: 'AUSA Immobilienmakler', website: 'https://www.ausa-immobilien.de', land: 'DE', prio: 2, person: true,
    notiz: 'WHALE P2 · Münster · 20+ MA · Bellevue Best Property Agent 2025.' },
  { name: 'Nikolaus Hübl-Langer', company: 'Hübl & Partner', website: 'https://www.huebl-partner.com', land: 'AT', prio: 2, person: true,
    notiz: 'WHALE P2 · Wien · Bauträger+Makler, Familie Hübl, seit 1993 · ÖGVS-Qualitätstest 2025 „herausragend".' },
  { name: 'Peter Singer', company: 'TeamWohnWerk', website: 'https://www.teamwohnwerk.at', land: 'AT', prio: 2, person: true,
    notiz: 'WHALE P2 · Graz · Premium-Positionierung, Kurier „Top-Immo-Experte" 2024–2026 · jung (gegr. 2022), wächst.' },
  { name: 'Von Graffenried', company: 'Von Graffenried Vermarktung', website: 'https://www.graffenried-vermarktung.ch', land: 'CH', prio: 2, person: false,
    notiz: 'WHALE P2 · Bern · Traditionsgruppe (Kantone Bern/Freiburg/Solothurn), B Corp seit 2023.' },
  { name: 'Dominique Beurret', company: 'Beurret & Partner', website: 'https://www.beurretpartner.ch', land: 'CH', prio: 2, person: true,
    notiz: 'WHALE P2 · Basel · gehoben (Villen, MFH), inhabergeführt.' },
  { name: 'Goldinger Immobilien', company: 'Goldinger Immobilien', website: '', land: 'CH', prio: 2, person: false,
    notiz: 'WHALE P2 · St. Gallen/Ostschweiz · Platzhirsch der Region (35+ Jahre) · noch dünn recherchiert — Website und Entscheider vor Ansprache verifizieren.' },
]

async function main() {
  const brands = await alle<{ id: string; slug: string }>(`brands?slug=eq.${BRAND_SLUG}&select=id,slug`)
  if (brands.length !== 1) throw new Error(`Brand '${BRAND_SLUG}' nicht eindeutig gefunden (${brands.length} Treffer).`)
  const brandId = brands[0].id

  const bestand = await alle<{ id: string; name: string; company: string | null; tags: string[] | null }>(
    `contacts?brand_id=eq.${brandId}&select=id,name,company,tags`,
  )
  const index = new Map<string, { id: string; tags: string[] }>()
  for (const c of bestand) {
    const eintrag = { id: c.id, tags: c.tags ?? [] }
    if (c.name) index.set(normName(c.name), eintrag)
    if (c.company) index.set(normName(c.company), eintrag)
  }

  let angelegt = 0
  let getaggt = 0
  let unveraendert = 0

  for (const w of WHALES) {
    const treffer = index.get(normName(w.name)) ?? index.get(normName(w.company))
    const tags = ['whale', `whale-p${w.prio}`]

    if (treffer) {
      if (treffer.tags.includes('whale')) {
        unveraendert++
        console.log(`= ${w.company} — existiert bereits mit whale-Tag`)
        continue
      }
      console.log(`~ ${w.company} — existiert (${treffer.id.slice(0, 8)}), ergänze nur das Tag`)
      if (!DRY) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/contacts?id=eq.${treffer.id}`, {
          method: 'PATCH',
          headers: H,
          body: JSON.stringify({ tags: [...new Set([...treffer.tags, ...tags])] }),
        })
        if (!res.ok) throw new Error(`PATCH contacts ${w.company} HTTP ${res.status}`)
      }
      getaggt++
      continue
    }

    console.log(`+ ${w.company} (${w.land}, P${w.prio})${w.person ? ` — ${w.name}` : ''}`)
    if (!DRY) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/contacts`, {
        method: 'POST',
        headers: { ...H, Prefer: 'return=minimal' },
        body: JSON.stringify({
          brand_id: brandId,
          name: w.name,
          company: w.company,
          website: w.website,
          notes: w.notiz,
          tags,
          contact_type: w.person ? 'person' : 'company',
          contact_status: 'not_contacted',
          pipeline_stage: 'first_contact',
          lead_source: 'cold',
        }),
      })
      if (!res.ok) throw new Error(`POST contacts ${w.company} HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`)
    }
    angelegt++
  }

  console.log(`\n${DRY ? '[DRY-RUN] ' : ''}Fertig: ${angelegt} angelegt, ${getaggt} nachgetaggt, ${unveraendert} unverändert (von ${WHALES.length}).`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
