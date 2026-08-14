/**
 * Kundenarbeit als Quelle für Rang 1 + 2 der Prioritätenliste (Wargame
 * docs/wargames/sales-arbeitsmodus.md, Zug 6). Reine Funktionen, keine
 * Netzwerkaufrufe — per `npx tsx scripts/verify-kundenarbeit.ts` prüfbar.
 *
 * Ausschließlich die drei bestehenden Quellen (Recon 29.07., nichts Neues
 * modellieren): `foundation_tasks` (Task[], project_id), `deliver_projects`
 * (DeliverProject[]) und `contacts.stage_changed_at`. Reicht das nicht,
 * ist es RECON-3 — melden, nicht modellieren.
 */
import type { Contact, DeliverProject, Task } from '../../types/db'
import type { Posten } from './prioritaet'

const DAY_MS = 24 * 60 * 60 * 1000

/** Kevins Formulierung: „die ist seit zwei Wochen im Review, mach da mal ein Follow-up." */
export const LIEGT_AB_TAGEN = 14

function ageDays(iso: string | null | undefined, heute: Date): number {
  if (!iso) return Number.POSITIVE_INFINITY
  const ms = heute.getTime() - new Date(iso).getTime()
  return Number.isFinite(ms) ? ms / DAY_MS : Number.POSITIVE_INFINITY
}

function isOffen(task: Task): boolean {
  return task.status === 'open' || task.status === 'in_progress'
}

/**
 * Wie lange liegt ein Projekt wirklich? (D1, docs/wargames/technik-fundament.md)
 *
 * Stufe 1: das Minimum der **endlichen** Anker — ein fehlendes Datum darf den
 * echten Wert nicht überstimmen. Stufe 2: fehlen beide, zählt das Projektalter
 * seit Anlage; `created_at` wird bewusst NIE ins Minimum gemischt, sonst würde
 * jedes junge Projekt „liegend". Stufe 3: ist auch das unbekannt, gibt es keine
 * ehrliche Zahl — `null`, und der Aufrufer lässt das Projekt aus der Liste,
 * statt „Seit Infinity Tagen" zu drucken.
 */
export function liegtSeitTagen(
  stageAlter: number,
  aufgabeAlter: number,
  projektAlter: number,
): number | null {
  const endliche = [stageAlter, aufgabeAlter].filter((n) => Number.isFinite(n))
  if (endliche.length > 0) return Math.floor(Math.min(...endliche))
  if (Number.isFinite(projektAlter)) return Math.floor(projektAlter)
  return null
}

/** Rang 1 — offene Aufgaben MIT project_id (die Quelle, die Kevins Gesetz trägt). */
export function kundenaufgabenPosten(
  tasks: Task[],
  projekte: DeliverProject[],
  kontakte: Contact[],
): Posten[] {
  const projektById = new Map(projekte.map((p) => [p.id, p]))
  const kontaktById = new Map(kontakte.map((c) => [c.id, c]))

  return tasks
    .filter((t) => isOffen(t) && t.project_id)
    .map((t): Posten => {
      const projekt = t.project_id ? projektById.get(t.project_id) : undefined
      const kontakt = t.contact_id ? kontaktById.get(t.contact_id) : undefined
      const name = kontakt?.name?.trim() || projekt?.client_name?.trim() || projekt?.name?.trim() || 'Kunde'
      const firma = projekt?.name?.trim() || kontakt?.company?.trim() || undefined
      const website = kontakt?.website?.trim() || undefined
      return {
        id: `task:${t.id}`,
        spur: 'kundenaufgabe',
        name,
        firma,
        website,
        text: [t.title, t.notes].filter((s) => s && s.trim()).join('\n\n') || t.title,
        timestamp: t.due_at ?? t.created_at,
      }
    })
}

