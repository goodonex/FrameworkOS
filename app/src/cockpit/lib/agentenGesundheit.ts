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
  /** Eine Zeile für den Morgen — null, wenn alles in Ordnung ist. */
  meldung: string | null
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

export function agentenBefund(runs: RunSummary[], jetzt: Date = new Date()): AgentenBefund {
  const heute = tagesStempel(jetzt)
  const heutige = runs.filter((r) => istHeute(r, heute))

  const fehlschlaege = heutige
    .filter((r) => r.status === 'error')
    .sort((a, b) => String(b.started).localeCompare(String(a.started)))

  const erfolgreich = ROUTINE_AGENTEN.filter((a) =>
    heutige.some((r) => r.agent === a && r.status === 'done'),
  )
  const ausstehend = ROUTINE_AGENTEN.filter(
    (a) => !heutige.some((r) => r.agent === a && (r.status === 'done' || r.status === 'error')),
  )

  let meldung: string | null = null
  if (fehlschlaege.length > 0) {
    const namen = [...new Set(fehlschlaege.map((r) => r.agent))]
    meldung =
      namen.length === 1
        ? `${namen[0]} ist heute gescheitert`
        : `${namen.length} Agenten sind heute gescheitert: ${namen.join(', ')}`
  }

  return { fehlschlaege, erfolgreich, ausstehend, meldung }
}
