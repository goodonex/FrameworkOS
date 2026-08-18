import type { RunSummary } from './runnerApi'

/**
 * Sind die Routinen von heute Nacht durchgelaufen? (O17 Schritt 4, 07.08.2026)
 *
 * **Warum es das braucht.** Der `RunWatcher` toastet nur, wenn er einen Lauf
 * *live* von „running" nach „error" wechseln sieht. Ein Agent, der um 6:00
 * scheitert, während niemand das Cockpit offen hat, wird nie gemeldet — genau
 * so blieben neun Fehlschläge zwischen dem 03. und 07.08. unbemerkt, und der
 * Morgenbrief fehlte tagelang, ohne dass es irgendwo stand.
 *
 * Reine Funktionen, testbar per `npx tsx scripts/verify-agenten-gesundheit.ts`.
 */

/** Agenten, die von selbst laufen sollen — nur deren Ausbleiben ist eine Nachricht. */
export const ROUTINE_AGENTEN = ['morgenbrief', 'linkedin-antwort-entwuerfe', 'dream-check'] as const

export type RoutineAgent = (typeof ROUTINE_AGENTEN)[number]

export interface AgentenBefund {
  /** Heute gescheiterte Läufe, jüngster zuerst. */
  fehlschlaege: RunSummary[]
  /** Routinen, die heute erfolgreich durch sind. */
  erfolgreich: string[]
  /** Routinen, von denen heute weder Erfolg noch Fehlschlag vorliegt. */
  ausstehend: string[]
  /**
   * Der jüngste Fehlschlag, der Kevins Eingreifen verlangt — oder `null`.
   * Für den Hinweis, der über der Agenten-Liste steht.
   */
  handlungsbedarf: RunSummary | null
  /** Eine Zeile für den Morgen — null, wenn alles in Ordnung ist. */
  meldung: string | null
}

/**
 * Steht Uriel still, bis Kevin selbst eingreift? (17.08.2026)
 *
 * Dann übernimmt der Sperrbalken in der Shell die Meldung, und die dünnen
 * Warnzeilen auf Home und Morgen-Seite halten still — zweimal dieselbe Warnung
 * untereinander liest sich wie ein Anzeigefehler und schwächt beide.
 */
export function istGesperrt(befund: AgentenBefund): boolean {
  return Boolean(befund.handlungsbedarf?.grund?.handeln)
}

