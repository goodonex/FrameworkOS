/**
 * Das Vertriebs-Audit — jedes Glied der Kette gegen die ECHTEN Daten (01.09.2026).
 *
 * **Der Anlass, wörtlich.** Kevin, nachdem die Erstnachrichten-Kachel zum
 * zweiten Mal „0 von 0" zeigte: *„Bitte geh diese Systematik durch, nicht
 * raten, nicht annehmen, nicht ‚das hab ich hier jetzt im Code gesehen,
 * deswegen bin ich davon ausgegangen'. Tu alles zweimal gegenchecken. […]
 * Jeder einzelne kleine Punkt da drinne, den musst du jetzt bitte einmal
 * auflisten."*
 *
 * **Was dieses Skript anders macht als die verify-Skripte.** `verify-*.ts`
 * prüfen Logik gegen Fixtures — sie beweisen, dass der Code rechnet, was er
 * rechnen soll. Dieses Skript prüft die DATEN gegen Invarianten: Es lädt den
 * Produktionsstand und misst an jedem Kettenglied, ob das, was da liegt, in
 * sich stimmt. Ein grüner verify-Lauf und ein roter Audit-Lauf zusammen
 * heißen: Der Code ist richtig, aber die Daten sind es nicht — genau die
 * Sorte Fehler, die bisher erst an Kevins Bildschirm auffiel.
 *
 * Jede kritische Zahl wird auf ZWEI Wegen gemessen, wo es zwei gibt
 * (App-Funktion gegen unabhängige Nachrechnung, Tabelle gegen Tabelle).
 *
 * Start: npx tsx scripts/audit-vertrieb.ts
 * Exit-Code 1, sobald ein FAIL dabei ist — damit es in jede Routine passt.
 */
import { readFileSync } from 'node:fs'
import { angenommenOhneErstnachricht, nachStichtag, ERSTNACHRICHT_STICHTAG } from '../app/src/cockpit/lib/funnelStufen'
import { icpUrteil, istArbeitsVorrat } from '../app/src/cockpit/lib/icp'
import { erstnachrichtPosten } from '../app/src/cockpit/lib/arbeitsmodusQuellen'
import { flowQuellen, stufenStaende } from '../app/src/cockpit/lib/tagesFlow'

let pass = 0
let warnungen = 0
let fails = 0
function ok(was: string, detail = '') {
  pass++
  console.log(`  ok    ${was}${detail ? ` — ${detail}` : ''}`)
}
function warn(was: string, detail = '') {
  warnungen++
  console.log(`  WARN  ${was}${detail ? ` — ${detail}` : ''}`)
}
function fail(was: string, detail = '') {
  fails++
  console.log(`  FAIL  ${was}${detail ? ` — ${detail}` : ''}`)
}
function check(bedingung: boolean, was: string, detail = '') {
  if (bedingung) ok(was, detail)
  else fail(was, detail)
}

