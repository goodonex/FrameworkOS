import { useEffect, useMemo, useState } from 'react'
import { antwortPosten, erstnachrichtPosten, followupPosten, loomPosten } from '../cockpit/lib/arbeitsmodusQuellen'
import {
  eigeneAufgabenPosten,
  kundeLiegtPosten,
  kundenaufgabenPosten,
  liegendeProjekte,
} from '../cockpit/lib/kundenarbeit'
import { ordnePosten, type Posten, type PostenQuellen } from '../cockpit/lib/prioritaet'
import { useContacts, type UseContactsResult } from './useContacts'
import { useDeliverProjects } from './useDeliverProjects'
import { useErstnachrichten } from './useErstnachrichten'
import { useLinkedinNetzwerk } from './useLinkedinNetzwerk'
import { useLinkedinThreads } from './useLinkedinThreads'
import { useTasks } from './useTasks'

/**
 * Die Posten-Verdrahtung an EINER Stelle (Etappe 3, Schritt 4). Vorher lagen
 * diese ~40 Zeilen im SalesDashboard, und die Home beantwortete „was zuerst?"
 * mit einer eigenen, konkurrierenden Fälligkeits-Logik. Jetzt lesen Heute-Deck
 * und Sales-Kacheln dieselbe Rangfolge aus `ordnePosten`.
 *
 * Der Hook lädt keine eigenen Daten doppelt: die Unter-Hooks cachen nicht, aber
 * beide Aufrufer montieren ihn genau einmal je Seite.
 */
export interface UsePostenResult {
  /** Alle Posten in Rangfolge (Zug 1) — die Oberfläche kürzt selbst. */
  geordnet: Posten[]
  quellen: PostenQuellen
  /** Projekte, die > 14 Tage liegen — eigene Kennzahl der Kachel „Liegt zu lange". */
  liegend: ReturnType<typeof liegendeProjekte>
  /** Minutengenauer „jetzt"-Zeitpunkt, den alle abgeleiteten Werte teilen. */
  jetzt: Date
  contacts: UseContactsResult
  projekte: ReturnType<typeof useDeliverProjects>
  tasks: ReturnType<typeof useTasks>
  linkedinThreads: ReturnType<typeof useLinkedinThreads>
  erstnachrichten: ReturnType<typeof useErstnachrichten>
  /** Die Annahmen aus `linkedin_netzwerk` — Grundlage der Wochenkontrolle. */
  netzwerk: ReturnType<typeof useLinkedinNetzwerk>
}

export function usePosten(slug: string | undefined): UsePostenResult {
  const contacts = useContacts(slug)
  const projekte = useDeliverProjects(slug)
  const tasks = useTasks(slug)
  const linkedinThreads = useLinkedinThreads(slug)
  const erstnachrichten = useErstnachrichten(slug)
  // Nur für den Profil-Link an den Erstnachrichten (18.08.2026) — die Liste
  // selbst kommt weiter aus `linkedin_erstnachrichten`.
  const netzwerk = useLinkedinNetzwerk(slug)

  // Minutentakt statt Date.now() bei jedem Render — sonst rechnen die useMemos
  // unten bei jedem Tastendruck neu.
  const [jetzt, setJetzt] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setJetzt(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const kundenaufgabePosten = useMemo(
    () => kundenaufgabenPosten(tasks.items, projekte.items, contacts.items),
    [tasks.items, projekte.items, contacts.items],
  )
  const eigeneAufgaben = useMemo(
    () => eigeneAufgabenPosten(tasks.items, contacts.items),
    [tasks.items, contacts.items],
  )
  const liegend = useMemo(
    () => liegendeProjekte(projekte.items, tasks.items, contacts.items, jetzt),
    [projekte.items, tasks.items, contacts.items, jetzt],
  )
  const kundeLiegtListe = useMemo(
    () => kundeLiegtPosten(projekte.items, tasks.items, contacts.items, jetzt),
    [projekte.items, tasks.items, contacts.items, jetzt],
  )
  const antwortListe = useMemo(
    () => antwortPosten(linkedinThreads.items, jetzt, contacts.items),
    [linkedinThreads.items, jetzt, contacts.items],
  )
  const loomListe = useMemo(() => loomPosten(linkedinThreads.items), [linkedinThreads.items])
  const followupListe = useMemo(
    () => followupPosten(linkedinThreads.items, jetzt, contacts.items),
    [linkedinThreads.items, jetzt, contacts.items],
  )
  // Threads gegenrechnen: eine verschickte Nachricht bleibt sonst ewig „offen",
  // wenn Kevin sie vom Handy geschickt und den Haken nicht gesetzt hat (17.08.).
  const erstnachrichtListe = useMemo(
    () => erstnachrichtPosten(erstnachrichten.items, linkedinThreads.items, netzwerk.items),
    [erstnachrichten.items, linkedinThreads.items, netzwerk.items],
  )

  const quellen: PostenQuellen = useMemo(
    () => ({
      kundenaufgabe: kundenaufgabePosten,
      kunde_liegt: kundeLiegtListe,
      antwort: antwortListe,
      loom: loomListe,
      erstnachricht: erstnachrichtListe,
      followup: followupListe,
      aufgabe: eigeneAufgaben,
      anfrage: [],
      inmail: [],
    }),
    [
      kundenaufgabePosten,
      kundeLiegtListe,
      antwortListe,
      loomListe,
      erstnachrichtListe,
      followupListe,
      eigeneAufgaben,
    ],
  )

  const geordnet = useMemo(() => ordnePosten(quellen, jetzt), [quellen, jetzt])

  // `netzwerk` gehört mit hinaus: Die Wochenkontrolle (19.08.2026) braucht die
  // Annahmen, und ein zweites Abonnement derselben Tabelle auf derselben Seite
  // wäre ein zweiter Ladelauf für dieselben Daten.
  return {
    geordnet,
    quellen,
    liegend,
    jetzt,
    contacts,
    projekte,
    tasks,
    linkedinThreads,
    erstnachrichten,
    netzwerk,
  }
}

/** Wartende Entwürfe über alle Spuren — die Zahl fürs Heute-Deck. */
export function entwuerfeOffen(geordnet: Posten[]): number {
  return geordnet.filter((p) => p.entwurf && !p.entwurf.veraltet).length
}
