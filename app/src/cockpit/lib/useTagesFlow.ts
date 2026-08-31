import { angenommenOhneErstnachricht } from './funnelStufen'
import { icpUrteil, istArbeitsVorrat } from './icp'
import { useEffect, useMemo } from 'react'
import { useErstnachrichten } from '../../hooks/useErstnachrichten'
import { useContacts } from '../../hooks/useContacts'
import { useLinkedinNetzwerk } from '../../hooks/useLinkedinNetzwerk'
import { useLinkedinThreads } from '../../hooks/useLinkedinThreads'
import { useActiveBrand } from './activeBrand'
import { antwortPosten, erstnachrichtPosten, followupPosten, loomPosten } from './arbeitsmodusQuellen'
import { heutigesMetrikDatum } from './metricsDates'
import { useTagesPortionen, type TagesPortionen } from './useTagesPortionen'
import { useUiSetting } from './uiSettings'
import {
  PORTION_STUFEN,
  TAGES_FLOW_ZIELE,
  einzufrierendePortionen,
  flowQuellen,
  stufenStaende,
  type FlowEingabe,
  type StufenStand,
  type TagesZeile,
  type ZielUeberschreibung,
} from './tagesFlow'

/**
 * Die Verdrahtung des Tages-Flows an die Hooks (11.08.2026, erweitert 18.08.).
 *
 * Die Rechnung selbst steht in `tagesFlow.ts` und ist dort ohne React prüfbar.
 * Hier kommt nur zusammen, was sie braucht: die heutige Zeile aus
 * `daily_metrics`, die Live-Zahlen der Quellen (Fällige, offene
 * Erstnachrichten, wartende Antworten, offene Looms) und Kevins eigene Ziele
 * aus `ui_settings`.
 *
 * **Dieser Hook lädt die Tageszeile bewusst NICHT selbst.** Alle Aufrufer
 * halten sie ohnehin in der Hand (der Zähl-Modus zum Schreiben, der Homescreen
 * für den Hero) — ein eigener Ladelauf hier hiesse, `daily_metrics` auf
 * derselben Seite zweimal zu abonnieren.
 */

/** Ohne Eintrag in `ui_settings` gelten die Standard-Ziele. Modul-Konstante, damit die Referenz steht. */
const KEINE_ZIELE: ZielUeberschreibung = {}

/** Die Live-Zahlen, die der Flow neben der Tageszeile braucht. */
export type FlowLiveQuellen = Pick<
  FlowEingabe,
  'faelligHeute' | 'erstnachrichtenOffen' | 'loomsOffen' | 'antworten' | 'portionen'
>

export interface TagesFlowStand {
  staende: StufenStand[]
  /**
   * Solange `true`, ist jede Aussage über „erledigt" vorläufig — beim ersten
   * Render sind alle Zähler 0 und jede Stufe sähe offen aus. Wer daraus
   * springt (Auto-Advance), muss diesen Zustand abwarten.
   */
  laedt: boolean
  /** Die eingefrorenen Portionen mitsamt Historie — für Streak und Sales-Zeilen. */
  portionen: TagesPortionen
}

/**
 * Die Live-Quellen für Seiten, die `usePosten` NICHT ohnehin rufen (der
 * Zähl-Modus). Lädt Threads und Erstnachrichten genau einmal und leitet alle
 * Zahlen aus denselben Posten-Funktionen ab wie die Sales-Zeilen — kein
 * zweiter Rechenweg.
 */
