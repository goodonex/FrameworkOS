/**
 * runner/widersprueche.mjs — der Widerspruchs-Wächter (17.08.2026)
 *
 * **Warum es das gibt.** Vier Wochen lang meldete das Cockpit „117 offene
 * Erstnachrichten", während 78 davon längst im Postfach standen und 15 sogar
 * geantwortet hatten. Kein Prüfskript schlug an — sie prüfen jede Funktion
 * gegen ausgedachte Beispieldaten, also „rechnet sie richtig?", nie „stimmt das
 * Ergebnis mit der zweiten Quelle daneben überein?". Genau diese Frage stellt
 * diese Datei, und zwar gegen den echten Bestand.
 *
 * Es ist bewusst KEIN zweiter Agent: Ein Modell, das dieselbe Tabelle noch
 * einmal liest, kommt zum selben falschen Ergebnis. Was Fehler dieser Art
 * findet, ist ein Satz, der in Kevins Daten immer wahr sein muss — und die
 * Meldung, wenn er es nicht ist.
 *
 * `pruefeWidersprueche` ist rein und ohne Netz prüfbar:
 * `npx tsx scripts/verify-widersprueche.ts`
 *
 * Start von Hand: `node --env-file=runner/.env runner/widersprueche.mjs`
 */
import { pathToFileURL } from 'node:url'

const SNAPSHOT_KEY = 'widersprueche'
const STUNDE_MS = 3_600_000

/** Ab wann ist ein Stand alt? Getrennt, weil die Quellen verschieden schnell altern. */
export const GRENZEN = {
  /**
   * Das Postfach trägt Antworten — es ist die eiligste Quelle.
   *
   * 18 statt 48 Stunden (25.08.). Bei 48 blieb ein Ausfall vom 24.08. still:
   * Der Sync stand 26 Stunden, die Loom-Warteschlange zeigte weiter den Stand
   * von vorgestern, und der Wächter schwieg — die Schwelle war so großzügig,
   * dass sie fast nur noch tote Setups gefunden hätte. 18 Stunden lassen die
   * normale Nachtlücke durch (letzter Sync ~19 Uhr, erster ~9 Uhr = 14 Stunden),
   * schlagen aber an, sobald ein ganzer Arbeitstag ohne Sync vergangen ist.
   */
  postfachStunden: 18,
  /** Das Netzwerk wächst langsam; eine Woche ist hier normal. */
  netzwerkTage: 7,
  /** Nachts laufen Routinen; anderthalb Tage ohne Erfolg heißt: etwas klemmt. */
  agentenStunden: 36,
}

/**
 * Alter in Worten. Unter zwei Tagen in Stunden, darüber in Tagen: Seit die
 * Postfach-Schwelle bei 18 Stunden liegt, hätte `Math.floor(alter / 24)` einen
 * 26-Stunden-Ausfall als „1 Tagen" gemeldet — zu ungenau, um zu handeln.
 */
function alterText(stunden) {
  if (stunden < 48) return `${Math.round(stunden)} Stunden`
  return `${Math.floor(stunden / 24)} Tagen`
}