/**
 * Aufgaben OHNE `project_id` — die Gegenmenge zu {@link kundenaufgabenPosten}.
 *
 * Bis zum 14.08.2026 fielen sie überall durch: das Sales-Dashboard filtert auf
 * `project_id`, also meldete „Kundenarbeit" 0 offen, während unter `/aufgaben`
 * ein seit 73 Tagen überfälliger Anruf lag. Kevins Entscheidung: sichtbar
 * machen, aber hinter LinkedIn einsortieren (Spur `aufgabe`, siehe RANGFOLGE) —
 * und abhakbar, damit er sie wegklicken kann, statt sie zu verwalten.
 */
export function eigeneAufgabenPosten(tasks: Task[], kontakte: Contact[]): Posten[] {
  const kontaktById = new Map(kontakte.map((c) => [c.id, c]))

  return tasks
    .filter((t) => isOffen(t) && !t.project_id)
    .map((t): Posten => {
      const kontakt = t.contact_id ? kontaktById.get(t.contact_id) : undefined
      return {
        id: `task:${t.id}`,
        spur: 'aufgabe',
        name: kontakt?.name?.trim() || t.title,
        firma: kontakt?.company?.trim() || undefined,
        website: kontakt?.website?.trim() || undefined,
        text: [t.title, t.notes].filter((s) => s && s.trim()).join('\n\n') || t.title,
        timestamp: t.due_at ?? t.created_at,
      }
    })
}

export interface LiegendesProjekt {
  projekt: DeliverProject
  kontakt: Contact | undefined
  tage: number
}

/**
 * Projekte, die Kevins „liegt zu lange"-Regel treffen: seit > 14 Tagen weder
 * Stage-Wechsel noch erledigte Aufgabe. Nur aktive Projekte — abgeschlossene
 * liegen per Definition nicht mehr.
 */
export function liegendeProjekte(
  projekte: DeliverProject[],
  tasks: Task[],
  kontakte: Contact[],
  heute: Date,
): LiegendesProjekt[] {
  const kontaktById = new Map(kontakte.map((c) => [c.id, c]))
  const letzteErledigungByProjekt = new Map<string, string>()
  for (const t of tasks) {
    if (!t.project_id || !t.completed_at) continue
    const bisher = letzteErledigungByProjekt.get(t.project_id)
    if (!bisher || t.completed_at > bisher) letzteErledigungByProjekt.set(t.project_id, t.completed_at)
  }

  const out: LiegendesProjekt[] = []
  for (const projekt of projekte) {
    if (projekt.status !== 'active') continue
    const kontakt = projekt.client_contact_id ? kontaktById.get(projekt.client_contact_id) : undefined
    const stageAlter = ageDays(kontakt?.stage_changed_at, heute)
    const aufgabeAlter = ageDays(letzteErledigungByProjekt.get(projekt.id) ?? null, heute)
    if (stageAlter > LIEGT_AB_TAGEN && aufgabeAlter > LIEGT_AB_TAGEN) {
      const tage = liegtSeitTagen(stageAlter, aufgabeAlter, ageDays(projekt.created_at, heute))
      if (tage === null) continue
      out.push({ projekt, kontakt, tage })
    }
  }
  return out.sort((a, b) => b.tage - a.tage)
}

/** Rang 2 — dieselbe Regel, als Posten für den Arbeitsmodus. */
export function kundeLiegtPosten(
  projekte: DeliverProject[],
  tasks: Task[],
  kontakte: Contact[],
  heute: Date,
): Posten[] {
  return liegendeProjekte(projekte, tasks, kontakte, heute).map(({ projekt, kontakt, tage }): Posten => {
    const name = kontakt?.name?.trim() || projekt.client_name?.trim() || projekt.name?.trim() || 'Kunde'
    return {
      id: `liegt:${projekt.id}`,
      spur: 'kunde_liegt',
      name,
      firma: projekt.name?.trim() || undefined,
      website: kontakt?.website?.trim() || undefined,
      text: `Seit ${tage} Tagen keine Bewegung — Follow-up entwerfen.`,
      timestamp: kontakt?.stage_changed_at ?? null,
    }
  })
}