export function useFlowLiveQuellen(): { quellen: FlowLiveQuellen; laedt: boolean } {
  const { activeBrand } = useActiveBrand()
  const threads = useLinkedinThreads(activeBrand?.slug)
  const erstnachrichten = useErstnachrichten(activeBrand?.slug)
  // Nur für den Profil-Link an den Erstnachrichten (18.08.2026).
  const netzwerk = useLinkedinNetzwerk(activeBrand?.slug)
  // Kunden gehören in keine Akquise-Spur (18.08.2026, Fall Reichentrog).
  const contacts = useContacts(activeBrand?.slug)
  // Der Mount-Zeitpunkt genügt: die Follow-up-Schwellen sind Tage (3/7/14),
  // eine Zähl-Sitzung dauert Minuten. Ein Minutentakt wie in `usePosten` würde
  // hier nur Neuberechnungen erzeugen, die nichts ändern.
  const jetzt = useMemo(() => new Date(), [])
  const quellen = useMemo(
    () =>
      flowQuellen(
        {
          followup: followupPosten(threads.items, jetzt, contacts.items),
          erstnachricht: erstnachrichtPosten(erstnachrichten.items, threads.items, netzwerk.items),
          erstnachrichtWartend: angenommenOhneErstnachricht(
            netzwerk.items,
            threads.items,
            erstnachrichten.items,
            jetzt,
          ).filter((p) => istArbeitsVorrat(icpUrteil(p.info ?? '', p.name).urteil)),
          loom: loomPosten(threads.items),
          antwort: antwortPosten(threads.items, jetzt, contacts.items),
        },
        jetzt,
      ),
    [threads.items, erstnachrichten.items, netzwerk.items, contacts.items, jetzt],
  )
  return { quellen, laedt: threads.loading || erstnachrichten.loading }
}

/** Der Stand aller Stufen — die eine Berechnung, die Hero, Zähl-Modus und Sales teilen. */
export function useTagesFlow(
  today: TagesZeile,
  quellen: FlowLiveQuellen,
  quelleLaedt = false,
): TagesFlowStand {
  const { wert: ziele, geladen } = useUiSetting<ZielUeberschreibung>(TAGES_FLOW_ZIELE, KEINE_ZIELE)
  const heute = heutigesMetrikDatum()
  const portionen = useTagesPortionen(heute)

  /**
   * Das Einfrieren (Migration 0074) wohnt HIER, nicht in den Flächen: jede
   * Fläche, die den Flow rechnet, friert damit automatisch ein — wer morgens
   * zuerst öffnet (Home, Zähl-Modus oder /sales), schreibt die Portion fest.
   *
   * Erst wenn ALLES steht (Quellen, Ziele, Portionen geladen), sonst würde
   * eine 0 aus dem Ladezustand als Tages-Soll festgeschrieben. `friereEin`
   * schreibt nur fehlende Stufen; vorhandene Zeilen gewinnen (on conflict).
   */
  useEffect(() => {
    if (quelleLaedt || !geladen || !portionen.geladen || portionen.tableMissing) return
    const fehlen = PORTION_STUFEN.filter((id) => portionen.heutige[id] == null)
    if (fehlen.length === 0) return
    const alle = einzufrierendePortionen({ today, ...quellen, ziele })
    const nurFehlende = Object.fromEntries(fehlen.map((id) => [id, alle[id] ?? 0]))
    portionen.friereEin(nurFehlende)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- eingefroren wird der Stand des Moments, nicht jeder neue
  }, [quelleLaedt, geladen, portionen.geladen, portionen.tableMissing, portionen.heutige])

  const staende = useMemo(
    () => stufenStaende({ today, ...quellen, portionen: portionen.heutige, ziele }),
    [today, quellen, portionen.heutige, ziele],
  )

  const laedt = quelleLaedt || !geladen || !portionen.geladen

  /**
   * Der Gegen-Vermerk zum Einfrieren (0075, 19.08.2026): Steht eine Stufe,
   * wird das FESTGEHALTEN — nicht nur angezeigt.
   *
   * Grund: Die Zeile wird auch grün, wenn die Liste leerläuft, ohne dass der
   * Zähler das Soll erreicht (Kevin verwirft eine Erstnachricht, statt sie zu
   * senden). Die Streak sah davon nichts und riss am 18.08. bei 37 von 39.
   * Rückwirkend ist „die Liste war leer" nicht rekonstruierbar, also muss der
   * Moment mitgeschrieben werden, in dem er wahr ist.
   */
  useEffect(() => {
    if (laedt || portionen.tableMissing) return
    const fertig = staende
      .filter((s) => s.erledigt && (PORTION_STUFEN as readonly string[]).includes(s.stufe.id))
      .map((s) => s.stufe.id)
    if (fertig.length) portionen.merkeErledigt(fertig)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- festgehalten wird der Moment, nicht jede Neuberechnung
  }, [laedt, portionen.tableMissing, staende])

  return { staende, laedt, portionen }
}