/** Namen vergleichbar machen — dieselbe Regel wie `funnelStufen.normName`. */
export function normName(n) {
  return String(n ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function stundenSeit(iso, jetzt) {
  const t = new Date(String(iso ?? '')).getTime()
  if (Number.isNaN(t)) return null
  return (jetzt.getTime() - t) / STUNDE_MS
}

function juengste(liste, feld) {
  let best = null
  for (const z of liste) {
    const w = z?.[feld]
    if (!w) continue
    if (best == null || String(w) > String(best)) best = w
  }
  return best
}

/**
 * Die Sätze, die in Kevins Daten immer wahr sein müssen.
 *
 * Jeder Befund nennt eine Zahl und einen Handgriff — „irgendwas stimmt nicht"
 * hilft morgens um sieben niemandem. `schwere: 'hoch'` heißt: hier arbeitet
 * jemand mit falschen Zahlen oder es läuft etwas gar nicht.
 *
 * @param {{netzwerk?: any[], threads?: any[], erstnachrichten?: any[], netzMeta?: object, runs?: any[]}} daten
 * @param {Date} jetzt
 */
export function pruefeWidersprueche(daten, jetzt = new Date()) {
  const netzwerk = daten.netzwerk ?? []
  const threads = daten.threads ?? []
  const erstnachrichten = daten.erstnachrichten ?? []
  const netzMeta = daten.netzMeta ?? {}
  const runs = daten.runs ?? []

  const befunde = []
  const melde = (schluessel, schwere, text, zahl, tun) =>
    befunde.push({ schluessel, schwere, text, zahl, tun })

  // Namens-Register des Postfachs: wer dort steht, wurde angeschrieben.
  const threadNamen = new Set()
  const antwortNamen = new Set()
  for (const t of threads) {
    const n = normName(t.name)
    if (!n) continue
    threadNamen.add(n)
    if (t.last_from === 'them') antwortNamen.add(n)
  }

  // --- Satz 1: Wer einen Thread hat, kann keine offene Erstnachricht sein ---
  // Der Originalfehler. Der Haken im Cockpit ist nur die halbe Wahrheit; die
  // andere steht im Postfach.
  const offeneMitThread = erstnachrichten.filter(
    (e) => e.status === 'offen' && threadNamen.has(normName(e.name)),
  )
  if (offeneMitThread.length > 0) {
    const geantwortet = offeneMitThread.filter((e) => antwortNamen.has(normName(e.name))).length
    /**
     * Kevins Einwand vom 18.08.: „Wenn ich jemanden anfrage, der nicht annimmt,
     * und dem dann eine InMail schicke, hab ich den ja auch schon geschrieben —
     * dann bricht die Regel."
     *
     * Er hat recht, und der Unterschied ist keiner von Wortklauberei: Steht die
     * Einladung noch offen, kann der Thread nur aus der InMail-Welle stammen.
     * Dann ist die vorbereitete Erstnachricht **nicht** verschickt, sondern
     * ungenutzt — und „als verschickt verbuchen" würde einen Text abhaken, den
     * niemand je gelesen hat. Nimmt die Person später an, wäre er der richtige
     * nächste Zug.
     *
     * Am 18.08. gemessen: 78 von 78 hatten die Einladung angenommen, kein
     * einziger InMail-Fall. Die Unterscheidung steht hier für den Tag, an dem
     * die wöchentliche InMail-Welle einen produziert — sichtbar, statt still
     * mitverbucht.
     */
    const netzStatus = new Map()
    for (const n of netzwerk) {
      const k = normName(n.name)
      if (k) netzStatus.set(k, n.status)
    }
    const ausInMail = offeneMitThread.filter((e) => netzStatus.get(normName(e.name)) === 'offen').length
    const nurHaken = offeneMitThread.length - ausInMail
    melde(
      'erstnachricht_trotz_thread',
      'hoch',
      `${offeneMitThread.length} Erstnachrichten gelten als offen, obwohl die Person schon einen Thread im Postfach hat` +
        (geantwortet > 0 ? ` — ${geantwortet} davon haben sogar geantwortet` : '') +
        (ausInMail > 0
          ? ` · Achtung: bei ${ausInMail} steht die Einladung noch offen — dort lief eine InMail, die vorbereitete Nachricht ist ungenutzt`
          : ''),
      offeneMitThread.length,
      ausInMail > 0
        ? `Die ${nurHaken} mit angenommener Einladung verbuchen; die ${ausInMail} aus der InMail-Welle vorher ansehen`
        : 'Im LinkedIn-Bereich „Als verschickt verbuchen" klicken',
    )
  }

  // --- Satz 2: Wer schreibt, hat die Einladung angenommen ------------------
  // Ein Netzwerk-Eintrag auf „offen" bei vorhandenem Thread heißt: der
  // Netzwerk-Stand ist älter als das Postfach. Solche Leute fehlen im
  // Arbeitsvorrat „angenommen, aber nie angeschrieben".
/**
   * 18.08.: Die Regel galt zu weit und schlug acht Mal Fehlalarm.
   *
   * Geprüft an den acht Namen: Markus Sahm, Fabian Schmitt, Quentin Schäfer und
   * die anderen standen am 18.08. nachweislich noch auf LinkedIns
   * Einladungsliste — der vollständige Lauf desselben Tages hat sie dort
   * gesehen. „Offen" ist also die Wahrheit, und der Thread daneben auch: Genau
   * so funktioniert Kevins InMail-Welle, die Leute mit OFFENER Anfrage
   * anschreibt (zwei der acht haben sogar geantwortet, ohne anzunehmen).
   *
   * Der echte Widerspruch ist ein anderer: Jemand steht auf „offen", wurde beim
   * letzten vollständigen Lauf aber NICHT mehr gesehen. Dann ist der Status ein
   * Datenrest — und nur dann fehlt die Person im Arbeitsvorrat „angenommen,
   * aber nie angeschrieben".
   */
  /**
   * Verglichen wird gegen die **eigene** Liste, nicht gegen die zuletzt
   * gelaufene: `status: 'offen'` stammt aus der Einladungsliste, `angenommen`
   * aus den Kontakten. Beide laufen nacheinander (18.08.: Einladungen 11:48,
   * Kontakte 11:51) — wer beide Stempel in einen Topf wirft, erklärt jeden
   * Einladungs-Eintrag für veraltet, weil die Kontakte drei Minuten später
   * fertig wurden. Genau so meldete die frisch geschärfte Regel im ersten
   * Anlauf dieselben acht Fehlalarme wie vorher.
   */
  const vollAtVon = (status) => netzMeta[status === 'offen' ? 'einladungen' : 'kontakte']?.vollAt
  const offenTrotzThread = netzwerk.filter((n) => {
    if (n.status !== 'offen' || !threadNamen.has(normName(n.name))) return false
    const voll = vollAtVon(n.status)
    if (!voll) return false
    // Als ZEITPUNKT vergleichen, nicht als Zeichenkette (18.08., im Echtbetrieb
    // aufgeflogen): Postgres liefert `…281+00:00`, `toISOString()` schreibt
    // `…281Z` — derselbe Moment, aber `+` sortiert vor `Z`. Der Textvergleich
    // erklärte damit alle 950 frisch gesehenen Einladungen für veraltet und
    // meldete exakt dieselben acht Fehlalarme wie die ungeschärfte Regel. Eine
    // Sekunde Toleranz obendrauf, weil Lauf-Stempel und Meta-Stempel aus
    // derselben Runde minimal auseinanderliegen dürfen.
    const gesehen = Date.parse(n.zuletzt_gesehen_at ?? '')
    const vollZeit = Date.parse(voll)
    if (!Number.isFinite(gesehen) || !Number.isFinite(vollZeit)) return false
    return gesehen < vollZeit - 1000
  })
  if (offenTrotzThread.length > 0) {
    melde(
      'netzwerk_offen_trotz_thread',
      'mittel',
      `${offenTrotzThread.length} Kontakte gelten als „Einladung offen", obwohl mit ihnen geschrieben wird und sie beim letzten vollständigen Lauf nicht mehr auf der Liste standen`,
      offenTrotzThread.length,
      'Netzwerk-Sync nachziehen (chrome-sync, dann netzwerkUpsert)',
    )
  }

  // --- Satz 3: Ein Lauf, der abbricht, muss laut sein ----------------------
  /**
   * 18.08.: Diese Regel maß die falsche Zahl — und verpasste dadurch den
   * größten Ausfall, den sie je hätte melden können.
   *
   * Gemessen wurde „geerntet vs. Kopfzahl der Seite". Die Differenz ist aber
   * dauerhaft und harmlos: Am 18.08. standen nach einem vollständigen Lauf 648
   * Kontakte in der Datenbank, im DOM der Seite exakt dieselben 648 eindeutigen
   * Profile — und im Kopf „660 Kontakte". LinkedIn zählt dort mit, was keine
   * anklickbare Karte hat (gelöschte und gesperrte Konten, Einladungen an
   * blanke E-Mail-Adressen). Der Scraper hatte alles. Die Meldung „12 fehlen"
   * stand trotzdem tagelang da und war schlicht nicht zu beheben.
   *
   * Am selben Morgen brachen drei Läufe bei 10, 40 und 50 von 957 ab, weil
   * Chrome die unsichtbare Seite eingefroren hatte — **neunhundert** fehlten,
   * und diese Regel schwieg dazu, weil ein Teil-Lauf die Meta gar nicht anfasst.
   *
   * Deshalb prüft sie jetzt das, was sie immer meinte: Ist der letzte Lauf
   * durchgelaufen oder abgebrochen? Ein Abbruch trägt seit dem 18.08. einen
   * eigenen Vermerk (`letzterAbbruch`, siehe `netzwerkUpsert.mjs`), den der
   * nächste vollständige Lauf wieder abräumt.
   */
  for (const [seite, m] of Object.entries(netzMeta)) {
    const ab = m?.letzterAbbruch
    if (!ab) continue
    const geerntet = Number(ab.geerntet ?? 0)
    const gesamt = Number(ab.gesamt ?? 0)
    melde(
      'sync_abgebrochen',
      // Ein Lauf, der nicht mal ein Viertel schafft, ist kaputt und nicht bloß
      // knapp: genau die Form, in der es am 18.08. auftrat.
      gesamt > 0 && geerntet < gesamt / 4 ? 'hoch' : 'mittel',
      `${seite}: Der letzte Lauf brach bei ${geerntet}${gesamt > 0 ? ` von ${gesamt}` : ''} ab`,
      gesamt > 0 ? gesamt - geerntet : geerntet,
      'Sync wiederholen; bleibt es dabei, steht das Sync-Chrome-Fenster still (Fokus-Emulation prüfen)',
    )
  }

  // --- Satz 3b: Der Erstnachrichten-Spiegel darf nicht doppeln ------------
  /**
   * 18.08.: Ein latenter Schaden, der schon einmal eingetreten ist.
   *
   * Migration 0071 ist in der Prod-Datenbank NICHT angewendet — der Spiegel
   * fängt das ab, indem er auf das alte Konflikt-Ziel `(brand_id, gruppe, name)`
   * ausweicht. Das funktioniert, hat aber genau die Schwäche, für die es 0071
   * gibt: Formuliert Kevin eine Gruppen-Überschrift im Vault um, passt kein
   * Datensatz mehr auf den Konflikt, und die ganze Gruppe wird ein zweites Mal
   * angelegt. Am 14.08. standen so 145 Zeilen für 118 Leads in der Liste, und
   * ein längst abgehakter Lead tauchte als frischer wieder auf.
   *
   * Solange die Migration fehlt, wacht wenigstens diese Regel darüber: Die
   * Quelldatei sagt, wie viele Leads es gibt (`versandfertig`). Stehen mehr
   * Zeilen in der Tabelle, ist gedoppelt worden.
   */
  const versandfertig = Number(daten.erstnachrichtenMeta?.versandfertig ?? 0)
  if (versandfertig > 0 && erstnachrichten.length > versandfertig) {
    melde(
      'erstnachrichten_gedoppelt',
      'hoch',
      `${erstnachrichten.length} Erstnachrichten in der Tabelle, aber nur ${versandfertig} in der Quelldatei — der Spiegel hat gedoppelt`,
      erstnachrichten.length - versandfertig,
      'Migration 0071 anwenden; bis dahin Gruppen-Überschriften im Vault nicht umformulieren',
    )
  }

  // --- Satz 4: Das Postfach darf nicht einfrieren -------------------------
  const postfachAlter = stundenSeit(juengste(threads, 'last_synced_at'), jetzt)
  if (postfachAlter != null && postfachAlter > GRENZEN.postfachStunden) {
    melde(
      'postfach_alt',
      'hoch',
      `LinkedIn-Postfach seit ${alterText(postfachAlter)} nicht gesynct — alle Antwort- und Follow-up-Zahlen sind so alt`,
      Math.round(postfachAlter),
      '`chrome-sync` starten und offen lassen',
    )
  }

  // --- Satz 5: Auch das Netzwerk altert ----------------------------------
  const netzAlter = stundenSeit(juengste(netzwerk, 'zuletzt_gesehen_at'), jetzt)
  if (netzAlter != null && netzAlter / 24 > GRENZEN.netzwerkTage) {
    melde(
      'netzwerk_alt',
      'mittel',
      `Kontakte/Einladungen seit ${Math.floor(netzAlter / 24)} Tagen nicht gesynct`,
      Math.round(netzAlter / 24),
      '`chrome-sync` starten, dann `node runner/linkedin/netzwerkUpsert.mjs`',
    )
  }

  // --- Satz 6: Nachts muss etwas durchlaufen ------------------------------
  // Nicht „heute ein Fehler", sondern „seit wann nichts Gutes mehr" — genau
  // die Frage, die vom 14. bis 17.08. niemand gestellt hat.
  const erfolge = runs.filter((r) => r.status === 'done')
  const letzterErfolg = juengste(erfolge, 'finished') ?? juengste(erfolge, 'started')
  const erfolgAlter = stundenSeit(letzterErfolg, jetzt)
  if (runs.length > 0 && (erfolgAlter == null || erfolgAlter > GRENZEN.agentenStunden)) {
    melde(
      'agenten_still',
      'hoch',
      erfolgAlter == null
        ? 'Kein einziger erfolgreicher Agenten-Lauf im Fenster'
        : `Seit ${Math.floor(erfolgAlter / 24)} Tagen ist kein Agent mehr durchgelaufen`,
      erfolgAlter == null ? -1 : Math.round(erfolgAlter),
      'Agenten-Seite öffnen; bei „Anmeldung abgelaufen" im Terminal `claude` neu anmelden',
    )
  }

  return {
    stand: jetzt.toISOString(),
    anzahl: befunde.length,
    hoch: befunde.filter((b) => b.schwere === 'hoch').length,
    befunde,
  }
}

// --- Laden und Schreiben (nur im Direktbetrieb) ----------------------------

function kopf() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
}

/**
 * Alle Zeilen einer Tabelle — mit Blättern.
 *
 * PostgREST deckelt still bei 1.000 Zeilen. `linkedin_netzwerk` hat über 1.600;
 * ohne diese Schleife prüft der Wächter zwei Drittel der Daten und meldet
 * beruhigt „alles in Ordnung". Ein Wächter mit blindem Fleck ist schlimmer als
 * keiner.
 */
async function alleZeilen(pfad) {
  const raus = []
  for (let von = 0; ; von += 1000) {
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${pfad}`, {
      headers: { ...kopf(), Range: `${von}-${von + 999}` },
    })
    if (!res.ok) throw new Error(`${pfad}: HTTP ${res.status} ${(await res.text()).slice(0, 160)}`)
    const teil = await res.json()
    raus.push(...teil)
    if (teil.length < 1000) return raus
  }
}

async function einSnapshot(key) {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/runner_snapshots?key=eq.${key}&select=data&limit=1`,
    { headers: kopf() },
  )
  if (!res.ok) return {}
  const rows = await res.json()
  return rows[0]?.data ?? {}
}

export async function ladeUndPruefe(jetzt = new Date()) {
  const [netzwerk, threads, erstnachrichten, netzMeta, runsSnap, erstMeta] = await Promise.all([
    alleZeilen('linkedin_netzwerk?select=name,status,zuletzt_gesehen_at&order=id'),
    alleZeilen('linkedin_threads?select=name,last_from,last_synced_at&order=id'),
    alleZeilen('linkedin_erstnachrichten?select=name,status&order=id'),
    einSnapshot('linkedin_netzwerk_meta'),
    einSnapshot('runs'),
    einSnapshot('erstnachrichten_meta'),
  ])
  return pruefeWidersprueche(
    {
      netzwerk,
      threads,
      erstnachrichten,
      netzMeta,
      erstnachrichtenMeta: erstMeta,
      runs: runsSnap?.runs ?? [],
    },
    jetzt,
  )
}

/** Das Ergebnis dorthin legen, wo Cockpit und Session-Hook es beide lesen. */
export async function schreibeBefund(ergebnis) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/runner_snapshots`, {
    method: 'POST',
    headers: { ...kopf(), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ key: SNAPSHOT_KEY, data: ergebnis, updated_at: ergebnis.stand }),
  })
  if (!res.ok) throw new Error(`Snapshot HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ergebnis = await ladeUndPruefe()
  for (const b of ergebnis.befunde) {
    console.log(`[${b.schwere === 'hoch' ? '!!' : ' ·'}] ${b.text}\n     → ${b.tun}`)
  }
  console.log(`\n${ergebnis.anzahl} Widersprüche (${ergebnis.hoch} davon dringend)`)
  if (!process.argv.includes('--dry-run')) {
    await schreibeBefund(ergebnis)
    console.log('Befund gespeichert (runner_snapshots.widersprueche)')
  }
  process.exit(0)
}