/** Namensabgleich EXAKT wie in funnelStufen — bewusst kopiert, um Drift zu MESSEN. */
function normName(roh: string): string {
  return roh
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

async function main() {
  const env = Object.fromEntries(
    readFileSync(new URL('../runner/.env', import.meta.url), 'utf8')
      .split('\n')
      .filter((z) => z.includes('=') && !z.trim().startsWith('#'))
      .map((z) => {
        const i = z.indexOf('=')
        return [z.slice(0, i).trim(), z.slice(i + 1).trim()] as [string, string]
      }),
  )
  const url = (env.SUPABASE_URL ?? '').replace(/\/$/, '')
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  const kopf = { apikey: key, Authorization: `Bearer ${key}` }
  const alle = async <T,>(pfad: string): Promise<T[]> => {
    const out: T[] = []
    for (let off = 0; off < 100_000; off += 1000) {
      const res = await fetch(`${url}/rest/v1/${pfad}&limit=1000&offset=${off}`, { headers: kopf })
      if (!res.ok) throw new Error(`GET ${pfad} → HTTP ${res.status}`)
      const zeilen = (await res.json()) as T[]
      out.push(...zeilen)
      if (zeilen.length < 1000) break
    }
    return out
  }

  /* ══ K1 · Chrome und Runner ═══════════════════════════════════════════ */
  console.log('\nK1 — Chrome und Runner (ohne die läuft kein Sync)')
  try {
    const r = await fetch('http://127.0.0.1:9222/json/version', { signal: AbortSignal.timeout(2500) })
    check(r.ok, 'Sync-Chrome antwortet auf CDP 9222')
  } catch {
    warn('Sync-Chrome läuft gerade nicht', 'Chrome-Etappen der Runde werden übersprungen — kein Fehler, aber kein frischer LinkedIn-Stand')
  }
  try {
    const r = await fetch('http://127.0.0.1:4711/runde', { signal: AbortSignal.timeout(2500) })
    const d = (await r.json()) as { letzterStandText: string; fragen: boolean; laeuft: boolean }
    check(r.ok, 'Runner lebt, /runde antwortet', `letzter Stand ${d.letzterStandText} · fragen=${d.fragen}`)
  } catch {
    fail('Runner nicht erreichbar auf 4711', 'launchctl kickstart -k gui/$(id -u)/de.uriel.runner')
  }
  {
    const spiegel = await alle<{ data: { letzterStand: string | null }; updated_at: string }>(
      `runner_snapshots?key=eq.runde_stand&select=data,updated_at`,
    )
    if (!spiegel.length) fail('Runde-Spiegel fehlt', 'Live-Domain sieht die Runde nicht')
    else {
      /**
       * Frische heisst hier INHALT, nicht Zeitstempel: `pushSnapshotKey`
       * schreibt nur bei geänderter Signatur — ein unverändert richtiger
       * Spiegel behält sein altes `updated_at`, und das ist korrekt. Die
       * Invariante ist, dass Spiegel und Runner dieselbe Antwort auf die
       * Morgenfrage geben (der 01.09.-Fund war genau deren Auseinanderlaufen).
       */
      let runnerFragen: boolean | null = null
      try {
        const r = await fetch('http://127.0.0.1:4711/runde', { signal: AbortSignal.timeout(2500) })
        runnerFragen = ((await r.json()) as { fragen: boolean }).fragen
      } catch {
        /* Runner-Check oben meldet das bereits. */
      }
      const spiegelFragen = (spiegel[0].data as { fragen?: boolean }).fragen
      if (runnerFragen === null) warn('Spiegel-Abgleich übersprungen', 'Runner nicht erreichbar')
      else
        check(
          spiegelFragen === runnerFragen,
          'Spiegel und Runner beantworten die Morgenfrage gleich',
          `Spiegel fragen=${spiegelFragen} · Runner fragen=${runnerFragen}`,
        )
    }
  }

  /* ══ K2 · Die Quellen: Threads und Netzwerk ═══════════════════════════ */
  console.log('\nK2 — Postfach-Spiegel (linkedin_threads)')
  const threads = await alle<{
    id: string
    name: string
    profile_url: string
    last_from: string | null
    last_message_at: string | null
    verlauf: unknown
    lead_id: string | null
  }>(`linkedin_threads?select=id,name,profile_url,last_from,last_message_at,verlauf,lead_id&order=id`)
  {
    check(threads.length > 0, `${threads.length} Threads im Spiegel`)
    const daten = threads.map((t) => t.last_message_at).filter(Boolean).sort() as string[]
    const aeltester = daten[0]?.slice(0, 10)
    const juengster = daten[daten.length - 1]?.slice(0, 10)
    ok('Zeitfenster des Postfachs', `${aeltester} bis ${juengster}`)
    /**
     * DIE Deckungs-Frage: Das Postfach-Fenster begrenzt, wen der Namensabgleich
     * als „schon angeschrieben" erkennen kann. Wer VOR dem Fenster
     * angeschrieben wurde und nie antwortete, hat keinen Thread — und zählt
     * fälschlich als „wartet auf Erstnachricht".
     */
    const mitVerlauf = threads.filter((t) => Array.isArray(t.verlauf) && (t.verlauf as unknown[]).length > 1).length
    const quote = threads.length ? Math.round((mitVerlauf / threads.length) * 100) : 0
    check(mitVerlauf > 0, 'Verläufe werden nachgezogen', `${mitVerlauf} von ${threads.length} Threads mit echtem Verlauf (${quote} %)`)
    if (quote < 50) warn('über die Hälfte der Threads noch ohne Verlauf', 'Conversion Erstnachricht→Antwort bleibt für diese unmessbar — verlauf-nachziehen läuft je Runde nur 60 Threads')
    const leerName = threads.filter((t) => !normName(t.name ?? '')).length
    check(leerName === 0, 'jeder Thread trägt einen Namen', leerName ? `${leerName} ohne` : '')
  }

  console.log('\nK3 — Netzwerk-Spiegel (linkedin_netzwerk)')
  const netz = await alle<{
    id: string
    name: string
    profil_key: string
    profile_url: string
    status: string
    headline: string
    eingeladen_at: string | null
    angenommen_at: string | null
    zuletzt_gesehen_at: string
    lead_id: string | null
  }>(`linkedin_netzwerk?select=id,name,profil_key,profile_url,status,headline,eingeladen_at,angenommen_at,zuletzt_gesehen_at,lead_id&order=id`)
  const angenommenSpiegel = netz.filter((n) => n.status === 'angenommen')
  {
    ok('Bestand', `${netz.length} gesamt · ${angenommenSpiegel.length} angenommen · ${netz.length - angenommenSpiegel.length} offen`)
    const dubletten = new Map<string, number>()
    for (const n of netz) dubletten.set(n.profil_key, (dubletten.get(n.profil_key) ?? 0) + 1)
    const doppelt = [...dubletten.values()].filter((c) => c > 1).length
    check(doppelt === 0, 'profil_key ist eindeutig', doppelt ? `${doppelt} Dubletten!` : `${dubletten.size} Schlüssel`)
    /**
     * DOM-Artefakte im Namen (01.09.: „Noah Weber Aktueller Entitätsverlauf")
     * zerlegen jeden Namensabgleich — fünf längst Angeschriebene galten so als
     * wartend. Der Parser strippt den Suffix seit heute; diese Wache schlägt an,
     * falls LinkedIn eine neue Variante ausliefert.
     */
    const artefakte = netz.filter((n) => /entitätsverlauf|status is (online|offline)|premium-mitglied/i.test(n.name))
    check(artefakte.length === 0, 'kein DOM-Artefakt in Namen', artefakte.length ? artefakte.slice(0, 3).map((n) => `"${n.name}"`).join(' · ') : '')
    const ohneAnnahmeDatum = angenommenSpiegel.filter((n) => !n.angenommen_at).length
    check(ohneAnnahmeDatum === 0, 'jede Annahme trägt ein Datum', ohneAnnahmeDatum ? `${ohneAnnahmeDatum} ohne — die fallen durch jeden Stichtag-Filter auf die JA-Seite` : '')
    const ohneLead = netz.filter((n) => !n.lead_id)
    /**
     * Frisch geerntete Zeilen sind noch unverheiratet, bis die Leads-Etappe der
     * nächsten Runde läuft — das ist Latenz, kein Defekt (am 01.09. betraf es
     * exakt die drei vom Kurzlauf des Vortags). Ein Defekt ist es erst, wenn
     * eine Zeile TAGE ohne Lead bleibt: dann hat das Verheiraten sie
     * übersprungen, und ihre Historie bleibt für immer leer.
     */
    const REIFE_MS = 3 * 24 * 60 * 60 * 1000
    const alteOhneLead = ohneLead.filter((n) => Date.now() - new Date(n.zuletzt_gesehen_at).getTime() > REIFE_MS)
    if (alteOhneLead.length)
      fail('Netzwerk-Zeilen bleiben unverheiratet', `${alteOhneLead.length} älter als 3 Tage: ${alteOhneLead.slice(0, 4).map((n) => n.name).join(', ')}`)
    else if (ohneLead.length)
      warn(`${ohneLead.length} Zeilen noch nicht verheiratet`, `frisch geerntet (${ohneLead.slice(0, 3).map((n) => n.name).join(', ')}) — die nächste Leads-Etappe holt das nach`)
    else ok('jede Netzwerk-Zeile ist mit einem Lead verheiratet')
  }

  /* ══ K4 · Leads und Historie ══════════════════════════════════════════ */
  console.log('\nK4 — Lead-System (leads + lead_ereignisse)')
  const leads = await alle<{ id: string; name: string; profil_key: string; li_urn: string; lead_status: string }>(
    `leads?select=id,name,profil_key,li_urn,lead_status&order=id`,
  )
  const ereignisse = await alle<{ lead_id: string; typ: string; at: string }>(
    `lead_ereignisse?select=lead_id,typ,at&order=lead_id`,
  )
  {
    ok('Bestand', `${leads.length} Leads · ${ereignisse.length} Ereignisse`)
    const evJeLead = new Map<string, Set<string>>()
    for (const e of ereignisse) {
      const s = evJeLead.get(e.lead_id) ?? new Set()
      s.add(e.typ)
      evJeLead.set(e.lead_id, s)
    }
    // Zweiter Messweg für dieselbe Frage: Annahmen im Spiegel vs. Annahme-Ereignisse.
    const angenommenMitLead = angenommenSpiegel.filter((n) => n.lead_id)
    const ohneAngenommenEvent = angenommenMitLead.filter((n) => !evJeLead.get(n.lead_id!)?.has('angenommen'))
    check(
      ohneAngenommenEvent.length === 0,
      'jede verheiratete Annahme hat ihr Ereignis',
      ohneAngenommenEvent.length
        ? `${ohneAngenommenEvent.length} fehlen, z. B. ${ohneAngenommenEvent.slice(0, 4).map((n) => n.name).join(', ')}`
        : `${angenommenMitLead.length} geprüft`,
    )
    const namen = new Map<string, number>()
    for (const l of leads) namen.set(normName(l.name), (namen.get(normName(l.name)) ?? 0) + 1)
    const doppelte = [...namen.entries()].filter(([, c]) => c > 1)
    if (doppelte.length) warn(`${doppelte.length} Namen mit mehreren Leads`, `z. B. ${doppelte.slice(0, 3).map(([n]) => n).join(', ')} — Namensabgleiche werden dort „mehrdeutig"`)
    else ok('kein Name doppelt im Lead-Bestand')
  }

  /* ══ K5 · Der Erstnachrichten-Topf ════════════════════════════════════ */
  console.log('\nK5 — Erstnachrichten-Arbeitsliste (linkedin_erstnachrichten)')
  const erst = await alle<{ id: string; name: string; status: string; nachricht: string; quelle_datei: string; sent_at: string | null }>(
    `linkedin_erstnachrichten?select=id,name,status,nachricht,quelle_datei,sent_at&order=sort_index`,
  )
  {
    const st = { offen: 0, gesendet: 0, uebersprungen: 0 } as Record<string, number>
    for (const e of erst) st[e.status] = (st[e.status] ?? 0) + 1
    ok('Bestand', `${erst.length} Zeilen · ${st.offen ?? 0} offen · ${st.gesendet ?? 0} gesendet · ${st.uebersprungen ?? 0} übersprungen`)
    const leere = erst.filter((e) => e.status === 'offen' && !e.nachricht.trim()).length
    check(leere === 0, 'kein offener Eintrag ohne Text', leere ? `${leere} leer` : '')
    const doppelte = new Map<string, number>()
    for (const e of erst) doppelte.set(normName(e.name), (doppelte.get(normName(e.name)) ?? 0) + 1)
    const mehrfach = [...doppelte.entries()].filter(([, c]) => c > 1)
    check(mehrfach.length === 0, 'keine Person doppelt im Topf', mehrfach.length ? `${mehrfach.slice(0, 3).map(([n]) => n).join(', ')}` : '')
    const agentRows = erst.filter((e) => e.quelle_datei.startsWith('agent:'))
    ok('vom Agenten angelegt', `${agentRows.length} (${agentRows.filter((e) => e.status === 'offen').length} versandfertig)`)
  }

  /* ══ K6 · Die Wartenden — Kevins 355er-Frage ══════════════════════════ */
  console.log(`\nK6 — Wer wartet wirklich? (Stichtag ${ERSTNACHRICHT_STICHTAG})`)
  const wartendAlle = angenommenOhneErstnachricht(netz as never, threads as never, erst as never, new Date())
  const wartendStichtag = wartendAlle.filter((p) => nachStichtag(p.seit))
  const wartendVorrat = wartendStichtag.filter((p) => istArbeitsVorrat(icpUrteil(p.info ?? '', p.name).urteil))
  {
    const je = { kern: 0, rand: 0, unklar: 0, off: 0 } as Record<string, number>
    for (const p of wartendStichtag) je[icpUrteil(p.info ?? '', p.name).urteil]++
    ok('Aufteilung seit Stichtag', `kern ${je.kern} · rand ${je.rand} · unklar ${je.unklar} · off ${je.off} (off zählt nicht)`)
    ok('im Tagespensum (kern+rand+unklar)', String(wartendVorrat.length))

    /**
     * Falsch-Positive, Messweg 1: Ein Lead mit gefüllter `li_urn` HAT einen
     * Thread (nur daher kommt die opake ID). Steht so jemand trotzdem in der
     * Wartenden-Liste, hat der NAMENSabgleich den Thread nicht erkannt —
     * das ist ein Loch im Abgleich, kein wartender Mensch.
     */
    const leadByKey = new Map(leads.filter((l) => l.profil_key).map((l) => [l.profil_key, l]))
    const mitUrn = wartendVorrat.filter((p) => {
      const l = leadByKey.get(p.key)
      return l && l.li_urn !== ''
    })
    check(
      mitUrn.length === 0,
      'kein Wartender hat in Wahrheit einen Thread (li_urn-Gegenprobe)',
      mitUrn.length ? `${mitUrn.length} doch, z. B. ${mitUrn.slice(0, 4).map((p) => p.name).join(', ')}` : `${wartendVorrat.length} geprüft`,
    )

    /**
     * Falsch-Positive, Messweg 2: die Lead-Historie. Trägt der Lead ein
     * `erstnachricht`-Ereignis, wurde er nachweislich angeschrieben — egal was
     * der Namensabgleich sagt. Zwei unabhängige Wege, eine Wahrheit.
     */
    const evJeLead = new Map<string, Set<string>>()
    for (const e of ereignisse) {
      const s = evJeLead.get(e.lead_id) ?? new Set()
      s.add(e.typ)
      evJeLead.set(e.lead_id, s)
    }
    const mitEvent = wartendVorrat.filter((p) => {
      const l = leadByKey.get(p.key)
      return l && evJeLead.get(l.id)?.has('erstnachricht')
    })
    check(
      mitEvent.length === 0,
      'kein Wartender hat ein Erstnachricht-Ereignis (Historie-Gegenprobe)',
      mitEvent.length ? `${mitEvent.length} doch, z. B. ${mitEvent.slice(0, 4).map((p) => p.name).join(', ')}` : '',
    )

    // Die Gegenrichtung: von gestern übersprungene dürfen NICHT mehr warten.
    const uebersprungenNamen = new Set(erst.filter((e) => e.status === 'uebersprungen').map((e) => normName(e.name)))
    const trotzdemDrin = wartendVorrat.filter((p) => uebersprungenNamen.has(normName(p.name)))
    check(trotzdemDrin.length === 0, 'Aussortierte kommen nicht wieder', trotzdemDrin.length ? trotzdemDrin.map((p) => p.name).join(', ') : `${uebersprungenNamen.size} übersprungene geprüft`)
  }

  /* ══ K7 · Die Kachel-Kette, Ende zu Ende ══════════════════════════════ */
  console.log('\nK7 — Die Kachel rechnet, was auf dem Schirm stehen muss')
  {
    const texte = erstnachrichtPosten(erst as never, threads as never, netz as never)
    const q = flowQuellen(
      { erstnachricht: texte, erstnachrichtWartend: wartendVorrat, followup: [], loom: [], antwort: [] },
      new Date(),
    )
    const staende = stufenStaende({ today: {}, ...q })
    const e = staende.find((s) => s.stufe.id === 'erstnachrichten')!
    ok('Kachel ohne Portion', `"${e.wert} von ${e.soll}" · material=${e.material} · blockiert=${e.blockiert} · erledigt=${e.erledigt}`)
    check(e.soll === wartendVorrat.length, 'Soll = Wartende (kein Deckel, Kevins Wort vom 31.08.)', `${e.soll} vs ${wartendVorrat.length}`)
    check(!e.erledigt || wartendVorrat.length === 0, 'nie grün, solange jemand wartet')

    /**
     * Der Giftschrank: eine eingefrorene 0 bei vorhandener Arbeit. Genau das
     * hielt Kevins Tab am 31.08. und 01.09. auf „0 von 0 ✓" — die Portion war
     * morgens aus dem Entwurfs-Topf (leer) eingefroren worden und stach die
     * Live-Rechnung den ganzen Tag.
     */
    const heute = new Date().toISOString().slice(0, 10)
    const portionen = await alle<{ stufe: string; soll: number }>(
      `sales_tagesportionen?datum=eq.${heute}&select=stufe,soll`,
    )
    const gift = portionen.find((p) => p.stufe === 'erstnachrichten' && p.soll === 0 && wartendVorrat.length > 0)
    check(!gift, 'heute keine vergiftete 0-Portion eingefroren', gift ? 'DOCH — löschen oder auf den Stale-Guard verlassen' : portionen.length ? `heutige Portionen: ${portionen.map((p) => `${p.stufe}=${p.soll}`).join(' · ')}` : 'heute noch nichts eingefroren')

    const giftStaende = stufenStaende({ today: {}, ...q, portionen: { erstnachrichten: 0 } })
    const eGift = giftStaende.find((s) => s.stufe.id === 'erstnachrichten')!
    check(
      eGift.soll === wartendVorrat.length && !eGift.erledigt,
      'eine vergiftete 0-Portion wird ignoriert (Stale-Guard)',
      `mit Portion 0 rechnet die Kachel "${eGift.wert} von ${eGift.soll}"`,
    )
  }

  /* ══ K8 · Stichproben für Kevins Auge ═════════════════════════════════ */
  console.log('\nK8 — Stichprobe: die 12 jüngsten sicheren Makler im Wartestand')
  {
    const kern = wartendVorrat
      .filter((p) => icpUrteil(p.info ?? '', p.name).urteil === 'kern')
      .slice(0, 12)
    for (const p of kern) {
      console.log(`        ${String(p.seit ?? '').slice(0, 10)}  ${p.name} — ${(p.info ?? '').slice(0, 60)}`)
    }
  }

  console.log(`\naudit-vertrieb: ${pass} ok · ${warnungen} Warnungen · ${fails} FAILS`)
  process.exit(fails === 0 ? 0 : 1)
}

void main().catch((e) => {
  console.error('Audit abgebrochen:', e?.message ?? e)
  process.exit(1)
})