/** Lokales Tagesdatum (YYYY-MM-DD) — die Run-Ids tragen dieselbe Schreibweise. */
export function tagesStempel(jetzt: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${jetzt.getFullYear()}-${p(jetzt.getMonth() + 1)}-${p(jetzt.getDate())}`
}

function istHeute(run: RunSummary, heute: string): boolean {
  // `started` ist ISO/UTC, die Run-Id trägt die lokale Zeit. Für „heute" zählt
  // die lokale Sicht, sonst wäre ein 01:00-Lauf im Sommer schon „gestern".
  return typeof run.id === 'string' && run.id.startsWith(heute)
}

/**
 * Wochenende? Dann sind ausbleibende Routinen kein Befund — `morgenbrief` und
 * `linkedin-antwort-entwuerfe` laufen werktags (runner/index.mjs).
 */
export function istWerktag(jetzt: Date): boolean {
  const t = jetzt.getDay()
  return t !== 0 && t !== 6
}

/** Vergleichbarer Zeitpunkt eines Laufs — `started` ist ISO, die Id sortiert genauso. */
function zeitpunkt(run: RunSummary): string {
  return String(run.started || run.id)
}

/**
 * Ein Lauf, der nie stattgefunden hat (18.08.2026).
 *
 * Der Runner meldet seit dem 18.08. `fehlstart`, wenn ein Lauf ins Zeitlimit
 * lief, ohne einen einzigen Werkzeug-Aufruf zu machen — der Mac schlief, die
 * CLI kam nicht zu einem Zug. Das ist kein gescheiterter Agent: Der Runner
 * wartet von selbst auf den wachen Rechner und startet neu. Es rot zu melden
 * hieße, Kevin für etwas an den Rechner zu rufen, das sich allein erledigt.
 */
function istFehlstart(run: RunSummary): boolean {
  return run.grund?.schluessel === 'fehlstart'
}

export function agentenBefund(runs: RunSummary[], jetzt: Date = new Date()): AgentenBefund {
  const heute = tagesStempel(jetzt)
  const heutige = runs.filter((r) => istHeute(r, heute))

  /**
   * Der jüngste Erfolg **je Agent** — die Grenze, ab der ältere Fehlschläge
   * erledigt sind (18.08.2026).
   *
   * Der Fehler, den das behebt: Am 18.08. scheiterten Morgenbrief und
   * Antwort-Entwürfe früh, liefen um 10:07 beide sauber durch — und das rote
   * Banner meldete trotzdem weiter „2 Agenten sind heute gescheitert". Die
   * Regel gab es schon für den Sperrbalken (`handlungsbedarf`, 17.08.), aber
   * nicht für die Meldung darunter. Eine Warnung, die nach der Reparatur
   * stehen bleibt, bringt man sich bei zu übersehen.
   */
  const erfolgBis = new Map<string, string>()
  for (const r of heutige) {
    if (r.status !== 'done') continue
    const bisher = erfolgBis.get(r.agent)
    if (!bisher || zeitpunkt(r) > bisher) erfolgBis.set(r.agent, zeitpunkt(r))
  }
  const ueberholt = (r: RunSummary): boolean => {
    const erfolg = erfolgBis.get(r.agent)
    return Boolean(erfolg && zeitpunkt(r) < erfolg)
  }

  const fehlschlaege = heutige
    .filter((r) => r.status === 'error' && !istFehlstart(r) && !ueberholt(r))
    .sort((a, b) => String(b.started).localeCompare(String(a.started)))

  const erfolgreich = ROUTINE_AGENTEN.filter((a) =>
    heutige.some((r) => r.agent === a && r.status === 'done'),
  )
  // Ein Fehlstart zählt hier NICHT als „hat heute stattgefunden": Der Agent
  // steht weiter aus, und genau das soll die Oberfläche sagen, wenn der Mac
  // einen ganzen Vormittag durchschläft.
  const ausstehend = ROUTINE_AGENTEN.filter(
    (a) =>
      !heutige.some(
        (r) => r.agent === a && (r.status === 'done' || (r.status === 'error' && !istFehlstart(r))),
      ),
  )

  /**
   * Der jüngste Fehlschlag, den Kevin selbst beheben muss (12.08.).
   *
   * Er sticht die Namensliste: dass „2 Agenten gescheitert" sind, half am
   * 11.08. niemandem — dass die Anmeldung abgelaufen war, hätte den Tag
   * gerettet. Verlangt kein Grund ein Eingreifen, bleibt es bei den Namen.
   *
   * **Ein Erfolg danach hebt den Befund auf (17.08.).** Gründe wie „Anmeldung
   * abgelaufen" gelten für das ganze Konto: Läuft irgendein Agent wieder durch,
   * ist die Ursache nachweislich behoben. Ohne diese Regel stand der Sperrbalken
   * nach der Reparatur bis Mitternacht weiter — eine Warnung, die nicht
   * verschwindet, wenn man sie befolgt, ist wertlos.
   */
  const letzterErfolg = heutige
    .filter((r) => r.status === 'done')
    .map((r) => String(r.started || r.id))
    .sort()
    .pop()
  const handlungsbedarf =
    fehlschlaege.find(
      (r) => r.grund?.handeln && (!letzterErfolg || String(r.started || r.id) > letzterErfolg),
    ) ?? null

  let meldung: string | null = null
  if (handlungsbedarf?.grund) {
    meldung = `${handlungsbedarf.grund.kurz} — ${handlungsbedarf.grund.hinweis}`
  } else if (fehlschlaege.length > 0) {
    const namen = [...new Set(fehlschlaege.map((r) => r.agent))]
    // Ist der Grund bekannt, aber harmlos, steht er trotzdem dabei — sonst
    // rätselt man bei „gescheitert" jedes Mal neu.
    const grund = fehlschlaege[0].grund?.kurz
    const kern =
      namen.length === 1
        ? `${namen[0]} ist heute gescheitert`
        : `${namen.length} Agenten sind heute gescheitert: ${namen.join(', ')}`
    meldung = grund ? `${kern} — ${grund}` : kern
  }

  return { fehlschlaege, erfolgreich, ausstehend, handlungsbedarf, meldung }
}
